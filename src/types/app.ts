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
  durationSeconds: number;
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
  isOutcomeFormOpen: boolean;
  editingOutcomeId: string | null;
  isWorkspaceMenuOpen: boolean;
  isProjectMenuOpen: boolean;
  customOutcomeTypes: string[];
  status: string;
  workspaces: Workspace[];
  projects: Project[];
  outcomes: Outcome[];
  bursts: Burst[];
};

export type OutcomeDraft = {
  title: string;
  type: string;
  notes: string;
  agentEligible: boolean;
  projectId?: string;
};

export type LegacyPersistedTask = {
  id?: unknown;
  text?: unknown;
  type?: unknown;
  notes?: unknown;
  agentEligible?: unknown;
  done?: unknown;
};

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

export type LegacyPersistedRecentTaskSlot = {
  id?: unknown;
  taskId?: unknown;
  taskText?: unknown;
  sessionLabel?: unknown;
  taskType?: unknown;
  taskNotes?: unknown;
  agentEligible?: unknown;
  workspaceId?: unknown;
  workspaceName?: unknown;
  projectId?: unknown;
  projectName?: unknown;
  lastDurationSeconds?: unknown;
  loggedAt?: unknown;
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

export type LocalCacheOutcome = Outcome;

export type LocalCacheBurst = Burst;

export type LocalCacheUI = Pick<
  AppState,
  | "activeWorkspaceId"
  | "elapsedSeconds"
  | "targetSeconds"
  | "isRunning"
  | "completedSessions"
  | "lastTickAt"
  | "activeOutcomeId"
  | "isOutcomeFormOpen"
  | "editingOutcomeId"
  | "isWorkspaceMenuOpen"
  | "isProjectMenuOpen"
  | "customOutcomeTypes"
  | "status"
>;

export type LocalCache = {
  version: 4;
  workspaceIds: string[];
  workspacesById: Record<string, LocalCacheWorkspace>;
  projectIdsByWorkspaceId: Record<string, string[]>;
  projectsById: Record<string, LocalCacheProject>;
  outcomeIdsByProjectId: Record<string, string[]>;
  outcomesById: Record<string, LocalCacheOutcome>;
  burstsById: Record<string, LocalCacheBurst>;
  ui: LocalCacheUI;
};

export type LegacyLocalCacheBurst = {
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

export type LegacyLocalCache = {
  version: 3;
  workspaceIds: string[];
  workspacesById: Record<string, LocalCacheWorkspace>;
  projectIdsByWorkspaceId: Record<string, string[]>;
  projectsById: Record<string, LocalCacheProject>;
  outcomeIdsByProjectId: Record<string, string[]>;
  outcomesById: Record<string, Outcome & { key: string; sourceBurstIds: string[] }>;
  taskBurstIdsByProjectId: Record<string, string[]>;
  burstsById: Record<string, LegacyLocalCacheBurst>;
  recentBurstIds: string[];
  ui: {
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
    status: string;
  };
};
