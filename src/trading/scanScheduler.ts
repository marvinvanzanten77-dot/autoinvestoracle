/**
 * SCAN SCHEDULER SERVICE
 * 
 * Manages hourly (configurable) scans, market pulse generation, GPT gating,
 * and proposal creation through the AITradingAgent
 */

import { supabase } from '../lib/supabase/client';
import { getActivePolicy, getTradingEnabled } from './policy';
import { createProposal, expireProposals } from './proposals';
import { AITradingAgent } from '../../server/ai/tradingAgent';

// ============================================================================
// TYPES
// ============================================================================

export type MarketSnapshot = {
  id: string;
  userId: string;
  timestamp: string;
  volatility24h: number; // 0-100
  priceMoveHour: number; // percentage
  priceMove4h: number;
  volumeZ: number; // z-score
  portfolioValue: number; // EUR
  portfolioChange24h: number; // percentage
  topAssets: Array<{
    asset: string;
    price: number;
    change24h: number;
  }>;
  triggersFired?: string[];
};

export type ScanJob = {
  id: string;
  userId: string;
  status: 'active' | 'paused';
  nextRunAt: string;
  intervalMinutes: number;
  runsToday: number;
  gptCallsToday: number;
  lastResetDate: string;
};

// ============================================================================
// SCHEDULER SERVICE
// ============================================================================

export async function getScanJob(userId: string): Promise<ScanJob | null> {
  const { data, error } = await supabase
    .from('scan_jobs')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error && error.code === 'PGRST116') {
    return null;
  }

  if (error) {
    console.error('[ScanScheduler] getScanJob error:', error);
    return null;
  }

  return formatScanJob(data);
}

export async function initializeScanJob(userId: string, intervalMinutes: number): Promise<ScanJob | null> {
  const nextRun = new Date();
  nextRun.setMinutes(nextRun.getMinutes() + intervalMinutes);

  const { data, error } = await supabase
    .from('scan_jobs')
    .insert({
      user_id: userId,
      status: 'active',
      next_run_at: nextRun.toISOString(),
      interval_minutes: intervalMinutes,
      runs_today: 0,
      gpt_calls_today: 0
    })
    .select()
    .single();

  if (error) {
    console.error('[ScanScheduler] initializeScanJob error:', error);
    return null;
  }

  return formatScanJob(data);
}

export async function pauseScan(userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('scan_jobs')
    .update({ status: 'paused' })
    .eq('user_id', userId);

  if (error) {
    console.error('[ScanScheduler] pauseScan error:', error);
    return false;
  }

  return true;
}

export async function resumeScan(userId: string): Promise<boolean> {
  // Set next_run_at to now + interval
  const job = await getScanJob(userId);
  if (!job) {
    console.error('[ScanScheduler] resumeScan: no scan job found');
    return false;
  }

  const nextRun = new Date();
  nextRun.setMinutes(nextRun.getMinutes() + job.intervalMinutes);

  const { error } = await supabase
    .from('scan_jobs')
    .update({
      status: 'active',
      next_run_at: nextRun.toISOString()
    })
    .eq('user_id', userId);

  if (error) {
    console.error('[ScanScheduler] resumeScan error:', error);
    return false;
  }

  return true;
}

// ============================================================================
// SCAN PIPELINE
// ============================================================================

export async function executeScheduledScans(): Promise<void> {
  console.log('[ScanScheduler] Starting scheduled scans...');

  // Find all active scan jobs due to run
  const { data: jobs, error } = await supabase
    .from('scan_jobs')
    .select('*')
    .eq('status', 'active')
    .lt('next_run_at', new Date().toISOString());

  if (error) {
    console.error('[ScanScheduler] Failed to fetch scan jobs:', error);
    return;
  }

  if (!jobs || jobs.length === 0) {
    console.log('[ScanScheduler] No scans due to run');
    return;
  }

  // Execute each scan
  for (const jobRow of jobs) {
    const job = formatScanJob(jobRow);
    await executeScan(job);
  }
}

