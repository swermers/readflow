# Readflow — Comprehensive Codebase Review

**Date:** 2026-02-21
**Reviewer perspective:** Senior full-stack engineer / SaaS product architect / security auditor
**Stack:** Next.js 14.1 (App Router), Supabase (Auth + Postgres + Storage), Tailwind CSS, OpenAI TTS, Anthropic + Grok AI, Gmail API

---

## 1. CODE QUALITY REVIEW

### 1.1 Structural Strengths

The codebase is well-organized for an MVP. The App Router usage is idiomatic, the dashboard layout with sidebar + mobile nav is clean, and the separation of API routes, utils, and components is sensible. The entitlement system (`aiEntitlements.ts`) is a genuine architectural asset — atomic token consumption via RPC with a fallback path shows thoughtful design.

### 1.2 Structural Weaknesses

**Duplicated auth boilerplate across every API route.** Every route handler repeats:

```ts
const supabase = await createClient();
const { data: { user } } = await supabase.auth.getUser();
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
```

This pattern appears in 15+ files. Extract a `withAuth(handler)` wrapper or use Next.js middleware to centralize this.

**Duplicated `isAuthorized()` function.** The admin bearer-token check is copy-pasted across `admin/audio-metrics/route.ts`, `admin/replay-dead-letter-jobs/route.ts`, `admin/queue-depth/route.ts`, and `worker/process-jobs/route.ts`. One change needs four edits.

**Duplicated job processing boilerplate.** In `worker/process-jobs/route.ts`, the `processBriefingJobs`, `processAudioJobs`, `processNotionJobs`, and `processPodcastJobs` functions are structurally identical — claim, iterate, try/catch, mark complete/failed. This should be a generic `processJobType(type, handler)` function.

**`sync-gmail/route.ts` creates its own Supabase client** instead of using the shared `createClient()` utility. This is the only route that does this — it manually calls `createServerClient` with raw cookie handling (line 10-29). Maintenance hazard.

**Backward-compatibility aliases in `aiEntitlements.ts`** (lines 241-243) indicate an incomplete migration from "credits" to "tokens." The `EnsureResult` type has both `available` and `remaining` fields that always hold the same value. Clean this up before it confuses contributors.

### 1.3 Scalability Issues

**Sequential Gmail message fetching.** `sync-gmail/route.ts` fetches messages one-by-one in a for-loop (line 121). With 50 messages per label and multiple labels, this means 50-200+ sequential HTTP requests to Gmail API. This will time out on Vercel's function limit. Use `Promise.all` with a concurrency limiter (e.g., batches of 10).

**In-database job queue.** The `jobs.ts` queue uses Supabase Postgres — `enqueueJob`, `claimQueuedJobs` with `SELECT ... FOR UPDATE SKIP LOCKED` semantics. This works for low volume but becomes a bottleneck at scale. The worker claims up to 25 jobs per type per invocation, and the worker itself is triggered by an external HTTP POST. No auto-scaling, no concurrent worker support.

**10,000-row metric fetch in admin routes.** `admin/audio-metrics/route.ts` fetches up to 10,000 rows in memory (line 112) and computes percentiles client-side. This should be a Postgres aggregate query.

**No pagination on main feed.** `app/(dashboard)/page.tsx` fetches all unread issues from the last 7 days with no limit. A power user with 20 newsletter subscriptions gets 140+ cards loaded at once.

### 1.4 Technical Debt Risks

- `framer-motion.tsx` is a custom animation polyfill (~150 lines) reimplementing `MotionValue`, `useScroll`, `useTransform`, and a `motion` proxy. This is fragile. Either use the real framer-motion package or remove animations.
- `isMissingSelectionColumnError()` in `highlights/route.ts` is a workaround for a schema migration that may not have run. This defensive code should be removed after confirming the column exists in production.
- The `any` type appears frequently (`email: any` on the dashboard, `options: any` in sync-gmail, `block: any` in summarize). These mask real type errors.

