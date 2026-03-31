import type {
  AppState,
  Burst,
  LegacyPersistedProject,
  LegacyPersistedState,
  LegacyPersistedTask,
  LegacyPersistedWorkspace,
  LocalCache,
  LocalCacheBurst,
  LocalCacheOutcome,
  Outcome,
  Project,
  RecentTaskSlot,
  Task,
  TaskDraft,
  Workspace
} from "../types/app";
import { formatManualDuration } from "../lib/time";

export const STORAGE_KEY = "workspace-two-cache-v3";
export const LEGACY_STORAGE_KEY = "workspace-two-state-v2";
export const DEFAULT_TARGET_SECONDS = 20 * 60;
export const DEFAULT_TASK_TYPES = ["development", "design", "product"] as const;
export const RECENT_TASK_SLOT_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

export type AppAction =
  | { type: "hydrate-state"; state: Partial<AppState>; status?: string }
  | { type: "select-task"; taskId: string }
  | { type: "toggle-workspace-menu" }
  | { type: "toggle-project-menu" }
  | { type: "close-menus" }
  | { type: "select-workspace"; workspaceId: string }
  | { type: "create-workspace"; now: number }
  | { type: "rename-workspace"; workspaceId: string; name: string }
  | { type: "delete-workspace"; workspaceId: string }
  | { type: "select-project"; projectId: string }
  | { type: "create-project"; now: number }
  | { type: "rename-project"; projectId: string; name: string }
  | { type: "delete-project"; projectId: string }
  | { type: "set-timer-target"; targetSeconds: number }
  | { type: "start-timer"; now: number }
  | { type: "pause-timer" }
  | { type: "reset-timer" }
  | { type: "tick"; now: number }
  | { type: "open-task-form" }
  | { type: "close-task-form" }
  | { type: "edit-task"; taskId: string }
  | { type: "save-task"; draft: TaskDraft; customType: string; now: number }
  | { type: "toggle-task"; taskId: string }
  | { type: "delete-task"; taskId: string }
  | { type: "clear-completed" }
  | { type: "clear-recent-task-slots" }
  | { type: "log-manual-entry"; slot: RecentTaskSlot; durationSeconds: number }
  | { type: "restore-recent-task"; slot: RecentTaskSlot; now: number }
  | { type: "set-status"; status: string };

export function defaultState(): AppState {
  const workspaces: Workspace[] = [
    {
      id: "workspace-1",
      name: "Workspace 1",
      activeProjectId: "workspace-1-project-1",
      visibleProjectIds: ["workspace-1-project-1", "workspace-1-project-2"]
    },
    {
      id: "workspace-2",
      name: "Workspace 2",
      activeProjectId: "workspace-2-project-2",
      visibleProjectIds: ["workspace-2-project-1", "workspace-2-project-2"]
    }
  ];
  const projects: Project[] = [
    { id: "workspace-1-project-1", workspaceId: "workspace-1", name: "Project 1" },
    { id: "workspace-1-project-2", workspaceId: "workspace-1", name: "Project 2" },
    { id: "workspace-2-project-1", workspaceId: "workspace-2", name: "Project 1" },
    { id: "workspace-2-project-2", workspaceId: "workspace-2", name: "Project 2" },
    { id: "workspace-2-project-3", workspaceId: "workspace-2", name: "Project 3" }
  ];

  return {
    activeWorkspaceId: "workspace-2",
    elapsedSeconds: 0,
    targetSeconds: DEFAULT_TARGET_SECONDS,
    isRunning: false,
    completedSessions: 0,
    lastTickAt: null,
    activeOutcomeId: null,
    isTaskFormOpen: false,
    editingOutcomeId: null,
    isWorkspaceMenuOpen: false,
    isProjectMenuOpen: false,
    customTaskTypes: [],
    recentBurstIds: [],
    status: "Projects, workspaces, and timer progress are saved on this device.",
    workspaces,
    projects,
    outcomes: [],
    bursts: []
  };
}

export function loadStateFromStorageValue(input?: unknown): AppState {
  if (isLocalCache(input)) {
    return normalizeState(deserializeLocalCache(input));
  }
  return normalizeState(migrateLegacyState(input));
}

export function serializeStateForStorage(state: AppState): LocalCache {
  const cache: LocalCache = {
    version: 3,
    workspaceIds: state.workspaces.map((workspace) => workspace.id),
    workspacesById: Object.fromEntries(state.workspaces.map((workspace) => [workspace.id, workspace])),
    projectIdsByWorkspaceId: {},
    projectsById: Object.fromEntries(state.projects.map((project) => [project.id, project])),
    outcomeIdsByProjectId: {},
    outcomesById: {},
    taskBurstIdsByProjectId: {},
    burstsById: {},
    recentBurstIds: [...state.recentBurstIds],
    ui: {
      activeWorkspaceId: state.activeWorkspaceId,
      elapsedSeconds: state.elapsedSeconds,
      targetSeconds: state.targetSeconds,
      isRunning: state.isRunning,
      completedSessions: state.completedSessions,
      lastTickAt: state.lastTickAt,
      activeOutcomeId: state.activeOutcomeId,
      isTaskFormOpen: state.isTaskFormOpen,
      editingOutcomeId: state.editingOutcomeId,
      isWorkspaceMenuOpen: state.isWorkspaceMenuOpen,
      isProjectMenuOpen: state.isProjectMenuOpen,
      customTaskTypes: [...state.customTaskTypes],
      status: state.status
    }
  };

  for (const workspace of state.workspaces) {
    cache.projectIdsByWorkspaceId[workspace.id] = getProjectsForWorkspaceId(state, workspace.id).map((project) => project.id);
  }

  for (const project of state.projects) {
    cache.outcomeIdsByProjectId[project.id] = getOutcomesForProjectId(state, project.id).map((outcome) => outcome.id);
    cache.taskBurstIdsByProjectId[project.id] = state.bursts
      .filter((burst) => burst.projectId === project.id && burst.source === "task")
      .map((burst) => burst.id);
  }

  for (const outcome of state.outcomes) {
    const sourceBurstIds = state.bursts
      .filter((burst) => burst.outcomeId === outcome.id)
      .map((burst) => burst.id);
    cache.outcomesById[outcome.id] = {
      ...outcome,
      key: buildOutcomeKey(outcome.workspaceId, outcome.projectId, outcome.title),
      sourceBurstIds
    };
  }

  for (const burst of state.bursts) {
    cache.burstsById[burst.id] = {
      ...burst,
      kind: burst.source,
      sourceId: burst.id.replace(/^burst-(task|recent)-/, ""),
      done: burst.source === "task"
        ? Boolean(state.outcomes.find((outcome) => outcome.id === burst.outcomeId)?.done)
        : false
    };
  }

  return cache;
}

