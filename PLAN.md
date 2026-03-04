# Implementation Plan: Email Forwarding + New Auth (Drop CASA Requirement)

## Goal
Replace Gmail OAuth (`gmail.readonly` — restricted, requires CASA) as the primary ingestion method with email forwarding via Cloudflare Email Workers. Add email/password auth so users don't need Google to sign up. Keep Gmail sync as an optional feature for test users.

## What Already Exists
- `profiles.forwarding_alias` column (8-char random alias, generated on signup)
- `supabase/functions/receive-email/index.ts` — fully implemented Edge Function that:
  - Receives webhook POSTs from email providers
  - Looks up user by forwarding alias
  - Creates/finds senders, deduplicates, sanitizes HTML
  - Inserts into `issues` table
- Gmail sync pipeline (keep as optional, not the default)

---

## Phase 1: Auth Changes (Login Page + Callback)

### 1a. Update login page (`app/login/page.tsx`)
- Add **email + password** sign-up/sign-in form (Supabase `signInWithPassword` / `signUp`)
- Add **magic link** option (Supabase `signInWithOtp`)
- Keep **Google login** but change scopes from `gmail.readonly` to basic profile only (`openid email profile` — non-sensitive, no CASA)
- Remove `access_type: 'offline'` and `prompt: 'consent'` from Google OAuth (no longer need refresh token for Gmail API)
- Add toggle between "Sign In" and "Sign Up" modes
- Add password reset link → `/auth/reset-password`

### 1b. Add password reset page (`app/auth/reset-password/page.tsx`)
- Simple form: enter email → Supabase `resetPasswordForEmail()`
- Confirmation message after submission

### 1c. Add password update page (`app/auth/update-password/page.tsx`)
- Form for entering new password after clicking reset link
- Uses Supabase `updateUser({ password })`

### 1d. Update auth callback (`app/auth/callback/route.ts`)
- Keep profile creation + `forwarding_alias` generation (already works)
- Make Gmail token saving conditional — only save if `provider_token` is present
- Don't treat missing Gmail tokens as an error (normal for email/password users)
- Handle `type=recovery` for password reset flows

### 1e. Update middleware (`utils/supabase/middleware.ts`)
- Add `/auth/reset-password` and `/auth/update-password` to public routes

---

## Phase 2: Cloudflare Email Worker

### 2a. Create Cloudflare Email Worker (`cloudflare/email-worker/`)
- `src/index.ts` — Email Worker that:
  - Receives raw MIME email from Cloudflare Email Routing
  - Parses: To, From, Subject, HTML body, text body, Message-ID
  - POSTs parsed payload to existing Supabase Edge Function (`/functions/v1/receive-email`)
  - Includes webhook secret in `x-webhook-secret` header
- `wrangler.toml` — Worker configuration
- `package.json` — dependencies (e.g., `postal-mime` for MIME parsing)

### 2b. Cloudflare Email Routing Configuration
- Document MX record setup for `readflowlibrary.xyz`
- Configure catch-all route → Email Worker
- Document DNS changes needed

### 2c. Add Cloudflare format to Edge Function parser
- Add a `cloudflare` format case to `parseEmailPayload()` in `receive-email/index.ts`
- The Worker will POST in a consistent format, so this is just matching that shape

---

## Phase 3: UI Updates

### 3a. Update Settings page (`app/(dashboard)/settings/page.tsx`)
- Add prominent **"Your Readflow Email"** section at the top of settings:
  - Display: `{forwarding_alias}@readflowlibrary.xyz`
  - Copy-to-clipboard button
  - Brief explanation: "Subscribe to newsletters with this email, or forward from Gmail"
- Fetch `forwarding_alias` from profile on load
- Keep Gmail section but label it as "Optional: Connect Gmail" (collapsed by default)

### 3b. Update Onboarding Walkthrough (`components/OnboardingWalkthrough.tsx`)
- Rewrite steps for the new flow:
  1. "Welcome" — Your account is ready
  2. "Your Readflow email" — Show their unique address, explain how to use it
  3. "Subscribe to newsletters" — Use your Readflow email to sign up (or forward from Gmail)
  4. "Verification emails" — They'll appear here, click to confirm
  5. "You're all set" — Newsletters will arrive automatically
- Remove Gmail-specific steps (create labels, create filters, etc.)

### 3c. Surface verification/confirmation emails
- No separate UI needed — incoming emails (including verification ones) already appear in the Rack/Briefing as `issues`
- Optional enhancement: detect emails with confirmation links (subject contains "confirm", "verify", "activate") and add a small badge/indicator

---

## Phase 4: Profile API for Forwarding Email

### 4a. Add API endpoint to fetch forwarding alias (`app/api/profile/forwarding-email/route.ts`)
- GET: Returns the user's `forwarding_alias` (used by settings page and onboarding)
- POST: Allow user to regenerate their alias (in case of spam)

---

## What We're NOT Doing
- Not removing Gmail sync code — it stays as an optional feature
- Not building a custom SMTP server — Cloudflare Email Workers handles this
- Not adding outbound email sending — verification emails are shown in the app UI
- Not adding X/GitHub/Discord login — email/password + Google (basic) is sufficient for now

---

## File Changes Summary

### New Files
1. `app/auth/reset-password/page.tsx` — password reset request page
2. `app/auth/update-password/page.tsx` — set new password page
3. `app/api/profile/forwarding-email/route.ts` — forwarding alias API
4. `cloudflare/email-worker/src/index.ts` — Cloudflare Email Worker
5. `cloudflare/email-worker/wrangler.toml` — Worker config
6. `cloudflare/email-worker/package.json` — Worker dependencies

### Modified Files
1. `app/login/page.tsx` — add email/password + magic link, change Google scopes
2. `app/auth/callback/route.ts` — handle non-Gmail auth, password reset
3. `app/(dashboard)/settings/page.tsx` — add forwarding email section, make Gmail optional
4. `components/OnboardingWalkthrough.tsx` — rewrite for forwarding-first flow
5. `utils/supabase/middleware.ts` — add new public routes
6. `supabase/functions/receive-email/index.ts` — add Cloudflare payload format

### No Schema Changes Needed
- `forwarding_alias` column already exists
- `issues` table already handles forwarded emails
- `senders` table already handles auto-creation
