# Phase 2 Hardening Integration Guide

Complete integration steps for applying enterprise-grade safety hardening to Phase 2 real-money execution.

## Overview of Hardening Layers

```
FOUR LAYERS OF PROTECTION
┌─────────────────────────────────────────────────────────────────┐
│ 1. DATABASE LAYER: Idempotency, Locking, Audit                 │
│    - trade_executions (UNIQUE constraint)                       │
│    - scan_jobs (locking columns)                                │
│    - gpt_usage_log (fact-based budget)                          │
│    - trade_history (cooldown/anti-flip)                         │
├─────────────────────────────────────────────────────────────────┤
│ 2. API LAYER: Key Separation                                    │
│    - BitvavoReadonly (no execution, no trading keys)            │
│    - BitvavoTrade (execution only, throws on data access)       │
├─────────────────────────────────────────────────────────────────┤
│ 3. EXECUTION LAYER: Comprehensive Validation                    │
│    - 7 pre-flight checks (allowlist, size, confidence, etc.)    │
│    - Atomic idempotency claiming                                │
│    - Cooldown + anti-flip with override flags                   │
│    - Policy snapshots + request/response audit                  │
├─────────────────────────────────────────────────────────────────┤
│ 4. SCHEDULER LAYER: Concurrency Safety                          │
│    - Job claiming with database-level locking                   │
│    - Fact-based budget tracking (gpt_usage_log)                 │
│    - Automatic lock cleanup                                     │
└─────────────────────────────────────────────────────────────────┘
```

## Step 1: Apply Database Migration

### Before Deployment
```bash
# 1. Connect to Supabase PostgreSQL
psql "postgresql://postgres:PASSWORD@db.PROJECTID.supabase.co:5432/postgres"

# 2. Read migration file to verify
cat src/sql/trading_phase2_hardening.sql

# 3. Run migration in Supabase SQL Editor or psql
\i src/sql/trading_phase2_hardening.sql
```

### Verify Migration Success
```sql
-- Verify new tables
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('trade_executions', 'gpt_usage_log', 'trade_history');

-- Should return: trade_executions, gpt_usage_log, trade_history

-- Verify new columns in scan_jobs
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'scan_jobs' 
AND column_name IN ('locked_at', 'locked_by', 'lock_expires_at');

-- Should return: locked_at, locked_by, lock_expires_at

-- Verify new columns in trade_proposals
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'trade_proposals' 
AND column_name IN ('override_cooldown', 'override_anti_flip', 'policy_hash', 'policy_snapshot');

-- Should return all 4 columns

-- Verify RLS is enabled on new tables
SELECT schemaname, tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('trade_executions', 'gpt_usage_log', 'trade_history')
ORDER BY tablename;
```

## Step 2: Set Up Environment Variables

Create/update `.env.local` in project root:

```bash
# === BITVAVO API KEYS (CRITICAL: Two separate key pairs) ===

# READONLY pair (for scanner/proposer): data access only, NO trading
VITE_BITVAVO_READONLY_KEY=<readonly_api_key>
VITE_BITVAVO_READONLY_SECRET=<readonly_api_secret>

# TRADE pair (for executor): execution ONLY, trading permissions required
VITE_BITVAVO_TRADE_KEY=<trading_api_key>
VITE_BITVAVO_TRADE_SECRET=<trading_api_secret>

# === SCHEDULER INSTANCE IDENTIFICATION ===
VITE_SCHEDULER_INSTANCE_ID=instance-1  # For lock tracking (auto-generated if not set)

# === EXISTING VARS (unchanged) ===
VITE_SUPABASE_URL=<your_supabase_url>
VITE_SUPABASE_KEY=<your_supabase_key>
VITE_OPENAI_API_KEY=<your_openai_key>
```

### Creating Separate Bitvavo API Keys

**Readonly Key (for scanner):**
1. Login to Bitvavo.com → API settings
2. Create new API key with permissions:
   - ✅ View account (read)
   - ✅ View available balance (read)
   - ✅ View markets (read)
   - ✅ View order book (read)
   - ❌ Place orders
   - ❌ Cancel orders
3. Set IP whitelist to your server IP only
4. Store as `BITVAVO_READONLY_KEY` + `BITVAVO_READONLY_SECRET`

**Trade Key (for executor):**
1. Create second API key with permissions:
   - ✅ View account (read)
   - ✅ Place orders (write)
   - ✅ Cancel orders (write)
   - ✅ View own trades (read)
   - ❌ View other accounts (if applicable)