export function normalizeState(input?: Partial<AppState>): AppState {
  const base = defaultState();
  const next: AppState = {
    ...base,
    ...input,
    activeWorkspaceId: typeof input?.activeWorkspaceId === "string" ? input.activeWorkspaceId : base.activeWorkspaceId,
    elapsedSeconds: typeof input?.elapsedSeconds === "number" && input.elapsedSeconds >= 0 ? input.elapsedSeconds : base.elapsedSeconds,
    targetSeconds: typeof input?.targetSeconds === "number" && input.targetSeconds > 0 ? input.targetSeconds : base.targetSeconds,
    isRunning: typeof input?.isRunning === "boolean" ? input.isRunning : base.isRunning,
    completedSessions: typeof input?.completedSessions === "number" && input.completedSessions >= 0 ? input.completedSessions : base.completedSessions,
    lastTickAt: typeof input?.lastTickAt === "number" ? input.lastTickAt : base.lastTickAt,
    activeOutcomeId: typeof input?.activeOutcomeId === "string" ? input.activeOutcomeId : base.activeOutcomeId,
    isTaskFormOpen: typeof input?.isTaskFormOpen === "boolean" ? input.isTaskFormOpen : base.isTaskFormOpen,
    editingOutcomeId: typeof input?.editingOutcomeId === "string" ? input.editingOutcomeId : base.editingOutcomeId,
    isWorkspaceMenuOpen: typeof input?.isWorkspaceMenuOpen === "boolean" ? input.isWorkspaceMenuOpen : base.isWorkspaceMenuOpen,
    isProjectMenuOpen: typeof input?.isProjectMenuOpen === "boolean" ? input.isProjectMenuOpen : base.isProjectMenuOpen,
    customTaskTypes: Array.isArray(input?.customTaskTypes)
      ? input.customTaskTypes
          .filter((type): type is string => typeof type === "string" && type.trim().length > 0)
          .map((type) => type.trim().toLowerCase())
      : base.customTaskTypes,
    recentBurstIds: Array.isArray(input?.recentBurstIds)
      ? input.recentBurstIds.filter((id): id is string => typeof id === "string")
      : base.recentBurstIds,
    status: typeof input?.status === "string" ? input.status : base.status,
    workspaces: normalizeWorkspaces(input?.workspaces),
    projects: normalizeProjects(input?.projects),
    outcomes: normalizeOutcomes(input?.outcomes),
    bursts: normalizeBursts(input?.bursts)
  };

  if (!next.workspaces.length) {
    return defaultState();
  }

  next.workspaces = next.workspaces.map((workspace) => normalizeWorkspace(workspace, next.projects));

  if (!next.workspaces.some((workspace) => workspace.id === next.activeWorkspaceId)) {
    next.activeWorkspaceId = next.workspaces[0].id;
  }

  if (next.activeOutcomeId && !next.outcomes.some((outcome) => outcome.id === next.activeOutcomeId)) {
    next.activeOutcomeId = null;
  }

  const activeProject = getActiveProject(next);
  next.activeOutcomeId = getDefaultActiveOutcomeId(next, activeProject?.id || null, next.activeOutcomeId);

  next.recentBurstIds = next.recentBurstIds.filter((burstId) => next.bursts.some((burst) => burst.id === burstId));
  next.bursts = next.bursts.filter((burst) => burst.source === "task" || next.recentBurstIds.includes(burst.id));

  if (next.isRunning && next.lastTickAt) {
    const now = Date.now();
    const elapsedSinceLastTick = Math.floor((now - next.lastTickAt) / 1000);
    if (elapsedSinceLastTick > 0) {
      next.elapsedSeconds = Math.min(next.targetSeconds, next.elapsedSeconds + elapsedSinceLastTick);
      next.lastTickAt += elapsedSinceLastTick * 1000;
    }
  }

  if (next.elapsedSeconds >= next.targetSeconds && next.isRunning) {
    const loggedAt = Date.now();
    const completionBurst = buildRecentBurstFromState(next, loggedAt);
    next.elapsedSeconds = next.targetSeconds;
    next.isRunning = false;
    next.lastTickAt = null;
    next.completedSessions += 1;
    if (completionBurst) {
      next.bursts = upsertBurst(next.bursts, completionBurst);
      next.recentBurstIds = mergeRecentBurstId(next, completionBurst.id);
    }
    next.status = "Session complete. Nice work.";
  }

  return next;
}

export function getActiveWorkspace(state: AppState): Workspace | null {
  return state.workspaces.find((workspace) => workspace.id === state.activeWorkspaceId) || null;
}

export function getProjectsForWorkspaceId(state: AppState, workspaceId: string): Project[] {
  return state.projects.filter((project) => project.workspaceId === workspaceId);
}

export function getActiveProject(state: AppState): Project | null {
  const workspace = getActiveWorkspace(state);
  if (!workspace) return null;
  return state.projects.find((project) => project.id === workspace.activeProjectId) || null;
}

export function getVisibleProjects(workspace: Workspace | null, state: AppState): Project[] {
  if (!workspace) return [];
  return workspace.visibleProjectIds
    .map((projectId) => state.projects.find((project) => project.id === projectId) || null)
    .filter((project): project is Project => Boolean(project));
}

export function getOutcomesForProjectId(state: AppState, projectId: string): Outcome[] {
  return state.outcomes.filter((outcome) => outcome.projectId === projectId);
}

export function getEditingTask(state: AppState): Outcome | null {
  return state.outcomes.find((entry) => entry.id === state.editingOutcomeId) || null;
}

export function getSelectedTask(state: AppState): Task | null {
  const outcome = state.outcomes.find((entry) => entry.id === state.activeOutcomeId) || null;
  return outcome ? outcomeToTask(outcome) : null;
}

