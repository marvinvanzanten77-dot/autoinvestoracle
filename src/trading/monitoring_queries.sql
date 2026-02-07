/**
 * PRODUCTION MONITORING DASHBOARD
 *
 * SQL queries for real-time visibility into system health:
 * - Recent executions and their states
 * - 24h recovery metrics
 * - Confidence level progression
 * - Invariant violation history
 *
 * Usage: Run these queries in Supabase SQL editor or integrate into dashboard
 */

// ============================================================================
// QUERY 1: Last 20 Executions (Current State)
// ============================================================================
// Shows: execution ID, proposal ID, status, order ID, client order ID, created/updated time
//
// SELECT
//   id,
//   user_id,
//   proposal_id,
//   status,
//   bitvavo_order_id,
//   client_order_id,
//   created_at,
//   updated_at,
//   last_error,
//   reconcile_attempts
// FROM trade_executions
// ORDER BY created_at DESC
// LIMIT 20;

// ============================================================================
// QUERY 2: 24h Execution Statistics
// ============================================================================
// Shows: total executions, success rate, hard/soft failures, recovery count
//
// SELECT
//   user_id,
//   total_executions,
//   success_rate,
//   hard_failures,
//   soft_failures,
//   reconcile_found,
//   (soft_failures::float / NULLIF(total_executions, 0) * 100)::int AS recovery_rate_pct,
//   created_at,
//   updated_at
// FROM execution_stats_24h
// WHERE created_at > NOW() - INTERVAL '1 day'
// ORDER BY created_at DESC;

// ============================================================================
// QUERY 3: Users Ready for Promotion
// ============================================================================
// Shows: users who qualify for confidence level upgrade
//
// SELECT
//   up.user_id,
//   up.confidence_level,
//   es.total_executions,
//   es.success_rate,
//   es.reconcile_found,
//   (es.soft_failures::float / NULLIF(es.total_executions, 0) * 100)::int AS recovery_rate_pct,
//   up.order_limit_eur,
//   CASE
//     WHEN up.confidence_level = 'TRAINING' AND es.total_executions >= 100 AND es.success_rate >= 98 AND (es.soft_failures::float / NULLIF(es.total_executions, 0)) <= 0.05 THEN 'Ready for VALIDATED (100 EUR)'
//     WHEN up.confidence_level = 'VALIDATED' AND es.total_executions >= 500 AND es.success_rate >= 99 AND (es.soft_failures::float / NULLIF(es.total_executions, 0)) <= 0.03 THEN 'Ready for PRODUCTION (500 EUR)'
//     WHEN up.confidence_level = 'PRODUCTION' AND es.total_executions >= 1000 AND es.success_rate >= 99 THEN 'Ready for MATURE (unlimited)'
//     ELSE 'Not ready'
//   END AS promotion_status
// FROM user_policies up
// LEFT JOIN execution_stats_24h es ON es.user_id = up.user_id
// WHERE up.confidence_level != 'MATURE'
// ORDER BY es.total_executions DESC;

// ============================================================================
// QUERY 4: Execution Event Log (Last 50 Events)
// ============================================================================
// Shows: every state transition with decision path, error class, latency
//
// SELECT
//   id,
//   user_id,
//   execution_id,
//   from_status,
//   to_status,
//   decision_path,
//   client_order_id,
//   bitvavo_order_id,
//   error_class,
//   error_message,
//   bitvavo_latency_ms,
//   reconcile_attempt_number,
//   created_at
// FROM execution_events
// ORDER BY created_at DESC
// LIMIT 50;

// ============================================================================
// QUERY 5: Recent SOFT Failures (Timeout/Network)
// ============================================================================
// Shows: executions that failed with timeout/network and were recovered
//
// SELECT
//   ee.created_at,
//   ee.user_id,
//   ee.execution_id,
//   ee.error_message,
//   ee.bitvavo_latency_ms,
//   ee.reconcile_attempt_number,
//   CASE
//     WHEN ee.reconcile_attempt_number IS NOT NULL THEN 'Reconciled'
//     ELSE 'Pending'
//   END AS recovery_status
// FROM execution_events ee
// WHERE
//   ee.error_class = 'SOFT'
//   AND ee.created_at > NOW() - INTERVAL '24 hours'
// ORDER BY ee.created_at DESC;

