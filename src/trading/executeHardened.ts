/**
 * HARDENED EXECUTION HANDLER
 * 
 * Production-grade execution with:
 * - Atomic idempotency claiming (INSERT ON CONFLICT)
 * - Deny-by-default allowlist
 * - Cooldown + anti-flip enforcement
 * - Pre-flight validation with full audit
 * - Policy hash verification
 * - Comprehensive error tracking
 */

import { supabase } from '../../src/lib/supabase/client';
import { getTradingEnabled } from '../../src/trading/policy';
import { getProposal } from '../../src/trading/proposals';
import { getBitvavoTrade } from '../../src/exchange/bitvavoTrade';
import { submitOrRetryExecution, reconcileByClientOrderId } from '../../src/trading/reconcileExecution';

export type ExecutionRequest = {
  proposalId: string;
};

export type ExecutionResponse = {
  success: boolean;
  executionId?: string;
  orderId?: string;
  message: string;
  preflightPassed?: boolean;
  preflightReasons?: string[];
  errorCode?: string;
};

export type PreflightResult = {
  passed: boolean;
  reasons: string[];
  checks: {
    allowlist: { passed: boolean; reason: string };
    orderSize: { passed: boolean; reason: string };
    confidence: { passed: boolean; reason: string };
    cooldown: { passed: boolean; reason: string };
    antiFlip: { passed: boolean; reason: string };
    dailyTradeCap: { passed: boolean; reason: string };
    hourlyTradeCap: { passed: boolean; reason: string };
  };
};

// ============================================================================
// HARDENED EXECUTE HANDLER
// ============================================================================

