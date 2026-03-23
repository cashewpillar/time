# Workspace Timer

Small Vite + React timer app with local persistence and optional Notion work-log export.

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

## Notion logging

This app can create rows in a Notion database when you save a task, and it can also fetch the existing select values already configured in that database.

The frontend only stores:

- the public Worker URL
- the Notion database ID

The frontend does not store or send a Notion API key anymore. The Worker is responsible for authenticating with Notion using a server-side secret.

### Notion database shape

The current app expects these properties in your Notion database:

- `Entry` as `Title`
- `Task type` as `Select`
- `Task` as `Select`
- `Epic` as `Select`
- `Minutes` as `Number`
- `Start datetime` as `Date`
- `Notes` as `Text`
- `AI workflow` as `Checkbox`

### Frontend env var

Create a local `.env` file from `.env.example`:

```bash
cp .env.example .env
```

Then set:

```bash
VITE_NOTION_WORKER_URL="https://your-worker-name.your-subdomain.workers.dev"
```

If this variable is omitted, the app falls back to the current hard-coded Worker URL in [src/lib/notion.ts](/Users/halloween/Dev/time/src/lib/notion.ts).

### Cloudflare Worker setup

An example Worker is included at [workers/notion-proxy.js](/Users/halloween/Dev/time/workers/notion-proxy.js).

It expects one secret:

- `NOTION_API_KEY`

Recommended additional secret:

- `ALLOWED_ORIGINS`

#### 1. Create the Worker

```bash
npm install -g wrangler
wrangler login
wrangler init notion-proxy
```

Replace the generated Worker source with the contents of [workers/notion-proxy.js](/Users/halloween/Dev/time/workers/notion-proxy.js).

#### 2. Add the Notion secret

```bash
wrangler secret put NOTION_API_KEY
```

Paste your internal Notion integration token when prompted.

Then add an origin allowlist so the Worker is not a public browser-write endpoint:

```bash
wrangler secret put ALLOWED_ORIGINS
```

Suggested values:

- local dev: `http://localhost:5173`
- local dev plus a deployed frontend: `http://localhost:5173,https://your-app.example.com`

#### 3. Deploy

```bash
wrangler deploy
```

After deploy, copy the Worker URL and place it in your local `.env` as `VITE_NOTION_WORKER_URL`.

### Notion integration setup

1. Create a Notion internal integration.
2. Copy the integration token and save it into the Worker as `NOTION_API_KEY`.
3. Open your target database in Notion.
4. Share the database with the integration so it can insert rows.
5. Copy the database ID and paste it into the app's Notion config panel.

### Request flow

1. The app saves a task or requests schema data.
2. The browser sends either task data or a schema request plus `databaseId` to the Worker.
3. The Worker adds the `Authorization` header with `NOTION_API_KEY`.
4. The Worker either creates a page in the target Notion database or fetches the database schema.

### Fetching select values

The Notion config panel includes a `Fetch select values` button.

It reads the current options from:

- `Task type`
- `Task`
- `Epic`

This is useful for checking what values already exist in your database before you start logging work from the app.

### Troubleshooting

- `401 Unauthorized`
  The Worker secret is missing or the Notion token is invalid.

- `403 Origin not allowed`
  The browser origin is not included in the Worker `ALLOWED_ORIGINS` secret.

- `400 validation_error`
  One or more database properties do not match the types expected by the app.

- `object_not_found`
  The database ID is wrong, or the integration has not been shared onto the database.

- duplicate requests during local development
  React `StrictMode` intentionally re-runs mount logic in development. This is expected in dev and does not happen the same way in production.
