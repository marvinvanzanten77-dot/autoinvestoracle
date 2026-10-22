# Unattended observation milestone

## Current implementation

`api/index.ts` delegates all three legacy cron URLs to a shared server-only
orchestrator. Only `/api/cron/portfolio-check` is scheduled (hourly, UTC).
The other URLs remain authenticated aliases, with the same hourly idempotency key.
The hourly schedule requires a suitable Vercel plan.

The runner fetches real Bitvavo 24-hour EUR tickers and a signed private `/balance`
response. It checks numeric values, freshness, missing valuation prices, risk
tolerance and excluded-asset exposure. It persists an **observation**, not a trade
proposal: the current central trading policy is a placeholder. The observation
records `executionAllowed: false` and the reason no trade is proposed. No order
endpoint is called. Analysis is deterministic; no OpenAI call is required here.

Discovery uses KV `exchange:*:store` and `user:{id}:profile`, then checks the
existing Supabase `profiles.agent_status = running`. Paused/stopped/missing agents
are not processed. Missing status storage is an error, not implicit permission.
Push requires explicit `marketUpdates` or `accountUpdates` opt-in and a stored
subscription. `actionSuggestions` alone does not authorize an observation push.

## Server configuration / external prerequisites

- KV_REST_API_URL and KV_REST_API_TOKEN (existing KV database)
- ENCRYPTION_KEY (the existing key used for stored exchange credentials; do not rotate casually)
- SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (server only)
- CRON_SECRET (Vercel sends Authorization: Bearer CRON_SECRET)
- VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_EMAIL for permitted push
- Existing Supabase `profiles` and `push_subscriptions` tables
- A connected Bitvavo account with read permission, a KV profile, and an agent
  explicitly running in `profiles`. No trade/withdrawal permission is needed.

No keys have been installed, printed or supplied in this checkout.

## Evidence

Run ID: `observation:{userId}:{hourStartISO}`.

Audit: `cron:audit:{runId}`. Observation: `user:{userId}:observation:{runId}`;
latest: `user:{userId}:observation:latest`.

Read an audit through `GET /api/cron/audit?runId={urlEncodedRunId}` using the
cron Bearer secret. Audit responses are never public or cached.
Steps have running/success/failed/skipped, durations and decision/error details.
An interrupted function leaves its last running checkpoint for inspection.

Claims use atomic KV SET NX, independent of serverless process memory. Claims
are permanent for each user/hour; later cron slots receive a new ID. A failed or
interrupted run is not silently restarted. Investigate the checkpoint and await
the next slot. Historical audits currently have no retention cleanup.

Push delivery has a separate atomic claim per run/subscription. A timeout is
recorded as failed_or_unknown and is **not retried** because delivery might have
occurred. This favors no duplicates over automatic recovery. Push success means
acceptance by the push service, not proof of display on the device.

Local checks: `npm run check:orchestration` uses fixture services to check sequence,
concurrency, duplicate calls, disabled notifications and failure at every step.
The new modules also pass a targeted TypeScript check; the Vite build passes.
The repository-wide NodeNext check still fails on pre-existing extension/type
errors in other modules. Local fixtures are not production milestone evidence.

## Production acceptance (still outstanding)

1. Deploy this change with the existing environment configuration.
2. Let Vercel invoke the hourly cron without any browser/manual scan.
3. Retrieve that user's audit: all steps succeed except a documented skipped
   push when preferences/subscriptions disallow it.
4. Verify the observation exists in KV and contains real market/portfolio data.
5. If push is allowed, verify its accepted delivery record and device notification.
6. Reinvoke the same hourly slot: duplicate=true, no new observation or delivery.

`usersProcessed: 0` is not milestone evidence. A 500, unfinished audit or unknown
push delivery is not a passed run. No production run has yet been verified.

## Production verification attempt — 2026-10-22

**Result: BLOCKED at Vercel project access; milestone NOT PASSED.**

- Remote branch `fix/unattended-observation-cron` was fetched and confirmed at
  implementation commit `0de6374`. No implementation changes were made.
- The connected Vercel integration can list team `Marvin's projects`, slug
  `marvins-projects-32ae872c`, ID `team_DHlbzZ87HCLSfQG2XrzT67Mh`.
- Project lookup for `autoinvestoracle` in that team returns HTTP 404,
  `Project not found`.
- Both filtered and unfiltered project listings in that team return zero
  projects. This proves the project is not accessible through the current
  connection; it does not prove that the project was deleted or does not exist.
- The environment metadata request (`decrypt=false`) also returns project 404.
- The scoped CLI fallback reports `No existing credentials found`.

Environment presence in Production is **UNVERIFIED** for every required key:

| Variable | Production presence |
| --- | --- |
| KV_REST_API_URL | Unverified — project inaccessible |
| KV_REST_API_TOKEN | Unverified — project inaccessible |
| ENCRYPTION_KEY | Unverified — project inaccessible |
| SUPABASE_URL | Unverified — project inaccessible |
| SUPABASE_SERVICE_ROLE_KEY | Unverified — project inaccessible |
| CRON_SECRET | Unverified — project inaccessible |
| VAPID_PUBLIC_KEY | Unverified — project inaccessible |
| VAPID_PRIVATE_KEY | Unverified — project inaccessible |
| VAPID_EMAIL | Unverified — project inaccessible |

No secret values were retrieved, printed, changed or rotated. No deployment,
production cron invocation, order/trade, profile mutation or push was performed.
The registered production schedule, usersProcessed, step statuses/durations,
KV observation and delivery records, and production idempotency are all
**unverified**, not successful or skipped.

### External action required

Reconnect/grant the Vercel integration access to the actual Auto Invest Oracle
project and its owning team. If the project moved or was renamed, provide its
current project ID, team and dashboard URL (not credentials). Alternatively,
authenticate the Vercel CLI locally with `vercel login` using an account with
access to that project. Never paste tokens or secret values into chat.

After access is restored: inspect production configuration and environment
metadata; deploy the existing branch to Production without changing `main`;
confirm the registered hourly schedule; await a genuine scheduled invocation;
read its audit and KV observation/delivery records; then invoke the same hourly
slot once to compare duplicate and delivery evidence. Record the resulting
deployment ID, scheduled trigger timestamp, run ID and per-step timings here.
