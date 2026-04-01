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
  const selectedOutcome = outcomes.find((outcome) => outcome.id === activeOutcomeId) || null;
  const queuedOutcomes = outcomes.filter((outcome) => outcome.id !== activeOutcomeId);
  const hasAnyTasks = Boolean(outcomes.length);
  const hasOtherTasks = queuedOutcomes.length > 0;
  const [isQueueOpen, setIsQueueOpen] = useState(() => !hasOtherTasks);
  const [isSelectedBurstHistoryOpen, setIsSelectedBurstHistoryOpen] = useState(false);
  const [hasBurstHistoryFadeStart, setHasBurstHistoryFadeStart] = useState(false);
  const [hasBurstHistoryFadeEnd, setHasBurstHistoryFadeEnd] = useState(false);
  const burstHistoryRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    setIsQueueOpen(!hasOtherTasks);
  }, [hasOtherTasks, project?.id]);

  useEffect(() => {
    setIsSelectedBurstHistoryOpen(false);
  }, [activeOutcomeId]);

  useEffect(() => {
    onQueueExpandedChange(isQueueOpen && (queuedOutcomes.length > 0 || selectedOutcome !== null));
  }, [isQueueOpen, onQueueExpandedChange, queuedOutcomes.length, selectedOutcome]);

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

  function getOutcomeBursts(outcomeId: string): Burst[] {
    return bursts
      .filter((burst) => burst.outcomeId === outcomeId)
      .sort((left, right) => right.loggedAt - left.loggedAt);
  }

  function getOutcomeTrackedSeconds(outcomeId: string): number {
    return getOutcomeBursts(outcomeId)
      .reduce((sum, burst) => sum + burst.durationSeconds, 0);
  }

  function formatBurstTimestamp(timestamp: number): string {
    if (!timestamp) return "Saved from backlog";
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit"
    });
  }

  function renderOutcome(outcome: Outcome, isSelected: boolean) {
    const isEditing = editingOutcome?.id === outcome.id;
    const outcomeBursts = getOutcomeBursts(outcome.id);
    const trackedSeconds = getOutcomeTrackedSeconds(outcome.id);
    const previewBursts = outcomeBursts.slice(0, 2);
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
              {outcome.agentEligible ? (
                <div className="task-badges">
                  {outcome.agentEligible ? <span className="task-badge">AI Agent OK</span> : null}
                </div>
              ) : null}
              <div className="burst-summary">
                {outcome.type ? <span className="burst-summary-pill burst-summary-pill-type">{outcome.type}</span> : null}
                <span className="burst-summary-pill">{outcomeBursts.length} burst{outcomeBursts.length === 1 ? "" : "s"}</span>
                <span className="burst-summary-pill">{trackedSeconds ? formatManualDuration(trackedSeconds) : "00:00"} tracked</span>
              </div>
              {outcomeBursts.length ? (
                <>
                  {!isSelected ? (
                    <div className="burst-timeline">
                      {previewBursts.map((burst) => (
                        <div key={burst.id} className="burst-pill">
                          <span className="burst-pill-duration">{formatManualDuration(burst.durationSeconds)}</span>
                          <span className="burst-pill-time">{formatBurstTimestamp(burst.loggedAt)}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
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
    <>
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
            <>
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
            </>
          ) : null}
        </div>
      ) : !editingOutcome ? (
        <div className="task-queue">
          <button className="task-queue-toggle" type="button" onClick={() => setIsQueueOpen((open) => !open)}>
            <span className="task-queue-label">{hasAnyTasks ? "Other outcomes" : "Outcomes"}</span>
            <span className="task-queue-count">0</span>
            <span className="task-queue-caret">{isQueueOpen ? "Hide" : "Show"}</span>
          </button>

          {isQueueOpen ? (
            <TaskComposer
              isOpen={isComposerOpen}
              editingOutcome={null}
              outcomeTypeOptions={outcomeTypeOptions}
              onOpen={onOpenComposer}
              onCancel={onCancelComposer}
              onSave={onSaveOutcome}
              highlightTrigger={!hasAnyTasks}
            />
          ) : null}
        </div>
      ) : null}

      {!outcomes.length ? (
        <div className="task-empty-state">Add an outcome, then pick it to start focusing.</div>
      ) : null}

      {outcomes.length && !selectedOutcome ? (
        <div className="task-empty-state">Pick an outcome to lock in your focus session.</div>
      ) : null}

      {!selectedOutcome && !queuedOutcomes.length ? (
        <div className="tasks-list" id="tasksList"></div>
      ) : null}
    </>
  );
}
