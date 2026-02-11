/**
 * AUTOMATIC MARKET SCAN SCHEDULER
 * 
 * Automatically triggers market scans based on user preferences:
 * - 1h: Every hour
 * - 6h: Every 6 hours
 * - 24h: Every 24 hours
 * - manual: Only via user request
 * 
 * Also tracks scan history and makes results available to:
 * - Agent decision-making
 * - Chat context
 * - Dashboard updates
 */

import type { UnifiedContext } from './unifiedContextService';
import { clearContextCache } from './unifiedContextService';

// ============================================================================
// TYPES
// ============================================================================

export interface MarketScanConfig {
  userId: string;
  interval: '1h' | '6h' | '24h' | 'manual';
  lastScan?: string;
  nextScan?: string;
  isActive?: boolean;
}

export interface ScanResult {
  id: string;
  userId: string;
  timestamp: string;
  duration: number; // milliseconds
  exchange: string;
  findings: {
    volatility: number;
    sentiment: number;
    topOpportunities: Array<{
      symbol: string;
      signal: 'buy' | 'sell' | 'hold';
      confidence: number;
      reasoning: string;
    }>;
    warnings: string[];
    observations: string[];
  };
  dataQuality: number; // 0-100
}

// ============================================================================
// SCHEDULER STATE
// ============================================================================

const scanSchedules = new Map<string, NodeJS.Timeout>();
const scanHistory = new Map<string, ScanResult[]>();

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Initialize scan scheduler for user based on preferences
 */
export async function initializeScanScheduler(
  userId: string,
  interval: '1h' | '6h' | '24h' | 'manual'
): Promise<void> {
  // Clear any existing scheduler for this user
  stopScanScheduler(userId);

  if (interval === 'manual') {
    console.log(`[ScanScheduler] ${userId}: Manual scans only`);
    return;
  }

  const intervalMs = getIntervalMs(interval);
  console.log(`[ScanScheduler] ${userId}: Initializing ${interval} scans`);

  // Run first scan immediately
  await triggerMarketScan(userId, 'bitvavo');

  // Schedule subsequent scans
  const timeoutId = setInterval(async () => {
    await triggerMarketScan(userId, 'bitvavo');
  }, intervalMs);

  scanSchedules.set(userId, timeoutId);
}

/**
 * Stop scan scheduler for user
 */
export function stopScanScheduler(userId: string): void {
  const timeoutId = scanSchedules.get(userId);
  if (timeoutId) {
    clearInterval(timeoutId);
    scanSchedules.delete(userId);
    console.log(`[ScanScheduler] ${userId}: Stopped`);
  }
}

/**
 * Manually trigger a market scan (for manual mode or user request)
 */
export async function triggerMarketScan(
  userId: string,
  exchange: string = 'bitvavo'
): Promise<ScanResult | null> {
  const startTime = Date.now();

  try {
    console.log(`[MarketScan] Starting for ${userId} on ${exchange}`);

    // Call existing market scan endpoint
    const resp = await fetch('/api/trading/scan/now', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, exchange })
    });

    if (!resp.ok) {
      console.error(`[MarketScan] Failed: ${resp.statusText}`);
      return null;
    }

    const scanData = await resp.json();
    const duration = Date.now() - startTime;

    const result: ScanResult = {
      id: `scan_${Date.now()}`,
      userId,
      timestamp: new Date().toISOString(),
      duration,
      exchange,
      findings: scanData.findings || {
        volatility: 50,
        sentiment: 50,
        topOpportunities: [],
        warnings: [],
        observations: scanData.summary ? [scanData.summary] : []
      },
      dataQuality: 85
    };

    // Store in history
    if (!scanHistory.has(userId)) {
      scanHistory.set(userId, []);
    }
    const history = scanHistory.get(userId)!;
    history.unshift(result); // Most recent first
    if (history.length > 50) history.pop(); // Keep last 50 scans

    // Clear context cache so fresh data is fetched
    clearContextCache(userId);

    console.log(`[MarketScan] Complete in ${duration}ms`);
    return result;
  } catch (error) {
    console.error(`[MarketScan] Error: ${error}`);
    return null;
  }
}

/**
 * Get recent scan results for user
 */
export function getRecentScans(userId: string, limit: number = 10): ScanResult[] {
  const history = scanHistory.get(userId) || [];
  return history.slice(0, limit);
}

/**
 * Get latest scan result
 */
export function getLatestScan(userId: string): ScanResult | null {
  const history = scanHistory.get(userId);
  return history && history.length > 0 ? history[0] : null;
}

/**
 * Get scan-based recommendations for chat context
 */
