# 📁 CODEBASE REORGANISATIE PLAN

## HUIDGE STRUCTUUR (MESSY)
```
src/
  api/                          # ← 11 files, no organization
  lib/
    bitvavo/                     # ← specific to one exchange
    dataSources/                 # ← market data helpers
    exchanges/                   # ← exchange integration layer
    hooks/                       # ← React hooks (mini!)
    notifications/               # ← notification logic
    observation/                 # ← agent observation system
    profile/                     # ← user profile helpers
    security/                    # ← encryption/auth
    supabase/                    # ← DB client
    theme/                       # ← UI theme
  pages/                         # ← 15 page components
  components/                    # ← 10 components
  data/                          # ← mock data & constants
  exchange/                      # ← EMPTY or duplicated?
  tests/                         # ← test files
  trading/                       # ← trading logic?
```

## NIEUWE STRUCTUUR (CLEAN)

```
src/

├── features/                          # ← Feature-based organization
│   ├── agent/                         # ← Agent AI system
│   │   ├── components/                # Agent UI components
│   │   │   ├── AgentActivityWidget.tsx
│   │   │   ├── AgentChat.tsx
│   │   │   ├── AgentStatusWidget.tsx
│   │   │   └── AgentStatePanel.tsx
│   │   ├── hooks/                     # Agent-specific hooks
│   │   │   └── useAgentStatus.ts
│   │   ├── types.ts                   # Agent types & interfaces
│   │   ├── constants.ts               # Agent defaults & thresholds
│   │   └── index.ts                   # Public exports
│   │
│   ├── portfolio/                     # ← Portfolio tracking
│   │   ├── components/
│   │   │   ├── PortfolioCard.tsx
│   │   │   └── AllocationCard.tsx
│   │   ├── hooks/
│   │   │   ├── usePortfolio.ts
│   │   │   └── useAllocation.ts
│   │   ├── types.ts
│   │   └── index.ts
│   │
│   ├── market/                        # ← Market data & analysis
│   │   ├── components/
│   │   │   ├── PriceChart.tsx
│   │   │   ├── MarketScan.tsx
│   │   │   └── TrendAnalysis.tsx
│   │   ├── hooks/
│   │   │   ├── useMarketData.ts
│   │   │   ├── useMarketTrends.ts
│   │   │   └── usePrices.ts
│   │   ├── types.ts
│   │   └── index.ts
│   │
│   ├── exchanges/                     # ← Exchange connections
│   │   ├── components/
│   │   │   └── ExchangeStatus.tsx
│   │   ├── adapters/                  # Exchange-specific code
│   │   │   ├── bitvavo.ts             # Bitvavo implementation
│   │   │   ├── kraken.ts              # Kraken (TODO)
│   │   │   ├── coinbase.ts            # Coinbase (TODO)
│   │   │   └── bybit.ts               # Bybit (TODO)
│   │   ├── types.ts
│   │   └── index.ts
│   │
│   ├── education/                     # ← Academy & learning
│   │   ├── components/
│   │   │   └── AiTutorModal.tsx
│   │   ├── hooks/
│   │   │   └── useCurriculum.ts
│   │   ├── types.ts
│   │   └── index.ts
│   │
│   └── settings/                      # ← User settings
│       ├── components/
│       │   ├── SettingsPanel.tsx
│       │   └── ProfileSettings.tsx
│       ├── hooks/
│       │   ├── useUserSettings.ts
│       │   └── useTheme.ts
│       ├── types.ts
│       └── index.ts
│
├── shared/                            # ← Reusable across features
│   ├── api/                           # ← API client layer
│   │   ├── queries.ts                 # Query functions
│   │   ├── mutations.ts               # Mutation functions
│   │   ├── cache.ts                   # Cache management
│   │   └── types.ts                   # API types
│   │
│   ├── services/                      # ← Business logic
│   │   ├── authService.ts             # Authentication
│   │   ├── dataService.ts             # Data loading & caching
│   │   ├── cryptoService.ts           # Encryption/decryption
│   │   ├── notificationService.ts     # Notifications
│   │   └── rateLimiter.ts             # Rate limiting
│   │
│   ├── hooks/                         # ← Shared React hooks
│   │   ├── useAsync.ts
│   │   ├── useFetch.ts
│   │   ├── useLocalStorage.ts
│   │   └── useTheme.ts
│   │
│   ├── components/                    # ← Reusable UI components
│   │   ├── ui/
│   │   │   ├── Card.tsx
│   │   │   ├── Button.tsx
│   │   │   ├── Modal.tsx
│   │   │   └── Sidebar.tsx
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx
│   │   │   └── PageLayout.tsx
│   │   ├── common/
│   │   │   ├── Header.tsx
│   │   │   ├── Footer.tsx
│   │   │   └── ProgressIndicator.tsx
│   │   └── index.ts
│   │
│   ├── constants/                     # ← App-wide constants
│   │   ├── apiEndpoints.ts
│   │   ├── themes.ts
│   │   ├── currencies.ts
│   │   ├── education.ts              # (from educationSnippets.ts)
│   │   ├── strategies.ts              # (from strategies.ts)
│   │   └── platforms.ts               # (from platforms.ts)
│   │
│   ├── types/                         # ← Shared types
│   │   ├── domain.ts                  # Business domain types
│   │   ├── api.ts                     # API response types
│   │   └── ui.ts                      # UI component props
│   │
│   ├── utils/                         # ← Utility functions
│   │   ├── date.ts
│   │   ├── number.ts
│   │   ├── string.ts
│   │   ├── validation.ts
│   │   └── formatting.ts
│   │
│   ├── theme/                         # ← Theme system
│   │   ├── ThemeContext.tsx
│   │   ├── themes.ts
│   │   └── index.ts
│   │
│   └── db/                            # ← Database
│       ├── supabase.ts                # Client & types
│       ├── queries.ts                 # Common queries
│       └── migrations/                # SQL migrations
│           └── *.sql
│
├── pages/                             # ← Page components (top-level routes)
│   ├── Dashboard.tsx
│   ├── Portfolio.tsx
│   ├── Market.tsx
│   ├── Agent.tsx
│   ├── Academy.tsx
│   ├── Settings.tsx
│   ├── Exchanges.tsx
│   ├── Login.tsx
│   ├── Onboarding.tsx
│   ├── Charts.tsx
│   ├── MonthOverview.tsx
│   ├── YearView.tsx
│   └── Trading.tsx
│
├── main.tsx                           # App entry
├── index.css                          # Global styles
└── App.tsx                            # Root component

server/                               # ← Backend (Node.js + Express)
├── index.ts                          # Server entry
├── middleware.ts                     # Express middleware
├── errorHandler.ts                   # Error handling
├── validation.ts                     # Input validation
│
├── api/                              # ← API routes (Express)
│   ├── index.ts                      # Route definitions
│   ├── auth/                         # Auth endpoints
│   │   ├── login.ts
│   │   ├── logout.ts
│   │   └── session.ts
│   │
│   ├── agent/                        # Agent endpoints
│   │   ├── status.ts
│   │   ├── reports.ts
│   │   ├── observations.ts
│   │   └── settings.ts
│   │
│   ├── portfolio/                    # Portfolio endpoints
│   │   ├── status.ts
│   │   ├── allocation.ts
│   │   └── performance.ts
│   │
│   ├── market/                       # Market data endpoints
│   │   ├── prices.ts
│   │   ├── trends.ts
│   │   └── summary.ts
│   │
│   ├── exchanges/                    # Exchange endpoints
│   │   ├── status.ts
│   │   ├── connect.ts
│   │   ├── disconnect.ts
│   │   └── sync.ts
│   │
│   └── chat/                         # Chat/AI endpoints
│       └── message.ts
│
├── cron/                             # ← Vercel cron jobs
│   ├── market-data-cache.ts          # 30-min price updates
│   ├── portfolio-check.ts            # Hourly portfolio scan
│   └── daily-scan.ts                 # Daily market analysis
│
├── handlers/                         # ← Business logic handlers
│   ├── agentHandler.ts
│   ├── portfolioHandler.ts
│   ├── marketHandler.ts
│   ├── exchangeHandler.ts
│   └── chatHandler.ts
│
└── db/                               # ← Database layer
    ├── supabase.ts
    ├── queries.ts
    └── types.ts

api/                                 # ← Legacy files (to clean up)
├── index.ts                          # ← Will become server/api/index.ts
└── cron/                             # ← Will become server/cron/
    ├── market-data-cache.ts
    ├── portfolio-check.ts
    └── daily-scan.ts
```

## MIGRATION STEPS

### Phase 1: Create new structure
1. ✅ Create directories
2. ✅ Move files to new locations
3. ✅ Update import paths
4. ✅ Verify no broken imports

### Phase 2: Feature organization
1. Move UI components to features/
2. Move hooks to features/
3. Organize shared services

### Phase 3: Backend reorganization
1. Move server routes to server/api/
2. Organize handlers
3. Clean up cron jobs

### Phase 4: Constants & types
1. Consolidate constants
2. Centralize types
3. Remove duplicate definitions

### Phase 5: Testing & cleanup
1. Verify build
2. Test functionality
3. Remove old directories
4. Git commit

## KEY PRINCIPLES

1. **Feature-based**: Code grouped by business feature, not by file type
2. **Co-location**: Related components, hooks, types together
3. **Clarity**: No confusion about where things live
4. **Scalability**: Easy to add new features without mess
5. **Single responsibility**: Each module has one job
6. **Public API**: Each feature exports clean interface via index.ts
7. **Isolation**: Features don't directly import from each other internals
