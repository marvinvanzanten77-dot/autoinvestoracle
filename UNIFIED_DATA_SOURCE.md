# 🔗 UNIFIED DATA SOURCE SYSTEM

## Overview

All Agent tabs and ChatGPT chat now share a **single source of truth** for market data, user preferences, and system state.

This eliminates data synchronization issues and ensures consistent decision-making across all interfaces.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│          UNIFIED CONTEXT SERVICE                         │
│     (Single Source of Truth)                             │
├─────────────────────────────────────────────────────────┤
│ • User Profile & Settings                               │
│ • Market Data (real-time + historical)                  │
│ • Exchange Connections                                  │
│ • Trading History & Performance                         │
│ • Agent State                                           │
│ • Data Sources Index (always available)                 │
└─────────────────────────────────────────────────────────┘
         ↑                          ↑
         │                          │
    ┌────┴────────────────────────┴────┐
    │                                   │
    ▼                                   ▼
┌─────────────┐              ┌──────────────────┐
│   AGENT     │              │  CHATGPT CHAT    │
│  (all tabs) │              │   FUNCTION       │
├─────────────┤              ├──────────────────┤
│ • Readonly  │              │ • Market context │
│ • Analysis  │              │ • User settings  │
│ • Alerts    │              │ • Data sources   │
│ • Monitoring│              │ • Updates        │
└─────────────┘              └──────────────────┘
```

---

## Core Components

### 1. Unified Context Service
**File:** `src/lib/unifiedContextService.ts`

Provides complete user and market context:

```typescript
// Build complete context for a user
const context = await buildUnifiedContextWithCache(userId, sessionId);

// Access from agent
const agentContext = getAgentContext(context);

// Access for dashboard
const marketSnapshot = getMarketSnapshot(context);

// Get available resources
const resources = getAvailableResources(context);
```

**Data Includes:**
- User profile (goals, knowledge, risk level)
- Notifications preferences
- Real-time market data (prices, volatility, sentiment)
- Historical data (30-day trends, win rates, patterns)
- Exchange connections & balances
- Trading performance metrics
- Data sources registry (always available)

**Caching:** 5-minute TTL prevents excessive API calls

---

### 2. Chat Settings Manager
**File:** `src/lib/chatSettingsManager.ts`

Allows ChatGPT chat to update user settings via natural language:

```typescript
// Parse user intent from chat message
const update = parseSettingsIntent(message, context);

// Execute the update
const result = await executeSettingsUpdate(userId, update);
```

**Supported Commands:**
- `update_risk_level` - "Set my risk to aggressive"
- `update_scan_interval` - "Scan every 6 hours"
- `update_strategy` - "New strategy: grid trading"
- `toggle_notifications` - "Disable email alerts"
- `update_position_size` - "Max 10% per trade"
- `update_loss_limit` - "Stop if loss reaches 5%"

**Example Conversation:**
```
User: "Ik wil veiliger traden, kun je mijn risicoprofiel naar voorzichtig zetten?"

Agent: "Wil je dit echt veranderen?
Risicoprofiel wijzigen naar voorzichtig:
- Voorzichtig: 10% max per positie, conservatieve strategieën

Reply met 'ja' om te bevestigen."

User: "ja"

Agent: "✅ Risicoprofiel bijgewerkt naar: voorzichtig"
```

---

### 3. Market Scan Scheduler
**File:** `src/lib/marketScanScheduler.ts`

Automatically triggers market scans based on user preferences:

```typescript
// Initialize scheduler with user's preference
await initializeScanScheduler(userId, '6h'); // 6-hourly scans

// Manually trigger (always available)
const result = await triggerMarketScan(userId, 'bitvavo');

// Get recommendations for chat
const recommendations = getScanRecommendations(userId);

// Get next scan time
const nextScan = getNextScanTime(userId, '6h');
```

**Scan Intervals:**
- `manual` - Only on user request
- `1h` - Every hour
- `6h` - Every 6 hours
- `24h` - Every 24 hours

**Scan Results Include:**
- Volatility score (0-100)
- Sentiment score (0-100)
- Top opportunities (buy/sell/hold signals)
- Risk warnings
- Market observations

---

## Data Flow Examples

### Agent Decision-Making

```
Agent Request
    ↓
buildUnifiedContext(userId, sessionId)
    ↓ Fetch in parallel:
    ├─ User profile & preferences (Supabase)
    ├─ Market data (CoinGecko, Fred, Fear & Greed)
    ├─ Exchange connections (API)
    ├─ Trading performance (execution_outcomes table)
    └─ Agent state (agent_activities table)
    ↓
getAgentContext(context)
    ↓
Agent makes decision with complete market awareness
    ↓
Cache (5 minutes)
```

### ChatGPT Chat with Settings Update

```
User Message: "Verhoog mijn scan frequentie naar 1 uur"
    ↓
buildUnifiedContext(userId, sessionId)
    ↓
parseSettingsIntent(message, context)
    → {command: 'update_scan_interval', parameters: {marketScanInterval: '1h'}}
    ↓
executeSettingsUpdate(userId, update)
    ↓ POST /api/user/scan-interval
    ↓
initializeScanScheduler(userId, '1h')
    ↓
Response: "✅ Marktscans ingesteld op: 1h"
```

### Market Scan Triggered

```
Every 6 hours (user preference):
    ↓
triggerMarketScan(userId, 'bitvavo')
    ↓ POST /api/trading/scan/now
    ↓
Analyze opportunities, volatility, sentiment
    ↓
Store result in scanHistory
    ↓
