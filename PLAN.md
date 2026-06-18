# Trainova — Plan

A gym & strength-training companion. North star: **reduce friction**. Open → start →
log a set in minimal taps → get an adaptive suggestion. Everything else is secondary.

## Guiding decisions

- **Lean MVP stack.** Next.js (App Router, TS) + Supabase. No separate NestJS/FastAPI
  service, no BFF abstraction layer, no Redis yet. Route handlers / server code *are*
  the BFF. Add heavier infra only when a real scale problem appears.
- **Offline-first.** People train where there's no signal. Set logging writes to a local
  store first (optimistic), then syncs to Supabase. This shapes the data layer more than
  anything else.
- **Deterministic "AI" first.** Progression suggestions come from explicit progressive-
  overload rules driven by the last session — no LLM, no hallucinations, instant. A real
  LLM coach can layer on top later once there's usage data.
- **Stable API surface.** Data access goes through a typed repository layer so a future
  Expo native app reuses the same contracts.

## Data model

- `profiles` — 1:1 with auth user (display name, units kg/lb, settings).
- `exercises` — catalog (name, primary muscle, equipment, is_custom, owner).
- `workout_templates` + `template_exercises` — the *plan* (ordered exercises, target
  sets/reps/weight, rest).
- `workout_sessions` — an *instance* of training (started/ended, optional template ref).
- `workout_sets` — one logged set: planned vs actual reps/weight, RPE/RIR, completed flag.
- `personal_records` — best e1RM / max weight / max reps per exercise (retention hook).
- `progress_metrics` — bodyweight / measurements over time (later).

Separation of **template (plan)** vs **session (instance)** vs **set (planned + actual)**
is deliberate and central.

## Progression logic (deterministic)

Given the last completed session for an exercise:
- If all target reps hit at target RPE → suggest small load increase (compound vs isolation
  step sizes, rounded to plate increments per unit).
- If reps missed → hold load, or deload after repeated misses.
- Surface estimated 1RM (Epley) and flag new PRs.

See `src/domain/progression.ts`.

## Phases

| Phase | Scope |
|---|---|
| **MVP (this build)** | PWA shell, auth-ready data layer, templates, active-session logging with offline queue, PR tracking, deterministic suggestions, basic progress view. |
| **v1** | Stripe subscriptions, PostHog analytics, reminders/notifications, charts. |
| **v2** | Expo native app on the same repositories; LLM coach on real session data. |
| **Later** | Trainer dashboards, wearables, nutrition, social — gated on demand signals. |

## Wedge

Be the **fastest, most reliable logger** first. Win on friction + offline reliability
before competing on AI or breadth. Don't build the 5-year feature list up front.

## Repo layout

```
src/
  app/            App Router pages (home, templates, session, progress)
  components/     UI building blocks
  domain/         Pure logic: types, progression, e1RM — no I/O, unit-testable
  lib/            Supabase client, local-first store, sync queue, repositories
supabase/
  migrations/     SQL schema + RLS
```

## Docker

Containerised following the conventions of the other repos (see `../hamed`): multi-stage
Alpine build, non-root user, in-image `HEALTHCHECK`, named container, bridge network, and a
`docker-compose.dev.yml` overlay with profiles + file-watch polling.

- `Dockerfile` — 3 stages (deps → builder → runner) using Next.js `output: "standalone"`
  for a ~220 MB runtime image. pnpm is pinned via `packageManager` so corepack installs the
  exact version that produced the lockfile.
- `docker compose up -d --build` → app on http://localhost:5008 (host) → 3000 (container).
- `docker compose -f docker-compose.yml -f docker-compose.dev.yml up web-dev` → hot-reload
  dev server on :3000 with the source bind-mounted.
- Supabase keys are optional `--build-arg`s; unset → local-only mode.

Healthcheck uses `127.0.0.1` (not `localhost`) so BusyBox wget hits the IPv4 bind.

## Status
Living document — update as phases land.
