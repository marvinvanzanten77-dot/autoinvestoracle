/**
 * EXECUTION RECONCILIATION MODULE
 *
 * Handles unknown outcomes: when Bitvavo accepts an order but response is lost.
 *
 * Core pattern:
 * 1. Before any placeOrder() call: set status = SUBMITTING
 * 2. If timeout/network error: clientOrderId + reconcile finds it
 * 3. No double-order possible (clientOrderId is idempotent)
 *
 * Production observability:
 * - Every state transition logged via log_execution_event()
 * - Error classification: SOFT (retry-able) vs HARD (not retry-able)
 * - Reconcile attempt counter: max 12 attempts, then escalate
 * - Recovery metrics: tracked for promotion criteria
 *
 * Based on https://github.com/aws/moto/issues/4119 and exchange best practices
 */

import { supabase } from '../lib/supabase/client';
import { getBitvavoTrade } from '../exchange/bitvavoTrade';

export type ExecStatus = 'PENDING' | 'SUBMITTING' | 'SUBMITTED' | 'FILLED' | 'FAILED' | 'CANCELLED';
export type ErrorClass = 'SOFT' | 'HARD';  // SOFT = timeout/network, HARD = auth/invalid/schema

/**
 * Classify error as soft (retry-able) or hard (not retry-able)
 * 
 * SOFT: timeout, network issues, 5xx errors → can retry with reconcile
 * HARD: auth failure, invalid symbol, schema error → don't retry
 */
export function classifyError(err: any): ErrorClass {
  const msg = String(err?.message || err).toLowerCase();
  
  // Hard failures (no retry)
  if (msg.includes('auth') || msg.includes('forbidden') || msg.includes('401') || msg.includes('403')) return 'HARD';
  if (msg.includes('invalid') || msg.includes('schema') || msg.includes('bad request') || msg.includes('400')) return 'HARD';
  if (msg.includes('not found') || msg.includes('404')) return 'HARD';
  if (msg.includes('insufficient balance') || msg.includes('insufficient funds')) return 'HARD';
  
  // Soft failures (retry-able)
  if (msg.includes('timeout') || msg.includes('econnrefused') || msg.includes('enotfound')) return 'SOFT';
  if (msg.includes('5xx') || msg.includes('service unavailable') || msg.includes('gateway')) return 'SOFT';
  if (msg.includes('network') || msg.includes('econnreset') || msg.includes('socket')) return 'SOFT';
  
  // Default: assume soft (network-ish)
  return 'SOFT';
}

const SUBMITTING_TTL_MS = 30_000; // 30 seconds: if SUBMITTING older than this, reconcile first

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Deterministic client order ID: based on execution ID
 * Format: "IV-" + first 20 chars of UUID (without dashes)
 * 
 * Advantage: reproducible on retry; no need to store/regenerate
 */
export function deterministicClientOrderId(executionId: string): string {
  return 'IV-' + executionId.replace(/-/g, '').slice(0, 20);
}

/**
 * SUBMIT OR RETRY EXECUTION
 *
 * Core logic:
 * 1. Lock row (SELECT ... FOR UPDATE in transaction)
 * 2. Decide: return existing? wait? reconcile? or submit new?
 * 3. Only submit if status allows it (no double-submit)
 * 4. On success: SUBMITTED + order_id
 * 5. On error: FAILED + error message
 *
 * Returns: { ok, state, ... }
 * - state: "already_has_order_id" | "submitting_in_progress" | "reconciled" | "submitted" | "failed"
 */
