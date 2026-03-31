export type Workspace = {
  id: string;
  name: string;
  activeProjectId: string;
  visibleProjectIds: string[];
};

export type Project = {
  id: string;
  workspaceId: string;
  name: string;
};

export type Outcome = {
  id: string;
  workspaceId: string;
  projectId: string;
  title: string;
  type: string;
  notes: string;
  agentEligible: boolean;
  done: boolean;
};

export type Burst = {
  id: string;
  workspaceId: string;
  projectId: string;
  outcomeId: string | null;
  title: string;
  sessionLabel: string;
  type: string;
  notes: string;
  agentEligible: boolean;
  lastDurationSeconds: number | null;
  loggedAt: number;
  source: "task" | "recent";
};

export type Task = {
  id: string;
  text: string;
  type: string;
  notes: string;
  agentEligible: boolean;
  done: boolean;
};

export type RecentTaskSlot = {
  id: string;
  taskId: string | null;
  taskText: string;
  sessionLabel: string;
  taskType: string;
  taskNotes: string;
  agentEligible: boolean;
  workspaceId: string;
  workspaceName: string;
  projectId: string;
  projectName: string;
  lastDurationSeconds: number | null;
  loggedAt: number;
};

export type AppState = {
  activeWorkspaceId: string;
  elapsedSeconds: number;
  targetSeconds: number;
  isRunning: boolean;
  completedSessions: number;
  lastTickAt: number | null;
  activeOutcomeId: string | null;
  isTaskFormOpen: boolean;
  editingOutcomeId: string | null;
  isWorkspaceMenuOpen: boolean;
  isProjectMenuOpen: boolean;
  customTaskTypes: string[];
  recentBurstIds: string[];
  status: string;
  workspaces: Workspace[];
  projects: Project[];
  outcomes: Outcome[];
  bursts: Burst[];
};

export type TaskDraft = {
  text: string;
  type: string;
  notes: string;
  agentEligible: boolean;
};

export type LegacyPersistedTask = Partial<Task> & { text?: unknown };
export type LegacyPersistedProject = {
  id?: unknown;
  name?: unknown;
  tasks?: unknown;
};
export type LegacyPersistedWorkspace = {
  id?: unknown;
  name?: unknown;
  activeProjectId?: unknown;
  visibleProjectIds?: unknown;
  projects?: unknown;
};
export type LegacyPersistedState = {
  activeWorkspaceId?: unknown;
  elapsedSeconds?: unknown;
  targetSeconds?: unknown;
  isRunning?: unknown;
  completedSessions?: unknown;
  lastTickAt?: unknown;
  activeTaskId?: unknown;
  isTaskFormOpen?: unknown;
  editingTaskId?: unknown;
  isWorkspaceMenuOpen?: unknown;
  isProjectMenuOpen?: unknown;
  customTaskTypes?: unknown;
  recentTaskSlots?: unknown;
  status?: unknown;
  workspaces?: unknown;
};

export type LocalCacheWorkspace = Workspace;

export type LocalCacheProject = Project;

export type LocalCacheOutcome = Outcome & {
  key: string;
  sourceBurstIds: string[];
};

export type LocalCacheBurst = {
  id: string;
  workspaceId: string;
  projectId: string;
  outcomeId: string | null;
  kind: "task" | "recent";
  sourceId: string;
  title: string;
  sessionLabel: string;
  type: string;
  notes: string;
  agentEligible: boolean;
  done: boolean;
  lastDurationSeconds: number | null;
  loggedAt: number;
};

export type LocalCacheUI = Pick<
  AppState,
  | "activeWorkspaceId"
  | "elapsedSeconds"
  | "targetSeconds"
  | "isRunning"
  | "completedSessions"
  | "lastTickAt"
  | "activeOutcomeId"
  | "isTaskFormOpen"
  | "editingOutcomeId"
  | "isWorkspaceMenuOpen"
  | "isProjectMenuOpen"
  | "customTaskTypes"
  | "status"
>;

export type LocalCache = {
  version: 3;
  workspaceIds: string[];
  workspacesById: Record<string, LocalCacheWorkspace>;
  projectIdsByWorkspaceId: Record<string, string[]>;
  projectsById: Record<string, LocalCacheProject>;
  outcomeIdsByProjectId: Record<string, string[]>;
  outcomesById: Record<string, LocalCacheOutcome>;
  taskBurstIdsByProjectId: Record<string, string[]>;
  burstsById: Record<string, LocalCacheBurst>;
  recentBurstIds: string[];
  ui: LocalCacheUI;
};
