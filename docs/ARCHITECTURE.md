# Architecture

Trainova is a local-first strength-training PWA. Workouts are logged on the
device and work fully offline; an optional account syncs one JSON document
per user to Postgres and unlocks the AI coaches and trainer features.

The root `ARCHITECTURE.md` is the earlier session/template redesign note. It
explains why sessions have an explicit `status`, and is kept for history.

## Stack

| Layer | Choice |
|---|---|
| App | Next.js 15.5 (App Router, standalone output), React 19, TypeScript |
| Styling | Tailwind with CSS-variable tokens (see `docs/DESIGN_SYSTEM.md`) |
| Client state | Zustand, persisted to `localStorage` under `trainova-2026-06` |
| Server data | Postgres 16 (`pg`), schema migrated at boot |
| Cache / limits | Redis (`ioredis`), with an in-process fallback when it is down |
| AI | Mistral (`@mistralai/mistralai`), see `docs/AI.md` |
| Auth | `jose` JWT in an HttpOnly cookie, `bcryptjs` password hashes |
| Tests | Vitest + Testing Library; PGlite for route integration tests |

## Source layout

```
src/
  app/            routes (pages) and app/api/** route handlers
  components/     UI; kit.tsx is the page kit, ui/ the primitives
  domain/         pure logic: types, progression, records, analysis,
                  recovery, nutrition, merge, snapshot validation
  lib/            client glue: store, sync, auth, units, hooks
  server/         server-only: db pool, migrations, session, rate limit,
                  AI guard + run logging, trainer, mail
  services/ai/    model client, task routing, prompts, validators, evals
db/init/          baseline SQL for a brand-new Postgres volume only
public/sw.js      app-shell service worker
```

Rule of thumb: anything that computes a number lives in `src/domain` and is
unit-tested without React, a database or a model.

## Data model

Definitions, executions and records are kept apart:

- **Program → Template** (undated, reusable) → **Session** (dated, with an
  explicit `status`: `active | completed | archived`; at most one active) →
  **Sets** (actual reps/weight/RPE, with targets snapshotted at start).
- **Exercises** and **devices** come from a shared library (served by
  `/api/library`, edited by admins) merged over the local seed.
- Per-user extras: profile and coaching profile, body log, PRs (re-derived),
  session feedback, recovery check-ins, plan-change audit trail, tombstones.

All of it lives in the client store. `src/lib/sync.ts` lists the keys that
are synced (`SYNC_KEYS`).

## Sync

```
device store ──snapshot()──► PUT /api/state {data, baseVersion}
                                  │ size cap 5 MB, validateSnapshot()
                                  │ compare-and-set on user_state.version
                     200 {version} ◄─┤
                     409 {data, version} ─► mergeSnapshots() ─► retry once
```

- **Pull** on open and on sign-in, then `mergeRemote`. Pushes are debounced
  after every store change.
- **Merge** (`src/domain/merge.ts`) unions records by id. For each id the
  newer `updatedAt` wins. Deletes travel as tombstones. PRs are recomputed,
  not merged.
- **Validation** (`src/domain/snapshotSchema.ts`) rejects bad shapes and
  implausible numbers. It returns a path for each issue, so a bad client
  can't poison the server copy.
- **Signed out:** the device is the only copy. Profile → Your data →
  Export saves a backup.

Server-side features never trust numbers sent by the client. The AI and
trainer routes read the synced document (`user_state.data`) and recompute
everything from it.

## Auth and access

- **Sign-in:** sign-up and login issue a `tv_session` HttpOnly cookie.
  - The JWT holds the user id and a token version.
  - Every request checks that version against `users.token_version`. Password
    reset and "sign out everywhere" bump it.
  - Cookie requests must be same-origin. A bearer header is still accepted
    from older clients during the transition.
- **Roles:** `user`, `trainer`, `admin`. Signing in with `ADMIN_EMAIL`
  grants admin.
- **Trainer access:** a trainer sees a client only after the client accepts
  the invitation (Profile → Coaches).
- **AI access:** needs AI data-sharing consent (`users.ai_consent_at`),
  checked on the server in `src/server/aiGuard.ts`.
- **Rate limits:** sign-in, reset and AI each have a limit, per email and per
  IP. Forwarded IPs are trusted only when `TRUST_PROXY=1`.
- **Content Security Policy:** `src/middleware.ts` sets a policy with a fresh
  nonce on every page. Next puts the nonce on its own scripts and the root
  layout puts it on the theme script, so no inline script runs without it.
  Because of this every page renders per request. API routes get a strict
  no-script policy from `next.config.mjs`.

## Database

The tables are created by `src/server/migrations/001_baseline.ts`:

- **Identity:** `users`, `password_reset_tokens`, `password_resets`.
- **User data:** `user_state`, the synced document, with a `version` used
  for compare-and-set.
- **Library:** `devices`, `device_images`, `exercises`.
- **Trainer:** `coach_clients`, `assignments`, `organizations`,
  `organization_members`.
- **Product:** `product_events`, `session_feedback`, `daily_checkins`
  (legacy, export only).
- **AI:** `ai_runs` (metadata only), `ai_proposals`.

Migrations run once per process at boot (`src/instrumentation.ts` →
`ensureMigrated`). See `docs/OPERATIONS.md`.

## Offline and PWA

- `public/sw.js` caches the app shell network-first, so the app still loads
  with no connection. Data is never cached there; it lives in the store.
- Bump `CACHE` in `sw.js` when the shell's routes change.
- With no account, or the server unreachable, every logging and progress
  feature still works. AI and trainer features need the server.

## Key invariants

1. One active session per user. Its lifecycle is `status`, never inferred
   from a missing field.
2. Template names carry no dates. Sets snapshot their targets, so editing a
   template never rewrites history.
3. Every displayed metric is computed deterministically in `src/domain`. AI
   only explains numbers it was given.
4. The server copy only changes through a validated compare-and-set write.
