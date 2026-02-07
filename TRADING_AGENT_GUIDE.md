# 🤖 AI TRADING AGENT — IMPLEMENTATION GUIDE

## Overview

The AI Trading Agent is an enterprise-grade system that allows AI to autonomously analyze markets and execute trades on Bitvavo with full safety guardrails.

**Status:** ✅ Framework complete, ready for Bitvavo API integration testing

---

## Architecture

### Components

```
┌─────────────────────────────────────────────────────┐
│ Frontend (React)                                    │
│ - TradingAgent UI (signals review)                 │
│ - Manual trade triggers                            │
└──────────────┬──────────────────────────────────────┘
               │
               ↓
┌─────────────────────────────────────────────────────┐
│ API Layer (Express)                                 │
│ - POST /api/trading/analyze   (get signals)        │
│ - POST /api/trading/execute   (execute trade)      │
│ - GET /api/trading/audit      (audit trail)        │
│ - GET /api/trading/signals    (recent signals)     │
└──────────────┬──────────────────────────────────────┘
               │
               ↓
┌─────────────────────────────────────────────────────┐
│ AI Trading Agent (server/ai/tradingAgent.ts)       │
│ - Market analysis via GPT-4o                       │
│ - Trade signal generation                          │
│ - Risk validation & guardrails                     │
│ - Execution result tracking                        │
└──────────────┬──────────────────────────────────────┘
               │
               ↓
┌─────────────────────────────────────────────────────┐
│ Exchange Layer (Bitvavo Connector)                  │
│ - Order placement                                   │
│ - Position tracking                                │
│ - Real-time price feeds                            │
└─────────────────────────────────────────────────────┘
```

---

## Key Features

### 1. Market Analysis
- **GPT-4o Integration**: Analyzes market volatility, sentiment, and observations
- **Contextual Decisions**: Takes user risk profile, portfolio state, and market conditions into account
- **Confidence Scoring**: All signals include 0-100 confidence levels

### 2. Risk Controls

**Position Limits** (by risk profile):
```typescript
voorzichtig:   Max 10% per position, 30% total exposure
gebalanceerd:  Max 20% per position, 60% total exposure  
actief:        Max 35% per position, 85% total exposure
```

**Volatility Guards**:
- When volatility > 85: Only close positions or hold (no new buys/sells)
- Prevents trading during market extremes

**Order Validation**:
- Min order: €25
- Max order: €5,000
- Position size cannot exceed allowed limits

### 3. Audit Logging

Every trade is logged with:
- ✅ Audit ID (unique per trade)
- ✅ User ID
- ✅ Signal details (asset, action, confidence)
- ✅ Execution result (success/failure, fee, order ID)
- ✅ Timestamp

**Tables involved:**
- `trading_signals` — All generated signals
- `trading_executions` — Actual trades with results
- `trading_audit_log` — Fine-grained compliance log

---

## API Endpoints

### 1. Analyze Market & Get Signals

**POST /api/trading/analyze**

Request:
```json
{
  "context": {
    "userId": "user_123",
    "profile": {
      "riskProfile": "gebalanceerd",
      "maxDrawdown": 0.10,
      "maxPositionSize": 0.20,
      "allowedAssets": ["BTC", "ETH", "ADA"]
    },
    "market": {
      "volatility": 45,
      "sentiment": 62,
      "recentObservations": [
        "Bitcoin surged 3.2% on Fed rate hold"
      ]
    },
    "portfolio": {
      "totalValue": 10000,
      "balances": [
        { "asset": "EUR", "total": 5000 },
        { "asset": "BTC", "total": 0.05 }
      ],
      "openOrders": [],
      "openPositions": [
        {
          "asset": "BTC",
          "quantity": 0.05,
          "entryPrice": 90000,
          "currentPrice": 93000
        }
      ]
    }
  }
}
```

Response:
```json
{
  "success": true,
  "signals": [
    {
      "action": "buy",
      "asset": "ETH",
      "quantity": 1.5,
      "price": 2500,
      "rationale": "Ethereum showing strength after protocol upgrade",
      "confidence": 75,
      "riskLevel": "medium",
      "maxLoss": 150
    }
  ],
  "count": 1,
  "timestamp": "2026-02-07T10:30:00Z",
  "message": "Generated 1 trade signal(s)"
}
```

---

### 2. Execute a Trade Signal

**POST /api/trading/execute**

Request:
```json
{
  "signal": {
    "action": "buy",
    "asset": "ETH",
    "quantity": 1.5,
    "price": 2500,
    "rationale": "Technical confirmation on 4h chart",
    "confidence": 75,
    "riskLevel": "medium"
  },
  "context": { /* same as above */ }
}
```

Response:
```json
{
  "success": true,
  "action": "buy",
  "asset": "ETH",
  "quantity": 1.5,
  "price": 2500,
  "orderId": "ord_1707293400123",
  "fee": 3.75,
  "totalValue": 3753.75,
  "timestamp": "2026-02-07T10:30:45Z",
  "message": "BUY 1.5 ETH @ €2500 ✓",
  "auditId": "trade_1707293400123_a1b2c3d4e"
}
```

---

### 3. Get Audit Trail

**GET /api/trading/audit?userId=user_123&limit=50&offset=0**