### 1.5 Performance Bottlenecks

- **Client-side deduplication.** `dedupeRackIssues` runs on the full issue set after fetch. This should be a database-level dedup or at minimum run server-side with pagination.
- **No caching layer.** Every page load hits Supabase directly. No Redis, no ISR, no stale-while-revalidate. The dashboard page is a Server Component that queries Supabase on every request.
- **Audio generation is synchronous-feeling.** The user triggers audio, it enqueues a job, but the polling mechanism for completion is not visible in the code. If users wait on long-running TTS, perceived performance suffers.

---

## 2. SECURITY AUDIT

### 2.1 CRITICAL: Cross-Site Scripting (XSS) via Newsletter HTML

**File:** `components/HighlightableContent.tsx:451`
**Code:** `container.innerHTML = bodyHtml || '';`

Newsletter HTML is rendered directly into the DOM. The sanitization in `emailParser.ts:sanitizeHtml()` is regex-based and insufficient:

```ts
function sanitizeHtml(html: string): string {
  clean = clean.replace(/<script[\s\S]*?<\/script>/gi, '');
  clean = clean.replace(/<style[\s\S]*?<\/style>/gi, '');
  clean = clean.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '');
  return clean;
}
```

**Missing attack vectors:**
- `<iframe src="javascript:alert(1)">` — not stripped
- `<svg onload=alert(1)>` — the `onload` regex requires quotes around the value; `<svg onload=alert(1)>` without quotes bypasses it
- `<object data="data:text/html,...">` — not stripped
- `<embed>`, `<applet>`, `<form action="...">` — not stripped
- `<a href="javascript:...">` — not stripped
- `<img src=x onerror=alert(1)>` — the existing 1px image filter only catches width/height=1, not general img tags
- CSS-based attacks: `background-image: url(javascript:...)`, `expression()`, `-moz-binding`
- Event handlers without quotes: `onclick=alert(1)` — the regex requires `["']` wrapping

**Impact:** A malicious newsletter sender can execute arbitrary JavaScript in the context of the user's authenticated session. This means:
- Steal Supabase session tokens
- Read all newsletters and highlights
- Trigger API actions (delete content, consume credits)
- Exfiltrate Gmail tokens stored in the profile

**Fix:** Replace regex sanitization with DOMPurify (server-side via jsdom or client-side before innerHTML assignment). This is the single most critical issue in the codebase.

### 2.2 HIGH: SQL-like Injection via Supabase `.ilike` Filter

**File:** `app/api/highlights/route.ts:48`

```ts
query = query.or(`highlighted_text.ilike.%${search}%,note.ilike.%${search}%`);
```

The `search` parameter is interpolated directly into the PostgREST filter string without escaping. While PostgREST parameterizes the actual SQL query, the filter string itself can be manipulated. A search value containing `,` or special PostgREST operators could alter the filter logic.

**Fix:** Escape or validate the search parameter. At minimum, strip characters that are meaningful in PostgREST filter syntax (`,`, `.`, `(`, `)`).

### 2.3 HIGH: Gmail Tokens Stored in Plaintext

**File:** `app/api/sync-gmail/route.ts:40-41`

```ts
.select('gmail_access_token, gmail_refresh_token, gmail_token_expires_at, ...')
```

Gmail OAuth tokens (access + refresh) are stored as plaintext columns in the `profiles` table. Compare this to the Notion integration in `notionSyncJob.ts`, which encrypts the token:

```ts
const decrypted = decryptNotionToken(profile.notion_encrypted_token, ...);
```

The Gmail refresh token grants persistent read access to the user's email. If the Supabase database is compromised (leaked service role key, SQL injection, backup exposure), all users' Gmail accounts are exposed.

**Fix:** Encrypt Gmail tokens at rest using the same pattern as Notion tokens.

### 2.4 HIGH: No Rate Limiting on Any Endpoint

