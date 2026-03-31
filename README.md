# Workspace Timer

Small Vite + React timer app with local persistence.

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

## Persistence

Projects, workspaces, tasks, timer progress, and recent task slots are saved in browser `localStorage` on the current device.

This branch intentionally removes the old Notion integration so the app can serve as a simpler base for the upcoming Supabase migration.
