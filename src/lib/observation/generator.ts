/**
 * OBSERVATIE-GENERATOR
 * 
 * Vertaal marktscans naar observaties (feitelijke waarnemingen).
 * Dit is het hart van de heroriëntatie.
 * 
 * INPUT: Marktdata (prijzen, volumes, exchanges)
 * OUTPUT: Observatie (wat zien we? onder welke omstandigheden? op welke exchanges?)
 * 
 * ✅ Wat dit WEL doet:
 * - Vastleggen van wat zichtbaar is
 * - Contextualisering (volatiliteit, trend, range)
 * - Exchange-afwijkingen noemen
 * - Relatieve bewegingen vergelijken
 * 
 * ❌ Wat dit NIET doet:
 * - Voorspellingen doen
 * - Winstkansen berekenen
 * - Trades suggereren
 * - Allocaties optimaliseren
 */

import type { MarketObservation, AssetCategory, MarketContext } from './types';

export type RawMarketData = {
  range: '1h' | '24h' | '7d';
  changes: {
    bitcoin: number;
    ethereum: number;
    stablecoins: number;
    altcoins: number;
  };
  volatility: {
    level: 'rustig' | 'matig' | 'hoog';
  };
  exchanges?: Array<{
    name: string;
    prices?: { bitcoin: number; ethereum: number };
    volume?: number;
  }>;
};

/**
 * Genereer observatie uit marktdata.
 * Dit is ZUIVER beschrijvend, geen predictie.
 */
export function generateObservation(
  userId: string,
  rawData: RawMarketData,
  assetCategory: AssetCategory = 'BTC'
): Partial<MarketObservation> {
  const now = new Date();
  const changes = rawData.changes;
  
  // Bepaal marktcontext (zuiver op basis van wat we zien)
  const marketContext = determineMarketContext(rawData);
  
  // Beschrijf wat we zien (geen voorspellingen)
  const observedBehavior = describeObservedBehavior(rawData, assetCategory);
  
  // Bereken relatieve verhoudingen
  const relativeMomentum = {
    btcVsEth: changes.bitcoin - changes.ethereum,
    priceVsStable: (changes.bitcoin + changes.ethereum) / 2 - changes.stablecoins,
    exchangeSpread: rawData.exchanges ? calculateExchangeSpread(rawData.exchanges) : undefined
  };
  
  // Identificeer afwijkingen per exchange
  const exchangeAnomalies = rawData.exchanges 
    ? findExchangeAnomalies(rawData.exchanges, changes)
    : undefined;
  
  return {
    userId,
    timestamp: now.toISOString(),
    range: rawData.range,
    assetCategory,
    exchanges: rawData.exchanges?.map(e => e.name) || [],
    marketContext,
    volatilityLevel: rawData.volatility.level,
    observedBehavior,
    relativeMomentum,
    exchangeAnomalies: exchangeAnomalies?.length ? exchangeAnomalies : undefined,
    source: 'api-monitor'
  };
}

/**
 * Bepaal zuiver marktcontext op basis van observatie.
 */
function determineMarketContext(data: RawMarketData): MarketContext {
  const vol = data.volatility.level;
  const changes = data.changes;
  
  // Trend detectie: asymmetrische beweging
  const btcEthDiff = Math.abs(changes.bitcoin - changes.ethereum);
  const strongTrend = btcEthDiff > 5;
  
  const totalMovement = Math.abs(changes.bitcoin) + Math.abs(changes.ethereum);
  const isRangebound = totalMovement < 2; // alles beweegt minder dan 2%
  
  if (isRangebound) return 'range-bound';
  if (strongTrend) {
    const avgMovement = (changes.bitcoin + changes.ethereum) / 2;
    return avgMovement > 0 ? 'trend-up' : 'trend-down';
  }
  
  // Fallback naar volatiliteit
  if (vol === 'hoog') return 'hoog-volatiel';
  if (vol === 'matig') return 'matig-volatiel';
  return 'laag-volatiel';
}

/**
 * Beschrijf ZUIVER wat we zien, geen interpretatie.
 */
function describeObservedBehavior(data: RawMarketData, assetCategory: AssetCategory): string {
  const { bitcoin, ethereum, stablecoins, altcoins } = data.changes;
  
  const parts: string[] = [];
  
  // Noem bewegingen feitelijk
  if (Math.abs(bitcoin) > 0.5) {
    parts.push(`Bitcoin ${bitcoin > 0 ? '+' : ''}${bitcoin.toFixed(1)}%`);
  }
  if (Math.abs(ethereum) > 0.5) {
    parts.push(`Ethereum ${ethereum > 0 ? '+' : ''}${ethereum.toFixed(1)}%`);
  }
  if (Math.abs(stablecoins) > 0.5) {
    parts.push(`Stablecoins ${stablecoins > 0 ? '+' : ''}${stablecoins.toFixed(1)}%`);
  }
  if (Math.abs(altcoins) > 0.5) {
    parts.push(`Altcoins ${altcoins > 0 ? '+' : ''}${altcoins.toFixed(1)}%`);
  }
  
  // Noem correlaties
  const btcLeading = bitcoin > ethereum + 1;
  const decoupling = Math.abs(bitcoin - ethereum) > 3;
  
  if (btcLeading) parts.push('Bitcoin leidt');
  if (decoupling) parts.push('BTC en ETH ontkoppeld');
  
  return parts.join(', ') || 'Minimale beweging waargenomen';
}

/**
 * Bereken prijsverschillen tussen exchanges.
 */
function calculateExchangeSpread(exchanges: Array<{ name: string; prices?: any }>): number | undefined {
  const btcPrices = exchanges
    .filter(e => e.prices?.bitcoin)
    .map(e => e.prices.bitcoin);
  
  if (btcPrices.length < 2) return undefined;
  
  const max = Math.max(...btcPrices);
  const min = Math.min(...btcPrices);
  
  return ((max - min) / min) * 100; // in percent
}

/**
 * Vind afwijkingen per exchange (zonder te zeggen of dit goed/slecht is).
 */
function findExchangeAnomalies(
  exchanges: Array<{ name: string; volume?: number; prices?: any }>,
  globalChanges: Record<string, number>
): Array<{ exchange: string; anomaly: string; confidence: 'laag' | 'middel' | 'hoog' }> {
  const anomalies: Array<{ exchange: string; anomaly: string; confidence: 'laag' | 'middel' | 'hoog' }> = [];
  
  // Volume-afwijking
  const avgVolume = exchanges.reduce((sum, e) => sum + (e.volume || 0), 0) / exchanges.length;
  
  for (const ex of exchanges) {
    if (!ex.volume) continue;
    
    const volumeDiff = ((ex.volume - avgVolume) / avgVolume) * 100;
    
    if (Math.abs(volumeDiff) > 30) {
      anomalies.push({
        exchange: ex.name,
        anomaly: `Volume ${volumeDiff > 0 ? 'hoger' : 'lager'} dan gemiddelde (${Math.abs(volumeDiff).toFixed(1)}%)`,
        confidence: Math.abs(volumeDiff) > 60 ? 'hoog' : 'middel'
      });
    }
  }
  
  return anomalies;
}