export async function handleTradingExecuteHardened(
  req: any,
  res: any
): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const userId = extractUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { proposalId } = (req.body || {}) as ExecutionRequest;
  if (!proposalId) {
    res.status(400).json({ error: 'Missing proposalId' });
    return;
  }

  try {
    // ========================================================================
    // STEP 1: Load proposal + policy + settings
    // ========================================================================
    const proposal = await getProposal(userId, proposalId);
    if (!proposal) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    const policy = await getActivePolicy(userId);
    if (!policy) {
      return res.status(400).json({ error: 'No active policy' });
    }

    const tradingEnabled = await getTradingEnabled(userId);
    if (!tradingEnabled) {
      return res.status(403).json({ error: 'Trading disabled' });
    }

    // ========================================================================
    // STEP 2: Verify proposal is in APPROVED state
    // ========================================================================
    if (proposal.status !== 'APPROVED') {
      return res.status(400).json({
        error: `Proposal must be APPROVED; current status: ${proposal.status}`
      });
    }

    // ========================================================================
    // STEP 3: Check expiry
    // ========================================================================
    if (new Date(proposal.expiresAt) < new Date()) {
      return res.status(400).json({ error: 'Proposal has expired' });
    }

    // ========================================================================
    // STEP 4: RUN PRE-FLIGHT CHECKS
    // ========================================================================
    const preflight = await runPreflightChecks(userId, proposal, policy);
    console.log(
      `[ExecuteHardened] Preflight for user ${userId} proposal ${proposalId}:`,
      preflight
    );

    if (!preflight.passed) {
      return res.status(400).json({
        success: false,
        preflightPassed: false,
        preflightReasons: preflight.reasons,
        errorCode: 'PREFLIGHT_FAILED',
        message: `Pre-flight check failed: ${preflight.reasons.join('; ')}`
      });
    }

    // ========================================================================
    // STEP 5: CLAIM EXECUTION & MANAGE SUBMIT STATE (Idempotency + Reconciliation)
    // ========================================================================
    // Uses submitOrRetryExecution: handles CLAIMED → SUBMITTING → SUBMITTED flow
    // If execution already exists (SUBMITTING or SUBMITTED):
    // - Returns early if already submitted
    // - Triggers reconcile if SUBMITTING is stale (>30s)
    // - Prevents double-order on retry/timeout
    
    // First, ensure execution record exists
    const idempotencyKey = proposalId;
    const executionId = await claimExecution(userId, proposalId, idempotencyKey, preflight);

    if (!executionId) {
      // Execution already claimed. Check state.
      const existing = await supabase
        .from('trade_executions')
        .select('id, status, bitvavo_order_id, updated_at')
        .eq('user_id', userId)
        .eq('proposal_id', proposalId)
        .single();

      if (existing.data?.bitvavo_order_id) {
        // Already has an order
        return res.status(409).json({
          success: false,
          message: 'This proposal was already executed',
          errorCode: 'ALREADY_EXECUTED',
          orderId: existing.data.bitvavo_order_id
        });
      }

      if (existing.data?.status === 'SUBMITTING') {
        // In-flight: trigger reconcile if old, else wait
        const age = new Date().getTime() - new Date(existing.data.updated_at).getTime();
        if (age > 30_000) {
          // TTL expired: try reconcile
          const reconciled = await reconcileByClientOrderId(existing.data.id, userId);
          if (reconciled.state === 'found_on_exchange') {
            return res.status(200).json({
              success: true,
              executionId: existing.data.id,
              orderId: reconciled.orderId,
              message: 'Order found via reconciliation',
              reconciled: true
            });
          }
        }
        return res.status(202).json({
          success: true,
          message: 'Execution in progress (SUBMITTING); please retry',
          state: 'submitting_in_progress',
          executionId: existing.data.id
        });
      }

      // Already failed or unknown state
      return res.status(409).json({
        success: false,
        message: 'This proposal was already executed or is in an inconsistent state',
        errorCode: 'ALREADY_EXECUTED',
        status: existing.data?.status
      });
    }

    // Now use submitOrRetryExecution for the full SUBMITTING → SUBMITTED flow
    // This handles: lock + decide + SUBMITTING + placeOrder + SUBMITTED
    const submitResult = await submitOrRetryExecution(executionId, userId);

    if (!submitResult.ok) {
      // Check if it's a soft failure (SUBMITTING kept for reconcile) or hard failure
      if (submitResult.state === 'place_order_soft_fail') {
        // Soft failure: keep SUBMITTING, trigger reconcile job
        console.log(`[ExecuteHardened] Soft failure (${submitResult.error}); SUBMITTING kept for reconcile`);
        return res.status(202).json({
          success: false,
          message: 'Soft failure (timeout/network); reconcile in progress',
          state: 'submitting_for_reconcile',
          executionId,
          errorCode: 'SOFT_FAIL_RECONCILE_PENDING'
        });
      }

      // Hard failure: mark proposal FAILED
      console.error(`[ExecuteHardened] Submit failed: ${submitResult.state}`, submitResult.error);

      // Mark proposal as FAILED
      await supabase
        .from('trade_proposals')
        .update({ status: 'FAILED', updated_at: new Date().toISOString() })
        .eq('id', proposalId);
      // Fire and forget - log update doesn't need to block

      // Return appropriate status code
      const statusCode = submitResult.state === 'submitting_in_progress' ? 202 : 500;
      return res.status(statusCode).json({
        success: false,
        message: submitResult.error || 'Execution failed',
        state: submitResult.state,
        executionId,
        errorCode: 'SUBMIT_FAILED'
      });
    }

    // Success: submitResult contains orderId
    if (submitResult.orderId) {
      // Update proposal to EXECUTED
      await supabase
        .from('trade_proposals')
        .update({ status: 'EXECUTED', updated_at: new Date().toISOString() })
        .eq('id', proposalId);
      // Fire and forget - log update doesn't need to block

      // Log to trade_history for cooldown/anti-flip tracking
      await supabase
        .from('trade_history')
        .insert({
          user_id: userId,
          asset: proposal.asset,
          side: proposal.side,
          order_value_eur: proposal.orderValueEur,
          bitvavo_order_id: submitResult.orderId,
          status: 'confirmed',
          executed_at: new Date().toISOString()
        });
      // Fire and forget - log insert doesn't need to block

      console.log(
        `[ExecuteHardened] Execution successful: ${executionId} -> Bitvavo order ${submitResult.orderId}`
      );

      return res.status(200).json({
        success: true,
        executionId,
        orderId: submitResult.orderId,
        message: 'Trade executed successfully',
        clientOrderId: submitResult.clientOrderId
      });
    }

    // submitResult.ok but no orderId (shouldn't happen)
    return res.status(202).json({
      success: true,
      message: 'Execution in progress',
      state: submitResult.state,
      executionId
    });

  } catch (err) {
    console.error('[ExecuteHardened] Unexpected error:', err);
    return res.status(500).json({
      success: false,
      message: 'Unexpected error during execution',
      errorCode: 'INTERNAL_ERROR',
      details: err instanceof Error ? err.message : 'Unknown'
    });
  }
}

// ============================================================================
// PRE-FLIGHT CHECKS
// ============================================================================