No API route implements rate limiting. Critical endpoints exposed:
- `/api/ai/summarize` — each call consumes OpenAI/Anthropic API credits
- `/api/ai/listen` — each call consumes OpenAI TTS credits
- `/api/sync-gmail` — each call makes dozens of Gmail API requests
- `/api/highlights` — no limit on creation

An attacker with a valid session can:
- Drain your AI API budget by calling summarize in a loop
- Trigger Gmail API rate limit bans for your OAuth app
- Fill the highlights table with garbage data

**Fix:** Implement rate limiting via Vercel Edge middleware, Upstash Redis, or at minimum per-user request counting in Supabase.

### 2.5 MEDIUM: Admin Routes Use Weak Shared Secret

Admin endpoints (`/api/admin/*`, `/api/worker/*`) authenticate via a single `WORKER_SECRET` bearer token. Issues:
- The same secret is shared between admin dashboards and the worker process
- `ADMIN_QUEUE_SECRET || WORKER_SECRET` fallback means the worker secret is effectively the admin secret
- No secret rotation mechanism
- No IP allowlisting

If `WORKER_SECRET` leaks (logs, error messages, client-side bundle), all admin functionality is compromised.

### 2.6 MEDIUM: Missing IDOR Protection on Newsletter Reader

**File:** `app/(dashboard)/newsletters/[id]/page.tsx:12-18`

```ts
const { data: email, error } = await supabase
  .from('issues')
  .select('*, senders(*)')
  .eq('id', params.id)
  .is('deleted_at', null)
  .single();
```

This query does **not** filter by `user_id`. It relies entirely on Supabase RLS policies. If RLS is misconfigured or disabled (common during development), any authenticated user can read any other user's newsletters by guessing/enumerating UUIDs. All other API routes explicitly filter `.eq('user_id', user.id)`.

**Fix:** Add `.eq('user_id', user.id)` explicitly as defense-in-depth, even with RLS enabled.

### 2.7 MEDIUM: Error Messages Leak Internal Details

**File:** `app/api/ai/summarize/route.ts:291-300`

```ts
providerErrors: {
  [provider]: primaryMessage,
  [fallbackProvider]: fallbackMessage,
},
```

AI provider error messages are returned directly to the client. These can contain API key prefixes, model names, rate limit details, and internal configuration that aids reconnaissance.

**File:** `app/api/sync-gmail/route.ts:231`

```ts
{ error: err.message || 'Sync failed' }
```

Raw error messages from Gmail API failures are forwarded to the client.

### 2.8 LOW: No CSRF Protection on State-Mutating GET Requests

The middleware only refreshes the auth session. There's no CSRF token validation. While Supabase uses cookie-based auth with `SameSite` defaults, the absence of explicit CSRF protection is a concern for state-mutating operations.

### 2.9 LOW: `dangerouslySetInnerHTML` in Root Layout

**File:** `app/layout.tsx:35`

The theme detection script uses `dangerouslySetInnerHTML`. The content is a static string (no user input), so this is safe, but it sets a pattern that could be copied unsafely elsewhere.

---

## 3. ARCHITECTURE ASSESSMENT

### 3.1 Is This Buildable Into a Real SaaS?

**Yes, with caveats.** The foundation is solid for 0-100 users:
- Supabase handles auth, database, and storage adequately at this scale
- The entitlement/tier system is already in place
- The job queue works for low-throughput background processing
- Gmail integration via OAuth is the right approach

### 3.2 Where It Breaks at Scale

| Threshold | Failure Point |
|-----------|---------------|
| ~200 users | Gmail sync timeouts — sequential message fetch hits Vercel 60s limit |
| ~500 users | Job queue contention — single worker endpoint processing all job types |
| ~1,000 users | Supabase free/pro tier limits — connection pooling, row limits, storage |
| ~2,000 users | AI cost explosion — no caching of summaries, each user re-summarizes the same newsletters from shared senders |
| ~5,000 users | Need dedicated worker infrastructure (not HTTP-triggered), proper queue (BullMQ/SQS), and a caching layer |

