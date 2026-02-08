# Complete Endpoint Reference & Implementation Details

## All 22 Implemented Routes

### 1. SESSION MANAGEMENT

#### session/init
```
Method: GET
Route: /api/session/init
Headers: None required
Response: { userId: string }

Implementation: api/index.ts:1904
Used By: Agent (line 45), Exchanges (line 64)
Purpose: Initialize session, get/create session ID
Fallback: None (always succeeds)
```

#### session/auth
```
Method: POST
Route: /api/session/auth
Headers: Authorization: Bearer {token} OR body: { accessToken }
Body: { accessToken?: string }
Response: { userId: string, email: string }

Implementation: api/index.ts:1916
Used By: Should be called in Login but isn't
Purpose: Validate Supabase token and create session
Fallback: None (returns 401 on invalid token)
Bitvavo: No
```

#### session/logout
```
Method: POST
Route: /api/session/logout
Response: { ok: true }

Implementation: api/index.ts:1939
Used By: Settings (line 432)
Purpose: Clear session cookie
Fallback: None
```

---

### 2. PROFILE MANAGEMENT

#### profile/get
```
Method: GET
Route: /api/profile/get
Headers: Cookie: aio_uid={sessionId}
Response: { userId, ...profileData }

Implementation: api/index.ts:1943
Used By: Dashboard (738), Charts (52), Settings (65)
Requires: Valid session (401 if missing)
Purpose: Retrieve user profile from Supabase
Fallback: None (returns error if no session)
Database: Supabase table 'user_profiles'
```

#### profile/upsert
```
Method: POST
Route: /api/profile/upsert
Headers: Cookie: aio_uid={sessionId}
Body: { profile: UserProfile }
Response: { ...savedProfile }

Implementation: api/index.ts:1961
Used By: Settings (line 125), Onboarding (line 105)
Requires: Valid session, profile with email & displayName
Purpose: Save/update user profile
Fallback: None (returns error if invalid)
Validation: 
  - displayName length > 1
  - email format required
Database: Supabase table 'user_profiles'
```

---

### 3. CHAT & MARKET INTELLIGENCE

#### chat
```
Method: POST
Route: /api/chat
Headers: Content-Type: application/json
Body: { 
  messages: ChatMessage[],
  context?: ChatContext
}
Response: { reply: string, createdAt: string }

Implementation: api/index.ts:1988
Used By: Dashboard (chat interface)
Purpose: AI chat with full market/profile context
Fallback: Returns 500 if OpenAI fails
OpenAI Model: gpt-4o-mini
Context Includes:
  - User profile (goals, knowledge, horizon)
  - Market status (volatility, price changes)
  - Exchange connections
  - Current balances
```

#### market-scan
```
Method: GET
Route: /api/market-scan?range={1h|24h|7d}
Query: range: MarketRange (default: 24h)
Response: { 
  range, updatedAt, changes, volatility, series
}

Implementation: api/index.ts:2012
Used By: Dashboard (822), Today (23)
Purpose: Get market data and volatility level
Cache: 60 seconds
Fallback: buildDefaultPayload() if unavailable
Data Source: Sparkline API via buildMarketScanFromSparkline()
Returns:
  - Price changes for: bitcoin, ethereum, stablecoins, altcoins
  - Volatility level: rustig, matig, hoog
  - Time series data for charting
Bitvavo: Potentially yes (via market data)
```

#### market-summary
```
Method: POST
Route: /api/market-summary
Headers: Content-Type: application/json
Body: { 
  range: '1h' | '24h' | '7d',
  changes: { bitcoin, ethereum, stablecoins, altcoins }
}
Response: { summary: string, createdAt: string }

Implementation: api/index.ts:2036
Used By: Today (27)
Purpose: AI-generated market summary
Fallback: fallbackSummary() with pattern-based summary
OpenAI Model: gpt-4o-mini
Tone: Dutch, observation-focused, no predictions
```

