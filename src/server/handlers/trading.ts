/**
 * TRADING AGENT API HANDLERS
 * 
 * Updated endpoints for safe scan→propose→approve→execute pipeline:
 * - POST /api/trading/policy — Create/update policy
 * - GET /api/trading/policy — Get active policy
 * - POST /api/trading/policy/activate — Activate policy
 * - POST /api/trading/policies/presets/:preset — Create from preset
 * - GET /api/trading/proposals — List proposals
 * - POST /api/trading/proposals/:id/accept — Accept proposal
 * - POST /api/trading/proposals/:id/modify — Modify & approve proposal
 * - POST /api/trading/proposals/:id/decline — Decline proposal
 * - POST /api/trading/scans/pause — Pause scans
 * - POST /api/trading/scans/resume — Resume scans
 * - POST /api/trading/scan/now — Force immediate scan
 * - POST /api/trading/trading-enabled — Set trading enabled
 * - POST /api/trading/scheduler/tick — Internal: scheduler tick
 * 
 * Original endpoints still available:
 * - POST /api/trading/analyze — Get trade signals
 * - POST /api/trading/execute — Execute a trade signal
 * - GET /api/trading/audit — Get audit trail
 */

import type { Request, Response } from 'express';
import { AITradingAgent, type TradeSignal, type AgentContext } from '../../server/ai/tradingAgent';
import { supabase } from '../lib/supabase/client';
import {
  getActivePolicy,
  getPolicyById,
  listPolicies,
  createPolicy,
  updatePolicy,
  activatePolicy,
  getTradingEnabled,
  setTradingEnabled,
  POLICY_PRESETS,
  type AgentPolicy
} from '../../trading/policy';
import {
  getProposal,
  listProposals,
  acceptProposal,
  modifyProposal,
  declineProposal,
  createProposal
} from '../../trading/proposals';
import {
  getScanJob,
  initializeScanJob,
  pauseScan,
  resumeScan,
  executeScheduledScans
} from '../../trading/scanScheduler';

type ApiRequest = Request;
type ApiResponse = Response;

// ============================================================================
// MIDDLEWARE: Validate userId & User Auth
// ============================================================================

function extractUserId(req: ApiRequest): string | null {
  // From Authorization header, session, or query param
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) {
    // In production: verify JWT and extract userId
    return 'user_' + auth.substring(7).substring(0, 8);
  }
  return (req.query.userId as string) || null;
}

function validateServerSecret(req: ApiRequest): boolean {
  const secret = req.headers['x-server-secret'];
  return secret === process.env.SERVER_SECRET;
}

// ============================================================================
// NEW HANDLERS: POLICIES
// ============================================================================

export async function handleGetPolicy(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const userId = extractUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const policy = await getActivePolicy(userId);
    if (!policy) {
      return res.status(404).json({ error: 'No active policy' });
    }

    return res.status(200).json({ success: true, policy });
  } catch (err) {
    console.error('[GetPolicy] Error:', err);
    return res.status(500).json({
      error: 'Failed to get policy',
      details: err instanceof Error ? err.message : 'Unknown error'
    });
  }
}

export async function handleCreatePolicy(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const userId = extractUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { name, config } = (req.body || {}) as {
      name?: string;
      config?: any;
    };

    if (!name || !config) {
      return res.status(400).json({ error: 'Missing name or config' });
    }

    const policy = await createPolicy(userId, name, config);
    if (!policy) {
      return res.status(500).json({ error: 'Failed to create policy' });
    }

    return res.status(201).json({ success: true, policy });
  } catch (err) {
    console.error('[CreatePolicy] Error:', err);
    return res.status(500).json({
      error: 'Failed to create policy',
      details: err instanceof Error ? err.message : 'Unknown error'
    });
  }
}

export async function handleActivatePolicy(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const userId = extractUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { policyId } = (req.body || {}) as { policyId?: string };
    if (!policyId) {
      return res.status(400).json({ error: 'Missing policyId' });
    }

    const success = await activatePolicy(userId, policyId);
    if (!success) {
      return res.status(500).json({ error: 'Failed to activate policy' });
    }

    const policy = await getPolicyById(userId, policyId);
    return res.status(200).json({ success: true, policy });
  } catch (err) {
    console.error('[ActivatePolicy] Error:', err);
    return res.status(500).json({
      error: 'Failed to activate policy',
      details: err instanceof Error ? err.message : 'Unknown error'
    });
  }
}

