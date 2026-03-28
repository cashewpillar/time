import type {
  AppState,
  PersistedProject,
  PersistedState,
  RecentTaskSlot,
  PersistedTask,
  PersistedWorkspace,
  Project,
  Task,
  TaskDraft,
  Workspace
} from "../types/app";
import { formatManualDuration } from "../lib/time";

export const STORAGE_KEY = "workspace-two-state-v2";
export const DEFAULT_TARGET_SECONDS = 20 * 60;
export const DEFAULT_TASK_TYPES = ["development", "design", "product"] as const;
export const RECENT_TASK_SLOT_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

export type AppAction =
  | { type: "hydrate-state"; state: PersistedState; status?: string }
  | {
      type: "import-notion-options";
      taskTypes: string[];
      workspaces: Array<{
        name: string;
        projects: Array<{
          name: string;
          tasks: Array<{
            entry: string;
            taskType: string;
            notes: string;
            aiWorkflow: boolean;
          }>;
        }>;
      }>;
    }
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
  | { type: "log-manual-entry"; slot: RecentTaskSlot; durationSeconds: number }
  | { type: "set-status"; status: string };

export function defaultState(): AppState {
  return {
    activeWorkspaceId: "workspace-2",
    elapsedSeconds: 0,
    targetSeconds: DEFAULT_TARGET_SECONDS,
    isRunning: false,
    completedSessions: 0,
    lastTickAt: null,
    activeTaskId: null,
    isTaskFormOpen: false,
    editingTaskId: null,
    isWorkspaceMenuOpen: false,
    isProjectMenuOpen: false,
    customTaskTypes: [],
    recentTaskSlots: [],
    status: "Projects, workspaces, and timer progress are saved on this device.",
    workspaces: [
      {
        id: "workspace-1",
        name: "Workspace 1",
        activeProjectId: "workspace-1-project-1",
        visibleProjectIds: ["workspace-1-project-1", "workspace-1-project-2"],
        projects: [
          { id: "workspace-1-project-1", name: "Project 1", tasks: [] },
          { id: "workspace-1-project-2", name: "Project 2", tasks: [] }
        ]
      },
      {
        id: "workspace-2",
        name: "Workspace 2",
        activeProjectId: "workspace-2-project-2",
        visibleProjectIds: ["workspace-2-project-1", "workspace-2-project-2"],
        projects: [
          { id: "workspace-2-project-1", name: "Project 1", tasks: [] },
          { id: "workspace-2-project-2", name: "Project 2", tasks: [] },
          { id: "workspace-2-project-3", name: "Project 3", tasks: [] }
        ]
      }
    ]
  };
}

export function getActiveWorkspace(state: AppState): Workspace | null {
  return state.workspaces.find((workspace) => workspace.id === state.activeWorkspaceId) || null;
}

export function getActiveProject(state: AppState): Project | null {
  const workspace = getActiveWorkspace(state);
  return workspace?.projects.find((project) => project.id === workspace.activeProjectId) || null;
}

export function getEditingTask(state: AppState): Task | null {
  const project = getActiveProject(state);
  return project?.tasks.find((task) => task.id === state.editingTaskId) || null;
}

export function getSelectedTask(state: AppState): Task | null {
  const project = getActiveProject(state);
  return project?.tasks.find((task) => task.id === state.activeTaskId) || null;
}

export function getVisibleProjects(workspace: Workspace | null): Project[] {
  if (!workspace) return [];
  return workspace.visibleProjectIds
    .map((projectId) => workspace.projects.find((project) => project.id === projectId) || null)
    .filter((project): project is Project => Boolean(project));
}

export function getTaskTypeOptions(customTaskTypes: string[]): string[] {
  return Array.from(new Set([...DEFAULT_TASK_TYPES, ...customTaskTypes]));
}

