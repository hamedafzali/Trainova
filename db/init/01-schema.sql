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
