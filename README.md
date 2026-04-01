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
4. Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
5. Restart `npm run dev`.

If those env vars are missing, the app stays on local-only persistence.

## Persistence

Projects, workspaces, outcomes, session history, and timer progress are always saved in browser `localStorage` on the current device.

When Supabase is configured, the app also syncs the normalized state model to:
- `app_instances`
- `app_preferences`
- `workspaces`
- `projects`
- `outcomes`
- `bursts`

The current sync model assumes a single local app instance per browser and does not include auth yet. Tighten security before using it beyond local/dev setups.
