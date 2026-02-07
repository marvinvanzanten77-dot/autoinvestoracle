/**
 * OPERATIONS QUICK REFERENCE
 *
 * Day-to-day operations guide for monitoring €25 trading system
 */

// ============================================================================
// DAILY CHECKLIST (5 minutes)
// ============================================================================

// 1. Invariant Check Status
// Run in Supabase SQL editor:
//   SELECT * FROM invariant_check_results 
//   WHERE created_at > NOW() - INTERVAL '1 hour'
//   ORDER BY created_at DESC;
// 
// Expected: All 4 checks with violations = 0
// If violations > 0: STOP, investigate immediately

// 2. Recovery Rate
// Run:
//   SELECT total_executions, success_rate, soft_failures,
//          ROUND(soft_failures::float / total_executions * 100)::int AS recovery_rate_pct
//   FROM execution_stats_24h
//   WHERE created_at > NOW() - INTERVAL '24 hours';
//
// Expected: recovery_rate_pct < 5%
// If >= 5%: Check Bitvavo API status, investigate timeouts

// 3. Any Escalations?
// Run:
//   SELECT * FROM execution_events
//   WHERE decision_path = 'RECONCILE_ESCALATED'
//   AND created_at > NOW() - INTERVAL '24 hours';
//
// If any: Contact user, ask them to check Bitvavo directly
//         They may have unfilled orders pending

// ============================================================================
// WHAT EACH INVARIANT CHECK MEANS
// ============================================================================

// INVARIANT 1: No Duplicates (invariant_check_no_duplicates)
// What: No proposal should have 2+ orders on Bitvavo
// If violated: Database constraint bug, investigate immediately
// Fix: Contact user, manually cancel duplicate order on Bitvavo

// INVARIANT 2: No Stale SUBMITTING (invariant_check_no_stale_submitting)
// What: SUBMITTING state should only exist for 30 seconds (Bitvavo timeout)
// If > 10 minutes old: Something blocked reconciliation
// If violated: Run manual reconcile for that execution

// INVARIANT 3: No Missing Order ID (invariant_check_no_missing_order_id)
// What: Every SUBMITTED execution must have bitvavo_order_id
// If violated: Race condition in submitOrRetryExecution(), investigate code

// INVARIANT 4: Client Order ID Set (invariant_check_client_order_id_set)
// What: Every execution must have client_order_id (deterministic ID)
// If violated: Reconciliation can't work, escalate to dev team

// ============================================================================
// ERROR CLASSIFICATION REFERENCE
// ============================================================================

// HARD FAILURES (Don't Retry)
// - Auth failures (401, 403) → API key invalid
// - Invalid symbol (404) → Wrong trading pair
// - Insufficient funds → Balance too low for order
// Action: Mark FAILED, don't retry, notify user

// SOFT FAILURES (Retry via Reconcile)
// - Timeout (30s) → Network slow, Bitvavo accepted but no response
// - Connection refused → Network unreachable
// - 5xx errors → Bitvavo server issue
// Action: Keep SUBMITTING, reconcile job will retry up to 12 times

// ============================================================================
// USER PROMOTION CRITERIA
// ============================================================================

// TRAINING → VALIDATED (€25 → €100)
// Requires: 100+ orders, success ≥ 98%, recovery < 5%
// How to promote: Run checkAndPromoteIfEligible(user_id)
// Verification: SELECT confidence_level, order_limit_eur FROM user_policies

// VALIDATED → PRODUCTION (€100 → €500)
// Requires: 500+ orders, success ≥ 98%, recovery < 5%
// How to promote: Same function as above

// PRODUCTION → MATURE (€500 → unlimited)
// Requires: 1000+ orders, success ≥ 99%, recovery < 2%
// How to promote: Same function as above

// Check who's ready:
//   SELECT up.user_id, up.confidence_level, es.total_executions, es.success_rate
//   FROM user_policies up
//   LEFT JOIN execution_stats_24h es ON up.user_id = es.user_id
//   WHERE es.total_executions >= 
//     CASE WHEN up.confidence_level = 'TRAINING' THEN 100
//          WHEN up.confidence_level = 'VALIDATED' THEN 500
//          WHEN up.confidence_level = 'PRODUCTION' THEN 1000
//     END
//   ORDER BY es.total_executions DESC;

