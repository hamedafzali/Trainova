# Trainova transformation — implementation plan & checklist

Source of truth for the product transformation started 2026-10-18. Each
milestone is closed only after `pnpm typecheck`, `pnpm lint`, `pnpm test` and
`pnpm build` pass. Status markers: `[x]` done and verified, `[~]` partly done,
`[ ]` not started, `[!]` blocked (reason given).

Baseline (2026-10-18, commit 4c55c67): 238/238 tests, tsc clean, lint clean,
build OK, `pnpm audit --prod` = 54 advisories (3 critical, 20 high).

## Key decisions

| Decision | Choice | Why |
|---|---|---|
| Framework upgrade | Next 15.5.28 + React 19.2.7 + R3F 9 | Every Next advisory is fixed only in ≥15.5.24; Next 16 adds risk with no extra security benefit. |
| Data architecture | Keep local-first + per-user JSON document, harden the merge and the server write path | Offline logging in a gym is the core job. One user's state is small (≈ hundreds of KB after years); a single row with optimistic concurrency (`base` timestamp) is safe at this scale. Normalised tables become worthwhile only for cross-user queries (trainer, analytics), which read the document server-side today. Revisit at ~2 MB/user. |
| Schema changes | Runtime migration runner (`src/server/migrations.ts`) with a ledger table and advisory lock | `db/init` only runs on an empty volume, so the live database never received later files. |
| Auth transport | HttpOnly session cookie, bearer header accepted during transition | Removes the long-lived token from JavaScript (XSS exfiltration). |
| AI data source | Server builds AI context from the synced document, not from the request body | Client-sent context can't be trusted and is incomplete. |
| AI systems | Training Analyst (longitudinal, strong model) + Exercise Coach (in-workout, small model) behind one orchestrator | Different context sizes, latency budgets and evaluation criteria. |
| AI numbers | Deterministic engine computes every metric; model may only cite numbers present in the evidence package; validator rejects the rest | Prevents invented PRs/trends. |

## Milestones

### M1 — Security & data protection
- [x] Next 15.5.28 / React 19.2.7 / nodemailer 10 / postcss overrides → `pnpm audit --prod`: 0
- [x] Security headers + CSP (`next.config.mjs`)
- [x] Runtime migration runner + ledger (`001`–`003`, PGlite-tested on fresh + legacy DBs)
- [x] HttpOnly cookie sessions, token version (revocation), logout / sign out everywhere, 30-day TTL, Origin check on cookie writes; legacy localStorage token migrated via `/api/auth/me`
- [x] Hashed single-use reset tokens, rate limits on forgot/reset, password ≥ 8 (server + UI), admin reset revokes sessions
- [x] Rate limiter: per-email + per-IP, in-memory fallback when Redis is down, forwarded IPs only with `TRUST_PROXY=1`; AI: 20/min + daily budget (`AI_DAILY_LIMIT`, default 200)
- [x] Trainer invitations: pending → accepted/declined/revoked (Profile → Coaches); identical response for unknown emails; assignments only from active coaches; assignment payload validation
- [x] AI data-sharing consent (server-enforced in `aiGuard`, versioned, disclosure card in Coach + Profile toggle), analytics opt-out (client + server, deletes past events)
- [x] Account export (`/api/account/export`, no secrets) + password-confirmed self-service deletion

### M2 — Domain integrity & sync
- [x] Progression engine v2: double progression via template rep range (`repMax`), equipment increments (stack / plates / dumbbell / explicit), missing RPE → smallest jump + low confidence, judged on working-load sets; fixed premature deload (miss streak counted the last session, so one miss deloaded)
- [x] Unit boundary fixes: coach summary/insights in display units (stall back-off was kg-grid, values were kg labelled lb), tests
- [x] Merge: versioned templates/programs/exercises/profile (units change stamps the profile), PRs re-derived from sets; tests for stamps, merge policy, PR rebuild
- [x] `PUT /api/state`: version compare-and-set (legacy `base` accepted), 5 MB cap, shape/range validation (422 surfaced via `syncError()`)
- [x] Undo + audit trail for AI-applied plan changes (`planChanges`, synced; undo refuses if the workout was edited since)

### M3 — Design system & core UX
- [ ] Tokens (graphite/lime dark, full light theme, semantic + AI colours), Inter, radii, motion
- [ ] Component primitives refactor; screens moved onto tokens
- [ ] Rendered review (desktop/tablet/mobile, light/dark) with Playwright screenshots

### M4 — Coaching profile
- [ ] Profile: schedule, session length, equipment access, limitations, preferences, RPE preference, coach notes
- [ ] Onboarding persists days/setting; profile editor

### M5 — Training Analyst
- [ ] Deterministic analysis engine (trends, stalls, volume, consistency, data-quality)
- [ ] Evidence package + versioned schema + numeric-claim validator
- [ ] Server pipeline from synced document, cache by data version
- [ ] Analyst UI (evidence, periods, confidence, missing data)

### M6 — Exercise & Equipment Coach
- [ ] Context builder (exercise metadata, device, targets, today's sets, history, limitations)
- [ ] Deterministic set assessment + substitutions; model explains, never invents machine settings
- [ ] In-workout sheet UI

### M7 — AI orchestration, evaluation & observability
- [ ] Orchestrator + model routing per task, model recorded per response
- [~] `ai_runs` logging (no content) — schema ready; Redis-backed AI rate limit + daily budget done
- [ ] Versioned eval dataset + deterministic eval runner in CI
- [ ] Admin AI observability view

### M8 — Progress, recovery, nutrition
- [ ] Recovery: feedback + check-ins, labelled estimate
- [ ] Nutrition: calorie floor, protein/fat floors, carb floor, minors/pregnancy gating, opt-out

### M9 — Docs, mobile plan, release readiness
- [ ] ARCHITECTURE / OPERATIONS (env, migrations, backup+restore, rollback) / AI / DESIGN_SYSTEM / MOBILE
- [ ] Verification report

## Remaining risks / decisions for the owner
(maintained at the end of each milestone)

After M1 (2026-10-18): typecheck, lint, 254/254 tests (incl. PGlite route integration tests), build — all pass.

- **Behaviour changes on deploy.** Existing trainer→client links become *pending*; clients must accept them in Profile → Coaches. Every account must allow AI data sharing once before AI features work again. Both are deliberate (consent), but worth announcing.
- **Proxy setting.** Set `TRUST_PROXY=1` only if the app sits behind a reverse proxy that overwrites `X-Forwarded-For`; otherwise IP limits apply per server, not per client.
- **Not yet rendered/inspected:** Profile → Privacy/Coaches/Account data and the AI consent card (needs a signed-in session against a database) — scheduled with the M3 Playwright review.
After M2 (2026-10-18): typecheck, lint, 284/284 tests, build — all pass.

- **Progression behaviour change.** A single missed session now repeats the load (previously it deloaded 10%); deload needs two misses in a row. Users who never log RPE get +2.5 kg / +5 lb jumps instead of +5 / +10 on compounds.
- **Rep range UI** (template editor stepper) and the Undo button are not yet rendered/inspected — part of the M3 review.
- **CSP** still allows `'unsafe-inline'` scripts (Next inline bootstrap + theme script). Nonce-based CSP is a follow-up.
