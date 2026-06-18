-- Device photos, stored in Postgres so they're covered by the nightly backup
-- and need no writable file volume. Served via /api/device-image/[id].
create table if not exists device_images (
  device_id  text primary key references devices (id) on delete cascade,
  mime       text not null,
  bytes      bytea not null,
  updated_at timestamptz not null default now()
);