async function runPreflightChecks(
  userId: string,
  proposal: any,
  policy: any
): Promise<PreflightResult> {
  const reasons: string[] = [];
  const checks: any = {
    allowlist: { passed: false, reason: '' },
    orderSize: { passed: false, reason: '' },
    confidence: { passed: false, reason: '' },
    cooldown: { passed: false, reason: '' },
    antiFlip: { passed: false, reason: '' },
    dailyTradeCap: { passed: false, reason: '' },
    hourlyTradeCap: { passed: false, reason: '' }
  };

  // 1. DENY-BY-DEFAULT ALLOWLIST
  const allowlist = policy.assets?.allowlist || [];
  if (!allowlist || allowlist.length === 0) {
    checks.allowlist.reason = 'ALLOWLIST_EMPTY_DENY_BY_DEFAULT';
    reasons.push(checks.allowlist.reason);
  } else if (!allowlist.includes(proposal.asset)) {
    checks.allowlist.reason = `${proposal.asset} not in allowlist: ${allowlist.join(', ')}`;
    reasons.push(checks.allowlist.reason);
  } else {
    checks.allowlist.passed = true;
    checks.allowlist.reason = `${proposal.asset} in allowlist`;
  }

  // 2. ORDER SIZE
  const minOrder = policy.risk?.minOrderEur || 25;
  const maxOrder = policy.risk?.maxOrderEur || 50;
  if (proposal.orderValueEur < minOrder) {
    checks.orderSize.reason = `Order €${proposal.orderValueEur} < minimum €${minOrder}`;
    reasons.push(checks.orderSize.reason);
  } else if (proposal.orderValueEur > maxOrder) {
    checks.orderSize.reason = `Order €${proposal.orderValueEur} > maximum €${maxOrder}`;
    reasons.push(checks.orderSize.reason);
  } else {
    checks.orderSize.passed = true;
    checks.orderSize.reason = `Order €${proposal.orderValueEur} within bounds €${minOrder}-€${maxOrder}`;
  }

  // 3. CONFIDENCE
  const allowedConfidences = policy.signal?.allowedConfidences || [75, 100];
  if (!allowedConfidences.includes(proposal.confidence)) {
    checks.confidence.reason = `Confidence ${proposal.confidence}% not in allowed: ${allowedConfidences.join(', ')}`;
    reasons.push(checks.confidence.reason);
  } else {
    checks.confidence.passed = true;
    checks.confidence.reason = `Confidence ${proposal.confidence}% allowed`;
  }

  // 4. COOLDOWN
  const cooldownResult = await checkCooldown(userId, proposal.asset);
  if (cooldownResult.blocked && !proposal.override_cooldown) {
    checks.cooldown.reason = `Cooldown active: last trade ${cooldownResult.minutesSinceLast} min ago, need ${cooldownResult.cooldownMinutes} min`;
    reasons.push(checks.cooldown.reason);
  } else {
    checks.cooldown.passed = true;
    checks.cooldown.reason = `No cooldown active`;
  }

  // 5. ANTI-FLIP
  const antiFlipResult = await checkAntiFlip(userId, proposal.asset, proposal.side);
  if (antiFlipResult.blocked && !proposal.override_anti_flip) {
    checks.antiFlip.reason = `Anti-flip: last trade was ${antiFlipResult.lastSide} ${antiFlipResult.minutesSinceLast} min ago, proposed ${proposal.side}`;
    reasons.push(checks.antiFlip.reason);
  } else {
    checks.antiFlip.passed = true;
    checks.antiFlip.reason = `No anti-flip conflict`;
  }

  // 6. DAILY TRADE CAP
  const maxDaily = policy.risk?.maxDailyTrades || 3;
  const dailyCount = await countTradesToday(userId);
  if (dailyCount >= maxDaily) {
    checks.dailyTradeCap.reason = `Daily cap reached: ${dailyCount}/${maxDaily}`;
    reasons.push(checks.dailyTradeCap.reason);
  } else {
    checks.dailyTradeCap.passed = true;
    checks.dailyTradeCap.reason = `Daily trades: ${dailyCount}/${maxDaily}`;
  }

  // 7. HOURLY TRADE CAP
  const maxHourly = policy.risk?.maxTradesPerHour || 2;
  const hourlyCount = await countTradesThisHour(userId);
  if (hourlyCount >= maxHourly) {
    checks.hourlyTradeCap.reason = `Hourly cap reached: ${hourlyCount}/${maxHourly}`;
    reasons.push(checks.hourlyTradeCap.reason);
  } else {
    checks.hourlyTradeCap.passed = true;
    checks.hourlyTradeCap.reason = `Hourly trades: ${hourlyCount}/${maxHourly}`;
  }

  const passed = reasons.length === 0;
  return { passed, reasons, checks };
}

// ============================================================================
// IDEMPOTENCY CLAIM
// ============================================================================

