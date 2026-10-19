# Operations

How to run, configure, deploy, back up and roll back Trainova.

## Local development

```bash
pnpm install
pnpm dev          # http://localhost:3000, guest mode works with no env at all
pnpm typecheck && pnpm lint && pnpm eval && pnpm test && pnpm build
```

Use Node 22 or newer. The test tooling (jsdom 30) doesn't run on Node 20.
`docker-compose.dev.yml` is an overlay that runs the hot-reloading dev server
next to the production services:
`docker compose -f docker-compose.yml -f docker-compose.dev.yml up web-dev`.

CI (`.github/workflows/ci.yml`) runs the same five checks on every push to
`main` and `transformation`, and on every pull request. A second job builds
the production Docker image and checks that it boots and serves `/`.

## Environment

Set these in the deploy tool's project variables, never in the repo. Only the
first two are required to run with accounts.

| Variable | Required | Purpose |
|---|---|---|
| `POSTGRES_PASSWORD` | yes | Database password. Compose builds `DATABASE_URL` from it. |
| `JWT_SECRET` | yes | Session signing key, at least 32 characters. A weak one disables accounts (sign-in returns 503); the app still runs. |
| `NEXT_PUBLIC_AUTH_ENABLED` | build arg | `1` shows the login UI. Baked in at build time. Default `1`. |
| `ADMIN_EMAIL` | no | This account becomes admin on sign-in. |
| `APP_URL` | no | Public URL used in password-reset links. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | no | Password-reset email. Without SMTP, admins reset passwords from the admin page. |
| `REDIS_URL` | no | Cache and shared rate limits. Default `redis://redis:6379`. Falls back to in-process if Redis is unreachable. |
| `TRUST_PROXY` | no | `1` only behind a reverse proxy that overwrites `X-Forwarded-For`. |
| `MISTRAL_API_KEY` | no | Turns the AI features on. Without it, AI routes answer "disabled" and the rule-based views show. |
| `MISTRAL_MODEL`, `MISTRAL_MODEL_DEEP`, `MISTRAL_MODEL_FAST` | no | Pin a model for every tier, or per tier. Empty means automatic (see `docs/AI.md`). |
| `AI_DAILY_LIMIT` | no | AI requests per user per day. Default 200. |
| `MISTRAL_MIN_INTERVAL_MS`, `MISTRAL_RETRY_BASE_MS` | no | Model-call spacing and retry backoff. Defaults 1100 / 1500. |
| `NEXT_PUBLIC_SENTRY_DSN` | no | Passed through by compose. Nothing reads it yet. |

## Deploy

Production is one compose project (`docker-compose.yml`):

- **`trainova`:** the web container (`trainova-web`), host port 5008 → 3000.
- **`trainova-db`:** Postgres 16. Internal only, never published.
- **`redis`.**
- **`trainova-backup`:** nightly `pg_dump`.

Deploys go through **ACM (Advanced Container Manager)** only:

1. Merge into `main` once CI is green.
2. In ACM, redeploy the Trainova project. ACM pulls `main`, builds the image
   and injects the project variables.
3. On boot the app applies any pending migrations before serving. The log
   shows `[db] applied migrations: …`.
4. Check health: the container healthcheck fetches `/`. Then sign in and
   open Progress and AI Coach.

Don't run `docker compose` by hand in a separate checkout of this repo on the
server. It uses the same project name, takes over ACM's containers, and drops
the variables ACM injects, such as `MISTRAL_API_KEY`.

## Migrations

- **Location:** `src/server/migrations/NNN_name.ts`, each exporting
  `sql`, registered in order in `src/server/migrations.ts`.
- **Applying:** at server start, under a Postgres advisory lock, each in its
  own transaction, recorded in `schema_migrations`. A failed migration rolls
  back, is logged, and is retried on the next request. The local-first app
  keeps working meanwhile.
- **Rules:** only append, and never edit a migration that has shipped. Write
  them additively (`add column if not exists`, new tables), so the previous
  release still runs on the new schema. That additive rule is what makes a
  rollback safe.
- **Baseline:** `db/init/*.sql` only runs when Postgres creates an empty
  volume. It must stay identical to `001_baseline`.

To see what has been applied:

```sql
select id, applied_at from schema_migrations order by id;
```

## Backup

The `trainova-backup` container dumps the database every 24 hours:

- **Where:** `pg_dump | gzip` into the `trainova-backups` volume, as
  `trainova-YYYYMMDD-HHMMSS.sql.gz`.
- **Retention:** the 7 most recent dumps.
- **Failures:** an empty dump is discarded and logged as `backup FAILED`.

Check it from time to time:

```bash
docker logs --tail 20 trainova-backup          # expect "backup ok: …" daily
docker exec trainova-backup ls -lh /backups
```

The volume lives on the same host as the database. Copy dumps off the box
(another machine or cloud storage) on a schedule; a dead disk otherwise
takes both.

Users who aren't signed in have only the copy on their device. The app offers
a JSON backup under Profile → Your data → Export.

## Restore

Practise this on a scratch database before you need it.

1. Stop the web container in ACM, so nothing writes during the restore.
2. Copy the chosen dump into the db container and restore it into a fresh
   database:

   ```bash
   docker cp trainova-YYYYMMDD-HHMMSS.sql.gz trainova-db:/tmp/r.sql.gz
   docker exec trainova-db sh -c 'dropdb -U trainova --if-exists trainova_restore && createdb -U trainova trainova_restore && gunzip -c /tmp/r.sql.gz | psql -q -U trainova -d trainova_restore'
   ```

3. Spot-check the restored copy: count users and the newest
   `user_state.updated_at`.
4. Swap databases while the app is stopped:

   ```sql
   alter database trainova rename to trainova_old;
   alter database trainova_restore rename to trainova;
   ```

5. Start the web container. Migrations newer than the dump apply on boot.
6. Keep `trainova_old` until you're sure, then drop it.

Devices merge their local data on the next sync, so workouts logged since the
dump come back from the phones that logged them.

## Rollback

1. In ACM, redeploy the previous `main` commit (or revert the merge on
   `main` and redeploy).
2. Leave the database alone. Migrations are additive, so the old release
   ignores new columns and tables.
3. Roll back the data only if a release corrupted it: restore the last good
   dump as above.
4. If the PWA shell looks stale after a rollback, bump `CACHE` in
   `public/sw.js`.

## Monitoring

- **Errors:** container logs. `[config]` and `[db]` lines at boot report a
  bad secret or a failed migration.
- **AI:** the `/admin/ai` page (admins) shows runs, success, fallbacks,
  latency and tokens per task, model and prompt version. Rows hold no user
  content.
- **Product:** the admin stats page shows user, trainer and workout counts.
  Usage events go to `product_events`; users can opt out in Profile →
  Privacy.