export function normalizeState(input?: PersistedState): AppState {
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
    activeTaskId: typeof input?.activeTaskId === "string" ? input.activeTaskId : base.activeTaskId,
    isTaskFormOpen: typeof input?.isTaskFormOpen === "boolean" ? input.isTaskFormOpen : base.isTaskFormOpen,
    editingTaskId: typeof input?.editingTaskId === "string" ? input.editingTaskId : base.editingTaskId,
    isWorkspaceMenuOpen: typeof input?.isWorkspaceMenuOpen === "boolean" ? input.isWorkspaceMenuOpen : base.isWorkspaceMenuOpen,
    isProjectMenuOpen: typeof input?.isProjectMenuOpen === "boolean" ? input.isProjectMenuOpen : base.isProjectMenuOpen,
    status: typeof input?.status === "string" ? input.status : base.status,
    customTaskTypes: Array.isArray(input?.customTaskTypes)
      ? input.customTaskTypes
          .filter((type): type is string => typeof type === "string" && type.trim().length > 0)
          .map((type) => type.trim().toLowerCase())
      : base.customTaskTypes,
    recentTaskSlots: normalizeRecentTaskSlots(input?.recentTaskSlots),
    workspaces: base.workspaces
  };

  next.workspaces = Array.isArray(input?.workspaces) && input.workspaces.length
    ? input.workspaces.map((workspace, workspaceIndex) => {
        const candidate = workspace as PersistedWorkspace;
        return {
          id: typeof candidate.id === "string" ? candidate.id : `workspace-${workspaceIndex + 1}`,
          name: typeof candidate.name === "string" && candidate.name.trim()
            ? candidate.name
            : `Workspace ${workspaceIndex + 1}`,
          activeProjectId: typeof candidate.activeProjectId === "string" ? candidate.activeProjectId : "",
          visibleProjectIds: Array.isArray(candidate.visibleProjectIds)
            ? candidate.visibleProjectIds.filter((id): id is string => typeof id === "string")
            : [],
          projects: Array.isArray(candidate.projects) && candidate.projects.length
            ? candidate.projects.map((project, projectIndex) => normalizeProject(project as PersistedProject, workspaceIndex, projectIndex))
            : [{ id: `project-${workspaceIndex + 1}-1`, name: "Project 1", tasks: [] }]
        };
      })
    : base.workspaces;

  if (!next.workspaces.length) {
    next.workspaces = defaultState().workspaces;
  }

  if (!next.workspaces.find((workspace) => workspace.id === next.activeWorkspaceId)) {
    next.activeWorkspaceId = next.workspaces[0].id;
  }

  next.workspaces = next.workspaces.map((workspace) => normalizeWorkspace(workspace));
  next.activeTaskId = getDefaultActiveTaskId(getActiveProject(next), next.activeTaskId);

  if (next.isRunning && next.lastTickAt) {
    const now = Date.now();
    const elapsedSinceLastTick = Math.floor((now - next.lastTickAt) / 1000);
    if (elapsedSinceLastTick > 0) {
      next.elapsedSeconds = Math.min(next.targetSeconds, next.elapsedSeconds + elapsedSinceLastTick);
      next.lastTickAt += elapsedSinceLastTick * 1000;
    }
  }

  if (next.elapsedSeconds >= next.targetSeconds && next.isRunning) {
    next.elapsedSeconds = next.targetSeconds;
    next.isRunning = false;
    next.lastTickAt = null;
    next.completedSessions += 1;
    next.recentTaskSlots = mergeRecentTaskSlot(
      next.recentTaskSlots,
      buildRecentTaskSlotFromState(next, Date.now())
    );
    next.status = "Session complete. Nice work.";
  }

  return next;
}

function normalizeProject(project: PersistedProject, workspaceIndex: number, projectIndex: number): Project {
  return {
    id: typeof project.id === "string" ? project.id : `project-${workspaceIndex + 1}-${projectIndex + 1}`,
    name: typeof project.name === "string" && project.name.trim()
      ? project.name
      : `Project ${projectIndex + 1}`,
    tasks: Array.isArray(project.tasks)
      ? project.tasks.flatMap((task, taskIndex) => normalizeTask(task as PersistedTask | null, workspaceIndex, projectIndex, taskIndex))
      : []
  };
}

function normalizeTask(task: PersistedTask | null, workspaceIndex: number, projectIndex: number, taskIndex: number): Task[] {
  if (!task || typeof task.text !== "string") {
    return [];
  }

  return [{
    id: typeof task.id === "string" ? task.id : `task-${workspaceIndex}-${projectIndex}-${taskIndex}-${Date.now()}`,
    text: task.text,
    type: typeof task.type === "string" ? task.type : "",
    notes: typeof task.notes === "string" ? task.notes : "",
    agentEligible: Boolean(task.agentEligible),
    done: Boolean(task.done)
  }];
}

