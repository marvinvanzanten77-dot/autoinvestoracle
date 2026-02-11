# 🚀 IMPLEMENTATION ROADMAP - Features First Approach
**Date:** February 11, 2026  
**Strategy:** IMPLEMENT features, not remove  
**Status:** READY FOR EXECUTION

---

## 📋 CRITICAL PATH: 4 CORE FEATURES FIRST

### PHASE 1: CRITICAL BLOCKING ISSUES (Must fix before anything works properly)

#### 1️⃣ EMAIL PERSISTENCE IN SUPABASE
**Current State:**
- User email captured at onboarding ✅
- Email captured in `Onboarding.tsx` state ✅
- Email LOST when profile saved (not persisted to Supabase) ❌

**What Needs to Happen:**
1. Create `user_profiles` table in Supabase with email field
2. Modify `/api/profile/upsert` to save email to Supabase
3. Modify email service to FETCH user email from Supabase
4. Verify email persists across sessions

**Files to Modify:**
- [api/index.ts](api/index.ts#L200-L240) - upsertProfile handler
- [src/lib/notifications/emailService.ts](src/lib/notifications/emailService.ts#L1-50) - add Supabase fetch

**Impact:** Without this, execution emails will have no recipient address.

---

#### 2️⃣ NOTIFICATION PREFERENCES API & PERSISTENCE
**Current State:**
- Settings.tsx has UI for notification preferences ✅
- No backend to save preferences ❌
- No backend to fetch preferences ❌

**What Needs to Happen:**
1. Add `notification_preferences` table to Supabase
2. Create POST `/api/user/notification-preferences` endpoint
3. Create GET `/api/user/notification-preferences` endpoint
4. Update Settings.tsx to load/save preferences via API

**Files to Modify:**
- [api/index.ts](api/index.ts) - add 2 new endpoints
- [src/pages/Settings.tsx](src/pages/Settings.tsx) - add API calls
- Add migration SQL file for schema

**Impact:** Users can't opt-in/out of notifications without this.

---

#### 3️⃣ EMAIL PROVIDER INTEGRATION
**Current State:**
- Email service has Resend + SendGrid stubs ✅
- Both marked as "STUB" ❌
- Falls back to console logging ❌

**What Needs to Happen:**
1. Pick email provider: Resend OR SendGrid
2. Implement full integration (not stub)
3. Add proper error handling
4. Document env var setup

**Files to Modify:**
- [src/lib/notifications/emailService.ts](src/lib/notifications/emailService.ts#L150-220)

**Recommendation:** Use Resend (simpler, better for this use case)

**Impact:** Without this, execution notifications won't send emails.

---

#### 4️⃣ TICKET AUTO-REFRESH WITH POLLING
**Current State:**
- Tickets load once on component mount ✅
- No refresh after execution ❌
- User sees stale data ❌

**What Needs to Happen:**
1. Add polling interval (5-10 seconds)
2. Implement useEffect with interval
3. Clean up interval on unmount
4. Show loading state during refresh

**Files to Modify:**
- [src/components/TicketsWidget.tsx](src/components/TicketsWidget.tsx)

**Impact:** Without this, user can't see executions in real-time.

---

### PHASE 2: CORE FEATURE COMPLETION

#### 5️⃣ REAL AGENT CONFIDENCE SCORES
**Current State:**
- All trades logged with confidence: 50 (hardcoded) ❌
- Should use actual proposal confidence ❌

**What Needs to Happen:**
1. Pass proposal confidence to execution logger
2. Use real confidence instead of hardcoded 50
3. Display in tickets with color-coded indicators

**Files to Modify:**
- [src/trading/scanScheduler.ts](src/trading/scanScheduler.ts#L280)
- [api/index.ts](api/index.ts#L2600-2650) - trading handlers

**Impact:** Better transparency on trade quality.

---

#### 6️⃣ FETCH REAL BITVAVO ORDERS & POSITIONS
**Current State:**
- Agent state has hardcoded empty arrays: `openOrders: []`, `openPositions: []` ❌
- Should fetch from Bitvavo API ❌

**What Needs to Happen:**
1. Use Bitvavo connector to fetch openOrders
2. Use Bitvavo connector to fetch openPositions
3. Pass real data to agent context
4. Handle errors gracefully

**Files to Modify:**
- [src/trading/scanScheduler.ts](src/trading/scanScheduler.ts#L280-290)
- [src/lib/exchanges/connectors/bitvavo.ts](src/lib/exchanges/connectors/bitvavo.ts)

**Impact:** Agent has complete context for decision-making.

---

#### 7️⃣ OUTCOME RECORDING WITH CRON TRIGGER
**Current State:**
- `recordOutcome()` function exists ✅
- No cron job calls it ❌
- Outcome data not recorded ❌

**What Needs to Happen:**
1. Implement outcome recording logic
2. Add cron job to run daily/weekly
3. Save outcomes to Supabase
4. Track execution performance over time

**Files to Modify:**
- [src/server/cron.ts](src/server/cron.ts#L150-225) - implement actual job
- [src/lib/observation/logger.ts](src/lib/observation/logger.ts) - complete recordOutcome

**Impact:** Builds execution history for learning.

---

#### 8️⃣ SUPABASE OBSERVATION/ACTIVITY LOGGING
**Current State:**
- Logger is in-memory only ❌
- Data lost on restart ❌
- Marked as "stub" ❌

**What Needs to Happen:**
1. Create `agent_activities` table in Supabase
2. Replace in-memory Map with Supabase queries
3. Fetch real activity history
4. Display in dashboard/performance section

**Files to Modify:**
- [src/lib/observation/logger.ts](src/lib/observation/logger.ts)
- Add migration SQL file

**Impact:** Persistent execution history.

---

### PHASE 3: STUBS & PLACEHOLDERS (With Clear TODO Documentation)

#### 9️⃣ KRAKEN/COINBASE/BYBIT CONNECTOR STUBS
**Current State:**
- All are 100% TODO stubs ❌
- No implementation ❌
- Connector UI tries to use them ❌

**Implementation Strategy: KEEP AS COMING SOON**
1. Add "Coming Soon" message in exchange list
2. Disable UI buttons for these connectors
3. Add TODO comment with implementation notes
4. Link to issue/PR for completion

**Files to Modify:**
- [src/pages/Exchanges.tsx](src/pages/Exchanges.tsx) - disable buttons
- [src/lib/exchanges/registry.ts](src/lib/exchanges/registry.ts) - mark as disabled
- [src/lib/exchanges/connectors/kraken.ts](src/lib/exchanges/connectors/kraken.ts) - add TODO
- [src/lib/exchanges/connectors/coinbase.ts](src/lib/exchanges/connectors/coinbase.ts) - add TODO
- [src/lib/exchanges/connectors/bybit.ts](src/lib/exchanges/connectors/bybit.ts) - add TODO

**Implementation Timeline:** Can be done after MVP

---

#### 🔟 CRON JOB STUBS (With Clear Purpose)
**Current State:**
- Pattern analysis placeholder
- Digest email placeholder
- Outcome cleanup placeholder

**Implementation Strategy: DOCUMENT AS TODO**
1. Keep functions as stubs
2. Add detailed TODO comments explaining what each does
3. Link to implementation issue
4. Document expected inputs/outputs

**Files to Modify:**
- [src/server/cron.ts](src/server/cron.ts)

**Examples:**
```typescript
/**
 * TODO: Pattern Learning Analysis
 * 
 * PURPOSE: Analyze historical execution outcomes to identify patterns
 * 
 * INPUTS:
 * - Previous 30 days of executions from execution_log table
 * - Market data for each execution date from market_data table
 * - Execution outcomes (profit/loss) from outcome_log table
 * 
 * LOGIC:
 * 1. Fetch all executions from past 30 days
 * 2. Calculate win rate by proposal type
 * 3. Find top-performing confidence score ranges
 * 4. Identify market conditions (volatility, trend) for each execution
 * 5. Calculate success rate by market condition
 * 
 * OUTPUT:
 * - Save patterns to pattern_analysis table
 * - Update agent learning models
 * - Log to pattern_learning_log table
 * 
 * STATUS: Blocked on outcome_log table implementation
 * ESTIMATED EFFORT: 4-6 hours
 */
async function jobAnalyzePatterns() {
  // TODO: Implement pattern analysis
  console.log('[Cron] Pattern analysis: TODO - see function comment for details');
}
```

---

### PHASE 4: CLEANUP DEBUG UI (Remove Solved Problems Only)

#### ❌ REMOVE DEBUG BUTTONS (Solved Issues)
**Current State:**
- Dashboard has debug panel with test buttons ❌
- All test buttons are for problems now fixed ❌
- Code: [src/pages/Dashboard.tsx](src/pages/Dashboard.tsx#L213-273)

**What to Remove:**
- [ ] "Test Exchange Connection" button (exchanges working ✅)
- [ ] "Test Token" button (auth working ✅)
- [ ] "Simulate Market Alert" button (alerts working ✅)
- [ ] "Generate Test Activity" button (activities logging working ✅)
- [ ] All `handleDebug()` related code
- [ ] All `TestResult` component and states

**Impact:** Cleaner UI, less confusion.

---

#### ❌ REMOVE DEBUG ENDPOINTS (After Verified)
**Current State:**
- `/api/exchanges/debug` endpoint exists
- Exposes internal debug info
- Not needed in production

**Action:**
- Remove endpoint from [api/index.ts](api/index.ts#L3060)

**Impact:** Better security, less clutter.

---

---

## 📊 IMPLEMENTATION SEQUENCE

### Week 1 (Days 1-2): Critical Path
1. ✅ Email persistence (Supabase schema + fetch)
2. ✅ Notification preferences API + persistence
3. ✅ Email provider integration
4. ✅ Ticket auto-refresh

**Time Estimate:** 8-10 hours  
**Outcome:** Core notification system works end-to-end

---

### Week 1 (Days 3-4): Core Improvements
5. ✅ Real confidence scores
6. ✅ Real Bitvavo orders/positions
7. ✅ Outcome recording with cron
8. ✅ Supabase activity logging

**Time Estimate:** 12-14 hours  
**Outcome:** Agent has full context, history persisted

---

### Week 2: Stubs & Polish
9. ✅ Coming Soon stubs (Kraken/Coinbase/Bybit)
10. ✅ Cron job documentation (Pattern analysis, digest email)
11. ✅ Remove debug UI buttons
12. ✅ Remove debug endpoints

**Time Estimate:** 4-6 hours  
**Outcome:** Codebase clean, roadmap clear

---

## 🗂️ SQL MIGRATIONS NEEDED

### Migration 1: User Profiles Table
```sql
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
```

### Migration 2: Notification Preferences
```sql
CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  email_on_execution BOOLEAN DEFAULT true,
  email_on_alert BOOLEAN DEFAULT true,
  email_on_daily_summary BOOLEAN DEFAULT true,
  sms_on_execution BOOLEAN DEFAULT false,
  push_on_execution BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_notification_prefs_user_id ON notification_preferences(user_id);
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
```

### Migration 3: Agent Activities Log
```sql
CREATE TABLE agent_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  exchange TEXT NOT NULL,
  activity_type TEXT NOT NULL, -- 'analysis', 'alert', 'monitoring', 'execution'
  status TEXT NOT NULL, -- 'success', 'pending', 'error'
  title TEXT,
  description TEXT,
  details JSONB,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  duration_ms INTEGER
);

CREATE INDEX idx_activities_user_id ON agent_activities(user_id);
CREATE INDEX idx_activities_timestamp ON agent_activities(timestamp);
ALTER TABLE agent_activities ENABLE ROW LEVEL SECURITY;
```

### Migration 4: Execution Outcomes Log
```sql
CREATE TABLE execution_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  execution_id TEXT NOT NULL,
  proposal_id TEXT NOT NULL,
  entry_price DECIMAL(20, 8),
  exit_price DECIMAL(20, 8),
  profit_loss DECIMAL(20, 8),
  profit_loss_percent DECIMAL(10, 2),
  status TEXT, -- 'open', 'closed', 'pending'
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  closed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_outcomes_user_id ON execution_outcomes(user_id);
CREATE INDEX idx_outcomes_execution_id ON execution_outcomes(execution_id);
ALTER TABLE execution_outcomes ENABLE ROW LEVEL SECURITY;
```

---

## ✅ VERIFICATION CHECKLIST

After implementation, verify:

- [ ] Build passes: 0 TypeScript errors
- [ ] User email captured and persisted
- [ ] Email preferences save/load correctly
- [ ] Execution emails send successfully
- [ ] Tickets auto-refresh after execution
- [ ] Agent has real openOrders/openPositions
- [ ] Outcomes recorded to Supabase
- [ ] Activity logging to Supabase works
- [ ] No debug UI visible to users
- [ ] Kraken/Coinbase/Bybit show "Coming Soon"
- [ ] All TODO comments have clear context
- [ ] No console spam in production

---

## 📈 ESTIMATED TOTAL TIME

| Phase | Tasks | Hours | Risk |
|-------|-------|-------|------|
| Phase 1 (Critical) | 1-4 | 8-10h | Low |
| Phase 2 (Core) | 5-8 | 12-14h | Low |
| Phase 3 (Stubs) | 9-10 | 2-3h | Low |
| Phase 4 (Cleanup) | Debug UI | 2-3h | Low |
| **TOTAL** | **10 items** | **24-30h** | **Low** |

---

## 🎯 END STATE

A production-ready application with:
- ✅ Full email notification system (configurable)
- ✅ Real execution tracking with outcomes
- ✅ Full agent context (real balances, orders, positions)
- ✅ Historical activity logging
- ✅ Clear roadmap for future features (Kraken, Coinbase, Bybit)
- ✅ Zero debug code exposed to users
- ✅ Codebase with clear TODOs instead of stubs
- ✅ All 111 issues resolved or documented

**Timeline:** 4-5 working days  
**Risk Level:** LOW (mostly additive, not breaking changes)
