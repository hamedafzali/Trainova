-- Trainova initial schema
-- Run with the Supabase CLI (`supabase db push`) or paste into the SQL editor.
-- Every user-owned table is protected by row-level security so a client using the
-- anon key can only ever see its own rows.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles : 1:1 with auth.users
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  units        text not null default 'kg' check (units in ('kg', 'lb')),
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- exercises : shared catalog (owner null) + user custom exercises
-- ---------------------------------------------------------------------------
create table if not exists public.exercises (
  id             uuid primary key default gen_random_uuid(),
  owner          uuid references auth.users (id) on delete cascade,
  name           text not null,
  primary_muscle text,
  equipment      text,
  is_compound    boolean not null default false,
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- workout_templates : the plan
-- ---------------------------------------------------------------------------
create table if not exists public.workout_templates (
  id         uuid primary key default gen_random_uuid(),
  owner      uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  notes      text,
  created_at timestamptz not null default now()
);

create table if not exists public.template_exercises (
  id            uuid primary key default gen_random_uuid(),
  template_id   uuid not null references public.workout_templates (id) on delete cascade,
  exercise_id   uuid not null references public.exercises (id) on delete restrict,
  position      int not null default 0,
  target_sets   int not null default 3,
  target_reps   int not null default 8,
  target_weight numeric,
  rest_seconds  int not null default 120
);

-- ---------------------------------------------------------------------------
-- workout_sessions : an instance of training
-- ---------------------------------------------------------------------------
create table if not exists public.workout_sessions (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null references auth.users (id) on delete cascade,
  template_id uuid references public.workout_templates (id) on delete set null,
  name        text,
  started_at  timestamptz not null default now(),
  ended_at    timestamptz
);

-- ---------------------------------------------------------------------------
-- workout_sets : a single logged set (planned vs actual)
-- ---------------------------------------------------------------------------
create table if not exists public.workout_sets (
  id            uuid primary key default gen_random_uuid(),
  owner         uuid not null references auth.users (id) on delete cascade,
  session_id    uuid not null references public.workout_sessions (id) on delete cascade,
  exercise_id   uuid not null references public.exercises (id) on delete restrict,
  set_index     int not null default 0,
  planned_reps  int,
  planned_weight numeric,
  actual_reps   int,
  actual_weight numeric,
  rpe           numeric,
  completed     boolean not null default false,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- personal_records : best lifts per exercise (retention hook)
-- ---------------------------------------------------------------------------
create table if not exists public.personal_records (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null references auth.users (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  kind        text not null check (kind in ('e1rm', 'max_weight', 'max_reps')),
  value       numeric not null,
  achieved_at timestamptz not null default now(),
  unique (owner, exercise_id, kind)
);

create index if not exists idx_sets_session on public.workout_sets (session_id);
create index if not exists idx_sets_owner_exercise on public.workout_sets (owner, exercise_id);
create index if not exists idx_sessions_owner on public.workout_sessions (owner, started_at desc);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.profiles            enable row level security;
alter table public.exercises           enable row level security;
alter table public.workout_templates   enable row level security;
alter table public.template_exercises  enable row level security;
alter table public.workout_sessions    enable row level security;
alter table public.workout_sets        enable row level security;
alter table public.personal_records    enable row level security;

-- profiles: a user manages only its own row
create policy "profiles_self" on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

-- exercises: read shared (owner is null) or own; write only own
create policy "exercises_read" on public.exercises
  for select using (owner is null or owner = auth.uid());
create policy "exercises_write" on public.exercises
  for all using (owner = auth.uid()) with check (owner = auth.uid());

-- owner-scoped tables: identical "owner = auth.uid()" rule
create policy "templates_owner" on public.workout_templates
  for all using (owner = auth.uid()) with check (owner = auth.uid());

-- template_exercises has no owner column; gate via the parent template
create policy "template_exercises_owner" on public.template_exercises
  for all using (
    exists (
      select 1 from public.workout_templates t
      where t.id = template_id and t.owner = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.workout_templates t
      where t.id = template_id and t.owner = auth.uid()
    )
  );

create policy "sessions_owner" on public.workout_sessions
  for all using (owner = auth.uid()) with check (owner = auth.uid());
create policy "sets_owner" on public.workout_sets
  for all using (owner = auth.uid()) with check (owner = auth.uid());
create policy "prs_owner" on public.personal_records
  for all using (owner = auth.uid()) with check (owner = auth.uid());

-- ---------------------------------------------------------------------------
-- Auto-create a profile row when a new auth user signs up
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
