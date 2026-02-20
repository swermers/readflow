# Entitlements + 402 Contract

This document defines the canonical `402 Payment Required` response contract for AI entitlements.

## Scope

The contract is used by:

- `POST /api/ai/summarize` (`tldr` action)
- `POST /api/ai/listen` (`listen` action)
- `GET /api/ai/weekly-brief` and `POST /api/ai/weekly-brief` (`weekly_brief` action)
- `POST /api/ai/signal-sort`
- Future AI actions, including `notion_sync`

All routes should call `checkEntitlement` (or `ensureTokensAvailable` where needed) and return `format402Payload(...)` when access is denied.

## Canonical 402 JSON

```json
{
  "error": "Insufficient tokens",
  "code": "PAYMENT_REQUIRED",
  "message": "Insufficient tokens",
  "reason": "Insufficient tokens",
  "required": 10,
  "available": 0,
  "limit": 30,
  "planTier": "free",
  "resetAt": "2026-03-20T12:34:56.000Z",
  "unlimitedAiAccess": false
}
```

### Field meanings

- `error`: Human-readable summary.
- `code`: Machine-readable constant (`PAYMENT_REQUIRED`).
- `message`: Human-readable reason (same as `error`).
- `reason`: Explicit entitlement reason string.
- `required`: Tokens required for the requested action.
- `available`: Tokens currently available in the active cycle.
- `limit`: Monthly token limit for the user (`-1` when unlimited).
- `planTier`: Current plan tier (`free`, `pro`, or `elite`).
- `resetAt`: ISO timestamp for cycle reset.
- `unlimitedAiAccess`: Whether unlimited AI access is enabled.

## Free-plan source limits

Free plan users are server-enforced to a maximum of **5 active sources** (`senders.status = 'approved'`).

Enforcement happens in Postgres via trigger `enforce_free_plan_source_limit_on_senders` and applies to both inserts and status updates.