export function getTaskTypeOptions(customTaskTypes: string[]): string[] {
  return Array.from(new Set([...DEFAULT_TASK_TYPES, ...customTaskTypes]));
}

export function getRecentTaskSlots(state: AppState): RecentTaskSlot[] {
  return state.recentBurstIds
    .map((burstId) => state.bursts.find((burst) => burst.id === burstId) || null)
    .filter((burst): burst is Burst => Boolean(burst && burst.source === "recent"))
    .map((burst) => {
      const workspaceName = state.workspaces.find((workspace) => workspace.id === burst.workspaceId)?.name || "Workspace";
      const projectName = state.projects.find((project) => project.id === burst.projectId)?.name || "Project";
      return {
        id: burst.id,
        taskId: burst.outcomeId,
        taskText: burst.title,
        taskType: burst.type,
        taskNotes: burst.notes,
        agentEligible: burst.agentEligible,
        workspaceId: burst.workspaceId,
        workspaceName,
        projectId: burst.projectId,
        projectName,
        lastDurationSeconds: burst.lastDurationSeconds,
        loggedAt: burst.loggedAt
      };
    });
}

function migrateLegacyState(input: unknown): Partial<AppState> | undefined {
  if (!input || typeof input !== "object") return undefined;
  const legacy = input as LegacyPersistedState;
  const base = defaultState();

  const workspaces = Array.isArray(legacy.workspaces) && legacy.workspaces.length
    ? legacy.workspaces.flatMap((workspace, workspaceIndex) => {
        const candidate = workspace as LegacyPersistedWorkspace;
        if (typeof candidate !== "object" || !candidate) return [];
        const workspaceId = typeof candidate.id === "string" ? candidate.id : `workspace-${workspaceIndex + 1}`;
        return [{
          id: workspaceId,
          name: typeof candidate.name === "string" && candidate.name.trim() ? candidate.name : `Workspace ${workspaceIndex + 1}`,
          activeProjectId: typeof candidate.activeProjectId === "string" ? candidate.activeProjectId : "",
          visibleProjectIds: Array.isArray(candidate.visibleProjectIds)
            ? candidate.visibleProjectIds.filter((id): id is string => typeof id === "string")
            : []
        }];
      })
    : base.workspaces;

  const projects: Project[] = [];
  const outcomes: Outcome[] = [];
  const bursts: Burst[] = [];
  const recentBurstIds: string[] = [];
  const outcomeIdsByKey = new Map<string, string>();
  const legacyTaskIdToOutcomeId = new Map<string, string>();

  function ensureOutcome(params: {
    workspaceId: string;
    projectId: string;
    title: string;
    type: string;
    notes: string;
    agentEligible: boolean;
    done: boolean;
    sourceId: string;
  }): string {
    const derivedTitle = deriveOutcomeTitle(params.title);
    const key = buildOutcomeKey(params.workspaceId, params.projectId, derivedTitle);
    const existing = outcomeIdsByKey.get(key);
    if (existing) {
      const outcome = outcomes.find((entry) => entry.id === existing);
      if (outcome) {
        if (!outcome.type && params.type.trim()) outcome.type = params.type.trim();
        if (!outcome.notes && params.notes.trim()) outcome.notes = params.notes.trim();
        outcome.agentEligible = outcome.agentEligible || params.agentEligible;
        outcome.done = outcome.done && params.done;
      }
      return existing;
    }

    const outcomeId = `outcome-${params.projectId}-${outcomes.length + 1}`;
    outcomes.push({
      id: outcomeId,
      workspaceId: params.workspaceId,
      projectId: params.projectId,
      title: derivedTitle,
      type: params.type.trim(),
      notes: params.notes.trim(),
      agentEligible: params.agentEligible,
      done: params.done
    });
    outcomeIdsByKey.set(key, outcomeId);
    return outcomeId;
  }

  for (const workspace of workspaces) {
    const legacyWorkspace = (legacy.workspaces as unknown[] | undefined)?.find((entry) => {
      const candidate = entry as LegacyPersistedWorkspace;
      return candidate?.id === workspace.id;
    }) as LegacyPersistedWorkspace | undefined;
    const workspaceProjects = Array.isArray(legacyWorkspace?.projects) && legacyWorkspace.projects.length
      ? legacyWorkspace.projects
      : base.projects.filter((project) => project.workspaceId === workspace.id).map((project) => ({
          id: project.id,
          name: project.name,
          tasks: []
        }));

    for (let projectIndex = 0; projectIndex < workspaceProjects.length; projectIndex += 1) {
      const projectCandidate = workspaceProjects[projectIndex] as LegacyPersistedProject;
      const projectId = typeof projectCandidate.id === "string"
        ? projectCandidate.id
        : `${workspace.id}-project-${projectIndex + 1}`;
      projects.push({
        id: projectId,
        workspaceId: workspace.id,
        name: typeof projectCandidate.name === "string" && projectCandidate.name.trim()
          ? projectCandidate.name
          : `Project ${projectIndex + 1}`
      });

      const tasks = Array.isArray(projectCandidate.tasks) ? projectCandidate.tasks : [];
      tasks.forEach((taskCandidate, taskIndex) => {
        const task = taskCandidate as LegacyPersistedTask;
        if (!task || typeof task.text !== "string" || !task.text.trim()) return;
        const sourceId = typeof task.id === "string" ? task.id : `task-${workspace.id}-${projectId}-${taskIndex + 1}`;
        const outcomeId = ensureOutcome({
          workspaceId: workspace.id,
          projectId,
          title: task.text,
          type: typeof task.type === "string" ? task.type : "",
          notes: typeof task.notes === "string" ? task.notes : "",
          agentEligible: Boolean(task.agentEligible),
          done: Boolean(task.done),
          sourceId
        });

        legacyTaskIdToOutcomeId.set(sourceId, outcomeId);
        bursts.push({
          id: `burst-task-${sourceId}`,
          workspaceId: workspace.id,
          projectId,
          outcomeId,
          title: task.text,
          type: typeof task.type === "string" ? task.type : "",
          notes: typeof task.notes === "string" ? task.notes : "",
          agentEligible: Boolean(task.agentEligible),
          lastDurationSeconds: null,
          loggedAt: 0,
          source: "task"
        });
      });
    }
  }

  const recentTaskSlots = normalizeRecentTaskSlots(legacy.recentTaskSlots);
  for (const slot of recentTaskSlots) {
    const outcomeId = ensureOutcome({
      workspaceId: slot.workspaceId,
      projectId: slot.projectId,
      title: slot.taskText,
      type: slot.taskType,
      notes: slot.taskNotes,
      agentEligible: slot.agentEligible,
      done: false,
      sourceId: slot.id
    });
    const burstId = `burst-recent-${slot.id}`;
    bursts.push({
      id: burstId,
      workspaceId: slot.workspaceId,
      projectId: slot.projectId,
      outcomeId,
      title: slot.taskText,
      type: slot.taskType,
      notes: slot.taskNotes,
      agentEligible: slot.agentEligible,
      lastDurationSeconds: slot.lastDurationSeconds,
      loggedAt: slot.loggedAt,
      source: "recent"
    });
    recentBurstIds.push(burstId);
  }

  return {
    activeWorkspaceId: typeof legacy.activeWorkspaceId === "string" ? legacy.activeWorkspaceId : base.activeWorkspaceId,
    elapsedSeconds: typeof legacy.elapsedSeconds === "number" ? legacy.elapsedSeconds : base.elapsedSeconds,
    targetSeconds: typeof legacy.targetSeconds === "number" ? legacy.targetSeconds : base.targetSeconds,
    isRunning: typeof legacy.isRunning === "boolean" ? legacy.isRunning : base.isRunning,
    completedSessions: typeof legacy.completedSessions === "number" ? legacy.completedSessions : base.completedSessions,
    lastTickAt: typeof legacy.lastTickAt === "number" ? legacy.lastTickAt : base.lastTickAt,
    activeOutcomeId: typeof legacy.activeTaskId === "string" ? legacyTaskIdToOutcomeId.get(legacy.activeTaskId) || null : null,
    isTaskFormOpen: typeof legacy.isTaskFormOpen === "boolean" ? legacy.isTaskFormOpen : base.isTaskFormOpen,
    editingOutcomeId: typeof legacy.editingTaskId === "string" ? legacyTaskIdToOutcomeId.get(legacy.editingTaskId) || null : null,
    isWorkspaceMenuOpen: typeof legacy.isWorkspaceMenuOpen === "boolean" ? legacy.isWorkspaceMenuOpen : base.isWorkspaceMenuOpen,
    isProjectMenuOpen: typeof legacy.isProjectMenuOpen === "boolean" ? legacy.isProjectMenuOpen : base.isProjectMenuOpen,
    customTaskTypes: Array.isArray(legacy.customTaskTypes)
      ? legacy.customTaskTypes.filter((type): type is string => typeof type === "string").map((type) => type.trim().toLowerCase()).filter(Boolean)
      : [],
    recentBurstIds,
    status: typeof legacy.status === "string" ? legacy.status : base.status,
    workspaces,
    projects,
    outcomes,
    bursts
  };
}

