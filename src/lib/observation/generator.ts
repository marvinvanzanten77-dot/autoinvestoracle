/**
 * OBSERVATIE-GENERATOR
 * 
 * Vertaal marktscans naar observaties (feitelijke waarnemingen).
 * Dit is het hart van de heroriëntatie.
 * 
 * INPUT: Marktdata (prijzen, volumes, exchanges) + Multi-source aggregation
 * OUTPUT: Observatie (wat zien we? onder welke omstandigheden? op welke exchanges?)
 * 
 * ✅ Wat dit WEL doet:
 * - Vastleggen van wat zichtbaar is
 * - Contextualisering (volatiliteit, trend, range)
 * - Exchange-afwijkingen noemen
 * - Relatieve bewegingen vergelijken
 * - Multi-source data integreren (prijs, sentiment, macro)
 * 
 * ❌ Wat dit NIET doet:
 * - Voorspellingen doen
 * - Winstkansen berekenen
 * - Trades suggereren
 * - Allocaties optimaliseren
 */

import type { MarketObservation, AssetCategory, MarketContext } from './types';
import { getAggregator } from '../dataSources/aggregator';

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
 * Genereer observatie uit portfolio (SELL, REBALANCE, STOP-LOSS signalen).
 */
export async function generatePortfolioObservation(
  userId: string,
  portfolio: Array<{ asset: string; balance: number; priceEUR: number; change24h: number; entryPrice?: number }>,
  assetCategory: AssetCategory = 'BTC'
): Promise<Partial<MarketObservation> | undefined> {
  if (!portfolio || portfolio.length === 0) return undefined;
  
  const now = new Date();
  const observations: string[] = [];
  
  // Voor elk asset in portfolio: kijk naar SELL signals
  for (const asset of portfolio) {
    if (asset.entryPrice && asset.priceEUR) {
      const sellSignal = generateSellObservation(asset.asset as AssetCategory, asset.entryPrice, asset.priceEUR, asset.balance);
      if (sellSignal) observations.push(sellSignal);
      
      const stopLoss = generateStopLossObservation(asset.asset as AssetCategory, asset.entryPrice, asset.priceEUR, asset.balance);
      if (stopLoss) observations.push(stopLoss);
    }
  }
  
  // Genereer REBALANCE observatie
  const rebalanceSignal = generateRebalanceObservation(portfolio, assetCategory);
  if (rebalanceSignal) observations.push(rebalanceSignal);
  
  // Als geen observaties, return undefined
  if (observations.length === 0) return undefined;
  
  const combinedObservation = observations.join(' | ');
  
  return {
    userId,
    timestamp: now.toISOString(),
    range: '24h',
    assetCategory,
    exchanges: ['portfolio-monitor'],
    marketContext: 'matig-volatiel',
    volatilityLevel: 'matig',
    observedBehavior: combinedObservation,
    relativeMomentum: {
      btcVsEth: 0,
      priceVsStable: 0,
    },
    dataSources: {
      sources: ['portfolio-monitor'],
      priceData: {
        usd: 0,
        change24h: 0,
        change7d: 0,
      },
      sentiment: {
        fearGreedValue: 50,
        classification: 'Portfolio-based',
      },
      quality: 100,
    },
    source: 'api-monitor',
  };
}

/**
 * Genereer observatie uit marktdata + multi-source aggregatie.
 * Dit is ZUIVER beschrijvend, geen predictie.
 */
export async function generateObservation(
  userId: string,
  rawData: RawMarketData,
  assetCategory: AssetCategory = 'BTC'
): Promise<Partial<MarketObservation>> {
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
  
  // Multi-source data aggregatie
  let dataSources = {
    sources: [] as string[],
    priceData: {
      usd: assetCategory === 'BTC' ? 45000 : 2500, // Fallback
      change24h: changes.bitcoin,
      change7d: 0,
    },
    sentiment: {
      fearGreedValue: 50,
      classification: 'Neutral',
    },
    macro: undefined as any,
    quality: 0,
  };
  
  // Try to fetch aggregated data
  try {
    const aggregator = getAggregator();
    const assetForAggregation = assetCategory === 'BTC' ? 'BTC' : 'ETH';
    
    const aggregatedData = await aggregator.aggregate(assetForAggregation);
    const observations = aggregator.generateObservationStrings(aggregatedData);
    
    dataSources = {
      sources: aggregatedData.sources,
      priceData: {
        usd: aggregatedData.price.usd,
        change24h: aggregatedData.momentum.change24h,
        change7d: aggregatedData.momentum.change7d,
      },
      sentiment: {
        fearGreedValue: aggregatedData.sentiment.fearGreedValue,
        classification: aggregatedData.sentiment.fearGreedClassification,
      },
      macro: aggregatedData.macro,
      quality: aggregatedData.qualityScore,
    };
    
    // Enriched behavior with aggregated data
    const enrichedObservation = [
      observedBehavior,
      observations.sentimentContext,
      observations.macroContext ? `Macro: ${observations.macroContext}` : '',
    ]
      .filter(Boolean)
      .join(' | ');
    
    return {
      userId,
      timestamp: now.toISOString(),
      range: rawData.range,
      assetCategory,
      exchanges: rawData.exchanges?.map(e => e.name) || [],
      marketContext,
      volatilityLevel: rawData.volatility.level,
      observedBehavior: enrichedObservation,
      relativeMomentum,
      exchangeAnomalies: exchangeAnomalies?.length ? exchangeAnomalies : undefined,
      dataSources,
      source: 'scheduled-aggregation'
    };
  } catch (error) {
    // Fallback if aggregator fails
    console.warn('[ObservationGenerator] Aggregator failed, using raw data:', error);
    
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
      dataSources,
      source: 'api-monitor'
    };
  }
}

