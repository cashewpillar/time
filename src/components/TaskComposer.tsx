import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { Outcome, TaskDraft } from "../types/app";

type TaskComposerProps = {
  isOpen: boolean;
  editingTask: Outcome | null;
  taskTypeOptions: string[];
  onOpen?: () => void;
  onCancel: () => void;
  onSave: (draft: TaskDraft, customType: string) => void;
  hideTrigger?: boolean;
  highlightTrigger?: boolean;
  className?: string;
};

type FormState = {
  text: string;
  type: string;
  customType: string;
  notes: string;
  agentEligible: boolean;
};

const emptyForm: FormState = {
  text: "",
  type: "",
  customType: "",
  notes: "",
  agentEligible: false
};

export function TaskComposer({
  isOpen,
  editingTask,
  taskTypeOptions,
  onOpen,
  onCancel,
  onSave,
  hideTrigger = false,
  highlightTrigger = false,
  className = ""
}: TaskComposerProps) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const taskInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setForm(emptyForm);
      return;
    }

    if (editingTask) {
      const normalizedType = (editingTask.type || "").toLowerCase();
      setForm({
        text: editingTask.title,
        type: taskTypeOptions.includes(normalizedType) ? normalizedType : "__custom__",
        customType: taskTypeOptions.includes(normalizedType) ? "" : editingTask.type || "",
        notes: editingTask.notes || "",
        agentEligible: Boolean(editingTask.agentEligible)
      });
    } else {
      setForm(emptyForm);
    }

    window.setTimeout(() => {
      taskInputRef.current?.focus();
    }, 0);
  }, [editingTask, isOpen, taskTypeOptions]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = form.text.trim();
    const selectedType = form.type.trim();
    const customType = form.customType.trim().toLowerCase();
    const type = selectedType === "__custom__" ? customType : selectedType;

    if (!text) {
      return;
    }

    if (selectedType === "__custom__" && !customType) {
      return;
    }

    onSave(
      {
        text,
        type,
        notes: form.notes.trim(),
        agentEligible: form.agentEligible
      },
      customType
    );
  }

  return (
    <>
      {!isOpen && !hideTrigger ? (
        <button className={`add-task-tile${highlightTrigger ? " idle-sheen" : ""}`} id="showTaskFormBtn" type="button" onClick={onOpen}>
          ⊕ Add Task
        </button>
      ) : null}

      {isOpen ? (
        <form className={`task-form open${className ? ` ${className}` : ""}`} id="taskForm" onSubmit={handleSubmit}>
          <div className="task-form-grid">
            <div className="task-input-row">
              <input
                ref={taskInputRef}
                className="task-input"
                id="taskInput"
                type="text"
                maxLength={100}
                placeholder="What are you working on?"
                aria-label="Task name"
                value={form.text}
                onChange={(event) => setForm((current) => ({ ...current, text: event.target.value }))}
              />
            </div>

            <div className="task-input-row">
              <select
                className="task-input task-type-select"
                id="taskTypeInput"
                aria-label="Task type"
                value={form.type}
                onChange={(event) => {
                  const nextType = event.target.value;
                  setForm((current) => ({
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

            <div className={`task-input-row task-type-custom${form.type === "__custom__" ? " open" : ""}`} id="taskTypeCustomRow">
              <input
                className="task-input"
                id="taskTypeCustomInput"
                type="text"
                maxLength={40}
                placeholder="Add a task type"
                aria-label="Add a task type"
                value={form.customType}
                onChange={(event) => setForm((current) => ({ ...current, customType: event.target.value }))}
              />
            </div>

            <div className="task-input-row">
              <textarea
                className="task-input task-notes"
                id="taskNotesInput"
                maxLength={400}
                placeholder="Notes"
                aria-label="Task notes"
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              ></textarea>
            </div>
          </div>

          <div className="task-form-footer">
            <div className="task-input-row task-checkbox-wrap">
              <label className="task-checkbox-row" htmlFor="taskAgentEligibleInput">
                <input
                  className="task-checkbox"
                  id="taskAgentEligibleInput"
                  type="checkbox"
                  checked={form.agentEligible}
                  onChange={(event) => setForm((current) => ({ ...current, agentEligible: event.target.checked }))}
                />
                <span>Can be handled by an AI agent</span>
              </label>
            </div>

            <div className="task-form-actions">
              <button className="task-form-btn primary" type="submit">
                {editingTask ? "Save Changes" : "Save Task"}
              </button>
              <button className="task-form-btn ghost" type="button" id="cancelTaskBtn" onClick={onCancel}>
                Cancel
              </button>
            </div>
          </div>
        </form>
      ) : null}
    </>
  );
}
