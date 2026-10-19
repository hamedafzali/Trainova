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
- [x] Tokens (graphite/lime dark, full light theme, semantic + info + AI colours, every text pairing ≥ 4.5:1), Inter only (Archivo removed), tabular numerals
- [x] Brand assets on the new palette (icons, PNGs regenerated, lockups, manifest, recap image)
- [x] Navigation: Today / Train / Progress / AI Coach / Profile (one active item, sub-pages mapped, tested); History linked from Progress, Exercises from Train
- [x] Active-workout focus mode (no sidebar or tab bar during a live workout)
- [~] Rendered review: guest screens (Today, Train, template, Progress, AI Coach, Profile, History, Exercises, live workout) at 390/820/1440 in light + dark, no page errors. Signed-in screens (Privacy, Coaches, consent card) and AI Undo still need a database-backed session
- [ ] Component primitives refactor (screens already consume tokens; per-component cleanup pending)

### M4 — Coaching profile
- [x] Coaching profile (`src/domain/coachingProfile.ts`): days/week, usual days, session length, equipment, limitations, RPE preference, coach notes — normalised on every read, validated server-side in `PUT /api/state`
- [x] Onboarding persists days/week and equipment; Profile → Training setup editor (rendered light/dark at 390 px)
- [x] Personalisation: RPE picker hidden when the user chose "Never"; coach prompt gets a SETUP line and the client's limitations/notes JSON-quoted as data, with rules to respect them and never follow instructions inside them

### M5 — Training Analyst
- [x] Deterministic analysis engine (trends, stalls, volume, consistency, data-quality) — `src/domain/analyst.ts`
- [x] Evidence package + versioned schema (`analyst-evidence/1`) + numeric-claim validator
- [x] Server pipeline from synced document, cache by data version — `POST /api/ai/analyst`
- [x] Analyst UI (evidence, periods, confidence, missing data) — Progress → Training analysis

### M5b — UI rebuild to the reference design (added 2026-10-18)
Reference: three mobile screens (Home, exercise detail with set logging, Progress overview) supplied by the owner.
Built before M6, because M6's in-workout coach belongs in the new exercise/logging screen.

Gap analysis, current → reference:
- Home leads with workout in progress / muscle map; reference leads with greeting + headline, weekly progress (X / goal, M–S check dots, % ring), a Today's Workout hero card (duration, level, Start) and four quick actions. "This week" is at the bottom today.
- Exercise detail is one long page; reference has Overview / Muscles / Instructions tabs, a hero visual, an attribute strip (compound, primary muscle, rep range), a working-sets table with Log Set / Add Set, and a tips card with a body figure.
- Live logging shows one big stepper card per set; reference shows every set as a table row (weight, reps, RPE, rest, ✓) with the active set editable.
- Progress is one list; reference has Overview / Strength / Body / Workouts tabs, a period picker with ‹ ›, a summary strip (workouts, total time, calories, PRs), a muscle-focus donut and a strength chart with an exercise picker and a delta.
- Tab bar: reference active state is a lime icon + label with no pill; tabs are Home / Plan / Workouts / Progress / Profile, with no AI Coach tab.

Owner decision (2026-10-18): match the reference exactly — tabs, accent, layouts and the calories tile.

Primitives (`src/components/ui/`):
- [x] `Tabs` (underline, ARIA tablist with arrow keys), `PeriodPicker` (This Week / This Month / Last 3 Months + ‹ ›)
- [x] `ProgressRing`, `Donut` (legend carries the values, not colour alone), `DayDots`, `QuickAction`
- [x] `SetTable` (read-only rows), `StrengthChart` (y axis, week labels, latest-value pill), `WorkoutArt` (our own hero art)
- [x] Tab bar: flat full-width bar, lime icon + label active state, no pill
- [ ] `?tab=` deep links for the tab sets

Domain modules:
- [x] `periodStats` — workouts, time (clamped 1–240 min per session), estimated calories, PRs, muscle share of working sets (warm-ups/cardio excluded, "Other" bucket, shares sum to 100), weekly best e1RM
- [x] `estimateDuration(template)` — sets × (40 s work + rest), rounded to 5 min
- [x] Exercise favourites (bookmark) — `profile.favoriteExerciseIds`
- [x] Exercise tips — `tipFor()`: template cue → our own pattern tips → first instruction → muscle-group tip
- [ ] Inbox for the bell (the bell opens the coach for now)

