# Database Migrations Guide

## Issue: `relation "profiles" does not exist`

### Problem
When running `agent_reports_schema.sql`, you might get an error:
```
ERROR: 42P01: relation "profiles" does not exist
```

This happens because:
1. The SQL file references `profiles` table with foreign keys
2. If profiles doesn't exist, the migration fails
3. Or profiles exists with a different schema

### Solution

**Use this safe migration file instead:**

```bash
src/sql/migrations_complete_schema.sql
```

This file:
- ✅ Creates `profiles` table if it doesn't exist
- ✅ Adds `agent_status` fields safely with `IF NOT EXISTS`
- ✅ Creates all related tables (agent_reports, notifications, etc.)
- ✅ Drops and recreates RLS policies (prevents conflicts)
- ✅ Is idempotent (safe to run multiple times)

## Migration Order

### Option 1: Run Everything at Once
```sql
-- Copy & paste entire migrations_complete_schema.sql into Supabase SQL editor
```

### Option 2: Run Step by Step

1. **Create base tables:**
```sql
CREATE TABLE IF NOT EXISTS profiles (
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT,
  full_name TEXT,
  portfolio_data JSONB DEFAULT '[]',
  agent_status TEXT DEFAULT 'running',
  agent_status_changed_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

2. **Add agent reporting:**
```sql
-- Run: src/sql/agent_reports_schema.sql
```

3. **Add agent status control:**
```sql
-- Run: src/sql/agent_status_schema.sql
```

## What Each File Does

| File | Purpose | Depends On | Safe to Re-run |
|------|---------|-----------|---|
| `migrations_complete_schema.sql` | Complete setup (RECOMMENDED) | Nothing | ✅ Yes |
| `agent_reports_schema.sql` | Agent reports + notifications | profiles table | ⚠️ No (will fail if profiles missing) |
| `agent_status_schema.sql` | Agent status control | profiles table | ✅ Yes (uses IF NOT EXISTS) |
| `academy_schema.sql` | Academy module tracking | Nothing | ✅ Yes |

## Testing Your Migration

After running the migration:

```sql
-- Check all tables exist
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('profiles', 'agent_reports', 'notifications', 'agent_activity_log', 'market_observations');

-- Should return 5 rows

-- Check agent_status column exists
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'profiles' AND column_name = 'agent_status';

-- Should return 1 row
```

## Troubleshooting

### Error: `relation "profiles" does not exist`
**Solution:** Run `migrations_complete_schema.sql` instead

### Error: `column "agent_status" already exists`
**Solution:** Safe - the migration uses `IF NOT EXISTS`

### Error: `policy already exists`
**Solution:** The migration drops and recreates policies - this is intentional

### Error: `function gen_random_uuid() does not exist`
**Solution:** Enable the `pgcrypto` extension:
```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

Then run migration again.

## Database Schema Overview

```
profiles (base)
├── agent_reports (hourly agent reports)
├── notifications (user alerts)
├── agent_activity_log (status change history)
└── market_observations (market scans)
```

### Key Tables

**profiles**
- user_id (PK)
- agent_status: 'running' | 'paused' | 'offline'
- portfolio_data: JSON
- agent_status_changed_at: timestamp

**agent_reports**
- id (PK)
- user_id (FK to profiles)
- observations: JSONB[]
- suggestions: JSONB[]
- agent_mood: 'bullish' | 'bearish' | 'cautious'

**notifications**
- id (PK)
- user_id (FK to profiles)
- type: 'agent-report' | 'action-executed' | 'alert' | 'info'
- read: boolean
- dismissed: boolean

**agent_activity_log**
- id (PK)
- user_id (FK to profiles)
- previous_status → new_status
- changed_at: timestamp
- reason: text

**market_observations**
- id (PK)
- user_id (FK to profiles)
- observed_behavior: text
- agent_mood: text
- timestamp: timestamp

## RLS (Row-Level Security)

All tables have RLS enabled with this policy:
```sql
-- Users can only see their own data
FOR SELECT USING (auth.uid()::text = user_id::text)
```

This means:
- User with auth.uid() = 'abc123' can only see rows where user_id = 'abc123'
- Cannot see other users' data
- Backend API must verify auth

## Next Steps

1. ✅ Run `migrations_complete_schema.sql`
2. ✅ Verify tables exist
3. ✅ Test API endpoints
4. ✅ Integrate UI components

## Support

If you still get errors:
1. Check Supabase logs
2. Verify auth is enabled
3. Try running `migrations_complete_schema.sql` again
4. Check that no manual schema changes conflict