function isLocalCache(input: unknown): input is LocalCache {
  if (!input || typeof input !== "object") return false;
  const candidate = input as Partial<LocalCache>;
  return candidate.version === 3 && Array.isArray(candidate.workspaceIds) && Boolean(candidate.ui);
}

function deserializeLocalCache(cache: LocalCache): Partial<AppState> {
  const workspaces = cache.workspaceIds
    .map((workspaceId) => cache.workspacesById[workspaceId])
    .filter((workspace): workspace is Workspace => Boolean(workspace));
  const projects = Object.values(cache.projectsById || {});
  const outcomes = Object.values(cache.outcomesById || {}).map((outcome) => ({
    id: outcome.id,
    workspaceId: outcome.workspaceId,
    projectId: outcome.projectId,
    title: outcome.title,
    type: outcome.type,
    notes: outcome.notes,
    agentEligible: outcome.agentEligible,
    done: outcome.done
  }));
  const bursts = Object.values(cache.burstsById || {}).map((burst) => ({
    id: burst.id,
    workspaceId: burst.workspaceId,
    projectId: burst.projectId,
    outcomeId: burst.outcomeId,
    title: burst.title,
    type: burst.type,
    notes: burst.notes,
    agentEligible: burst.agentEligible,
    lastDurationSeconds: burst.lastDurationSeconds,
    loggedAt: burst.loggedAt,
    source: burst.kind
  }));

  return {
    activeWorkspaceId: cache.ui.activeWorkspaceId,
    elapsedSeconds: cache.ui.elapsedSeconds,
    targetSeconds: cache.ui.targetSeconds,
    isRunning: cache.ui.isRunning,
    completedSessions: cache.ui.completedSessions,
    lastTickAt: cache.ui.lastTickAt,
    activeOutcomeId: cache.ui.activeOutcomeId,
    isTaskFormOpen: cache.ui.isTaskFormOpen,
    editingOutcomeId: cache.ui.editingOutcomeId,
    isWorkspaceMenuOpen: cache.ui.isWorkspaceMenuOpen,
    isProjectMenuOpen: cache.ui.isProjectMenuOpen,
    customTaskTypes: cache.ui.customTaskTypes,
    recentBurstIds: [...cache.recentBurstIds],
    status: cache.ui.status,
    workspaces,
    projects,
    outcomes,
    bursts
  };
}

function normalizeWorkspaces(input: unknown): Workspace[] {
  if (!Array.isArray(input)) return defaultState().workspaces;
  return input.flatMap((workspace, index) => {
    if (!workspace || typeof workspace !== "object") return [];
    const candidate = workspace as Partial<Workspace>;
    return [{
      id: typeof candidate.id === "string" ? candidate.id : `workspace-${index + 1}`,
      name: typeof candidate.name === "string" && candidate.name.trim() ? candidate.name : `Workspace ${index + 1}`,
      activeProjectId: typeof candidate.activeProjectId === "string" ? candidate.activeProjectId : "",
      visibleProjectIds: Array.isArray(candidate.visibleProjectIds)
        ? candidate.visibleProjectIds.filter((id): id is string => typeof id === "string")
        : []
    }];
  });
}