async function executeScan(job: ScanJob): Promise<void> {
  const userId = job.userId;
  console.log(`[ScanScheduler] Executing scan for user ${userId}`);

  // Load policy and settings
  const policy = await getActivePolicy(userId);
  if (!policy) {
    console.log(`[ScanScheduler] No active policy for user ${userId}`);
    return;
  }

  const tradingEnabled = await getTradingEnabled(userId);
  if (!tradingEnabled) {
    console.log(`[ScanScheduler] Trading disabled for user ${userId}`);
  }

  // Expire old proposals
  await expireProposals(userId);

  // ========================================================================
  // STEP 1: MARKET PULSE (ALWAYS RUN)
  // ========================================================================
  const snapshot = await generateMarketSnapshot(userId);
  if (!snapshot) {
    console.error(`[ScanScheduler] Failed to generate market snapshot for user ${userId}`);
    return;
  }

  // Store snapshot
  const { error: storeError } = await supabase
    .from('market_snapshots')
    .insert({
      user_id: userId,
      data: snapshot
    });

  if (storeError) {
    console.error(`[ScanScheduler] Failed to store market snapshot:`, storeError);
  }

  // ========================================================================
  // STEP 2: CHECK IF GPT CALL IS NEEDED
  // ========================================================================
  const shouldCallGpt = checkGptGate(policy, snapshot);
  console.log(
    `[ScanScheduler] GPT gate result for user ${userId}:`,
    shouldCallGpt ? 'TRIGGER' : 'NO_TRIGGER'
  );

  if (!shouldCallGpt) {
    // Schedule next run
    await scheduleNextRun(userId, job.intervalMinutes);
    return;
  }

  // ========================================================================
  // STEP 3: CHECK GPT BUDGET
  // ========================================================================
  const { maxGptCallsPerDay, maxGptCallsPerHour } = policy.budget;

  // Simple hour check: get calls from past hour
  const oneHourAgo = new Date();
  oneHourAgo.setHours(oneHourAgo.getHours() - 1);

  const { data: recentProposals, error: recentError } = await supabase
    .from('trade_proposals')
    .select('*')
    .eq('user_id', userId)
    .eq('created_by', 'AI')
    .gte('created_at', oneHourAgo.toISOString());

  if (recentError) {
    console.error('[ScanScheduler] Failed to fetch recent proposals:', recentError);
    return;
  }

  const callsThisHour = recentProposals?.length ?? 0;
  if (callsThisHour >= maxGptCallsPerHour) {
    console.log(
      `[ScanScheduler] GPT hourly budget exhausted for user ${userId}: ${callsThisHour}/${maxGptCallsPerHour}`
    );
    await scheduleNextRun(userId, 60); // Try again in an hour
    return;
  }

  const callsThisDay = job.gptCallsToday + 1;
  if (callsThisDay > maxGptCallsPerDay) {
    console.log(
      `[ScanScheduler] GPT daily budget exhausted for user ${userId}: ${callsThisDay}/${maxGptCallsPerDay}`
    );
    // Schedule for tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    await supabase
      .from('scan_jobs')
      .update({ next_run_at: tomorrow.toISOString() })
      .eq('user_id', userId);
    return;
  }

  // ========================================================================
  // STEP 4: CALL AI TRADING AGENT
  // ========================================================================
  const agent = new AITradingAgent(userId);
  const proposals = await agent.analyzeAndProposeTrades({
    policy,
    marketSnapshot: snapshot
  });

  if (!proposals || proposals.length === 0) {
    console.log(`[ScanScheduler] No proposals generated for user ${userId}`);
    await scheduleNextRun(userId, job.intervalMinutes);
    return;
  }

  // ========================================================================
  // STEP 5: STORE PROPOSALS
  // ========================================================================
  console.log(`[ScanScheduler] Creating ${proposals.length} proposals for user ${userId}`);

  for (const proposal of proposals) {
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 60); // 60-minute expiry

    await createProposal(userId, {
      status: 'PROPOSED',
      expiresAt: expiresAt.toISOString(),
      asset: proposal.asset,
      side: proposal.side,
      orderType: proposal.orderType,
      orderValueEur: proposal.orderValueEur,
      confidence: proposal.confidence,
      rationale: proposal.rationale,
      createdBy: 'AI'
    });
  }

  // ========================================================================
  // STEP 6: UPDATE SCAN JOB
  // ========================================================================
  await supabase
    .from('scan_jobs')
    .update({
      runs_today: job.runsToday + 1,
      gpt_calls_today: job.gptCallsToday + (shouldCallGpt ? 1 : 0)
    })
    .eq('user_id', userId);

  // Schedule next run
  await scheduleNextRun(userId, job.intervalMinutes);
}

