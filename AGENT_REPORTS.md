# Agent Reports & Trading Bot Mode

## Overview

De agent genereert nu **hourly reports** met:
- **Observaties**: Wat ziet de agent in de markt/portfolio?
- **Action Suggestions**: Wat zou de bot kunnen doen? (BUY, SELL, REBALANCE, MONITOR)
- **Status**: Bullish/Bearish/Cautious mood met confidence level

## How It Works

### 1. Hourly Cron Job (`/api/cron/portfolio-check`)
Elke uur:
- Haalt alle user portfolios op van Supabase
- Genereert **portfolio observations** (SELL, REBALANCE, STOP-LOSS signalen)
- Genereert **action suggestions** per asset
- Creëert een **hourly report** met samenvatting
- Slaat alles op in de database
- Optioneel: Stuurt een **notification** als er interessante suggesties zijn

### 2. Action Suggestions
De agent suggereert acties op basis van:

| Action | Trigger | Confidence |
|--------|---------|------------|
| **SELL** | Winst ≥ 10% | Hoog |
| **SELL** | Verlies ≤ -5% (STOP-LOSS) | Hoog |
| **REBALANCE** | Momentum verschil > 8% | Middel |
| **MONITOR** | Goede performer | Middel |

### 3. Agent Mood
- **Bullish**: Avg 24h change > +3% → "Koop goederen"
- **Bearish**: Avg 24h change < -3% → "Risico management"
- **Cautious**: Tussen -3% en +3% → "Voorzichtig"

### 4. Confidence Level
- Gemiddelde confidence van alle suggesties
- 0-100% based op signaal strength

## API Endpoints

### Get All Reports (last 24 hours)
```bash
GET /api/agent-reports?userId=<uuid>
```
Response:
```json
{
  "status": "success",
  "data": [
    {
      "id": "report-123",
      "userId": "user-123",
      "reportedAt": "2026-02-12T15:00:00Z",
      "summary": {
        "observationsCount": 3,
        "suggestionsCount": 2,
        "mainTheme": "Bullish momentum"
      },
      "suggestions": [
        {
          "action": "SELL",
          "asset": "BTC",
          "reasoning": "BTC reached 15% profit. Take partial profits.",
          "confidence": "hoog",
          "riskLevel": "laag"
        }
      ],
      "agentMood": "bullish",
      "recommendedAction": "Consider executing SELL for profit-taking",
      "overallConfidence": 85
    }
  ]
}
```

### Get Latest Report
```bash
GET /api/agent-reports?userId=<uuid>&action=latest
```

### Get Statistics (last 7 days)
```bash
GET /api/agent-reports?userId=<uuid>&action=stats&days=7
```
Response:
```json
{
  "status": "success",
  "data": {
    "totalReports": 168,
    "bullishCount": 42,
    "bearishCount": 15,
    "cautiousCount": 111,
    "avgConfidence": 72,
    "totalSuggestions": 89
  }
}
```

### Get Reports by Mood
```bash
GET /api/agent-reports?userId=<uuid>&mood=bullish&limit=10
```

## Database Schema

### `agent_reports` table
```sql
id: UUID
user_id: UUID
reported_at: TIMESTAMP
period_from: TIMESTAMP
period_to: TIMESTAMP
observations: JSONB[]
suggestions: JSONB[]
agent_mood: 'bullish' | 'bearish' | 'cautious'
recommended_action: TEXT
overall_confidence: 0-100
should_notify: BOOLEAN
notification_sent: TIMESTAMP
```

### `notifications` table
```sql
id: UUID
user_id: UUID
type: 'agent-report' | 'action-executed' | 'alert' | 'info'
title: TEXT
message: TEXT
data: JSONB
read: BOOLEAN
dismissed: BOOLEAN
```

## Trading Bot Mode

**Currently**: Suggesties worden gegenereerd maar **NIET automatisch uitgevoerd**.

Je kan het systeem gebruiken als:
1. **Manual Trading**: Lees reports, voer handelingen handmatig uit
2. **Semi-Auto**: Lees suggestions, voer via API uit
3. **Full Auto**: Connect suggestion handler voor automatische execution (toekomstig)

## Sample Report Output

```
[AGENT REPORT 2026-02-12T15:00:00Z]
📊 Observations: 3
💡 Suggestions: 2
📈 Mood: BULLISH
🎯 Confidence: 85%
💬 Action: Consider executing SELL for profit-taking

--- Observations ---
✓ SELL_SIGNAL: BTC heeft 15% winst bereikt. Waarde: €180.50. Kans op take-profit: 85%
✓ REBALANCE_SIGNAL: Verschuif €15.00 van SOL (1.2%) naar BTC (5.8%)
✓ MONITOR: ETH toont goede performance (+3.5% 24h)

--- Suggestions ---
1. SELL 30% of BTC → Confidence: 85% | Risk: Low
2. REBALANCE SOL → BTC → Confidence: 70% | Risk: Low
```

## Next Steps

1. ✅ Agent generates observations & suggestions (DONE)
2. ✅ Hourly reports stored in database (DONE)
3. ✅ API endpoints for retrieving reports (DONE)
4. 🟡 UI Dashboard for viewing reports (TODO)
5. 🟡 Notification system (partially done)
6. ⚪ Execution handler (API to actually execute trades)
7. ⚪ Portfolio backtesting against suggestions

## Environment Variables Required

```env
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-anon-key
CRON_SECRET=your-secret-for-vercel-cron
```

## Cron Schedule

- **Frequency**: Every hour (`0 * * * *`)
- **Runs per day**: 24
- **Logs per day**: 24 complete reports (1 per user per hour)
- **Database size**: ~1.5 KB per report × 24 × 30 days = ~1.08 MB/month per user