### 3.3 What Must Change Before Public Launch

1. **Fix the XSS vulnerability.** Non-negotiable. One malicious newsletter can compromise every user.
2. **Add rate limiting.** Your AI API keys are exposed to budget drain.
3. **Encrypt Gmail tokens.** You're storing credentials that access users' email in plaintext.
4. **Add the `user_id` filter to the newsletter reader page.** Defense-in-depth.
5. **Add pagination to the main feed.** It will break on power users.

### 3.4 Missing Infrastructure

- **No error tracking.** No Sentry, no LogRocket, no structured logging. `console.error` is the only error reporting.
- **No monitoring/alerting.** No way to know if the worker stops running, if AI calls are failing, or if Gmail sync is broken for users.
- **No database migrations tracked in code.** Schema changes appear to be manual Supabase dashboard operations. This prevents reproducible deployments.
- **No test suite.** Zero tests. No unit tests, no integration tests, no E2E tests. For an MVP this is acceptable, but any refactoring becomes high-risk.

---

## 4. UX / UI REVIEW

### 4.1 Onboarding Flow

**Current flow:** Login with Google → land on empty "The Rack" → SetupGuide component appears → user must manually create a Gmail label, add newsletter emails to it, configure label in settings, then sync.

**Problems:**
- **Too many manual steps.** The user has to leave the app, go to Gmail, create a label, move emails, come back, configure, then sync. This is 5+ steps before seeing any value.
- **Core value is not obvious within 30 seconds.** A new user sees an empty grid with a setup guide. They don't see what the product does until after completing multi-step configuration.
- **The OnboardingWalkthrough component fires once** and marks `onboarding_completed` — if the user dismisses it accidentally, they can't see it again.

**Recommendation:** Pre-populate with sample newsletter content (a demo issue) so users see the reading experience immediately. Then guide them through Gmail connection as a progressive step.

### 4.2 Empty States

**Good:** The empty Rack state shows a zen quote and a sync button. This is pleasant.
**Bad:** The empty state for the Archive, Highlights, and Briefing pages is not visible in the code — likely just empty containers. Empty states should guide users toward the action that fills them.

### 4.3 Information Architecture

The sidebar has: The Rack, Archive, Sources, Highlights, Briefing, Settings. This is a reasonable hierarchy. However:

- **"The Rack"** as a name is brand-aligned but not immediately obvious. New users may not understand it means "inbox."
- **"Sources"** vs "Senders"** — the code uses both terms. Pick one.
- **Briefing** is elite-only but appears in the nav for all users. Clicking it as a free user creates frustration. Either hide it or show a compelling upgrade prompt.

### 4.4 Reading Experience

The newsletter reader (`newsletters/[id]/page.tsx`) is well-designed:
- Clean typography with reading-optimized line height (1.7)
- Sticky top bar with back nav and date
- AI summary card above content
- Highlight-on-select with note support
- Signal tier badges

**Issue:** The `HighlightableContent` component re-writes `innerHTML` on every highlight change (line 451), which causes the entire newsletter to re-render. For long newsletters with many highlights, this creates visible flicker.

### 4.5 Mobile Experience

The dashboard layout has a mobile bottom nav and a hamburger menu. The bottom nav items aren't visible in my review, but the pattern is correct. The reading view uses responsive padding (`px-6 md:px-8`).

**Issue:** The card grid uses `h-52 md:h-56` fixed heights. Long subject lines will be truncated at 3 lines (`line-clamp-3`), which is fine, but very short subjects waste vertical space.

### 4.6 Feature Friction

- **Sync is manual.** Users must click "Sync" to pull new newsletters. The `AutoSync` component exists but only triggers on page load with a 5-minute cooldown. Users expect real-time or near-real-time delivery.
- **Audio generation requires credits.** 10 tokens per listen, free tier gets 30 tokens/month. That's 3 listens. Users will hit the wall fast, and the upgrade path isn't in their face at the moment of exhaustion.

