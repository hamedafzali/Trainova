# Verification report

Branch `transformation`, 2026-10-19, at the end of M9. It covers milestones
M1–M9 of `docs/TRANSFORMATION_PLAN.md`.

## Checks

Run locally on Node 25. CI runs the same checks on Node 22.

| Check | Command | Result |
|---|---|---|
| Types | `pnpm typecheck` | pass |
| Lint | `pnpm lint` | pass, no warnings |
| AI evals | `pnpm eval` | 24/24 pass (dataset v1) |
| Tests | `pnpm test` | 408/408 pass in 40 files, PGlite route integration tests included |
| Build | `pnpm build` | pass, 103 kB shared first-load JS |
| Dependencies | `pnpm audit --prod` | no known vulnerabilities |

**CI.** GitHub Actions had failed on every run since CI was added, before any
of the checks above ran. On Node 20, undici 8 (pulled in by jsdom 30) throws
`webidl.util.markAsUncloneable is not a function`. The workflow now uses
Node 22, and the first run on it (`3826d29`) passed. A second job builds the
production image and checks that it boots and serves `/`.

**Rendered checks.** UI changes were reviewed in Playwright screenshots at
390 px, in dark and light, during the redesign milestones and again for the
M8 recovery and nutrition cards.

The signed-in AI paths were not exercised against a real model. They are
covered by integration tests with the model mocked, and by the eval set.

## Milestones

| Milestone | Status |
|---|---|
| M1 Security & data protection | done |
| M2 Domain integrity & sync | done |
| M3 Design system & core UX | done; per-component primitive cleanup left open |
| M4 Coaching profile | done |
| M5 Training Analyst | done |
| M5b UI rebuild to the reference design | done; three items deferred (below) |
| M6 Exercise & Equipment Coach | done |
| M7 AI orchestration, evaluation & observability | done |
| M8 Progress, recovery, nutrition | done |
| M9 Docs, mobile plan, release readiness | done (this report) |

Deferred items:

- **M3:** component primitives refactor. Screens already use the tokens.
- **M5b `?tab=` links:** deep links into the tab sets.
- **M5b bell inbox:** the bell opens the coach for now.
- **M5b live workout:** the per-set table layout. The live workout uses the
  new tokens but keeps the stepper cards.

## Documentation

| Document | Covers |
|---|---|
| `docs/ARCHITECTURE.md` | Stack, source layout, data model, sync, auth, database, offline, invariants |
| `docs/OPERATIONS.md` | Environment, deploy via ACM, migrations, backup, restore, rollback, monitoring |
| `docs/AI.md` | Tasks, gate, model routing, guardrails, evals, `ai_runs`, known gaps |
| `docs/DESIGN_SYSTEM.md` | Tokens, kit, surfaces, card padding, estimate labelling |
| `docs/MOBILE.md` | PWA hardening, Capacitor store builds, native features |

## Risks

These are ordered by how much they matter before or soon after release.

1. **Backups on the same host.** Nightly dumps sit in a volume on the same
   machine as the database. A dead disk loses both. Copy them off the box.
2. **Guest data on iOS.** Safari may evict `localStorage` for sites left
   unused for weeks, unless the app is on the Home Screen. Guests without an
   account can lose their log. Phase 1 of `docs/MOBILE.md` addresses this.
3. **First deploy on Node 22.** The image moved from `node:20-alpine` (past
   end of life) to `node:22-alpine`. CI builds and boots it, but only without
   a database. Watch the first ACM boot for the `[db]` migration line.
4. **Client-built trainer context.** Trainer chat and review still take a
   context the client builds. It is parsed, size-capped and validated, but
   not rebuilt from the synced document as the analyst and exercise coach
   contexts are.
5. **Pages render per request.** The nonce CSP (`src/middleware.ts`) needs a
   fresh nonce on every page, so no page is prerendered. Pages are client
   shells, so the cost is small, but watch response times after deploy.
6. **In-process analyst cache.** This is fine for one instance. Move it to
   Redis before scaling out.
7. **Readiness is a heuristic.** The exercise coach and trainer now see the
   band and its reasons (never the score), and the coach won't add load on a
   low band. The estimate itself is rule-based, not validated against outcomes.
8. **Self-reported nutrition gates.** Age, pregnancy and medical flags are
   whatever the user enters. The server takes the stricter of the client and
   synced values but can't verify them.

## Behaviour changes users will notice

- **Trainer links:** existing trainer–client links become pending until the
  client accepts them (Profile → Coaches).
- **AI consent:** every account must allow AI data sharing once before the AI
  features work.
- **Progression:** one missed session now repeats the load; a deload needs two
  misses in a row.
- **Rebrand:** the app moved from blue to graphite and lime. On iOS, users may
  need to reinstall the PWA to get the new icon.
- **Navigation:** "Plans" is now "Train", and History lives under Progress.

## Owner actions

1. **Merge:** merge `transformation` into `main` once CI is green.
2. **Deploy:** redeploy through ACM.
3. **Check migrations:** after boot, check that migrations 002 and 003 were
   applied:

   ```sql
   select id from schema_migrations order by id;
   ```

4. **Smoke test:** sign in, open Progress and AI Coach, and confirm that
   `/admin/ai` shows runs.
5. **Set the proxy flag:** set `TRUST_PROXY=1` only if a reverse proxy
   overwrites `X-Forwarded-For`.
6. **Back up off the box:** schedule a copy of `/backups` to another machine.
   Rehearse the restore in `docs/OPERATIONS.md` once.
