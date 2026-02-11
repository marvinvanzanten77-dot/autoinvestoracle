# OPENSTAANDE ISSUES - SCAN 10 FEBRUARI 2026

**Build Status:** ✅ 0 TypeScript errors (just fixed 7)  
**Last Fix:** Execution logging in api/index.ts (all 7 errors resolved)

---

## 🔴 CRITICAL BLOCKERS

### 1. **User Email Not Captured at Onboarding**
**Status:** 🔴 BLOCKING  
**Issue:** Email notifications system ready, but we have no user emails to send to

**Location:** 
- `src/pages/Onboarding.tsx` - captures email in step 0
- `api/index.ts:2456` - creates profile but doesn't save email to where email service can find it

**Problem:**
```typescript
// Onboarding saves email to state:
const [data, setData] = useState({
  displayName: '',
  email: '',  // ← Captured here
  emailUpdatesOptIn: false
});

// But when proposal executes, we try to fetch it:
const userEmail = connection.metadata?.['userEmail'] || `user+${userId.substring(0, 8)}@auto-invest-oracle.com`;
// ↑ Placeholder - NO EMAIL FETCHED!
```

**Fix Required:**
- [ ] Fetch user email from Supabase user profiles
- [ ] Store email in connection metadata during exchange setup
- [ ] Or fetch from session user object (if available)

**Impact:** Email notifications won't work without real emails

---

### 2. **User Notification Preferences Not Stored**
**Status:** 🔴 BLOCKING  
**Issue:** Settings page shows UI but doesn't persist to database

**Location:** `src/pages/Settings.tsx` Lines 32-50, 346-356

**Problem:**
```typescript
// UI shows checkboxes:
const [notifications, setNotifications] = useState({
  dailyEmail: true,
  volAlerts: true
});

// But no POST to backend!
onChange={(e) => setNotifications((n) => ({ ...n, dailyEmail: e.target.checked }))}
// ↑ Updates local state only, never saved

// Backend has no endpoint to save preferences:
// GET /api/user/preferences ✅
// POST /api/user/preferences ❌ MISSING
```

**Fix Required:**
- [ ] Create POST `/api/user/preferences` endpoint (save to Supabase)
- [ ] Create GET `/api/user/preferences` endpoint (fetch from Supabase)
- [ ] Add Supabase table: `user_notification_preferences`
- [ ] Wire Settings.tsx to save on every change

**Impact:** `isEmailNotificationEnabled()` always returns true - can't disable emails

---

### 3. **Email Service Providers Not Configured**
**Status:** 🟡 PARTIAL  
**Issue:** Code ready but no API keys configured for production

**Location:** `src/lib/notifications/emailService.ts` Lines 108-180

**Status:**
- ✅ Resend integration code written
- ✅ SendGrid integration code written
- ✅ Stub mode works (logs to console)
- ❌ No API keys in .env

**Fix Required:**
- [ ] Choose email provider (Resend recommended for simplicity)
- [ ] Set `EMAIL_PROVIDER=resend` environment variable
- [ ] Set `EMAIL_PROVIDER_KEY=re_xxxx...` API key
- [ ] Test email sending

**Impact:** Emails will only log to console in development

---

## 🟡 HIGH PRIORITY ISSUES

### 4. **Execution Logging Missing Real Confidence Scores**
**Status:** 🟡 FIXED BUT INCOMPLETE  
**Issue:** Just fixed type errors, but now all trades log confidence: 50 (hardcoded)

**Location:** `api/index.ts` Lines 2577-2578, 2612, 2669-2670

**Problem:**
```typescript
// Before fix:
confidence: action.confidence || 50  // ← TYPE ERROR

// After fix:
confidence: 50  // ← HARDCODED (correct type but wrong value)
```

**Fix Needed:**
- Proposal type needs to include confidence field
- OR calculate confidence from proposal data

**Current Proposal Type:**
```typescript
type Proposal = {
  action: { type: string; params: Record<string, any> };  // ← No confidence here!
  // ... other fields
};
```

**Fix Options:**
1. Add confidence to Proposal type
2. Extract from params (e.g., `params.confidence`)
3. Calculate from proposal reasoning

**Impact:** All execution tickets show medium confidence even if high-confidence trades

---

### 5. **Email Sending Not Async Truly Non-Blocking**
**Status:** 🟡 PARTIAL  
**Issue:** Fire-and-forget works but fires before response

**Location:** `api/index.ts` Lines 2589-2615

**Problem:**
```typescript
// Email is sent AFTER response:
return res.status(200).json({ success: true });

// But JS continues in background (correct):
(async () => {
  await sendExecutionEmail(...);  // Still running
})();
```

**Status:** Actually works correctly!  
**Verification:** Response returns immediately, email queued for background

**No fix needed** - but good to note for monitoring

---

### 6. **Tickets Widget Doesn't Auto-Refresh**
**Status:** 🟡 PARTIAL  
**Issue:** After execution, user must refresh to see ticket

**Location:** `src/components/TicketsWidget.tsx` Lines 19-35

**Problem:**
```typescript
useEffect(() => {
  const loadTickets = async () => {
    const resp = await fetch(`/api/tickets?userId=${userId}`);
    const data = await resp.json();
    setTickets(data.tickets || []);
  };
  loadTickets();
}, [userId]);  // ← Only loads on component mount!
```

**Fix Needed:**
- [ ] Add polling (refresh every 10 seconds)
- [ ] Or add WebSocket listener for real-time updates
- [ ] Or trigger refresh from parent Dashboard on proposal approval

