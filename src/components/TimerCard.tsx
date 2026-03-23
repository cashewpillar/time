import { useEffect, useState } from "react";
import { formatTime } from "../lib/time";

type TimerCardProps = {
  elapsedSeconds: number;
  targetSeconds: number;
  isRunning: boolean;
  selectedTaskName: string | null;
  shouldHighlightStart: boolean;
  onToggleTimer: () => void;
  onReset: () => void;
  onCommitTarget: (value: string) => boolean;
};

export function TimerCard({
  elapsedSeconds,
  targetSeconds,
  isRunning,
  selectedTaskName,
  shouldHighlightStart,
  onToggleTimer,
  onReset,
  onCommitTarget
}: TimerCardProps) {
  const [timerTargetDraft, setTimerTargetDraft] = useState(() => formatTime(targetSeconds));

  useEffect(() => {
    setTimerTargetDraft(formatTime(targetSeconds));
  }, [targetSeconds]);

  const startPauseLabel = isRunning ? "Pause" : (elapsedSeconds === 0 ? "Start" : "Resume");

  function commitTarget(value: string) {
    if (!onCommitTarget(value)) {
      setTimerTargetDraft(formatTime(targetSeconds));
    }
  }

  return (
    <>
      <div className="timer-focus-banner">
        <div className="timer-focus-label">Now focusing</div>
        <div className="timer-focus-name">{selectedTaskName || "Pick a task to start"}</div>
      </div>

      <div className="timer-config-row">
        <label className="timer-config" htmlFor="timerTargetInput">
          Target
          <input
            id="timerTargetInput"
            type="text"
            inputMode="numeric"
            value={timerTargetDraft}
            aria-label="Timer target"
            onChange={(event) => setTimerTargetDraft(event.target.value)}
            onBlur={(event) => commitTarget(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commitTarget(event.currentTarget.value);
                event.currentTarget.blur();
              }
            }}
          />
        </label>
      </div>

      <h2 className="sr-only" id="timerTitle">Project Timer</h2>
      <div className="timer-readout" id="timerDisplay" aria-live="polite">
        {formatTime(elapsedSeconds)}
      </div>

      <div className="timer-actions">
        <button
          className={`primary-btn${shouldHighlightStart ? " idle-sheen" : ""}`}
          id="startPauseBtn"
          type="button"
          onClick={onToggleTimer}
          disabled={!selectedTaskName && !isRunning}
        >
          {startPauseLabel}
        </button>
        <button className="ghost-btn" id="resetBtn" type="button" onClick={onReset}>
          Reset
        </button>
      </div>
    </>
  );
}