export function getScanRecommendations(userId: string): string[] {
  const latestScan = getLatestScan(userId);
  if (!latestScan) return [];

  const recommendations: string[] = [];

  // Volatility-based
  if (latestScan.findings.volatility > 75) {
    recommendations.push('⚠️ Hoge volatiliteit: Overweeg posities te verkleinen');
  }

  // Sentiment-based
  if (latestScan.findings.sentiment > 75) {
    recommendations.push('📈 Sterke bullish sentiment: Goed moment voor accumulation');
  }
  if (latestScan.findings.sentiment < 25) {
    recommendations.push('📉 Sterke bearish sentiment: Wacht op stabilisatie');
  }

  // Opportunity-based
  const buySignals = latestScan.findings.topOpportunities.filter(o => o.signal === 'buy');
  if (buySignals.length > 0) {
    recommendations.push(
      `💡 ${buySignals.length} buySignal(s): ${buySignals.map(s => s.symbol).join(', ')}`
    );
  }

  // Warnings
  recommendations.push(...latestScan.findings.warnings);

  return recommendations;
}

/**
 * Update scan configuration for user
 */
export async function updateScanConfiguration(
  userId: string,
  newInterval: '1h' | '6h' | '24h' | 'manual'
): Promise<boolean> {
  try {
    // Update in database
    const resp = await fetch('/api/user/scan-interval', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, marketScanInterval: newInterval })
    });

    if (resp.ok) {
      // Update scheduler
      await initializeScanScheduler(userId, newInterval);
      console.log(`[ScanScheduler] Updated ${userId} to ${newInterval}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error('[ScanScheduler] Error updating configuration:', error);
    return false;
  }
}

/**
 * Get next scheduled scan time
 */
export function getNextScanTime(
  userId: string,
  interval: '1h' | '6h' | '24h' | 'manual'
): Date | null {
  if (interval === 'manual') return null;

  const latestScan = getLatestScan(userId);
  if (!latestScan) return new Date(); // Scan now

  const lastScanTime = new Date(latestScan.timestamp);
  const intervalMs = getIntervalMs(interval);
  return new Date(lastScanTime.getTime() + intervalMs);
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getIntervalMs(interval: '1h' | '6h' | '24h' | 'manual'): number {
  switch (interval) {
    case '1h':
      return 60 * 60 * 1000;
    case '6h':
      return 6 * 60 * 60 * 1000;
    case '24h':
      return 24 * 60 * 60 * 1000;
    case 'manual':
      return 0; // Not used
  }
}

/**
 * Format scan results for chat context
 */
export function formatScanResults(scan: ScanResult): string {
  const lines: string[] = [
    `📊 Marktscans (${new Date(scan.timestamp).toLocaleTimeString('nl-NL')}):`,
    `Volatiliteit: ${scan.findings.volatility.toFixed(0)}/100 (${volatilityLabel(scan.findings.volatility)})`,
    `Sentiment: ${scan.findings.sentiment.toFixed(0)}/100 (${sentimentLabel(scan.findings.sentiment)})`
  ];

  if (scan.findings.topOpportunities.length > 0) {
    lines.push(
      `Kansen: ${scan.findings.topOpportunities.map(o => `${o.symbol} (${o.signal})`).join(', ')}`
    );
  }

  if (scan.findings.warnings.length > 0) {
    lines.push(`⚠️ Waarschuwingen: ${scan.findings.warnings.join(', ')}`);
  }

  return lines.join('\n');
}

function volatilityLabel(level: number): string {
  if (level < 20) return 'Laag';
  if (level < 40) return 'Redelijk';
  if (level < 60) return 'Gemiddeld';
  if (level < 80) return 'Hoog';
  return 'Extreem';
}

function sentimentLabel(level: number): string {
  if (level < 25) return 'Extreme Fear';
  if (level < 45) return 'Fear';
  if (level < 55) return 'Neutral';
  if (level < 75) return 'Greed';
  return 'Extreme Greed';
}

/**
 * Initialize all schedulers for active users (call on server startup)
 */
export async function initializeAllScanSchedulers(userConfigs: MarketScanConfig[]): Promise<void> {
  console.log(`[ScanScheduler] Initializing ${userConfigs.length} users`);

  for (const config of userConfigs) {
    if (config.isActive && config.interval !== 'manual') {
      try {
        await initializeScanScheduler(config.userId, config.interval);
      } catch (error) {
        console.error(`[ScanScheduler] Error initializing ${config.userId}:`, error);
      }
    }
  }
}

/**
 * Stop all schedulers (call on server shutdown)
 */
export function stopAllScanSchedulers(): void {
  for (const userId of scanSchedules.keys()) {
    stopScanScheduler(userId);
  }
  scanSchedules.clear();
  console.log('[ScanScheduler] All schedulers stopped');
}
