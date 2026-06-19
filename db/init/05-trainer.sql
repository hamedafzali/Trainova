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
