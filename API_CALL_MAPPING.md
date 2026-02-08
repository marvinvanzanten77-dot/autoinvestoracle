# API Call to Endpoint Mapping

## Dashboard Page
**File:** [src/pages/Dashboard.tsx](src/pages/Dashboard.tsx)

### Import Statements (API Wrappers)
```typescript
import { fetchMarketScan, type MarketScanResponse } from '../api/marketScan';
import { fetchPortfolioAllocation, type PortfolioAllocationResponse } from '../api/portfolioAllocate';
import { fetchInsights, type InsightInput } from '../api/chat';
import { fetchBalances, fetchPerformance, type Balance } from '../api/exchanges';
import { sendChatMessage, type ChatContext, type ChatMessage } from '../api/chat';
```

### API Calls & Endpoints
| Call Location | Method | Endpoint | Status | Fallback |
|---|---|---|---|---|
| Line 738 | GET | `/api/profile/get` | ✅ | N/A |
| Line 758 | GET | `/api/exchanges/status` | ✅ | N/A |
| Line 783 | GET | `/api/exchanges/balances` | ✅ | Empty array |
| Line 302 | GET | `/api/exchanges/performance` | ✅ | `{ snapshots: [], performance: [] }` |
| Line 822 | GET | `/api/market-scan?range=24h` | ✅ | `buildDefaultPayload()` |
| Line 838 | POST | `/api/portfolio-allocate` | ✅ | `fallbackAllocation()` |
| Line 271 | POST | `/api/insights` | ✅ | `fallbackInsights()` |
| Line ~90 | POST | `/api/chat` | ✅ | Returns error, UI shows message |

### Required for Full Functionality
- ✅ All endpoints exist and are implemented
- ✅ All calls have proper fallback handling
- ✅ Chat context includes profile + market + exchange data

**Verdict: ✅ FULLY FUNCTIONAL**

---

## Today Page
**File:** [src/pages/Today.tsx](src/pages/Today.tsx)

### API Calls & Endpoints
| Call | Method | Endpoint | Status | Fallback |
|---|---|---|---|---|
| Line 23 | GET | `/api/market-scan?range={targetRange}` | ✅ | `buildDefaultPayload()` |
| Line 27 | POST | `/api/market-summary` | ✅ | `fallbackSummary()` |

### Required but Missing
- ❌ `/api/daily-report` - Not required for current view
- ✅ Fallbacks ensure page works without backend

**Verdict: ✅ FUNCTIONAL (95%)**

---

## Charts Page
**File:** [src/pages/Charts.tsx](src/pages/Charts.tsx)

### API Calls & Endpoints
| Call | Method | Endpoint | Status | Notes |
|---|---|---|---|---|
| Line 52 | GET | `/api/profile/get` | ✅ | Optional, not required |

### Data Source
- ✅ Client-side: `platforms.ts` (Bitvavo, Kraken, Coinbase, Bybit)
- ✅ No backend dependency for core functionality
- ✅ Profile fetch provides personalization only

**Verdict: ✅ FUNCTIONAL**

---

## Exchanges Page
**File:** [src/pages/Exchanges.tsx](src/pages/Exchanges.tsx)

### API Calls & Endpoints
| Call | Method | Endpoint | Status | Purpose |
|---|---|---|---|---|
| Line 64 | GET | `/api/session/init` | ✅ | Get session ID |
| Line 71 | GET | `/api/exchanges/status?userId={id}` | ✅ | List connections |
| Line 106 | POST | `/api/exchanges/connect` | ✅ | Connect Bitvavo |
| Line 129 | POST | `/api/exchanges/disconnect` | ✅ | Remove connection |
| Line 138 | POST | `/api/exchanges/sync` | ✅ | Sync data |

### Required but Missing
- ❌ `/api/exchanges/trade` - No order placement endpoint
- ⚠️ Only read-only mode fully supported
- ✅ Connection management complete

**Verdict: ⚠️ PARTIALLY FUNCTIONAL (90%)**
- Read-only works perfectly
- Trading not exposed
- No order placement possible from frontend

---

## Agent Page
**File:** [src/pages/Agent.tsx](src/pages/Agent.tsx)