---

## 5. FREE VS PREMIUM STRATEGY

### 5.1 Current Tier Structure (from PricingGrid)

| Feature | Free ($0) | Pro ($9/mo) | Elite ($25/mo) |
|---------|-----------|-------------|-----------------|
| Sources | 5 | Unlimited | Unlimited |
| Credits | 3 | 50 | 300 |
| Highlights & Notes | No | Yes | Yes |
| Weekly Brief | No | No | Yes |
| Semantic Search | No | No | Yes |
| Priority Voice | No | No | Yes |
| Link Multiple Accounts | No | No | Yes |

### 5.2 Problems With Current Gating

**Highlights gated to Pro is a mistake.** Highlighting is the core engagement mechanic — it's what makes users feel ownership of the content and builds the habit loop. Gating it behind $9/mo means free users never experience the product's stickiness. They'll churn before discovering why they'd pay.

**"3 Credits" on free is misleading.** The PricingGrid says "3 Credits" but the code shows `getMonthlyTokenLimit('free') = 30` tokens with `getActionTokenCost('tldr') = 5` and `getActionTokenCost('listen') = 10`. So free users get 6 summaries OR 3 listens. The pricing page should show this in terms users understand.

**The jump from $9 to $25 is too large** for the value differential. Weekly Brief and Semantic Search don't justify nearly 3x the price for most users. The Elite tier looks designed for a power user that may not exist yet.

### 5.3 Recommended Tier Redesign

