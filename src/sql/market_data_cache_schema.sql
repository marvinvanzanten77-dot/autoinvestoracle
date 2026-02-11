-- Market Data Cache Table
-- Stores CoinGecko price data for constant availability

CREATE TABLE IF NOT EXISTS market_data_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Asset info
  asset TEXT NOT NULL UNIQUE, -- 'BTC', 'ETH', 'SOL', etc.
  coin_id TEXT, -- CoinGecko coin ID: 'bitcoin', 'ethereum', etc.
  
  -- Price data (EUR as primary)
  price_eur DECIMAL(20, 8),
  price_usd DECIMAL(20, 8),
  
  -- 24h changes
  change_24h_eur DECIMAL(10, 4), -- percentage
  change_24h_usd DECIMAL(10, 4),
  change_7d_eur DECIMAL(10, 4),
  change_7d_usd DECIMAL(10, 4),
  
  -- Market data
  market_cap_eur DECIMAL(20, 2),
  market_cap_usd DECIMAL(20, 2),
  volume_24h_eur DECIMAL(20, 2),
  volume_24h_usd DECIMAL(20, 2),
  
  -- Liquidity & circulation
  circulating_supply DECIMAL(30, 8),
  total_supply DECIMAL(30, 8),
  max_supply DECIMAL(30, 8),
  
  -- Sentiment (Fear & Greed)
  fear_greed_index INT,
  fear_greed_classification TEXT, -- 'Extreme Fear', 'Fear', 'Neutral', 'Greed', 'Extreme Greed'
  
  -- Metadata
  last_updated TIMESTAMP NOT NULL DEFAULT NOW(),
  cache_age_seconds INT GENERATED ALWAYS AS (EXTRACT(EPOCH FROM (NOW() - last_updated))::INT) STORED,
  source TEXT DEFAULT 'coingecko',
  
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_market_data_asset ON market_data_cache(asset);
CREATE INDEX IF NOT EXISTS idx_market_data_last_updated ON market_data_cache(last_updated DESC);

-- Market Data History (optional, for tracking changes)
CREATE TABLE IF NOT EXISTS market_data_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  asset TEXT NOT NULL,
  price_eur DECIMAL(20, 8),
  price_usd DECIMAL(20, 8),
  change_24h_eur DECIMAL(10, 4),
  market_cap_eur DECIMAL(20, 2),
  volume_24h_eur DECIMAL(20, 2),
  
  recorded_at TIMESTAMP NOT NULL DEFAULT NOW(),
  source TEXT DEFAULT 'coingecko'
);

-- Create indexes for history
CREATE INDEX IF NOT EXISTS idx_history_asset ON market_data_history(asset);
CREATE INDEX IF NOT EXISTS idx_history_recorded_at ON market_data_history(recorded_at DESC);

-- Enable RLS
ALTER TABLE market_data_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_data_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Everyone can read, system only can write
CREATE POLICY "Anyone can read market data cache" ON market_data_cache
  FOR SELECT USING (true);

CREATE POLICY "System can insert/update market data" ON market_data_cache
  FOR INSERT WITH CHECK (true);

CREATE POLICY "System can update market data" ON market_data_cache
  FOR UPDATE USING (true);

CREATE POLICY "Anyone can read market history" ON market_data_history
  FOR SELECT USING (true);

CREATE POLICY "System can insert market history" ON market_data_history
  FOR INSERT WITH CHECK (true);