export async function handleListPolicies(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const userId = extractUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const policies = await listPolicies(userId);
    return res.status(200).json({ success: true, policies, count: policies.length });
  } catch (err) {
    console.error('[ListPolicies] Error:', err);
    return res.status(500).json({
      error: 'Failed to list policies',
      details: err instanceof Error ? err.message : 'Unknown error'
    });
  }
}

export async function handleCreatePolicyFromPreset(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const userId = extractUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { preset } = req.params;
    if (!preset) {
      return res.status(400).json({ error: 'Missing preset' });
    }

    const presetKey = preset.toUpperCase().replace(/-/g, '_') as keyof typeof POLICY_PRESETS;
    if (!(presetKey in POLICY_PRESETS)) {
      return res.status(400).json({
        error: 'Unknown preset',
        available: Object.keys(POLICY_PRESETS)
      });
    }

    const presetConfig = POLICY_PRESETS[presetKey]();
    const policy = await createPolicy(userId, presetConfig.name, presetConfig);

    if (!policy) {
      return res.status(500).json({ error: 'Failed to create policy from preset' });
    }

    return res.status(201).json({ success: true, policy });
  } catch (err) {
    console.error('[CreatePolicyFromPreset] Error:', err);
    return res.status(500).json({
      error: 'Failed to create policy from preset',
      details: err instanceof Error ? err.message : 'Unknown error'
    });
  }
}

// ============================================================================
// NEW HANDLERS: PROPOSALS
// ============================================================================

export async function handleListProposals(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const userId = extractUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { status } = req.query as { status?: string };
    const proposals = await listProposals(userId, status as any);

    return res.status(200).json({
      success: true,
      proposals,
      count: proposals.length,
      status: status || 'all'
    });
  } catch (err) {
    console.error('[ListProposals] Error:', err);
    return res.status(500).json({
      error: 'Failed to list proposals',
      details: err instanceof Error ? err.message : 'Unknown error'
    });
  }
}

export async function handleAcceptProposal(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const userId = extractUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { proposalId } = req.params;
    if (!proposalId) {
      return res.status(400).json({ error: 'Missing proposalId' });
    }

    const proposal = await acceptProposal(userId, proposalId);
    if (!proposal) {
      return res.status(400).json({ error: 'Failed to accept proposal (may be expired or already acted upon)' });
    }

    return res.status(200).json({ success: true, proposal });
  } catch (err) {
    console.error('[AcceptProposal] Error:', err);
    return res.status(500).json({
      error: 'Failed to accept proposal',
      details: err instanceof Error ? err.message : 'Unknown error'
    });
  }
}

export async function handleModifyProposal(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const userId = extractUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { proposalId } = req.params;
    const modifications = (req.body || {}) as any;

    if (!proposalId || !modifications || Object.keys(modifications).length === 0) {
      return res.status(400).json({ error: 'Missing proposalId or modifications' });
    }

    const proposal = await modifyProposal(userId, proposalId, modifications);
    if (!proposal) {
      return res.status(400).json({ error: 'Failed to modify proposal' });
    }

    return res.status(200).json({ success: true, proposal });
  } catch (err) {
    console.error('[ModifyProposal] Error:', err);
    return res.status(500).json({
      error: 'Failed to modify proposal',
      details: err instanceof Error ? err.message : 'Unknown error'
    });
  }
}

export async function handleDeclineProposal(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const userId = extractUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { proposalId } = req.params;
    if (!proposalId) {
      return res.status(400).json({ error: 'Missing proposalId' });
    }

    const proposal = await declineProposal(userId, proposalId);
    if (!proposal) {
      return res.status(400).json({ error: 'Failed to decline proposal' });
    }

    return res.status(200).json({ success: true, proposal });
  } catch (err) {
    console.error('[DeclineProposal] Error:', err);
    return res.status(500).json({
      error: 'Failed to decline proposal',
      details: err instanceof Error ? err.message : 'Unknown error'
    });
  }
}

// ============================================================================
// NEW HANDLERS: SCANNING & EXECUTION
// ============================================================================

