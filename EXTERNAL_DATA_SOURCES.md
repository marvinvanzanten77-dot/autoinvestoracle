# 📊 EXTERNE DATA-BRONNEN VOOR OBSERVATIE-LAAG

**Filosofie:** De app observeert markten. Dit vereist betrouwbare, continue data-feeds.

---

## 🟢 KERNBRONNEN (Gratis & Open)

### 1. **CoinGecko API** ✅ AL IN GEBRUIK
```
https://api.coingecko.com/api/v3
- Live prices (BTC, ETH, 10000+ coins)
- Historical data (7d sparklines)
- Market cap, volume, dominance
- Rate limit: 10-50 calls/min (free)
```
**Philosophisch perfect:** Neutrale, op-consensus-gebaseerde prijzen  
**Data type:** Observatie (niet predictie)  
**Integratie:** Huiding `fetchMarketSparkline()`

**Voorbeeld observatie:**
```
"Bitcoin +3.2% in 24h, Ethereum +1.8%
 → BTC leidt, correlatie verandert"
```

---

### 2. **Glassnode On-Chain Metrics** 🟡 PARTIAL (Free tier beperkt)
```
https://api.glassnode.com
- Address activity
- Transaction volume
- HODL behavior
- Whale movements (>1000 BTC)
- Supply locked/circulating
- Rate limit: 1000 calls/month (free)
```
**Philosophisch:** Ziet wat chain echt doet, niet wat sentiment zegt  
**Data type:** Observatie (gedrag op blockchain)  
**Integratie:**
```typescript
// Nieuwe observatie-source:
async fetchOnChainMetrics(asset: 'BTC' | 'ETH'): Promise<OnChainObservation> {
  // Query Glassnode
  // Return: { addressActivity, volumeChange, hodlerBehavior, whaleMovement }
}
```

**Voorbeeld observatie:**
```
"Wallets met >100 BTC stijgen met 2% — accumulatie fase?"
```

---

### 3. **Coingecko Fear & Greed Index** ✅ FREE & RELIABLE
```
https://api.alternative.me/fng/
- Composite sentiment
- 0-100 scale
- Historical data
- Updated dagelijks
- NO rate limit
```
**Philosophisch:** Observeer collectieve emotie (niet als predictie, als context)  
**Data type:** Markt context (volatility/sentiment)  
**Integratie:**
```typescript
async fetchFearGreedIndex(): Promise<number> {
  const resp = await fetch('https://api.alternative.me/fng/?limit=365');
  return data[0].value; // 0-100
}
```

**In observatie:**
```
"Sentiment 28 (Fear) — markt onder druk, maar ziet kansen"
```

---

### 4. **CoinCodex Historical Data** ✅ FREE
```
https://api.coincodex.com/v2
- Historical OHLCV (Open, High, Low, Close, Volume)
- Exchanges integration
- Multiple timeframes
- NO rate limit (json)
```
**Philosophisch:** Ziet volumepatronen, niet alleen prijs  
**Data type:** Observatie (gedrag patterns)  

**Voorbeeld observatie:**
```
"Volume plotseling -40% → illiquidity gevaar?"
```

---

### 5. **Messari API** 🟡 FREE TIER (Beperkt)
```
https://data.messari.io/api
- Asset fundamentals
- On-chain metrics
- Network statistics
- Market data
- Rate limit: 100 calls/day (free)
```
**Philosophisch:** Dieper inzicht in project-gezondheid  
**Data type:** Observatie + context  

**Voorbeeld observatie:**
```
"Ethereum nakedness ratio afgenomen → minder actieve holders"
```

---

### 6. **CoinMarketCap API** 🟡 LIMITED FREE
```
https://coinmarketcap.com/api
- Market rankings
- Exchange listings
- Trending assets
- Rate limit: 10,000 calls/month (free)
```
**Philosophisch:** Ziet shift in interesse (geen predictie, observatie)  
**Data type:** Observatie (markt aandacht verschuiving)  

---

## 🟡 MACRO-ECONOMISCHE BRONNEN (Public Data)

