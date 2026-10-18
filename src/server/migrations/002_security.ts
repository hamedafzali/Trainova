// Session revocation, hashed reset tokens, consent-based trainer links, AI
// data-sharing consent, analytics opt-out and richer (content-free) AI run logs.
export const sql = `
alter table users add column if not exists token_version integer not null default 0;
alter table users add column if not exists ai_consent_at timestamptz;
alter table users add column if not exists ai_consent_version text;
alter table users add column if not exists analytics_opt_out boolean not null default false;

-- Reset tokens are stored as SHA-256 hashes; the plaintext only ever lives in
-- the email link. Old plaintext rows expire within an hour anyway.
create table if not exists password_reset_tokens (
  token_hash text primary key,
  user_id    uuid not null references users (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_reset_tokens_user on password_reset_tokens (user_id);
drop table if exists password_resets;

-- Trainer links need the client's explicit acceptance. Links created before
-- this migration were never consented to, so they go back to 'pending'.
alter table coach_clients drop constraint if exists coach_clients_status_check;
update coach_clients set status = 'pending' where status = 'active';
alter table coach_clients alter column status set default 'pending';
alter table coach_clients add constraint coach_clients_status_check
  check (status in ('pending', 'active', 'declined', 'revoked'));
alter table coach_clients add column if not exists responded_at timestamptz;
create index if not exists idx_coach_clients_client on coach_clients (client_id, status);

alter table ai_runs add column if not exists task text;
alter table ai_runs add column if not exists prompt_version text;
alter table ai_runs add column if not exists input_tokens integer;
alter table ai_runs add column if not exists output_tokens integer;
alter table ai_runs add column if not exists validation_issues integer not null default 0;
alter table ai_runs add column if not exists error_code text;
alter table ai_runs add column if not exists fallback boolean not null default false;
create index if not exists idx_ai_runs_time on ai_runs (created_at desc);

-- Analytics is content-free and bounded: keep 180 days.
create index if not exists idx_events_time on product_events (occurred_at);
`;
