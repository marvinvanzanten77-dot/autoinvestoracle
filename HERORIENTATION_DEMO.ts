/**
 * HERORIËNTATIE-DEMONSTRATIE
 * Auto Invest Oracle: Van analyse-tool naar observatie- & leer-oracle
 * 
 * Dit bestand toont:
 * 1. Een voorbeeld van een gelogde observatie
 * 2. Een voorbeeld van gegenereerde tickets
 * 3. Welke handlers een nieuwe betekenislaag hebben gekregen
 * 4. Wat nog mock is vs live-data-ready
 */

// ============================================================
// VOORBEELD 1: GELOGDE OBSERVATIE
// ============================================================

export const EXAMPLE_OBSERVATION = {
  id: 'obs_1738259400000_abc123',
  userId: 'user_john_doe',
  
  // Timing & context
  timestamp: '2026-01-31T14:30:00Z',
  range: '24h' as const,
  
  // Wat observeren we?
  assetCategory: 'BTC' as const,
  exchanges: ['kraken', 'bitvavo', 'coinbase'],
  
  // Marktcontext op moment van observatie
  marketContext: 'trend-up' as const, // Niet "Bitcoin gaat stijgen", maar "trend zichtbaar"
  volatilityLevel: 'matig' as const,
  
  // De waarneming (ZUIVER feitelijk, geen predictie)
  observedBehavior: 'Bitcoin +3.2%, Ethereum +1.8%, Stablecoins -0.1%, Altcoins +2.5%, BTC leidt',
  
  // Relatieve verhoudingen
  relativeMomentum: {
    btcVsEth: 1.4, // Bitcoin 1.4% sterker dan Ethereum
    priceVsStable: 2.5, // Gemiddelde crypto 2.5% vs stablecoins
    exchangeSpread: 0.8 // Prijsverschil tussen exchanges
  },
  
  // Exchange-afwijkingen (geen interpretatie, alleen noemen)
  exchangeAnomalies: [
    {
      exchange: 'kraken',
      anomaly: 'Volume 45% hoger dan gemiddelde', // NOEMEN, niet oordelen
      confidence: 'middel' as const
    }
  ],
  
  source: 'api-monitor' as const,
  
  // Dit veld wordt LATER ingevuld (na X uur)
  outcomeLoggedAt: undefined, // Nog niet ingevuld
  outcome: undefined // Nog niet ingevuld
};

// LATER, ALS WE TERUGKIJKEN (bijv. volgende dag):
export const EXAMPLE_OBSERVATION_WITH_OUTCOME = {
  ...EXAMPLE_OBSERVATION,
  outcomeLoggedAt: '2026-02-01T14:30:00Z',
  outcome: {
    what_happened: 'Bitcoin steeg door tot +5.8%, Ethereum +3.1%. Trend hield stand.',
    duration: '24 uur',
    was_significant: true,
    pattern_broken: false // Dit patroon werkte dus
  }
};

// ============================================================
// VOORBEELD 2: GEGENEREERDE TICKETS
// ============================================================

export const EXAMPLE_TICKETS = [
  // Ticket 1: Gewone observatie
  {
    id: 'tkt_1738259400000_obs1',
    userId: 'user_john_doe',
    type: 'observatie' as const,
    title: 'BTC: trend-up',
    description: 'Bitcoin +3.2%, Ethereum +1.8%, Stablecoins -0.1%, Altcoins +2.5%, BTC leidt',
    confidence: 'middel' as const,
    priority: 'medium' as const,
    createdAt: '2026-01-31T14:30:00Z',
    validUntil: '2026-01-31T18:30:00Z', // 4 uur geldig
    relatedObservationId: 'obs_1738259400000_abc123',
    pattern: 'In 24h zien we: Bitcoin +3.2%, Ethereum +1.8%, Stablecoins -0.1%, Altcoins +2.5%, BTC leidt',
    context: 'Markt is op dit moment trend-up; volatiliteit matig'
    // ❌ GEEN "action" veld
    // ❌ GEEN "expectedReturn"
    // ❌ GEEN "shouldBuy"
  },
  
  // Ticket 2: Exchange-afwijking
  {
    id: 'tkt_1738259400000_exch1',
    userId: 'user_john_doe',
    type: 'opportuniteit' as const, // Interessant om te zien, NIET om op in te gaan
    title: 'Exchange-afwijking gedetecteerd',
    description: 'Kraken: Volume 45% hoger dan gemiddelde',
    confidence: 'middel' as const,
    priority: 'medium' as const,
    createdAt: '2026-01-31T14:30:00Z',
    validUntil: '2026-01-31T16:30:00Z', // 2 uur geldig (tijdgevoelig)
    relatedObservationId: 'obs_1738259400000_abc123',
    pattern: 'Prijs/volume-verschillen tussen exchanges',
    context: 'Dit kan interessant zijn voor wie meerdere platforms monitor.'
    // 📌 Dit is informatief ("let op"), NIET dwingend ("doe dit")
  },
  
  // Ticket 3: Momentum-waarschuwing
  {
    id: 'tkt_1738259400000_mom1',
    userId: 'user_john_doe',
    type: 'advies' as const,
    title: 'BTC-ETH correlatie breekt',
    description: 'Bitcoin en Ethereum bewegen meer dan 5% uiteen (verschil: 1.4%)',
    confidence: 'middel' as const,
    priority: 'medium' as const,
    createdAt: '2026-01-31T14:30:00Z',
    validUntil: '2026-01-31T20:30:00Z', // 6 uur geldig
    relatedObservationId: 'obs_1738259400000_abc123',
    pattern: 'Ontkoppeling: Een stijgt/daalt terwijl de ander tegengesteld beweegt',
    context: 'Dit zien we vaker in marktfaseveranderingen. Interessant om te monitoren.'
  }
];