### API Calls & Endpoints
| Call | Method | Endpoint | Status | Purpose |
|---|---|---|---|---|
| Line 45 | GET | `/api/session/init` | ✅ | Initialize |
| Line 54 | GET | `/api/exchanges/status?userId={id}` | ✅ | List connections |
| Line 100 | GET | `/api/agent/settings?exchange={exchange}` | ✅ | Load settings |
| Line 137 | POST | `/api/agent/settings` | ✅ | Save settings |

### Default Settings
If no settings found, uses hardcoded defaults:
```typescript
{
  enabled: true,
  monitoringInterval: 5,
  alertOnVolatility: false,
  volatilityThreshold: 5,
  analysisDepth: 'basic',
  autoTrade: false,
  riskPerTrade: 2,
  maxDailyLoss: 5,
  confidenceThreshold: 70,
  orderLimit: 100,
  tradingStrategy: 'balanced',
  enableStopLoss: false,
  stopLossPercent: 5
}
```

**Verdict: ✅ FULLY FUNCTIONAL**

---

## AgentActivity Page
**File:** [src/pages/AgentActivity.tsx](src/pages/AgentActivity.tsx)

### API Calls & Endpoints
| Call | Method | Endpoint | Status | Notes |
|---|---|---|---|---|
| Line 54 | GET | `/api/agent/activity?type={type}&exchange={exchange}` | ⚠️ | Returns mock data |

### Mock Data Structure
Backend returns 3 hardcoded demo activities:
```typescript
{
  id: '1',
  exchange: 'bitvavo',
  type: 'monitoring',
  status: 'success',
  title: 'Monitoring aktief',
  description: 'Agent scant markt op volatiiliteit',
  details: { volatility: 2.3, priceChange: '-0.5%' },
  timestamp: '...',
  executedAt: '...',
  duration: 1000
}
```

### Required but Missing
- 🔴 **Real activity persistence** - Currently hardcoded, should come from database
- 🔴 **Activity history** - No old activities stored
- 🔴 **Real agent execution** - Activities are for demonstration only

**Verdict: ⚠️ PARTIALLY FUNCTIONAL**
- UI works perfectly
- Data is fake demo data
- Endpoint exists but doesn't reflect real agent operations

---

## Settings Page
**File:** [src/pages/Settings.tsx](src/pages/Settings.tsx)

### API Calls & Endpoints
| Call | Method | Endpoint | Status | Purpose |
|---|---|---|---|---|
| Line 65 | GET | `/api/profile/get` | ✅ | Load profile |
| Line 125 | POST | `/api/profile/upsert` | ✅ | Save changes |
| Line 432 | POST | `/api/session/logout` | ✅ | Logout |

### Profile Fields Managed
```typescript
{
  displayName: string,
  email: string,
  emailUpdatesOptIn: boolean,
  strategies: string[],
  primaryGoal: 'growth' | 'income' | 'preserve' | 'learn',
  timeHorizon: '1-3y' | '3-7y' | '7y+' | 'lt1y',
  riskTolerance: number,
  knowledgeLevel: 'beginner' | 'intermediate' | 'advanced',
  // ... many more optional fields
}
```

**Verdict: ✅ FULLY FUNCTIONAL**

---

## Academy Page
**File:** [src/pages/Academy.tsx](src/pages/Academy.tsx)

### API Calls & Endpoints
| Call | Method | Endpoint | Status | Purpose |
|---|---|---|---|---|
| Line 28 | GET | `/api/academy/progress` | ✅ | Load progress |
| Line 50 | POST | `/api/academy/complete-module` | ✅ | Mark done |

### Required but Missing
- 🔴 `/api/academy/modules` - List modules from backend
- 🔴 `/api/academy/module/{id}` - Get module content
- 🔴 `/api/academy/badges` - Badge definitions
- ⚠️ Module definitions hardcoded in `academyCurriculum.ts`
- ⚠️ Badge logic not automated

### Current Flow
1. Frontend has 30+ modules defined locally
2. Backend stores completion in Supabase
3. No module content delivery from backend
4. Badge awarding is manual (no automation)

**Verdict: ⚠️ PARTIALLY FUNCTIONAL (70%)**
- Progress tracking works
- Module completion recorded
- But: No backend module definitions
- But: No badge automation

