-- Workspace Timer Supabase schema
-- This is a first-pass local-dev schema for syncing one app instance's
-- normalized state. Tighten security policies before using shared anon access.

create table if not exists public.app_instances (
  id text primary key,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.workspaces (
  id text primary key,
  instance_id text not null references public.app_instances(id) on delete cascade,
  name text not null,
  active_project_id text not null,
  visible_project_ids text[] not null default '{}',
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.projects (
  id text primary key,
  instance_id text not null references public.app_instances(id) on delete cascade,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.outcomes (
  id text primary key,
  instance_id text not null references public.app_instances(id) on delete cascade,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  project_id text not null references public.projects(id) on delete cascade,
  title text not null,
  type text not null default '',
  notes text not null default '',
  agent_eligible boolean not null default false,
  done boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.bursts (
  id text primary key,
  instance_id text not null references public.app_instances(id) on delete cascade,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  project_id text not null references public.projects(id) on delete cascade,
  outcome_id text references public.outcomes(id) on delete set null,
  title text not null,
  session_label text not null default '',
  type text not null default '',
  notes text not null default '',
  agent_eligible boolean not null default false,
  duration_seconds integer not null check (duration_seconds > 0),
  logged_at bigint not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.app_preferences (
  instance_id text primary key references public.app_instances(id) on delete cascade,
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

create index if not exists workspaces_instance_id_idx on public.workspaces(instance_id);
create index if not exists projects_instance_id_idx on public.projects(instance_id);
create index if not exists projects_workspace_id_idx on public.projects(workspace_id);
create index if not exists outcomes_instance_id_idx on public.outcomes(instance_id);
create index if not exists outcomes_project_id_idx on public.outcomes(project_id);
create index if not exists bursts_instance_id_idx on public.bursts(instance_id);
create index if not exists bursts_outcome_id_idx on public.bursts(outcome_id);
create index if not exists bursts_logged_at_idx on public.bursts(logged_at desc);

alter table public.app_instances disable row level security;
alter table public.workspaces disable row level security;
alter table public.projects disable row level security;
alter table public.outcomes disable row level security;
alter table public.bursts disable row level security;
alter table public.app_preferences disable row level security;
