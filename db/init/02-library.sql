-- Central equipment/exercise library (admin-editable, shared by all users).
-- Rows are seeded lazily from the app's seed data on first read.

create table if not exists devices (
  id             text primary key,
  owner          uuid references users (id) on delete cascade, -- null = global
  name           text not null,
  machine_number text,
  category       text not null,
  image_url      text,
  primary_muscle text,
  difficulty     text,
  guidance       text
);

create table if not exists exercises (
  id                text primary key,
  owner             uuid references users (id) on delete cascade,
  name              text not null,
  default_device_id text references devices (id) on delete set null,
  is_compound       boolean not null default false,
  primary_muscle    text
);
