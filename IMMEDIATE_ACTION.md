# 🚀 IMMEDIATE ACTION ITEMS

## Priority 1: Environment Variables (Do This First!)

### 1. Get RESEND_API_KEY
1. Go to https://resend.com
2. Sign up (free account)
3. Create API key in dashboard
4. Copy the key

### 2. Get OPENAI_API_KEY
1. Go to https://platform.openai.com/api/keys
2. Sign in
3. Create new secret key
4. Copy the key

### 3. Add to Vercel
1. Open your Vercel project dashboard
2. Click **Settings** → **Environment Variables**
3. Add `RESEND_API_KEY` (all environments)
4. Add `OPENAI_API_KEY` (all environments)
5. Redeploy project

**Status:** 🔴 Blocking features: Email + ChatGPT

---

## Priority 2: Database Migration

### 1. Open Supabase
1. Go to your Supabase project dashboard
2. Click **SQL Editor**
3. Create new query

### 2. Run Migration
1. Copy contents of: `src/sql/phase2_settings_migration.sql`
2. Paste into SQL editor
3. Click **Run**

**Adds:**
- `risk_profile` column to user_profiles
- `strategy`, `max_position_size`, `daily_loss_limit` columns
- `market_scan_interval` column to notification_preferences
- New `market_scans` table
- New `context_cache` table

**Status:** 🔴 Required for settings endpoints to work

---

## Priority 3: Test Settings Endpoints

Once env vars + migration done:

### Test Risk Level
```bash
curl -X POST http://localhost:3000/api/user/risk-level \
  -H "Content-Type: application/json" \
  -H "Cookie: aio_uid=test-user-id" \
  -d '{"riskLevel": "actief"}'
```

Expected response:
```json
{
  "success": true,
  "oldValue": "gebalanceerd",
  "newValue": "actief",
  "message": "Risicoprofiel bijgewerkt naar: actief"
}
```

### Test in Chat
Open chat interface and try:
- "Zet mijn risicoprofiel op actief"
- "Scan de markt elke uur"
- "Verlaag mijn positiegrootte naar 5%"

---

## Summary of Changes

### ✅ Code (Already Committed)
- 5 new settings API endpoints in `api/index.ts` (+266 lines)
- Integration with `chatSettingsManager.ts` for natural language
- Full type safety and validation

### ✅ Documentation (Already Committed)
- `VERCEL_ENV_SETUP.md` - Environment variable setup guide
- `PHASE2_SETTINGS_COMPLETE.md` - Full feature documentation
- `src/sql/phase2_settings_migration.sql` - Database migration

### 🔴 Still Needed (You)
- [ ] Create RESEND_API_KEY at resend.com
- [ ] Create OPENAI_API_KEY at openai.com
- [ ] Add keys to Vercel
- [ ] Run database migration in Supabase
- [ ] Redeploy Vercel project

---

## API Endpoints Ready

All 5 endpoints are live once env vars are set:

| Endpoint | Purpose | Required Env |
|----------|---------|--------------|
| POST /api/user/risk-level | Set risk profile | None (internal) |
| POST /api/user/scan-interval | Set scan frequency | None (internal) |
| POST /api/user/strategy | Set trading strategy | None (internal) |
| POST /api/user/position-size | Set max position | None (internal) |
| POST /api/user/loss-limit | Set loss limit | None (internal) |

These don't need external APIs - they're internal endpoints using Supabase.

The RESEND_API_KEY and OPENAI_API_KEY enable:
- Email notifications (via `/api/cron/digest-email`)
- ChatGPT chat responses (via `/api/chat`)

---

## Build Status
✅ 0 errors
✅ 847 KB JS bundle
✅ Ready to deploy

---

## Timeline
- ⏱️ 15 min: Get and add API keys to Vercel
- ⏱️ 10 min: Run database migration
- ⏱️ 5 min: Redeploy Vercel
- ⏱️ 10 min: Test in chat

**Total: ~40 minutes to fully functional**

---

## Questions?
- Settings endpoints: See `PHASE2_SETTINGS_COMPLETE.md`
- Environment setup: See `VERCEL_ENV_SETUP.md`
- Chat integration: See `src/lib/chatSettingsManager.ts`
- Database schema: See `src/sql/phase2_settings_migration.sql`