**Impact:** User sees stale ticket list after trade execution

---

## 🟢 MEDIUM PRIORITY ISSUES

### 7. **Execution Ticket relatedProposalId Not Displayed**
**Status:** 🟢 NICE-TO-HAVE  
**Issue:** Execution ticket has proposalId but UI doesn't show link to it

**Location:** 
- Logger creates: `relatedProposalId: execution.proposalId` 
- Widget displays: `relatedObservationId` link (line 180)

**Fix:** Add display of proposal link in execution ticket:
```tsx
{ticket.relatedProposalId && (
  <a href={`#prop-${ticket.relatedProposalId}`}>
    Zie voorstel
  </a>
)}
```

**Impact:** Users can't trace execution back to proposal

---

### 8. **Sell Order Email Sending Missing**
**Status:** 🟡 FIXED (just added)  
**Issue:** BUY orders send email but SELL orders didn't

**Location:** `api/index.ts` Lines 2664-2693

**Status:** ✅ JUST FIXED - added email sending for sell orders

---

## 🟢 LOW PRIORITY / TECHNICAL DEBT

### 9. **Error Handling: What if logExecutionTicket Fails?**
**Status:** 🟢 GRACEFUL DEGRADATION  
**Order:** Still executes even if ticket logging fails

**Location:** `api/index.ts` Lines 2582-2585

**Code:**
```typescript
try {
  await logExecutionTicket(...);
} catch (ticketErr) {
  console.warn('[trading/proposals] Could not log execution ticket:', ticketErr);
  // Don't fail the order if ticket logging fails ✅
}
```

**Status:** Correct! Non-critical error, should not block order

---

### 10. **Error Handling: What if sendExecutionEmail Crashes?**
**Status:** 🟢 GRACEFUL DEGRADATION  

**Location:** `api/index.ts` Lines 2589-2615, 2668-2694

**Code:**
```typescript
try {
  const { sendExecutionEmail } = await import(...);
  await sendExecutionEmail({...});
} catch (emailErr) {
  console.warn('[...] Could not send execution email:', emailErr);
  // Non-critical: don't fail the order ✅
}
```

**Status:** Correct! Email is optional notification, should not block order

---

### 11. **Performance: Email Import Happens Per Order**
**Status:** 🟡 MINOR  
**Issue:** Dynamic import of email service happens on every order execution

**Current:**
```typescript
const { sendExecutionEmail } = await import('../src/lib/notifications/emailService');
```

**Optimization (future):**
```typescript
// Import once at module load
import { sendExecutionEmail } from '../src/lib/notifications/emailService';

// Then use directly (no await import)
await sendExecutionEmail({...});
```

**Impact:** Negligible (import cache is fast), but could optimize

---

## 📊 SUMMARY TABLE

| # | Issue | Severity | Status | Blocker? |
|---|-------|----------|--------|----------|
| 1 | User email not captured | 🔴 CRITICAL | TODO | YES |
| 2 | Preferences not saved | 🔴 CRITICAL | TODO | YES |
| 3 | Email provider config | 🟡 HIGH | TODO | NO |
| 4 | Hardcoded confidence | 🟡 HIGH | PARTIAL FIX | NO |
| 5 | Async email (false alarm) | 🟢 OK | VERIFIED ✅ | NO |
| 6 | Tickets no auto-refresh | 🟡 HIGH | TODO | NO |
| 7 | Proposal link in ticket | 🟢 NICE | TODO | NO |
| 8 | Sell order email | 🟢 OK | FIXED ✅ | NO |
| 9 | Ticket log fail handling | 🟢 OK | CORRECT ✅ | NO |
| 10 | Email fail handling | 🟢 OK | CORRECT ✅ | NO |
| 11 | Email import perf | 🟢 MINOR | LATER | NO |

---

## 🚀 QUICK WIN FIXES (Under 1 hour)

✅ **DONE (Just Fixed):**
1. Execution logging type errors (7 errors fixed)
2. Sell order email sending added

**NEXT (Pick One):**

**Option A: Enable Email (30 min)**
- Get Resend API key (free at resend.com)
- Set `EMAIL_PROVIDER=resend`
- Set `EMAIL_PROVIDER_KEY=re_xxx...`
- Test sending one email

**Option B: Fetch User Email (20 min)**
- Fetch from Supabase auth user (sessionStorage or API call)
- Store in connection.metadata when exchange connects
- OR fetch in email service from Supabase directly

**Option C: Auto-Refresh Tickets (30 min)**
- Add `setInterval` to TicketsWidget
- Or add event listener on proposal approval
- Refetch tickets every 5-10 seconds

---

## ⚠️ KNOWN RISKS

**If user doesn't see execution notifications:**
1. Check ticket logging succeeded (check logs)
2. Check TicketsWidget auto-refresh (might need manual refresh)
3. Check email delivery (might be in spam)

**If email doesn't send:**
1. Check `EMAIL_PROVIDER` env var is set
2. Check `EMAIL_PROVIDER_KEY` is valid
3. Check email service didn't throw (check logs)
4. User email might be invalid/missing

---

## 📋 WHAT'S NEXT?

**For this session:**
- [ ] Fix critical issues #1 and #2 (email capture + preferences)
- [ ] Optionally fix #6 (auto-refresh tickets)

**For next session:**
- [ ] Configure email provider (Resend)
- [ ] Test end-to-end email sending
- [ ] Add proposal link to execution tickets

**Build status:** CLEAN ✅ 0 errors, ready to continue
