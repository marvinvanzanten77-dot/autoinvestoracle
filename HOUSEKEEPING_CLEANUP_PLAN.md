# 🏠 HOUSEKEEPING PLAN - Code Cleanup & Audit
**Date:** February 11, 2026  
**Status:** PLANNING PHASE (awaiting approval before execution)

---

## 📋 EXECUTIVE SUMMARY

**Scope:** Complete code audit, removal of dead code, stub implementations, TODO comments, incomplete features
**Goal:** Make codebase clean, functional, and production-ready
**Approach:** Identify → Plan → Report → Execute (this stage)

---

## 🔍 AUDIT FINDINGS

### Category 1: STUB/INCOMPLETE CODE (44 instances)
Code that's half-baked, marked with TODO, or returns placeholder data.

#### 1A. Email Service (src/lib/notifications/emailService.ts)
- **Issue:** Implementation ready but:
  - Line 128-146: STUB mode - only logs to console
  - Line 297: TODO - Check user preferences not implemented
  - No actual email sending in production (needs Resend/SendGrid API keys)
- **Impact:** Execution notifications can't send emails
- **Action:** ✅ Keep structure, but document that stub mode is expected until configured

#### 1B. Logger System (src/lib/observation/logger.ts)
- **Issue:** Line 13, 21, 38 - Marked as "stub", in-memory only
  - Should be: Supabase integration
  - Currently: Data lost on restart
- **Impact:** No persistent observation logging
- **Action:** REMOVE "stub" comments, OR implement Supabase integration

#### 1C. Cron Jobs (src/server/cron.ts)
- **Lines:** 36-45, 77, 121, 150
- **Issues:** 
  - Mock outcome recording (line 36-45)
  - Pattern analysis is placeholder (line 77)
  - Digest email is placeholder (line 121)
  - Cleanup placeholder (line 150)
- **Impact:** Automated tasks don't work
- **Action:** REMOVE all 4 placeholder jobs or implement them

#### 1D. Market Data Handlers (src/server/handlers/marketData.ts)
- **Lines:** 111-132 (observations), 174-193 (patterns), 248-277 (analysis)
- **Issues:** All return mock data, marked as "For now"
- **Impact:** API returns demo data instead of real data
- **Action:** Implement Supabase queries OR remove endpoints

#### 1E. ScanScheduler (src/trading/scanScheduler.ts)
- **Lines:** 283 (sentiment: 50 placeholder), 289-290 (TODO fetch orders/positions)
- **Issues:** Hard-coded values, incomplete data
- **Impact:** Agent doesn't have full context
- **Action:** Implement data fetching or remove features

#### 1F. Trading Handler (src/server/handlers/trading.ts)
- **Line:** 563 (TODO - unify execution paths), 579 (quantity: 0 placeholder)
- **Issues:** Incomplete execution logic
- **Action:** Either implement or remove

#### 1G. Email Sending in Proposals (api/index.ts)
- **Lines:** 2600-2601 (TODO: Fetch from Supabase user profile)
- **Issues:** User email not captured, placeholder email used
- **Action:** Fetch real user email from Supabase OR remove email sending

---

### Category 2: DEBUG/TEST CODE (25 instances)
Code meant for debugging that should be removed or gated behind a flag.

#### 2A. Dashboard Debug Panel (src/pages/Dashboard.tsx)
- **Lines:** 213-273 (handleDebug, TestResult, Debug buttons)
- **Issue:** Debug UI visible to users, not production-ready
- **Action:** REMOVE or move to admin-only area

#### 2B. Console Logging (widespread)
- **Lines:** api/index.ts has 50+ console.log() statements
- **Issue:** Spam in production logs
- **Action:** Replace with logger or environment-gated logs

#### 2C. Debug Endpoints (api/index.ts)
- **Line:** 3060 (exchanges/debug endpoint)
- **Issue:** Security issue - exposes internal debug info to users
- **Action:** REMOVE or restrict to admins only

#### 2D. Test Data in Cron (src/server/cron.ts)
- **Line:** 17, 36-45 (mockOutcome, mock random success)
- **Issue:** Not real data
- **Action:** REMOVE test code

---

### Category 3: INCOMPLETE INTEGRATIONS (15 instances)
Features that were started but never finished.

#### 3A. User Notification Preferences
- **Files:** src/pages/Settings.tsx (UI only, no backend)
- **Issue:** Settings page shows UI but doesn't save preferences
- **Action:** Either implement POST /api/user/preferences OR remove UI

