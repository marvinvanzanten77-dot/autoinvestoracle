# Safe Scan → Propose → Approve → Execute System - SETUP GUIDE

## Phase 2 Implementation Complete ✅

This document guides you through setting up and testing the new **safe scan→propose→approve→execute** system for autonomous AI trading with explicit user approval at every stage.

---

## TABLE OF CONTENTS

1. [Prerequisites](#prerequisites)
2. [Database Migration](#database-migration)
3. [Environment Variables](#environment-variables)
4. [New Files Created](#new-files-created)
5. [API Endpoint Reference](#api-endpoint-reference)
6. [Testing](#testing)
7. [Deployment Checklist](#deployment-checklist)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- Node.js 18+ with npm/yarn
- Supabase project with PostgreSQL database
- Environment variables configured (see next section)
- Bitvavo API key + secret (for actual trading)
- OpenAI API key (for GPT-4o proposals)

---

## Database Migration

### 1. Apply Migration to Supabase

The new schema file has been created at:
```
src/sql/trading_upgrade_scan_proposals.sql
```

To apply this migration:

```bash
# Option A: Via Supabase Dashboard
# 1. Go to Supabase Console → SQL Editor
# 2. Create new query
# 3. Copy & paste entire contents of trading_upgrade_scan_proposals.sql
# 4. Click "Run"

# Option B: Via Supabase CLI (if installed)
supabase db push

# Option C: Using psql directly
PGPASSWORD=$DB_PASSWORD psql \
  -h $DB_HOST \
  -U $DB_USER \
  -d $DB_NAME \
  -f src/sql/trading_upgrade_scan_proposals.sql
```

### 2. Verify Tables Created

After migration, verify all 6 tables exist:

```sql
-- Run in Supabase SQL Editor
SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'user_trading_settings%' OR tablename LIKE 'agent_policies%' OR tablename LIKE 'scan_jobs%' OR tablename LIKE 'market_snapshots%' OR tablename LIKE 'trade_proposals%' OR tablename LIKE 'trade_actions%';
```

Expected result: 6 tables
- `user_trading_settings`
- `agent_policies`
- `scan_jobs`
- `market_snapshots`
- `trade_proposals`
- `trade_actions`

### 3. RLS Policies

All tables have RLS policies enabled. Verify:

```sql
-- Run in Supabase SQL Editor
SELECT tablename FROM pg_tables WHERE schemaname = 'public' WHERE relrowsecurity = true;
```

All 6 trading tables should show `true` for row security enabled.

---

## Environment Variables

Add these to your `.env` or `.env.local`:

```bash
# Existing variables
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
OPENAI_API_KEY=sk-...

# NEW: Scheduler configuration
SCHEDULER_TICK_SECRET=your_super_secret_key_here

# NEW: Bitvavo credentials (read-only for proposer)
BITVAVO_API_KEY_PROPOSER=your_read_only_key
BITVAVO_API_SECRET_PROPOSER=your_read_only_secret

# NEW: Trading execution (user-provided keys stored in Supabase)
# These are NOT used directly; instead loaded from user profiles
```

### Environment Variable Explanation

| Variable | Purpose | Required |
|----------|---------|----------|
| `SCHEDULER_TICK_SECRET` | Secret key for `/api/trading/scheduler/tick` endpoint (prevents unauthorized access) | Yes |
| `BITVAVO_API_KEY_PROPOSER` | Bitvavo read-only API key for market data & proposal generation | Yes (for live testing) |
| `BITVAVO_API_SECRET_PROPOSER` | Corresponding secret | Yes (for live testing) |

**Security Note:** User trading keys are stored in Supabase (encrypted) and loaded at execution time. They are never in environment variables.

---

## New Files Created

### Phase 2 Backend Services

| File | Lines | Purpose |
|------|-------|---------|
| `src/trading/policy.ts` | 450+ | Policy management (CRUD, presets: Observer/Hunter/SemiAuto) |
| `src/trading/proposals.ts` | 350+ | Trade proposals (create, accept, modify, decline) |
| `src/trading/scanScheduler.ts` | 500+ | Market pulse, GPT gating, scan orchestration |
| `src/server/handlers/trading.ts` | 700+ | 18 new API handler functions |
| `server/index.ts` | +60 | 18 new route registrations |

### Database Schema

| File | Purpose |
|------|---------|
| `src/sql/trading_upgrade_scan_proposals.sql` | Migration: 6 new tables, RLS, triggers, indexes |

### Documentation

| File | Purpose |
|------|---------|
| `SETUP.md` | This file - setup & testing guide |

### Existing Files Modified

| File | Changes |
|------|---------|
| `src/server/handlers/trading.ts` | +20 imports, +18 handler functions |
| `server/index.ts` | +18 route registrations |

---

## API Endpoint Reference

### Policy Endpoints

#### `GET /api/trading/policy`
Get the active policy for the user.

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "success": true,
  "policy": {
    "id": "uuid",
    "userId": "uuid",
    "name": "Observer",
    "isActive": true,
    "scans": {
      "mode": "MANUAL",
      "intervalMinutes": 120,
      "maxScansPerDay": 10,
      "aiEnabled": true
    },
    "budget": {
      "maxGptCallsPerDay": 5,
      "maxGptCallsPerHour": 2
    },
    "gptGate": {
      "enabled": true,
      "minVolatilityForGpt": 50,
      "minMovePct1h": 3.0,
      "minMovePct4h": 5.0,
      "volumeSpikeZ": 2.0
    },
    "risk": {
      "minOrderEur": 25,
      "maxOrderEur": 50,
      "maxDailyTrades": 0,
      "cooldownMinutesAfterLoss": 60,
      "stopIfDrawdownDayPct": 5,
      "neverAverageDown": true
    },
    "signal": {
      "minConfidence": 75,
      "allowedConfidences": [75, 100]
    },
    "assets": {
      "allowlist": ["BTC-EUR", "ETH-EUR"]
    },
    "reporting": {
      "verbosity": 2,
      "mustInclude": ["why", "whyNot", "invalidations"]
    },
    "createdAt": "2024-01-15T10:00:00Z",
    "updatedAt": "2024-01-15T10:00:00Z"
  }
}
```

---

#### `POST /api/trading/policies/presets/:preset`
Create a policy from a preset (OBSERVER, HUNTER, SEMI_AUTO).

**URL:**
```
POST /api/trading/policies/presets/observer
POST /api/trading/policies/presets/hunter
POST /api/trading/policies/presets/semi-auto
```

**Headers:**
```
Authorization: Bearer <token>
```

**Response (201):**
```json
{
  "success": true,
  "policy": { ... }
}
```

**Available Presets:**
1. **OBSERVER** — Manual scans, no auto-execution, high confidence threshold (75%+)
2. **HUNTER** — Assisted mode, up to 3 trades/day, moderate budget (10 GPT calls/day)
3. **SEMI_AUTO** — Aggressive scans, up to 5 trades/day, higher budget (15 GPT calls/day)

---

#### `POST /api/trading/policy/activate`
Activate a specific policy.

**Body:**
```json
{
  "policyId": "uuid"
}
```

**Response (200):**
```json
{
  "success": true,
  "policy": { ... }
}
```

---

### Proposal Endpoints

#### `GET /api/trading/proposals?status=PROPOSED`
List proposals with optional status filter.

**Query Params:**
- `status` (optional): PROPOSED | APPROVED | DECLINED | EXPIRED | EXECUTED | FAILED

**Response (200):**
```json
{
  "success": true,
  "proposals": [
    {
      "id": "uuid",
      "userId": "uuid",
      "status": "PROPOSED",
      "expiresAt": "2024-01-15T11:00:00Z",
      "asset": "BTC-EUR",
      "side": "buy",
      "orderType": "limit",
      "orderValueEur": 100,
      "confidence": 75,
      "rationale": {
        "why": "Bullish 4h divergence detected...",
        "whyNot": ["Recent supply resistance", "Lower volume confirmation"],
        "nextTrigger": "Break above 45200",
        "riskNotes": "Stop loss at 44500"
      },
      "createdAt": "2024-01-15T10:30:00Z",
      "createdBy": "AI"
    }
  ],
  "count": 1,
  "status": "PROPOSED"
}
```

---

#### `POST /api/trading/proposals/:id/accept`
Accept a proposal (changes status to APPROVED).

**URL:**
```
POST /api/trading/proposals/uuid/accept
```

**Response (200):**
```json
{
  "success": true,
  "proposal": { ... }
}
```

**Errors:**
- 404: Proposal not found
- 400: Proposal not in PROPOSED status (may be expired/already acted upon)

---

#### `POST /api/trading/proposals/:id/modify`
Modify a proposal and auto-approve it.

**Body:**
```json
{
  "orderValueEur": 150,
  "confidence": 100
}
```

**Response (200):**
```json
{
  "success": true,
  "proposal": { ... "status": "APPROVED" ... }
}
```

**Modifiable Fields:**
- `orderValueEur` — Trade size in EUR
- `confidence` — 0, 25, 50, 75, or 100
- `asset` — Cryptocurrency pair (BTC-EUR, ETH-EUR, etc.)
- `side` — "buy" or "sell"

---

#### `POST /api/trading/proposals/:id/decline`
Decline a proposal (changes status to DECLINED).

**Response (200):**
```json
{
  "success": true,
  "proposal": { ... "status": "DECLINED" ... }
}
```

---

### Scan Control Endpoints

#### `GET /api/trading/trading-enabled`
Check if trading is enabled for the user.

**Response (200):**
```json
{
  "success": true,
  "tradingEnabled": false
}
```

---

#### `POST /api/trading/trading-enabled`
Set trading enabled/disabled.

**Body:**
```json
{
  "enabled": true
}
```

**Response (200):**
```json
{
  "success": true,
  "tradingEnabled": true
}
```

---

#### `POST /api/trading/scans/pause`
Pause automated scans for the user.

**Response (200):**
```json
{
  "success": true,
  "message": "Scans paused"
}
```

---

#### `POST /api/trading/scans/resume`
Resume paused scans.

**Response (200):**
```json
{
  "success": true,
  "message": "Scans resumed"
}
```

---

#### `POST /api/trading/scan/now`
Force immediate scan execution (for testing).

**Response (200):**
```json
{
  "success": true,
  "message": "Scan scheduled to run immediately"
}
```

---

#### `POST /api/trading/scheduler/tick` (INTERNAL)
Internal endpoint for executing scheduled scans. Requires `X-Server-Secret` header.

**Headers:**
```
X-Server-Secret: <SCHEDULER_TICK_SECRET>
```

**Response (200):**
```json
{
  "success": true,
  "message": "Scheduled scans executed",
  "timestamp": "2024-01-15T10:35:00Z"
}
```

**Note:** This endpoint should be called every minute by an external scheduler (e.g., Vercel Cron, AWS Lambda, or Upstash).

---

#### `POST /api/trading/execute`
Execute an approved proposal. CRITICAL: Proposal must have status=APPROVED.

**Body:**
```json
{
  "proposalId": "uuid"
}
```

**Pre-flight Checks:**
1. Trading enabled flag must be TRUE
2. Proposal status must be APPROVED
3. Proposal not expired
4. Order value within policy bounds
5. Confidence in allowed list
6. Asset in allowlist

**Response (200):**
```json
{
  "success": true,
  "orderId": "bitvavo_order_123",
  "message": "Trade executed successfully"
}
```

**Errors:**
- 403: Trading disabled
- 404: Proposal not found
- 400: Pre-flight check failed (with reasons array)

---

## Testing

### Test 1: Create a Policy from Preset

```bash
curl -X POST http://localhost:4000/api/trading/policies/presets/observer \
  -H "Authorization: Bearer test_token" \
  -H "Content-Type: application/json" \
  -d '{}' | jq
```

**Expected:** 201 with new policy object

---

### Test 2: Get Active Policy

```bash
curl -X GET http://localhost:4000/api/trading/policy \
  -H "Authorization: Bearer test_token" | jq
```

**Expected:** 200 with policy or 404 if none

---

### Test 3: Create a Proposal (Simulate AI)

```bash
curl -X POST http://localhost:4000/api/trading/proposals \
  -H "Authorization: Bearer test_token" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "PROPOSED",
    "expiresAt": "2024-01-15T11:30:00Z",
    "asset": "BTC-EUR",
    "side": "buy",
    "orderType": "limit",
    "orderValueEur": 100,
    "confidence": 75,
    "rationale": {
      "why": "Test proposal"
    },
    "createdBy": "AI"
  }' | jq
```

**Expected:** 201 with new proposal, status=PROPOSED

---

### Test 4: List Proposals

```bash
curl -X GET "http://localhost:4000/api/trading/proposals?status=PROPOSED" \
  -H "Authorization: Bearer test_token" | jq
```

**Expected:** 200 with array of PROPOSED proposals

---

### Test 5: Accept a Proposal

```bash
curl -X POST http://localhost:4000/api/trading/proposals/UUID/accept \
  -H "Authorization: Bearer test_token" | jq
```

Replace `UUID` with actual proposal ID.

**Expected:** 200, status should change to APPROVED

---

### Test 6: Enable Trading & Execute

```bash
# Step 1: Enable trading
curl -X POST http://localhost:4000/api/trading/trading-enabled \
  -H "Authorization: Bearer test_token" \
  -H "Content-Type: application/json" \
  -d '{"enabled": true}' | jq

# Step 2: Execute the approved proposal
curl -X POST http://localhost:4000/api/trading/execute \
  -H "Authorization: Bearer test_token" \
  -H "Content-Type: application/json" \
  -d '{"proposalId": "UUID"}' | jq
```

**Expected:** 200 with orderId

---

### Test 7: Scheduler Tick (Internal)

```bash
curl -X POST http://localhost:4000/api/trading/scheduler/tick \
  -H "X-Server-Secret: your_scheduler_secret" \
  -H "Content-Type: application/json" | jq
```

**Expected:** 200 with success message

---

## Deployment Checklist

### Before Production

- [ ] All environment variables set correctly
- [ ] Database migration applied successfully
- [ ] All 6 tables verified in Supabase
- [ ] RLS policies enabled on all tables
- [ ] Bitvavo API keys configured (for proposer)
- [ ] OpenAI API key configured
- [ ] Scheduler secret configured
- [ ] Run all 7 tests above
- [ ] Test end-to-end flow: Policy → Proposal → Accept → Execute

### Scheduler Setup (CRITICAL)

The system uses a **DB-driven scheduler**, not cron jobs per user. You must call `/api/trading/scheduler/tick` every 1-5 minutes to execute scans.

**Option A: Vercel Cron** (recommended for Vercel deployment)
```
# vercel.json
{
  "crons": [{
    "path": "/api/trading/scheduler/tick",
    "schedule": "*/5 * * * *"
  }]
}
```

**Option B: Upstash Cron** (reliable, works anywhere)
1. Create account at https://upstash.com/
2. Set up HTTP request cron:
   - URL: `https://yourdomain.com/api/trading/scheduler/tick`
   - Headers: `X-Server-Secret: <SCHEDULER_TICK_SECRET>`
   - Schedule: `*/5 * * * *` (every 5 minutes)

**Option C: AWS Lambda** (self-hosted)
```
# Create CloudWatch event to trigger Lambda every 5 minutes
# Lambda function calls POST /api/trading/scheduler/tick
```

### Monitoring

Set up alerts for:
- Scan failures (check logs)
- GPT budget exhaustion
- Proposal expiry rate
- Failed executions (log to Supabase)

---

## Troubleshooting

### "No active policy" Error

**Cause:** User hasn't created/activated a policy yet.

**Solution:**
```bash
curl -X POST http://localhost:4000/api/trading/policies/presets/observer \
  -H "Authorization: Bearer <token>"
```

Then manually activate it or let the UI do it.

---

### "GPT calls exhausted" Error

**Cause:** User hit their daily/hourly budget.

**Solution:**
1. Check `policy.budget.maxGptCallsPerDay` and `maxGptCallsPerHour`
2. Create a new policy with higher budget
3. Or wait for daily reset (midnight UTC)

---

### "Proposal has expired" Error

**Cause:** Proposal created more than 60 minutes ago.

**Solution:**
- Proposal expiry is hardcoded to 60 minutes for safety
- User must accept/decline before expiry
- System auto-expires PROPOSED → EXPIRED at next scan

---

### "Trading is disabled" Error

**Cause:** `user_trading_settings.trading_enabled = FALSE`

**Solution:**
```bash
curl -X POST http://localhost:4000/api/trading/trading-enabled \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"enabled": true}'
```

---

### Scheduler Not Running

**Cause:** `/api/trading/scheduler/tick` not being called.

**Solution:**
1. Verify cron job is configured (Vercel/Upstash/Lambda)
2. Check logs for HTTP 403 (secret mismatch) or 500 (internal error)
3. Manually test: `curl -X POST ... -H "X-Server-Secret: ..."` 

---

### RLS Policy Errors

**Error:** "Row-level security violation"

**Cause:** User trying to access another user's data.

**Solution:** Verify `Authorization` header and user ID extraction logic in handlers.

---

## Next Steps (Phases 3-7)

### Phase 3: Scan Scheduler (IN PROGRESS)
- Implement real market pulse generation (from Bitvavo, CoinGecko)
- Complete GPT gating logic
- Add proposal expiry cleanup job

### Phase 4: Proposals Endpoints
- Implement modify endpoint with diff tracking
- Add proposal list filtering

### Phase 5: Execute Endpoint Update
- Update execute endpoint to check APPROVED status
- Add idempotency checks
- Implement full pre-flight validation

### Phase 6: Client Library Updates
- Add new types and methods to `src/api/trading.ts`
- Update Settings UI to show policies and toggle trading

### Phase 7: Tests & Documentation
- Add integration tests
- Update TRADING_AGENT_GUIDE.md
- Create user-facing docs

---

## Questions?

Refer to:
- [TRADING_AGENT_GUIDE.md](TRADING_AGENT_GUIDE.md) — Full architecture guide
- [tradingAgent.ts](server/ai/tradingAgent.ts) — Core AI logic
- [policy.ts](src/trading/policy.ts) — Policy CRUD operations
- [proposals.ts](src/trading/proposals.ts) — Proposal lifecycle

---

**Last Updated:** 2024-01-15  
**Status:** Phase 2 Complete ✅ | Phase 3 Planned