clearContextCache(userId) - Force refresh
    ↓
Next buildUnifiedContext includes fresh scan data
```

---

## Data Sources Registry

Always available to Agent and ChatGPT:

```typescript
{
  market: {
    realtime: ['CoinGecko API', 'Fred.StLouis', 'Fear & Greed Index', 'Bitvavo'],
    historical: ['execution_outcomes', 'agent_activities', 'pattern_learning tables'],
    predictions: ['Technical analysis', 'Volatility trends', 'Sentiment analysis']
  },
  education: {
    strategies: ['DCA', 'Grid Trading', 'Momentum Trading', 'Buy & Hold'],
    riskManagement: ['Position sizing', 'Stop loss', 'Daily limits', 'Rebalancing'],
    technicalAnalysis: ['Support/Resistance', 'Trends', 'Momentum', 'Volume']
  },
  resources: {
    settings: ['Risk profile', 'Max position size', 'Daily loss limit', 'Assets'],
    preferences: ['Email notifications', 'Alert frequency', 'Digest schedule', 'Scan intervals'],
    notifications: ['Execution alerts', 'Volatility warnings', 'Daily summaries', 'Pattern discoveries']
  }
}
```

---

## API Integration Points

### Agent Accessing Unified Context

```typescript
import { buildUnifiedContextWithCache, getAgentContext } from '@/lib/unifiedContextService';

const context = await buildUnifiedContextWithCache(userId, sessionId);
const agentCtx = getAgentContext(context);

// Now agent has:
// - User risk profile
// - Current market conditions
// - Trading history & patterns
// - Portfolio balances
```

### ChatGPT Chat with Full Awareness

```typescript
// Chat sends unified context to OpenAI
const resp = await fetch('/api/chat', {
  method: 'POST',
  body: JSON.stringify({
    messages,
    context: {
      profile: unifiedContext.profile,
      market: unifiedContext.market,
      exchanges: unifiedContext.exchanges,
      trading: unifiedContext.trading,
      dataSources: unifiedContext.dataSources
    }
  })
});
```

### Settings Updates via Chat

```typescript
// ChatGPT can update any user setting
const update = parseSettingsIntent(userMessage, context);
const result = await executeSettingsUpdate(userId, update);

// Automatically triggers scheduler reinitialization if needed
// Clears cache for fresh data
```

---

## Benefits

✅ **Single Source of Truth**
- No data duplication or conflicts
- Always synchronized

✅ **Complete Market Awareness**
- Real-time prices + historical trends
- Volatility + sentiment analysis
- Technical patterns + predictions
- All available to both agent and chat

✅ **Settings Management via Chat**
- User can update preferences naturally
- "Change my scan to hourly" → automatically configured
- No need for settings UI
- Changes instantly reflected

✅ **Automatic Scanning**
- Respects user preference
- Can be triggered manually anytime
- Results feed back into context
- Agent stays informed

✅ **Data Resources Always Available**
- Both agent and chat know what data they can access
- Educational resources reference available
- Transparent about data quality

---

## Configuration

### Initialize All Systems

```typescript
// On server startup:
import { initializeAllScanSchedulers } from '@/lib/marketScanScheduler';

const userConfigs = [
  { userId: 'user1', interval: '1h', isActive: true },
  { userId: 'user2', interval: 'manual', isActive: false },
  // ...
];

await initializeAllScanSchedulers(userConfigs);
```

### Cleanup

```typescript
// On server shutdown:
import { stopAllScanSchedulers } from '@/lib/marketScanScheduler';

stopAllScanSchedulers();
```

---

## Performance Optimizations

1. **Context Caching (5 minutes)**
   - Prevents repeated API calls
   - Cache cleared after updates
   - Manual refresh available

2. **Parallel Data Fetching**
   - All profile/market/exchange data fetched simultaneously
   - Promise.allSettled ensures robustness

3. **Selective Updates**
   - Chat settings changes only update affected subsystems
   - Scan scheduler reinitialization only when interval changes

4. **Error Resilience**
   - Missing data sources don't block operations
   - Fallback defaults available
   - Graceful degradation

---

## Files Created

1. **src/lib/unifiedContextService.ts** (400+ lines)
   - Complete context building
   - Data aggregation from all sources
   - Caching mechanism
   - Helper functions

2. **src/lib/chatSettingsManager.ts** (300+ lines)
   - Intent parsing from natural language
   - Settings command execution
   - Confirmation flow
   - Success messages

3. **src/lib/marketScanScheduler.ts** (350+ lines)
   - Automatic scan scheduling
   - Manual scan triggering
   - Result tracking
   - Recommendations generation

4. **src/components/AgentChat.tsx** (Updated)
   - Integrated unified context
   - Settings update support
   - Market scan integration
   - Full OpenAI context awareness

---

## Next Steps

1. ✅ Deploy unified context service
2. ✅ Integrate with agent tabs
3. ✅ Enable ChatGPT settings management
4. ✅ Automatic market scanning
5. Monitor cache hit rates
6. Gather user feedback
7. Optimize scan intervals based on usage
8. Add pattern learning to recommendations

---

## Documentation

- **Implementation:** [src/lib/unifiedContextService.ts](src/lib/unifiedContextService.ts)
- **Settings:** [src/lib/chatSettingsManager.ts](src/lib/chatSettingsManager.ts)
- **Scans:** [src/lib/marketScanScheduler.ts](src/lib/marketScanScheduler.ts)
- **Chat Integration:** [src/components/AgentChat.tsx](src/components/AgentChat.tsx)
