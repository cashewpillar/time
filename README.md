# Workspace Timer

Small Vite + React timer app with local persistence and optional Supabase sync.

## App setup

Install dependencies and start the app:

```bash
npm install
npm run dev
```

Build for production:

```bash
npm run build
```

## Supabase setup

1. Create a Supabase project.
2. Run the SQL in [`supabase/schema.sql`](/Users/halloween/Dev/apps/time/supabase/schema.sql) in the Supabase SQL editor.
3. Copy [`.env.example`](/Users/halloween/Dev/apps/time/.env.example) to `.env.local`.
4. Fill in `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_ALLOWED_EMAIL`.
5. Enable Supabase Auth for email/password sign-in.
6. In Supabase Auth, create that exact email address as the only allowed user and set its password.
7. Restart `npm run dev`.

If you intentionally want to wipe and rebuild the sync tables during development, use [`supabase/reset.sql`](/Users/halloween/Dev/apps/time/supabase/reset.sql) instead. It is destructive.

If those env vars are missing, the app stays on local-only persistence.

## Persistence

Projects, workspaces, outcomes, session history, and timer progress are always saved in browser `localStorage` on the current device.

When Supabase is configured and you sign in, the app syncs the normalized state model to:
- `app_preferences`
- `workspaces`
- `projects`
- `outcomes`
- `bursts`

The current sync model is user-scoped with Supabase Auth and RLS.
The app also enforces a single allowed email address from `VITE_ALLOWED_EMAIL`.

## CSV import

If you have a denormalized CSV like [`import.csv`](/Users/halloween/Dev/apps/time/import.csv), you can normalize it into the app's sync model with:

```bash
npm run import:normalize
```

That writes [`normalized-state.json`](/Users/halloween/Dev/apps/time/tmp/import/normalized-state.json) under `tmp/import/`.

If you also pass a Supabase auth user id, it generates SQL ready for the tables in [`supabase/schema.sql`](/Users/halloween/Dev/apps/time/supabase/schema.sql):

```bash
node scripts/normalize-import.mjs import.csv --user-id YOUR_AUTH_USER_ID
```

The importer applies these normalization rules:
- `Workspace` -> `workspaces`
- `Project` -> `projects` within each workspace
- `Entry` -> deduplicated `outcomes` per workspace/project/title
- Each CSV row -> one historical `burst`
- `AI workflow` -> `agent_eligible`
- `Task type` -> `type`
- `Notes` -> `notes`
- `Minutes`/`Hours`/`Days` -> `duration_seconds`
- `Start datetime` -> `logged_at`
