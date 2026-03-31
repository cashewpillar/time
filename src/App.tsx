import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { playTimerStart, startTimerCompleteAlarm, stopTimerCompleteAlarm } from "./lib/audio";
import { requestTimerNotificationPermission, showTimerCompleteNotification } from "./lib/notifications";
import { parseTimerInput } from "./lib/time";
import { ProjectTabs } from "./components/ProjectTabs";
import { TaskList } from "./components/TaskList";
import { TimerCard } from "./components/TimerCard";
import { WorkspaceMenu } from "./components/WorkspaceMenu";
import { usePersistentAppState } from "./hooks/usePersistentAppState";
import type { RecentTaskSlot, Task } from "./types/app";
import {
  getActiveProject,
  getSelectedTask,
  getActiveWorkspace,
  getEditingTask,
  getOutcomesForProjectId,
  getRecentTaskSlots,
  getTaskTypeOptions,
  getVisibleProjects
} from "./state/app-state";

const THEME_STORAGE_KEY = "time-theme";

type ThemeName = "blue" | "green" | "sakura";

function App() {
  const { state, dispatch } = usePersistentAppState();
  const workspaceMenuRef = useRef<HTMLDivElement | null>(null);
  const projectMenuRef = useRef<HTMLDivElement | null>(null);
  const timerCardRef = useRef<HTMLElement | null>(null);
  const previousCompletedSessionsRef = useRef(state.completedSessions);
  const [isTaskQueueExpanded, setIsTaskQueueExpanded] = useState(false);
  const [collapsedTasksHeight, setCollapsedTasksHeight] = useState<number | null>(null);
  const [isDesktopLayout, setIsDesktopLayout] = useState(false);
  const [isCompletionAlertVisible, setIsCompletionAlertVisible] = useState(false);
  const [theme, setTheme] = useState<ThemeName>(() => {
    if (typeof window === "undefined") return "blue";

    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    return savedTheme === "green" || savedTheme === "sakura" ? savedTheme : "blue";
  });

  const activeWorkspace = useMemo(() => getActiveWorkspace(state), [state]);
  const activeProject = useMemo(() => getActiveProject(state), [state]);
  const selectedTask = useMemo(() => getSelectedTask(state), [state]);
  const editingTask = useMemo(() => getEditingTask(state), [state]);
  const visibleProjects = useMemo(() => getVisibleProjects(activeWorkspace, state), [activeWorkspace, state]);
  const projectOutcomes = useMemo(() => activeProject ? getOutcomesForProjectId(state, activeProject.id) : [], [activeProject, state]);
  const recentTaskSlots = useMemo(() => getRecentTaskSlots(state), [state]);
  const taskTypeOptions = useMemo(() => getTaskTypeOptions(state.customTaskTypes), [state.customTaskTypes]);
  const isTaskComposerOpen = state.isTaskFormOpen && !editingTask;
  const shouldExpandTasksCard = isTaskQueueExpanded || state.isTaskFormOpen;
  const shouldHighlightTimerStart = !state.isRunning && Boolean(selectedTask);
  const selectedTaskContext = selectedTask && activeWorkspace && activeProject
    ? `${activeWorkspace.name} / ${activeProject.name}`
    : null;
  const timerStatusMessage = /^(Logged|Use mm:ss|Pick a current task|Session complete|Timer (started|paused|reset)|Timer target set|Time spent set)/.test(state.status)
    ? state.status
    : null;

  useLayoutEffect(() => {
    setIsTaskQueueExpanded(!projectOutcomes.length);
  }, [activeProject?.id, projectOutcomes.length]);

  useEffect(() => {
    if (!isCompletionAlertVisible) return undefined;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        handleDismissCompletionAlert();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isCompletionAlertVisible]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 680px)");
    const updateLayoutMode = () => {
      setIsDesktopLayout(mediaQuery.matches);
    };

    updateLayoutMode();
    mediaQuery.addEventListener("change", updateLayoutMode);
    return () => mediaQuery.removeEventListener("change", updateLayoutMode);
  }, []);

  useEffect(() => {
    const taskName = selectedTask?.text?.trim() || "No task selected";
    const projectName = activeProject?.name || "Project";
    document.title = `${taskName} - ${projectName}`;
  }, [activeProject?.name, selectedTask?.text]);

  useEffect(() => {
    if (!state.isRunning) return undefined;

    const timerId = window.setInterval(() => {
      dispatch({ type: "tick", now: Date.now() });
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [dispatch, state.isRunning]);

  useEffect(() => {
    if (state.completedSessions > previousCompletedSessionsRef.current) {
      startTimerCompleteAlarm();
      setIsCompletionAlertVisible(true);
      showTimerCompleteNotification(
        selectedTask?.text?.trim() || "Focus session",
        activeProject?.name || "Project"
      );
    }
    previousCompletedSessionsRef.current = state.completedSessions;
  }, [activeProject?.name, selectedTask, state.completedSessions]);

  useEffect(() => () => {
    stopTimerCompleteAlarm();
  }, []);

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
    const project = state.projects.find((entry) => entry.id === projectId);
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
    const parsed = parseTimerInput(value);
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
      stopTimerCompleteAlarm();
      setIsCompletionAlertVisible(false);
      void requestTimerNotificationPermission();
      playTimerStart();
      dispatch({ type: "start-timer", now: Date.now() });
    }
  }

  function handleDismissCompletionAlert() {
    stopTimerCompleteAlarm();
    setIsCompletionAlertVisible(false);
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

  async function handleManualLog(durationSeconds: number, slotId: string | null): Promise<boolean> {
    const selectedRecentSlot = slotId
      ? recentTaskSlots.find((slot) => slot.id === slotId) || null
      : null;

    const activeSlot = selectedRecentSlot || (selectedTask && activeWorkspace && activeProject
      ? {
          id: `recent-task-slot-${Date.now()}`,
          taskId: selectedTask.id,
          taskText: selectedTask.text.trim(),
          taskType: selectedTask.type.trim(),
          taskNotes: selectedTask.notes,
          agentEligible: selectedTask.agentEligible,
          workspaceId: activeWorkspace.id,
          workspaceName: activeWorkspace.name,
          projectId: activeProject.id,
          projectName: activeProject.name,
          lastDurationSeconds: null,
          loggedAt: Date.now()
        }
      : null);

    if (!activeSlot) {
      dispatch({ type: "set-status", status: "Pick a current task or a recent slot first." });
      return false;
    }

    const loggedAt = Date.now();
    const nextSlot = {
      ...activeSlot,
      id: `recent-task-slot-${loggedAt}`,
      lastDurationSeconds: durationSeconds,
      loggedAt
    };

    dispatch({ type: "log-manual-entry", slot: nextSlot, durationSeconds });
    return true;
  }

  function handlePreviewManualDuration(durationSeconds: number) {
    dispatch({ type: "set-status", status: `Time spent set to ${Math.floor(durationSeconds / 3600)
      .toString()
      .padStart(2, "0")}:${Math.floor((durationSeconds % 3600) / 60).toString().padStart(2, "0")}.` });
  }

  function matchesRecentSlotTask(task: Task, slot: RecentTaskSlot): boolean {
    return task.text.trim() === slot.taskText.trim()
      && task.type.trim() === slot.taskType.trim()
      && task.notes.trim() === slot.taskNotes.trim();
  }

  function handleSelectRecentSlot(slot: RecentTaskSlot) {
    const targetWorkspace = state.workspaces.find((workspace) => workspace.id === slot.workspaceId) || null;
    if (!targetWorkspace) return;

    const targetProject = state.projects.find((project) => project.id === slot.projectId) || null;
    if (!targetProject) return;

    const projectTasks = getOutcomesForProjectId(state, targetProject.id).map((outcome) => ({
      id: outcome.id,
      text: outcome.title,
      type: outcome.type,
      notes: outcome.notes,
      agentEligible: outcome.agentEligible,
      done: outcome.done
    }));
    const matchedTask = projectTasks.find((task) => task.id === slot.taskId)
      || projectTasks.find((task) => matchesRecentSlotTask(task, slot))
      || projectTasks.find((task) => task.text.trim() === slot.taskText.trim() && !task.notes.trim() && !slot.taskNotes.trim())
      || null;

    if (targetWorkspace.id !== state.activeWorkspaceId) {
      dispatch({ type: "select-workspace", workspaceId: targetWorkspace.id });
    }

    if (targetProject.id !== targetWorkspace.activeProjectId || targetWorkspace.id !== state.activeWorkspaceId) {
      dispatch({ type: "select-project", projectId: targetProject.id });
    }

    if (matchedTask) {
      dispatch({ type: "select-task", taskId: matchedTask.id });
      return;
    }

    dispatch({ type: "restore-recent-task", slot, now: Date.now() });
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
      </header>

      <main className="main">
        <section
          className={`tasks-section tasks-section-top${shouldExpandTasksCard ? " expanded" : ""}`}
          aria-labelledby="tasksHeading"
          style={!shouldExpandTasksCard && isDesktopLayout && collapsedTasksHeight ? { height: `${collapsedTasksHeight}px` } : undefined}
        >
          <div ref={projectMenuRef}>
            <ProjectTabs
              visibleProjects={visibleProjects}
              projects={activeWorkspace ? state.projects.filter((project) => project.workspaceId === activeWorkspace.id) : []}
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
            outcomes={projectOutcomes}
            bursts={state.bursts}
            editingTask={editingTask}
            activeTaskId={state.activeOutcomeId}
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
            selectedTaskContext={selectedTaskContext}
            recentTaskSlots={recentTaskSlots}
            timerStatusMessage={timerStatusMessage}
            shouldHighlightStart={shouldHighlightTimerStart}
            onToggleTimer={handleToggleTimer}
            onReset={() => dispatch({ type: "reset-timer" })}
            onCommitTarget={handleCommitTarget}
            onPreviewManualDuration={handlePreviewManualDuration}
            onSelectRecentSlot={handleSelectRecentSlot}
            onClearRecentSlots={() => dispatch({ type: "clear-recent-task-slots" })}
            onManualLog={handleManualLog}
          />
        </section>
      </main>

      <div className="theme-switcher" aria-label="Color theme">
        <span className="theme-switcher-label">Theme</span>
        <div className="theme-switcher-options" role="group" aria-label="Choose color theme">
          <button
            className={`theme-option${theme === "green" ? " active" : ""}`}
            type="button"
            aria-pressed={theme === "green"}
            onClick={() => setTheme("green")}
          >
            Forest
          </button>
          <button
            className={`theme-option${theme === "blue" ? " active" : ""}`}
            type="button"
            aria-pressed={theme === "blue"}
            onClick={() => setTheme("blue")}
          >
            Midnight
          </button>
          <button
            className={`theme-option${theme === "sakura" ? " active" : ""}`}
            type="button"
            aria-pressed={theme === "sakura"}
            onClick={() => setTheme("sakura")}
          >
            Sakura
          </button>
        </div>
      </div>

      {isCompletionAlertVisible ? (
        <div
          className="completion-alert-modal"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="completionAlertTitle"
          aria-describedby="completionAlertBody"
        >
          <button
            className="completion-alert-backdrop"
            type="button"
            aria-label="Dismiss timer complete message"
            onClick={handleDismissCompletionAlert}
          ></button>

          <div className="completion-alert-card">
            <div className="completion-alert-copy">
              <div className="completion-alert-title" id="completionAlertTitle">Timer complete</div>
              <div className="completion-alert-body" id="completionAlertBody">
                {selectedTask?.text?.trim() || "Focus session"} is done.
              </div>
            </div>
            <button className="completion-alert-dismiss" type="button" onClick={handleDismissCompletionAlert}>
              Dismiss
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default App;
