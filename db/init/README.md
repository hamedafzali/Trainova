Schema is managed by the app's migration runner (`src/server/migrations.ts`),
which runs at server start and records applied migrations in
`schema_migrations`. The `.sql` files here are kept only so a brand-new
Postgres volume is created with the baseline schema before the app's first
boot; they are identical to migration `001_baseline` and must not be edited.
New schema changes go in `src/server/migrations/` as a new numbered file.