function normalizeWorkspace(workspace: Workspace): Workspace {
  const next: Workspace = { ...workspace };

  if (!Array.isArray(next.projects) || !next.projects.length) {
    next.projects = [{ id: `${next.id}-project-1`, name: "Project 1", tasks: [] }];
  }

  if (!next.projects.find((project) => project.id === next.activeProjectId)) {
    next.activeProjectId = next.projects[0].id;
  }

  next.visibleProjectIds = ensureVisibleProjectIds(next);
  return next;
}

function getDefaultActiveTaskId(project: Project | null, currentTaskId: string | null): string | null {
  if (!project) return null;
  if (currentTaskId && project.tasks.some((task) => task.id === currentTaskId)) {
    return currentTaskId;
  }

  return project.tasks.find((task) => !task.done)?.id || project.tasks[0]?.id || null;
}

function ensureVisibleProjectIds(workspace: Workspace): string[] {
  const validIds = workspace.projects.map((project) => project.id);
  const requiredCount = Math.min(2, validIds.length);
  const visible = (Array.isArray(workspace.visibleProjectIds) ? workspace.visibleProjectIds : [])
    .filter((id) => validIds.includes(id))
    .slice(0, 2);

  for (const projectId of validIds) {
    if (visible.length >= requiredCount) break;
    if (!visible.includes(projectId)) {
      visible.push(projectId);
    }
  }

  if (workspace.activeProjectId && validIds.includes(workspace.activeProjectId) && !visible.includes(workspace.activeProjectId)) {
    if (requiredCount <= 1 || visible.length <= 1) {
      visible[0] = workspace.activeProjectId;
    } else {
      visible[1] = workspace.activeProjectId;
    }
  }

  return visible.slice(0, requiredCount);
}

function cloneWorkspace(workspace: Workspace): Workspace {
  return {
    ...workspace,
    visibleProjectIds: [...workspace.visibleProjectIds],
    projects: workspace.projects.map((project) => ({
      ...project,
      tasks: project.tasks.map((task) => ({ ...task }))
    }))
  };
}

function normalizeRecentTaskSlots(input: unknown): RecentTaskSlot[] {
  const cutoff = Date.now() - RECENT_TASK_SLOT_WINDOW_MS;
  if (!Array.isArray(input)) return [];

  return input
    .flatMap((slot, index) => {
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
        lastDurationSeconds: typeof candidate.lastDurationSeconds === "number" && candidate.lastDurationSeconds >= 0
          ? candidate.lastDurationSeconds
          : null,
        loggedAt: candidate.loggedAt
      }];
    })
    .sort((left, right) => right.loggedAt - left.loggedAt)
    .reduce<RecentTaskSlot[]>((slots, slot) => mergeRecentTaskSlot(slots, slot), []);
}

function isSameRecentTaskSlot(left: RecentTaskSlot, right: RecentTaskSlot): boolean {
  return left.taskText === right.taskText
    && left.taskType === right.taskType
    && left.taskNotes === right.taskNotes
    && left.agentEligible === right.agentEligible
    && left.workspaceId === right.workspaceId
    && left.projectId === right.projectId
    && left.lastDurationSeconds === right.lastDurationSeconds;
}

function mergeRecentTaskSlot(slots: RecentTaskSlot[], nextSlot: RecentTaskSlot | null): RecentTaskSlot[] {
  if (!nextSlot) return slots;

  const cutoff = Date.now() - RECENT_TASK_SLOT_WINDOW_MS;
  const remaining = slots.filter((slot) => slot.loggedAt >= cutoff && !isSameRecentTaskSlot(slot, nextSlot));
  return [nextSlot, ...remaining].sort((left, right) => right.loggedAt - left.loggedAt);
}

function buildRecentTaskSlot(task: Task, workspace: Workspace, project: Project, loggedAt: number): RecentTaskSlot {
  return {
    id: `recent-task-slot-${loggedAt}`,
    taskId: task.id,
    taskText: task.text.trim(),
    taskType: task.type.trim(),
    taskNotes: task.notes,
    agentEligible: task.agentEligible,
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    projectId: project.id,
    projectName: project.name,
    lastDurationSeconds: null,
    loggedAt
  };
}