### 7. **Federal Reserve Data** ✅ FREE PUBLIC API
```
https://www.federalreserve.gov/datadownload/
- Interest rates (Fed funds rate)
- Unemployment
- GDP growth
- Published weekly/monthly
```
**Philosophisch:** Crypto reageert op macro — voeg context toe  
**Data type:** Observatie context  

**Voorbeeld observatie:**
```
"Fed hawkish, BTC -5% dag later — correlatie zichtbaar?"
```

---

### 8. **FRED (St. Louis Fed)** ✅ FREE API
```
https://fred.stlouisfed.org
- Economic indicators
- Interest rates
- Inflation (CPI)
- JSON API
```
**Integratie:**
```typescript
async fetchInflationContext(): Promise<{ cpi: number; fedRate: number }> {
  // Get latest CPI, Fed rate
  return { cpi: 4.2, fedRate: 5.33 };
}
```

---

### 9. **Yahoo Finance for Stocks** 🟡 UNOFFICIAL (Maar stable)
```
yfinance (Python) or similar
- Stock indices (S&P500, Nasdaq)
- Commodities (Gold, Oil)
- Stock volatility (VIX)
- Correlations
```
**Philosophisch:** Ziet macro-trend, ziet of crypto volgt/divergeert  
**Data type:** Observatie (cross-asset correlation)  

**Voorbeeld observatie:**
```
"S&P500 -2%, BTC +0.5% → divergence → flight-to-crypto?"
```

---

## 🔵 NEWS & SENTIMENT SOURCES

### 10. **CryptoCompare News Feed** ✅ FREE
```
https://min-api.cryptocompare.com/data/news
- Aggregated crypto news
- Sentiment tags
- Multiple sources
- Updated continuously
```
**Filosofie:** News als context, niet causaal  
**Data type:** Observatie context  

**Voorbeeld observatie:**
```
"5 positive news items vandaag — pero price daalt
 → Sentiment ≠ Market Movement"
```

---

### 11. **Santiment Social Volume** 🟡 LIMITED FREE
```
https://api.santiment.net
- Twitter mentions
- Social volume
- Development activity
- Community engagement
```
**Filosofie:** Ziet hype-cycli (niet predictief!)  
**Data type:** Observatie (community behavior)  

---

### 12. **RSS/News Aggregators** ✅ FREE
```
- CoinDesk (RSS feed)
- The Block (RSS)
- Cointelegraph (RSS)
- Bitcoin Magazine (RSS)
```
**Filosofie:** Nieuws contextualiseren in observatie  
**Data type:** Observatie background  

---

## 🟣 EXCHANGE-SPECIFIC DATA

### 13. **Kraken OHLC API** ✅ FREE (Public)
```
https://api.kraken.com/0/public/OHLC
- Historical candlesticks
- Multiple pairs
- No auth required
- NO rate limit on public
```

### 14. **Bitvavo Public API** ✅ FREE
```
https://api.bitvavo.com/v2
- Market data
- Trading pairs
- Candles
- No auth required
```

### 15. **Coinbase Advanced Trade** 🟡 AUTH REQUIRED
```
https://api.coinbase.com
- Public market data
- Order book
- Trades
- Rate limit: 15 requests/sec
```

---

## 🎯 PROPOSED DATA INTEGRATION

### Observatie-Engine mit multiple sources:

```typescript
// src/lib/observation/dataSources.ts

interface DataSource {
  name: string;
  endpoint: string;
  updateFrequency: number; // ms
  rateLimit: number;
  requiresAuth: boolean;
}

const dataSources: DataSource[] = [
  {
    name: 'CoinGecko',
    endpoint: 'https://api.coingecko.com/api/v3',
    updateFrequency: 60000, // 1 min
    rateLimit: 10,
    requiresAuth: false
  },
  {
    name: 'Fear & Greed',
    endpoint: 'https://api.alternative.me/fng/',
    updateFrequency: 3600000, // 1 hour
    rateLimit: 1000,
    requiresAuth: false
  },
  {
    name: 'Glassnode',
    endpoint: 'https://api.glassnode.com',
    updateFrequency: 3600000, // 1 hour
    rateLimit: 1000 / (30 * 24 * 60), // Monthly budget
    requiresAuth: true // API key
  },
  // ... meer
];

/**
 * Observatie-aggregator:
 * Verzamel data van meerdere bronnen → één observatie
 */
async function aggregateObservation(userId: string): Promise<MarketObservation> {
  const [prices, sentiment, onChain, macro] = await Promise.all([
    fetchCoinGeckoData(),
    fetchFearGreedIndex(),
    fetchGlassnodeData(),
    fetchFedData()
  ]);

  return {
    timestamp: new Date().toISOString(),
    assetCategory: 'BTC',
    marketContext: determineContext({ prices, sentiment, onChain }),
    observedBehavior: describeMultiSourceBehavior({
      prices,
      sentiment,
      onChain,
      macro
    }),
    sources: ['coingecko', 'sentiment', 'glassnode', 'fred'],
    // ... rest
  };
}
```