export async function submitOrRetryExecution(
  executionId: string,
  userId: string
): Promise<{
  ok: boolean;
  state: string;
  execution?: any;
  orderId?: string;
  clientOrderId?: string;
  error?: string;
}> {
  try {
    // 1) Transaction: lock row + decide
    const decision = await supabase.rpc('lock_and_decide_execution', {
      p_execution_id: executionId,
      p_submitting_ttl_ms: SUBMITTING_TTL_MS
    });

    if (decision.error) {
      return { ok: false, state: 'lock_failed', error: decision.error.message };
    }

    const { action, execution } = decision.data || {};

    if (!action) {
      return { ok: false, state: 'no_decision', error: 'Lock returned no decision' };
    }

    // 2) Act based on decision
    if (action === 'RETURN_EXISTING') {
      return {
        ok: true,
        state: 'already_has_order_id',
        execution,
        orderId: execution.bitvavo_order_id,
        clientOrderId: execution.client_order_id
      };
    }

    if (action === 'WAIT_OR_RECONCILE') {
      // SUBMITTING is in-flight and recent. Caller should wait or trigger reconcile.
      return {
        ok: true,
        state: 'submitting_in_progress',
        execution,
        clientOrderId: execution.client_order_id
      };
    }

    if (action === 'RECONCILE_FIRST') {
      // Status is SUBMITTED/FILLED but no order_id, or SUBMITTING TTL expired
      const recon = await reconcileByClientOrderId(executionId, userId);
      return {
        ok: true,
        state: recon.state,
        execution: recon.execution,
        orderId: recon.orderId,
        clientOrderId: recon.clientOrderId,
        ...recon
      };
    }

    if (action === 'PLACE_ORDER') {
      // Claim submit-rights: status is now SUBMITTING, clientOrderId is set
      const clientOrderId = execution.client_order_id || deterministicClientOrderId(executionId);
      const submissionStartTime = Date.now();

      try {
        // Place order with clientOrderId for idempotency
        const bitvavo = getBitvavoTrade();
        const proposal = execution.proposal_data; // Should be fetched before calling this

        const bitvavaResponse = await bitvavo.placeOrder({
          market: proposal.asset,
          side: proposal.side as 'buy' | 'sell',
          orderType: proposal.orderType as 'limit' | 'market',
          amount: (proposal.orderValueEur / 1).toString(),
          price: proposal.side === 'buy' ? '0' : '0', // Market order
          clientOrderId // KEY: idempotency
        });

        if (!bitvavaResponse || !bitvavaResponse.orderId) {
          throw new Error('No orderId in Bitvavo response');
        }

        // Success: mark SUBMITTED
        await supabase
          .from('trade_executions')
          .update({
            status: 'SUBMITTED',
            bitvavo_order_id: bitvavaResponse.orderId,
            bitvavo_response: bitvavaResponse,
            submitted_at: nowIso(),
            updated_at: nowIso()
          })
          .eq('id', executionId);

        // Log event: SUBMITTED
        const latencyMs = Date.now() - submissionStartTime;
        await supabase.rpc('log_execution_event', {
          p_execution_id: executionId,
          p_user_id: userId,
          p_from_status: 'SUBMITTING',
          p_to_status: 'SUBMITTED',
          p_decision_path: 'PLACE_ORDER_SUCCESS',
          p_client_order_id: clientOrderId,
          p_bitvavo_order_id: bitvavaResponse.orderId,
          p_error_class: null,
          p_error_message: null,
          p_bitvavo_latency_ms: latencyMs,
          p_reconcile_attempt_number: null
        }).catch((err) => console.warn('[submitOrRetryExecution] Failed to log success:', err));

        return {
          ok: true,
          state: 'submitted',
          execution,
          orderId: bitvavaResponse.orderId,
          clientOrderId
        };
      } catch (err: any) {
        // Error: classify as SOFT (retry-able) or HARD (not retry-able)
        const errorMsg = err?.message || String(err);
        const errorClass = classifyError(err);

        if (errorClass === 'HARD') {
          // Hard failure: mark FAILED immediately, don't keep SUBMITTING
          await supabase
            .from('trade_executions')
            .update({
              status: 'FAILED',
              last_error: errorMsg,
              failed_at: nowIso(),
              updated_at: nowIso()
            })
            .eq('id', executionId);

          // Log event: HARD failure
          await supabase.rpc('log_execution_event', {
            p_execution_id: executionId,
            p_user_id: userId,
            p_from_status: 'SUBMITTING',
            p_to_status: 'FAILED',
            p_decision_path: 'PLACE_ORDER_HARD_FAIL',
            p_client_order_id: clientOrderId,
            p_bitvavo_order_id: null,
            p_error_class: 'HARD',
            p_error_message: errorMsg,
            p_reconcile_attempt_number: null
          }).catch((err) => console.warn('[submitOrRetryExecution] Failed to log HARD error:', err));

          return {
            ok: false,
            state: 'place_order_failed',
            execution,
            error: errorMsg,
            clientOrderId
          };
        } else {
          // Soft failure: keep SUBMITTING, let reconcile job pick it up
          // Don't change status; just log the error attempt
          await supabase
            .from('trade_executions')
            .update({
              last_error: errorMsg,
              updated_at: nowIso()
            })
            .eq('id', executionId);

          // Log event: SOFT failure, reconcile will retry
          await supabase.rpc('log_execution_event', {
            p_execution_id: executionId,
            p_user_id: userId,
            p_from_status: 'SUBMITTING',
            p_to_status: 'SUBMITTING', // Stays in SUBMITTING for reconcile
            p_decision_path: 'PLACE_ORDER_SOFT_FAIL',
            p_client_order_id: clientOrderId,
            p_bitvavo_order_id: null,
            p_error_class: 'SOFT',
            p_error_message: errorMsg,
            p_reconcile_attempt_number: null
          }).catch((err) => console.warn('[submitOrRetryExecution] Failed to log SOFT error:', err));

          // Return: keep SUBMITTING, caller should trigger reconcile or wait
          return {
            ok: false,
            state: 'place_order_soft_fail',
            execution,
            error: errorMsg,
            clientOrderId
          };
        }
      }
    }

    return { ok: false, state: 'unknown_action', error: `Unknown action: ${action}` };
  } catch (err: any) {
    return {
      ok: false,
      state: 'error',
      error: err?.message || String(err)
    };
  }
}