2. Set IP whitelist to your server IP only
3. Set rate limit conservatively (e.g., 5 requests per second max)
4. Store as `BITVAVO_TRADE_KEY` + `BITVAVO_TRADE_SECRET`

## Step 3: Update Handler Layer

### File: `src/server/handlers/trading.ts`

**Replace the old execute handler with hardened version:**

```typescript
// OLD CODE (remove):
// import { handleTradeExecute } from './trading_old_execute';
// app.post('/api/trading/execute', handleTradeExecute);

// NEW CODE (add):
import { handleTradingExecuteHardened } from '../../trading/executeHardened';

// In handler registration:
app.post('/api/trading/execute', handleTradingExecuteHardened);

// Also add health/status endpoint for trading system:
import { getExecutionStatus } from '../../trading/executeHardened';

app.get('/api/trading/status', async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  
  try {
    const status = await getExecutionStatus(userId);
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: 'Status check failed' });
  }
});
```

### File: `server/index.ts`

**Register the hardened execute endpoint:**

```typescript
// Add to route registrations:
import { Router } from 'express';
import { handleTradingExecuteHardened } from '../src/trading/executeHardened';

const tradingRouter = Router();

tradingRouter.post('/execute', async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  
  const { proposalId, overrideCooldown, overrideAntiFlip } = req.body;
  
  await handleTradingExecuteHardened(
    userId,
    proposalId,
    overrideCooldown,
    overrideAntiFlip,
    req,
    res
  );
});

app.use('/api/trading', tradingRouter);
```

## Step 4: Update Scanner Integration

### File: `src/trading/scanScheduler.ts`

**Integration points:**

```typescript
import { claimDueScanJobs, releaseJobLock, cleanupExpiredLocks } from './schedulerLocking';
import { checkGptBudget, logGptUsage } from './budgetEnforcement';

// In executeScheduledScans() function:
async function executeScheduledScans() {
  const instanceId = process.env.SCHEDULER_INSTANCE_ID || generateInstanceId();
  
  try {
    // ====== 1. CLAIM DUE JOBS ======
    const dueScanJobs = await claimDueScanJobs(instanceId, 5);
    
    if (dueScanJobs.length === 0) {
      console.log('[Scheduler] No due scan jobs to process');
      return;
    }
    
    console.log(`[Scheduler] Claimed ${dueScanJobs.length} jobs`);
    
    // ====== 2. PROCESS EACH JOB ======
    for (const job of dueScanJobs) {
      try {
        // Check GPT budget BEFORE making call
        const budgetResult = await checkGptBudget(
          job.user_id,
          job.policy.limits.gpt.daily,
          job.policy.limits.gpt.hourly
        );
        
        if (!budgetResult.canCall) {
          console.log(
            `[Scheduler] Skipping job ${job.id}: ${budgetResult.reason}`
          );
          
          // Log failed attempt
          await logGptUsage(
            job.user_id,
            job.id,
            0,
            'scan_proposal',
            false,
            budgetResult.reason
          );
          
          // Release lock and reschedule
          await releaseJobLock(job.id, job.user_id, 30); // Retry in 30 min
          continue;
        }
        
        // ====== 3. SCAN MARKET ======
        const marketData = await performMarketScan(job);
        
        // ====== 4. GENERATE PROPOSAL (uses GPT) ======
        const proposal = await generateProposalViaScan(
          job.user_id,
          marketData,
          job.policy
        );
        
        // ====== 5. LOG GPT USAGE ======
        await logGptUsage(
          job.user_id,
          job.id,
          350, // Estimated tokens for GPT call
          'scan_proposal',
          true,
          null
        );
        
        // ====== 6. RELEASE LOCK & RESCHEDULE ======
        const nextRunMinutes = job.policy.scan_interval_minutes || 60;
        await releaseJobLock(job.id, job.user_id, nextRunMinutes);
        
        console.log(
          `[Scheduler] Completed scan job ${job.id} for ${job.user_id}`
        );
      } catch (err) {
        console.error(`[Scheduler] Job ${job.id} error:`, err);
        
        // Release lock with extended retry
        await releaseJobLock(job.id, job.user_id, 60);
      }
    }
    
    // ====== 7. CLEANUP EXPIRED LOCKS ======
    const cleanedUp = await cleanupExpiredLocks();
    if (cleanedUp > 0) {
      console.log(`[Scheduler] Cleaned up ${cleanedUp} expired locks`);
    }
  } catch (err) {
    console.error('[Scheduler] Fatal error:', err);
  }
}
```

## Step 5: Create Test Suite

