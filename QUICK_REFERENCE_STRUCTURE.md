# ⚡ QUICK REFERENCE - NEW CODE STRUCTURE

**After reorganization on Feb 12, 2026**

---

## 📂 WHERE TO FIND THINGS

| What | Where |
|------|-------|
| **Agent components** | `src/features/agent/components/` |
| **Portfolio components** | `src/features/portfolio/components/` |
| **Market components** | `src/features/market/components/` |
| **Exchange adapters** | `src/features/exchanges/adapters/` |
| **API clients** | `src/shared/api/` |
| **Services** | `src/shared/services/` |
| **Reusable UI** | `src/shared/components/` |
| **Constants** | `src/shared/constants/` |
| **Database** | `src/shared/db/` |
| **Theme** | `src/shared/theme/` |
| **Cron jobs** | `server/cron/` |
| **API handlers** | `server/api/` |

---

## 💻 IMPORT EXAMPLES

### Agent Feature
```typescript
import { AgentStatusWidget, AgentChat } from '@/features/agent';
```

### Shared APIs
```typescript
import { fetchAgentStatus, fetchMarketData } from '@/shared/api';
```

### Shared Services
```typescript
import { dataService, rateLimiter } from '@/shared/services';
```

### Shared Components
```typescript
import { Card, Sidebar } from '@/shared/components';
```

### Constants
```typescript
import { EDUCATION_CURRICULUM } from '@/shared/constants';
```

---

## 🗑️ WHAT WAS REMOVED

- ❌ Debug panel from Dashboard
- ❌ Debug API endpoint
- ❌ In-memory observation logger
- ❌ Demo data generation

---

## ✅ WHAT'S NEW

- ✅ `src/features/` - Feature-based organization
- ✅ `src/shared/` - Centralized shared code
- ✅ Public API exports via `index.ts` files
- ✅ `server/cron/` - Organized background jobs
- ✅ `src/shared/db/` - Centralized migrations

---

## 🚀 DEPLOY CHECKLIST

- [ ] Run database migration
- [ ] Test functionality locally
- [ ] Deploy to production

---

**File:** For detailed info, read `FINAL_HANDOFF.md`
