import { TaskComposer } from "./TaskComposer";
import type { Project, Task, TaskDraft } from "../types/app";

type TaskListProps = {
  project: Project | null;
  editingTask: Task | null;
  taskTypeOptions: string[];
  onEditTask: (taskId: string) => void;
  onToggleTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onClearCompleted: () => void;
  onCancelEdit: () => void;
  onSaveTask: (draft: TaskDraft, customType: string) => void;
};

export function TaskList({
  project,
  editingTask,
  taskTypeOptions,
  onEditTask,
  onToggleTask,
  onDeleteTask,
  onClearCompleted,
  onCancelEdit,
  onSaveTask
}: TaskListProps) {
  return (
    <>
      <div className="tasks-head">
        <h2 className="tasks-title" id="tasksHeading">Tasks</h2>
        <button className="menu-btn" type="button" id="clearCompletedBtn" aria-label="Clear completed tasks" onClick={onClearCompleted}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <circle cx="10" cy="4.5" r="1.7"></circle>
            <circle cx="10" cy="10" r="1.7"></circle>
            <circle cx="10" cy="15.5" r="1.7"></circle>
          </svg>
        </button>
      </div>

      <div className="tasks-divider" aria-hidden="true"></div>
      <p className="project-caption" id="projectCaption">Showing tasks for {project ? project.name : "your project"}</p>
      <div className="tasks-list" id="tasksList">
        {project?.tasks.map((task, index) => {
          const isEditing = editingTask?.id === task.id;

          return (
            <div key={task.id} className={`task-item${task.done ? " done" : ""}${isEditing ? " editing" : ""}`}>
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

              <div className={`task-copy${isEditing ? " editing" : ""}`}>
                {isEditing ? (
                  <>
                    <div className="task-meta">Task {index + 1}</div>
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
                    <div className="task-meta">Task {index + 1}</div>
                    {(task.type || task.agentEligible) ? (
                      <div className="task-badges">
                        {task.type ? <span className="task-badge">{task.type}</span> : null}
                        {task.agentEligible ? <span className="task-badge">AI Agent OK</span> : null}
                      </div>
                    ) : null}
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
        })}
      </div>
    </>
  );
}