// ============================================================================
// EMERGENCY PROCEDURES
// ============================================================================

// PROCEDURE 1: Disable Trading Immediately
// Situation: Invariants failing, bugs detected, or under attack
// Action:
//   UPDATE user_policies 
//   SET trading_enabled = false
//   WHERE user_id = <all> OR <specific_user_id>;
// Verification: Next trade attempt should return 403 "Trading disabled"

// PROCEDURE 2: Investigate SUBMITTING State Stuck
// Situation: Execution in SUBMITTING for > 10 minutes
// Action:
//   SELECT * FROM trade_executions 
//   WHERE status = 'SUBMITTING' AND updated_at < NOW() - INTERVAL '10 minutes';
// 
// Manually trigger reconcile:
//   SELECT * FROM reconcileByClientOrderId(<execution_id>, <user_id>);
// Or manually update:
//   UPDATE trade_executions 
//   SET status = 'FAILED', last_error = 'Manual escalation - reconcile timeout'
//   WHERE id = <execution_id>;

// PROCEDURE 3: Check for Double-Orders
// Situation: User reports duplicate order
// Action:
//   SELECT COUNT(*), bitvavo_order_id FROM trade_executions
//   WHERE proposal_id = <proposal_id>
//   GROUP BY bitvavo_order_id;
// If count > 1: Call Bitvavo API to cancel duplicates manually

// PROCEDURE 4: Analyze Failure Pattern
// Situation: Multiple users hitting errors at same time
// Action:
//   SELECT error_class, error_message, COUNT(*) AS count
//   FROM execution_events
//   WHERE created_at > NOW() - INTERVAL '1 hour'
//   AND error_class IS NOT NULL
//   GROUP BY error_class, error_message
//   ORDER BY count DESC;
// 
// If pattern emerges:
// - HARD errors (auth/invalid): code bug, deploy fix
// - SOFT errors (timeout/network): Bitvavo API issue, wait 30 min + retry

// ============================================================================
// MONITORING DASHBOARD (BOOKMARK THESE)
// ============================================================================

// URL: [Supabase SQL Editor]

// Query 1: System Health (Run every 4 hours)
// SELECT
//   COUNT(DISTINCT user_id) AS active_users,
//   COUNT(*) FILTER (WHERE status='SUBMITTED' OR status='FILLED') AS successful_orders,
//   COUNT(*) FILTER (WHERE status='FAILED') AS failed_orders,
//   COUNT(*) FILTER (WHERE status='SUBMITTING') AS in_flight,
//   ROUND(COUNT(*) FILTER (WHERE status IN ('SUBMITTED','FILLED'))::float / 
//         NULLIF(COUNT(*), 0) * 100)::int AS success_rate_pct
// FROM trade_executions
// WHERE created_at > NOW() - INTERVAL '24 hours';

// Query 2: Latest Errors (Run if something fails)
// SELECT created_at, user_id, decision_path, error_message, error_class
// FROM execution_events
// WHERE error_message IS NOT NULL
// ORDER BY created_at DESC LIMIT 20;

// Query 3: Reconciliation Successes (Run to verify recovery works)
// SELECT COUNT(*) FILTER (WHERE decision_path='RECONCILE_FOUND') AS recovered,
//        COUNT(*) FILTER (WHERE decision_path='RECONCILE_NOT_FOUND') AS not_found,
//        COUNT(*) FILTER (WHERE decision_path='RECONCILE_ESCALATED') AS escalated
// FROM execution_events
// WHERE decision_path LIKE 'RECONCILE%'
// AND created_at > NOW() - INTERVAL '24 hours';

// ============================================================================
// COMMON ISSUES & FIXES
// ============================================================================

// ISSUE 1: Recovery rate > 5% (too many timeouts)
// Likely cause: Bitvavo API slow or overloaded
// Check: Bitvavo status page, Twitter
// Fix: Wait, monitor, adjust timeout if needed