export async function handleTradingEnabled(req: ApiRequest, res: ApiResponse) {
  if (req.method === 'GET') {
    try {
      const userId = extractUserId(req);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const enabled = await getTradingEnabled(userId);
      return res.status(200).json({ success: true, tradingEnabled: enabled });
    } catch (err) {
      console.error('[GetTradingEnabled] Error:', err);
      return res.status(500).json({ error: 'Failed to get trading enabled status' });
    }
  } else if (req.method === 'POST') {
    try {
      const userId = extractUserId(req);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const { enabled } = (req.body || {}) as { enabled?: boolean };
      if (enabled === undefined) {
        return res.status(400).json({ error: 'Missing enabled flag' });
      }

      const success = await setTradingEnabled(userId, enabled);
      if (!success) {
        return res.status(500).json({ error: 'Failed to set trading enabled' });
      }

      return res.status(200).json({ success: true, tradingEnabled: enabled });
    } catch (err) {
      console.error('[SetTradingEnabled] Error:', err);
      return res.status(500).json({ error: 'Failed to set trading enabled' });
    }
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

export async function handlePauseScan(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const userId = extractUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const success = await pauseScan(userId);
    if (!success) {
      return res.status(500).json({ error: 'Failed to pause scan' });
    }

    return res.status(200).json({ success: true, message: 'Scans paused' });
  } catch (err) {
    console.error('[PauseScan] Error:', err);
    return res.status(500).json({
      error: 'Failed to pause scan',
      details: err instanceof Error ? err.message : 'Unknown error'
    });
  }
}

export async function handleResumeScan(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const userId = extractUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const success = await resumeScan(userId);
    if (!success) {
      return res.status(500).json({ error: 'Failed to resume scan' });
    }

    return res.status(200).json({ success: true, message: 'Scans resumed' });
  } catch (err) {
    console.error('[ResumeScan] Error:', err);
    return res.status(500).json({
      error: 'Failed to resume scan',
      details: err instanceof Error ? err.message : 'Unknown error'
    });
  }
}

export async function handleForceScan(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const userId = extractUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    // Force immediate execution by setting next_run_at to now
    const { error } = await supabase
      .from('scan_jobs')
      .update({ next_run_at: new Date().toISOString() })
      .eq('user_id', userId);

    if (error) {
      console.error('[ForceScan] Update error:', error);
      return res.status(500).json({ error: 'Failed to force scan' });
    }

    return res.status(200).json({ success: true, message: 'Scan scheduled to run immediately' });
  } catch (err) {
    console.error('[ForceScan] Error:', err);
    return res.status(500).json({
      error: 'Failed to force scan',
      details: err instanceof Error ? err.message : 'Unknown error'
    });
  }
}

export async function handleSchedulerTick(req: ApiRequest, res: ApiResponse) {
  // INTERNAL ENDPOINT: Requires server secret
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!validateServerSecret(req)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    console.log('[SchedulerTick] Starting scheduled scan execution...');
    await executeScheduledScans();

    return res.status(200).json({
      success: true,
      message: 'Scheduled scans executed',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('[SchedulerTick] Error:', err);
    return res.status(500).json({
      error: 'Failed to execute scheduled scans',
      details: err instanceof Error ? err.message : 'Unknown error'
    });
  }
}

// ============================================================================
// UPDATED HANDLER: Execute Trade (now checks for APPROVED status)
// ============================================================================

export async function handleTradingExecuteUpdated(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const userId = extractUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { proposalId } = (req.body || {}) as {
      proposalId?: string;
    };

    if (!proposalId) {
      return res.status(400).json({ error: 'Missing proposalId' });
    }

    // Step 1: Check trading enabled
    const tradingEnabled = await getTradingEnabled(userId);
    if (!tradingEnabled) {
      return res.status(403).json({ error: 'Trading is disabled' });
    }

    // Step 2: Check proposal is APPROVED
    const proposal = await getProposal(userId, proposalId);
    if (!proposal) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    if (proposal.status !== 'APPROVED') {
      return res.status(400).json({
        error: `Proposal must be APPROVED to execute; current status: ${proposal.status}`
      });
    }

    // Step 3: Check expiry
    if (new Date(proposal.expiresAt) < new Date()) {
      return res.status(400).json({ error: 'Proposal has expired' });
    }

    // Step 4: Load policy for risk checks
    const policy = await getActivePolicy(userId);
    if (!policy) {
      return res.status(400).json({ error: 'No active policy; cannot execute' });
    }

    // Step 5: Run pre-flight checks
    const preflightErrors = validatePreflight(proposal, policy);
    if (preflightErrors.length > 0) {
      return res.status(400).json({
        error: 'Pre-flight check failed',
        reasons: preflightErrors
      });
    }

    // Step 6: Execute trade (deterministic)
    // This will call Bitvavo API with trading key
    const agent = new AITradingAgent(userId);
    const result = await agent.executeTrade({
      asset: proposal.asset,
      action: proposal.side === 'buy' ? 'BUY' : 'SELL',
      quantity: proposal.orderValueEur / 1, // Simple calculation; adjust as needed
      price: 0, // Market order
      confidence: proposal.confidence,
      riskLevel: 'medium',
      rationale: proposal.rationale
    }, null as any);

    // Log to Supabase
    await supabase
      .from('trading_executions')
      .insert({
        user_id: userId,
        proposal_id: proposalId,
        asset: proposal.asset,
        action: proposal.side.toUpperCase(),
        quantity: 0, // Placeholder
        price: 0,
        success: result.success,
        message: result.message,
        order_id: result.orderId,
        created_at: new Date().toISOString()
      })
      .catch((err) => {
        console.warn('[TradingExecuteUpdated] Failed to log execution:', err);
      });

    return res.status(200).json({
      success: result.success,
      orderId: result.orderId,
      message: result.message
    });
  } catch (err) {
    console.error('[TradingExecuteUpdated] Error:', err);
    return res.status(500).json({
      error: 'Failed to execute trade',
      details: err instanceof Error ? err.message : 'Unknown error'
    });
  }
}

