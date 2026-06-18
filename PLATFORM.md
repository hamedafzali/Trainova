# Trainova — Platform Evolution (multi-user, trainer-driven, calendar-first)

From a local-only PWA to a synced, multi-role platform — **without losing the offline,
sub-second gym experience that is the product**. Guiding rule: the phone stays local-first;
the cloud is the system of record and the multi-user fabric.

> Today: Next.js PWA, `zustand` store persisted to `localStorage`, single implicit
> `local-user`. The Supabase schema in [0001_init.sql](supabase/migrations/0001_init.sql)
> already models devices/exercises/templates/sessions/sets/PRs with RLS — so the evolution
> is mostly **wiring auth + sync + roles**, not a rewrite.

---

## A. Architecture expansion (local-only → multi-user)

**Keep local-first as the interaction layer; add Supabase as the system of record.**

```
┌─ Phone (offline-first) ──────────────┐        ┌─ Supabase ───────────────┐
│  UI (Next.js PWA)                    │        │  Auth (email/OAuth, JWT) │
│  zustand store  ── optimistic write ─┼──push──►│  Postgres + RLS          │
│  + outbox (pending mutations)        │◄─pull──┤  Realtime (trainer view) │
│  + sync engine (watermark)           │        │  Storage (device images) │
└──────────────────────────────────────┘        └──────────────────────────┘
```

- **Writes**: applied to the local store immediately (the gym stays instant), appended to a
  local **outbox**; a sync engine flushes to Supabase when online.
- **Reads/pull**: incremental by `updated_at` watermark per table; Supabase **Realtime** only
  where live matters (trainer watching a client) — not for the lifter's own logging.
- **Conflict policy (MVP)**: records are single-owner and usually edited on one device at a
  time → **last-write-wins by `updated_at`** with an optimistic-concurrency `version` guard.
  No CRDTs early (overengineering); revisit only if true multi-device concurrent edits appear.
- **Data separation**: every row carries `owner`; **RLS** is the hard boundary (already in the
  schema). Global library rows use `owner = null`. Trainer↔client access via membership tables
  + RLS, never via app-layer checks alone.

**MVP vs scalable**
- *MVP*: Supabase Auth + cloud persistence of the existing schema + outbox sync + editable
  history. One realtime channel optional.
- *Scalable*: trainer monitoring (Realtime), analytics rollups, read replicas/caching, image
  CDN, background jobs.

---

## B. Data model (delta on the existing schema)

Existing tables stay. **Add** the multi-user/role/audit layer:

```sql
-- roles live on the profile (simple; avoid a full RBAC engine early)
alter table profiles add column role text not null default 'user'
  check (role in ('user','trainer','admin'));
alter table profiles add column experience text;     -- beginner|intermediate|advanced
alter table profiles add column goal text;            -- strength|hypertrophy|fat_loss|health
alter table profiles add column metrics jsonb;        -- {height,weight,...} optional
alter table profiles add column prefs jsonb default '{}'; -- units, ui settings

-- optimistic-concurrency + audit columns on mutable, synced tables
alter table workout_sessions add column version int not null default 1;
alter table workout_sets     add column version int not null default 1,
                             add column edited_at timestamptz;  -- "edited" badge

-- trainer ↔ client membership (consent-based)
create table coach_clients (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references auth.users on delete cascade,
  client_id  uuid not null references auth.users on delete cascade,
  status text not null default 'pending' check (status in ('pending','active','revoked')),
  created_at timestamptz default now(),
  unique (trainer_id, client_id)
);

-- assigning a program/template to a client (optionally scheduled to a date)
create table assignments (
  id uuid primary key default gen_random_uuid(),
  assigned_by uuid not null references auth.users,   -- trainer
  assigned_to uuid not null references auth.users,   -- client
  program_id  uuid references programs on delete cascade,
  template_id uuid references workout_templates on delete cascade,
  scheduled_date date,                               -- powers calendar
  created_at timestamptz default now()
);

-- template provenance (trainer vs self) + copy-on-write lineage
alter table workout_templates add column origin text not null default 'self'
  check (origin in ('self','trainer'));
alter table workout_templates add column cloned_from uuid references workout_templates;

-- append-only audit trail (the correction history; one row per change)
create table audit_events (
  id uuid primary key default gen_random_uuid(),
  actor uuid not null references auth.users,
  entity text not null,           -- 'workout_set' | 'workout_session' | ...
  entity_id uuid not null,
  action text not null,           -- 'edit' | 'reopen' | 'delete'
  before jsonb,
  after  jsonb,
  reason text,
  at timestamptz not null default now()
);
```

