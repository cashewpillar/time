import { useEffect, useState } from "react";
import { TaskComposer } from "./TaskComposer";
import type { Project, Task, TaskDraft } from "../types/app";

type TaskListProps = {
  project: Project | null;
  editingTask: Task | null;
  activeTaskId: string | null;
  taskTypeOptions: string[];
  isComposerOpen: boolean;
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
  editingTask,
  activeTaskId,
  taskTypeOptions,
  isComposerOpen,
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
  const selectedTask = project?.tasks.find((task) => task.id === activeTaskId) || null;
  const queueTasks = project?.tasks.filter((task) => task.id !== activeTaskId) || [];
  const hasAnyTasks = Boolean(project?.tasks.length);
  const [isQueueOpen, setIsQueueOpen] = useState(() => !hasAnyTasks);

  useEffect(() => {
    if (!hasAnyTasks) {
      setIsQueueOpen(true);
    }
  }, [hasAnyTasks, project?.id]);

  function renderTask(task: Task, indexLabel: string, isSelected: boolean) {
    const isEditing = editingTask?.id === task.id;

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
          onClick={isEditing ? undefined : () => onSelectTask(task.id)}
          onKeyDown={isEditing ? undefined : (event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onSelectTask(task.id);
            }
          }}
        >
          {isEditing ? (
            <>
              <div className="task-meta">{indexLabel}</div>
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
              <div className="task-name">{task.text}</div>
              <div className="task-meta">
                {indexLabel}{isSelected ? " / Active timer task" : ""}
              </div>
              {(task.type || task.agentEligible) ? (
                <div className="task-badges">
                  {task.type ? <span className="task-badge">{task.type}</span> : null}
                  {task.agentEligible ? <span className="task-badge">AI Agent OK</span> : null}
                </div>
              ) : null}
              {isSelected && task.notes ? <div className="task-notes-copy">{task.notes}</div> : null}
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
          <div className="selected-task-kicker">Selected task</div>
          <div className="tasks-list" id="tasksList">
            {renderTask(selectedTask, `Task ${project?.tasks.findIndex((task) => task.id === selectedTask.id)! + 1}`, true)}
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
              />

              <div className="tasks-list task-queue-list">
                {queueTasks.map((task, index) => renderTask(task, `Task ${index + 1}`, false))}
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
            />
          ) : null}
        </div>
      ) : null}

      {!project?.tasks.length ? (
        <div className="task-empty-state">Add a task, then pick it to start focusing.</div>
      ) : null}

      {project?.tasks.length && !selectedTask ? (
        <div className="task-empty-state">Pick a task to lock in your focus session.</div>
      ) : null}

      {!selectedTask && !queueTasks.length ? (
        <div className="tasks-list" id="tasksList"></div>
      ) : null}
    </>
  );
}