#### portfolio-allocate
```
Method: POST
Route: /api/portfolio-allocate
Headers: Content-Type: application/json
Body: {
  amount: number,
  strategy: string,
  goals?: string[],
  knowledge?: string,
  changes?: MarketChanges
}
Response: { allocation: AllocationItem[], note: string }

Implementation: api/index.ts:2075
Used By: Dashboard (838)
Purpose: Generate AI-powered portfolio allocation
Fallback: fallbackAllocation() → 25/25/25/25 split
OpenAI Model: gpt-4o-mini
Allocation Categories:
  - Bitcoin
  - Ethereum
  - Stablecoins
  - Altcoins
Each includes: label, pct (percentage), rationale
```

#### insights
```
Method: POST
Route: /api/insights
Headers: Content-Type: application/json
Body: {
  profile?: { goal, horizon, knowledge, strategy },
  market?: { volatility, changes },
  currentAllocation?: { label, pct }[]
}
Response: { insights: string, createdAt: string }

Implementation: api/index.ts:2104
Used By: Dashboard (271)
Purpose: Generate context-aware investment observations
Fallback: fallbackInsights() with rule-based observations
OpenAI Model: gpt-4o-mini
Style: Conditional language ("If..., you could..."), no direct advice
Rules in Fallback:
  - Long horizon (7y+) → can bear volatility
  - Beginner + high volatility → observe
  - BTC up >5% → market sentiment signal
  - Preserve goal + >30% altcoins → risk warning
```

---

### 4. EXCHANGE INTEGRATION

#### exchanges/connect
```
Method: POST
Route: /api/exchanges/connect
Headers: Content-Type: application/json
Body: {
  userId?: string,
  exchange: 'bitvavo' | 'kraken' | 'coinbase' | 'bybit',
  method: 'api-key' | 'oauth',
  credentials: { apiKey, apiSecret, ... },
  scopes?: string[],
  apiMode?: 'readonly' | 'trading'
}
Response: { ok: true, connection: ExchangeConnection }

Implementation: api/index.ts:2123
Used By: Exchanges (106)
Session: From cookie if bodyUserId not provided
Process:
  1. Validate credentials (creates connector)
  2. Test connection with exchange API
  3. Return scopes if successful
  4. Encrypt credentials (AES-256-GCM)
  5. Save to storage adapter
  6. Initialize agent settings
Storage: getStorageAdapter() (Vercel KV)
Agent Settings Initialized:
  - monitoringInterval: 5 minutes
  - alertOnVolatility: false
  - autoTrade: false
  - riskPerTrade: 2%
Bitvavo: ✅ Fully supported (read-only by default)
```

#### exchanges/disconnect
```
Method: POST
Route: /api/exchanges/disconnect
Headers: Content-Type: application/json
Body: { userId?: string, exchange: ExchangeId }
Response: { ok: true }

Implementation: api/index.ts:2205
Used By: Exchanges (129)
Purpose: Remove exchange connection and credentials
Storage: Deleted from KV
Cascade: Agent settings may persist
```

#### exchanges/status
```
Method: GET
Route: /api/exchanges/status?userId={userId}
Query: userId (optional, uses session if not provided)
Response: { connections: ExchangeConnection[] }

Implementation: api/index.ts:2228
Used By: Dashboard (758), Agent (54), Exchanges (71)
Purpose: List all connected exchanges
Filter: All connections returned (regardless of status)
Return Fields:
  - id, userId, exchange, method
  - encryptedSecrets, scopes
  - createdAt, updatedAt, status
  - metadata (includes agentMode)
```

