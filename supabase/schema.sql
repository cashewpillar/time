-- Workspace Timer Supabase schema with Auth + RLS
-- Commit-safe setup script: non-destructive and safe to rerun.

create extension if not exists pgcrypto;

create table if not exists public.workspaces (
  row_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  name text not null,
  active_project_id text not null,
  visible_project_ids text[] not null default '{}',
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, id)
);

create table if not exists public.projects (
  row_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  workspace_id text not null,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, id)
);

create table if not exists public.outcomes (
  row_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  workspace_id text not null,
  project_id text not null,
  title text not null,
  type text not null default '',
  notes text not null default '',
  agent_eligible boolean not null default false,
  done boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, id)
);

create table if not exists public.bursts (
  row_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  workspace_id text not null,
  project_id text not null,
  outcome_id text,
  title text not null,
  session_label text not null default '',
  type text not null default '',
  notes text not null default '',
  agent_eligible boolean not null default false,
  duration_seconds integer not null check (duration_seconds > 0),
  logged_at bigint not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, id)
);

create table if not exists public.app_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active_workspace_id text not null,
  elapsed_seconds integer not null default 0,
  target_seconds integer not null default 1200,
  is_running boolean not null default false,
  completed_sessions integer not null default 0,
  last_tick_at bigint,
  active_outcome_id text,
  editing_outcome_id text,
  is_outcome_form_open boolean not null default false,
  is_workspace_menu_open boolean not null default false,
  is_project_menu_open boolean not null default false,
  custom_outcome_types text[] not null default '{}',
  status text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists workspaces_user_id_idx on public.workspaces(user_id);
create index if not exists projects_user_id_idx on public.projects(user_id);
create index if not exists outcomes_user_id_idx on public.outcomes(user_id);
create index if not exists bursts_user_id_idx on public.bursts(user_id);
create index if not exists bursts_logged_at_idx on public.bursts(user_id, logged_at desc);

alter table public.workspaces enable row level security;
alter table public.projects enable row level security;
alter table public.outcomes enable row level security;
alter table public.bursts enable row level security;
alter table public.app_preferences enable row level security;

drop policy if exists "users manage own workspaces" on public.workspaces;
create policy "users manage own workspaces"
on public.workspaces
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "users manage own projects" on public.projects;
create policy "users manage own projects"
on public.projects
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "users manage own outcomes" on public.outcomes;
create policy "users manage own outcomes"
on public.outcomes
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "users manage own bursts" on public.bursts;
create policy "users manage own bursts"
on public.bursts
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "users manage own app_preferences" on public.app_preferences;
create policy "users manage own app_preferences"
on public.app_preferences
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
