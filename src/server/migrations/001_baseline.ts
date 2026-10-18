// Baseline: the schema that db/init used to create on a fresh volume. Every
// statement is idempotent, so it is safe on databases created by older
// releases (which may be missing later init files, e.g. 07-product-data).
export const sql = `
-- from db/init/01-schema.sql
-- Trainova self-hosted backend (auth + per-user state).
-- Runs once on first Postgres init. Minimal by design: accounts + a synced
-- per-user state blob. Normalised tables (for trainer queries) come later.

create extension if not exists "pgcrypto";

create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  email         text unique not null,
  password_hash text not null,
  role          text not null default 'user' check (role in ('user','trainer','admin')),
  created_at    timestamptz not null default now()
);

-- Idempotent for databases created before the role column existed.
alter table users add column if not exists role text not null default 'user';

create table if not exists user_state (
  user_id    uuid primary key references users (id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- from db/init/02-library.sql
-- Central equipment/exercise library (admin-editable, shared by all users).
-- Rows are seeded lazily from src/data on first read and topped up with new
-- library items on every server start (see src/server/library.ts).

create table if not exists devices (
  id             text primary key,
  owner          uuid references users (id) on delete cascade, -- null = global
  name           text not null,
  machine_number text,
  category       text not null,
  image_url      text,
  primary_muscle text,
  difficulty     text,
  guidance       text,
  loading        text -- 'stack' | 'plates'
);

create table if not exists exercises (
  id                text primary key,
  owner             uuid references users (id) on delete cascade,
  name              text not null,
  default_device_id text references devices (id) on delete set null,
  is_compound       boolean not null default false,
  primary_muscle    text,
  meta              jsonb -- type, equipment, secondaryMuscles, level, instructions
);

-- from db/init/03-images.sql
-- Device photos, stored in Postgres so they're covered by the nightly backup
-- and need no writable file volume. Served via /api/device-image/[id].
create table if not exists device_images (
  device_id  text primary key references devices (id) on delete cascade,
  mime       text not null,
  bytes      bytea not null,
  updated_at timestamptz not null default now()
);

-- from db/init/05-trainer.sql
-- Trainer ↔ client links and program assignments.
create table if not exists coach_clients (
  id         uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references users (id) on delete cascade,
  client_id  uuid not null references users (id) on delete cascade,
  status     text not null default 'active' check (status in ('active', 'revoked')),
  created_at timestamptz not null default now(),
  unique (trainer_id, client_id)
);

create table if not exists assignments (
  id         uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references users (id) on delete cascade,
  client_id  uuid not null references users (id) on delete cascade,
  name       text not null,
  payload    jsonb not null,           -- snapshot of the plan to import
  imported   boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_assignments_client on assignments (client_id, imported);
create index if not exists idx_coach_clients_trainer on coach_clients (trainer_id);

-- from db/init/06-resets.sql
-- Password reset tokens (short-lived, single-use).
create table if not exists password_resets (
  token      text primary key,
  user_id    uuid not null references users (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_password_resets_user on password_resets (user_id);

-- from db/init/07-product-data.sql
-- Product-data foundation for the gradual move away from user_state JSON blobs.
-- Existing installs should apply this file with the deployment migration process;
-- fresh Docker databases run it automatically through docker-entrypoint-initdb.d.

create table if not exists daily_checkins (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users (id) on delete cascade,
  date        date not null default current_date,
  sleep       smallint not null check (sleep between 1 and 5),
  stress      smallint not null check (stress between 1 and 5),
  soreness    smallint not null check (soreness between 1 and 5),
  note        text,
  created_at  timestamptz not null default now(),
  unique (user_id, date)
);

create table if not exists product_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references users (id) on delete set null,
  event_name  text not null,
  properties  jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create table if not exists session_feedback (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references users (id) on delete cascade,
  session_id           text not null,
  difficulty           text not null check (difficulty in ('easy','right','hard')),
  energy               smallint not null check (energy between 1 and 5),
  confidence           smallint not null check (confidence between 1 and 5),
  pain                 text,
  completed_in_minutes integer,
  created_at           timestamptz not null default now(),
  unique (user_id, session_id)
);

create table if not exists ai_runs (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references users (id) on delete set null,
  capability     text not null,
  outcome        text not null check (outcome in ('success','rejected','failed','rate_limited')),
  model          text,
  latency_ms     integer,
  input_version  text,
  created_at     timestamptz not null default now()
);

create table if not exists ai_proposals (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users (id) on delete cascade,
  capability   text not null,
  proposal     jsonb not null,
  status       text not null default 'proposed'
               check (status in ('proposed','accepted','rejected','expired')),
  created_at   timestamptz not null default now(),
  decided_at   timestamptz
);

create table if not exists organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);

create table if not exists organization_members (
  organization_id uuid not null references organizations (id) on delete cascade,
  user_id         uuid not null references users (id) on delete cascade,
  role            text not null check (role in ('owner','manager','coach','member')),
  created_at      timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create index if not exists idx_checkins_user_date on daily_checkins (user_id, date desc);
create index if not exists idx_events_name_time on product_events (event_name, occurred_at desc);
create index if not exists idx_events_user_time on product_events (user_id, occurred_at desc);
create index if not exists idx_ai_runs_user_time on ai_runs (user_id, created_at desc);
create index if not exists idx_session_feedback_user_time on session_feedback (user_id, created_at desc);
`;
