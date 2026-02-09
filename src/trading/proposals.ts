/**
 * PROPOSALS SERVICE
 * 
 * Manages trade proposals: generate, list, accept, modify, decline, expire
 */

import { supabase } from '../../src/lib/supabase/client';

// ============================================================================
// TYPES
// ============================================================================

export type TradeProposalStatus =
  | 'PROPOSED'
  | 'EXPIRED'
  | 'DECLINED'
  | 'APPROVED'
  | 'EXECUTED'
  | 'FAILED';

export type TradeProposal = {
  id: string;
  userId: string;
  status: TradeProposalStatus;
  expiresAt: string;
  asset: string;
  side: 'buy' | 'sell' | 'rebalance' | 'close_position' | 'hold' | 'wait';
  orderType: 'limit' | 'market';
  orderValueEur: number;
  confidence: number; // 0, 25, 50, 75, 100
  rationale: {
    why: string;
    whyNot?: string[];
    nextTrigger?: string;
    riskNotes?: string;
  };
  createdAt: string;
  createdBy: 'AI' | 'USER'; // WHO created the proposal
};

export type TradeAction = {
  id: string;
  userId: string;
  proposalId: string;
  action: 'ACCEPT' | 'MODIFY' | 'DECLINE';
  modifiedFields?: {
    [key: string]: any;
  };
  createdAt: string;
};

// ============================================================================
// PROPOSALS SERVICE
// ============================================================================

export async function createProposal(
  userId: string,
  proposal: Omit<TradeProposal, 'id' | 'userId' | 'createdAt'>
): Promise<TradeProposal | null> {
  // Validate confidence is 0, 25, 50, 75, or 100
  if (![0, 25, 50, 75, 100].includes(proposal.confidence)) {
    console.error('[ProposalService] Invalid confidence:', proposal.confidence);
    return null;
  }

  // Validate status is PROPOSED
  if (proposal.status !== 'PROPOSED') {
    console.error('[ProposalService] New proposals must have status PROPOSED');
    return null;
  }

  const { data, error } = await supabase
    .from('trade_proposals')
    .insert({
      user_id: userId,
      status: proposal.status,
      expires_at: proposal.expiresAt,
      asset: proposal.asset,
      side: proposal.side,
      order_type: proposal.orderType,
      order_value_eur: proposal.orderValueEur,
      confidence: proposal.confidence,
      proposal: {
        asset: proposal.asset,
        side: proposal.side,
        orderType: proposal.orderType,
        orderValueEur: proposal.orderValueEur
      },
      rationale: proposal.rationale,
      created_by: proposal.createdBy
    })
    .select()
    .single();

  if (error) {
    console.error('[ProposalService] createProposal error:', error);
    return null;
  }

  return formatProposal(data);
}

export async function getProposal(userId: string, proposalId: string): Promise<TradeProposal | null> {
  const { data, error } = await supabase
    .from('trade_proposals')
    .select('*')
    .eq('user_id', userId)
    .eq('id', proposalId)
    .single();

  if (error) {
    console.error('[ProposalService] getProposal error:', error);
    return null;
  }

  return formatProposal(data);
}

export async function listProposals(
  userId: string,
  status?: TradeProposalStatus
): Promise<TradeProposal[]> {
  let query = supabase
    .from('trade_proposals')
    .select('*')
    .eq('user_id', userId);

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    console.error('[ProposalService] listProposals error:', error);
    return [];
  }

  return (data || []).map(formatProposal);
}

export async function acceptProposal(userId: string, proposalId: string): Promise<TradeProposal | null> {
  // Get current proposal to verify it's PROPOSED
  const current = await getProposal(userId, proposalId);
  if (!current) return null;

  if (current.status !== 'PROPOSED') {
    console.error('[ProposalService] Can only accept PROPOSED proposals; current status:', current.status);
    return null;
  }

  // Update status to APPROVED
  const { data, error } = await supabase
    .from('trade_proposals')
    .update({ status: 'APPROVED' })
    .eq('user_id', userId)
    .eq('id', proposalId)
    .select()
    .single();

  if (error) {
    console.error('[ProposalService] acceptProposal error:', error);
    return null;
  }

  // Log action
  await logAction(userId, proposalId, 'ACCEPT', null);

  return formatProposal(data);
}

