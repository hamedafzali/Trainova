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