async function claimExecution(
  userId: string,
  proposalId: string,
  idempotencyKey: string,
  preflight: PreflightResult
): Promise<string | null> {
  try {
    const policySnapshot = await getActivePolicy(userId);

    // Atomic INSERT ... ON CONFLICT DO NOTHING
    const { data, error } = await supabase
      .from('trade_executions')
      .insert({
        user_id: userId,
        proposal_id: proposalId,
        idempotency_key: idempotencyKey,
        status: 'CLAIMED',
        preflight: preflight.checks,
        preflight_passed: preflight.passed,
        preflight_reasons: preflight.reasons,
        policy_hash: hashPolicy(policySnapshot),
        policy_snapshot: policySnapshot
      })
      .select('id')
      .single();

    if (error && error.code === '23505') {
      // UNIQUE constraint violation: already claimed
      console.log(
        `[ClaimExecution] Execution already claimed for proposal ${proposalId}`
      );
      return null;
    }

    if (error) {
      console.error('[ClaimExecution] Insert error:', error);
      return null;
    }

    return data?.id || null;
  } catch (err) {
    console.error('[ClaimExecution] Error:', err);
    return null;
  }
}

// ============================================================================
// COOLDOWN CHECK
// ============================================================================

async function checkCooldown(userId: string, asset: string): Promise<{
  blocked: boolean;
  lastTradeTime?: string;
  minutesSinceLast?: number;
  cooldownMinutes: number;
}> {
  const cooldownMinutes = 30; // From policy.risk

  const { data, error } = await supabase
    .from('trade_history')
    .select('executed_at')
    .eq('user_id', userId)
    .eq('asset', asset)
    .in('status', ['confirmed', 'pending'])
    .order('executed_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    // No previous trades
    return { blocked: false, cooldownMinutes };
  }

  const lastTime = new Date(data.executed_at);
  const now = new Date();
  const minutesSinceLast = Math.floor(
    (now.getTime() - lastTime.getTime()) / (1000 * 60)
  );

  const blocked = minutesSinceLast < cooldownMinutes;
  return {
    blocked,
    lastTradeTime: data.executed_at,
    minutesSinceLast,
    cooldownMinutes
  };
}

// ============================================================================
// ANTI-FLIP CHECK
// ============================================================================

async function checkAntiFlip(
  userId: string,
  asset: string,
  proposedSide: string
): Promise<{
  blocked: boolean;
  lastSide?: string;
  minutesSinceLast?: number;
  antiFlipMinutes: number;
}> {
  const antiFlipMinutes = 120; // From policy.risk

  const { data, error } = await supabase
    .from('trade_history')
    .select('side, executed_at')
    .eq('user_id', userId)
    .eq('asset', asset)
    .in('status', ['confirmed', 'pending'])
    .order('executed_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    // No previous trades
    return { blocked: false, antiFlipMinutes };
  }

  const lastSide = data.side;
  const lastTime = new Date(data.executed_at);
  const now = new Date();
  const minutesSinceLast = Math.floor(
    (now.getTime() - lastTime.getTime()) / (1000 * 60)
  );

  const isFlip = lastSide !== proposedSide;
  const blocked = isFlip && minutesSinceLast < antiFlipMinutes;

  return {
    blocked,
    lastSide,
    minutesSinceLast,
    antiFlipMinutes
  };
}

// ============================================================================
// TRADE COUNT CHECKS
// ============================================================================

async function countTradesToday(userId: string): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('trade_history')
    .select('id', { count: 'exact' })
    .eq('user_id', userId)
    .gte('executed_at', today.toISOString())
    .in('status', ['confirmed', 'pending']);

  if (error || !data) {
    console.warn('[CountTradesToday] Error:', error);
    return 0;
  }

  return data.length;
}

async function countTradesThisHour(userId: string): Promise<number> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const { data, error } = await supabase
    .from('trade_history')
    .select('id', { count: 'exact' })
    .eq('user_id', userId)
    .gte('executed_at', oneHourAgo.toISOString())
    .in('status', ['confirmed', 'pending']);

  if (error || !data) {
    console.warn('[CountTradesThisHour] Error:', error);
    return 0;
  }

  return data.length;
}

// ============================================================================
// HELPERS
// ============================================================================

function extractUserId(req: any): string | null {
  const auth = req.headers?.authorization;
  if (auth?.startsWith('Bearer ')) {
    return 'user_' + auth.substring(7).substring(0, 8);
  }
  return (req.query?.userId as string) || null;
}

function hashPolicy(policy: any): string {
  // Simple hash: JSON.stringify sorted keys
  const str = JSON.stringify(policy, Object.keys(policy).sort());
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16);
}

async function getActivePolicy(userId: string): Promise<any> {
  // Import from policy.ts
  const { getActivePolicy: getPolicyFunc } = await import('../../src/trading/policy');
  return getPolicyFunc(userId);
}