export async function modifyProposal(
  userId: string,
  proposalId: string,
  modifications: Partial<{
    orderValueEur: number;
    confidence: number;
    asset: string;
    side: 'buy' | 'sell';
  }>
): Promise<TradeProposal | null> {
  // Get current proposal
  const current = await getProposal(userId, proposalId);
  if (!current) return null;

  if (current.status !== 'PROPOSED') {
    console.error('[ProposalService] Can only modify PROPOSED proposals');
    return null;
  }

  // Validate confidence if modified
  if (modifications.confidence !== undefined && ![0, 25, 50, 75, 100].includes(modifications.confidence)) {
    console.error('[ProposalService] Invalid confidence:', modifications.confidence);
    return null;
  }

  // Build updated proposal and rationale
  const updatedProposal = {
    asset: modifications.asset ?? current.asset,
    side: modifications.side ?? current.side,
    orderType: current.orderType,
    orderValueEur: modifications.orderValueEur ?? current.orderValueEur
  };

  const { data, error } = await supabase
    .from('trade_proposals')
    .update({
      asset: modifications.asset ?? current.asset,
      side: modifications.side ?? current.side,
      order_value_eur: modifications.orderValueEur ?? current.orderValueEur,
      confidence: modifications.confidence ?? current.confidence,
      proposal: updatedProposal,
      status: 'APPROVED' // Auto-approve on modification
    })
    .eq('user_id', userId)
    .eq('id', proposalId)
    .select()
    .single();

  if (error) {
    console.error('[ProposalService] modifyProposal error:', error);
    return null;
  }

  // Log action with modifications
  await logAction(userId, proposalId, 'MODIFY', modifications);

  return formatProposal(data);
}

export async function declineProposal(userId: string, proposalId: string): Promise<TradeProposal | null> {
  const current = await getProposal(userId, proposalId);
  if (!current) return null;

  if (current.status !== 'PROPOSED') {
    console.error('[ProposalService] Can only decline PROPOSED proposals');
    return null;
  }

  const { data, error } = await supabase
    .from('trade_proposals')
    .update({ status: 'DECLINED' })
    .eq('user_id', userId)
    .eq('id', proposalId)
    .select()
    .single();

  if (error) {
    console.error('[ProposalService] declineProposal error:', error);
    return null;
  }

  // Log action
  await logAction(userId, proposalId, 'DECLINE', null);

  return formatProposal(data);
}

export async function expireProposals(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from('trade_proposals')
    .update({ status: 'EXPIRED' })
    .eq('user_id', userId)
    .eq('status', 'PROPOSED')
    .lt('expires_at', new Date().toISOString())
    .select('id');

  if (error) {
    console.error('[ProposalService] expireProposals error:', error);
    return 0;
  }

  return Array.isArray(data) ? data.length : 0;
}

// ============================================================================
// ACTIONS (USER DECISIONS)
// ============================================================================

export async function logAction(
  userId: string,
  proposalId: string,
  action: 'ACCEPT' | 'MODIFY' | 'DECLINE',
  modifiedFields: any
): Promise<TradeAction | null> {
  const { data, error } = await supabase
    .from('trade_actions')
    .insert({
      user_id: userId,
      proposal_id: proposalId,
      action,
      modified_fields: modifiedFields
    })
    .select()
    .single();

  if (error) {
    console.error('[ProposalService] logAction error:', error);
    return null;
  }

  return formatAction(data);
}

export async function getActions(userId: string, proposalId: string): Promise<TradeAction[]> {
  const { data, error } = await supabase
    .from('trade_actions')
    .select('*')
    .eq('user_id', userId)
    .eq('proposal_id', proposalId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[ProposalService] getActions error:', error);
    return [];
  }

  return (data || []).map(formatAction);
}

// ============================================================================
// HELPERS
// ============================================================================

function formatProposal(row: any): TradeProposal {
  const proposal = row.proposal || {};
  const rationale = row.rationale || {};

  return {
    id: row.id,
    userId: row.user_id,
    status: row.status,
    expiresAt: row.expires_at,
    asset: row.asset || proposal.asset,
    side: row.side || proposal.side,
    orderType: row.order_type || proposal.orderType,
    orderValueEur: row.order_value_eur || proposal.orderValueEur,
    confidence: row.confidence,
    rationale,
    createdAt: row.created_at,
    createdBy: row.created_by || 'AI'
  };
}

function formatAction(row: any): TradeAction {
  return {
    id: row.id,
    userId: row.user_id,
    proposalId: row.proposal_id,
    action: row.action,
    modifiedFields: row.modified_fields,
    createdAt: row.created_at
  };
}