function normalizeProjects(input: unknown): Project[] {
  if (!Array.isArray(input)) return defaultState().projects;
  return input.flatMap((project, index) => {
    if (!project || typeof project !== "object") return [];
    const candidate = project as Partial<Project>;
    if (typeof candidate.workspaceId !== "string") return [];
    return [{
      id: typeof candidate.id === "string" ? candidate.id : `project-${index + 1}`,
      workspaceId: candidate.workspaceId,
      name: typeof candidate.name === "string" && candidate.name.trim() ? candidate.name : `Project ${index + 1}`
    }];
  });
}

function normalizeOutcomes(input: unknown): Outcome[] {
  if (!Array.isArray(input)) return [];
  return input.flatMap((outcome, index) => {
    if (!outcome || typeof outcome !== "object") return [];
    const candidate = outcome as Partial<Outcome>;
    if (typeof candidate.projectId !== "string" || typeof candidate.workspaceId !== "string") return [];
    if (typeof candidate.title !== "string" || !candidate.title.trim()) return [];
    return [{
      id: typeof candidate.id === "string" ? candidate.id : `outcome-${index + 1}`,
      workspaceId: candidate.workspaceId,
      projectId: candidate.projectId,
      title: candidate.title.trim(),
      type: typeof candidate.type === "string" ? candidate.type.trim() : "",
      notes: typeof candidate.notes === "string" ? candidate.notes : "",
      agentEligible: Boolean(candidate.agentEligible),
      done: Boolean(candidate.done)
    }];
  });
}

function normalizeBursts(input: unknown): Burst[] {
  if (!Array.isArray(input)) return [];
  return input.flatMap((burst, index) => {
    if (!burst || typeof burst !== "object") return [];
    const candidate = burst as Partial<Burst>;
    if (typeof candidate.projectId !== "string" || typeof candidate.workspaceId !== "string") return [];
    if (typeof candidate.title !== "string" || !candidate.title.trim()) return [];
    return [{
      id: typeof candidate.id === "string" ? candidate.id : `burst-${index + 1}`,
      workspaceId: candidate.workspaceId,
      projectId: candidate.projectId,
      outcomeId: typeof candidate.outcomeId === "string" ? candidate.outcomeId : null,
      title: candidate.title.trim(),
      type: typeof candidate.type === "string" ? candidate.type.trim() : "",
      notes: typeof candidate.notes === "string" ? candidate.notes : "",
      agentEligible: Boolean(candidate.agentEligible),
      lastDurationSeconds: typeof candidate.lastDurationSeconds === "number" ? candidate.lastDurationSeconds : null,
      loggedAt: typeof candidate.loggedAt === "number" ? candidate.loggedAt : 0,
      source: candidate.source === "recent" ? "recent" : "task"
    }];
  });
}

function normalizeWorkspace(workspace: Workspace, projects: Project[]): Workspace {
  const workspaceProjects = projects.filter((project) => project.workspaceId === workspace.id);
  if (!workspaceProjects.length) {
    const fallbackProjectId = `${workspace.id}-project-1`;
    return {
      ...workspace,
      activeProjectId: fallbackProjectId,
      visibleProjectIds: [fallbackProjectId]
    };
  }

  const validIds = workspaceProjects.map((project) => project.id);
  const activeProjectId = validIds.includes(workspace.activeProjectId) ? workspace.activeProjectId : validIds[0];
  const visibleProjectIds = ensureVisibleProjectIds({
    ...workspace,
    activeProjectId,
    visibleProjectIds: workspace.visibleProjectIds
  }, workspaceProjects);

  return { ...workspace, activeProjectId, visibleProjectIds };
}

function ensureVisibleProjectIds(workspace: Workspace, projects: Project[]): string[] {
  const validIds = projects.map((project) => project.id);
  const requiredCount = Math.min(2, validIds.length);
  const visible = workspace.visibleProjectIds.filter((id) => validIds.includes(id)).slice(0, 2);

  for (const projectId of validIds) {
    if (visible.length >= requiredCount) break;
    if (!visible.includes(projectId)) visible.push(projectId);
  }

  if (workspace.activeProjectId && validIds.includes(workspace.activeProjectId) && !visible.includes(workspace.activeProjectId)) {
    visible[visible.length > 1 ? 1 : 0] = workspace.activeProjectId;
  }

  return visible.slice(0, requiredCount);
}

function outcomeToTask(outcome: Outcome): Task {
  return {
    id: outcome.id,
    text: outcome.title,
    type: outcome.type,
    notes: outcome.notes,
    agentEligible: outcome.agentEligible,
    done: outcome.done
  };
}

function normalizeRecentTaskSlots(input: unknown): RecentTaskSlot[] {
  const cutoff = Date.now() - RECENT_TASK_SLOT_WINDOW_MS;
  if (!Array.isArray(input)) return [];
  return input.flatMap((slot, index) => {
    if (!slot || typeof slot !== "object") return [];
    const candidate = slot as Partial<RecentTaskSlot>;
    if (typeof candidate.taskText !== "string" || !candidate.taskText.trim()) return [];
    if (typeof candidate.workspaceId !== "string" || typeof candidate.projectId !== "string") return [];
    if (typeof candidate.workspaceName !== "string" || typeof candidate.projectName !== "string") return [];
    if (typeof candidate.loggedAt !== "number" || candidate.loggedAt < cutoff) return [];
    return [{
      id: typeof candidate.id === "string" ? candidate.id : `recent-task-slot-${index}-${candidate.loggedAt}`,
      taskId: typeof candidate.taskId === "string" ? candidate.taskId : null,
      taskText: candidate.taskText.trim(),
      taskType: typeof candidate.taskType === "string" ? candidate.taskType.trim() : "",
      taskNotes: typeof candidate.taskNotes === "string" ? candidate.taskNotes : "",
      agentEligible: Boolean(candidate.agentEligible),
      workspaceId: candidate.workspaceId,
      workspaceName: candidate.workspaceName.trim(),
      projectId: candidate.projectId,
      projectName: candidate.projectName.trim(),
      lastDurationSeconds: typeof candidate.lastDurationSeconds === "number" && candidate.lastDurationSeconds >= 0 ? candidate.lastDurationSeconds : null,
      loggedAt: candidate.loggedAt
    }];
  });
}