/**
 * RECONCILE BY CLIENT ORDER ID
 *
 * Goal: recover from "Bitvavo accepted order but we lost response" by querying
 * the exchange with the deterministic clientOrderId.
 *
 * Safety mechanisms:
 * - Attempt counter (max 12 = 1h at 5-min interval)
 * - Escalation if too many attempts (marks FAILED + logs escalation)
 * - Event logging for observability & recovery rate metrics
 *
 * Returns: { state, orderId?, clientOrderId, execution?, error?, attemptNumber? }
 * - state: "already_reconciled" | "found_on_exchange" | "not_found_on_exchange" | "escalated" | "error"
 */
export async function reconcileByClientOrderId(
  executionId: string,
  userId: string
): Promise<{
  state: string;
  orderId?: string;
  clientOrderId?: string;
  execution?: any;
  error?: string;
  attemptNumber?: number;
}> {
  try {
    // Fetch execution record
    const { data: execData, error: fetchErr } = await supabase
      .from('trade_executions')
      .select('*')
      .eq('id', executionId)
      .eq('user_id', userId)
      .single();

    if (fetchErr || !execData) {
      return {
        state: 'error',
        error: `Execution not found: ${fetchErr?.message || 'unknown'}`
      };
    }

    const execution = execData;

    // Check reconcile attempt counter (max 12 attempts = 1 hour at 5-min interval)
    const attemptNumber = (execution.reconcile_attempts || 0) + 1;
    const MAX_RECONCILE_ATTEMPTS = 12;

    if (attemptNumber > MAX_RECONCILE_ATTEMPTS) {
      // Escalate to manual review
      await supabase
        .from('trade_executions')
        .update({
          status: 'FAILED',
          last_error: `Reconcile escalated after ${attemptNumber} attempts (max ${MAX_RECONCILE_ATTEMPTS})`,
          failed_at: nowIso(),
          updated_at: nowIso()
        })
        .eq('id', executionId);

      // Log event: escalation
      await supabase.rpc('log_execution_event', {
        p_execution_id: executionId,
        p_user_id: userId,
        p_from_status: execution.status,
        p_to_status: 'FAILED',
        p_decision_path: 'RECONCILE_ESCALATED',
        p_client_order_id: execution.client_order_id,
        p_bitvavo_order_id: null,
        p_error_class: 'SOFT',
        p_error_message: `Max reconcile attempts (${MAX_RECONCILE_ATTEMPTS}) exceeded`,
        p_reconcile_attempt_number: attemptNumber
      }).catch((err) => console.warn('[reconcileByClientOrderId] Failed to log escalation:', err));

      return {
        state: 'escalated',
        clientOrderId: execution.client_order_id,
        error: `Reconcile escalated after ${attemptNumber} attempts`,
        attemptNumber
      };
    }

    // If already has order_id, we're done
    if (execution.bitvavo_order_id) {
      return {
        state: 'already_reconciled',
        orderId: execution.bitvavo_order_id,
        clientOrderId: execution.client_order_id,
        execution,
        attemptNumber
      };
    }

    // Ensure clientOrderId exists
    const clientOrderId = execution.client_order_id || deterministicClientOrderId(executionId);

    if (!execution.client_order_id) {
      await supabase
        .from('trade_executions')
        .update({
          client_order_id: clientOrderId,
          updated_at: nowIso()
        })
        .eq('id', executionId)
        .catch((err) => console.warn('[reconcileByClientOrderId] Failed to set client_order_id:', err));
    }

    // Increment reconcile attempt counter
    await supabase
      .from('trade_executions')
      .update({
        reconcile_attempts: attemptNumber,
        updated_at: nowIso()
      })
      .eq('id', executionId)
      .catch((err) => console.warn('[reconcileByClientOrderId] Failed to increment attempts:', err));

    // Query Bitvavo: look for order with this clientOrderId
    const bitvavo = getBitvavoTrade();
    const startTime = Date.now();
    const found = await bitvavo.findOrderByClientOrderId(clientOrderId);
    const latencyMs = Date.now() - startTime;

    if (found && found.orderId) {
      // Found on exchange: update execution record
      const exchangeStatus = (found.status || '').toUpperCase();
      const mappedStatus: ExecStatus =
        exchangeStatus === 'FILLED'
          ? 'FILLED'
          : exchangeStatus === 'CANCELED'
            ? 'CANCELLED'
            : 'SUBMITTED';

      await supabase
        .from('trade_executions')
        .update({
          bitvavo_order_id: found.orderId,
          status: mappedStatus,
          bitvavo_response: found,
          reconciled_at: nowIso(),
          updated_at: nowIso()
        })
        .eq('id', executionId);

      // Log event: reconcile SUCCESS
      await supabase.rpc('log_execution_event', {
        p_execution_id: executionId,
        p_user_id: userId,
        p_from_status: execution.status,
        p_to_status: mappedStatus,
        p_decision_path: 'RECONCILE_FOUND',
        p_client_order_id: clientOrderId,
        p_bitvavo_order_id: found.orderId,
        p_error_class: null,
        p_error_message: null,
        p_bitvavo_latency_ms: latencyMs,
        p_reconcile_attempt_number: attemptNumber
      }).catch((err) => console.warn('[reconcileByClientOrderId] Failed to log event:', err));

      console.log(
        `[reconcileByClientOrderId] Found order: ${found.orderId} via clientOrderId (attempt ${attemptNumber})`
      );

      return {
        state: 'found_on_exchange',
        orderId: found.orderId,
        clientOrderId,
        execution: { ...execution, bitvavo_order_id: found.orderId, status: mappedStatus },
        attemptNumber
      };
    }

    // Not found on exchange: mark FAILED
    await supabase
      .from('trade_executions')
      .update({
        status: 'FAILED',
        last_error: 'Reconcile: no order found on exchange for clientOrderId',
        failed_at: nowIso(),
        updated_at: nowIso()
      })
      .eq('id', executionId);

    // Log event: reconcile NOT FOUND
    await supabase.rpc('log_execution_event', {
      p_execution_id: executionId,
      p_user_id: userId,
      p_from_status: execution.status,
      p_to_status: 'FAILED',
      p_decision_path: 'RECONCILE_NOT_FOUND',
      p_client_order_id: clientOrderId,
      p_bitvavo_order_id: null,
      p_error_class: 'SOFT',
      p_error_message: 'Reconcile: no order found on exchange',
      p_bitvavo_latency_ms: latencyMs,
      p_reconcile_attempt_number: attemptNumber
    }).catch((err) => console.warn('[reconcileByClientOrderId] Failed to log event:', err));

    console.log(
      `[reconcileByClientOrderId] NOT found on exchange for clientOrderId (attempt ${attemptNumber})`
    );

    return {
      state: 'not_found_on_exchange',
      clientOrderId,
      execution: { ...execution, status: 'FAILED' },
      attemptNumber
    };
  } catch (err: any) {
    return {
      state: 'error',
      error: err?.message || String(err)
    };
  }
}

