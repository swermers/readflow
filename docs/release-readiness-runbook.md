# Release Readiness Runbook

This runbook documents operational checks for queue health, dead-letter safety, and core async flows (summarize/listen consumption, weekly briefs, and Notion sync).

## Required Environment Variables

### Core runtime
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### AI providers
- `ANTHROPIC_API_KEY`
- `ANTHROPIC_MODEL` (optional override)
- `OPENAI_API_KEY` (for audio generation worker path)
- `XAI_API_KEY` or `GROK_API_KEY` (if Grok summarize path is used)
- `XAI_MODEL` (optional override)

### Worker/admin auth
- `WORKER_SECRET` (required for `/api/worker/process-jobs`)
- `CRON_SECRET` (required for `/api/cron/dispatch-briefs`)
- `ADMIN_QUEUE_SECRET` (recommended for admin queue endpoints; falls back to `WORKER_SECRET`)

### Integrations
- `NOTION_CLIENT_ID`
- `NOTION_CLIENT_SECRET`
- `NOTION_REDIRECT_URI`

## Migration Order

Apply SQL migrations in lexical order from `supabase/migrations/`, especially queue+entitlement dependencies:

1. Base schema and profile fields (`001`-`019` as present).
2. Queue infrastructure: `020_add_background_jobs.sql`.
3. Queue reliability and dead-letter hardening: `022_queue_reliability_pass.sql`.
4. Notion queue integration: `022_add_notion_sync_v1.sql`.
5. Entitlement controls: `022_enforce_free_plan_source_limits.sql`.

If using `supabase db push` or equivalent, ensure all migrations are applied before enabling worker/cron traffic.

## Health / Admin Endpoints

All admin endpoints require `Authorization: Bearer <ADMIN_QUEUE_SECRET|WORKER_SECRET>`.

### Queue depth + processing pressure
- `GET /api/admin/queue-health`
- Alias: `GET /api/admin/queue-depth`

Response includes per-job-type counts for `queued`, `processing`, and `deadLetter` across:
- `briefing.generate`
- `audio.requested`
- `notion.sync`

### Dead-letter count
- `GET /api/admin/dead-letter-count`

Response includes per-type dead-letter counts plus total.

### Dead-letter replay safety
- `POST /api/admin/replay-dead-letter-jobs`

Request body:
```json
{
  "type": "audio.requested",
  "limit": 25,
  "dryRun": true,
  "reason": "manual_replay"
}
```

- `dryRun: true` previews replay candidates (IDs + dedupe keys + failure context) without mutating queue state.
- `dryRun: false` (or omitted) performs replay and resets selected dead-letter jobs back to `queued`.

## Worker Invocation Schedule

### Recommended cadence
- `GET /api/cron/dispatch-briefs`: every Monday 00:10 UTC.
- `POST /api/worker/process-jobs`: every 1 minute (or continuous worker loop calling this endpoint).

### Example scheduler commands
```bash
curl -fsS -H "Authorization: Bearer $CRON_SECRET" \
  "$APP_BASE_URL/api/cron/dispatch-briefs"

curl -fsS -X POST -H "Authorization: Bearer $WORKER_SECRET" \
  "$APP_BASE_URL/api/worker/process-jobs"
```

## End-to-End Flow Validation Checklist

> Run in staging after migrations and env configuration.

### 1) Summarize/listen 402 and consumption
1. Use a free-tier user with exhausted AI tokens.
2. `POST /api/ai/summarize` with `{ "issueId": "..." }` => expect `402` payload (`code: PAYMENT_REQUIRED`).
3. `POST /api/ai/listen` with `{ "issueId": "..." }` => expect `402` payload when out of tokens.
4. Replenish/upgrade user and retry `POST /api/ai/listen` => expect `202` with `status: queued`.
5. Trigger worker and poll `GET /api/ai/listen?issueId=...` until `status: ready`.
6. Verify token usage increments via profile usage endpoint (`/api/profile/ai-usage`) or direct DB check.

### 2) Weekly brief dispatch + worker
1. Ensure an `elite` active user has >=2 issues in last completed week.
2. Trigger `GET /api/cron/dispatch-briefs` with `CRON_SECRET`.
3. Confirm `briefing.generate` jobs are enqueued via `/api/admin/queue-health`.
4. Trigger `POST /api/worker/process-jobs`.
5. Confirm queue drains and `weekly_briefs` row appears for target user/week.

### 3) Notion sync enqueue + worker
1. Connect Notion for an `elite` user (`profiles.notion_connected = true`).
2. Trigger `POST /api/notion/sync`.
3. Confirm `notion.sync` queue depth increments.
4. Trigger `POST /api/worker/process-jobs`.
5. Validate highlight records progress to synced state and profile sync status clears errors.

## Dead-letter Replay Procedure

1. Inspect dead letters:
   - `GET /api/admin/dead-letter-count`
2. Preview replay candidates safely:
   - `POST /api/admin/replay-dead-letter-jobs` with `dryRun: true`.
3. Validate root cause is fixed (missing env var, provider outage, auth issue, malformed payload).
4. Replay bounded batch:
   - `POST /api/admin/replay-dead-letter-jobs` with `dryRun: false`, explicit `limit`.
5. Run worker and verify success/fail counts.
6. Re-check dead-letter count and repeat in small batches if needed.

## Common Failure Signatures

- `Unauthorized` on worker/admin routes:
  - Missing or mismatched `Authorization` bearer token.
- `Insufficient tokens` / `PAYMENT_REQUIRED` (`402`):
  - Entitlement gate blocked action (`tldr`, `listen`, `weekly_brief`, or `notion_sync`).
- `Anthropic key is not configured`, `Grok key is not configured`, provider request failure:
  - Missing/invalid provider credentials or upstream outage.
- Notion sync errors (token decrypt/API failures):
  - Stale OAuth token, revoked integration access, or malformed Notion payload.
- Rising `deadLetter` with repeated `max_attempts_reached`:
  - Persistent worker-side processing issue; use dry-run replay preview before retrying.
