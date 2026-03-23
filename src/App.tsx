import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { playChime } from "./lib/audio";
import { fetchNotionSelectOptions, RECENT_IMPORT_DAYS, type NotionSelectOptions } from "./lib/notion";
import { formatTime, parseTimeInput } from "./lib/time";
import { ProjectTabs } from "./components/ProjectTabs";
import { TaskList } from "./components/TaskList";
import { TimerCard } from "./components/TimerCard";
import { WorkspaceMenu } from "./components/WorkspaceMenu";
import { usePersistentAppState } from "./hooks/usePersistentAppState";
import {
  getActiveProject,
  getSelectedTask,
  getActiveWorkspace,
  getEditingTask,
  getTaskTypeOptions,
  getVisibleProjects
} from "./state/app-state";

function App() {
  const { state, dispatch, notionConfig, updateNotionConfig, syncStatus, logTaskEntry } = usePersistentAppState();
  const workspaceMenuRef = useRef<HTMLDivElement | null>(null);
  const projectMenuRef = useRef<HTMLDivElement | null>(null);
  const timerCardRef = useRef<HTMLElement | null>(null);
  const previousCompletedSessionsRef = useRef(state.completedSessions);
  const [isNotionConfigOpen, setIsNotionConfigOpen] = useState(false);
  const [databaseIdDraft, setDatabaseIdDraft] = useState(notionConfig.databaseId);
  const [ownerTokenDraft, setOwnerTokenDraft] = useState(notionConfig.ownerToken);
  const [isLoadingNotionOptions, setIsLoadingNotionOptions] = useState(false);
  const [notionOptionsError, setNotionOptionsError] = useState("");
  const [notionOptions, setNotionOptions] = useState<NotionSelectOptions>({
    taskTypes: [],
    workspaces: []
  });
  const [isTaskQueueExpanded, setIsTaskQueueExpanded] = useState(false);
  const [collapsedTasksHeight, setCollapsedTasksHeight] = useState<number | null>(null);

  const activeWorkspace = useMemo(() => getActiveWorkspace(state), [state]);
  const activeProject = useMemo(() => getActiveProject(state), [state]);
  const selectedTask = useMemo(() => getSelectedTask(state), [state]);
  const editingTask = useMemo(() => getEditingTask(state), [state]);
  const visibleProjects = useMemo(() => getVisibleProjects(activeWorkspace), [activeWorkspace]);
  const taskTypeOptions = useMemo(() => getTaskTypeOptions(state.customTaskTypes), [state.customTaskTypes]);
  const notionConfigured = Boolean(notionConfig.databaseId.trim() && notionConfig.ownerToken.trim());
  const isTaskComposerOpen = state.isTaskFormOpen && !editingTask;
  const shouldExpandTasksCard = isTaskQueueExpanded || isTaskComposerOpen;

  useLayoutEffect(() => {
    setIsTaskQueueExpanded(!(activeProject?.tasks.length));
  }, [activeProject?.id, activeProject?.tasks.length]);

  useEffect(() => {
    setDatabaseIdDraft(notionConfig.databaseId);
    setOwnerTokenDraft(notionConfig.ownerToken);
  }, [notionConfig.databaseId, notionConfig.ownerToken]);

  useEffect(() => {
    const workspaceName = activeWorkspace?.name || "Workspace";
    document.title = `${formatTime(state.elapsedSeconds)} / ${formatTime(state.targetSeconds)} - ${workspaceName}`;
  }, [activeWorkspace?.name, state.elapsedSeconds, state.targetSeconds]);

  useEffect(() => {
    if (!state.isRunning) return undefined;

    const timerId = window.setInterval(() => {
      dispatch({ type: "tick", now: Date.now() });
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [dispatch, state.isRunning]);

  useEffect(() => {
    if (state.completedSessions > previousCompletedSessionsRef.current) {
      playChime();

      if (selectedTask && notionConfig.databaseId.trim() && notionConfig.ownerToken.trim()) {
        const completedAt = Date.now();
        void logTaskEntry({
          entry: selectedTask.text.trim(),
          taskType: selectedTask.type.trim(),
          task: activeProject?.name || "Project",
          epic: activeWorkspace?.name || "Workspace",
          minutes: Math.max(1, Math.round(state.targetSeconds / 60)),
          startDatetime: new Date(completedAt).toISOString(),
          notes: selectedTask.notes.trim(),
          aiWorkflow: selectedTask.agentEligible
        });
      }
    }
    previousCompletedSessionsRef.current = state.completedSessions;
  }, [
    activeProject?.name,
    activeWorkspace?.name,
    logTaskEntry,
    notionConfig.databaseId,
    notionConfig.ownerToken,
    selectedTask,
    state.completedSessions,
    state.targetSeconds
  ]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;

      const clickedInsideWorkspaceMenu = workspaceMenuRef.current?.contains(target) ?? false;
      const clickedInsideProjectMenu = projectMenuRef.current?.contains(target) ?? false;

      if (!clickedInsideWorkspaceMenu && !clickedInsideProjectMenu) {
        dispatch({ type: "close-menus" });
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [dispatch]);

  useEffect(() => {
    const node = timerCardRef.current;
    if (!node) return undefined;

    const updateHeight = () => {
      setCollapsedTasksHeight(node.getBoundingClientRect().height);
    };

    updateHeight();

    const observer = new ResizeObserver(() => {
      updateHeight();
    });
    observer.observe(node);
    window.addEventListener("resize", updateHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateHeight);
    };
  }, [state.targetSeconds, selectedTask?.text, state.isRunning, state.elapsedSeconds]);

  function promptForWorkspaceRename(workspaceId: string) {
    const workspace = state.workspaces.find((entry) => entry.id === workspaceId);
    if (!workspace) return;

    const nextName = window.prompt("Rename workspace", workspace.name);
    if (nextName === null) return;

    const trimmed = nextName.trim();
    if (!trimmed) {
      dispatch({ type: "set-status", status: "Workspace name cannot be empty." });
      return;
    }

    dispatch({ type: "rename-workspace", workspaceId, name: trimmed });
  }

  function promptForProjectRename(projectId: string) {
    const project = activeWorkspace?.projects.find((entry) => entry.id === projectId);
    if (!project) return;

    const nextName = window.prompt("Rename project", project.name);
    if (nextName === null) return;

    const trimmed = nextName.trim();
    if (!trimmed) {
      dispatch({ type: "set-status", status: "Project name cannot be empty." });
      return;
    }

    dispatch({ type: "rename-project", projectId, name: trimmed });
  }

  function handleCommitTarget(value: string): boolean {
    const parsed = parseTimeInput(value);
    if (!parsed || parsed <= 0) {
      dispatch({ type: "set-status", status: "Use mm:ss format, for example 20:00." });
      return false;
    }

    dispatch({ type: "set-timer-target", targetSeconds: parsed });
    return true;
  }

  function handleToggleTimer() {
    if (state.isRunning) {
      dispatch({ type: "pause-timer" });
    } else {
      dispatch({ type: "start-timer", now: Date.now() });
    }
  }

  function handleSaveTask(draft: { text: string; type: string; notes: string; agentEligible: boolean }, customType: string) {
    if (!activeProject) {
      dispatch({ type: "set-status", status: "Add a task name first." });
      return;
    }

    if (!draft.text.trim()) {
      dispatch({ type: "set-status", status: "Add a task name first." });
      return;
    }

    if (draft.type === "__custom__" && !customType.trim()) {
      dispatch({ type: "set-status", status: "Add a custom task type first." });
      return;
    }

    const now = Date.now();

    dispatch({
      type: "save-task",
      draft,
      customType,
      now
    });
  }

  function handleSaveNotionConfig() {
    updateNotionConfig({
      databaseId: databaseIdDraft,
      ownerToken: ownerTokenDraft
    });
  }

  async function handleFetchNotionOptions() {
    const trimmedDatabaseId = databaseIdDraft.trim();
    const trimmedOwnerToken = ownerTokenDraft.trim();
    if (!trimmedDatabaseId) {
      setNotionOptionsError("Add a database ID first.");
      setNotionOptions({ taskTypes: [], workspaces: [] });
      return;
    }

    if (!trimmedOwnerToken) {
      setNotionOptionsError("Add your owner token first.");
      setNotionOptions({ taskTypes: [], workspaces: [] });
      return;
    }

    setIsLoadingNotionOptions(true);
    setNotionOptionsError("");

    try {
      const options = await fetchNotionSelectOptions({
        databaseId: trimmedDatabaseId,
        ownerToken: trimmedOwnerToken
      });
      setNotionOptions(options);
      dispatch({
        type: "import-notion-options",
        taskTypes: options.taskTypes,
        workspaces: options.workspaces
      });
    } catch (error) {
      setNotionOptions({ taskTypes: [], workspaces: [] });
      setNotionOptionsError(error instanceof Error ? error.message : "Failed to load select options.");
    } finally {
      setIsLoadingNotionOptions(false);
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div ref={workspaceMenuRef}>
          <WorkspaceMenu
            workspaces={state.workspaces}
            activeWorkspaceId={state.activeWorkspaceId}
            isOpen={state.isWorkspaceMenuOpen}
            title={activeWorkspace ? activeWorkspace.name : "Workspace"}
            onToggle={() => dispatch({ type: "toggle-workspace-menu" })}
            onSelect={(workspaceId) => dispatch({ type: "select-workspace", workspaceId })}
            onRename={promptForWorkspaceRename}
            onDelete={(workspaceId) => dispatch({ type: "delete-workspace", workspaceId })}
            onCreate={() => dispatch({ type: "create-workspace", now: Date.now() })}
          />
        </div>

        <div className="sync-bar">
          <div className="sync-indicator">
            <span className={`sync-dot${notionConfigured && syncStatus.phase !== "error" ? " connected" : ""}`}></span>
            <span>{syncStatus.message}</span>
          </div>
          <button className="sync-toggle" type="button" onClick={() => setIsNotionConfigOpen((open) => !open)}>
            {isNotionConfigOpen ? "Hide Notion" : "Configure Notion"}
          </button>
        </div>

        {isNotionConfigOpen ? (
          <div className="notion-panel">
            <label className="notion-field">
              <span>Database ID</span>
              <input
                type="text"
                placeholder="32-char database ID"
                value={databaseIdDraft}
                onChange={(event) => setDatabaseIdDraft(event.target.value)}
              />
            </label>

            <label className="notion-field">
              <span>Owner token</span>
              <input
                type="password"
                placeholder="Paste your private sync token"
                value={ownerTokenDraft}
                onChange={(event) => setOwnerTokenDraft(event.target.value)}
              />
            </label>

            <button className="notion-save" type="button" onClick={handleSaveNotionConfig}>
              Save Notion settings locally
            </button>

            <button className="notion-save notion-secondary" type="button" onClick={handleFetchNotionOptions} disabled={isLoadingNotionOptions}>
              {isLoadingNotionOptions ? "Importing..." : `Import recent entries (${RECENT_IMPORT_DAYS}d)`}
            </button>

            {notionOptionsError ? <div className="notion-helper error">{notionOptionsError}</div> : null}

            {notionOptions.taskTypes.length || notionOptions.workspaces.length ? (
              <div className="notion-options">
                <div className="notion-options-group">
                  <div className="notion-options-label">Task type</div>
                  <div className="notion-chip-list">
                    {notionOptions.taskTypes.length ? notionOptions.taskTypes.map((value) => (
                      <span key={value} className="notion-chip">{value}</span>
                    )) : <span className="notion-helper">No task type values found.</span>}
                  </div>
                </div>

                {notionOptions.workspaces.map((workspace) => (
                  <div key={workspace.name} className="notion-options-group">
                    <div className="notion-options-label">{workspace.name}</div>
                    <div className="notion-chip-list">
                      {workspace.projects.length ? workspace.projects.map((project) => (
                        <span key={`${workspace.name}-${project.name}`} className="notion-chip">
                          {project.name}
                          {project.tasks.length ? ` (${project.tasks.length})` : ""}
                        </span>
                      )) : <span className="notion-helper">No projects found for this workspace.</span>}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </header>

      <main className={`main${state.isRunning ? " timer-first" : ""}`}>
        <section
          className={`tasks-section tasks-section-top${shouldExpandTasksCard ? " expanded" : ""}`}
          aria-labelledby="tasksHeading"
          style={!shouldExpandTasksCard && collapsedTasksHeight ? { height: `${collapsedTasksHeight}px` } : undefined}
        >
          <div ref={projectMenuRef}>
            <ProjectTabs
              visibleProjects={visibleProjects}
              projects={activeWorkspace?.projects || []}
              activeProjectId={activeWorkspace?.activeProjectId || null}
              isMenuOpen={state.isProjectMenuOpen}
              onToggleMenu={() => dispatch({ type: "toggle-project-menu" })}
              onSelect={(projectId) => dispatch({ type: "select-project", projectId })}
              onRename={promptForProjectRename}
              onDelete={(projectId) => dispatch({ type: "delete-project", projectId })}
              onCreate={() => dispatch({ type: "create-project", now: Date.now() })}
            />
          </div>

          <TaskList
            key={activeProject?.id || "no-project"}
            project={activeProject}
            editingTask={editingTask}
            activeTaskId={state.activeTaskId}
            taskTypeOptions={taskTypeOptions}
            isComposerOpen={isTaskComposerOpen}
            onQueueExpandedChange={setIsTaskQueueExpanded}
            onSelectTask={(taskId) => dispatch({ type: "select-task", taskId })}
            onEditTask={(taskId) => dispatch({ type: "edit-task", taskId })}
            onToggleTask={(taskId) => dispatch({ type: "toggle-task", taskId })}
            onDeleteTask={(taskId) => dispatch({ type: "delete-task", taskId })}
            onClearCompleted={() => dispatch({ type: "clear-completed" })}
            onOpenComposer={() => dispatch({ type: "open-task-form" })}
            onCancelEdit={() => dispatch({ type: "close-task-form" })}
            onCancelComposer={() => dispatch({ type: "close-task-form" })}
            onSaveTask={handleSaveTask}
          />
        </section>

        <section ref={timerCardRef} className="timer-card" aria-labelledby="timerTitle">
          <TimerCard
            elapsedSeconds={state.elapsedSeconds}
            targetSeconds={state.targetSeconds}
            isRunning={state.isRunning}
            selectedTaskName={selectedTask?.text || null}
            onToggleTimer={handleToggleTimer}
            onReset={() => dispatch({ type: "reset-timer" })}
            onCommitTarget={handleCommitTarget}
          />
        </section>
      </main>
    </div>
  );
}

export default App;