### File: `src/tests/hardening.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { supabase } from '../lib/supabase/client';
import { handleTradingExecuteHardened } from '../trading/executeHardened';
import { claimDueScanJobs, releaseJobLock } from '../trading/schedulerLocking';
import { checkGptBudget, logGptUsage, clearTodaysBudget } from '../trading/budgetEnforcement';

describe('Hardening Guarantees', () => {
  const testUserId = 'test-user-hardening';
  const testProposalId = 'test-proposal-1';

  beforeEach(async () => {
    // Clean up any existing test data
    await supabase
      .from('trade_executions')
      .delete()
      .eq('proposal_id', testProposalId);

    await supabase
      .from('gpt_usage_log')
      .delete()
      .eq('user_id', testUserId);

    await supabase
      .from('trade_history')
      .delete()
      .eq('user_id', testUserId);
  });

  describe('1. IDEMPOTENCY GUARANTEE', () => {
    it('Should prevent double-execution of same proposal', async () => {
      // First execution should succeed
      const result1 = await claimExecution(testUserId, testProposalId);
      expect(result1.success).toBe(true);

      // Second execution should fail (already claimed)
      const result2 = await claimExecution(testUserId, testProposalId);
      expect(result2.success).toBe(false);
      expect(result2.code).toBe('ALREADY_EXECUTED');
    });

    it('Should support concurrent execution attempts', async () => {
      // Simulate 5 concurrent attempts
      const promises = Array(5)
        .fill(null)
        .map(() => claimExecution(testUserId, testProposalId));

      const results = await Promise.all(promises);
      
      // Only one should succeed
      const successes = results.filter((r) => r.success);
      expect(successes).toHaveLength(1);
    });
  });

  describe('2. SCHEDULER CONCURRENCY SAFETY', () => {
    it('Should prevent double-processing of same scan job', async () => {
      // Create test scan job
      const jobId = 'test-scan-job-1';

      // First instance claims job
      const claimed1 = await claimDueScanJobs('instance-1', 10);
      expect(claimed1.some((j) => j.id === jobId)).toBe(true);

      // Second instance attempts to claim same job
      const claimed2 = await claimDueScanJobs('instance-2', 10);
      expect(claimed2.some((j) => j.id === jobId)).toBe(false);
    });

    it('Should expire old locks after timeout', async () => {
      // Simulate lock older than 2 minutes
      const jobId = 'test-old-lock';
      const twoMinutesAgo = new Date(Date.now() - 130000);

      // Set expired lock
      await supabase
        .from('scan_jobs')
        .update({
          locked_at: twoMinutesAgo.toISOString(),
          locked_by: 'crashed-instance',
          lock_expires_at: twoMinutesAgo.toISOString()
        })
        .eq('id', jobId);

      // Next cleanup should release it
      const released = await cleanupExpiredLocks();
      expect(released).toBeGreaterThan(0);
    });
  });

  describe('3. ALLOWLIST DENY-BY-DEFAULT', () => {
    it('Should reject proposal when allowlist is empty', async () => {
      // Create proposal with empty allowlist
      const proposal = {
        user_id: testUserId,
        asset: 'BTC',
        side: 'buy',
        allowlist: [], // EMPTY!
        confidence: 75
      };

      const result = await validateAllowlist(proposal);
      expect(result.passed).toBe(false);
      expect(result.reason).toMatch(/ALLOWLIST_EMPTY/);
    });

    it('Should accept proposal only when explicitly allowlisted', async () => {
      // Create proposal with specific allowlist
      const proposal = {
        user_id: testUserId,
        asset: 'BTC',
        side: 'buy',
        allowlist: ['BTC/EUR', 'BTC/USD'],
        confidence: 75
      };

      const result1 = await validateAllowlist({
        ...proposal,
        allowlist: ['BTC/EUR']
      });
      expect(result1.passed).toBe(true);

      const result2 = await validateAllowlist({
        ...proposal,
        allowlist: []
      });
      expect(result2.passed).toBe(false);
    });
  });

  describe('4. COOLDOWN ENFORCEMENT', () => {
    it('Should reject rapid consecutive trades without override', async () => {
      // Log first trade
      await supabase.from('trade_history').insert({
        user_id: testUserId,
        asset: 'BTC',
        side: 'buy',
        amount: 0.1
      });

      // Attempt second trade within cooldown
      const proposal = {
        user_id: testUserId,
        asset: 'BTC',
        side: 'buy',
        cooldown_minutes: 60,
        override_cooldown: false
      };

      const result = await checkCooldown(proposal);
      expect(result.passed).toBe(false);
      expect(result.reason).toMatch(/COOLDOWN/);
    });

    it('Should allow rapid trades when override flag set', async () => {
      const proposal = {
        user_id: testUserId,
        asset: 'BTC',
        side: 'buy',
        cooldown_minutes: 60,
        override_cooldown: true // OVERRIDE!
      };

      const result = await checkCooldown(proposal);
      expect(result.passed).toBe(true);
    });
  });

  describe('5. ANTI-FLIP ENFORCEMENT', () => {
    it('Should reject opposite-side trade within anti-flip window', async () => {
      // Log BUY trade
      await supabase.from('trade_history').insert({
        user_id: testUserId,
        asset: 'BTC',
        side: 'buy',
        amount: 0.1
      });

      // Attempt SELL within anti-flip window
      const proposal = {
        user_id: testUserId,
        asset: 'BTC',
        side: 'sell', // OPPOSITE side!
        anti_flip_minutes: 120,
        override_anti_flip: false
      };

      const result = await checkAntiFlip(proposal);
      expect(result.passed).toBe(false);
      expect(result.reason).toMatch(/ANTI_FLIP/);
    });

    it('Should allow opposite-side trade when override set', async () => {
      const proposal = {
        user_id: testUserId,
        asset: 'BTC',
        side: 'sell',
        anti_flip_minutes: 120,
        override_anti_flip: true
      };

      const result = await checkAntiFlip(proposal);
      expect(result.passed).toBe(true);
    });
  });

  describe('6. GPT BUDGET ENFORCEMENT', () => {
    it('Should allow calls within daily budget', async () => {
      await clearTodaysBudget(testUserId);

      const budget = await checkGptBudget(testUserId, 5, 2);
      expect(budget.canCall).toBe(true);
      expect(budget.dailyUsed).toBe(0);
    });

    it('Should reject calls when daily budget exhausted', async () => {
      await clearTodaysBudget(testUserId);

      // Log 5 calls (at daily limit)
      for (let i = 0; i < 5; i++) {
        await logGptUsage(
          testUserId,
          `snapshot-${i}`,
          100,
          'test',
          true
        );
      }

      // 6th call should fail
      const budget = await checkGptBudget(testUserId, 5, 2);
      expect(budget.canCall).toBe(false);
      expect(budget.reason).toMatch(/DAILY_BUDGET_EXHAUSTED/);
    });

    it('Should reject calls when hourly budget exhausted', async () => {
      await clearTodaysBudget(testUserId);

      // Log 2 calls within last hour (at hourly limit)
      for (let i = 0; i < 2; i++) {
        await logGptUsage(
          testUserId,
          `snapshot-${i}`,
          100,
          'test',
          true
        );
      }

      // 3rd call within hour should fail
      const budget = await checkGptBudget(testUserId, 5, 2);
      expect(budget.canCall).toBe(false);
      expect(budget.reason).toMatch(/HOURLY_BUDGET_EXHAUSTED/);
    });
  });

  describe('7. PROPOSAL CLEANUP & EXPIRY', () => {
    it('Should expire old proposals', async () => {
      // Create proposal that expired 1 hour ago
      const expiredProposal = {
        user_id: testUserId,
        asset: 'BTC',
        side: 'buy',
        status: 'PENDING',
        expires_at: new Date(Date.now() - 3600000).toISOString()
      };

      await supabase
        .from('trade_proposals')
        .insert(expiredProposal);

      // Run cleanup
      const result = await expireOldProposals();

      // Verify status changed to EXPIRED
      const { data } = await supabase
        .from('trade_proposals')
        .select('status')
        .eq('id', expiredProposal.id)
        .single();

      expect(data.status).toBe('EXPIRED');
    });
  });
});

