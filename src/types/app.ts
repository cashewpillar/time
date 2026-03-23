export type Task = {
  id: string;
  text: string;
  type: string;
  notes: string;
  agentEligible: boolean;
  done: boolean;
};

export type Project = {
  id: string;
  name: string;
  tasks: Task[];
};

export type Workspace = {
  id: string;
  name: string;
  activeProjectId: string;
  visibleProjectIds: string[];
  projects: Project[];
};

export type AppState = {
  activeWorkspaceId: string;
  elapsedSeconds: number;
  targetSeconds: number;
  isRunning: boolean;
  completedSessions: number;
  lastTickAt: number | null;
  isTaskFormOpen: boolean;
  editingTaskId: string | null;
  isWorkspaceMenuOpen: boolean;
  isProjectMenuOpen: boolean;
  customTaskTypes: string[];
  status: string;
  workspaces: Workspace[];
};

export type TaskDraft = {
  text: string;
  type: string;
  notes: string;
  agentEligible: boolean;
};

export type PersistedTask = Partial<Task> & { text?: unknown };
export type PersistedProject = Partial<Project> & { tasks?: unknown };
export type PersistedWorkspace = Partial<Workspace> & { projects?: unknown };
export type PersistedState = Partial<AppState> & {
  workspaces?: unknown;
  customTaskTypes?: unknown;
};
