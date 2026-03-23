import { useEffect, useMemo, useRef, useState } from "react";
import { playChime } from "./lib/audio";
import { fetchNotionSelectOptions, type NotionSelectOptions } from "./lib/notion";
import { formatTime, parseTimeInput } from "./lib/time";
import { ProjectTabs } from "./components/ProjectTabs";
import { SessionSummary } from "./components/SessionSummary";
import { TaskComposer } from "./components/TaskComposer";
import { TaskList } from "./components/TaskList";
import { TimerCard } from "./components/TimerCard";
import { WorkspaceMenu } from "./components/WorkspaceMenu";
import { usePersistentAppState } from "./hooks/usePersistentAppState";
import {
  getActiveProject,
  getActiveWorkspace,
  getEditingTask,
  getTaskTypeOptions,
  getVisibleProjects
} from "./state/app-state";

function App() {
  const { state, dispatch, notionConfig, updateNotionConfig, syncStatus, logTaskEntry } = usePersistentAppState();
  const workspaceMenuRef = useRef<HTMLDivElement | null>(null);
  const projectMenuRef = useRef<HTMLDivElement | null>(null);
  const previousCompletedSessionsRef = useRef(state.completedSessions);
  const [isNotionConfigOpen, setIsNotionConfigOpen] = useState(false);
  const [databaseIdDraft, setDatabaseIdDraft] = useState(notionConfig.databaseId);
  const [ownerTokenDraft, setOwnerTokenDraft] = useState(notionConfig.ownerToken);
  const [isLoadingNotionOptions, setIsLoadingNotionOptions] = useState(false);
  const [notionOptionsError, setNotionOptionsError] = useState("");
  const [notionOptions, setNotionOptions] = useState<NotionSelectOptions>({
    taskTypes: [],
    tasks: [],
    epics: []
  });

  const activeWorkspace = useMemo(() => getActiveWorkspace(state), [state]);
  const activeProject = useMemo(() => getActiveProject(state), [state]);
  const editingTask = useMemo(() => getEditingTask(state), [state]);
  const visibleProjects = useMemo(() => getVisibleProjects(activeWorkspace), [activeWorkspace]);
  const taskTypeOptions = useMemo(() => getTaskTypeOptions(state.customTaskTypes), [state.customTaskTypes]);
  const notionConfigured = Boolean(notionConfig.databaseId.trim() && notionConfig.ownerToken.trim());

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
    }
    previousCompletedSessionsRef.current = state.completedSessions;
  }, [state.completedSessions]);

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

  const sessionMessage = state.isRunning
    ? `Focusing to ${formatTime(state.targetSeconds)}`
    : state.elapsedSeconds >= state.targetSeconds
      ? "Session complete!"
      : state.elapsedSeconds > 0
        ? "Keep going!"
        : "Time to focus!";

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

    void logTaskEntry({
      entry: draft.text.trim(),
      taskType: draft.type.trim() || "Uncategorized",
      task: activeProject.name,
      epic: activeWorkspace?.name || "Workspace",
      minutes: Math.max(1, Math.round(state.targetSeconds / 60)),
      startDatetime: new Date(now).toISOString(),
      notes: draft.notes.trim(),
      aiWorkflow: draft.agentEligible
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
      setNotionOptions({ taskTypes: [], tasks: [], epics: [] });
      return;
    }

    if (!trimmedOwnerToken) {
      setNotionOptionsError("Add your owner token first.");
      setNotionOptions({ taskTypes: [], tasks: [], epics: [] });
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
        tasks: options.tasks,
        epics: options.epics
      });
    } catch (error) {
      setNotionOptions({ taskTypes: [], tasks: [], epics: [] });
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
              {isLoadingNotionOptions ? "Loading options..." : "Fetch select values"}
            </button>

            {notionOptionsError ? <div className="notion-helper error">{notionOptionsError}</div> : null}

            {notionOptions.taskTypes.length || notionOptions.tasks.length || notionOptions.epics.length ? (
              <div className="notion-options">
                <div className="notion-options-group">
                  <div className="notion-options-label">Task type</div>
                  <div className="notion-chip-list">
                    {notionOptions.taskTypes.length ? notionOptions.taskTypes.map((value) => (
                      <span key={value} className="notion-chip">{value}</span>
                    )) : <span className="notion-helper">No task type values found.</span>}
                  </div>
                </div>

                <div className="notion-options-group">
                  <div className="notion-options-label">Task</div>
                  <div className="notion-chip-list">
                    {notionOptions.tasks.length ? notionOptions.tasks.map((value) => (
                      <span key={value} className="notion-chip">{value}</span>
                    )) : <span className="notion-helper">No task values found.</span>}
                  </div>
                </div>

                <div className="notion-options-group">
                  <div className="notion-options-label">Epic</div>
                  <div className="notion-chip-list">
                    {notionOptions.epics.length ? notionOptions.epics.map((value) => (
                      <span key={value} className="notion-chip">{value}</span>
                    )) : <span className="notion-helper">No epic values found.</span>}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </header>

      <main className="main">
        <section className="timer-card" aria-labelledby="timerTitle">
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

          <TimerCard
            elapsedSeconds={state.elapsedSeconds}
            targetSeconds={state.targetSeconds}
            isRunning={state.isRunning}
            onToggleTimer={handleToggleTimer}
            onReset={() => dispatch({ type: "reset-timer" })}
            onCommitTarget={handleCommitTarget}
          />
        </section>

        <SessionSummary completedSessions={state.completedSessions} message={sessionMessage} />

        <section className="tasks-section" aria-labelledby="tasksHeading">
          <TaskList
            project={activeProject}
            editingTask={editingTask}
            taskTypeOptions={taskTypeOptions}
            onEditTask={(taskId) => dispatch({ type: "edit-task", taskId })}
            onToggleTask={(taskId) => dispatch({ type: "toggle-task", taskId })}
            onDeleteTask={(taskId) => dispatch({ type: "delete-task", taskId })}
            onClearCompleted={() => dispatch({ type: "clear-completed" })}
            onCancelEdit={() => dispatch({ type: "close-task-form" })}
            onSaveTask={handleSaveTask}
          />

          <TaskComposer
            isOpen={state.isTaskFormOpen && !editingTask}
            editingTask={null}
            taskTypeOptions={taskTypeOptions}
            onOpen={() => dispatch({ type: "open-task-form" })}
            onCancel={() => dispatch({ type: "close-task-form" })}
            onSave={handleSaveTask}
          />

          <div className="status" id="statusText">{state.status}</div>
        </section>
      </main>
    </div>
  );
}

export default App;
