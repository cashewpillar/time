import type { AppState, Burst, Outcome, Project, Workspace } from "../types/app";
import { buildIncrementalSyncPlan } from "./sync-plan";
import { getSupabaseClient, isSupabaseConfigured } from "./supabase";

type WorkspaceRow = {
  user_id: string;
  id: string;
  name: string;
  active_project_id: string;
  visible_project_ids: string[];
  sort_order: number;
  updated_at: string;
};

type ProjectRow = {
  user_id: string;
  id: string;
  workspace_id: string;
  name: string;
  sort_order: number;
  updated_at: string;
};

type OutcomeRow = {
  user_id: string;
  id: string;
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
  user_id: string;
  id: string;
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
  user_id: string;
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

async function deleteRowsByIds(
  table: "workspaces" | "projects" | "outcomes" | "bursts",
  userId: string,
  ids: string[]
) {
  const client = getSupabaseClient();
  if (!client) return;
  if (!ids.length) return;

  const { error: deleteError } = await client
    .from(table)
    .delete()
    .eq("user_id", userId)
    .in("id", ids);
  if (deleteError) throw deleteError;
}

async function deleteMissingRows(
  table: "workspaces" | "projects" | "outcomes" | "bursts",
  userId: string,
  desiredIds: string[]
) {
  const client = getSupabaseClient();
  if (!client) return;

  const { data, error } = await client.from(table).select("id").eq("user_id", userId);
  if (error) throw error;

  const staleIds = (data || [])
    .map((row) => row.id as string)
    .filter((id) => !desiredIds.includes(id));

  await deleteRowsByIds(table, userId, staleIds);
}

function buildPreferencesRow(userId: string, state: AppState, updatedAt: string, previousState?: AppState | null): AppPreferencesRow {
  return {
    user_id: userId,
    active_workspace_id: previousState?.activeWorkspaceId ?? state.activeWorkspaceId,
    elapsed_seconds: previousState?.elapsedSeconds ?? state.elapsedSeconds,
    target_seconds: previousState?.targetSeconds ?? state.targetSeconds,
    is_running: previousState?.isRunning ?? state.isRunning,
    completed_sessions: previousState?.completedSessions ?? state.completedSessions,
    last_tick_at: previousState?.lastTickAt ?? state.lastTickAt,
    active_outcome_id: previousState?.activeOutcomeId ?? state.activeOutcomeId,
    is_outcome_form_open: previousState?.isOutcomeFormOpen ?? state.isOutcomeFormOpen,
    editing_outcome_id: previousState?.editingOutcomeId ?? state.editingOutcomeId,
    is_workspace_menu_open: previousState?.isWorkspaceMenuOpen ?? state.isWorkspaceMenuOpen,
    is_project_menu_open: previousState?.isProjectMenuOpen ?? state.isProjectMenuOpen,
    custom_outcome_types: state.customOutcomeTypes,
    status: previousState?.status ?? state.status,
    updated_at: updatedAt
  };
}

export async function loadStateFromSupabase(userId: string): Promise<Partial<AppState> | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  const [
    preferencesResult,
    workspacesResult,
    projectsResult,
    outcomesResult,
    burstsResult
  ] = await Promise.all([
    client.from("app_preferences").select("*").eq("user_id", userId).maybeSingle(),
    client.from("workspaces").select("*").eq("user_id", userId).order("sort_order", { ascending: true }),
    client.from("projects").select("*").eq("user_id", userId).order("sort_order", { ascending: true }),
    client.from("outcomes").select("*").eq("user_id", userId).order("sort_order", { ascending: true }),
    client.from("bursts").select("*").eq("user_id", userId).order("logged_at", { ascending: false })
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
    workspaces: workspaces.map(({ user_id: _userId, active_project_id, visible_project_ids, sort_order: _sortOrder, updated_at: _updatedAt, ...workspace }) => ({
      ...workspace,
      activeProjectId: active_project_id,
      visibleProjectIds: visible_project_ids
    })),
    projects: projects.map(({ user_id: _userId, workspace_id, sort_order: _sortOrder, updated_at: _updatedAt, ...project }) => ({
      ...project,
      workspaceId: workspace_id
    })),
    outcomes: outcomes.map(({ user_id: _userId, workspace_id, project_id, agent_eligible, sort_order: _sortOrder, updated_at: _updatedAt, ...outcome }) => ({
      ...outcome,
      workspaceId: workspace_id,
      projectId: project_id,
      agentEligible: agent_eligible
    })),
    bursts: bursts.map(({ user_id: _userId, workspace_id, project_id, outcome_id, session_label, agent_eligible, duration_seconds, logged_at, updated_at: _updatedAt, ...burst }) => ({
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

export async function saveFullStateToSupabase(userId: string, state: AppState): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;

  const updatedAt = new Date().toISOString();

  const workspaceRows: WorkspaceRow[] = state.workspaces.map((workspace, index) => ({
    user_id: userId,
    id: workspace.id,
    name: workspace.name,
    active_project_id: workspace.activeProjectId,
    visible_project_ids: workspace.visibleProjectIds,
    sort_order: index,
    updated_at: updatedAt
  }));

  const projectRows: ProjectRow[] = state.projects.map((project, index) => ({
    user_id: userId,
    id: project.id,
    workspace_id: project.workspaceId,
    name: project.name,
    sort_order: index,
    updated_at: updatedAt
  }));

  const outcomeRows: OutcomeRow[] = state.outcomes.map((outcome, index) => ({
    user_id: userId,
    id: outcome.id,
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
    user_id: userId,
    id: burst.id,
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

  const preferencesRow = buildPreferencesRow(userId, state, updatedAt);

  if (workspaceRows.length) {
    const { error } = await client.from("workspaces").upsert(workspaceRows, { onConflict: "user_id,id" });
    if (error) throw error;
  }

  if (projectRows.length) {
    const { error } = await client.from("projects").upsert(projectRows, { onConflict: "user_id,id" });
    if (error) throw error;
  }

  if (outcomeRows.length) {
    const { error } = await client.from("outcomes").upsert(outcomeRows, { onConflict: "user_id,id" });
    if (error) throw error;
  }

  if (burstRows.length) {
    const { error } = await client.from("bursts").upsert(burstRows, { onConflict: "user_id,id" });
    if (error) throw error;
  }

  const { error: preferencesError } = await client.from("app_preferences").upsert(preferencesRow, { onConflict: "user_id" });
  if (preferencesError) throw preferencesError;

  await deleteMissingRows("bursts", userId, state.bursts.map((burst) => burst.id));
  await deleteMissingRows("outcomes", userId, state.outcomes.map((outcome) => outcome.id));
  await deleteMissingRows("projects", userId, state.projects.map((project) => project.id));
  await deleteMissingRows("workspaces", userId, state.workspaces.map((workspace) => workspace.id));
}

export async function saveStateToSupabase(userId: string, state: AppState, previousState: AppState | null): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;

  const updatedAt = new Date().toISOString();
  const plan = buildIncrementalSyncPlan(previousState, state);
  const previousWorkspacesById = new Map((previousState?.workspaces || []).map((workspace) => [workspace.id, workspace]));

  const workspaceRows: WorkspaceRow[] = plan.workspacesToUpsert.map((workspace, index) => {
    const previousWorkspace = previousWorkspacesById.get(workspace.id);
    const workspaceIndex = state.workspaces.findIndex((entry) => entry.id === workspace.id);
    return {
      user_id: userId,
      id: workspace.id,
      name: workspace.name,
      active_project_id: previousWorkspace?.activeProjectId ?? state.workspaces[workspaceIndex]?.activeProjectId ?? workspace.activeProjectId,
      visible_project_ids: previousWorkspace?.visibleProjectIds ?? state.workspaces[workspaceIndex]?.visibleProjectIds ?? workspace.visibleProjectIds,
      sort_order: workspaceIndex >= 0 ? workspaceIndex : index,
      updated_at: updatedAt
    };
  });

  const projectRows: ProjectRow[] = plan.projectsToUpsert.map((project) => ({
    user_id: userId,
    id: project.id,
    workspace_id: project.workspaceId,
    name: project.name,
    sort_order: state.projects.findIndex((entry) => entry.id === project.id),
    updated_at: updatedAt
  }));

  const outcomeRows: OutcomeRow[] = plan.outcomesToUpsert.map((outcome) => ({
    user_id: userId,
    id: outcome.id,
    workspace_id: outcome.workspaceId,
    project_id: outcome.projectId,
    title: outcome.title,
    type: outcome.type,
    notes: outcome.notes,
    agent_eligible: outcome.agentEligible,
    done: outcome.done,
    sort_order: state.outcomes.findIndex((entry) => entry.id === outcome.id),
    updated_at: updatedAt
  }));

  const burstRows: BurstRow[] = plan.burstsToUpsert.map((burst) => ({
    user_id: userId,
    id: burst.id,
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

  const preferencesRow = buildPreferencesRow(userId, state, updatedAt, previousState);

  if (workspaceRows.length) {
    const { error } = await client.from("workspaces").upsert(workspaceRows, { onConflict: "user_id,id" });
    if (error) throw error;
  }

  if (projectRows.length) {
    const { error } = await client.from("projects").upsert(projectRows, { onConflict: "user_id,id" });
    if (error) throw error;
  }

  if (outcomeRows.length) {
    const { error } = await client.from("outcomes").upsert(outcomeRows, { onConflict: "user_id,id" });
    if (error) throw error;
  }

  if (burstRows.length) {
    const { error } = await client.from("bursts").upsert(burstRows, { onConflict: "user_id,id" });
    if (error) throw error;
  }

  if (plan.shouldUpsertPreferences) {
    const { error: preferencesError } = await client.from("app_preferences").upsert(preferencesRow, { onConflict: "user_id" });
    if (preferencesError) throw preferencesError;
  }

  await deleteRowsByIds("bursts", userId, plan.burstIdsToDelete);
  await deleteRowsByIds("outcomes", userId, plan.outcomeIdsToDelete);
  await deleteRowsByIds("projects", userId, plan.projectIdsToDelete);
  await deleteRowsByIds("workspaces", userId, plan.workspaceIdsToDelete);
}