// ============================================================================
// ORIGINAL HANDLERS (kept for backward compatibility)
// ============================================================================

// ============================================================================
// HANDLER 1: Analyze Market & Get Trade Signals
// ============================================================================

export async function handleTradingAnalyze(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const userId = extractUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { context } = (req.body || {}) as {
      context?: AgentContext;
    };

    if (!context) {
      return res.status(400).json({ error: 'Missing context' });
    }

    // Validate context structure
    if (!context.portfolio || !context.market || !context.profile) {
      return res.status(400).json({ error: 'Incomplete context' });
    }

    console.log(`[TradingAnalyze] Request from ${userId}`);

    // Initialize agent
    const agent = new AITradingAgent();

    // Get trade signals
    const signals = await agent.analyzeAndProposeTrades(context);

    // Log signals to Supabase (for audit)
    if (signals.length > 0) {
      await supabase
        .from('trading_signals')
        .insert(
          signals.map((s) => ({
            user_id: userId,
            asset: s.asset,
            action: s.action,
            confidence: s.confidence,
            quantity: s.quantity,
            price: s.price,
            rationale: s.rationale,
            risk_level: s.riskLevel,
            created_at: new Date().toISOString()
          }))
        )
        .catch((err) => {
          console.warn('[TradingAnalyze] Failed to log signals:', err);
          // Don't fail the response if logging fails
        });
    }

    return res.status(200).json({
      success: true,
      signals,
      count: signals.length,
      timestamp: new Date().toISOString(),
      message: `Generated ${signals.length} trade signal(s)`
    });
  } catch (err) {
    console.error('[TradingAnalyze] Error:', err);
    return res.status(500).json({
      error: 'Failed to analyze market',
      details: err instanceof Error ? err.message : 'Unknown error'
    });
  }
}

// ============================================================================
// HANDLER 2: Execute a Trade Signal
// ============================================================================

export async function handleTradingExecute(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const userId = extractUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { signal, context } = (req.body || {}) as {
      signal?: TradeSignal;
      context?: AgentContext;
    };

    if (!signal || !context) {
      return res.status(400).json({ error: 'Missing signal or context' });
    }

    console.log(`[TradingExecute] ${signal.action} ${signal.asset} from ${userId}`);

    // Additional safety check: verify confidence is reasonable
    if (signal.confidence < 25) {
      console.warn(`[TradingExecute] Low confidence (${signal.confidence}%), rejecting`);
      return res.status(400).json({
        error: 'Signal confidence too low',
        confidence: signal.confidence
      });
    }

    // CRITICAL: In production, this would:
    // 1. Fetch live exchange credentials from secure storage
    // 2. Initialize connector with user's keys
    // 3. Execute actual order
    // 4. Handle order confirmation/rejection
    // 5. Update position state in database

    const agent = new AITradingAgent();

    // For now: simulate execution (actual implementation requires exchange connector)
    const result = await agent.executeTrade(signal, context, null as any);

    // Log execution to Supabase
    await supabase
      .from('trading_executions')
      .insert({
        user_id: userId,
        audit_id: result.auditId,
        asset: result.asset,
        action: result.action,
        quantity: result.quantity,
        price: result.price,
        success: result.success,
        message: result.message,
        fee: result.fee,
        total_value: result.totalValue,
        order_id: result.orderId,
        created_at: result.timestamp
      })
      .catch((err) => {
        console.warn('[TradingExecute] Failed to log execution:', err);
      });

    const statusCode = result.success ? 200 : 400;
    return res.status(statusCode).json(result);
  } catch (err) {
    console.error('[TradingExecute] Error:', err);
    return res.status(500).json({
      error: 'Failed to execute trade',
      details: err instanceof Error ? err.message : 'Unknown error'
    });
  }
}