function buildRecentTaskSlotFromState(state: AppState, loggedAt: number): RecentTaskSlot | null {
  const workspace = getActiveWorkspace(state);
  const project = getActiveProject(state);
  const task = getSelectedTask(state);
  if (!workspace || !project || !task) return null;
  return buildRecentTaskSlot(task, workspace, project, loggedAt);
}

function setActiveProjectOnWorkspace(workspace: Workspace, projectId: string): Workspace {
  const nextWorkspace = cloneWorkspace(workspace);
  const previousActiveId = nextWorkspace.activeProjectId;
  nextWorkspace.activeProjectId = projectId;

  const visible = nextWorkspace.visibleProjectIds
    .filter((id) => nextWorkspace.projects.some((project) => project.id === id))
    .slice(0, 2);

  if (visible.includes(projectId)) {
    nextWorkspace.visibleProjectIds = ensureVisibleProjectIds(nextWorkspace);
    return nextWorkspace;
  }

  if (visible.length < Math.min(2, nextWorkspace.projects.length)) {
    visible.push(projectId);
    nextWorkspace.visibleProjectIds = ensureVisibleProjectIds({
      ...nextWorkspace,
      visibleProjectIds: visible
    });
    return nextWorkspace;
  }

  const replacementIndex = visible.findIndex((id) => id !== previousActiveId);
  visible[replacementIndex >= 0 ? replacementIndex : 0] = projectId;
  nextWorkspace.visibleProjectIds = ensureVisibleProjectIds({
    ...nextWorkspace,
    visibleProjectIds: visible
  });
  return nextWorkspace;
}

function updateActiveWorkspace(state: AppState, updater: (workspace: Workspace) => Workspace): Workspace[] {
  return state.workspaces.map((workspace) =>
    workspace.id === state.activeWorkspaceId ? updater(workspace) : workspace
  );
}

function withStatus(state: AppState, status: string): AppState {
  return { ...state, status };
}

function toStableId(prefix: string, value: string, fallbackIndex: number): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return `${prefix}-${slug || fallbackIndex + 1}`;
}