// ============================================================================
// HELPER FUNCTIONS (implement stubs for testing)
// ============================================================================

async function claimExecution(userId: string, proposalId: string) {
  // Implement idempotency claiming logic
  try {
    const { data, error } = await supabase
      .from('trade_executions')
      .insert({
        user_id: userId,
        proposal_id: proposalId,
        idempotency_key: proposalId,
        status: 'CLAIMED'
      })
      .select('id')
      .single();

    if (error?.code === '23505') {
      return { success: false, code: 'ALREADY_EXECUTED' };
    }
    return { success: !!data, code: 'SUCCESS' };
  } catch (err) {
    return { success: false, code: 'ERROR' };
  }
}

// ... additional helper stubs for validators ...
```

## Step 6: Verification Checklist

### Pre-Production Verification

- [ ] **Database Migration**
  - [ ] `trade_executions` table exists with UNIQUE constraint
  - [ ] `gpt_usage_log` table exists with fact-based logging
  - [ ] `trade_history` table exists for cooldown/anti-flip checks
  - [ ] `scan_jobs` has locking columns (locked_at, locked_by, lock_expires_at)
  - [ ] `trade_proposals` has policy snapshot columns
  - [ ] RLS policies enabled on all tables
  - [ ] Indexes created on performance-critical columns

- [ ] **API Keys Separated**
  - [ ] `BITVAVO_READONLY_KEY` configured (data-only permissions)
  - [ ] `BITVAVO_READONLY_SECRET` configured
  - [ ] `BITVAVO_TRADE_KEY` configured (execute permissions)
  - [ ] `BITVAVO_TRADE_SECRET` configured
  - [ ] Keys tested individually (readonly throws on execute, trade throws on getTicker)

- [ ] **Handler Integration**
  - [ ] `handleTradingExecuteHardened` imported in `src/server/handlers/trading.ts`
  - [ ] `/api/trading/execute` routed to hardened handler
  - [ ] Old execute handler removed or disabled
  - [ ] Status endpoint registered at `/api/trading/status`

- [ ] **Scanner Integration**
  - [ ] `claimDueScanJobs` called at start of scan cycle
  - [ ] `releaseJobLock` called at end of scan cycle
  - [ ] `checkGptBudget` called before each GPT decision
  - [ ] `logGptUsage` called after each GPT call
  - [ ] `cleanupExpiredLocks` runs periodically (e.g., every 10 minutes)

- [ ] **Tests Passing**
  - [ ] Idempotency test passes (concurrent executions → single order)
  - [ ] Scheduler concurrency test passes (parallel ticks → single process)
  - [ ] Allowlist test passes (empty list → rejected)
  - [ ] Cooldown test passes (rapid trades rejected)
  - [ ] Anti-flip test passes (opposite side rejected)
  - [ ] Budget test passes (exhausted budget rejected)
  - [ ] Cleanup test passes (expired proposals marked)

- [ ] **Monitoring**
  - [ ] Log statements visible for each hardening layer
  - [ ] Error handling catches all exceptions
  - [ ] Metrics for execution success/failure tracked
  - [ ] Lock contention metrics visible (for scheduler optimization)

### Post-Deployment Monitoring

- [ ] **First 24 Hours**
  - [ ] No execution errors related to idempotency
  - [ ] Scheduler processes all due jobs without conflicts
  - [ ] Allowlist checks working as intended
  - [ ] Budget constraints respected
  - [ ] All trades logged to trade_history

- [ ] **First Week**
  - [ ] Cooldown/anti-flip override usage patterns normal
  - [ ] Policy snapshots stored correctly
  - [ ] No stale locks accumulating (cleanup working)
  - [ ] Bitvavo order placement succeeding consistently
  - [ ] Audit logs complete for all executions

## Step 7: Rollback Plan

If critical issues discovered:

```bash
# 1. Disable hardened execution (fall back to old handler)
# In src/server/handlers/trading.ts:
# app.post('/api/trading/execute', handleTradeExecuteOld);