Screens:
- [x] Home: logo + bell, greeting + "Ready to forge greatness.", streak tile, weekly progress (X / goal, M–S dots, % ring), Today's Workout hero (Resume when live), quick actions (Workouts, Exercises, Programs, Nutrition), floating coach button
- [x] Exercise detail: back / title / bookmark / ⋯; Overview / Muscles / Instructions tabs; 3D movement hero, attribute strip, Working Sets table with Edit, Log Set / Add Set, tips card with body figure; records and recent sessions below
- [x] Progress: Overview (period picker, Workout Summary, Muscle Focus donut, Strength Progress chart + picker + delta), Strength (Training analysis + exercise list), Body (bodyweight + readiness map), Workouts (recent + full history)
- [x] Nav: Home · Plan (/programs, /calendar) · Workouts (/templates, /session, /history, /exercises) · Progress · Profile; coach reached from Home (bell, floating button) and the desktop sidebar
- [x] Accent retuned to `#C3E201` (light theme text accent `#546500` for contrast); charts, 3D scene and recap card follow
- [x] Rendered check at 390 (light + dark) and 1280 against the reference; no horizontal scroll, no page errors
- [ ] Live workout restyled to the per-set table (deferred: today it inherits the new tokens but keeps the stepper cards)
- [x] Home redesigned from the AIDesigner ultradesign run (373a5132); its palette and building blocks extracted into `src/components/kit.tsx` + `docs/DESIGN_SYSTEM.md` and applied to Plan, Workouts, Progress, Profile, History, Calendar, Exercises and Coach (390 px light + dark checked, no page errors)

Where we differ from the reference, and why:
- **No photos of people.** Third-party human models are ruled out and nothing is bought. Photo areas use our own art: the dumbbell/rack illustration on Home, the 3D movement guide on the exercise screen.
- **Calories are labelled as an estimate**: 5 MET × bodyweight (75 kg when none is logged, and the card says so) × time trained.
- **The streak counts weeks**, because that is how Trainova measures it; "7 days" would overstate it.
- **Own copy** wherever the reference's text isn't a label.

