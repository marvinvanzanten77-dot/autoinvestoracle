/**
 * PRODUCTION INVARIANT CHECKING
 *
 * Runs hourly to prove the system guarantees hold:
 * 1. No duplicate orders (each proposal → at most 1 bitvavo_order_id)
 * 2. No stale SUBMITTING states (>10 min old should be reconciled/escalated)
 * 3. No SUBMITTED without order_id (every SUBMITTED must have bitvavo_order_id)
 * 4. client_order_id always set (every execution must have deterministic ID)
 *
 * If any invariant violated: alert + escalate
 */

import { supabase } from '../lib/supabase/client';

export interface InvariantCheckResult {
  name: string;
  passed: boolean;
  violations: number;
  details?: string;
  remediation?: string;
}

export interface InvariantCheckSummary {
  timestamp: string;
  allPassed: boolean;
  checks: InvariantCheckResult[];
  totalViolations: number;
}

/**
 * Run all 4 production invariant checks
 *
 * Returns summary of all checks and violations
 */
export async function runAllInvariants(): Promise<InvariantCheckSummary> {
  const checks: InvariantCheckResult[] = [];

  // 1. Check: No duplicates
  const dupCheck = await checkNoDuplicates();
  checks.push(dupCheck);

  // 2. Check: No stale SUBMITTING
  const staleCheck = await checkNoStaleSubmitting();
  checks.push(staleCheck);

  // 3. Check: No SUBMITTED without order_id
  const noOrderIdCheck = await checkNoMissingOrderId();
  checks.push(noOrderIdCheck);

  // 4. Check: client_order_id always set
  const clientIdCheck = await checkClientOrderIdSet();
  checks.push(clientIdCheck);

  const totalViolations = checks.reduce((sum, c) => sum + c.violations, 0);
  const allPassed = checks.every((c) => c.passed);

  const summary: InvariantCheckSummary = {
    timestamp: new Date().toISOString(),
    allPassed,
    checks,
    totalViolations
  };

  // Log result
  if (!allPassed) {
    console.error('[Invariants] ❌ VIOLATIONS DETECTED:', {
      summary,
      details: checks.filter((c) => !c.passed)
    });

    // Alert to ops (send email/slack notification)
    await alertOnViolations(summary);
  } else {
    console.log('[Invariants] ✅ All checks passed');
  }

  return summary;
}

/**
 * INVARIANT 1: No duplicates
 *
 * Each proposal should map to at most 1 bitvavo_order_id.
 * Multiple executions with same order_id = bug.
 */
async function checkNoDuplicates(): Promise<InvariantCheckResult> {
  try {
    // Get count of proposals with multiple orders
    const { data, error } = await supabase.rpc('invariant_check_no_duplicates');

    if (error) {
      return {
        name: 'No Duplicates',
        passed: false,
        violations: -1,
        details: `Query failed: ${error.message}`,
        remediation: 'Check database function invariant_check_no_duplicates()'
      };
    }

    const violations = data?.[0]?.duplicate_count || 0;

    return {
      name: 'No Duplicates',
      passed: violations === 0,
      violations,
      details:
        violations === 0
          ? 'No proposals with multiple orders'
          : `Found ${violations} proposals with multiple orders`,
      remediation:
        violations > 0
          ? 'Run: SELECT * FROM trade_executions WHERE proposal_id IN (SELECT proposal_id FROM trade_executions GROUP BY proposal_id HAVING COUNT(*) > 1)'
          : undefined
    };
  } catch (err: any) {
    return {
      name: 'No Duplicates',
      passed: false,
      violations: -1,
      details: `Exception: ${err?.message || String(err)}`
    };
  }
}

/**
 * INVARIANT 2: No stale SUBMITTING
 *
 * SUBMITTING state should only last 30 seconds (Bitvavo timeout).
 * If > 10 minutes old, it's stale and should be escalated.
 */
