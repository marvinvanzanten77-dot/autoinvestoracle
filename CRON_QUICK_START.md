# 🚀 Cron Jobs Quick Start Guide

## What Was Implemented?

All 5 cron jobs are now fully functional:

| Job | Schedule | Purpose | Status |
|-----|----------|---------|--------|
| Record Outcomes | Every 24h | Track trade results | ✅ Complete |
| Analyze Patterns | Weekly | Learn winning strategies | ✅ Complete |
| Market Scans | Disabled | Manual scans only | ⏸️ By Design |
| Digest Emails | 9 AM Daily | Send user summaries | ✅ Complete |
| Cleanup Expired | Every hour | Database maintenance | ✅ Complete |

---

## Getting Started (3 Steps)

### Step 1: Apply Supabase Migrations

Copy and execute the SQL in your Supabase dashboard:

```bash
# File: src/sql/phase1_critical_schema.sql
# Navigate to Supabase Dashboard > SQL Editor > New Query
# Paste entire file and execute
```

**What this does:**
- Creates `pattern_learning` table (for pattern discovery)
- Adds `archived` column to `agent_activities` 
- Adds `confidence` column to `execution_outcomes`
- Configures Row Level Security (RLS) policies

**Time:** <30 seconds

---

### Step 2: Configure Environment Variables

```bash
# .env.local or your deployment platform

# Supabase (already set up)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# Email Providers (choose one or both)
RESEND_API_KEY=your-resend-api-key
SENDGRID_API_KEY=your-sendgrid-api-key
```

**Get API Keys:**
- **Resend:** https://resend.com/api-keys
- **SendGrid:** https://app.sendgrid.com/settings/api_keys

**Time:** 2-5 minutes

---

### Step 3: Start the Server

```bash
# Development
npm run dev

# Production
npm run build && npm start
```

**What happens:**
```
🚀 Initializing cron jobs (DEVELOPMENT MODE)
✓ Cron jobs initialized

[CRON] Job schedulers active:
  ✓ Record Outcomes: Every 24 hours
  ✓ Analyze Patterns: Weekly (Sundays 10 PM)
  ✓ Digest Emails: Daily at 9 AM
  ✓ Cleanup: Every hour
  ⏸️ Market Scans: Disabled (use POST /api/trading/scan/now)
```

**Time:** <1 minute

---

## How Each Job Works

### Job 1: Record Outcomes
**What it tracks:** Every trade your algorithm executes

```
Each trade saves:
- Symbol (BTC-USD, ETH-USD, etc)
- Entry price, exit price, quantity
- Profit/loss amount and percentage
- Confidence score from proposal
- Timestamp
```

**Used by:** Pattern Learning (Job 2) and Digest Emails (Job 4)

---

### Job 2: Analyze Patterns  
**What it discovers:** Winning trading conditions

```
Analyzes: "In the past 30 days..."
- BTC trades: 67% win rate, $45 avg profit
- European morning (8-14): 73% win rate, $52 avg
- High confidence trades (70-90): 70% win rate, $38 avg

Stores: pattern_learning table
Used by: Future AI decision-making improvements
```

**Runs:** Once per week (Sunday 10 PM)

---

### Job 3: Market Scans
**Status:** Intentionally disabled

To manually trigger market scans:
```bash
# Bitvavo only (others "Coming Soon")
POST /api/trading/scan/now
{
  "exchange": "bitvavo",
  "scanType": "market_cap_gainers"
}
```

---

### Job 4: Digest Emails
**What users receive:** Daily trading summary at 9 AM

```
Email content:
📊 Daily Summary - June 15, 2024

Your trading activity:
• Portfolio change: +2.34%
• Trades executed: 5
• Top performer: BTC +3.2%
• Alerts triggered: 2

View details: [Link to Dashboard]
```

**Requirements:**
- ✅ User email in user_profiles
- ✅ email_on_daily_summary = true in notification_preferences
- ✅ Email provider configured (Resend or SendGrid)

---

### Job 5: Cleanup
**What it removes:** Outdated data

```
Every hour:
- Delete expired execution tickets (valid_until < NOW)
- Archive activities older than 90 days (set archived=true)
- Remove orphaned records (activities without user)
```

**Keep:** All active trades, recent activities, execution history

---

## Testing Locally

