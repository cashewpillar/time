import { useEffect, useMemo, useRef, useState } from "react";

const STORAGE_KEY = "workspace-two-state-v2";
const DEFAULT_TARGET_SECONDS = 20 * 60;
const DEFAULT_TASK_TYPES = ["development", "design", "product"] as const;

type Task = {
  id: string;
  text: string;
  type: string;
  notes: string;
  agentEligible: boolean;
  done: boolean;
};

type Project = {
  id: string;
  name: string;
  tasks: Task[];
};

type Workspace = {
  id: string;
  name: string;
  activeProjectId: string;
  visibleProjectIds: string[];
  projects: Project[];
};

type AppState = {
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

type TaskFormState = {
  text: string;
  type: string;
  customType: string;
  notes: string;
  agentEligible: boolean;
};

type PersistedTask = Partial<Task> & { text?: unknown };
type PersistedProject = Partial<Project> & { tasks?: unknown };
type PersistedWorkspace = Partial<Workspace> & { projects?: unknown };
type PersistedState = Partial<AppState> & {
  workspaces?: unknown;
  customTaskTypes?: unknown;
};

function defaultState(): AppState {
  return {
    activeWorkspaceId: "workspace-2",
    elapsedSeconds: 0,
    targetSeconds: DEFAULT_TARGET_SECONDS,
    isRunning: false,
    completedSessions: 0,
    lastTickAt: null,
    isTaskFormOpen: false,
    editingTaskId: null,
    isWorkspaceMenuOpen: false,
    isProjectMenuOpen: false,
    customTaskTypes: [],
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

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function parseTimeInput(value: string): number | null {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{1,2}):([0-5]\d)$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function playChime(): void {
  const AudioContextClass = window.AudioContext || window.AudioContext;
  if (!AudioContextClass) return;

  const context = new AudioContextClass();
  const oscillator = context.createOscillator();
  const gainNode = context.createGain();

  oscillator.type = "triangle";
  oscillator.frequency.setValueAtTime(660, context.currentTime);
  oscillator.frequency.linearRampToValueAtTime(880, context.currentTime + 0.18);

  gainNode.gain.setValueAtTime(0.0001, context.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.02);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.45);

  oscillator.connect(gainNode);
  gainNode.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.48);
  oscillator.onended = () => {
    void context.close();
  };
}

function normalizeState(input?: PersistedState): AppState {
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
            ? candidate.projects.map((project, projectIndex) => {
                const savedProject = project as PersistedProject;
                return {
                  id: typeof savedProject.id === "string" ? savedProject.id : `project-${workspaceIndex + 1}-${projectIndex + 1}`,
                  name: typeof savedProject.name === "string" && savedProject.name.trim()
                    ? savedProject.name
                    : `Project ${projectIndex + 1}`,
                  tasks: Array.isArray(savedProject.tasks)
                    ? savedProject.tasks.flatMap((task, taskIndex) => {
                        const savedTask = task as PersistedTask | null;
                        if (!savedTask || typeof savedTask.text !== "string") {
                          return [];
                        }

                        return [{
                          id: typeof savedTask.id === "string" ? savedTask.id : `task-${workspaceIndex}-${projectIndex}-${taskIndex}-${Date.now()}`,
                          text: savedTask.text,
                          type: typeof savedTask.type === "string" ? savedTask.type : "",
                          notes: typeof savedTask.notes === "string" ? savedTask.notes : "",
                          agentEligible: Boolean(savedTask.agentEligible),
                          done: Boolean(savedTask.done)
                        }];
                      })
                    : []
                };
              })
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

  if (next.isRunning && next.lastTickAt) {
    const elapsedSinceLastTick = Math.floor((Date.now() - next.lastTickAt) / 1000);
    if (elapsedSinceLastTick > 0) {
      next.elapsedSeconds = Math.min(next.targetSeconds, next.elapsedSeconds + elapsedSinceLastTick);
      next.lastTickAt = Date.now();
    }
  }

  if (next.elapsedSeconds >= next.targetSeconds && next.isRunning) {
    next.elapsedSeconds = next.targetSeconds;
    next.isRunning = false;
    next.lastTickAt = null;
    next.completedSessions += 1;
    next.status = "Session complete. Nice work.";
  }

  return next;
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

function useAppState(): [AppState, React.Dispatch<React.SetStateAction<AppState>>] {
  const [state, setState] = useState<AppState>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") as PersistedState | null;
      return normalizeState(saved || undefined);
    } catch {
      return normalizeState();
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  return [state, setState];
}

function App() {
  const [state, setState] = useAppState();
  const [timerTargetDraft, setTimerTargetDraft] = useState<string>(() => formatTime(DEFAULT_TARGET_SECONDS));
  const [taskForm, setTaskForm] = useState<TaskFormState>({
    text: "",
    type: "",
    customType: "",
    notes: "",
    agentEligible: false
  });
  const workspaceMenuRef = useRef<HTMLDivElement | null>(null);
  const projectMenuRef = useRef<HTMLDivElement | null>(null);
  const taskInputRef = useRef<HTMLInputElement | null>(null);

  const activeWorkspace = useMemo(
    () => state.workspaces.find((workspace) => workspace.id === state.activeWorkspaceId) || null,
    [state.workspaces, state.activeWorkspaceId]
  );

  const activeProject = useMemo(
    () => activeWorkspace?.projects.find((project) => project.id === activeWorkspace.activeProjectId) || null,
    [activeWorkspace]
  );

  const editingTask = useMemo(
    () => activeProject?.tasks.find((task) => task.id === state.editingTaskId) || null,
    [activeProject, state.editingTaskId]
  );

  const taskTypeOptions = useMemo(
    () => Array.from(new Set([...DEFAULT_TASK_TYPES, ...state.customTaskTypes])),
    [state.customTaskTypes]
  );

  useEffect(() => {
    const workspaceName = activeWorkspace?.name || "Workspace";
    document.title = `${formatTime(state.elapsedSeconds)} / ${formatTime(state.targetSeconds)} - ${workspaceName}`;
  }, [activeWorkspace?.name, state.elapsedSeconds, state.targetSeconds]);

  useEffect(() => {
    setTimerTargetDraft(formatTime(state.targetSeconds));
  }, [state.targetSeconds]);

  useEffect(() => {
    if (!state.isTaskFormOpen) return;

    if (editingTask) {
      const normalizedType = (editingTask.type || "").toLowerCase();
      setTaskForm({
        text: editingTask.text,
        type: taskTypeOptions.includes(normalizedType) ? normalizedType : "__custom__",
        customType: taskTypeOptions.includes(normalizedType) ? "" : editingTask.type || "",
        notes: editingTask.notes || "",
        agentEligible: Boolean(editingTask.agentEligible)
      });
    } else {
      setTaskForm({
        text: "",
        type: "",
        customType: "",
        notes: "",
        agentEligible: false
      });
    }

    window.setTimeout(() => {
      taskInputRef.current?.focus();
    }, 0);
  }, [editingTask, state.isTaskFormOpen, taskTypeOptions]);

  useEffect(() => {
    if (!state.isRunning) return undefined;

    const timerId = window.setInterval(() => {
      setState((current) => {
        if (!current.isRunning) return current;
        const nextElapsed = current.elapsedSeconds + 1;

        if (nextElapsed >= current.targetSeconds) {
          playChime();
          return {
            ...current,
            elapsedSeconds: current.targetSeconds,
            isRunning: false,
            lastTickAt: null,
            completedSessions: current.completedSessions + 1,
            status: "Session complete. Nice work."
          };
        }

        return {
          ...current,
          elapsedSeconds: nextElapsed,
          lastTickAt: Date.now()
        };
      });
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [setState, state.isRunning]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      const target = event.target;
      if (workspaceMenuRef.current && target instanceof Node && !workspaceMenuRef.current.contains(target)) {
        setState((current) => current.isWorkspaceMenuOpen
          ? { ...current, isWorkspaceMenuOpen: false }
          : current);
      }

      if (projectMenuRef.current && target instanceof Node && !projectMenuRef.current.contains(target)) {
        setState((current) => current.isProjectMenuOpen
          ? { ...current, isProjectMenuOpen: false }
          : current);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [setState]);

  function setStatus(status: string): void {
    setState((current) => ({ ...current, status }));
  }

  function updateWorkspaces(updateFn: (workspaces: Workspace[]) => Workspace[]): void {
    setState((current) => normalizeState({
      ...current,
      workspaces: updateFn(current.workspaces)
    }));
  }

  function handleSelectWorkspace(workspaceId: string): void {
    setState((current) => normalizeState({
      ...current,
      activeWorkspaceId: workspaceId,
      isWorkspaceMenuOpen: false,
      isProjectMenuOpen: false,
      status: "Workspace selected."
    }));
  }

  function handleCreateWorkspace(): void {
    setState((current) => {
      const nextNumber = current.workspaces.length + 1;
      const newWorkspaceId = `workspace-${Date.now()}`;
      const firstProjectId = `${newWorkspaceId}-project-1`;

      return normalizeState({
        ...current,
        workspaces: [
          ...current.workspaces,
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
    });
  }

  function handleRenameWorkspace(workspaceId: string): void {
    const workspace = state.workspaces.find((entry) => entry.id === workspaceId);
    if (!workspace) return;

    const nextName = window.prompt("Rename workspace", workspace.name);
    if (nextName === null) return;

    const trimmed = nextName.trim();
    if (!trimmed) {
      setStatus("Workspace name cannot be empty.");
      return;
    }

    updateWorkspaces((workspaces) =>
      workspaces.map((entry) => entry.id === workspaceId ? { ...entry, name: trimmed } : entry)
    );
    setStatus("Workspace renamed.");
  }

  function handleDeleteWorkspace(workspaceId: string): void {
    if (state.workspaces.length === 1) {
      setStatus("You need at least one workspace.");
      return;
    }

    const workspace = state.workspaces.find((entry) => entry.id === workspaceId);
    setState((current) => {
      const nextWorkspaces = current.workspaces.filter((entry) => entry.id !== workspaceId);
      return normalizeState({
        ...current,
        workspaces: nextWorkspaces,
        activeWorkspaceId: current.activeWorkspaceId === workspaceId ? nextWorkspaces[0].id : current.activeWorkspaceId,
        isWorkspaceMenuOpen: false,
        isProjectMenuOpen: false,
        status: `${workspace?.name || "Workspace"} deleted.`
      });
    });
  }

  function handleSelectProject(projectId: string): void {
    if (!activeWorkspace) return;

    setState((current) => normalizeState({
      ...current,
      workspaces: current.workspaces.map((workspace) =>
        workspace.id === current.activeWorkspaceId
          ? setActiveProjectOnWorkspace(workspace, projectId)
          : workspace
      ),
      isProjectMenuOpen: false,
      status: "Project selected."
    }));
  }

  function handleCreateProject(): void {
    if (!activeWorkspace) return;

    setState((current) => {
      const nextProjectName = `Project ${activeWorkspace.projects.length + 1}`;
      const nextWorkspaces = current.workspaces.map((workspace) => {
        if (workspace.id !== current.activeWorkspaceId) return workspace;
        const nextNumber = workspace.projects.length + 1;
        const projectId = `${workspace.id}-project-${Date.now()}`;
        const newProject: Project = { id: projectId, name: `Project ${nextNumber}`, tasks: [] };
        return setActiveProjectOnWorkspace(
          {
            ...workspace,
            projects: [...workspace.projects, newProject]
          },
          projectId
        );
      });

      return normalizeState({
        ...current,
        workspaces: nextWorkspaces,
        isProjectMenuOpen: false,
        status: `${nextProjectName} created.`
      });
    });
  }

  function handleRenameProject(projectId: string): void {
    const project = activeWorkspace?.projects.find((entry) => entry.id === projectId);
    if (!project) return;

    const nextName = window.prompt("Rename project", project.name);
    if (nextName === null) return;

    const trimmed = nextName.trim();
    if (!trimmed) {
      setStatus("Project name cannot be empty.");
      return;
    }

    updateWorkspaces((workspaces) =>
      workspaces.map((workspace) =>
        workspace.id === state.activeWorkspaceId
          ? {
              ...workspace,
              projects: workspace.projects.map((entry) => entry.id === projectId ? { ...entry, name: trimmed } : entry)
            }
          : workspace
      )
    );
    setStatus("Project renamed.");
  }

  function handleDeleteProject(projectId: string): void {
    if (!activeWorkspace) return;

    if (activeWorkspace.projects.length === 1) {
      setStatus("You need at least one project.");
      return;
    }

    const project = activeWorkspace.projects.find((entry) => entry.id === projectId);
    setState((current) => {
      const nextWorkspaces = current.workspaces.map((workspace) => {
        if (workspace.id !== current.activeWorkspaceId) return workspace;

        const remainingProjects = workspace.projects.filter((entry) => entry.id !== projectId);
        const nextWorkspace: Workspace = {
          ...workspace,
          projects: remainingProjects,
          visibleProjectIds: workspace.visibleProjectIds.filter((id) => id !== projectId)
        };

        if (workspace.activeProjectId === projectId) {
          return setActiveProjectOnWorkspace(nextWorkspace, remainingProjects[0].id);
        }

        return normalizeWorkspace(nextWorkspace);
      });

      return normalizeState({
        ...current,
        workspaces: nextWorkspaces,
        isProjectMenuOpen: false,
        status: `${project?.name || "Project"} deleted.`
      });
    });
  }

  function commitTimerTarget(value: string): void {
    const parsed = parseTimeInput(value);
    if (!parsed || parsed <= 0) {
      setTimerTargetDraft(formatTime(state.targetSeconds));
      setStatus("Use mm:ss format, for example 20:00.");
      return;
    }

    setState((current) => ({
      ...current,
      targetSeconds: parsed,
      elapsedSeconds: Math.min(current.elapsedSeconds, parsed),
      status: `Timer target set to ${formatTime(parsed)}.`
    }));
  }

  function handleStartPause(): void {
    setState((current) => {
      if (current.isRunning) {
        return {
          ...current,
          isRunning: false,
          lastTickAt: null,
          status: "Timer paused."
        };
      }

      const resetElapsed = current.elapsedSeconds >= current.targetSeconds ? 0 : current.elapsedSeconds;
      return {
        ...current,
        elapsedSeconds: resetElapsed,
        isRunning: true,
        lastTickAt: Date.now(),
        status: `Timer started toward ${formatTime(current.targetSeconds)}.`
      };
    });
  }

  function handleResetTimer(): void {
    setState((current) => ({
      ...current,
      isRunning: false,
      elapsedSeconds: 0,
      lastTickAt: null,
      status: "Timer reset to 00:00."
    }));
  }

  function handleOpenTaskForm(): void {
    setState((current) => ({
      ...current,
      isTaskFormOpen: true,
      editingTaskId: null
    }));
  }

  function handleCloseTaskForm(): void {
    setState((current) => ({
      ...current,
      isTaskFormOpen: false,
      editingTaskId: null
    }));
  }

  function handleEditTask(taskId: string): void {
    setState((current) => ({
      ...current,
      editingTaskId: taskId,
      isTaskFormOpen: true,
      status: "Editing task."
    }));
  }

  function handleSubmitTask(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    if (!activeProject) {
      setStatus("Add a task name first.");
      return;
    }

    const text = taskForm.text.trim();
    const selectedType = taskForm.type.trim();
    const customType = taskForm.customType.trim().toLowerCase();
    const type = selectedType === "__custom__" ? customType : selectedType;

    if (!text) {
      setStatus("Add a task name first.");
      return;
    }

    if (selectedType === "__custom__" && !customType) {
      setStatus("Add a custom task type first.");
      return;
    }

    setState((current) => {
      const nextCustomTypes = customType && !current.customTaskTypes.includes(customType)
        ? [...current.customTaskTypes, customType].sort()
        : current.customTaskTypes;

      const nextWorkspaces = current.workspaces.map((workspace) => {
        if (workspace.id !== current.activeWorkspaceId) return workspace;

        return {
          ...workspace,
          projects: workspace.projects.map((project) => {
            if (project.id !== workspace.activeProjectId) return project;

            if (current.editingTaskId) {
              return {
                ...project,
                tasks: project.tasks.map((task) =>
                  task.id === current.editingTaskId
                    ? {
                        ...task,
                        text,
                        type,
                        notes: taskForm.notes.trim(),
                        agentEligible: taskForm.agentEligible
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
                  id: `task-${Date.now()}`,
                  text,
                  type,
                  notes: taskForm.notes.trim(),
                  agentEligible: taskForm.agentEligible,
                  done: false
                }
              ]
            };
          })
        };
      });

      return normalizeState({
        ...current,
        workspaces: nextWorkspaces,
        customTaskTypes: nextCustomTypes,
        isTaskFormOpen: false,
        editingTaskId: null,
        status: current.editingTaskId ? "Task updated." : "Task added."
      });
    });
  }

  function updateActiveProjectTasks(updateFn: (tasks: Task[]) => Task[], status: string): void {
    if (!activeWorkspace || !activeProject) return;

    setState((current) => normalizeState({
      ...current,
      workspaces: current.workspaces.map((workspace) =>
        workspace.id === current.activeWorkspaceId
          ? {
              ...workspace,
              projects: workspace.projects.map((project) =>
                project.id === workspace.activeProjectId
                  ? { ...project, tasks: updateFn(project.tasks) }
                  : project
              )
            }
          : workspace
      ),
      status
    }));
  }

  function handleToggleTask(taskId: string): void {
    const task = activeProject?.tasks.find((entry) => entry.id === taskId);
    updateActiveProjectTasks(
      (tasks) => tasks.map((entry) => entry.id === taskId ? { ...entry, done: !entry.done } : entry),
      task?.done ? "Task marked active." : "Task completed."
    );
  }

  function handleDeleteTask(taskId: string): void {
    updateActiveProjectTasks(
      (tasks) => tasks.filter((task) => task.id !== taskId),
      "Task deleted."
    );
  }

  function handleClearCompleted(): void {
    if (!activeProject) return;
    const before = activeProject.tasks.length;
    updateActiveProjectTasks(
      (tasks) => tasks.filter((task) => !task.done),
      before === activeProject.tasks.length ? "No completed tasks to clear." : "Completed tasks cleared."
    );
  }

  const visibleProjects: Project[] = activeWorkspace
    ? activeWorkspace.visibleProjectIds
        .map((projectId) => activeWorkspace.projects.find((project) => project.id === projectId) || null)
        .filter((project): project is Project => Boolean(project))
    : [];

  const startPauseLabel = state.isRunning ? "Pause" : (state.elapsedSeconds === 0 ? "Start" : "Resume");
  const sessionMessage = state.isRunning
    ? `Focusing to ${formatTime(state.targetSeconds)}`
    : state.elapsedSeconds >= state.targetSeconds
      ? "Session complete!"
      : state.elapsedSeconds > 0
        ? "Keep going!"
        : "Time to focus!";

  return (
    <div className="app-shell">
      <header className="topbar">
        <div ref={workspaceMenuRef}>
          <button
            className="workspace-trigger"
            id="workspaceTrigger"
            type="button"
            aria-expanded={state.isWorkspaceMenuOpen}
            aria-controls="workspaceDropdown"
            onClick={() => setState((current) => ({
              ...current,
              isWorkspaceMenuOpen: !current.isWorkspaceMenuOpen,
              isProjectMenuOpen: false
            }))}
          >
            <span id="workspaceTitle">{activeWorkspace ? activeWorkspace.name : "Workspace"}</span>
            <span className="caret">▾</span>
          </button>

          <div className={`dropdown${state.isWorkspaceMenuOpen ? " open" : ""}`} id="workspaceDropdown">
            <div className="dropdown-section" id="workspaceList">
              <div className="dropdown-label">Workspaces</div>
              {state.workspaces.map((workspace) => (
                <div key={workspace.id} className="dropdown-row">
                  <button
                    className={`dropdown-item${workspace.id === state.activeWorkspaceId ? " active" : ""}`}
                    type="button"
                    data-action="select-workspace"
                    data-workspace-id={workspace.id}
                    onClick={() => handleSelectWorkspace(workspace.id)}
                  >
                    <span className="dropdown-item-name">{workspace.name}</span>
                  </button>
                  <button
                    className="dropdown-icon"
                    type="button"
                    data-action="rename-workspace"
                    data-workspace-id={workspace.id}
                    aria-label={`Rename ${workspace.name}`}
                    onClick={() => handleRenameWorkspace(workspace.id)}
                  >
                    ✎
                  </button>
                  <button
                    className="dropdown-icon"
                    type="button"
                    data-action="delete-workspace"
                    data-workspace-id={workspace.id}
                    aria-label={`Delete ${workspace.name}`}
                    onClick={() => handleDeleteWorkspace(workspace.id)}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <div className="dropdown-divider"></div>
            <button className="dropdown-action" id="createWorkspaceBtn" type="button" onClick={handleCreateWorkspace}>
              + Create Workspace
            </button>
          </div>
        </div>
      </header>

      <main className="main">
        <section className="timer-card" aria-labelledby="timerTitle">
          <div className="project-bar" ref={projectMenuRef}>
            <div id="projectTabs" className="project-controls">
              {visibleProjects.map((project) => (
                <button
                  key={project.id}
                  className={`project-tab${project.id === activeWorkspace?.activeProjectId ? " active" : ""}`}
                  type="button"
                  data-action="select-project"
                  data-project-id={project.id}
                  onClick={() => handleSelectProject(project.id)}
                >
                  {project.name}
                </button>
              ))}
              <button
                className="project-menu-trigger"
                type="button"
                id="projectMenuTrigger"
                data-action="toggle-project-menu"
                aria-expanded={state.isProjectMenuOpen}
                onClick={() => setState((current) => ({
                  ...current,
                  isProjectMenuOpen: !current.isProjectMenuOpen,
                  isWorkspaceMenuOpen: false
                }))}
              >
                ▾
              </button>
            </div>

            <div className={`dropdown project-dropdown${state.isProjectMenuOpen ? " open" : ""}`} id="projectDropdown">
              <div className="dropdown-section" id="projectList">
                <div className="dropdown-label">Projects</div>
                {activeWorkspace?.projects.map((project) => (
                  <div key={project.id} className="dropdown-row">
                    <button
                      className={`dropdown-item${project.id === activeWorkspace.activeProjectId ? " active" : ""}`}
                      type="button"
                      data-action="select-project"
                      data-project-id={project.id}
                      onClick={() => handleSelectProject(project.id)}
                    >
                      <span className="dropdown-item-name">{project.name}</span>
                    </button>
                    <button
                      className="dropdown-icon"
                      type="button"
                      data-action="rename-project"
                      data-project-id={project.id}
                      aria-label={`Rename ${project.name}`}
                      onClick={() => handleRenameProject(project.id)}
                    >
                      ✎
                    </button>
                    <button
                      className="dropdown-icon"
                      type="button"
                      data-action="delete-project"
                      data-project-id={project.id}
                      aria-label={`Delete ${project.name}`}
                      onClick={() => handleDeleteProject(project.id)}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <div className="dropdown-divider"></div>
              <button className="dropdown-action" id="createProjectBtn" type="button" onClick={handleCreateProject}>
                + Create Project
              </button>
            </div>
          </div>

          <div className="timer-config-row">
            <label className="timer-config" htmlFor="timerTargetInput">
              Target
              <input
                id="timerTargetInput"
                type="text"
                inputMode="numeric"
                value={timerTargetDraft}
                aria-label="Timer target"
                onChange={(event) => setTimerTargetDraft(event.target.value)}
                onBlur={(event) => commitTimerTarget(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    commitTimerTarget(event.currentTarget.value);
                    event.currentTarget.blur();
                  }
                }}
              />
            </label>
          </div>

          <h2 className="sr-only" id="timerTitle">Project Timer</h2>
          <div className="timer-readout" id="timerDisplay" aria-live="polite">
            {formatTime(state.elapsedSeconds)}
          </div>

          <div className="timer-actions">
            <button className="primary-btn" id="startPauseBtn" type="button" onClick={handleStartPause}>
              {startPauseLabel}
            </button>
            <button className="ghost-btn" id="resetBtn" type="button" onClick={handleResetTimer}>
              Reset
            </button>
          </div>
        </section>

        <section className="session-copy" aria-live="polite">
          <span className="session-count" id="sessionCount">#{Math.max(1, state.completedSessions + 1)}</span>
          <div className="session-title" id="sessionMessage">{sessionMessage}</div>
        </section>

        <section className="tasks-section" aria-labelledby="tasksHeading">
          <div className="tasks-head">
            <h2 className="tasks-title" id="tasksHeading">Tasks</h2>
            <button className="menu-btn" type="button" id="clearCompletedBtn" aria-label="Clear completed tasks" onClick={handleClearCompleted}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <circle cx="10" cy="4.5" r="1.7"></circle>
                <circle cx="10" cy="10" r="1.7"></circle>
                <circle cx="10" cy="15.5" r="1.7"></circle>
              </svg>
            </button>
          </div>

          <div className="tasks-divider" aria-hidden="true"></div>
          <p className="project-caption" id="projectCaption">Showing tasks for {activeProject ? activeProject.name : "your project"}</p>
          <div className="tasks-list" id="tasksList">
            {activeProject?.tasks.map((task, index) => (
              <div key={task.id} className={`task-item${task.done ? " done" : ""}`}>
                <button
                  className="task-toggle"
                  type="button"
                  data-action="toggle-task"
                  data-task-id={task.id}
                  aria-label="Toggle task"
                  onClick={() => handleToggleTask(task.id)}
                >
                  {task.done ? "✓" : ""}
                </button>
                <div className="task-copy">
                  <div className="task-name">{task.text}</div>
                  <div className="task-meta">Task {index + 1}</div>
                  {(task.type || task.agentEligible) ? (
                    <div className="task-badges">
                      {task.type ? <span className="task-badge">{task.type}</span> : null}
                      {task.agentEligible ? <span className="task-badge">AI Agent OK</span> : null}
                    </div>
                  ) : null}
                  {task.notes ? <div className="task-notes-copy">{task.notes}</div> : null}
                </div>
                <div className="task-actions">
                  <button className="icon-action-btn" type="button" data-action="edit-task" data-task-id={task.id} aria-label="Edit task" onClick={() => handleEditTask(task.id)}>
                    ✎
                  </button>
                  <button className="delete-btn" type="button" data-action="delete-task" data-task-id={task.id} aria-label="Delete task" onClick={() => handleDeleteTask(task.id)}>
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>

          {!state.isTaskFormOpen ? (
            <button className="add-task-tile" id="showTaskFormBtn" type="button" onClick={handleOpenTaskForm}>
              ⊕ Add Task
            </button>
          ) : null}

          <form className={`task-form${state.isTaskFormOpen ? " open" : ""}`} id="taskForm" onSubmit={handleSubmitTask}>
            <div className="task-input-row">
              <input
                ref={taskInputRef}
                className="task-input"
                id="taskInput"
                type="text"
                maxLength={100}
                placeholder="What are you working on?"
                aria-label="Task name"
                value={taskForm.text}
                onChange={(event) => setTaskForm((current) => ({ ...current, text: event.target.value }))}
              />
            </div>
            <div className="task-input-row">
              <select
                className="task-input task-type-select"
                id="taskTypeInput"
                aria-label="Task type"
                value={taskForm.type}
                onChange={(event) => {
                  const nextType = event.target.value;
                  setTaskForm((current) => ({
                    ...current,
                    type: nextType,
                    customType: nextType === "__custom__" ? current.customType : ""
                  }));
                }}
              >
                <option value="">Select task type</option>
                {taskTypeOptions.map((type) => (
                  <option key={type} value={type}>
                    {type[0].toUpperCase() + type.slice(1)}
                  </option>
                ))}
                <option value="__custom__">Add more...</option>
              </select>
            </div>
            <div className={`task-input-row task-type-custom${taskForm.type === "__custom__" ? " open" : ""}`} id="taskTypeCustomRow">
              <input
                className="task-input"
                id="taskTypeCustomInput"
                type="text"
                maxLength={40}
                placeholder="Add a task type"
                aria-label="Add a task type"
                value={taskForm.customType}
                onChange={(event) => setTaskForm((current) => ({ ...current, customType: event.target.value }))}
              />
            </div>
            <div className="task-input-row">
              <textarea
                className="task-input task-notes"
                id="taskNotesInput"
                maxLength={400}
                placeholder="Task notes"
                aria-label="Task notes"
                value={taskForm.notes}
                onChange={(event) => setTaskForm((current) => ({ ...current, notes: event.target.value }))}
              ></textarea>
            </div>
            <div className="task-input-row">
              <label className="task-checkbox-row" htmlFor="taskAgentEligibleInput">
                <input
                  className="task-checkbox"
                  id="taskAgentEligibleInput"
                  type="checkbox"
                  checked={taskForm.agentEligible}
                  onChange={(event) => setTaskForm((current) => ({ ...current, agentEligible: event.target.checked }))}
                />
                <span>Can be handled by an AI agent</span>
              </label>
            </div>
            <div className="task-form-actions">
              <button className="task-form-btn primary" type="submit">
                {editingTask ? "Save Changes" : "Save Task"}
              </button>
              <button className="task-form-btn ghost" type="button" id="cancelTaskBtn" onClick={handleCloseTaskForm}>
                Cancel
              </button>
            </div>
          </form>

          <div className="status" id="statusText">{state.status}</div>
        </section>
      </main>
    </div>
  );
}

export default App;