function getDefaultActiveOutcomeId(state: AppState, projectId: string | null, currentOutcomeId: string | null): string | null {
  if (!projectId) return null;
  const projectOutcomes = getOutcomesForProjectId(state, projectId);
  if (currentOutcomeId && projectOutcomes.some((outcome) => outcome.id === currentOutcomeId)) {
    return currentOutcomeId;
  }
  return projectOutcomes.find((outcome) => !outcome.done)?.id || projectOutcomes[0]?.id || null;
}

function setActiveProjectOnWorkspace(state: AppState, workspaceId: string, projectId: string): Workspace[] {
  return state.workspaces.map((workspace) => {
    if (workspace.id !== workspaceId) return workspace;
    const workspaceProjects = getProjectsForWorkspaceId(state, workspace.id);
    const previousActiveId = workspace.activeProjectId;
    const visible = workspace.visibleProjectIds
      .filter((id) => workspaceProjects.some((project) => project.id === id))
      .slice(0, 2);

    if (visible.includes(projectId)) {
      return {
        ...workspace,
        activeProjectId: projectId,
        visibleProjectIds: ensureVisibleProjectIds({ ...workspace, activeProjectId: projectId }, workspaceProjects)
      };
    }

    if (visible.length < Math.min(2, workspaceProjects.length)) {
      visible.push(projectId);
      return {
        ...workspace,
        activeProjectId: projectId,
        visibleProjectIds: ensureVisibleProjectIds({ ...workspace, activeProjectId: projectId, visibleProjectIds: visible }, workspaceProjects)
      };
    }

    const replacementIndex = visible.findIndex((id) => id !== previousActiveId);
    visible[replacementIndex >= 0 ? replacementIndex : 0] = projectId;
    return {
      ...workspace,
      activeProjectId: projectId,
      visibleProjectIds: ensureVisibleProjectIds({ ...workspace, activeProjectId: projectId, visibleProjectIds: visible }, workspaceProjects)
    };
  });
}

function withStatus(state: AppState, status: string): AppState {
  return { ...state, status };
}

function deriveOutcomeTitle(value: string): string {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return "Outcome";
  const delimiterMatch = trimmed.match(/^(.+?)(?:\s[-:\/|>]+\s)(.+)$/);
  if (delimiterMatch?.[1]?.trim()) return delimiterMatch[1].trim();
  return trimmed;
}

function buildOutcomeKey(workspaceId: string, projectId: string, outcomeTitle: string): string {
  return `${workspaceId}::${projectId}::${outcomeTitle.trim().toLowerCase()}`;
}

function mergeRecentBurstId(state: AppState, nextBurstId: string): string[] {
  const nextBurst = state.bursts.find((burst) => burst.id === nextBurstId) || null;
  if (!nextBurst) return state.recentBurstIds;
  const cutoff = Date.now() - RECENT_TASK_SLOT_WINDOW_MS;
  const remaining = state.recentBurstIds.filter((burstId) => {
    const burst = state.bursts.find((entry) => entry.id === burstId);
    return Boolean(burst && burst.loggedAt >= cutoff && burst.title.trim().toLowerCase() !== nextBurst.title.trim().toLowerCase());
  });
  return [nextBurstId, ...remaining];
}

function upsertBurst(bursts: Burst[], nextBurst: Burst): Burst[] {
  const existingIndex = bursts.findIndex((burst) => burst.id === nextBurst.id);
  if (existingIndex === -1) return [nextBurst, ...bursts];
  return bursts.map((burst) => burst.id === nextBurst.id ? nextBurst : burst);
}