// ============================================================================
// QUERY 6: Invariant Check History
// ============================================================================
// Shows: daily invariant check results (run from invariantChecking.ts)
//
// SELECT
//   check_date,
//   check_name,
//   violations,
//   details,
//   checked_at
// FROM (
//   SELECT
//     DATE(created_at) AS check_date,
//     'No Duplicates' AS check_name,
//     duplicate_count AS violations,
//     'Proposals with multiple orders' AS details,
//     created_at AS checked_at
//   FROM invariant_check_results
//   WHERE check_type = 'duplicates'
//   UNION ALL
//   SELECT
//     DATE(created_at),
//     'No Stale SUBMITTING',
//     stale_count,
//     'SUBMITTING states >10min old',
//     created_at
//   FROM invariant_check_results
//   WHERE check_type = 'stale_submitting'
//   UNION ALL
//   SELECT
//     DATE(created_at),
//     'No Missing Order ID',
//     missing_order_count,
//     'SUBMITTED without order_id',
//     created_at
//   FROM invariant_check_results
//   WHERE check_type = 'missing_order_id'
//   UNION ALL
//   SELECT
//     DATE(created_at),
//     'Client Order ID Set',
//     missing_client_id_count,
//     'Executions without client_order_id',
//     created_at
//   FROM invariant_check_results
//   WHERE check_type = 'client_order_id'
// ) results
// ORDER BY check_date DESC, check_name;

// ============================================================================
// QUERY 7: Reconciliation Success Rate
// ============================================================================
// Shows: how often reconciliation finds lost orders (success metric)
//
// SELECT
//   DATE(ee.created_at) AS date,
//   COUNT(*) FILTER (WHERE decision_path = 'RECONCILE_FOUND') AS recovered,
//   COUNT(*) FILTER (WHERE decision_path = 'RECONCILE_NOT_FOUND') AS not_found,
//   COUNT(*) FILTER (WHERE decision_path = 'RECONCILE_ESCALATED') AS escalated,
//   ROUND(
//     COUNT(*) FILTER (WHERE decision_path = 'RECONCILE_FOUND')::float /
//     NULLIF(COUNT(*) FILTER (WHERE decision_path LIKE 'RECONCILE%'), 0) * 100
//   )::int AS success_rate_pct
// FROM execution_events ee
// WHERE decision_path LIKE 'RECONCILE%'
// GROUP BY DATE(ee.created_at)
// ORDER BY date DESC;

// ============================================================================
// QUERY 8: Confidence Level Distribution
// ============================================================================
// Shows: how many users at each confidence level
//
// SELECT
//   confidence_level,
//   COUNT(*) AS user_count,
//   COUNT(*) FILTER (WHERE updated_at > NOW() - INTERVAL '7 days') AS updated_this_week
// FROM user_policies
// GROUP BY confidence_level
// ORDER BY CASE confidence_level
//   WHEN 'TRAINING' THEN 1
//   WHEN 'VALIDATED' THEN 2
//   WHEN 'PRODUCTION' THEN 3
//   WHEN 'MATURE' THEN 4
// END;

// ============================================================================
// QUERY 9: Top Recoverers (High Recovery Rate - Potential Issues)
// ============================================================================
// Shows: users with high recovery rate (may indicate problems)
//
// SELECT
//   user_id,
//   total_executions,
//   success_rate,
//   soft_failures,
//   hard_failures,
//   reconcile_found,
//   ROUND(soft_failures::float / NULLIF(total_executions, 0) * 100)::int AS recovery_rate_pct,
//   CASE
//     WHEN (soft_failures::float / NULLIF(total_executions, 0)) > 0.10 THEN '⚠️ High recovery rate (>10%)'
//     WHEN (soft_failures::float / NULLIF(total_executions, 0)) > 0.05 THEN '⚡ Elevated recovery rate (>5%)'
//     ELSE '✓ Normal'
//   END AS health_status
// FROM execution_stats_24h
// WHERE total_executions > 0
// ORDER BY (soft_failures::float / NULLIF(total_executions, 0)) DESC
// LIMIT 10;

// ============================================================================
// QUERY 10: Daily Summary (Operations Dashboard)
// ============================================================================
// Shows: key metrics for ops monitoring
//
// SELECT
//   DATE(es.created_at) AS date,
//   COUNT(DISTINCT es.user_id) AS active_users,
//   SUM(es.total_executions) AS total_executions,
//   ROUND(AVG(es.success_rate))::int AS avg_success_rate_pct,
//   SUM(es.hard_failures) AS hard_failures,
//   SUM(es.soft_failures) AS soft_failures,
//   SUM(es.reconcile_found) AS reconciled_orders,
//   ROUND(SUM(es.soft_failures)::float / NULLIF(SUM(es.total_executions), 0) * 100)::int AS overall_recovery_rate_pct,
//   COUNT(*) FILTER (WHERE up.confidence_level = 'TRAINING') AS users_training,
//   COUNT(*) FILTER (WHERE up.confidence_level = 'VALIDATED') AS users_validated,
//   COUNT(*) FILTER (WHERE up.confidence_level = 'PRODUCTION') AS users_production,
//   COUNT(*) FILTER (WHERE up.confidence_level = 'MATURE') AS users_mature
// FROM execution_stats_24h es
// LEFT JOIN user_policies up ON es.user_id = up.user_id
// WHERE es.created_at > NOW() - INTERVAL '1 day'
// GROUP BY DATE(es.created_at)
// ORDER BY date DESC;