**Free (forever):**
- Unlimited sources (remove the 5-source cap — it's the #1 churn trigger)
- Full reading experience with highlights and notes
- 5 AI summaries/month
- 2 audio listens/month
- 7-day issue retention on the Rack

**Pro ($7/mo or $59/yr):**
- Everything in Free
- 50 AI summaries/month
- 20 audio listens/month
- Signal sorting
- Highlight export (Markdown/CSV)
- 30-day issue retention

**Elite ($19/mo or $149/yr):**
- Everything in Pro
- Unlimited AI summaries
- Unlimited audio
- Weekly Brief + Weekly Podcast
- Notion sync
- Semantic search
- Multiple Gmail accounts
- Priority voice quality

### 5.4 Gating Logic

```
Free tier users should be able to:
- Read every newsletter ✓
- Highlight and take notes ✓ (change from current)
- Use AI features with volume caps ✓
- Experience the full UI (no locked icons)

Premium gates should trigger:
- When a usage cap is hit → show remaining count + upgrade CTA
- When accessing a tier-locked feature → show preview + "Unlock with Pro/Elite"
- Never block the core reading flow
```

### 5.5 "Premium Coming Soon" Communication

Don't say "Premium Coming Soon." Instead:
- Show the feature working (e.g., let free users generate 1 weekly brief as a trial)
- When they hit the limit: "You've used your free weekly brief. Upgrade to Pro for weekly briefs every Monday."
- Use the moment of demonstrated value, not a marketing banner

### 5.6 Pricing Psychology

- **Anchor on annual pricing.** Show `$59/yr` prominently, `$7/mo` smaller. The annual price looks like a deal.
- **ROI Calculator is strong.** Keep it. But calibrate the "50% time recovery" claim — it's aggressive. 30% is more believable and still compelling.
- **Free tier should not feel punishing.** The 5-source limit feels punishing. Remove it and gate on AI usage instead — AI is the expensive resource, not storage.

---

## 6. FIRST 100 USER STRATEGY

### 6.1 Ideal Early Adopter

**Profile:** Knowledge workers who subscribe to 10+ newsletters and feel overwhelmed. Specifically:
- Startup founders / VCs who read Stratechery, Morning Brew, The Hustle, Lenny's Newsletter
- Content marketers who track industry newsletters for competitive intelligence
- Solo consultants who need to stay current but can't spend 2 hours/day reading

**Not your early adopter:** Casual readers, people who subscribe to 2-3 newsletters, people who already use Feedly/Omnivore (they have a workflow).

### 6.2 Distribution Channels

**Highest leverage:**

1. **Newsletter about newsletters.** Write a weekly "Best of newsletters" digest using Readflow itself. Post it on Substack. Every reader is a potential user.

2. **Twitter/X threads.** "I read 47 newsletters this week. Here are the 5 insights that matter." End with "I use Readflow to do this. [link]". The format demonstrates the product's value proposition.

3. **ProductHunt launch.** Time it after you have 20-30 active users who can upvote and leave reviews. The "newsletter reader" category is underserved on PH.

4. **Indie Hackers / Hacker News.** "Show HN: I built a newsletter reader that summarizes and reads your newsletters aloud." The AI audio angle is the hook.

5. **Direct outreach to newsletter authors.** If Readflow makes their newsletter easier to consume, they'll recommend it to subscribers. Start with 10 mid-tier Substack authors (5K-20K subscribers).

### 6.3 Positioning

**Don't say:** "Newsletter aggregator" (commodity), "AI-powered inbox" (vague), "Newsletter app" (boring).

**Say:** "Win your war on noise." (You already have this — it's good.)

**Sharper:** "Readflow turns 47 newsletters into 15 minutes of signal." This is specific, quantified, and implies the product does work for you.

### 6.4 Onboarding Flow for First Users

```
1. Land on landing page → "Win your war on noise" → CTA: "Connect Gmail, free forever"
2. Google OAuth (already implemented)
3. Auto-detect newsletters in inbox (scan for common sender domains: substack.com, beehiiv.com, etc.)
4. Show user: "We found 23 newsletters in your inbox. Here are the latest 10."
5. User immediately sees content — value in under 60 seconds
6. Prompt: "Want AI summaries? Try one free." → Summarize the top issue
7. User sees summary → "You have 4 more free summaries this month."
```

The current flow requires manual label creation, which is the #1 adoption killer. Auto-detection of newsletters is the most impactful feature you're not building.

### 6.5 Feedback Loop

- **In-app feedback button** on every newsletter card: thumbs up/down on signal classification, summary quality
- **Weekly email to you** (the founder) with: new signups, active users, features used, credits consumed
- **Direct Slack/Discord channel** for first 100 users — this is your advisory board
- **Article feedback is already built** (`/api/articles/[id]/feedback`) — surface it more prominently

### 6.6 Retention Hooks

- **Daily/weekly email digest:** "You have 7 unread newsletters. Here's a 30-second brief." Bring users back.
- **Highlight streaks:** "You've highlighted 3 days in a row." Lightweight gamification.
- **Weekly Brief (for Pro users):** This is the strongest retention hook — users come back Monday to read their brief.
- **Audio during commute:** If users build the habit of listening during their commute, daily retention follows.

### 6.7 Features to NOT Build Yet

- Multi-provider email support (Outlook, etc.) — Gmail is 80% of the target market
- Social/sharing features — focus on individual value first
- Custom AI models/prompts — too niche for first 100 users
- Team/workspace features — this is a personal tool, not a team tool
- Mobile native app — the PWA manifest is already configured; that's sufficient

---

## 7. PRIORITY ROADMAP

### Top 10 Highest-Leverage Improvements

| # | Item | Label | Impact |
|---|------|-------|--------|
| 1 | **Fix XSS: Replace regex sanitizer with DOMPurify** | Must fix before launch | Prevents account takeover via malicious newsletter |
| 2 | **Add rate limiting to AI and sync endpoints** | Must fix before launch | Prevents API budget drain |
| 3 | **Encrypt Gmail tokens at rest** | Must fix before launch | Protects users' email access if DB is compromised |
| 4 | **Add `user_id` filter to newsletter reader page** | Must fix before launch | IDOR defense-in-depth |
| 5 | **Auto-detect newsletters in Gmail** (remove manual label requirement) | Must fix before launch | Eliminates the #1 adoption barrier |
| 6 | **Make highlights free for all tiers** | Fix soon | Enables the core engagement loop for free users |
| 7 | **Add pagination to the main feed** | Fix soon | Prevents performance degradation for power users |
| 8 | **Parallelize Gmail sync** (batch fetch with concurrency limiter) | Fix soon | Prevents sync timeouts at scale |
| 9 | **Add error tracking (Sentry)** | Fix soon | You're flying blind on production errors |
| 10 | **Cache AI summaries per issue** (don't re-summarize the same newsletter) | Nice to have | Reduces AI API costs significantly |

### 30-Day Stabilization Plan

**Week 1: Security hardening**
- [ ] Integrate DOMPurify for HTML sanitization (server-side in `emailParser.ts`, client-side fallback in `HighlightableContent.tsx`)
- [ ] Encrypt Gmail tokens using the existing Notion encryption pattern
- [ ] Add `user_id` to the newsletter reader query
- [ ] Add rate limiting via Upstash Redis or Vercel KV (5 AI calls/min, 2 syncs/min per user)
- [ ] Sanitize error responses — remove provider details from 500 errors

**Week 2: Onboarding & activation**
- [ ] Build newsletter auto-detection (scan inbox for substack.com, beehiiv.com, convertkit.com, etc.)
- [ ] Remove manual label requirement from initial setup
- [ ] Create demo/sample content for empty state
- [ ] Ungrate highlights from Pro tier
- [ ] Add first-use tooltips for AI summary and audio features

**Week 3: Performance & reliability**
- [ ] Add pagination to the main feed (20 items, load more)
- [ ] Parallelize Gmail message fetching (batches of 10)
- [ ] Add Sentry or equivalent error tracking
- [ ] Extract shared auth middleware for API routes
- [ ] Cache AI summaries in a `summaries` table keyed by issue ID

**Week 4: Growth preparation**
- [ ] Adjust pricing tiers per Section 5.3 recommendations
- [ ] Add credit exhaustion upgrade prompts (inline, not modal)
- [ ] Set up a basic admin dashboard (user count, daily active, credits consumed)
- [ ] Write the "newsletter about newsletters" launch post
- [ ] Soft-launch to 10-20 beta users for feedback

---

## Appendix: Code File Reference

Key files reviewed:
- `app/layout.tsx` — Root layout, theme detection
- `app/(dashboard)/layout.tsx` — Dashboard shell, sidebar, mobile nav
- `app/(dashboard)/page.tsx` — Main feed ("The Rack")
- `app/(dashboard)/newsletters/[id]/page.tsx` — Newsletter reader
- `app/api/sync-gmail/route.ts` — Gmail sync endpoint
- `app/api/ai/summarize/route.ts` — AI summary with Anthropic/Grok fallback
- `app/api/ai/listen/route.ts` — Audio generation endpoint
- `app/api/highlights/route.ts` — Highlight CRUD
- `app/api/worker/process-jobs/route.ts` — Background job processor
- `app/api/admin/audio-metrics/route.ts` — Admin metrics
- `app/landing/page.tsx` — Landing page
- `app/login/page.tsx` — Google OAuth login
- `components/HighlightableContent.tsx` — Newsletter renderer with highlighting
- `components/landing/PricingGrid.tsx` — Pricing tiers
- `components/landing/ROICalculator.tsx` — ROI calculator
- `utils/emailParser.ts` — Gmail message parsing + HTML sanitization
- `utils/aiEntitlements.ts` — Token/credit gating system
- `utils/jobs.ts` — Background job queue
- `utils/audioJob.ts` — Audio generation pipeline
- `utils/audioScriptEngine.ts` — Text-to-speech preprocessing
- `utils/weeklyBrief.ts` — Weekly newsletter brief generation
- `utils/notionSyncJob.ts` — Notion integration
- `utils/signalSortHeuristics.ts` — Newsletter signal classification
- `utils/aiModels.ts` — AI model configuration
- `middleware.ts` — Auth session refresh