---

## Login Page
**File:** [src/pages/Login.tsx](src/pages/Login.tsx)

### Authentication Flow
- **Primary:** Supabase Auth (OAuth, OTP, password)
- **Secondary:** Optional session creation via `/api/session/auth`

### API Calls
| Call | Method | Endpoint | Status | Purpose |
|---|---|---|---|---|
| N/A | POST | `/api/session/auth` | ⚠️ | Should call after Supabase login |

### Current Issue
- ❌ Supabase login completes but `/api/session/auth` never called
- ❌ No session validation on backend
- ❌ Session state may be out of sync

### What Should Happen
```typescript
// After successful Supabase login:
const token = session.session?.access_token;
const resp = await fetch('/api/session/auth', {
  method: 'POST',
  body: JSON.stringify({ accessToken: token })
});
```

**Verdict: ⚠️ FUNCTIONAL BUT INCOMPLETE**
- Login works (via Supabase)
- Backend session not properly initialized
- Should call `/api/session/auth` with Supabase token

---

## Onboarding Page
**File:** [src/pages/Onboarding.tsx](src/pages/Onboarding.tsx)

### API Calls & Endpoints
| Call | Method | Endpoint | Status | Purpose |
|---|---|---|---|---|
| Line 105 | POST | `/api/profile/upsert` | ✅ | Save profile |

### Flow
1. 3-step questionnaire (name/email → goals/strategy → amount/knowledge)
2. Saves profile via `profile/upsert`
3. Calls `onComplete()` callback

### Missing
- ❌ No onboarding state check (shows even if complete)
- ❌ No auto-setup of agent after onboarding
- ❌ No exchange connection defaults
- ⚠️ No "skip" option

**Verdict: ✅ FUNCTIONAL**
- Core endpoint works
- Saves profile correctly
- Missing: integration with other systems

---

## Summary by Endpoint Implementation

### Session Management (3 endpoints)
```
✅ session/init       → Pages: Agent, Exchanges
✅ session/auth       → Pages: Login (should use but doesn't)
✅ session/logout     → Pages: Settings
```

### Profile Management (2 endpoints)
```
✅ profile/get        → Pages: Dashboard, Charts, Settings
✅ profile/upsert     → Pages: Settings, Onboarding
```

### Market & AI (4 endpoints)
```
✅ market-scan        → Pages: Dashboard, Today
✅ market-summary     → Pages: Today
✅ portfolio-allocate → Pages: Dashboard
✅ insights           → Pages: Dashboard
✅ chat               → Pages: Dashboard
```

### Exchange Integration (8 endpoints)
```
✅ exchanges/connect      → Pages: Exchanges
✅ exchanges/disconnect   → Pages: Exchanges
✅ exchanges/status       → Pages: Dashboard, Agent, Exchanges
✅ exchanges/balances     → Pages: Dashboard
⚠️ exchanges/performance  → Pages: Dashboard
✅ exchanges/assets       → Pages: Dashboard (via API wrapper)
✅ exchanges/sync         → Pages: Exchanges
✅ exchanges/_health      → Pages: (internal only)
```

### Agent System (3 endpoints)
```
✅ agent/settings     → Pages: Agent
✅ agent/status       → Pages: Agent (not used)
⚠️ agent/activity     → Pages: AgentActivity (returns mock)
```

### Academy (2 endpoints)
```
✅ academy/progress        → Pages: Academy
✅ academy/complete-module → Pages: Academy
```

---

## Implementation Checklist for Full Functionality

### High Priority (Would unlock features)
- [ ] Store real agent activities (agent/activity)
- [ ] Expose order placement (`/api/exchanges/trade`)
- [ ] Complete Supabase auth integration (Login → session/auth)

### Medium Priority (Would enhance experience)
- [ ] Academy module delivery (`/api/academy/modules/*`)
- [ ] Badge system automation
- [ ] Onboarding completion detection
- [ ] Real-time activity updates

### Low Priority (Would improve robustness)
- [ ] Daily report generation
- [ ] Advanced exchange support (Kraken, Coinbase, Bybit)
- [ ] WebSocket streaming for prices
- [ ] Activity export/analytics