function buildWorkspaceImports(workspaces: Array<{
  name: string;
  projects: Array<{
    name: string;
    tasks: Array<{
      entry: string;
      taskType: string;
      notes: string;
      aiWorkflow: boolean;
    }>;
  }>;
}>): Workspace[] {
  const cleanedWorkspaces = workspaces
    .map((workspace) => ({
      name: workspace.name.trim(),
      projects: workspace.projects
        .map((project) => ({
          name: project.name.trim(),
          tasks: project.tasks.filter((task) => task.entry.trim())
        }))
        .filter((project) => project.name)
    }))
    .filter((workspace) => workspace.name);

  const workspaceSeeds = cleanedWorkspaces.length
    ? cleanedWorkspaces
    : [{ name: "Workspace", projects: [{ name: "Project 1", tasks: [] }] }];

  return workspaceSeeds.map((workspace, workspaceIndex) => {
    const workspaceId = toStableId("workspace", workspace.name, workspaceIndex);
    const workspaceProjects = (workspace.projects.length ? workspace.projects : [{ name: "Project 1", tasks: [] }]).map((project, projectIndex) => {
      const projectId = `${workspaceId}-${toStableId("project", project.name, projectIndex)}`;

      return {
        id: projectId,
        name: project.name,
        tasks: project.tasks.map((task, taskIndex) => ({
          id: `${projectId}-task-${taskIndex + 1}`,
          text: task.entry.trim(),
          type: task.taskType.trim().toLowerCase(),
          notes: task.notes.trim(),
          agentEligible: task.aiWorkflow,
          done: false
        }))
      };
    });

    const activeProjectId = workspaceProjects[0].id;
    return normalizeWorkspace({
      id: workspaceId,
      name: workspace.name,
      activeProjectId,
      visibleProjectIds: workspaceProjects.slice(0, Math.min(2, workspaceProjects.length)).map((project) => project.id),
      projects: workspaceProjects
    });
  });
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "hydrate-state": {
      const nextState = normalizeState(action.state);
      if (action.status) {
        nextState.status = action.status;
      }
      return nextState;
    }
    case "toggle-workspace-menu":
      return {
        ...state,
        isWorkspaceMenuOpen: !state.isWorkspaceMenuOpen,
        isProjectMenuOpen: false
      };
    case "toggle-project-menu":
      return {
        ...state,
        isProjectMenuOpen: !state.isProjectMenuOpen,
        isWorkspaceMenuOpen: false
      };
    case "close-menus":
      if (!state.isWorkspaceMenuOpen && !state.isProjectMenuOpen) {
        return state;
      }
      return {
        ...state,
        isWorkspaceMenuOpen: false,
        isProjectMenuOpen: false
      };
    case "set-status":
      return withStatus(state, action.status);
    case "select-task":
      return {
        ...state,
        activeTaskId: action.taskId,
        status: "Task selected for the next session."
      };
    case "import-notion-options": {
      const normalizedTaskTypes = action.taskTypes
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean);
      const nextWorkspaces = buildWorkspaceImports(action.workspaces);

      return normalizeState({
        ...state,
        workspaces: nextWorkspaces,
        activeWorkspaceId: nextWorkspaces[0]?.id || state.activeWorkspaceId,
        activeTaskId: null,
        customTaskTypes: Array.from(new Set([...state.customTaskTypes, ...normalizedTaskTypes])).sort(),
        isWorkspaceMenuOpen: false,
        isProjectMenuOpen: false,
        status: "Imported workspaces, projects, and task types from recent Notion entries."
      });
    }
    case "select-workspace": {
      const nextWorkspace = state.workspaces.find((workspace) => workspace.id === action.workspaceId) || null;
      const nextProject = nextWorkspace?.projects.find((project) => project.id === nextWorkspace.activeProjectId) || null;
      return normalizeState({
        ...state,
        activeWorkspaceId: action.workspaceId,
        activeTaskId: getDefaultActiveTaskId(nextProject, null),
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
        workspaces: [
          ...state.workspaces,
          {
            id: newWorkspaceId,
            name: `Workspace ${nextNumber}`,
            activeProjectId: firstProjectId,
            visibleProjectIds: [firstProjectId],
            projects: [{ id: firstProjectId, name: "Project 1", tasks: [] }]
          }
        ],
        activeWorkspaceId: newWorkspaceId,
        isWorkspaceMenuOpen: false,
        isProjectMenuOpen: false,
        status: `Workspace ${nextNumber} created.`
      });
    }
    case "rename-workspace":
      return normalizeState({
        ...state,
        workspaces: state.workspaces.map((workspace) =>
          workspace.id === action.workspaceId ? { ...workspace, name: action.name } : workspace
        ),
        status: "Workspace renamed."
      });
    case "delete-workspace": {
      if (state.workspaces.length === 1) {
        return withStatus(state, "You need at least one workspace.");
      }
      const workspace = state.workspaces.find((entry) => entry.id === action.workspaceId);
      const nextWorkspaces = state.workspaces.filter((entry) => entry.id !== action.workspaceId);
      return normalizeState({
        ...state,
        workspaces: nextWorkspaces,
        activeWorkspaceId: state.activeWorkspaceId === action.workspaceId ? nextWorkspaces[0].id : state.activeWorkspaceId,
        activeTaskId: state.activeWorkspaceId === action.workspaceId ? null : state.activeTaskId,
        isWorkspaceMenuOpen: false,
        isProjectMenuOpen: false,
        status: `${workspace?.name || "Workspace"} deleted.`
      });
    }
    case "select-project": {
      const nextWorkspaces = updateActiveWorkspace(state, (workspace) => setActiveProjectOnWorkspace(workspace, action.projectId));
      const nextProject = nextWorkspaces
        .find((workspace) => workspace.id === state.activeWorkspaceId)
        ?.projects.find((project) => project.id === action.projectId) || null;
      return normalizeState({
        ...state,
        workspaces: nextWorkspaces,
        activeTaskId: getDefaultActiveTaskId(nextProject, null),
        isProjectMenuOpen: false,
        status: "Project selected."
      });
    }
    case "create-project": {
      const activeWorkspace = getActiveWorkspace(state);
      if (!activeWorkspace) return state;
      const nextProjectName = `Project ${activeWorkspace.projects.length + 1}`;
      return normalizeState({
        ...state,
        workspaces: updateActiveWorkspace(state, (workspace) => {
          const nextNumber = workspace.projects.length + 1;
          const projectId = `${workspace.id}-project-${action.now}`;
          const newProject: Project = { id: projectId, name: `Project ${nextNumber}`, tasks: [] };
          return setActiveProjectOnWorkspace(
            {
              ...workspace,
              projects: [...workspace.projects, newProject]
            },
            projectId
          );
        }),
        activeTaskId: null,
        isProjectMenuOpen: false,
        status: `${nextProjectName} created.`
      });
    }
    case "rename-project":
      return normalizeState({
        ...state,
        workspaces: updateActiveWorkspace(state, (workspace) => ({
          ...workspace,
          projects: workspace.projects.map((project) =>
            project.id === action.projectId ? { ...project, name: action.name } : project
          )
        })),
        status: "Project renamed."
      });
    case "delete-project": {
      const activeWorkspace = getActiveWorkspace(state);
      if (!activeWorkspace) return state;
      if (activeWorkspace.projects.length === 1) {
        return withStatus(state, "You need at least one project.");
      }
      const project = activeWorkspace.projects.find((entry) => entry.id === action.projectId);
      return normalizeState({
        ...state,
        workspaces: updateActiveWorkspace(state, (workspace) => {
          const remainingProjects = workspace.projects.filter((entry) => entry.id !== action.projectId);
          const nextWorkspace: Workspace = {
            ...workspace,
            projects: remainingProjects,
            visibleProjectIds: workspace.visibleProjectIds.filter((id) => id !== action.projectId)
          };
          if (workspace.activeProjectId === action.projectId) {
            return setActiveProjectOnWorkspace(nextWorkspace, remainingProjects[0].id);
          }
          return normalizeWorkspace(nextWorkspace);
        }),
        activeTaskId: activeWorkspace.activeProjectId === action.projectId ? null : state.activeTaskId,
        isProjectMenuOpen: false,
        status: `${project?.name || "Project"} deleted.`
      });
    }
    case "set-timer-target":
      return {
        ...state,
        targetSeconds: action.targetSeconds,
        elapsedSeconds: Math.min(state.elapsedSeconds, action.targetSeconds),
        status: `Timer target set to ${Math.floor(action.targetSeconds / 60)
          .toString()
          .padStart(2, "0")}:${(action.targetSeconds % 60).toString().padStart(2, "0")}.`
      };
    case "start-timer": {
      const resetElapsed = state.elapsedSeconds >= state.targetSeconds ? 0 : state.elapsedSeconds;
      return {
        ...state,
        elapsedSeconds: resetElapsed,
        isRunning: true,
        lastTickAt: action.now,
        status: `Timer started toward ${Math.floor(state.targetSeconds / 60)
          .toString()
          .padStart(2, "0")}:${(state.targetSeconds % 60).toString().padStart(2, "0")}.`
      };
    }
    case "pause-timer":
      return {
        ...state,
        isRunning: false,
        lastTickAt: null,
        status: "Timer paused."
      };
    case "reset-timer":
      return {
        ...state,
        isRunning: false,
        elapsedSeconds: 0,
        lastTickAt: null,
        status: "Timer reset to 00:00."
      };
    case "tick": {
      if (!state.isRunning) return state;
      if (!state.lastTickAt) {
        return {
          ...state,
          lastTickAt: action.now
        };
      }

      const elapsedSinceLastTick = Math.floor((action.now - state.lastTickAt) / 1000);
      if (elapsedSinceLastTick <= 0) {
        return state;
      }

      const nextElapsed = state.elapsedSeconds + elapsedSinceLastTick;
      if (nextElapsed >= state.targetSeconds) {
        const loggedAt = action.now;
        return {
          ...state,
          elapsedSeconds: state.targetSeconds,
          isRunning: false,
          lastTickAt: null,
          completedSessions: state.completedSessions + 1,
          recentTaskSlots: mergeRecentTaskSlot(state.recentTaskSlots, buildRecentTaskSlotFromState(state, loggedAt)),
          status: "Session complete. Nice work."
        };
      }
      return {
        ...state,
        elapsedSeconds: nextElapsed,
        lastTickAt: state.lastTickAt + elapsedSinceLastTick * 1000
      };
    }
    case "open-task-form":
      return {
        ...state,
        isTaskFormOpen: true,
        editingTaskId: null
      };
    case "close-task-form":
      return {
        ...state,
        isTaskFormOpen: false,
        editingTaskId: null
      };
    case "edit-task":
      return {
        ...state,
        editingTaskId: action.taskId,
        isTaskFormOpen: true,
        status: "Editing task."
      };
    case "save-task": {
      const customType = action.customType.trim().toLowerCase();
      const nextCustomTypes = customType && !state.customTaskTypes.includes(customType)
        ? [...state.customTaskTypes, customType].sort()
        : state.customTaskTypes;
      const nextTaskId = state.editingTaskId || `task-${action.now}`;

      return normalizeState({
        ...state,
        workspaces: updateActiveWorkspace(state, (workspace) => ({
          ...workspace,
          projects: workspace.projects.map((project) => {
            if (project.id !== workspace.activeProjectId) return project;
            if (state.editingTaskId) {
              return {
                ...project,
                tasks: project.tasks.map((task) =>
                  task.id === state.editingTaskId
                    ? {
                        ...task,
                        text: action.draft.text,
                        type: action.draft.type,
                        notes: action.draft.notes,
                        agentEligible: action.draft.agentEligible
                      }
                    : task
                )
              };
            }

            return {
              ...project,
              tasks: [
                ...project.tasks,
                {
                  id: nextTaskId,
                  text: action.draft.text,
                  type: action.draft.type,
                  notes: action.draft.notes,
                  agentEligible: action.draft.agentEligible,
                  done: false
                }
              ]
            };
          })
        })),
        activeTaskId: nextTaskId,
        customTaskTypes: nextCustomTypes,
        isTaskFormOpen: false,
        editingTaskId: null,
        status: state.editingTaskId ? "Task updated." : "Task added."
      });
    }
    case "toggle-task": {
      const task = getActiveProject(state)?.tasks.find((entry) => entry.id === action.taskId);
      return normalizeState({
        ...state,
        workspaces: updateActiveWorkspace(state, (workspace) => ({
          ...workspace,
          projects: workspace.projects.map((project) =>
            project.id === workspace.activeProjectId
              ? {
                  ...project,
                  tasks: project.tasks.map((entry) =>
                    entry.id === action.taskId ? { ...entry, done: !entry.done } : entry
                  )
                }
              : project
          )
        })),
        status: task?.done ? "Task marked active." : "Task completed."
      });
    }
    case "delete-task":
      return normalizeState({
        ...state,
        workspaces: updateActiveWorkspace(state, (workspace) => ({
          ...workspace,
          projects: workspace.projects.map((project) =>
            project.id === workspace.activeProjectId
              ? {
                  ...project,
                  tasks: project.tasks.filter((task) => task.id !== action.taskId)
                }
              : project
          )
        })),
        activeTaskId: state.activeTaskId === action.taskId ? null : state.activeTaskId,
        status: "Task deleted."
      });
    case "clear-completed": {
      const activeProject = getActiveProject(state);
      if (!activeProject) return state;
      const before = activeProject.tasks.length;
      const remainingTasks = activeProject.tasks.filter((task) => !task.done);
      return normalizeState({
        ...state,
        workspaces: updateActiveWorkspace(state, (workspace) => ({
          ...workspace,
          projects: workspace.projects.map((project) =>
            project.id === workspace.activeProjectId
              ? {
                  ...project,
                  tasks: project.tasks.filter((task) => !task.done)
                }
              : project
          )
        })),
        activeTaskId: getDefaultActiveTaskId({ ...activeProject, tasks: remainingTasks }, state.activeTaskId),
        status: before === activeProject.tasks.length ? "No completed tasks to clear." : "Completed tasks cleared."
      });
    }
    case "log-manual-entry":
      return {
        ...state,
        recentTaskSlots: mergeRecentTaskSlot(state.recentTaskSlots, action.slot),
        status: `Logged ${formatManualDuration(action.durationSeconds)} for ${action.slot.taskText}.`
      };
    default:
      return state;
  }
}
