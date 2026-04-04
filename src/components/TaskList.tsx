import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { TaskComposer } from "./TaskComposer";
import { formatManualDuration } from "../lib/time";
import { buildBurstHistoryLabel } from "../state/app-state";
import type { Burst, Outcome, OutcomeDraft, Project } from "../types/app";

type TaskListProps = {
  project: Project | null;
  outcomes: Outcome[];
  bursts: Burst[];
  editingOutcome: Outcome | null;
  activeOutcomeId: string | null;
  outcomeTypeOptions: string[];
  isComposerOpen: boolean;
  onQueueExpandedChange: (isExpanded: boolean) => void;
  onSelectedBurstHistoryOpenChange: (isOpen: boolean) => void;
  onSelectOutcome: (outcomeId: string) => void;
  onEditOutcome: (outcomeId: string) => void;
  onToggleOutcome: (outcomeId: string) => void;
  onDeleteOutcome: (outcomeId: string) => void;
  onClearCompleted: () => void;
  onOpenComposer: () => void;
  onCancelEdit: () => void;
  onCancelComposer: () => void;
  onSaveOutcome: (draft: OutcomeDraft, customType: string) => void;
};

export function TaskList({
  project,
  outcomes,
  bursts,
  editingOutcome,
  activeOutcomeId,
  outcomeTypeOptions,
  isComposerOpen,
  onQueueExpandedChange,
  onSelectedBurstHistoryOpenChange,
  onSelectOutcome,
  onEditOutcome,
  onToggleOutcome,
  onDeleteOutcome,
  onClearCompleted,
  onOpenComposer,
  onCancelEdit,
  onCancelComposer,
  onSaveOutcome
}: TaskListProps) {
  function getOutcomeBursts(outcomeId: string): Burst[] {
    return bursts
      .filter((burst) => burst.outcomeId === outcomeId)
      .sort((left, right) => right.loggedAt - left.loggedAt);
  }

  function getLatestBurstLoggedAt(outcomeId: string): number {
    return getOutcomeBursts(outcomeId)[0]?.loggedAt || 0;
  }

  const selectedOutcome = outcomes.find((outcome) => outcome.id === activeOutcomeId) || null;
  const queuedOutcomes = outcomes
    .filter((outcome) => outcome.id !== activeOutcomeId)
    .sort((left, right) => {
      const rightLatest = getLatestBurstLoggedAt(right.id);
      const leftLatest = getLatestBurstLoggedAt(left.id);

      if (rightLatest !== leftLatest) {
        return rightLatest - leftLatest;
      }

      return outcomes.findIndex((outcome) => outcome.id === left.id) - outcomes.findIndex((outcome) => outcome.id === right.id);
    });
  const hasAnyTasks = Boolean(outcomes.length);
  const hasOtherTasks = queuedOutcomes.length > 0;
  const projectBursts = project
    ? bursts.filter((burst) => burst.projectId === project.id).sort((left, right) => left.loggedAt - right.loggedAt)
    : [];
  const projectTrackedSeconds = projectBursts.reduce((sum, burst) => sum + burst.durationSeconds, 0);
  const projectBurstCount = projectBursts.length;
  const projectStartDate = projectBursts[0]?.loggedAt || null;
  const projectEndDate = projectBursts[projectBursts.length - 1]?.loggedAt || null;
  const [isQueueOpen, setIsQueueOpen] = useState(() => !hasOtherTasks);
  const [isSelectedBurstHistoryOpen, setIsSelectedBurstHistoryOpen] = useState(false);
  const [hasBurstHistoryFadeStart, setHasBurstHistoryFadeStart] = useState(false);
  const [hasBurstHistoryFadeEnd, setHasBurstHistoryFadeEnd] = useState(false);
  const [hasQueueFadeStart, setHasQueueFadeStart] = useState(false);
  const [hasQueueFadeEnd, setHasQueueFadeEnd] = useState(false);
  const burstHistoryRef = useRef<HTMLDivElement | null>(null);
  const queueBodyRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    setIsQueueOpen(!hasOtherTasks);
  }, [hasOtherTasks, project?.id]);

  useEffect(() => {
    setIsSelectedBurstHistoryOpen(false);
  }, [activeOutcomeId]);

  useEffect(() => {
    onQueueExpandedChange(
      isQueueOpen && (queuedOutcomes.length > 0 || selectedOutcome !== null || isComposerOpen || !hasAnyTasks)
    );
  }, [hasAnyTasks, isComposerOpen, isQueueOpen, onQueueExpandedChange, queuedOutcomes.length, selectedOutcome]);

  useEffect(() => {
    onSelectedBurstHistoryOpenChange(isSelectedBurstHistoryOpen);
  }, [isSelectedBurstHistoryOpen, onSelectedBurstHistoryOpenChange]);

  useEffect(() => {
    const node = burstHistoryRef.current;
    if (!node || !isSelectedBurstHistoryOpen) {
      setHasBurstHistoryFadeStart(false);
      setHasBurstHistoryFadeEnd(false);
      return;
    }

    const updateBurstHistoryFade = () => {
      const maxScrollTop = node.scrollHeight - node.clientHeight;
      setHasBurstHistoryFadeStart(node.scrollTop > 4);
      setHasBurstHistoryFadeEnd(maxScrollTop - node.scrollTop > 4);
    };

    updateBurstHistoryFade();
    node.addEventListener("scroll", updateBurstHistoryFade, { passive: true });
    window.addEventListener("resize", updateBurstHistoryFade);

    return () => {
      node.removeEventListener("scroll", updateBurstHistoryFade);
      window.removeEventListener("resize", updateBurstHistoryFade);
    };
  }, [isSelectedBurstHistoryOpen, activeOutcomeId, bursts]);

  useEffect(() => {
    const node = queueBodyRef.current;
    if (!node || !isQueueOpen) {
      setHasQueueFadeStart(false);
      setHasQueueFadeEnd(false);
      return;
    }

    const updateQueueFade = () => {
      const maxScrollTop = node.scrollHeight - node.clientHeight;
      setHasQueueFadeStart(node.scrollTop > 4);
      setHasQueueFadeEnd(maxScrollTop - node.scrollTop > 4);
    };

    updateQueueFade();
    node.addEventListener("scroll", updateQueueFade, { passive: true });
    window.addEventListener("resize", updateQueueFade);

    return () => {
      node.removeEventListener("scroll", updateQueueFade);
      window.removeEventListener("resize", updateQueueFade);
    };
  }, [isQueueOpen, queuedOutcomes.length, isComposerOpen]);

  function getOutcomeTrackedSeconds(outcomeId: string): number {
    return getOutcomeBursts(outcomeId)
      .reduce((sum, burst) => sum + burst.durationSeconds, 0);
  }

  function formatBurstTimestamp(timestamp: number): string {
    if (!timestamp) return "Saved from backlog";
    return new Date(timestamp).toLocaleString([], {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  }

  function formatProjectDate(timestamp: number | null): string {
    if (!timestamp) return "No data yet";
    return new Date(timestamp).toLocaleDateString([], {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  }

  function renderOutcome(outcome: Outcome, isSelected: boolean) {
    const isEditing = editingOutcome?.id === outcome.id;
    const outcomeBursts = getOutcomeBursts(outcome.id);
    const trackedSeconds = getOutcomeTrackedSeconds(outcome.id);
    const historyBursts = outcomeBursts;
    const showBurstHistory = isSelected && isSelectedBurstHistoryOpen;

    return (
      <div key={outcome.id} className={`task-item${outcome.done ? " done" : ""}${isEditing ? " editing" : ""}${isSelected ? " selected" : " compact"}`}>
        <button
          className="task-toggle"
          type="button"
          data-action="toggle-outcome"
          data-task-id={outcome.id}
          aria-label="Toggle outcome"
          onClick={() => onToggleOutcome(outcome.id)}
        >
          {outcome.done ? "✓" : ""}
        </button>

        <div
          className={`task-copy${isEditing ? " editing" : ""}${isSelected ? " selected" : ""}`}
          role={isEditing ? undefined : "button"}
          tabIndex={isEditing ? -1 : 0}
          onClick={isEditing ? undefined : () => {
            onSelectOutcome(outcome.id);
            if (!isSelected) {
              setIsQueueOpen(false);
            }
          }}
          onKeyDown={isEditing ? undefined : (event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onSelectOutcome(outcome.id);
              if (!isSelected) {
                setIsQueueOpen(false);
              }
            }
          }}
        >
          {isEditing ? (
            <>
              <TaskComposer
                isOpen
                editingOutcome={editingOutcome}
                outcomeTypeOptions={outcomeTypeOptions}
                onCancel={onCancelEdit}
                onSave={onSaveOutcome}
                hideTrigger
                className="task-form-inline"
              />
            </>
          ) : (
            <>
              <div className="task-name">{outcome.title}</div>
              <div className="burst-summary">
                {outcome.type ? <span className="burst-summary-pill burst-summary-pill-type">{outcome.type}</span> : null}
                <span className="burst-summary-pill">{outcomeBursts.length} burst{outcomeBursts.length === 1 ? "" : "s"}</span>
                <span className="burst-summary-pill">{trackedSeconds ? formatManualDuration(trackedSeconds) : "00:00"} tracked</span>
              </div>
              {outcomeBursts.length ? (
                <>
                  {outcome.notes ? <div className="task-notes-copy">{outcome.notes}</div> : null}
                  {isSelected ? (
                    <>
                      <button
                        className="burst-history-toggle"
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setIsSelectedBurstHistoryOpen((open) => !open);
                        }}
                        aria-expanded={showBurstHistory}
                      >
                        {showBurstHistory ? "Hide entry log" : "Show entry log"}
                      </button>
                      {showBurstHistory ? (
                        <div
                          ref={burstHistoryRef}
                          className={`burst-history-list${hasBurstHistoryFadeStart ? " fade-start" : ""}${hasBurstHistoryFadeEnd ? " fade-end" : ""}`}
                        >
                          {historyBursts.map((burst) => (
                            <div key={`${burst.id}-history`} className="burst-history-item">
                              <div className="burst-history-label">{buildBurstHistoryLabel(burst)}</div>
                              <div className="burst-history-meta">
                                {formatManualDuration(burst.durationSeconds)} • {formatBurstTimestamp(burst.loggedAt)}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </>
                  ) : null}
                </>
              ) : (
                <div className="burst-empty">No bursts yet. Start the timer or log time to build history.</div>
              )}
              {!outcomeBursts.length && outcome.notes ? <div className="task-notes-copy">{outcome.notes}</div> : null}
            </>
          )}
        </div>

        {!isEditing ? (
          <div className="task-actions">
            <button className="icon-action-btn" type="button" data-action="edit-outcome" data-task-id={outcome.id} aria-label="Edit outcome" onClick={() => onEditOutcome(outcome.id)}>
              ✎
            </button>
            <button className="delete-btn" type="button" data-action="delete-outcome" data-task-id={outcome.id} aria-label="Delete outcome" onClick={() => onDeleteOutcome(outcome.id)}>
              ✕
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="task-list-shell">
      <div className="task-list-content">
        {selectedOutcome ? (
          <div className="selected-task-panel">
            <div className="selected-task-kicker">Selected outcome</div>
            <div className="tasks-list" id="tasksList">
              {renderOutcome(selectedOutcome, true)}
            </div>
          </div>
        ) : null}

        {queuedOutcomes.length ? (
          <div className="task-queue">
            <button className="task-queue-toggle" type="button" onClick={() => setIsQueueOpen((open) => !open)}>
              <span className="task-queue-label">Other outcomes</span>
              <span className="task-queue-count">{queuedOutcomes.length}</span>
              <span className="task-queue-caret">{isQueueOpen ? "Hide" : "Show"}</span>
            </button>

            {isQueueOpen ? (
              <div
                ref={queueBodyRef}
                className={`task-queue-body${hasQueueFadeStart ? " fade-start" : ""}${hasQueueFadeEnd ? " fade-end" : ""}`}
              >
                <TaskComposer
                  isOpen={isComposerOpen}
                  editingOutcome={null}
                  outcomeTypeOptions={outcomeTypeOptions}
                  onOpen={onOpenComposer}
                  onCancel={onCancelComposer}
                  onSave={onSaveOutcome}
                  highlightTrigger={false}
                />

                <div className="tasks-list task-queue-list">
                  {queuedOutcomes.map((outcome) => renderOutcome(outcome, false))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {!queuedOutcomes.length && !editingOutcome ? (
          <div className="task-composer-standalone">
            <TaskComposer
              isOpen={isComposerOpen}
              editingOutcome={null}
              outcomeTypeOptions={outcomeTypeOptions}
              onOpen={onOpenComposer}
              onCancel={onCancelComposer}
              onSave={onSaveOutcome}
              highlightTrigger={!hasAnyTasks}
            />
          </div>
        ) : null}

        {outcomes.length && !selectedOutcome ? (
          <div className="task-empty-state">Pick an outcome to lock in your focus session.</div>
        ) : null}

        {!selectedOutcome && !queuedOutcomes.length && hasAnyTasks ? (
          <div className="tasks-list" id="tasksList"></div>
        ) : null}
      </div>

      {project ? (
        <div className="project-stats-footer" aria-label="Project stats">
          {projectBurstCount
            ? `${formatProjectDate(projectStartDate)} to ${formatProjectDate(projectEndDate)} • ${formatManualDuration(projectTrackedSeconds)} tracked • ${projectBurstCount} burst${projectBurstCount === 1 ? "" : "s"}`
            : "No tracked work yet for this project."}
        </div>
      ) : null}
    </div>
  );
}