**Versioning model for history** — *editable current row + append-only audit log* (not full
event sourcing). The live `workout_sets` row is the truth; every change appends an
`audit_events` row capturing `before/after`. This gives a correction trail and an "edited"
badge while keeping reads a single fast lookup. (See §F.)

---

## D. Roles & permissions (RBAC via RLS)

Three roles: **user**, **trainer**, **admin**. Enforced in Postgres, not the client.

| Capability | User | Trainer | Admin |
|---|---|---|---|
| Log/edit **own** sessions & sets | ✅ | ✅ (own) | ✅ |
| Edit **a client's logged performance** | — | ❌ (integrity) | ❌ |
| Read **assigned** programs/templates | ✅ read-only | ✅ own | ✅ |
| Create/edit **own** templates/programs | ✅ | ✅ | ✅ |
| **Assign** programs to clients | — | ✅ (linked clients) | ✅ |
| **View client progress** (sessions) | — | ✅ read-only, if linked+active | ✅ |
| Manage **global** device/exercise library | — | — | ✅ |
| Use global library | ✅ | ✅ | ✅ |

Key rules:
- **Trainers shape plans, not logs.** A trainer can never silently change what a client lifted
  — that protects data integrity and trust. Corrections are the athlete's.
- **Copy-on-write**: a client editing a trainer's assigned template **clones** it into a
  user-owned copy (`cloned_from`), leaving the trainer's original intact.
- **Consent-based visibility**: a trainer sees a client's sessions only while
  `coach_clients.status = 'active'`.

RLS sketch (client-session read for a linked trainer):
```sql
create policy trainer_reads_client_sessions on workout_sessions for select using (
  owner = auth.uid()  -- own
  or exists (select 1 from coach_clients c
             where c.client_id = workout_sessions.owner
               and c.trainer_id = auth.uid()
               and c.status = 'active')
);
```

---

## C. UX flows (textual)

**First run / auth**
```
Splash → [Continue as guest]  or  [Sign in / Sign up]
  guest  → local-only mode (current behavior), with a persistent "Save your data" nudge
  signup → onboarding: role? (user/trainer) → goal, experience, units → Calendar home
```
Guest mode stays (zero-friction trial); on sign-up the local data **migrates** to the cloud
account (outbox replay).

**User daily flow (calendar-first)**
```
Calendar (home) → tap TODAY
  ├─ has assigned plan  → "Start <plan>"  → focus-mode logging → Finish
  ├─ no plan            → pick template / empty → log → Finish
  └─ tap a PAST day     → view session → (optional) Edit a set safely (§F)
Active session always surfaces as a sticky "Continue" banner on the calendar.
```

**Trainer flow**
```
Clients list → client → [Assign program] (pick + optional schedule dates)
                      → [View progress] (read-only sessions, later: charts)
Templates → build program (days) → assign to one/many clients
```

**Device selection** (already shipped as a swipe carousel): search → muscle filter → swipe
cards (real image + name + No.) → pick. Beginner mode shows the usage image + short guidance.

---

## E. Calendar-first home (core UX change)

**Why calendar is primary:** training is a *scheduled habit*. Trainers assign by date,
consistency is the headline metric, and "what am I doing today?" is the first question every
session — answering it on the landing screen removes the biggest start-friction.

**It replaces the current template-first home.** New landing = month/week calendar:
- each day cell shows: **completed ring** (trained), a **plan dot/label** (assigned or done),
  optional **intensity shade** (by volume).
- **Today** is emphasized with a one-tap **Start** for its assigned plan (or a picker if none).
- Tapping a **past** day opens that session (view/edit); a **future** day with an assignment
  shows the upcoming plan.
- A sticky **Continue** banner appears above the calendar whenever a session is active (the
  single-active rule still holds).

Session creation flows *from the calendar*: choosing a day is choosing the date of the session
(today by default), so dates are never ambiguous and assigned plans light up on their day.

---

## F. History editing (critical)