Response:
```json
{
  "success": true,
  "executions": [
    {
      "id": "trade_1707293400123_a1b2c3d4e",
      "action": "buy",
      "asset": "ETH",
      "quantity": 1.5,
      "price": 2500,
      "total": 3750,
      "fee": 3.75,
      "success": true,
      "status": "executed",
      "orderId": "ord_1707293400123",
      "timestamp": "2026-02-07 10:30:45",
      "message": "BUY 1.5 ETH @ €2500 ✓"
    }
  ],
  "count": 1,
  "limit": 50,
  "offset": 0,
  "timestamp": "2026-02-07T10:35:00Z"
}
```

---

### 4. Get Recent Signals

**GET /api/trading/signals?userId=user_123&hoursBack=24**

Response:
```json
{
  "success": true,
  "signals": [
    {
      "id": "sig_123",
      "asset": "BTC",
      "action": "sell",
      "confidence": 50,
      "quantity": 0.01,
      "price": 95000,
      "rationale": "Overbought RSI, taking profits",
      "risk_level": "low",
      "created_at": "2026-02-07T08:15:00Z"
    }
  ],
  "count": 1,
  "hoursBack": 24,
  "timestamp": "2026-02-07T10:35:00Z"
}
```

---

## Testing the Trading Agent

### Step 1: Local Development Setup

```bash
# 1. Install dependencies
npm install

# 2. Set environment variables
OPENAI_API_KEY=sk_test_...
BITVAVO_API_KEY=<your_test_key>
BITVAVO_API_SECRET=<your_test_secret>

# 3. Run server
npm run dev:server

# 4. Open another terminal for frontend
npm run dev
```

### Step 2: Test API Endpoints

**Using curl:**

```bash
# Test analyze endpoint
curl -X POST http://localhost:4000/api/trading/analyze \
  -H "Content-Type: application/json" \
  -d @- << 'EOF'
{
  "context": {
    "userId": "test_user",
    "profile": { "riskProfile": "gebalanceerd", ... },
    "market": { "volatility": 50, "sentiment": 60 },
    "portfolio": { "totalValue": 10000, ... }
  }
}
EOF

# Test execute endpoint
curl -X POST http://localhost:4000/api/trading/execute \
  -H "Content-Type: application/json" \
  -d @- << 'EOF'
{
  "signal": { "action": "buy", "asset": "BTC", "quantity": 0.01, ... },
  "context": { ... }
}
EOF
```

### Step 3: Integration with Bitvavo

Once you're ready for live testing:

1. **Create Bitvavo Test Account**
   - Go to https://bitvavo.com
   - Create test/sandbox account with small amounts

2. **Get API Credentials**
   - Navigate to API Keys settings
   - Create new key with only "Read" and "Trade" permissions
   - Keep SECRET secure

3. **Update BitvavoConnector**
   - Implement actual `placeOrder()` method in `src/lib/exchanges/connectors/bitvavo.ts`
   - Hook up real API calls
   - Add order confirmation/failure handling

4. **Test Execution Flow**
   - Place small test buy orders (€25-50)
   - Verify order appears on Bitvavo
   - Check audit trail in database
   - Test sell/close position

---

## Safety Practices

### ✅ BEFORE GOING LIVE

- [ ] All API calls signed correctly (HMAC-SHA256 for Bitvavo)
- [ ] Test with small amounts first (€25-50)
- [ ] Verify order placement on Bitvavo UI
- [ ] Check audit trail captures all trades
- [ ] Implement rate limiting (max orders per hour)
- [ ] Add user confirmation dialog (for first N trades)
- [ ] Set up monitoring/alerting for failed trades
- [ ] Test rollback/cancel procedures

### ❌ NEVER

- Don't hardcode credentials in code
- Don't skip validation checks
- Don't execute without risk limits
- Don't ignore audit trail requirements
- Don't trade without user consent

---

## Database Tables

```sql
-- Created via src/sql/trading_schema.sql

trading_signals      — AI-generated trade signals
trading_executions   — Actual trade results
trading_positions    — Open positions tracking
trading_settings     — User risk preferences
trading_audit_log    — Compliance audit trail
```

To set up:
```bash
# Run the schema file in Supabase SQL editor
psql -U postgres -d postgres -f src/sql/trading_schema.sql
```

---

## Next Steps

### Phase 1: Complete (✅)
- ✅ Trading agent framework
- ✅ API endpoints
- ✅ Database schema
- ✅ Risk controls & guardrails

### Phase 2: In Progress
- 🔄 Full Bitvavo connector implementation
- 🔄 Order execution & confirmation
- 🔄 Real-time position tracking
- 🔄 Fee calculation & profit/loss

### Phase 3: Coming Soon
- ⏳ Machine learning from outcomes
- ⏳ Advanced pattern recognition
- ⏳ Multi-exchange arbitrage
- ⏳ Advanced risk hedging

---

## Troubleshooting

**Q: "OpenAI error 401"**  
A: Check `OPENAI_API_KEY` env variable is set correctly

**Q: "Cannot execute: Order value too small"**  
A: Minimum order is €25 (Bitvavo limit)

**Q: "Volatility > 85, cannot buy"**  
A: Market is too volatile. This is intentional. Only `hold`, `sell`, or `close_position` allowed.

**Q: "Position size exceeds limit"**  
A: Check your risk profile settings. If gebalanceerd, max is 20% per position.

---

## Support

For issues or questions:
1. Check audit trail: `/api/trading/audit?userId=...`
2. Review recent signals: `/api/trading/signals?userId=...`
3. Check logs in Supabase (trading_audit_log table)
4. Contact AI team with audit ID from failed trade