# 2. Revert database migration (only if critical corruption)
# DROP TABLE trade_executions CASCADE;
# DROP TABLE gpt_usage_log CASCADE;
# ALTER TABLE scan_jobs DROP COLUMN locked_at, locked_by, lock_expires_at;

# 3. Revert API key separation (use single Bitvavo key)
# Remove BITVAVO_READONLY_* and BITVAVO_TRADE_* env vars
# Switch to single BITVAVO_KEY, BITVAVO_SECRET

# 4. Disable scheduler locking (use old counter-based logic)
# In src/trading/scanScheduler.ts:
# Remove claimDueScanJobs, releaseJobLock, cleanupExpiredLocks calls
```

## Documentation References

- **Hardening Guarantees:** See [HARDENING.md](./HARDENING.md)
- **API Key Separation:** See [BITVAVO_KEY_SEPARATION.md](./BITVAVO_KEY_SEPARATION.md)
- **Database Schema:** See [src/sql/trading_phase2_hardening.sql](./src/sql/trading_phase2_hardening.sql)
- **Execution Logic:** See [src/trading/executeHardened.ts](./src/trading/executeHardened.ts)
- **Scheduler Locking:** See [src/trading/schedulerLocking.ts](./src/trading/schedulerLocking.ts)
- **Budget Enforcement:** See [src/trading/budgetEnforcement.ts](./src/trading/budgetEnforcement.ts)