### Add Test Data
```typescript
// In your development console
const execution = {
  user_id: 'test-user',
  symbol: 'BTC-USD',
  entry_price: 45000,
  exit_price: 46000,
  quantity: 1,
  profit_loss: 1000,
  profit_loss_percent: 2.22,
  confidence: 75,
  status: 'closed'
};

// Save to execution_outcomes table
```

### Monitor Job Execution
```bash
# Terminal 1: Start server
npm run dev

# Terminal 2: Check console output
# Look for [CRON] log messages
[jobAnalyzePatterns] Fetching executions from past 30 days...
[jobAnalyzePatterns] Analyzing 15 executions...
[jobAnalyzePatterns] Analysis by asset:
  BTC-USD: 8 trades, 75.0% win rate, $45.00 avg profit
[jobAnalyzePatterns] ✓ Pattern analysis completed
```

### Test Email Sending
```typescript
// Add to your API
app.post('/api/test-email', async (req, res) => {
  await jobGenerateDigestEmail();
  res.json({ success: true });
});

// Then:
// curl -X POST http://localhost:3000/api/test-email
```

---

## Deployment Checklist

### Before Going Live
- [ ] Supabase migrations applied
- [ ] Environment variables configured
- [ ] Email provider API keys verified
- [ ] Test data in execution_outcomes
- [ ] Run npm run build (0 errors)
- [ ] Monitor logs for 24 hours
- [ ] Verify emails sent to test users

### After Going Live
- [ ] Set up CloudWatch monitoring
- [ ] Create alert for job failures
- [ ] Schedule weekly pattern review
- [ ] Monitor email delivery rates
- [ ] Check database cleanup regularly

---

## Troubleshooting

### "Email not sending"
```bash
1. Check RESEND_API_KEY or SENDGRID_API_KEY set
2. Verify user email exists in user_profiles
3. Verify email_on_daily_summary = true
4. Check console logs for API errors
5. Test email provider directly:
   curl -X POST https://api.resend.com/emails \
     -H "Authorization: Bearer YOUR_KEY" \
     -d '{"from":"test@example.com","to":"user@example.com","subject":"Test","html":"<p>Test</p>"}'
```

### "Pattern analysis not running"
```bash
1. Check initializeCronJobs() called on startup
2. Verify Supabase connection
3. Check if execution_outcomes table has data
4. Review console logs for import errors
```

### "Cleanup deleting active data"
```bash
1. Verify valid_until timestamp is set on tickets
2. Check archived boolean logic (should be null before archive)
3. Ensure RLS policies configured
```

---

## Architecture Overview

```
Your App
  ↓
initializeCronJobs()
  ├─→ setInterval(jobRecordOutcomes, 24h)
  ├─→ setInterval(jobAnalyzePatterns, 7d)
  ├─→ setTimeout(jobGenerateDigestEmail, 9 AM daily)
  └─→ setInterval(jobCleanupExpired, 1h)
      ↓
    Supabase
      ├─ user_profiles (email)
      ├─ notification_preferences (opt-in)
      ├─ execution_outcomes (trade data)
      ├─ pattern_learning (discovered patterns)
      ├─ agent_activities (logs)
      └─ tickets (with valid_until)
      ↓
    Email Service
      ├─ Resend (primary)
      └─ SendGrid (fallback)
```

---

## What's Next?

### Week 1
- Deploy to staging
- Test with real user data
- Monitor email delivery

### Week 2-3  
- Deploy to production
- Set up monitoring alerts
- Create admin dashboard

### Month 2+
- Migrate to Bull Queue (production scheduler)
- Build pattern insights UI
- Implement ML improvements

---

## Files Changed

- ✅ `src/server/cron.ts` - All 5 jobs implemented
- ✅ `src/sql/phase1_critical_schema.sql` - Schema updates
- ✅ Build verification: 0 errors

---

## Need Help?

**Logs Location:**
```bash
# Development: Browser console
# Production: CloudWatch / Vercel logs

# Search for:
[jobAnalyzePatterns]
[jobGenerateDigestEmail]
[jobCleanupExpired]
```

**Code Reference:**
- Job definitions: [src/server/cron.ts](src/server/cron.ts)
- Schema: [src/sql/phase1_critical_schema.sql](src/sql/phase1_critical_schema.sql)
- Full docs: [CRON_JOBS_IMPLEMENTATION.md](CRON_JOBS_IMPLEMENTATION.md)

---

## Summary

✅ **All cron jobs ready to deploy!**

Next command: Deploy Supabase migrations and restart your server.
