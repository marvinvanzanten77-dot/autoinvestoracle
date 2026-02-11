# Agent Status Control System

## Overview

Het agent kan nu in **3 modi** werken:

| Mode | Cron Job Runs | Observations | Suggestions | Use Case |
|------|---|---|---|---|
| **Running** ✅ | Yes | Yes | Yes | Full autonomous mode |
| **Paused** ⏸️ | Yes | Yes | No | Observation mode only |
| **Offline** ⛔ | No | No | No | Completely inactive |

## How It Works

### Agent Lifecycle

```
User toggles status via UI
    ↓
API endpoint updates database (profiles.agent_status)
    ↓
Activity log entry created (agent_activity_log)
    ↓
Cron job checks status before processing
    ↓
If status = 'running': Generate observations + suggestions
If status = 'paused': Generate observations only
If status = 'offline': Skip entirely
```

### Database Schema

#### `profiles` table additions
```sql
agent_status: 'running' | 'paused' | 'offline' (DEFAULT 'running')
agent_status_changed_at: TIMESTAMP
```

#### `agent_activity_log` table
```sql
id: UUID
user_id: UUID
previous_status: TEXT
new_status: TEXT
reason: TEXT
changed_at: TIMESTAMP
changed_by: TEXT ('user' | 'system' | 'auto')
```

## API Endpoints

### Get Agent Status
```bash
GET /api/agent-status?userId=<uuid>
```
Response:
```json
{
  "status": "success",
  "data": {
    "agentStatus": "running"
  }
}
```

### Set Agent Status
```bash
PUT /api/agent-status?userId=<uuid>
Content-Type: application/json

{
  "newStatus": "paused",
  "reason": "User paused for manual intervention"
}
```
Response:
```json
{
  "status": "success",
  "data": {
    "agentStatus": "paused",
    "action": "set"
  }
}
```

### Toggle Agent Status
```bash
PUT /api/agent-status?userId=<uuid>&action=toggle
Content-Type: application/json

{}
```

### Get Activity Log
```bash
GET /api/agent-status?userId=<uuid>&action=activity-log&limit=10
```
Response:
```json
{
  "status": "success",
  "data": [
    {
      "id": "uuid",
      "previous_status": "running",
      "new_status": "paused",
      "reason": "User paused for manual intervention",
      "changed_at": "2026-02-12T15:30:00Z",
      "changed_by": "user"
    }
  ]
}
```

## UI Component Usage

### Import AgentActivityWidget
```tsx
import { AgentActivityWidget } from '@/components/AgentActivityWidget';

export function Dashboard() {
  const userId = userContext.userId; // Your auth context
  
  return (
    <div>
      <h1>Dashboard</h1>
      <AgentActivityWidget userId={userId} />
    </div>
  );
}
```

### Component Features

The widget displays:

1. **Status Badge** (top right)
   - 🟢 Green: Running
   - 🟡 Yellow: Paused
   - 🔴 Red: Offline

2. **Control Buttons**
   - **Run**: Switch to running mode
   - **Pause**: Switch to paused mode (observations only)
   - **Offline**: Completely disable agent

3. **Quick Toggle**
   - One-click between Running ↔ Paused

4. **Activity Log**
   - Shows recent status changes
   - Timestamps and reasons
   - Refresh button

5. **Info Box**
   - Explains what each mode does

## Mode Behaviors

### Running Mode ✅
- Hourly cron job executes
- Generates observations (SELL, REBALANCE, STOP-LOSS)
- Generates action suggestions
- Creates hourly reports
- Sends notifications if needed

**Command in cron job:**
```typescript
// Query with: .eq('agent_status', 'running')
```

### Paused Mode ⏸️
- Hourly cron job executes (skips this user)
- No observations generated
- No suggestions generated
- No reports created
- No notifications sent

**Use case:** You want to review previous suggestions before agent resumes

### Offline Mode ⛔
- Hourly cron job skips entirely
- Database query filters out this user
- Zero processing

**Use case:** Maintenance, testing, or long-term pause

## Database Setup

Run this SQL in Supabase:

```sql
-- From src/sql/agent_status_schema.sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS agent_status TEXT DEFAULT 'running' CHECK (agent_status IN ('running', 'paused', 'offline'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS agent_status_changed_at TIMESTAMP DEFAULT NOW();

CREATE TABLE IF NOT EXISTS agent_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  previous_status TEXT NOT NULL,
  new_status TEXT NOT NULL CHECK (new_status IN ('running', 'paused', 'offline')),
  reason TEXT,
  changed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  changed_by TEXT DEFAULT 'user',
  CONSTRAINT status_transition_log UNIQUE (user_id, changed_at)
);

CREATE INDEX idx_profiles_agent_status ON profiles(agent_status);
CREATE INDEX idx_agent_activity_log_user_id ON agent_activity_log(user_id);
CREATE INDEX idx_agent_activity_log_changed_at ON agent_activity_log(changed_at DESC);

ALTER TABLE agent_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see own activity log" ON agent_activity_log
  FOR SELECT USING (auth.uid()::text = user_id::text);
```

## Cron Job Behavior

The `portfolio-check` cron job now:

1. **Checks agent status** before processing
```typescript
.eq('agent_status', 'running')
.not('portfolio_data', 'is', null)
```

2. **Skips paused/offline users** entirely
3. **Logs paused users** in summary
4. **Returns report** with counts

Sample response:
```json
{
  "status": "success",
  "processed": 3,
  "paused": 2,
  "observationsGenerated": 5,
  "reportsGenerated": 3
}
```

## Handler Functions

### `src/server/handlers/agentStatus.ts`

```typescript
// Get current status
const status = await getAgentStatus(userId); // Returns: 'running' | 'paused' | 'offline'

// Set specific status
await setAgentStatus(userId, 'paused', 'User manual pause');

// Toggle between running and paused
const newStatus = await toggleAgentStatus(userId);

// Get activity log
const log = await getActivityLog(userId, 20);

// Check if agent should run (in cron job)
const shouldRun = await shouldRunAgent(userId);
```

## Integration Checklist

- [x] Database schema created
- [x] API endpoints created
- [x] Handler functions created
- [x] UI component created
- [x] Cron job updated to check status
- [ ] Component integrated in Dashboard
- [ ] Test pause/offline modes
- [ ] Test activity log recording

## Testing

### Test Pause Mode
1. Click "Pause" button in AgentActivityWidget
2. Check that agent_status = 'paused' in database
3. Next cron run should skip this user
4. Check that no new reports are generated

### Test Offline Mode
1. Click "Offline" button
2. Check that agent_status = 'offline'
3. Verify activity log shows transition
4. Next cron run should skip user entirely

### Test Toggle
1. Click "Quick Pause" (when running)
2. Status should change to paused
3. Click "Quick Start"
4. Status should change back to running

## Next Steps

1. Integrate AgentActivityWidget into Dashboard
2. Test all three modes
3. Monitor cron logs for status checks
4. Consider adding auto-pause on errors (future enhancement)
5. Add mode-specific logging levels (debug, verbose)
