# 🔒 SECURITY FIXES - DEPLOYMENT

## Status
Phase 1 schema is live but has 2 policy gaps that need closing.

---

## What's Being Fixed

### Before (Vulnerable)
```sql
execution_outcomes:
  INSERT with_check = true  ❌ Anyone can insert any outcome

pattern_learning:
  INSERT with_check = true  ❌ Anyone can corrupt patterns
  UPDATE qual = true        ❌ Anyone can modify patterns
```

### After (Secure)
```sql
execution_outcomes:
  INSERT with_check = ((auth.uid())::text = user_id)  ✅ User-bound
  UPDATE with same check                              ✅ Own records only

pattern_learning:
  SELECT true               ✅ All users read global patterns
  INSERT/UPDATE             ✅ Service-role only (backend)
```

---

## Why This Matters

**Execution Outcomes:**
- Without fix: User A could insert fake outcomes for User B
- With fix: Each user isolated, only their own trades recorded
- Impact: Prevents data corruption, ensures audit integrity

**Pattern Learning:**
- Without fix: Any user could spam/sabotage the learning table
- With fix: Only backend writes patterns (via service role)
- Impact: Global insights stay clean, single source of truth

---

## How to Deploy

### Step 1: Open Supabase SQL Editor
1. Go to Supabase Dashboard
2. Click **SQL Editor**
3. Click **New query**

### Step 2: Copy & Run Security Fix
1. Open: `src/sql/phase1_security_fixes.sql`
2. Copy all content (Ctrl+A → Ctrl+C)
3. Paste into Supabase SQL Editor
4. Click **Run** (or Ctrl+Enter)

Expected result:
```
Success. No rows returned
```

(That's correct - these are DDL commands, not queries)

### Step 3: Verify Policies Are Locked

Run this verification query in Supabase:

```sql
select schemaname, tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public' 
  and tablename in ('execution_outcomes', 'pattern_learning')
order by tablename, policyname;
```

Expected output:

| schemaname | tablename | policyname | roles | cmd |
|---|---|---|---|---|
| public | execution_outcomes | Users can insert their own outcomes | {public} | INSERT |
| public | execution_outcomes | Users can update their own outcomes | {public} | UPDATE |
| public | execution_outcomes | Users can view their own outcomes | {public} | SELECT |
| public | pattern_learning | Anyone can view patterns | {public} | SELECT |

**Key point:** pattern_learning should have **NO** INSERT/UPDATE policies showing (that's correct - writes happen via service role which bypasses RLS)

---

## What Changed in Code

### execution_outcomes
**Old:**
```sql
CREATE POLICY "System can insert outcomes" ON execution_outcomes
  FOR INSERT WITH CHECK (true);  -- ❌ Open to anyone
```

**New:**
```sql
CREATE POLICY "Users can insert their own outcomes" ON execution_outcomes
  FOR INSERT WITH CHECK ((auth.uid())::text = user_id);  -- ✅ User-bound

CREATE POLICY "Users can update their own outcomes" ON execution_outcomes
  FOR UPDATE USING ((auth.uid())::text = user_id) 
  WITH CHECK ((auth.uid())::text = user_id);  -- ✅ Own records only
```

### pattern_learning
**Old:**
```sql
CREATE POLICY "System can insert patterns" ON pattern_learning
  FOR INSERT WITH CHECK (true);  -- ❌ Open to anyone

CREATE POLICY "System can update patterns" ON pattern_learning
  FOR UPDATE USING (true);  -- ❌ Open to anyone
```

**New:**
```sql
-- Only SELECT policy
CREATE POLICY "Anyone can view patterns" ON pattern_learning
  FOR SELECT USING (true);  -- ✅ Read-only for clients

-- INSERT/UPDATE removed - backend uses service_role key
-- Service role bypasses RLS entirely (intended)
```

---

## Architecture After Fix

```
┌─────────────────────────────────────────────┐
│       CLIENT (Browser / Mobile)             │
├─────────────────────────────────────────────┤
│ SELECT execution_outcomes  ✅ (own records)  │
│ INSERT execution_outcomes  ✅ (own only)     │
│ UPDATE execution_outcomes  ✅ (own only)     │
│ SELECT pattern_learning    ✅ (all patterns) │
│ INSERT pattern_learning    ❌ BLOCKED        │
│ UPDATE pattern_learning    ❌ BLOCKED        │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│   BACKEND (Server with service_role)        │
├─────────────────────────────────────────────┤
│ All operations on all tables ✅              │
│ (bypasses RLS with SUPABASE_SERVICE_ROLE_KEY)
└─────────────────────────────────────────────┘
```

---

## Backend Integration

Your backend (in `api/index.ts`) already uses service role for pattern updates:

```typescript
// This still works after the fix!
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!  // ✅ Bypasses RLS
);

// Can still write patterns:
await supabaseAdmin
  .from('pattern_learning')
  .upsert({ category, condition, win_rate, ... });
```

No code changes needed - service role key bypass RLS by design in Supabase.

---

## Testing After Deployment

### Test 1: User Can't Insert Other User's Outcome
```typescript
// Client tries to fake another user's outcome
const { error } = await supabase
  .from('execution_outcomes')
  .insert({
    user_id: 'different-user-id',  // ❌ Blocked
    execution_id: 'fake',
    symbol: 'BTC'
  });

// Should get RLS error
// "new row violates row-level security policy"
```

### Test 2: User Can Insert Own Outcome
```typescript
// Client inserts own outcome
const { error } = await supabase
  .from('execution_outcomes')
  .insert({
    user_id: auth.currentUser.id,  // ✅ Allowed
    execution_id: 'real-exec-123',
    symbol: 'BTC'
  });

// Should succeed
```

### Test 3: User Can Read Global Patterns
```typescript
// Client reads patterns
const { data } = await supabase
  .from('pattern_learning')
  .select('*');

// Should return all patterns
// ✅ Allowed
```

### Test 4: User Can't Write Patterns
```typescript
// Client tries to add pattern
const { error } = await supabase
  .from('pattern_learning')
  .insert({ category: 'asset', condition: 'BTC', win_rate: 0.75 });

// Should get RLS error
// "new row violates row-level security policy"
```

---

## Rollback (If Needed)

If something goes wrong, you can revert to the original (insecure) policies:

```sql
-- Restore old insecure policies
DROP POLICY IF EXISTS "Users can insert their own outcomes" ON execution_outcomes;
DROP POLICY IF EXISTS "Users can update their own outcomes" ON execution_outcomes;

CREATE POLICY "System can insert outcomes" ON execution_outcomes
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can view patterns" ON pattern_learning;

CREATE POLICY "System can insert patterns" ON pattern_learning
  FOR INSERT WITH CHECK (true);

CREATE POLICY "System can update patterns" ON pattern_learning
  FOR UPDATE USING (true);
```

But **don't do this** - the fix is the right approach.

---

## Timeline

- ⏱️ 1 min: Copy SQL from phase1_security_fixes.sql
- ⏱️ 1 min: Paste and run in Supabase
- ⏱️ 2 min: Verify with query
- ⏱️ 5 min: Test in browser (optional)

**Total: ~5 minutes**

---

## Summary

✅ **Phase 1 Schema:** Live and correct  
❌ **Phase 1 Policies:** Gaps fixed  
✅ **Security:** Now production-ready  
✅ **Global Learning:** Architecture preserved  

Next: Can proceed to Phase 2 migrations with confidence.
