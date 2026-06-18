-- Trainova schema (matches src/domain/types.ts and ARCHITECTURE.md).
-- Structured devices, undated templates with per-set targets, sessions with an
-- explicit status lifecycle. RLS scopes every user-owned row to its owner.

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
-- devices : structured equipment (shared library when owner is null)
-- ---------------------------------------------------------------------------
create table if not exists public.devices (
  id             uuid primary key default gen_random_uuid(),
  owner          uuid references auth.users (id) on delete cascade,
  name           text not null,
  machine_number text,
  category       text not null check (category in ('machine','free_weight','cable','bodyweight','cardio')),
  image_url      text,
  primary_muscle text,
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- exercises : movements linked to a default device
-- ---------------------------------------------------------------------------
create table if not exists public.exercises (
  id                uuid primary key default gen_random_uuid(),
  owner             uuid references auth.users (id) on delete cascade,
  name              text not null,
  default_device_id uuid references public.devices (id) on delete set null,
  is_compound       boolean not null default false,
  primary_muscle    text,
  created_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- templates : reusable, UNDATED definitions
-- ---------------------------------------------------------------------------
create table if not exists public.workout_templates (
  id         uuid primary key default gen_random_uuid(),
  owner      uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  notes      text,
  created_at timestamptz not null default now()
);

create table if not exists public.template_exercises (
  id           uuid primary key default gen_random_uuid(),
  template_id  uuid not null references public.workout_templates (id) on delete cascade,
  exercise_id  uuid not null references public.exercises (id) on delete restrict,
  device_id    uuid references public.devices (id) on delete set null,
  position     int not null default 0,
  rest_seconds int not null default 90
);

-- per-set targets → supports ramps (30x12, 35x12, 42.5x12)
create table if not exists public.template_sets (
  id                   uuid primary key default gen_random_uuid(),
  template_exercise_id uuid not null references public.template_exercises (id) on delete cascade,
  set_index            int not null default 0,
  target_reps          int not null default 10,
  target_weight        numeric
);

-- ---------------------------------------------------------------------------
-- programs : multi-day grouping of templates (e.g. a trainer's plan)
-- ---------------------------------------------------------------------------
create table if not exists public.programs (
  id         uuid primary key default gen_random_uuid(),
  owner      uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  source     text not null default 'self' check (source in ('trainer','self')),
  notes      text,
  created_at timestamptz not null default now()
);

create table if not exists public.program_days (
  id          uuid primary key default gen_random_uuid(),
  program_id  uuid not null references public.programs (id) on delete cascade,
  template_id uuid not null references public.workout_templates (id) on delete cascade,
  position    int not null default 0
);

-- ---------------------------------------------------------------------------
-- sessions : dated instances with an explicit status lifecycle
-- ---------------------------------------------------------------------------
create table if not exists public.workout_sessions (
  id           uuid primary key default gen_random_uuid(),
  owner        uuid not null references auth.users (id) on delete cascade,
  template_id  uuid references public.workout_templates (id) on delete set null,
  title        text not null,
  date         date not null default current_date,
  status       text not null default 'active' check (status in ('active','completed','archived')),
  started_at   timestamptz not null default now(),
  completed_at timestamptz,
  reopened_at  timestamptz,
  updated_at   timestamptz not null default now()
);

-- At most one active session per owner (the single-active invariant).
create unique index if not exists one_active_session_per_owner
  on public.workout_sessions (owner)
  where status = 'active';

create table if not exists public.workout_sets (
  id            uuid primary key default gen_random_uuid(),
  owner         uuid not null references auth.users (id) on delete cascade,
  session_id    uuid not null references public.workout_sessions (id) on delete cascade,
  exercise_id   uuid not null references public.exercises (id) on delete restrict,
  device_id     uuid references public.devices (id) on delete set null,
  set_index     int not null default 0,
  target_reps   int,
  target_weight numeric,
  actual_reps   int,
  actual_weight numeric,
  rpe           numeric,
  completed     boolean not null default false,
  completed_at  timestamptz,
  created_at    timestamptz not null default now()
);

create table if not exists public.personal_records (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null references auth.users (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  kind        text not null check (kind in ('e1rm','max_weight','max_reps')),
  value       numeric not null,
  achieved_at timestamptz not null default now(),
  unique (owner, exercise_id, kind)
);

create index if not exists idx_sets_session on public.workout_sets (session_id);
create index if not exists idx_sets_owner_exercise on public.workout_sets (owner, exercise_id);
create index if not exists idx_sessions_owner_status on public.workout_sessions (owner, status, started_at desc);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.profiles            enable row level security;
alter table public.devices             enable row level security;
alter table public.exercises           enable row level security;
alter table public.workout_templates   enable row level security;
alter table public.template_exercises  enable row level security;
alter table public.template_sets       enable row level security;
alter table public.programs            enable row level security;
alter table public.program_days        enable row level security;
alter table public.workout_sessions    enable row level security;
alter table public.workout_sets        enable row level security;
alter table public.personal_records    enable row level security;

create policy "profiles_self" on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

-- shared library (owner null) is readable; writes only to own rows
create policy "devices_read" on public.devices
  for select using (owner is null or owner = auth.uid());
create policy "devices_write" on public.devices
  for all using (owner = auth.uid()) with check (owner = auth.uid());
create policy "exercises_read" on public.exercises
  for select using (owner is null or owner = auth.uid());
create policy "exercises_write" on public.exercises
  for all using (owner = auth.uid()) with check (owner = auth.uid());

create policy "templates_owner" on public.workout_templates
  for all using (owner = auth.uid()) with check (owner = auth.uid());
create policy "programs_owner" on public.programs
  for all using (owner = auth.uid()) with check (owner = auth.uid());
create policy "sessions_owner" on public.workout_sessions
  for all using (owner = auth.uid()) with check (owner = auth.uid());
create policy "sets_owner" on public.workout_sets
  for all using (owner = auth.uid()) with check (owner = auth.uid());
create policy "prs_owner" on public.personal_records
  for all using (owner = auth.uid()) with check (owner = auth.uid());

-- child tables gate via their owning parent
create policy "template_exercises_owner" on public.template_exercises
  for all using (exists (select 1 from public.workout_templates t where t.id = template_id and t.owner = auth.uid()))
  with check (exists (select 1 from public.workout_templates t where t.id = template_id and t.owner = auth.uid()));
create policy "template_sets_owner" on public.template_sets
  for all using (exists (
    select 1 from public.template_exercises te
    join public.workout_templates t on t.id = te.template_id
    where te.id = template_exercise_id and t.owner = auth.uid()))
  with check (exists (
    select 1 from public.template_exercises te
    join public.workout_templates t on t.id = te.template_id
    where te.id = template_exercise_id and t.owner = auth.uid()));
create policy "program_days_owner" on public.program_days
  for all using (exists (select 1 from public.programs p where p.id = program_id and p.owner = auth.uid()))
  with check (exists (select 1 from public.programs p where p.id = program_id and p.owner = auth.uid()));

-- ---------------------------------------------------------------------------
-- Auto-create a profile row on signup
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