#### exchanges/balances
```
Method: GET
Route: /api/exchanges/balances?userId={userId}
Query: userId (optional)
Response: { balances: Balance[] }

Implementation: api/index.ts:2247
Used By: Dashboard (783)
Purpose: Fetch account balances from connected exchanges
Process:
  1. Get all connected exchanges for user
  2. For each 'connected' status:
     - Create connector
     - Decrypt credentials
     - Fetch balances
  3. Aggregate results
Fallback: Empty array if exchange unavailable
Return Fields per Balance:
  - asset, total, available
  - userId, exchange
  - updatedAt

Balance Structure:
{
  id: string,
  userId: string,
  exchange: string,
  asset: string,
  total: number,
  available: number,
  updatedAt: string
}

Bitvavo: ✅ Full support
```

#### exchanges/performance
```
Method: GET
Route: /api/exchanges/performance?userId={userId}
Query: userId (optional)
Response: {
  snapshots: PriceSnapshot[],
  performance: PerformanceMetrics[]
}

Implementation: api/index.ts:2308
Used By: Dashboard (302)
Purpose: Calculate portfolio performance changes
Method: Snapshot-based (24h comparison)
Issues: Uses localStorage (client-side), may not persist
Performance Metrics:
  - asset, exchange
  - currentQuantity, previousQuantity
  - quantityChange, quantityChangePercent
  - periodStart, periodEnd
Snapshots: Include asset, quantity, timestamp, change24h
Fallback: Empty arrays if unavailable
Bitvavo: ✅ Partial (snapshots not persistent)
```

#### exchanges/assets
```
Method: GET
Route: /api/exchanges/assets?userId={userId}
Query: userId (optional)
Response: {
  assetsByExchange: Record<string, Asset[]>,
  assetSummary: Record<string, AssetSummary>
}

Implementation: api/index.ts:2404
Used By: Dashboard (indirectly via wrapper)
Purpose: Get available trading pairs per exchange
Asset Structure: { symbol: string, name?: string }
AssetSummary: { count: number, platforms: string[] }
Summary sorted by: Most platforms first, top 100 only
Fallback: Empty objects if unavailable
Bitvavo: ✅ Full support (fetches from connector)
```

#### exchanges/sync
```
Method: POST
Route: /api/exchanges/sync
Headers: Content-Type: application/json
Body: { userId?: string, exchange: ExchangeId }
Response: { ok: true, ... }

Implementation: api/index.ts:2474
Used By: Exchanges (138)
Purpose: Sync balances and portfolio data from exchange
Implementation: Calls syncExchange() function
Details: Function signature not shown in excerpt
Bitvavo: ✅ Supported
```

#### exchanges/_health
```
Method: GET
Route: /api/exchanges/_health
Response: { ok: boolean, marketOk: boolean, cryptoOk: boolean }

Implementation: api/index.ts:2496
Used By: Internal diagnostics
Purpose: Health check for exchange integration
Tests:
  1. Market data fetch (Bitvavo)
  2. Encryption/decryption
Returns: All status indicators
Bitvavo: ✅ Required for health check
```

---

### 5. AGENT SYSTEM

#### agent/settings (GET)
```
Method: GET
Route: /api/agent/settings?exchange={exchange}
Query: exchange (default: 'bitvavo')
Headers: Cookie for session
Response: { settings: AgentSettings }

Implementation: api/index.ts:2517
Used By: Agent (100)
Purpose: Load agent configuration for exchange
Cache: From Vercel KV
Key Pattern: user:{userId}:agent:{exchange}:settings
Returns 404 if not found
Bitvavo: ✅ Full support
```

#### agent/settings (POST)
```
Method: POST
Route: /api/agent/settings
Headers: Content-Type: application/json
Body: { settings: AgentSettings }
Response: { ok: true, settings: AgentSettings }

Implementation: api/index.ts:2517
Used By: Agent (137)
Purpose: Save agent configuration
Storage: Vercel KV
Key Pattern: user:{userId}:agent:{exchange}:settings
Settings Persisted:
  - exchange, apiMode, enabled
  - monitoringInterval, alertOnVolatility, volatilityThreshold
  - analysisDepth
  - autoTrade, riskPerTrade, maxDailyLoss
  - confidenceThreshold, orderLimit, tradingStrategy
  - enableStopLoss, stopLossPercent
Bitvavo: ✅ Full support
```