/**
 * RECONCILE STALE SUBMITTING (background job / cron)
 *
 * Finds executions stuck in SUBMITTING state for too long,
 * attempts reconcile, and updates status.
 *
 * Useful as: scheduled job (every 5 min) or triggered on retry path.
 */
export async function reconcileStaleSubmitting(maxAgeSec: number = 120): Promise<{
  checked: number;
  reconciled: number;
  failed: number;
  errors: string[];
}> {
  try {
    // Find SUBMITTING older than maxAgeSec
    const cutoff = new Date(Date.now() - maxAgeSec * 1000).toISOString();

    const { data: staleExecs, error: fetchErr } = await supabase
      .from('trade_executions')
      .select('id, user_id, client_order_id')
      .eq('status', 'SUBMITTING')
      .lt('submitting_at', cutoff)
      .limit(100);

    if (fetchErr) {
      return {
        checked: 0,
        reconciled: 0,
        failed: 0,
        errors: [fetchErr.message]
      };
    }

    const errors: string[] = [];
    let reconciled = 0;
    let failed = 0;

    for (const exec of staleExecs || []) {
      try {
        const result = await reconcileByClientOrderId(exec.id, exec.user_id);

        if (result.state === 'found_on_exchange' || result.state === 'not_found_on_exchange') {
          reconciled++;
        } else if (result.state === 'error') {
          failed++;
          errors.push(`${exec.id}: ${result.error}`);
        }
      } catch (err: any) {
        failed++;
        errors.push(`${exec.id}: ${err?.message || String(err)}`);
      }
    }

    return {
      checked: staleExecs?.length || 0,
      reconciled,
      failed,
      errors
    };
  } catch (err: any) {
    return {
      checked: 0,
      reconciled: 0,
      failed: 0,
      errors: [err?.message || String(err)]
    };
  }
}