function buildRecentBurstFromState(state: AppState, loggedAt: number): Burst | null {
  const workspace = getActiveWorkspace(state);
  const project = getActiveProject(state);
  const outcome = state.outcomes.find((entry) => entry.id === state.activeOutcomeId) || null;
  if (!workspace || !project || !outcome) return null;
  return {
    id: `burst-recent-${loggedAt}`,
    workspaceId: workspace.id,
    projectId: project.id,
    outcomeId: outcome.id,
    title: outcome.title,
    type: outcome.type,
    notes: outcome.notes,
    agentEligible: outcome.agentEligible,
    lastDurationSeconds: null,
    loggedAt,
    source: "recent"
  };
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "hydrate-state": {
      const nextState = normalizeState(action.state);
      return action.status ? { ...nextState, status: action.status } : nextState;
    }
    case "toggle-workspace-menu":
      return { ...state, isWorkspaceMenuOpen: !state.isWorkspaceMenuOpen, isProjectMenuOpen: false };
    case "toggle-project-menu":
      return { ...state, isProjectMenuOpen: !state.isProjectMenuOpen, isWorkspaceMenuOpen: false };
    case "close-menus":
      return { ...state, isWorkspaceMenuOpen: false, isProjectMenuOpen: false };
    case "set-status":
      return withStatus(state, action.status);
    case "select-task":
      return { ...state, activeOutcomeId: action.taskId, status: "Task selected for the next session." };
    case "select-workspace": {
      const workspace = state.workspaces.find((entry) => entry.id === action.workspaceId) || null;
      const activeOutcomeId = getDefaultActiveOutcomeId(state, workspace?.activeProjectId || null, null);
      return normalizeState({
        ...state,
        activeWorkspaceId: action.workspaceId,
        activeOutcomeId,
        isWorkspaceMenuOpen: false,
        isProjectMenuOpen: false,
        status: "Workspace selected."
      });
    }
    case "create-workspace": {
      const nextNumber = state.workspaces.length + 1;
      const newWorkspaceId = `workspace-${action.now}`;
      const firstProjectId = `${newWorkspaceId}-project-1`;
      return normalizeState({
        ...state,
        workspaces: [...state.workspaces, { id: newWorkspaceId, name: `Workspace ${nextNumber}`, activeProjectId: firstProjectId, visibleProjectIds: [firstProjectId] }],
        projects: [...state.projects, { id: firstProjectId, workspaceId: newWorkspaceId, name: "Project 1" }],
        activeWorkspaceId: newWorkspaceId,
        activeOutcomeId: null,
        status: `Workspace ${nextNumber} created.`
      });
    }
    case "rename-workspace":
      return normalizeState({
        ...state,
        workspaces: state.workspaces.map((workspace) => workspace.id === action.workspaceId ? { ...workspace, name: action.name } : workspace),
        status: "Workspace renamed."
      });
    case "delete-workspace": {
      if (state.workspaces.length === 1) return withStatus(state, "You need at least one workspace.");
      const nextWorkspaces = state.workspaces.filter((workspace) => workspace.id !== action.workspaceId);
      const nextProjects = state.projects.filter((project) => project.workspaceId !== action.workspaceId);
      const nextOutcomes = state.outcomes.filter((outcome) => outcome.workspaceId !== action.workspaceId);
      const nextBursts = state.bursts.filter((burst) => burst.workspaceId !== action.workspaceId);
      const nextWorkspaceId = state.activeWorkspaceId === action.workspaceId ? nextWorkspaces[0].id : state.activeWorkspaceId;
      return normalizeState({
        ...state,
        workspaces: nextWorkspaces,
        projects: nextProjects,
        outcomes: nextOutcomes,
        bursts: nextBursts,
        recentBurstIds: state.recentBurstIds.filter((burstId) => nextBursts.some((burst) => burst.id === burstId)),
        activeWorkspaceId: nextWorkspaceId,
        activeOutcomeId: state.activeWorkspaceId === action.workspaceId ? null : state.activeOutcomeId,
        status: "Workspace deleted."
      });
    }
    case "select-project": {
      const workspaces = setActiveProjectOnWorkspace(state, state.activeWorkspaceId, action.projectId);
      return normalizeState({
        ...state,
        workspaces,
        activeOutcomeId: getDefaultActiveOutcomeId({ ...state, workspaces }, action.projectId, null),
        isProjectMenuOpen: false,
        status: "Project selected."
      });
    }
    case "create-project": {
      const workspace = getActiveWorkspace(state);
      if (!workspace) return state;
      const projectId = `${workspace.id}-project-${action.now}`;
      const nextProjects = [...state.projects, { id: projectId, workspaceId: workspace.id, name: `Project ${getProjectsForWorkspaceId(state, workspace.id).length + 1}` }];
      const nextState = {
        ...state,
        projects: nextProjects,
        workspaces: state.workspaces.map((entry) => entry.id === workspace.id ? { ...entry, activeProjectId: projectId, visibleProjectIds: [...entry.visibleProjectIds, projectId].slice(-2) } : entry),
        activeOutcomeId: null,
        isProjectMenuOpen: false,
        status: `Project ${getProjectsForWorkspaceId(state, workspace.id).length + 1} created.`
      };
      return normalizeState(nextState);
    }
    case "rename-project":
      return normalizeState({
        ...state,
        projects: state.projects.map((project) => project.id === action.projectId ? { ...project, name: action.name } : project),
        status: "Project renamed."
      });
    case "delete-project": {
      const workspace = getActiveWorkspace(state);
      if (!workspace) return state;
      const workspaceProjects = getProjectsForWorkspaceId(state, workspace.id);
      if (workspaceProjects.length === 1) return withStatus(state, "You need at least one project.");
      const remainingProjects = state.projects.filter((project) => project.id !== action.projectId);
      const remainingOutcomes = state.outcomes.filter((outcome) => outcome.projectId !== action.projectId);
      const remainingBursts = state.bursts.filter((burst) => burst.projectId !== action.projectId);
      const nextWorkspace = state.workspaces.map((entry) => {
        if (entry.id !== workspace.id) return entry;
        const nextProjectIds = remainingProjects.filter((project) => project.workspaceId === workspace.id).map((project) => project.id);
        const activeProjectId = entry.activeProjectId === action.projectId ? nextProjectIds[0] : entry.activeProjectId;
        return normalizeWorkspace({
          ...entry,
          activeProjectId,
          visibleProjectIds: entry.visibleProjectIds.filter((id) => id !== action.projectId)
        }, remainingProjects.filter((project) => project.workspaceId === workspace.id));
      });
      return normalizeState({
        ...state,
        workspaces: nextWorkspace,
        projects: remainingProjects,
        outcomes: remainingOutcomes,
        bursts: remainingBursts,
        recentBurstIds: state.recentBurstIds.filter((burstId) => remainingBursts.some((burst) => burst.id === burstId)),
        activeOutcomeId: null,
        status: "Project deleted."
      });
    }
    case "set-timer-target":
      return { ...state, targetSeconds: action.targetSeconds, elapsedSeconds: Math.min(state.elapsedSeconds, action.targetSeconds), status: `Timer target set to ${Math.floor(action.targetSeconds / 60).toString().padStart(2, "0")}:${(action.targetSeconds % 60).toString().padStart(2, "0")}.` };
    case "start-timer":
      return { ...state, elapsedSeconds: state.elapsedSeconds >= state.targetSeconds ? 0 : state.elapsedSeconds, isRunning: true, lastTickAt: action.now, status: `Timer started toward ${Math.floor(state.targetSeconds / 60).toString().padStart(2, "0")}:${(state.targetSeconds % 60).toString().padStart(2, "0")}.` };
    case "pause-timer":
      return { ...state, isRunning: false, lastTickAt: null, status: "Timer paused." };
    case "reset-timer":
      return { ...state, isRunning: false, elapsedSeconds: 0, lastTickAt: null, status: "Timer reset to 00:00." };
    case "tick": {
      if (!state.isRunning || !state.lastTickAt) return state;
      const elapsedSinceLastTick = Math.floor((action.now - state.lastTickAt) / 1000);
      if (elapsedSinceLastTick <= 0) return state;
      const nextElapsed = state.elapsedSeconds + elapsedSinceLastTick;
      if (nextElapsed >= state.targetSeconds) {
        const recentBurst = buildRecentBurstFromState(state, action.now);
        return normalizeState({
          ...state,
          elapsedSeconds: state.targetSeconds,
          isRunning: false,
          lastTickAt: null,
          completedSessions: state.completedSessions + 1,
          bursts: recentBurst ? upsertBurst(state.bursts, recentBurst) : state.bursts,
          recentBurstIds: recentBurst ? [recentBurst.id, ...state.recentBurstIds.filter((id) => id !== recentBurst.id)] : state.recentBurstIds,
          status: "Session complete. Nice work."
        });
      }
      return { ...state, elapsedSeconds: nextElapsed, lastTickAt: state.lastTickAt + elapsedSinceLastTick * 1000 };
    }
    case "open-task-form":
      return { ...state, isTaskFormOpen: true, editingOutcomeId: null };
    case "close-task-form":
      return { ...state, isTaskFormOpen: false, editingOutcomeId: null };
    case "edit-task":
      return { ...state, editingOutcomeId: action.taskId, isTaskFormOpen: true, status: "Editing task." };
    case "save-task": {
      const project = getActiveProject(state);
      const workspace = getActiveWorkspace(state);
      if (!project || !workspace) return state;
      const customType = action.customType.trim().toLowerCase();
      const nextCustomTypes = customType && !state.customTaskTypes.includes(customType) ? [...state.customTaskTypes, customType].sort() : state.customTaskTypes;
      const outcomeId = state.editingOutcomeId || `outcome-${action.now}`;
      const nextOutcomes = state.editingOutcomeId
        ? state.outcomes.map((outcome) => outcome.id === state.editingOutcomeId ? { ...outcome, title: action.draft.text, type: action.draft.type, notes: action.draft.notes, agentEligible: action.draft.agentEligible } : outcome)
        : [...state.outcomes, { id: outcomeId, workspaceId: workspace.id, projectId: project.id, title: action.draft.text, type: action.draft.type, notes: action.draft.notes, agentEligible: action.draft.agentEligible, done: false }];
      const nextBursts = state.editingOutcomeId
        ? state.bursts.map((burst) => burst.outcomeId === state.editingOutcomeId && burst.source === "task" ? { ...burst, title: action.draft.text, type: action.draft.type, notes: action.draft.notes, agentEligible: action.draft.agentEligible } : burst)
        : [...state.bursts, { id: `burst-task-${outcomeId}`, workspaceId: workspace.id, projectId: project.id, outcomeId, title: action.draft.text, type: action.draft.type, notes: action.draft.notes, agentEligible: action.draft.agentEligible, lastDurationSeconds: null, loggedAt: 0, source: "task" }];
      return normalizeState({
        ...state,
        outcomes: nextOutcomes,
        bursts: nextBursts,
        activeOutcomeId: outcomeId,
        customTaskTypes: nextCustomTypes,
        isTaskFormOpen: false,
        editingOutcomeId: null,
        status: state.editingOutcomeId ? "Task updated." : "Task added."
      });
    }
    case "toggle-task":
      return normalizeState({
        ...state,
        outcomes: state.outcomes.map((outcome) => outcome.id === action.taskId ? { ...outcome, done: !outcome.done } : outcome),
        status: state.outcomes.find((outcome) => outcome.id === action.taskId)?.done ? "Task marked active." : "Task completed."
      });
    case "delete-task": {
      const deletedActive = state.activeOutcomeId === action.taskId;
      const nextOutcomes = state.outcomes.filter((outcome) => outcome.id !== action.taskId);
      const nextBursts = state.bursts.filter((burst) => burst.outcomeId !== action.taskId || burst.source === "recent");
      return normalizeState({
        ...state,
        outcomes: nextOutcomes,
        bursts: nextBursts,
        activeOutcomeId: deletedActive ? null : state.activeOutcomeId,
        isRunning: deletedActive ? false : state.isRunning,
        elapsedSeconds: deletedActive ? 0 : state.elapsedSeconds,
        lastTickAt: deletedActive ? null : state.lastTickAt,
        status: deletedActive ? "Task deleted and timer reset." : "Task deleted."
      });
    }
    case "clear-completed": {
      const project = getActiveProject(state);
      if (!project) return state;
      const remaining = state.outcomes.filter((outcome) => outcome.projectId !== project.id || !outcome.done);
      return normalizeState({
        ...state,
        outcomes: remaining,
        bursts: state.bursts.filter((burst) => burst.projectId !== project.id || burst.source !== "task" || remaining.some((outcome) => outcome.id === burst.outcomeId)),
        activeOutcomeId: getDefaultActiveOutcomeId({ ...state, outcomes: remaining }, project.id, state.activeOutcomeId),
        status: "Completed tasks cleared."
      });
    }
    case "log-manual-entry": {
      const burst: Burst = {
        id: action.slot.id,
        workspaceId: action.slot.workspaceId,
        projectId: action.slot.projectId,
        outcomeId: action.slot.taskId,
        title: action.slot.taskText,
        type: action.slot.taskType,
        notes: action.slot.taskNotes,
        agentEligible: action.slot.agentEligible,
        lastDurationSeconds: action.durationSeconds,
        loggedAt: action.slot.loggedAt,
        source: "recent"
      };
      return normalizeState({
        ...state,
        bursts: upsertBurst(state.bursts, burst),
        recentBurstIds: [burst.id, ...state.recentBurstIds.filter((id) => id !== burst.id)],
        status: `Logged ${formatManualDuration(action.durationSeconds)} for ${action.slot.taskText}.`
      });
    }
    case "clear-recent-task-slots":
      return normalizeState({
        ...state,
        recentBurstIds: [],
        bursts: state.bursts.filter((burst) => burst.source !== "recent"),
        status: "Recent task slots cleared."
      });
    case "restore-recent-task": {
      const burst = state.bursts.find((entry) => entry.id === action.slot.id) || null;
      const workspace = state.workspaces.find((entry) => entry.id === action.slot.workspaceId) || null;
      const project = state.projects.find((entry) => entry.id === action.slot.projectId) || null;
      if (!workspace || !project || !burst) return withStatus(state, "The original workspace or project is no longer available.");
      const outcomeId = burst.outcomeId || `outcome-${action.now}`;
      const hasOutcome = state.outcomes.some((outcome) => outcome.id === outcomeId);
      return normalizeState({
        ...state,
        workspaces: setActiveProjectOnWorkspace(state, workspace.id, project.id),
        activeWorkspaceId: workspace.id,
        activeOutcomeId: outcomeId,
        outcomes: hasOutcome ? state.outcomes : [...state.outcomes, { id: outcomeId, workspaceId: workspace.id, projectId: project.id, title: burst.title, type: burst.type, notes: burst.notes, agentEligible: burst.agentEligible, done: false }],
        bursts: state.bursts.map((entry) => entry.id === burst.id ? { ...entry, outcomeId } : entry),
        status: "Task restored from recent activity."
      });
    }
    default:
      return state;
  }
}
