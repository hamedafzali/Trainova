-- Password reset tokens (short-lived, single-use).
create table if not exists password_resets (
  token      text primary key,
  user_id    uuid not null references users (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_password_resets_user on password_resets (user_id);