---

## 📋 IMPLEMENTATIE-ROADMAP

### Fase 1: FOUNDATIONS (nu)
- ✅ CoinGecko (al werking)
- ✅ Fear & Greed Index
- ✅ Public market data (Kraken, Bitvavo)

### Fase 2: ENRICHMENT (1-2 weken)
- [ ] Glassnode on-chain
- [ ] CoinCodex historical
- [ ] Messari fundamentals

### Fase 3: MACRO CONTEXT (2-3 weken)
- [ ] FRED Economic data
- [ ] Fed statements API
- [ ] Stock index correlation

### Fase 4: ADVANCED (maand 2)
- [ ] Santiment social volume
- [ ] News aggregation
- [ ] Exchange order book depth

---

## 🎯 FILOSOFISCHE UITLIJNING

Elke bron moet voldoen aan:

```
✅ Observatie, niet predictie
   "Ik zie dat X gebeurde" (niet "X zal Y veroorzaken")

✅ Openbaar & verifieerbaar
   Iedereen kan dezelfde data zien

✅ Neutraal
   Niet incentivized om bias te hebben

✅ Continu & betrouwbaar
   Geen 24-uurs downtime

✅ Actionable context
   Geeft context, niet orders
```

---

## 💡 VOORBEELD: MULTI-SOURCE OBSERVATIE

```
Timestamp: 2026-01-31 15:00 UTC

PRICE SOURCE (CoinGecko):
  Bitcoin +3.2% in 24h
  Ethereum +1.8%
  → BTC leidt (momentum)

SENTIMENT SOURCE (Fear & Greed):
  Index: 35 (Fear)
  Trending: Downward 5 punten

ONCHAIN SOURCE (Glassnode):
  Whale wallets (>1000 BTC): +2% growth
  Address activity: Neutral
  → Accumulatie-signaal?

MACRO SOURCE (FRED):
  Fed Rate: 5.33%
  Inflation CPI: 4.2%
  → Macro still restrictive

CORRELATION (Stock market):
  S&P 500: -1.2%
  BTC: +3.2%
  → Divergence! Flight-to-crypto?

FINAL OBSERVATION:
"Bitcoin shows strength despite macro headwinds.
 Fear dominant, but on-chain accumulation visible.
 Divergence from stocks suggests reallocation,
 not fundamental recovery. Monitor Fed path forward."

TYPE: Observatie
CONFIDENCE: Middel
VALIDITY: 4 hours
```

---

## 🔧 INTEGRATIE-CHECKLIST

- [ ] Creëer `src/lib/dataSources/` directory
- [ ] Per source: `coingecko.ts`, `glassnode.ts`, etc.
- [ ] Rate limiting per source
- [ ] Error fallbacks
- [ ] Caching strategy
- [ ] Source reliability tracking
- [ ] Update `/api/observation` om multiple sources te gebruiken
- [ ] Add `sources` array in MarketObservation type
- [ ] Frontend: Toont welke bronnen gebruikt

---

## 📌 MEEST PRAKTISCH: MVPs

**Minimum Viable Setup:**
1. CoinGecko (prices) ✅
2. Fear & Greed (sentiment)
3. Public exchange data (volume)

**Dat geeft al 80% waarde.**

**Nice-to-have:**
- Glassnode (on-chain)
- FRED (macro)
- Santiment (social)

---

**Conclusie:** De app kan zich voeden met 15+ publieke bronnen, zonder dat we zelf data moeten creëren. Pure **observatie-laag** functie. 🎯
