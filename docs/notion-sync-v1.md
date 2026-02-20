# Notion Sync v1

## OAuth flow
1. `GET /api/notion/oauth/start` requires an authenticated user and checks the `notion_sync` entitlement.
2. The route generates a signed state payload (nonce + user id), stores it in an HTTP-only cookie, and redirects to Notion authorize.
3. `GET /api/notion/oauth/callback` verifies query `state` against the cookie, checks entitlement again, exchanges the code for a token, encrypts the access token, stores workspace metadata on `profiles`, and enqueues `notion.sync`.
4. Callback redirects to `/settings` with success/failure query params.

## Required environment variables
- `NEXT_PUBLIC_APP_URL`: app origin used for OAuth callback URL.
- `NOTION_CLIENT_ID`: Notion OAuth client id.
- `NOTION_CLIENT_SECRET`: Notion OAuth client secret.
- `NOTION_TOKEN_ENCRYPTION_KEY`: exactly 32-byte key encoded as base64/base64url or 64-char hex.
- `SUPABASE_SERVICE_ROLE_KEY` / server auth envs already used by admin and session clients.
- `WORKER_SECRET`: required by `/api/worker/process-jobs`.

## Queue lifecycle
- Jobs are enqueued via `enqueue_background_job` and deduped on `dedupe_key`.
- Workers claim jobs atomically through `claim_background_jobs` with `FOR UPDATE SKIP LOCKED` and lease metadata.
- Claim sets `status=processing`, assigns `worker_id`, sets `leased_at` + `lease_expires_at`, and increments `attempts`.
- Completion/failure updates are ownership-aware (`worker_id` must match).

## Retry and dead-letter behavior
- Retry delays are deterministic by attempt: `30s`, `120s`, `600s`, `1800s`.
- On failure, jobs are requeued with `next_attempt_at` unless `attempts >= max_attempts`.
- Exceeded attempts move job to `dead_letter` with `dead_lettered_at` and `dead_letter_reason=max_attempts_reached`.
- Expired processing leases are returned to `queued` on next claim pass.

## Troubleshooting
- `invalid_state` during callback: ensure same browser/session and cookie domain consistency.
- `oauth_exchange_failed`: verify Notion client id/secret and callback URL in Notion app settings.
- Encryption errors: validate `NOTION_TOKEN_ENCRYPTION_KEY` format and length.
- Jobs stuck in processing: confirm workers run with stable `WORKER_SECRET` and lease TTL covers execution time.