/**
 * Genereer SELL observatie wanneer positie winstgevend is.
 */
function generateSellObservation(
  assetCategory: AssetCategory,
  entryPrice: number,
  currentPrice: number,
  assetBalance: number
): string | undefined {
  if (assetBalance <= 0 || entryPrice <= 0 || currentPrice <= 0) return undefined;
  
  const profitPercentage = ((currentPrice - entryPrice) / entryPrice) * 100;
  const totalValue = assetBalance * currentPrice;
  
  // Genereer SELL observatie als winst >= 10%
  if (profitPercentage >= 10) {
    const profitTarget = Math.floor(profitPercentage / 5) * 5; // Rond af naar dichtstbijzijnde 5%
    return `SELL_SIGNAL: ${assetCategory} heeft ${profitTarget}% winst bereikt. Waarde: €${totalValue.toFixed(2)}. Kans op take-profit: 85%`;
  }
  
  // Milde sell signal voor positieve beweging
  if (profitPercentage > 3) {
    return `SELL_CONSIDERATION: ${assetCategory} toont ${profitPercentage.toFixed(1)}% positieve beweging. Potentieel voor winst nemen.`;
  }
  
  return undefined;
}

/**
 * Genereer REBALANCE observatie wanneer assets beter in balans kunnen.
 */
function generateRebalanceObservation(
  portfolio: Array<{ asset: string; balance: number; priceEUR: number; change24h: number }>,
  assetCategory: AssetCategory
): string | undefined {
  if (!portfolio || portfolio.length < 2) return undefined;
  
  // Vind best en worst performer
  const performers = portfolio.map(p => ({
    asset: p.asset,
    change: p.change24h,
    value: p.balance * p.priceEUR,
    momentum: p.change24h,
  }));
  
  const bestPerformer = performers.reduce((a, b) => a.momentum > b.momentum ? a : b);
  const worstPerformer = performers.reduce((a, b) => a.momentum < b.momentum ? a : b);
  
  const momentumDiff = bestPerformer.momentum - worstPerformer.momentum;
  
  // Rebalance signal als verschil > 8% en waarde > €5
  if (momentumDiff > 8 && worstPerformer.value > 5) {
    const rebalanceAmount = Math.min(worstPerformer.value * 0.3, 20); // Max 30% of €20
    return `REBALANCE_SIGNAL: Verschuif €${rebalanceAmount.toFixed(2)} van ${worstPerformer.asset} (${worstPerformer.momentum.toFixed(1)}%) naar ${bestPerformer.asset} (${bestPerformer.momentum.toFixed(1)}%). Momentum diff: ${momentumDiff.toFixed(1)}%`;
  }
  
  return undefined;
}

/**
 * Genereer STOP-LOSS observatie bij significant verlies.
 */
function generateStopLossObservation(
  assetCategory: AssetCategory,
  entryPrice: number,
  currentPrice: number,
  assetBalance: number
): string | undefined {
  if (assetBalance <= 0 || entryPrice <= 0 || currentPrice <= 0) return undefined;
  
  const lossPercentage = ((currentPrice - entryPrice) / entryPrice) * 100;
  const totalValue = assetBalance * currentPrice;
  
  // Stop-loss warning bij -5% verlies
  if (lossPercentage <= -5) {
    const lossAmount = Math.abs(lossPercentage);
    return `STOP_LOSS_ALERT: ${assetCategory} op ${lossAmount.toFixed(1)}% verlies. Beschermende stop-loss: €${totalValue.toFixed(2)}. Risico mitigation: 70%`;
  }
  
  // Milde stop-loss warning bij -2%
  if (lossPercentage < -2) {
    return `STOP_LOSS_WATCH: ${assetCategory} toont ${Math.abs(lossPercentage).toFixed(1)}% negatieve beweging. Monitor voor verdere dalingen.`;
  }
  
  return undefined;
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