// ISSUE 2: User complains "order not found"
// Likely cause: Reconciliation didn't find order (it was rejected)
// Action: Query:
//   SELECT status, last_error FROM trade_executions WHERE id = <execution_id>;
// If SUBMITTING: Reconcile timed out after 12 attempts, escalated
// If FAILED: Order was rejected by Bitvavo (check last_error)

// ISSUE 3: All executions failing (HARD failures)
// Likely cause: Invalid API key, network issue, or code bug
// Action: 
//   SELECT error_message, COUNT(*) FROM execution_events
//   WHERE error_class = 'HARD' AND created_at > NOW() - INTERVAL '1 hour'
//   GROUP BY error_message;
// 
// If all "invalid symbol": Symbol changed, update config
// If all "auth": API key expired, renew
// If all "insufficient": User needs more balance (not a bug)

// ISSUE 4: Invariant violation detected
// Likely cause: Race condition or database constraint violated
// Action: DISABLE TRADING IMMEDIATELY
//   UPDATE user_policies SET trading_enabled = false;
// Then investigate with dev team

// ============================================================================
// PROMOTION WORKFLOW
// ============================================================================

// Step 1: Check who's ready
//   SELECT user_id, confidence_level, total_executions, success_rate
//   FROM user_policies up
//   LEFT JOIN execution_stats_24h es ON up.user_id = es.user_id
//   WHERE <criteria met>;

// Step 2: Verify metrics meet criteria
//   - TRAINING → VALIDATED: Check 100+ orders, 98%+ success
//   - Verify recovery_rate < 5%

// Step 3: Promote user
//   SELECT promoteToNextLevel('<user_id>', 'TRAINING');
//   Verify: SELECT confidence_level, order_limit_eur FROM user_policies WHERE user_id = '<user_id>';

// Step 4: Notify user
//   Email: "You've been promoted to VALIDATED! New limit: €100"
//   Include: "This is based on your 100+ successful trades"

// ============================================================================
// WEEKLY REVIEW
// ============================================================================

// Monday 9 AM (30 minutes):
// 1. Review past week's execution_stats_24h
// 2. Check for any invariant violations
// 3. Promote any users who qualify
// 4. Review any HARD failures (potential bugs)
// 5. Check if any users hit €25 limit, want to grow

// ============================================================================
// ESCALATION PATHS
// ============================================================================

// Minor (Red Flag) → Monitor:
// - Recovery rate 5-10%: Bitvavo may be slow, monitor API status
// - 1-2 invariant violations: Investigate, likely edge case

// Medium (Yellow Alert) → Investigate:
// - Recovery rate > 10%: Network issue, check infrastructure
// - 3+ invariant violations: Potential race condition, review code

// Critical (Red Alert) → Disable & Fix:
// - Invariant violations + can't identify cause: DISABLE TRADING
// - Multiple users unable to trade: DISABLE TRADING
// - Double-order confirmed: DISABLE TRADING + contact users

// ============================================================================
// SUPPORT RESPONSES
// ============================================================================

// User: "Why didn't my order go through?"
// Answer: Check execution_events:
//   SELECT * FROM execution_events WHERE execution_id = <id> ORDER BY created_at;
// If HARD_FAIL: Order was rejected by Bitvavo (e.g., insufficient funds)
// If SOFT_FAIL then RECONCILE_FOUND: Order was placed, reconcile recovered it
// If SOFT_FAIL then RECONCILE_NOT_FOUND: Order was lost, likely rejected

// User: "Can I trade bigger than €25?"
// Answer: Yes, when you meet criteria. Check:
//   SELECT total_executions, success_rate FROM execution_stats_24h WHERE user_id = '<user_id>';
// If 100+ orders and 98%+ success: You can trade up to €100 (run promotion)
// If 500+ orders and 99%+ success: You can trade up to €500

// User: "Why does my order sometimes take time?"
// Answer: Sometimes network is slow (timeout). Don't worry, our reconciliation system:
// 1. Remembers we tried (client_order_id)
// 2. Queries Bitvavo to find order
// 3. Completes automatically
// This is by design and happens < 5% of the time.