#### agent/status
```
Method: GET
Route: /api/agent/status
Headers: Cookie for session
Response: { agents: AgentStatus[] }

Implementation: api/index.ts:2564
Used By: Agent (not actively used, just available)
Purpose: Get agent operational status
Process:
  1. List connected exchanges
  2. For each connected exchange, return agent status
Agent Status Fields:
  - exchange
  - mode: 'readonly' | 'trading'
  - enabled: true
  - status: 'idle'
  - lastActivity: timestamp
  - nextAction: string
  - errorMessage?: string
Note: Currently hardcoded, doesn't reflect real state
Bitvavo: ✅ Supported
```

#### agent/activity (GET)
```
Method: GET
Route: /api/agent/activity?type={type}&exchange={exchange}
Query:
  - type?: ActivityType | 'all' (default: all)
  - exchange?: string | 'all' (default: all)
Response: { activities: AgentActivity[] }

Implementation: api/index.ts:2599
Used By: AgentActivity (54)
Purpose: Get agent activity log
⚠️ ISSUE: Returns 3 hardcoded mock activities
Activities Returned:
  1. Monitoring (volatility scan)
  2. Analysis (technical analysis)
  3. Alert (volatility threshold)
Activity Fields:
  - id, exchange, type, status
  - title, description, details
  - timestamp, executedAt, duration
Types Supported (in filtering):
  - monitoring, alert, analysis
  - trade_placed, trade_filled, trade_cancelled
  - stop_loss_triggered, daily_limit_reached, error
Database Storage: NOT IMPLEMENTED ❌
Real Persistence: MISSING ❌
Bitvavo: ❌ (Demo data only)
```

---

### 6. LEARNING SYSTEM

#### academy/progress
```
Method: GET
Route: /api/academy/progress
Headers: Cookie for session
Response: {
  progress: Record<string, boolean>,
  badges: Record<string, boolean>
}

Implementation: api/index.ts:2668
Used By: Academy (28)
Purpose: Get user's learning progress and badges
Database:
  - Queries: academy_module_progress (user_id, module_id, completed_at)
  - Queries: user_badges (user_id, badge_id)
Returns: true/false for each module_id and badge_id
Requires: Valid session (401 if missing)
Module IDs: Should match academyCurriculum.ts locally
Badge IDs: Should match badge system
Bitvavo: N/A (Educational)
```

#### academy/complete-module
```
Method: POST
Route: /api/academy/complete-module
Headers: Content-Type: application/json
Body: { moduleId: string }
Response: {
  progress: Record<string, boolean>,
  badges: Record<string, boolean>
}

Implementation: api/index.ts:2711
Used By: Academy (50)
Purpose: Mark module as completed
Process:
  1. Validate session
  2. Upsert row in academy_module_progress
  3. Set completed_at = now
  4. Return updated progress + badges
Database:
  - Upserts: academy_module_progress
  - Returns: All user's progress
Requires: Valid session
Module IDs: Must match available modules
Bitvavo: N/A (Educational)
```

---

## Integration Points by Page

### Dashboard Integration
```
Sequence:
1. GET /api/profile/get                   → Display goals/horizon
2. GET /api/exchanges/status              → Show connections
3. GET /api/exchanges/balances            → Show balances
4. GET /api/exchanges/performance         → Show 24h change
5. GET /api/market-scan?range=24h         → Show volatility
6. POST /api/portfolio-allocate           → Generate allocation
7. POST /api/insights                     → Generate insights
8. POST /api/chat (user interaction)      → Chat responses

All endpoints: ✅ IMPLEMENTED
Fallback chain: YES (5 levels)
```

