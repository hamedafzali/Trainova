-- Trainova self-hosted backend (auth + per-user state).
-- Runs once on first Postgres init. Minimal by design: accounts + a synced
-- per-user state blob. Normalised tables (for trainer queries) come later.

create extension if not exists "pgcrypto";

create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  email         text unique not null,
  password_hash text not null,
  created_at    timestamptz not null default now()
);

create table if not exists user_state (
  user_id    uuid primary key references users (id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
