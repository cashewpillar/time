import type { AppState, Burst, Outcome, Project, Workspace } from "../types/app";
import { getSupabaseClient, isSupabaseConfigured } from "./supabase";

const INSTANCE_ID_STORAGE_KEY = "workspace-two-supabase-instance-id";

type AppInstanceRow = {
  id: string;
  updated_at: string;
};

type WorkspaceRow = Workspace & {
  instance_id: string;
  active_project_id: string;
  visible_project_ids: string[];
  sort_order: number;
  updated_at: string;
};

type ProjectRow = {
  id: string;
  instance_id: string;
  workspace_id: string;
  name: string;
  sort_order: number;
  updated_at: string;
};

type OutcomeRow = {
  id: string;
  instance_id: string;
  workspace_id: string;
  project_id: string;
  title: string;
  type: string;
  notes: string;
  agent_eligible: boolean;
  done: boolean;
  sort_order: number;
  updated_at: string;
};

type BurstRow = {
  id: string;
  instance_id: string;
  workspace_id: string;
  project_id: string;
  outcome_id: string | null;
  title: string;
  session_label: string;
  type: string;
  notes: string;
  agent_eligible: boolean;
  duration_seconds: number;
  logged_at: number;
  updated_at: string;
};

type AppPreferencesRow = {
  instance_id: string;
  active_workspace_id: string;
  elapsed_seconds: number;
  target_seconds: number;
  is_running: boolean;
  completed_sessions: number;
  last_tick_at: number | null;
  active_outcome_id: string | null;
  is_outcome_form_open: boolean;
  editing_outcome_id: string | null;
  is_workspace_menu_open: boolean;
  is_project_menu_open: boolean;
  custom_outcome_types: string[];
  status: string;
  updated_at: string;
};

export function isSupabaseSyncEnabled(): boolean {
  return isSupabaseConfigured();
}

function getOrCreateInstanceId(): string | null {
  if (typeof window === "undefined") return null;
  const existing = window.localStorage.getItem(INSTANCE_ID_STORAGE_KEY);
  if (existing) return existing;
  const nextId = window.crypto?.randomUUID?.() || `instance-${Date.now()}`;
  window.localStorage.setItem(INSTANCE_ID_STORAGE_KEY, nextId);
  return nextId;
}

async function deleteMissingRows(table: "workspaces" | "projects" | "outcomes" | "bursts", instanceId: string, desiredIds: string[]) {
  const client = getSupabaseClient();
  if (!client) return;

  const { data, error } = await client.from(table).select("id").eq("instance_id", instanceId);
  if (error) throw error;

  const staleIds = (data || [])
    .map((row) => row.id as string)
    .filter((id) => !desiredIds.includes(id));

  if (!staleIds.length) return;

  const { error: deleteError } = await client.from(table).delete().eq("instance_id", instanceId).in("id", staleIds);
  if (deleteError) throw deleteError;
}

export async function loadStateFromSupabase(): Promise<Partial<AppState> | null> {
  const client = getSupabaseClient();
  const instanceId = getOrCreateInstanceId();
  if (!client || !instanceId) return null;

  const [
    preferencesResult,
    workspacesResult,
    projectsResult,
    outcomesResult,
    burstsResult
  ] = await Promise.all([
    client.from("app_preferences").select("*").eq("instance_id", instanceId).maybeSingle(),
    client.from("workspaces").select("*").eq("instance_id", instanceId).order("sort_order", { ascending: true }),
    client.from("projects").select("*").eq("instance_id", instanceId).order("sort_order", { ascending: true }),
    client.from("outcomes").select("*").eq("instance_id", instanceId).order("sort_order", { ascending: true }),
    client.from("bursts").select("*").eq("instance_id", instanceId).order("logged_at", { ascending: false })
  ]);

  if (preferencesResult.error) throw preferencesResult.error;
  if (workspacesResult.error) throw workspacesResult.error;
  if (projectsResult.error) throw projectsResult.error;
  if (outcomesResult.error) throw outcomesResult.error;
  if (burstsResult.error) throw burstsResult.error;

  const preferences = preferencesResult.data as AppPreferencesRow | null;
  const workspaces = (workspacesResult.data || []) as WorkspaceRow[];
  const projects = (projectsResult.data || []) as ProjectRow[];
  const outcomes = (outcomesResult.data || []) as OutcomeRow[];
  const bursts = (burstsResult.data || []) as BurstRow[];

  if (!preferences && !workspaces.length && !projects.length && !outcomes.length && !bursts.length) {
    return null;
  }

  return {
    activeWorkspaceId: preferences?.active_workspace_id,
    elapsedSeconds: preferences?.elapsed_seconds,
    targetSeconds: preferences?.target_seconds,
    isRunning: preferences?.is_running,
    completedSessions: preferences?.completed_sessions,
    lastTickAt: preferences?.last_tick_at,
    activeOutcomeId: preferences?.active_outcome_id,
    isOutcomeFormOpen: preferences?.is_outcome_form_open,
    editingOutcomeId: preferences?.editing_outcome_id,
    isWorkspaceMenuOpen: preferences?.is_workspace_menu_open,
    isProjectMenuOpen: preferences?.is_project_menu_open,
    customOutcomeTypes: preferences?.custom_outcome_types,
    status: preferences?.status,
    workspaces: workspaces.map(({ instance_id: _instanceId, active_project_id, visible_project_ids, sort_order: _sortOrder, updated_at: _updatedAt, ...workspace }) => ({
      ...workspace,
      activeProjectId: active_project_id,
      visibleProjectIds: visible_project_ids
    })),
    projects: projects.map(({ instance_id: _instanceId, workspace_id, sort_order: _sortOrder, updated_at: _updatedAt, ...project }) => ({
      ...project,
      workspaceId: workspace_id
    })),
    outcomes: outcomes.map(({ instance_id: _instanceId, workspace_id, project_id, agent_eligible, sort_order: _sortOrder, updated_at: _updatedAt, ...outcome }) => ({
      ...outcome,
      workspaceId: workspace_id,
      projectId: project_id,
      agentEligible: agent_eligible
    })),
    bursts: bursts.map(({ instance_id: _instanceId, workspace_id, project_id, outcome_id, session_label, agent_eligible, duration_seconds, logged_at, updated_at: _updatedAt, ...burst }) => ({
      ...burst,
      workspaceId: workspace_id,
      projectId: project_id,
      outcomeId: outcome_id,
      sessionLabel: session_label,
      agentEligible: agent_eligible,
      durationSeconds: duration_seconds,
      loggedAt: logged_at
    }))
  };
}