// ============================================================================
// MARKET PULSE GENERATION
// ============================================================================

async function generateMarketSnapshot(userId: string): Promise<MarketSnapshot | null> {
  try {
    // In production, this would fetch real market data from Bitvavo, CoinGecko, etc.
    // For now, return a sample snapshot
    const now = new Date();

    const snapshot: MarketSnapshot = {
      id: crypto.randomUUID ? crypto.randomUUID() : `snap_${Date.now()}`,
      userId,
      timestamp: now.toISOString(),
      volatility24h: Math.random() * 100,
      priceMoveHour: (Math.random() - 0.5) * 10,
      priceMove4h: (Math.random() - 0.5) * 20,
      volumeZ: Math.random() * 3,
      portfolioValue: 10000 + Math.random() * 5000,
      portfolioChange24h: (Math.random() - 0.5) * 5,
      topAssets: [
        { asset: 'BTC-EUR', price: 45000, change24h: 2.5 },
        { asset: 'ETH-EUR', price: 2500, change24h: 1.8 }
      ],
      triggersFired: []
    };

    return snapshot;
  } catch (err) {
    console.error('[ScanScheduler] Failed to generate market snapshot:', err);
    return null;
  }
}

// ============================================================================
// GPT GATING LOGIC
// ============================================================================

function checkGptGate(policy: any, snapshot: MarketSnapshot): boolean {
  const gptGate = policy.gptGate || {};

  if (!gptGate.enabled) {
    console.log('[ScanScheduler] GPT gate disabled');
    return false;
  }

  const triggers: string[] = [];

  // Volatility trigger
  if (snapshot.volatility24h >= (gptGate.minVolatilityForGpt || 50)) {
    triggers.push(`volatility_${snapshot.volatility24h.toFixed(1)}%`);
  }

  // Price move triggers
  if (Math.abs(snapshot.priceMoveHour) >= (gptGate.minMovePct1h || 2)) {
    triggers.push(`move1h_${snapshot.priceMoveHour.toFixed(1)}%`);
  }

  if (Math.abs(snapshot.priceMove4h) >= (gptGate.minMovePct4h || 3)) {
    triggers.push(`move4h_${snapshot.priceMove4h.toFixed(1)}%`);
  }

  // Volume trigger
  if (snapshot.volumeZ >= (gptGate.volumeSpikeZ || 1.5)) {
    triggers.push(`volumeZ_${snapshot.volumeZ.toFixed(2)}`);
  }

  if (triggers.length > 0) {
    console.log('[ScanScheduler] GPT triggers fired:', triggers);
    return true;
  }

  console.log('[ScanScheduler] No GPT triggers fired');
  return false;
}

// ============================================================================
// SCHEDULING
// ============================================================================

async function scheduleNextRun(userId: string, intervalMinutes: number): Promise<void> {
  const nextRun = new Date();
  nextRun.setMinutes(nextRun.getMinutes() + intervalMinutes);

  const { error } = await supabase
    .from('scan_jobs')
    .update({ next_run_at: nextRun.toISOString() })
    .eq('user_id', userId);

  if (error) {
    console.error('[ScanScheduler] Failed to schedule next run:', error);
  } else {
    console.log(
      `[ScanScheduler] Next run scheduled for user ${userId} at ${nextRun.toISOString()}`
    );
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function formatScanJob(row: any): ScanJob {
  return {
    id: row.id,
    userId: row.user_id,
    status: row.status,
    nextRunAt: row.next_run_at,
    intervalMinutes: row.interval_minutes,
    runsToday: row.runs_today ?? 0,
    gptCallsToday: row.gpt_calls_today ?? 0,
    lastResetDate: row.last_reset_date
  };
}