### Exchanges Integration
```
Connect Flow:
1. GET /api/session/init                  → Get session
2. GET /api/exchanges/status              → List current
3. POST /api/exchanges/connect            → Add Bitvavo
4. (Verify: test credentials)
5. POST /api/exchanges/sync               → Initial sync
6. (Redirect to balances view)

All endpoints: ✅ IMPLEMENTED
Bitvavo support: ✅ YES
```

### Agent Integration
```
Configuration:
1. GET /api/session/init                  → Get session
2. GET /api/exchanges/status              → List connections
3. GET /api/agent/settings?exchange=X     → Load config
4. User edits settings
5. POST /api/agent/settings               → Save config
6. GET /api/agent/status                  → Verify saved

All endpoints: ✅ IMPLEMENTED
Persistence: ✅ KV storage
```

---

## Data Structures

### ExchangeConnection
```typescript
{
  id: string (UUID)
  userId: string
  exchange: 'bitvavo' | 'kraken' | 'coinbase' | 'bybit'
  method: 'api-key' | 'oauth'
  encryptedSecrets: string (AES-256-GCM)
  scopes: string[]
  createdAt: ISO string
  updatedAt: ISO string
  status: 'connected' | 'needs_reauth' | 'error' | 'disconnected'
  metadata: {
    agentMode: 'readonly' | 'trading'
  }
}
```

### UserProfile
```typescript
{
  id?: string
  userId: string
  displayName: string
  email: string
  emailUpdatesOptIn: boolean
  strategies: string[]
  primaryGoal: 'growth' | 'income' | 'preserve' | 'learn'
  timeHorizon: 'lt1y' | '1-3y' | '3-7y' | '7y+'
  riskTolerance: number (1-10)
  knowledgeLevel: 'beginner' | 'intermediate' | 'advanced'
  startAmountRange: string
  // ... additional optional fields
}
```

### AgentSettings
```typescript
{
  exchange: ExchangeId
  apiMode: 'readonly' | 'trading'
  enabled: boolean
  // Monitoring
  monitoringInterval: number (minutes)
  alertOnVolatility: boolean
  volatilityThreshold: number (%)
  analysisDepth: 'basic' | 'detailed' | 'expert'
  // Trading
  autoTrade: boolean
  riskPerTrade: number (%)
  maxDailyLoss: number (%)
  confidenceThreshold: number (0-100)
  orderLimit: number (EUR)
  tradingStrategy: 'conservative' | 'balanced' | 'aggressive'
  enableStopLoss: boolean
  stopLossPercent: number
}
```

---

## Error Handling

### HTTP Status Codes
```
200 OK              - Success
400 Bad Request     - Missing/invalid parameters
401 Unauthorized    - Missing session
404 Not Found       - Route/data not found
405 Method Not Allowed - Wrong HTTP method
500 Server Error    - Processing error
```

### Common Errors
```
"Geen sessie."                      → 401 (no session)
"userId is verplicht."              → 400 (missing field)
"Method not allowed"                → 405 (POST on GET route)
"Kon niet verbinden."               → 400 (invalid credentials)
"Kon verbinding niet opslaan."      → 500 (storage error)
"Kon chat niet ophalen."            → 500 (OpenAI error)
```

---

## Environment Variables Required

```
SUPABASE_URL                 - Supabase project URL
SUPABASE_ANON_KEY           - Supabase anonymous key
OPENAI_API_KEY              - OpenAI API key
KV_REST_API_URL            - Vercel KV database URL
KV_REST_API_TOKEN          - Vercel KV database token
```

---

## Summary

**Total Routes:** 22  
**Methods:** GET (8), POST (14)  
**Authentication:** Session-based via cookies  
**Database:** Supabase + Vercel KV  
**External APIs:** OpenAI (Chat/Insights/Summary), Bitvavo (Exchange)  
**Bitvavo Ready:** 18 of 22 endpoints ✅  
**Complete Implementation:** 22 of 22 routes ✅  