export async function saveStateToSupabase(state: AppState): Promise<void> {
  const client = getSupabaseClient();
  const instanceId = getOrCreateInstanceId();
  if (!client || !instanceId) return;

  const updatedAt = new Date().toISOString();

  const appInstance: AppInstanceRow = {
    id: instanceId,
    updated_at: updatedAt
  };

  const workspaceRows: WorkspaceRow[] = state.workspaces.map((workspace, index) => ({
    id: workspace.id,
    instance_id: instanceId,
    name: workspace.name,
    active_project_id: workspace.activeProjectId,
    visible_project_ids: workspace.visibleProjectIds,
    sort_order: index,
    updated_at: updatedAt
  }));

  const projectRows: ProjectRow[] = state.projects.map((project, index) => ({
    id: project.id,
    instance_id: instanceId,
    workspace_id: project.workspaceId,
    name: project.name,
    sort_order: index,
    updated_at: updatedAt
  }));

  const outcomeRows: OutcomeRow[] = state.outcomes.map((outcome, index) => ({
    id: outcome.id,
    instance_id: instanceId,
    workspace_id: outcome.workspaceId,
    project_id: outcome.projectId,
    title: outcome.title,
    type: outcome.type,
    notes: outcome.notes,
    agent_eligible: outcome.agentEligible,
    done: outcome.done,
    sort_order: index,
    updated_at: updatedAt
  }));

  const burstRows: BurstRow[] = state.bursts.map((burst) => ({
    id: burst.id,
    instance_id: instanceId,
    workspace_id: burst.workspaceId,
    project_id: burst.projectId,
    outcome_id: burst.outcomeId,
    title: burst.title,
    session_label: burst.sessionLabel,
    type: burst.type,
    notes: burst.notes,
    agent_eligible: burst.agentEligible,
    duration_seconds: burst.durationSeconds,
    logged_at: burst.loggedAt,
    updated_at: updatedAt
  }));

  const preferencesRow: AppPreferencesRow = {
    instance_id: instanceId,
    active_workspace_id: state.activeWorkspaceId,
    elapsed_seconds: state.elapsedSeconds,
    target_seconds: state.targetSeconds,
    is_running: state.isRunning,
    completed_sessions: state.completedSessions,
    last_tick_at: state.lastTickAt,
    active_outcome_id: state.activeOutcomeId,
    is_outcome_form_open: state.isOutcomeFormOpen,
    editing_outcome_id: state.editingOutcomeId,
    is_workspace_menu_open: state.isWorkspaceMenuOpen,
    is_project_menu_open: state.isProjectMenuOpen,
    custom_outcome_types: state.customOutcomeTypes,
    status: state.status,
    updated_at: updatedAt
  };

  const { error: appInstanceError } = await client.from("app_instances").upsert(appInstance, { onConflict: "id" });
  if (appInstanceError) throw appInstanceError;

  if (workspaceRows.length) {
    const { error } = await client.from("workspaces").upsert(workspaceRows, { onConflict: "id" });
    if (error) throw error;
  }

  if (projectRows.length) {
    const { error } = await client.from("projects").upsert(projectRows, { onConflict: "id" });
    if (error) throw error;
  }

  if (outcomeRows.length) {
    const { error } = await client.from("outcomes").upsert(outcomeRows, { onConflict: "id" });
    if (error) throw error;
  }

  if (burstRows.length) {
    const { error } = await client.from("bursts").upsert(burstRows, { onConflict: "id" });
    if (error) throw error;
  }

  const { error: preferencesError } = await client.from("app_preferences").upsert(preferencesRow, { onConflict: "instance_id" });
  if (preferencesError) throw preferencesError;

  await deleteMissingRows("bursts", instanceId, state.bursts.map((burst) => burst.id));
  await deleteMissingRows("outcomes", instanceId, state.outcomes.map((outcome) => outcome.id));
  await deleteMissingRows("projects", instanceId, state.projects.map((project) => project.id));
  await deleteMissingRows("workspaces", instanceId, state.workspaces.map((workspace) => workspace.id));
}
