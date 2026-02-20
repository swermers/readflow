# Notion Sync v1

## Required environment variables

- `NEXT_PUBLIC_APP_URL`
- `NOTION_CLIENT_ID`
- `NOTION_CLIENT_SECRET`
- `NOTION_TOKEN_ENCRYPTION_KEY` (64-char hex or 32-byte base64/base64url)
- `WORKER_SECRET`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Flow

1. User hits `/api/notion/oauth/start`.
2. API verifies auth + elite entitlement and redirects to Notion OAuth authorize URL with state cookie.
3. Notion redirects to `/api/notion/oauth/callback`.
4. Callback validates state, exchanges code for token, stores encrypted token metadata on `profiles`, and enqueues `notion.sync`.
5. Worker claims `notion.sync` jobs, syncs highlights to Notion pages idempotently using source hashes, and updates profile/highlight sync fields.

## Queue behavior

- Jobs are claimed atomically with `claim_background_jobs` and leased to worker IDs.
- Failed jobs move to `failed` with deterministic retry backoff.
- Jobs exceeding max attempts move to `dead_letter`.
- Dead-letter jobs can be replayed using `/api/admin/replay-dead-letter-jobs`.