// ============================================================
// VOORBEELD 3: HANDLERS MET NIEUWE BETEKENISLAAG
// ============================================================

export const HANDLERS_TRANSFORMATION = {
  'marketScan.ts': {
    'vorige rol': 'Prijs-data ophalen, grafieken genereren',
    'nieuwe rol': 'Marktobservatie loggen + tickets genereren',
    'hoe': [
      '1. Scan marktdata (onveranderd)',
      '2. Zet om naar MarketObservation (NIEUW)',
      '3. Log observatie in database (NIEUW)',
      '4. Genereer tickets uit observatie (NIEUW)',
      '5. Log tickets (NIEUW)',
      '6. Retourneer scanresult (onveranderd)'
    ],
    'voorbeeld_integratie': `
    // In handleMarketScan:
    const payload = await buildMarketScanFromSparkline(range);
    const observation = generateObservation(userId, payload, 'BTC');
    const obsId = await logObservation(observation);
    const tickets = generateTicketsFromObservation(userId, observation);
    for (const ticket of tickets) await logTicket(ticket);
    res.json(payload); // Frontend ziet niets nieuws, maar logging gebeurt achter schermen
    `
  },

  'marketSummary.ts': {
    'vorige rol': 'Prijs-bewegingen samenvatten',
    'nieuwe rol': 'Bewegingen INTERPRETEREN als observatie-context',
    'hoe': [
      '1. OpenAI prompt aangepast: "Je bent observator, niet voorspeller"',
      '2. AI mag NOEMEN welke correlaties/ontkoppelingen',
      '3. AI mag NIET zeggen wat gaat gebeuren',
      '4. AI mag NIET "koopen/verkopen" suggereren'
    ],
    'verander_in_prompt': 'Geen "wat gaat gebeuren", wel "wat zien we"'
  },

  'dailyReportAgent.ts': {
    'vorige rol': 'Dagelijks rapport met "beste kansen"',
    'nieuwe rol': 'Dagelijks rapport met "waargenomen patronen"',
    'toekomst': 'Zet observaties om naar geleerde patronen',
    'voorbeeld': 'Ipv "Bitcoin gaat stijgen", zeg: "Vorige 3x dat we dit patroon zagen, steeg het door"'
  }
};

// ============================================================
// VOORBEELD 4: MOCK VS LIVE-DATA-READY
// ============================================================

export const MOCK_VS_LIVE = {
  'MOMENTEEL MOCK': [
    'Exchange connectoren (Bitvavo, Kraken, Coinbase, Bybit) zijn scaffolding',
    'Account/Balance/Position sync is niet geïmplementeerd',
    'Dagrapportgenerator gebruikt template, geen echte AI-analyse',
    'Storage-laag is in-memory (observationLog Map)',
    'Outcome-logging is placeholder'
  ],

  'LIVE-DATA-READY (na heroriëntatie)': [
    'marketScan → CoinGecko API → observatie-logging (LIVE)',
    'marketSummary → OpenAI API → interpretatie (LIVE)',
    'Observatie-logger → Supabase (KLAAR OM IN TE SCHAKELEN)',
    'Ticket-generator → Frontend/notifications (KLAAR)',
    'Exchange sync → Data-provider (WACHT OP CONNECTOREN)'
  ],

  'IMPLEMENTATIE-STAPPEN': [
    {
      stap: 1,
      doen: 'Observatie-logger connecteren aan Supabase',
      bestand: 'src/lib/observation/logger.ts',
      changeline: 'Vervang in-memory Map met Supabase INSERT'
    },
    {
      stap: 2,
      doen: 'Outcome-logger implementeren',
      bestand: 'src/lib/observation/logger.ts',
      changeline: 'Implementeer recordOutcome() met Supabase UPDATE'
    },
    {
      stap: 3,
      doen: 'Learning-laag bouwen',
      bestand: 'src/server/handlers/learningAnalysis.ts (NIEUW)',
      changeline: 'Analyseer outcomes, bouw LearnedPattern objects'
    },
    {
      stap: 4,
      doen: 'Exchange-sync integreren',
      bestand: 'src/lib/exchanges/sync/engine.ts',
      changeline: 'Zet account-data om naar observaties'
    }
  ]
};

// ============================================================
// VOORBEELD 5: DESIGNPRINCIPES (NIET NEGEREN)
// ============================================================