// ============================================================================
// HANDLER 3: Get Trading Audit Trail
// ============================================================================

export async function handleTradingAudit(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const userId = extractUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { limit, offset } = req.query as {
      limit?: string;
      offset?: string;
    };

    const limitNum = Math.min(parseInt(limit || '50'), 500);
    const offsetNum = parseInt(offset || '0');

    console.log(`[TradingAudit] Fetching for ${userId} (limit: ${limitNum}, offset: ${offsetNum})`);

    // Query from Supabase
    const { data, error, count } = await supabase
      .from('trading_executions')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offsetNum, offsetNum + limitNum - 1);

    if (error) {
      console.error('[TradingAudit] Query error:', error);
      return res.status(500).json({
        error: 'Failed to fetch audit trail',
        details: error.message
      });
    }

    return res.status(200).json({
      success: true,
      executions: data || [],
      count: count || 0,
      limit: limitNum,
      offset: offsetNum,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('[TradingAudit] Error:', err);
    return res.status(500).json({
      error: 'Failed to fetch audit trail',
      details: err instanceof Error ? err.message : 'Unknown error'
    });
  }
}

// ============================================================================
// HANDLER 4: Get Recent Signals (for UI review)
// ============================================================================

export async function handleTradingSignals(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const userId = extractUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { hoursBack } = req.query as { hoursBack?: string };
    const hours = parseInt(hoursBack || '24');
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    console.log(`[TradingSignals] Fetching for ${userId} from past ${hours}h`);

    const { data, error } = await supabase
      .from('trading_signals')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('[TradingSignals] Query error:', error);
      return res.status(500).json({
        error: 'Failed to fetch signals',
        details: error.message
      });
    }

    return res.status(200).json({
      success: true,
      signals: data || [],
      count: (data || []).length,
      hoursBack: hours,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('[TradingSignals] Error:', err);
    return res.status(500).json({
      error: 'Failed to fetch signals',
      details: err instanceof Error ? err.message : 'Unknown error'
    });
  }
}

// ============================================================================
// HELPER: Transform Supabase response to frontend format
// ============================================================================

function formatExecutionForUI(execution: any) {
  return {
    id: execution.audit_id,
    action: execution.action,
    asset: execution.asset,
    quantity: execution.quantity,
    price: execution.price,
    total: execution.total_value,
    fee: execution.fee,
    success: execution.success,
    status: execution.success ? 'executed' : 'rejected',
    orderId: execution.order_id,
    timestamp: new Date(execution.created_at).toLocaleString('nl-NL'),
    message: execution.message
  };
}

// ============================================================================
// PRE-FLIGHT VALIDATION
// ============================================================================

function validatePreflight(proposal: any, policy: any): string[] {
  const errors: string[] = [];

  // Check order value within bounds
  const minOrder = policy.risk?.minOrderEur || 25;
  const maxOrder = policy.risk?.maxOrderEur || 50;

  if (proposal.orderValueEur < minOrder) {
    errors.push(`Order value too low: €${proposal.orderValueEur} < minimum €${minOrder}`);
  }
  if (proposal.orderValueEur > maxOrder) {
    errors.push(`Order value too high: €${proposal.orderValueEur} > maximum €${maxOrder}`);
  }

  // Check confidence level
  const allowedConfidences = policy.signal?.allowedConfidences || [75, 100];
  if (!allowedConfidences.includes(proposal.confidence)) {
    errors.push(`Confidence ${proposal.confidence}% not in allowed list: ${allowedConfidences.join(', ')}`);
  }

  // Check asset allowlist
  const allowlist = policy.assets?.allowlist || [];
  if (allowlist.length > 0 && !allowlist.includes(proposal.asset)) {
    errors.push(`Asset ${proposal.asset} not in allowlist: ${allowlist.join(', ')}`);
  }

  return errors;
}
