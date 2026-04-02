import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { playTimerStart, startTimerCompleteAlarm, stopTimerCompleteAlarm } from "./lib/audio";
import { requestTimerNotificationPermission, showTimerCompleteNotification } from "./lib/notifications";
import { parseTimerInput } from "./lib/time";
import { ProjectTabs } from "./components/ProjectTabs";
import { SessionLabelField } from "./components/SessionLabelField";
import { TaskList } from "./components/TaskList";
import { TimerCard } from "./components/TimerCard";
import { WorkspaceMenu } from "./components/WorkspaceMenu";
import { usePersistentAppState } from "./hooks/usePersistentAppState";
import { useSupabaseAuth } from "./hooks/useSupabaseAuth";
import {
  getActiveProject,
  getSelectedOutcome,
  getActiveWorkspace,
  buildBurstHistoryLabel,
  getEditingOutcome,
  getOutcomesForProjectId,
  getOutcomeTypeOptions,
  getVisibleProjects
} from "./state/app-state";

const THEME_STORAGE_KEY = "time-theme";

type ThemeName = "blue" | "green" | "sakura";

function App() {
  const { configured, isLoading: isAuthLoading, isSigningIn, user, error: authError, info: authInfo, signInWithPassword, signOut } = useSupabaseAuth();
  const { state, dispatch, syncInfo, syncNow, forceFullSync, pullFromRemote } = usePersistentAppState({ userId: user?.id || null });
  const workspaceMenuRef = useRef<HTMLDivElement | null>(null);
  const projectMenuRef = useRef<HTMLDivElement | null>(null);
  const timerCardRef = useRef<HTMLElement | null>(null);
  const previousCompletedSessionsRef = useRef(state.completedSessions);
  const [isTaskQueueExpanded, setIsTaskQueueExpanded] = useState(false);
  const [isSelectedBurstHistoryOpen, setIsSelectedBurstHistoryOpen] = useState(false);
  const [collapsedTasksHeight, setCollapsedTasksHeight] = useState<number | null>(null);
  const [isDesktopLayout, setIsDesktopLayout] = useState(false);
  const [isCompletionAlertVisible, setIsCompletionAlertVisible] = useState(false);
  const [completionBurstId, setCompletionBurstId] = useState<string | null>(null);
  const [completionSessionLabel, setCompletionSessionLabel] = useState("");
  const [isSyncInfoVisible, setIsSyncInfoVisible] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [theme, setTheme] = useState<ThemeName>(() => {
    if (typeof window === "undefined") return "blue";

    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    return savedTheme === "green" || savedTheme === "sakura" ? savedTheme : "blue";
  });

  const activeWorkspace = useMemo(() => getActiveWorkspace(state), [state]);
  const activeProject = useMemo(() => getActiveProject(state), [state]);
  const selectedOutcome = useMemo(() => getSelectedOutcome(state), [state]);
  const editingOutcome = useMemo(() => getEditingOutcome(state), [state]);
  const visibleProjects = useMemo(() => getVisibleProjects(activeWorkspace, state), [activeWorkspace, state]);
  const projectOutcomes = useMemo(() => activeProject ? getOutcomesForProjectId(state, activeProject.id) : [], [activeProject, state]);
  const outcomeTypeOptions = useMemo(() => getOutcomeTypeOptions(state.customOutcomeTypes), [state.customOutcomeTypes]);
  const isOutcomeComposerOpen = state.isOutcomeFormOpen && !editingOutcome;
  const shouldExpandTasksCard = isTaskQueueExpanded || isSelectedBurstHistoryOpen || state.isOutcomeFormOpen || state.isProjectMenuOpen;
  const shouldHighlightTimerStart = !state.isRunning && Boolean(selectedOutcome);
  const selectedOutcomeContext = selectedOutcome && activeWorkspace && activeProject
    ? `${activeWorkspace.name} / ${activeProject.name}`
    : null;
  const timerStatusMessage = /^(Logged|Use mm:ss|Pick a current outcome|Session complete|Timer (started|paused|reset)|Timer target set|Time spent set)/.test(state.status)
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
    const taskName = selectedOutcome?.title?.trim() || "No outcome selected";
    const projectName = activeProject?.name || "Project";
    document.title = `${taskName} - ${projectName}`;
  }, [activeProject?.name, selectedOutcome?.title]);

  useEffect(() => {
    if (!state.isRunning) return undefined;

    const timerId = window.setInterval(() => {
      dispatch({ type: "tick", now: Date.now() });
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [dispatch, state.isRunning]);

  useEffect(() => {
    if (state.completedSessions > previousCompletedSessionsRef.current) {
      const latestBurst = state.bursts
        .filter((burst) => burst.outcomeId === state.activeOutcomeId)
        .sort((left, right) => right.loggedAt - left.loggedAt)[0] || null;
      startTimerCompleteAlarm();
      setIsCompletionAlertVisible(true);
      setCompletionBurstId(latestBurst?.id || null);
      setCompletionSessionLabel(latestBurst?.sessionLabel || "");
      showTimerCompleteNotification(
        selectedOutcome?.title?.trim() || "Focus session",
        activeProject?.name || "Project"
      );
    }
    previousCompletedSessionsRef.current = state.completedSessions;
  }, [activeProject?.name, selectedOutcome, state.completedSessions]);

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
  }, [state.targetSeconds, selectedOutcome?.title, state.isRunning, state.elapsedSeconds]);

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
    setCompletionBurstId(null);
    setCompletionSessionLabel("");
  }

  function handleSaveOutcome(draft: { title: string; type: string; notes: string; agentEligible: boolean }, customType: string) {
    if (!activeProject) {
      dispatch({ type: "set-status", status: "Add an outcome name first." });
      return;
    }

    if (!draft.title.trim()) {
      dispatch({ type: "set-status", status: "Add an outcome name first." });
      return;
    }

    if (draft.type === "__custom__" && !customType.trim()) {
      dispatch({ type: "set-status", status: "Add a custom outcome type first." });
      return;
    }

    const now = Date.now();

    dispatch({
      type: "save-outcome",
      draft,
      customType,
      now
    });
  }

  async function handleManualLog(durationSeconds: number, _slotId: string | null, sessionLabel: string): Promise<boolean> {
    if (!selectedOutcome || !activeWorkspace || !activeProject) {
      dispatch({ type: "set-status", status: "Pick a current outcome first." });
      return false;
    }

    const loggedAt = Date.now();
    dispatch({ type: "log-manual-entry", durationSeconds, sessionLabel, loggedAt });
    return true;
  }

  function handlePreviewManualDuration(durationSeconds: number) {
    dispatch({ type: "set-status", status: `Time spent set to ${Math.floor(durationSeconds / 3600)
      .toString()
      .padStart(2, "0")}:${Math.floor((durationSeconds % 3600) / 60).toString().padStart(2, "0")}.` });
  }

  function handleSaveCompletionSessionLabel() {
    if (!completionBurstId) {
      handleDismissCompletionAlert();
      return;
    }

    dispatch({
      type: "set-burst-session-label",
      burstId: completionBurstId,
      sessionLabel: completionSessionLabel
    });
    handleDismissCompletionAlert();
  }

  const syncStatusLabel = syncInfo.status === "disabled"
    ? "Local only"
    : syncInfo.status === "auth_required"
      ? "Sign in for Sync"
    : syncInfo.status === "connecting"
      ? "Connecting"
    : syncInfo.status === "syncing"
      ? "Syncing"
      : syncInfo.status === "error"
        ? "Sync error"
          : "Connected";
  const syncStatusDetail = syncInfo.status === "connected" && syncInfo.pendingUploadSeconds
    ? `upload in ${syncInfo.pendingUploadSeconds}s`
    : syncInfo.status === "connected" && syncInfo.lastSyncedAt
        ? "synced"
        : null;
  const syncTriggerLabel = syncStatusDetail ? `${syncStatusLabel} · ${syncStatusDetail}` : syncStatusLabel;

  async function handlePasswordSignIn() {
    const trimmed = authEmail.trim();
    if (!trimmed || !authPassword.trim()) return;
    const didSignIn = await signInWithPassword(trimmed, authPassword);
    if (!didSignIn) return;

    setAuthPassword("");
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
        <button
          className={`sync-status-trigger${syncInfo.status === "error" ? " error" : ""}`}
          type="button"
          onClick={() => setIsSyncInfoVisible(true)}
        >
          {syncTriggerLabel}
        </button>
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
            editingOutcome={editingOutcome}
            activeOutcomeId={state.activeOutcomeId}
            outcomeTypeOptions={outcomeTypeOptions}
            isComposerOpen={isOutcomeComposerOpen}
            onQueueExpandedChange={setIsTaskQueueExpanded}
            onSelectedBurstHistoryOpenChange={setIsSelectedBurstHistoryOpen}
            onSelectOutcome={(outcomeId) => dispatch({ type: "select-outcome", outcomeId })}
            onEditOutcome={(outcomeId) => dispatch({ type: "edit-outcome", outcomeId })}
            onToggleOutcome={(outcomeId) => dispatch({ type: "toggle-outcome", outcomeId })}
            onDeleteOutcome={(outcomeId) => dispatch({ type: "delete-outcome", outcomeId })}
            onClearCompleted={() => dispatch({ type: "clear-completed" })}
            onOpenComposer={() => dispatch({ type: "open-outcome-form" })}
            onCancelEdit={() => dispatch({ type: "close-outcome-form" })}
            onCancelComposer={() => dispatch({ type: "close-outcome-form" })}
            onSaveOutcome={handleSaveOutcome}
          />
        </section>

        <section ref={timerCardRef} className="timer-card" aria-labelledby="timerTitle">
          <TimerCard
            elapsedSeconds={state.elapsedSeconds}
            targetSeconds={state.targetSeconds}
            isRunning={state.isRunning}
            selectedOutcomeName={selectedOutcome?.title || null}
            selectedOutcomeContext={selectedOutcomeContext}
            timerStatusMessage={timerStatusMessage}
            shouldHighlightStart={shouldHighlightTimerStart}
            onToggleTimer={handleToggleTimer}
            onReset={() => dispatch({ type: "reset-timer" })}
            onCommitTarget={handleCommitTarget}
            onPreviewManualDuration={handlePreviewManualDuration}
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
                {selectedOutcome?.title?.trim() || "Focus session"} is done.
              </div>
            </div>
            <SessionLabelField
              value={completionSessionLabel}
              onChange={setCompletionSessionLabel}
              inputId="completionSessionLabelInput"
              className="completion-session-label"
            />
            <div className="completion-alert-preview">
              {buildBurstHistoryLabel({
                title: selectedOutcome?.title?.trim() || "Focus session",
                sessionLabel: completionSessionLabel
              })}
            </div>
            <div className="completion-alert-actions">
              <button className="completion-alert-dismiss" type="button" onClick={handleSaveCompletionSessionLabel}>
                Save label
              </button>
              <button className="completion-alert-skip" type="button" onClick={handleDismissCompletionAlert}>
                Skip
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isSyncInfoVisible ? (
        <div
          className="sync-info-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="syncInfoTitle"
        >
          <button
            className="sync-info-backdrop"
            type="button"
            aria-label="Dismiss sync info"
            onClick={() => setIsSyncInfoVisible(false)}
          ></button>

          <div className="sync-info-card">
            <div className="sync-info-title-row">
              <div className="sync-info-title" id="syncInfoTitle">Supabase Sync</div>
              <button
                className="sync-info-tooltip"
                type="button"
                aria-label="Sync details"
                data-tooltip="Auto-upload runs 10 seconds after durable changes and only sends changed records. Downloads only happen when you trigger them here."
              ></button>
            </div>
            {configured ? (
              <div className="sync-auth-panel">
                <div className="sync-info-row">
                  <span className="sync-info-label">Account</span>
                  <span className="sync-info-value">
                    {isAuthLoading ? "Checking session..." : (user?.email || "Not signed in")}
                  </span>
                </div>
                {!user ? (
                  <div className="sync-auth-form">
                    <input
                      className="sync-auth-input"
                      type="email"
                      placeholder="Email"
                      aria-label="Email for Supabase sign in"
                      value={authEmail}
                      onChange={(event) => setAuthEmail(event.target.value)}
                    />
                    <input
                      className="sync-auth-input"
                      type="password"
                      placeholder="Password"
                      aria-label="Password for Supabase sign in"
                      value={authPassword}
                      onChange={(event) => setAuthPassword(event.target.value)}
                    />
                    <button
                      className="completion-alert-dismiss"
                      type="button"
                      onClick={() => void handlePasswordSignIn()}
                      disabled={isAuthLoading || isSigningIn || !authEmail.trim() || !authPassword.trim()}
                    >
                      {isSigningIn ? "Signing in..." : "Sign in with Password"}
                    </button>
                  </div>
                ) : (
                  <div className="sync-auth-actions">
                    <button className="completion-alert-skip" type="button" onClick={() => void signOut()}>
                      Sign out
                    </button>
                  </div>
                )}
                {!user ? (
                  <div className="sync-auth-message">
                    Only one approved account is authorized to use sync.
                  </div>
                ) : null}
                {(authError || authInfo) ? (
                  <div className={`sync-auth-message${authError ? " error" : ""}`}>
                    {authError || authInfo}
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="sync-info-grid">
              <div className="sync-info-row">
                <span className="sync-info-label">Status</span>
                <span className={`sync-info-value${syncInfo.status === "error" ? " error" : ""}`}>{syncStatusLabel}</span>
              </div>
              <div className="sync-info-row">
                <span className="sync-info-label">Last sync</span>
                <span className="sync-info-value">
                  {syncInfo.lastSyncedAt ? new Date(syncInfo.lastSyncedAt).toLocaleString() : "Not yet"}
                </span>
              </div>
              <div className="sync-info-row sync-info-row-stack">
                <span className="sync-info-label">Last error</span>
                <span className={`sync-info-value sync-info-error-copy${syncInfo.lastError ? " error" : ""}`}>
                  {syncInfo.lastError || "None"}
                </span>
              </div>
            </div>
            <div className="sync-info-actions">
              {user ? (
                <>
                  <button className="completion-alert-skip" type="button" onClick={() => void pullFromRemote()}>
                    Download from Supabase
                  </button>
                  <button className="completion-alert-skip" type="button" onClick={() => void syncNow()}>
                    Sync Changed Data
                  </button>
                  <span
                    className="sync-action-tooltip-wrap"
                    tabIndex={0}
                    aria-label="Emergency full sync details"
                    data-tooltip="Emergency only. Re-uploads the full local dataset to rebuild Supabase if incremental sync ever gets out of shape."
                  >
                    <button className="sync-emergency-btn" type="button" onClick={() => void forceFullSync()}>
                      Emergency Full Sync
                    </button>
                  </span>
                </>
              ) : null}
              <button className="completion-alert-dismiss" type="button" onClick={() => setIsSyncInfoVisible(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default App;