export const DESIGN_PRINCIPLES = {
  'Geen 24/7-activiteit': [
    'Scans draaien handmatig OF op vaste intervallen (bijv. 1x per 4 uur)',
    'GEEN real-time streaming',
    'GEEN push-alerts voor kleine bewegingen'
  ],

  'Observatie > Predictie': [
    'Elke log-entry is "ik zag X onder omstandigheden Y"',
    'GEEN "X zal leiden tot Y"',
    'GEEN certainty-claims'
  ],

  'Tickets zijn informatief, niet dwingend': [
    'Ticket = "let hierop" (laag → hoog priority)',
    'Ticket ≠ "doe dit"',
    'Ticket ≠ "je mist kans"',
    'Ticket ≠ "potentieel +X% rendement"'
  ],

  'Leren zonder risico': [
    'Gebruiker neemt ALLE besluiten',
    'Systeem leert van wat ANDEREN doen',
    'Systeem abstrahieert patronen',
    'Systeem geeft inzicht, niet orders'
  ],

  'Rust en geduld zijn architectuur': [
    'Bouw het zo dat het lang kan kijken zonder druk om te handelen',
    'Outcome-logging kan dagen/weken later gebeuren',
    'Patronen worden LANGZAAM opgebouwd',
    'Geen FOMO-mechanismes'
  ]
};

// ============================================================
// VOORBEELD 6: SUPABASE SCHEMA (READY TO IMPLEMENT)
// ============================================================

export const SUPABASE_SCHEMA_READY = `
-- observations table (vastlegging van waarnemingen)
CREATE TABLE observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  timestamp TIMESTAMP NOT NULL,
  range VARCHAR(10) NOT NULL, -- '1h', '24h', '7d'
  asset_category VARCHAR(10) NOT NULL, -- 'BTC', 'ETH', 'STABLE', 'ALT'
  exchanges TEXT[] NOT NULL, -- array van exchange names
  market_context VARCHAR(50) NOT NULL, -- 'trend-up', 'trend-down', 'range-bound', etc.
  volatility_level VARCHAR(20) NOT NULL, -- 'rustig', 'matig', 'hoog'
  observed_behavior TEXT NOT NULL, -- feitelijke beschrijving
  btc_vs_eth DECIMAL(10,2),
  price_vs_stable DECIMAL(10,2),
  exchange_spread DECIMAL(10,2),
  exchange_anomalies JSONB,
  source VARCHAR(50) NOT NULL, -- 'manual-scan', 'api-monitor', 'alert'
  outcome_logged_at TIMESTAMP,
  outcome JSONB,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- tickets table (informatieve adviezen)
CREATE TABLE tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  type VARCHAR(50) NOT NULL, -- 'observatie', 'advies', 'opportuniteit'
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  confidence VARCHAR(20) NOT NULL, -- 'laag', 'middel', 'hoog'
  priority VARCHAR(20) NOT NULL, -- 'low', 'medium', 'high'
  valid_until TIMESTAMP NOT NULL,
  related_observation_id UUID REFERENCES observations(id),
  pattern TEXT NOT NULL,
  context TEXT NOT NULL,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now()
);

-- learned_patterns table (abstractie van patronen)
CREATE TABLE learned_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  asset_category VARCHAR(10),
  market_context VARCHAR(50),
  occurrences INT DEFAULT 0,
  success_rate DECIMAL(5,2), -- 0-100
  average_duration INTERVAL,
  exchanges TEXT[],
  description TEXT,
  historical_examples JSONB,
  last_observed_at TIMESTAMP,
  confidence VARCHAR(20),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Indexes
CREATE INDEX idx_observations_user_timestamp ON observations(user_id, timestamp DESC);
CREATE INDEX idx_observations_asset_context ON observations(asset_category, market_context);
CREATE INDEX idx_tickets_user_valid ON tickets(user_id, valid_until);
CREATE INDEX idx_tickets_user_created ON tickets(user_id, created_at DESC);
`;

// ============================================================
// CONCLUSIE
// ============================================================

export const TRANSFORMATION_SUMMARY = {
  'Wat is veranderd?': [
    '✅ marketScan loggt nu observaties',
    '✅ marketSummary interpreteert (geen predictie)',
    '✅ Tickets worden gegenereerd (informatief)',
    '✅ Observatie-logger staat klaar',
    '✅ Type-veiligheid gegarandeerd'
  ],

  'Wat is NIET gewijzigd?': [
    '✅ Frontend ziet dezelfde API-responses',
    '✅ Bestaande logica werkt ongewijzigd',
    '✅ Mock-data blijft werken',
    '✅ Exchange-connectoren ongewijzigd'
  ],

  'Volgende stappen?': [
    '1. Observatie-logger → Supabase connecten',
    '2. Outcome-recording implementeren',
    '3. Learning-engine bouwen (abstractie patronen)',
    '4. Frontend: Tickets-widget toevoegen',
    '5. Exchange-sync → observaties'
  ],

  'Kernboodschap': 'Dit is GEEN refactor. Dit is een perspectiefwijziging bovenop dezelfde code. Het systeem kijkt voortaan LÁNGZAAm, observeert geduldig, en leert van wat anderen doen.'
};