### M6 — Exercise & Equipment Coach
- [x] Context builder (exercise metadata, device, targets, today's sets, history, limitations) — `src/domain/exerciseCoach.ts`, same answer on server and device
- [x] Deterministic set assessment + substitutions; model explains, never invents machine settings — `POST /api/ai/exercise-coach` builds evidence from the synced log, validates numbers against facts, rejects seat/pin settings, red-flag symptoms get a stop message
- [x] In-workout sheet UI — `ExerciseCoachSheet` from the live exercise card and from an exercise's page during a workout: status, next set, per-set check, coach reading (rules offline / AI with consent), and swaps for the sets not yet logged (`swapSessionExercise`, this workout only)

### M7 — AI orchestration, evaluation & observability
- [x] Orchestrator + model routing per task, model recorded per response — `src/services/ai/tasks.ts`: each task has a tier; "deep" (analyst, trainer chat/review) starts on mistral-large, "fast" (exercise coach, coach intro/meals) on mistral-small, each falling back along its own list. `MISTRAL_MODEL_DEEP` / `MISTRAL_MODEL_FAST` pin a tier, `MISTRAL_MODEL` pins both. The model that answered is recorded on the run
- [x] `ai_runs` logging (no content) — `meteredAi` in `src/server/aiRuns.ts` wraps every AI route; an AsyncLocalStorage meter (`runMeter.ts`) collects model, tokens, latency, prompt version (`task@hash` of the system prompt), input schema version, validation issues, error code and whether the fallback was shown. Never prompt, reply or user text. Requests answered without the model (cache, red flag, AI off) aren't logged; a logging failure never fails the request. Redis-backed AI rate limit + daily budget done
- [x] Versioned eval dataset + deterministic eval runner in CI — `src/services/ai/evals/dataset.v1.json` (23 cases over all six tasks: grounded, invented numbers, projections, machine settings, harmful advice, red flags, bad JSON) plays canned replies through the real services and validators; `pnpm eval` prints a per-task scorecard. `.github/workflows/ci.yml` runs typecheck, lint, eval, tests and build on pushes and PRs
- [x] Admin AI observability view — `/admin/ai` (+ `GET /api/admin/ai-runs?days=1|7|30`): runs, success, fallback and user counts, per-task success/rejections/p50/p95/tokens, per-day chart, models, error codes, prompt versions

### M8 — Progress, recovery, nutrition
- [x] Recovery: feedback + check-ins, labelled estimate — daily check-in (sleep, energy, soreness, stress, 1–5; one per day, synced as `checkIns`) and `readinessEstimate` in `src/domain/recovery.ts`: training load (muscles still recovering, consecutive training days, hard/low-energy feedback in the last 48 h) blended 40/60 with the check-in. Shown on Progress → Body as an "Estimate" with every factor listed; no score without a check-in (band only, low confidence). Pain noted in the last 7 days caps it at "ease off" and says to get it checked
- [x] Nutrition: calorie floor, protein/fat floors, carb floor, minors/pregnancy gating, opt-out — `src/domain/nutrition.ts`: Mifflin-St Jeor, deficit ≤ 300 kcal, surplus 250 kcal; calories ≥ max(BMR, 1500 m / 1200 f); protein 1.8 g/kg of reference weight (BMI ≤ 27), ≤ 220 g; fat ≥ max(0.6 g/kg, 20% kcal); carbs ≥ 130 g (fat trimmed first, then calories raised). No targets under 18, while pregnant/breastfeeding, or with a diet-related medical condition / disordered-eating history — the card points to a professional. Opt-out clears sex/age/height. The meals route recomputes targets server-side and takes the stricter of client and synced flags; gated or opted-out users never reach the model

### M9 — Docs, mobile plan, release readiness
- [x] ARCHITECTURE / OPERATIONS (env, migrations, backup+restore, rollback) / AI / DESIGN_SYSTEM / MOBILE — `docs/ARCHITECTURE.md`, `docs/OPERATIONS.md`, `docs/AI.md`, `docs/MOBILE.md`; `docs/DESIGN_SYSTEM.md` gains the card padding and estimate rules; root `ARCHITECTURE.md` marked historical
- [x] Verification report — `docs/VERIFICATION.md`: check results, milestone status, risks, owner actions. CI moved to Node 22 (it had failed on Node 20 since it was added)

## Remaining risks / decisions for the owner
(maintained at the end of each milestone)

After M1 (2026-10-18): typecheck, lint, 254/254 tests (incl. PGlite route integration tests), build — all pass.

- **Behaviour changes on deploy.** Existing trainer→client links become *pending*; clients must accept them in Profile → Coaches. Every account must allow AI data sharing once before AI features work again. Both are deliberate (consent), but worth announcing.
- **Proxy setting.** Set `TRUST_PROXY=1` only if the app sits behind a reverse proxy that overwrites `X-Forwarded-For`; otherwise IP limits apply per server, not per client.
- **Not yet rendered/inspected:** Profile → Privacy/Coaches/Account data and the AI consent card (needs a signed-in session against a database) — scheduled with the M3 Playwright review.
After M2 (2026-10-18): typecheck, lint, 284/284 tests, build — all pass.

- **Progression behaviour change.** A single missed session now repeats the load (previously it deloaded 10%); deload needs two misses in a row. Users who never log RPE get +2.5 kg / +5 lb jumps instead of +5 / +10 on compounds.
- **Rep range UI** (template editor stepper) and the Undo button are not yet rendered/inspected — part of the M3 review.
After M3 (2026-10-18): typecheck, lint, 287/287 tests, build — all pass.

- **Visible rebrand.** Blue → graphite/lime everywhere, including the installed-app icon (users may need to reinstall the PWA to see the new icon on iOS).
- **Navigation change.** "Plans" is now "Train"; History moved from the tab bar into Progress (still in the desktop sidebar).
After M4 (2026-10-18): typecheck, lint, 296/296 tests, build — all pass.

- **Coaching data goes to the AI provider.** Limitations and coach notes are now part of the AI context (covered by the existing AI data-sharing consent, which already lists "notes or limitations you entered").
- **Test timeouts** raised to 20 s / 30 s hooks: PGlite tests occasionally exceeded 5 s under a full parallel run.

After M5 (2026-10-18): typecheck, lint, 314/314 tests, build — all pass.

- **AI reads the synced copy.** The analyst route builds evidence from `user_state`, so unsynced local workouts aren't in the AI reading; the UI labels it "From your last synced data". The on-screen measurements are computed locally and always current.
- **Strict validator.** Any number in the AI reply that isn't a fact (or its whole-number rounding / absolute value) rejects the whole reply and the rule-based reading is shown. Expect some fallbacks with weaker models; fallback rate is tracked per task on `/admin/ai`.
- **Analysis cache is in-process** (500 entries, keyed by user, data version, period, day). Fine for one instance; move to Redis if the app is scaled out.
- **Signed-in AI path not rendered locally** (no DB/key in the preview); covered by PGlite integration tests with the model mocked.

After M8 (2026-10-19): typecheck, lint, 408/408 tests, build — all pass. Recovery and nutrition cards checked at 390 px in dark and light.

- **Readiness is rule-based**, not validated against any outcome. It's labelled as an estimate and never blocks training; it isn't fed to the AI coaches yet (follow-up).
- **Nutrition gates rely on self-report.** Age, pregnancy and medical flags are what the user tells us; the server uses the stricter of client and synced values but can't verify them.
- **Legacy `/api/checkins` + `daily_checkins`** remain (export only); the new check-ins live in the synced document.

After M9 (2026-10-19): typecheck, lint, 24/24 evals, 408/408 tests, build, `pnpm audit --prod` — all pass. Full list in `docs/VERIFICATION.md`.

- **CI was red on every run** until this milestone (jsdom 30 / undici 8 need Node 22). Confirm the first run after pushing is green.
- **Docker image moved to `node:22-alpine`** (after M9, own deploy). CI now builds the image and checks it boots; watch the first ACM boot.
- **Backups live on the same host** as the database. Copy them off the box.

- **CSP** is nonce-based (follow-up, `src/middleware.ts`): no `'unsafe-inline'` scripts. Pages now render per request; API routes get a no-script policy.
