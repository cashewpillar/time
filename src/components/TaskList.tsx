import { useEffect, useLayoutEffect, useState } from "react";
import { TaskComposer } from "./TaskComposer";
import { formatManualDuration } from "../lib/time";
import type { Burst, Outcome, Project, TaskDraft } from "../types/app";

type TaskListProps = {
  project: Project | null;
  outcomes: Outcome[];
  bursts: Burst[];
  editingTask: Outcome | null;
  activeTaskId: string | null;
  taskTypeOptions: string[];
  isComposerOpen: boolean;
  onQueueExpandedChange: (isExpanded: boolean) => void;
  onSelectTask: (taskId: string) => void;
  onEditTask: (taskId: string) => void;
  onToggleTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onClearCompleted: () => void;
  onOpenComposer: () => void;
  onCancelEdit: () => void;
  onCancelComposer: () => void;
  onSaveTask: (draft: TaskDraft, customType: string) => void;
};

export function TaskList({
  project,
  outcomes,
  bursts,
  editingTask,
  activeTaskId,
  taskTypeOptions,
  isComposerOpen,
  onQueueExpandedChange,
  onSelectTask,
  onEditTask,
  onToggleTask,
  onDeleteTask,
  onClearCompleted,
  onOpenComposer,
  onCancelEdit,
  onCancelComposer,
  onSaveTask
}: TaskListProps) {
  const selectedTask = outcomes.find((task) => task.id === activeTaskId) || null;
  const queueTasks = outcomes.filter((task) => task.id !== activeTaskId);
  const hasAnyTasks = Boolean(outcomes.length);
  const hasOtherTasks = queueTasks.length > 0;
  const [isQueueOpen, setIsQueueOpen] = useState(() => !hasOtherTasks);

  useLayoutEffect(() => {
    setIsQueueOpen(!hasOtherTasks);
  }, [hasOtherTasks, project?.id]);

  useEffect(() => {
    onQueueExpandedChange(isQueueOpen && (queueTasks.length > 0 || selectedTask !== null));
  }, [isQueueOpen, onQueueExpandedChange, queueTasks.length, selectedTask]);

  function getOutcomeBursts(outcomeId: string): Burst[] {
    return bursts
      .filter((burst) => burst.outcomeId === outcomeId && burst.source === "recent")
      .sort((left, right) => right.loggedAt - left.loggedAt);
  }

  function getOutcomeTrackedSeconds(outcomeId: string): number {
    return getOutcomeBursts(outcomeId)
      .reduce((sum, burst) => sum + (burst.lastDurationSeconds || 0), 0);
  }

  function formatBurstTimestamp(timestamp: number): string {
    if (!timestamp) return "Saved from backlog";
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit"
    });
  }

  function renderTask(task: Outcome, isSelected: boolean) {
    const isEditing = editingTask?.id === task.id;
    const outcomeBursts = getOutcomeBursts(task.id);
    const trackedSeconds = getOutcomeTrackedSeconds(task.id);
    const recentBursts = outcomeBursts.slice(0, isSelected ? 4 : 2);

    return (
      <div key={task.id} className={`task-item${task.done ? " done" : ""}${isEditing ? " editing" : ""}${isSelected ? " selected" : " compact"}`}>
        <button
          className="task-toggle"
          type="button"
          data-action="toggle-task"
          data-task-id={task.id}
          aria-label="Toggle task"
          onClick={() => onToggleTask(task.id)}
        >
          {task.done ? "✓" : ""}
        </button>

        <div
          className={`task-copy${isEditing ? " editing" : ""}${isSelected ? " selected" : ""}`}
          role={isEditing ? undefined : "button"}
          tabIndex={isEditing ? -1 : 0}
          onClick={isEditing ? undefined : () => {
            onSelectTask(task.id);
            if (!isSelected) {
              setIsQueueOpen(false);
            }
          }}
          onKeyDown={isEditing ? undefined : (event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onSelectTask(task.id);
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
                editingTask={editingTask}
                taskTypeOptions={taskTypeOptions}
                onCancel={onCancelEdit}
                onSave={onSaveTask}
                hideTrigger
                className="task-form-inline"
              />
            </>
          ) : (
            <>
              <div className="task-name">{task.title}</div>
              {(task.type || task.agentEligible) ? (
                <div className="task-badges">
                  {task.type ? <span className="task-badge">{task.type}</span> : null}
                  {task.agentEligible ? <span className="task-badge">AI Agent OK</span> : null}
                </div>
              ) : null}
              <div className="burst-summary">
                <span className="burst-summary-pill">{outcomeBursts.length} burst{outcomeBursts.length === 1 ? "" : "s"}</span>
                <span className="burst-summary-pill">{trackedSeconds ? formatManualDuration(trackedSeconds) : "00:00"} tracked</span>
              </div>
              {recentBursts.length ? (
                <div className={`burst-timeline${isSelected ? " selected" : ""}`}>
                  {recentBursts.map((burst) => (
                    <div key={burst.id} className="burst-pill">
                      <span className="burst-pill-duration">{burst.lastDurationSeconds ? formatManualDuration(burst.lastDurationSeconds) : "Done"}</span>
                      <span className="burst-pill-time">{formatBurstTimestamp(burst.loggedAt)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="burst-empty">No bursts yet. Start the timer or log time to build history.</div>
              )}
              {task.notes ? <div className="task-notes-copy">{task.notes}</div> : null}
            </>
          )}
        </div>

        {!isEditing ? (
          <div className="task-actions">
            <button className="icon-action-btn" type="button" data-action="edit-task" data-task-id={task.id} aria-label="Edit task" onClick={() => onEditTask(task.id)}>
              ✎
            </button>
            <button className="delete-btn" type="button" data-action="delete-task" data-task-id={task.id} aria-label="Delete task" onClick={() => onDeleteTask(task.id)}>
              ✕
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <>
      {selectedTask ? (
        <div className="selected-task-panel">
          <div className="selected-task-kicker">Selected outcome</div>
          <div className="tasks-list" id="tasksList">
            {renderTask(selectedTask, true)}
          </div>
        </div>
      ) : null}

      {queueTasks.length ? (
        <div className="task-queue">
          <button className="task-queue-toggle" type="button" onClick={() => setIsQueueOpen((open) => !open)}>
            <span className="task-queue-label">Other tasks</span>
            <span className="task-queue-count">{queueTasks.length}</span>
            <span className="task-queue-caret">{isQueueOpen ? "Hide" : "Show"}</span>
          </button>

          {isQueueOpen ? (
            <>
              <TaskComposer
                isOpen={isComposerOpen}
                editingTask={null}
                taskTypeOptions={taskTypeOptions}
                onOpen={onOpenComposer}
                onCancel={onCancelComposer}
                onSave={onSaveTask}
                highlightTrigger={false}
              />

              <div className="tasks-list task-queue-list">
                {queueTasks.map((task) => renderTask(task, false))}
              </div>
            </>
          ) : null}
        </div>
      ) : !editingTask ? (
        <div className="task-queue">
          <button className="task-queue-toggle" type="button" onClick={() => setIsQueueOpen((open) => !open)}>
            <span className="task-queue-label">{hasAnyTasks ? "Other tasks" : "Tasks"}</span>
            <span className="task-queue-count">0</span>
            <span className="task-queue-caret">{isQueueOpen ? "Hide" : "Show"}</span>
          </button>

          {isQueueOpen ? (
            <TaskComposer
              isOpen={isComposerOpen}
              editingTask={null}
              taskTypeOptions={taskTypeOptions}
              onOpen={onOpenComposer}
              onCancel={onCancelComposer}
              onSave={onSaveTask}
              highlightTrigger={!hasAnyTasks}
            />
          ) : null}
        </div>
      ) : null}

      {!outcomes.length ? (
        <div className="task-empty-state">Add a task, then pick it to start focusing.</div>
      ) : null}

      {outcomes.length && !selectedTask ? (
        <div className="task-empty-state">Pick a task to lock in your focus session.</div>
      ) : null}

      {!selectedTask && !queueTasks.length ? (
        <div className="tasks-list" id="tasksList"></div>
      ) : null}
    </>
  );
}