**Decision: editable current rows + append-only audit log** (not immutable event sourcing —
that's overkill for set corrections; not silent in-place edits — that loses trust).

- **Edit path (safe):** open a completed session → tap a set → **Edit** → change weight/reps →
  confirm. The row updates; an `audit_events` row records `before/after`, actor, time, optional
  reason; the set gets `edited_at` → shows a subtle **"edited"** badge.
- **Immutability where it matters:** the *audit log* is append-only and never edited, so the
  original value is always recoverable. The set row stays editable for fast reads.
- **Conflict prevention:** optimistic concurrency via `version` — an edit carries the version
  it read; the server rejects if the row changed underneath (stale write) and the client
  re-pulls. Prevents two-device corruption.
- **Authorization:** only the **owner** edits their logged performance (trainers can't). PR
  tables recompute from the corrected value on save.
- **Reversibility:** "Revert to original" reads the first `audit_events.before`.

This satisfies your "12 vs 10 reps" case: correct it inline, the change is logged, the badge
shows it was edited, and the original is preserved for honesty.

---

## Device system (central library + real images)

- **Ownership:** global library (`owner = null`, **admin-managed**) + per-user custom devices.
  Reusable across all templates; consistent everywhere via `device_id` (already the model).
- **Metadata** (extend `devices`): `name`, `category` (machine/free_weight/cable/bodyweight/
  cardio), `primary_muscle` (+ optional secondary), `machine_number` (gym-specific),
  `difficulty` (beginner/…), `guidance` (short how-to), `image_url`, `usage_image_url`.
- **Real images (beginner recognition):** store curated **photos in Supabase Storage**, served
  via CDN. **Consistency rules:** 1:1 crop, front-on neutral background, even lighting, same
  framing/scale, device centered; a second **usage view** (person mid-rep) where available.
  Current schematic SVGs remain the **fallback** when no photo exists.
- **Sourcing strategy:** start with a curated licensed/own-photographed set for the ~30 most
  common machines; let gyms/admins upload their own (per-gym libraries) later; community
  submissions with admin review at scale.
- **Beginner-friendly:** searchable, muscle-filtered, image-led swipe carousel (shipped),
  optional guidance text/clip in a detail sheet.

---

## G. Phased roadmap (priority · dependencies · impact)

| Phase | Scope | Priority | Depends on | Why / impact |
|---|---|---|---|---|
| **1 — Backend + Auth** | Supabase Auth (email; OAuth later), wire existing schema, **outbox sync engine**, guest→account migration, `version` concurrency | 🔴 P0 | — | Unlocks **multi-device** + cloud backup — the #1 user value; everything else depends on identity |
| **1.5 — Editable history** | inline set edit + `audit_events` + "edited" badge | 🔴 P0 | P1 (audit table) | Small, high-trust win; directly answers the 10→12 reps ask |
| **2 — Roles + Trainer** | `profiles.role`, `coach_clients`, `assignments`, RLS, trainer UI (clients, assign) | 🟠 P1 | P1 | Opens the trainer-driven market; the platform differentiator |
| **3 — Device images** | photos in Storage, metadata (difficulty/guidance), admin tooling | 🟡 P2 | P1 | Beginner usability; independent, can parallel P2 |
| **4 — Calendar-first UX** | calendar as home, day→start, assigned-plan dots | 🟠 P1 | client-only (P2 for assignments) | High UX/retention impact; **mostly client-side — can be pulled forward** |
| **5 — Analytics + scaling** | progress charts, trainer monitoring (Realtime), rollups, indexes/CDN | 🟡 P2 | P1–P2 | Depth & performance once there's data |
| **6 — Polish** | motion, personalization, AI suggestions | 🟢 P3 | P5 data | Delight; needs real usage data to be credible |

**Build first for maximum impact:** **Phase 1 (Auth + sync)** — it's the keystone (multi-device
backup is the loudest user need and the prerequisite for roles, assignments, and trainer views).
**Phase 1.5 (editable history)** ships alongside it cheaply. **Calendar-first (Phase 4)** is the
highest *UX* lever and is almost entirely client-side, so it can be pulled forward and shipped in
parallel with backend work for a quick, visible win.

**Avoid overengineering early:** Supabase Auth (not custom JWT), `profiles.role` (not a policy
engine), last-write-wins + `version` (not CRDTs), editable rows + audit log (not event sourcing),
curated photos for the top ~30 devices (not a crowdsourced pipeline). Layer complexity only when
real usage demands it.