#### 3B. Exchange Connectors  
- **Files:** src/lib/exchanges/connectors/* (Kraken, Coinbase, Bybit)
- **Issue:** All are shells with ~19 TODO comments
- **Impact:** Only Bitvavo works; other exchanges are non-functional
- **Action:** Either complete them OR remove from UI

#### 3C. Agent Context Balances (src/trading/scanScheduler.ts)
- **Lines:** 289-290 (empty openOrders, openPositions)
- **Issue:** Agent doesn't have complete context
- **Action:** Implement fetching or make agent work with what it has

#### 3D. Outcome Recording
- **Files:** src/lib/observation/logger.ts (recordOutcome function)
- **Issue:** Called but not persisted, marked "TODO"
- **Action:** REMOVE or implement Supabase storage

#### 3E. Agent Activity Real Persistence
- **Issue:** Returns mock activities, should return real execution history
- **Action:** Implement or remove

---

### Category 4: HALF-BAKED FEATURES (12 instances)
Features that exist but don't fully work.

#### 4A. Ticket Auto-Refresh
- **Issue:** TicketsWidget loads once, doesn't refresh after execution
- **Fix:** Add polling or WebSocket

#### 4B. Proposal Linking in Tickets
- **Issue:** Execution ticket has proposalId but UI doesn't show link
- **Fix:** Add display link OR remove field

#### 4C. Execution Confidence Scores
- **Issue:** All trades logged with confidence: 50 (hardcoded)
- **Fix:** Pass real confidence from proposal OR calculate it

#### 4D. User Email Capture
- **Issue:** Onboarding captures email but email service doesn't get it
- **Fix:** Store in Supabase and fetch in email service

#### 4E. Performance Snapshot Calculation
- **Issue:** Uses placeholder for estimatedValue (line 3148)
- **Fix:** Use real price data OR remove feature

---

### Category 5: OBSOLETE/DEAD CODE (8 instances)
Code that's no longer used or replaced.

#### 5A. Observer Mode Comments
- **File:** OBSERVER_MODE_OBSOLETE_AUDIT.md
- **Issue:** Entire document about obsolete feature
- **Action:** DELETE

#### 5B. Deprecated Files  
- **Files:** Various phase-1 documentation files
- **Action:** Archive or DELETE if not referenced

#### 5C. Old Type Definitions
- **Issue:** Multiple TypeScript types defined but unused
- **Action:** Identify and remove

---

### Category 6: CONFIGURATION ISSUES (7 instances)
Missing or incomplete configuration.

#### 6A. Email Provider Keys
- **Issue:** EMAIL_PROVIDER and EMAIL_PROVIDER_KEY not set
- **Impact:** Email sending falls back to stub mode
- **Action:** Document expected env vars or remove email feature

#### 6B. Unused Environment Variables
- **Issue:** .env.example has vars that aren't used
- **Action:** Clean up .env.example

#### 6C. Missing Database Schema
- **Issue:** Code references Supabase tables that don't exist
- **Action:** Either create tables OR remove code

---

## 📊 STATISTICS

| Category | Count | Severity | Effort |
|----------|-------|----------|--------|
| Stub/Incomplete | 44 | MEDIUM | 8-12h |
| Debug Code | 25 | HIGH | 3-4h |
| Incomplete Integration | 15 | MEDIUM | 16-20h |
| Half-Baked Features | 12 | LOW | 4-6h |
| Dead Code | 8 | LOW | 2-3h |
| Configuration | 7 | MEDIUM | 1-2h |
| **TOTAL** | **111** | | **34-47h** |

---

## 🎯 CLEANUP STRATEGY

### Phase 1: REMOVE (Highest Impact)
1. Remove all `TODO` comments that have no plan
2. Remove debug UI (Dashboard debug panel)
3. Remove debug endpoint (exchanges/debug)
4. Remove obsolete markdown files (OBSERVER_MODE_*, old docs)
5. Remove mock data from cron jobs

**Time:** ~4-5h  
**Risk:** Low (just deletions)

---

### Phase 2: GATE/DOCUMENT (Medium Impact)
1. Gate console logging behind DEBUG flag
2. Keep email service but document stub mode
3. Keep incomplete connectors but hide from UI
4. Document unfinished features

**Time:** ~3-4h  
**Risk:** Low (documentation + config)

---

### Phase 3: IMPLEMENT or REMOVE (High Impact)
**Option A: Minimize (Remove Features)**
- Remove unused exchange connectors
- Remove incomplete integrations
- Keep only Bitvavo + core features
- ~10-12h but cleaner codebase

**Option B: Complete (Implement Missing)**
- Implement Supabase integrations
- Implement all exchange connectors
- Implement outcome recording
- ~30-40h but more features

**Recommendation:** Option A - minimize to working core

**Time:** 10-12h (remove) vs 30-40h (complete)  
**Risk:** Medium (removes features but improves stability)

---

### Phase 4: FIX BLOCKERS (Critical)
1. **User email capture** - needed for notifications
2. **Notification preferences storage** - needed for opt-out
3. **Ticket auto-refresh** - needed for UX
4. **Email provider configuration** - needed for production

**Time:** ~4-6h  
**Risk:** Low (critical path items)

---

## 📋 DETAILED ACTION ITEMS (111 Total)

### TO REMOVE (Immediate)
- [ ] Delete OBSERVER_MODE_OBSOLETE_AUDIT.md
- [ ] Delete Phase-1 documentation files (identify which ones)
- [ ] Remove dashboard debug panel (src/pages/Dashboard.tsx lines 213-273)
- [ ] Remove /api/exchanges/debug endpoint
- [ ] Remove mock outcomes from cron (src/server/cron.ts lines 36-45)
- [ ] Remove mock observers from handlers (src/server/handlers/marketData.ts lines 111-132)
- [ ] Remove mock patterns from handlers (lines 174-193)
- [ ] Remove mock analysis from handlers (lines 248-277)
- [ ] Remove unused type definitions (identify which ones)
- [ ] Remove placeholder environment variables from .env.example

### TO GATE/DOCUMENT (With Config)
- [ ] Add LOG_LEVEL env var to gate console.log() calls
- [ ] Document EMAIL_PROVIDER configuration requirements
- [ ] Document that Kraken/Coinbase/Bybit connectors are stubs
- [ ] Add comment to scanScheduler explaining incomplete data
- [ ] Add comment to logger explaining in-memory storage

### TO IMPLEMENT OR SKIP (Decision Point)
**Choose ONE approach:**

**If MINIMIZE:**
- [ ] Remove Kraken connector entirely
- [ ] Remove Coinbase connector entirely
- [ ] Remove Bybit connector entirely
- [ ] Remove incomplete fields from scanScheduler
- [ ] Remove outcome recording code
- [ ] Remove agent activity real persistence (use tickets instead)

**If COMPLETE:**
- [ ] Implement Supabase observations table
- [ ] Implement Supabase patterns table
- [ ] Implement Supabase user_notification_preferences
- [ ] Complete Kraken connector
- [ ] Complete Coinbase connector
- [ ] Complete Bybit connector
- [ ] Implement outcome recording
- [ ] Implement agent activity logging

### CRITICAL BLOCKERS (Must Fix)
- [ ] Fetch user email from Supabase in email service
- [ ] Store user email at onboarding completion
- [ ] Implement POST /api/user/preferences endpoint
- [ ] Implement GET /api/user/preferences endpoint
- [ ] Add polling or WebSocket to TicketsWidget for auto-refresh
- [ ] Pass real confidence scores instead of hardcoding 50

---

## 🚀 EXECUTION ORDER

1. **Day 1 Morning:** Phase 1 (Remove) - 4-5h
2. **Day 1 Afternoon:** Phase 2 (Gate/Document) - 3-4h
3. **Day 2:** Decide Phase 3 approach
4. **Day 3-5:** Execute Phase 3 (chosen approach)
5. **Day 5:** Phase 4 (Fix Blockers) - 4-6h

---

## ✅ SUCCESS CRITERIA

After cleanup, the codebase should:

- ✅ Have 0 TODO comments (except documented future work)
- ✅ Have 0 debug UI exposed to users
- ✅ Have all incomplete features either removed or completed
- ✅ Have all email notifications working (with proper preferences)
- ✅ Have no mock data returned by real endpoints
- ✅ Have no console spam in production logs
- ✅ Have clear documentation of what's implemented vs. future work
- ✅ Build with 0 errors
- ✅ All core features working end-to-end

---

## 📞 DECISION POINTS FOR USER

Before execution, please decide:

**1. MINIMIZE or COMPLETE?**
   - [ ] A: Minimize codebase (remove unused features) - faster, cleaner
   - [ ] B: Complete all features (implement missing) - slower, more features

**2. Remove Connectors?**
   - [ ] A: Keep only Bitvavo, remove Kraken/Coinbase/Bybit
   - [ ] B: Keep all (but hide incomplete ones)

**3. Email Service?**
   - [ ] A: Remove email sending entirely (use only in-app notifications)
   - [ ] B: Keep email, implement Resend/SendGrid integration

**4. Debug Logs?**
   - [ ] A: Remove all console.log() statements
   - [ ] B: Gate behind DEBUG environment variable

**5. Stub Features?**
   - [ ] A: Delete stubs (e.g., cron jobs, logger, outcome recording)
   - [ ] B: Keep stubs with clear "TODO" documentation

---

## 📝 NOTES

- **This is a PLANNING DOCUMENT only** - no changes made yet
- Build is currently clean: **✅ 0 TypeScript errors**
- All 111 issues identified but not fixed
- Ready for execution after approval

---

## 🏁 NEXT STEP

**User Action Required:**
1. Review this plan
2. Answer the 5 decision points above
3. Approve execution
4. I will then proceed with cleanup

**Once Approved:**
- Changes will be tracked
- Build verified after each phase
- Progress reported after each phase