async function checkNoStaleSubmitting(): Promise<InvariantCheckResult> {
  try {
    const { data, error } = await supabase.rpc('invariant_check_no_stale_submitting');

    if (error) {
      return {
        name: 'No Stale SUBMITTING',
        passed: false,
        violations: -1,
        details: `Query failed: ${error.message}`,
        remediation: 'Check database function invariant_check_no_stale_submitting()'
      };
    }

    const violations = data?.[0]?.stale_count || 0;

    return {
      name: 'No Stale SUBMITTING',
      passed: violations === 0,
      violations,
      details:
        violations === 0
          ? 'No stale SUBMITTING states (>10 min old)'
          : `Found ${violations} stale SUBMITTING states`,
      remediation:
        violations > 0
          ? 'Escalate stale SUBMITTING states to FAILED with "manual review" status'
          : undefined
    };
  } catch (err: any) {
    return {
      name: 'No Stale SUBMITTING',
      passed: false,
      violations: -1,
      details: `Exception: ${err?.message || String(err)}`
    };
  }
}

/**
 * INVARIANT 3: No SUBMITTED without order_id
 *
 * Every execution with status SUBMITTED must have a bitvavo_order_id.
 * If missing, something went wrong with the order creation.
 */
async function checkNoMissingOrderId(): Promise<InvariantCheckResult> {
  try {
    const { data, error } = await supabase.rpc('invariant_check_no_missing_order_id');

    if (error) {
      return {
        name: 'No Missing Order ID',
        passed: false,
        violations: -1,
        details: `Query failed: ${error.message}`,
        remediation: 'Check database function invariant_check_no_missing_order_id()'
      };
    }

    const violations = data?.[0]?.missing_order_count || 0;

    return {
      name: 'No Missing Order ID',
      passed: violations === 0,
      violations,
      details:
        violations === 0
          ? 'All SUBMITTED executions have order IDs'
          : `Found ${violations} SUBMITTED executions missing order_id`,
      remediation:
        violations > 0
          ? 'Investigate: SELECT * FROM trade_executions WHERE status IN ("SUBMITTED","FILLED") AND bitvavo_order_id IS NULL'
          : undefined
    };
  } catch (err: any) {
    return {
      name: 'No Missing Order ID',
      passed: false,
      violations: -1,
      details: `Exception: ${err?.message || String(err)}`
    };
  }
}

/**
 * INVARIANT 4: client_order_id always set
 *
 * Every execution must have a client_order_id (deterministic, for idempotency).
 * If missing, reconciliation cannot work.
 */
async function checkClientOrderIdSet(): Promise<InvariantCheckResult> {
  try {
    const { data, error } = await supabase.rpc('invariant_check_client_order_id_set');

    if (error) {
      return {
        name: 'Client Order ID Set',
        passed: false,
        violations: -1,
        details: `Query failed: ${error.message}`,
        remediation: 'Check database function invariant_check_client_order_id_set()'
      };
    }

    const violations = data?.[0]?.missing_client_id_count || 0;

    return {
      name: 'Client Order ID Set',
      passed: violations === 0,
      violations,
      details:
        violations === 0
          ? 'All executions have client_order_id set'
          : `Found ${violations} executions missing client_order_id`,
      remediation:
        violations > 0
          ? 'Run claimExecution() to set client_order_id; or manually set: UPDATE trade_executions SET client_order_id = "IV-" || substr(replace(id, "-", ""), 1, 20) WHERE client_order_id IS NULL'
          : undefined
    };
  } catch (err: any) {
    return {
      name: 'Client Order ID Set',
      passed: false,
      violations: -1,
      details: `Exception: ${err?.message || String(err)}`
    };
  }
}

/**
 * Aggregate all invariant checks into one function (for cron job)
 */
export async function checkAllInvariants(): Promise<InvariantCheckSummary> {
  return runAllInvariants();
}

/**
 * Alert on violations (would send email/Slack in production)
 */
async function alertOnViolations(summary: InvariantCheckSummary): Promise<void> {
  try {
    const violations = summary.checks.filter((c) => !c.passed);
    const message = `
⚠️ INVARIANT VIOLATIONS DETECTED at ${summary.timestamp}

Violations:
${violations.map((v) => `- ${v.name}: ${v.violations} violations\n  ${v.details}`).join('\n')}

Total violations: ${summary.totalViolations}

Action: Investigate and apply remediations above.
    `;

    console.error(message);

    // In production: send to Slack/email
    // await sendAlert(message);
  } catch (err: any) {
    console.warn('[alertOnViolations] Failed to send alert:', err);
  }
}
