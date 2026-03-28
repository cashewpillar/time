import { useEffect, useState } from "react";
import { formatTime } from "../lib/time";

const MOBILE_TIMER_NOTE_KEY = "time-mobile-timer-note-dismissed-v1";

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
  const [showMobileTimerNote, setShowMobileTimerNote] = useState(false);

  useEffect(() => {
    setTimerTargetDraft(formatTime(targetSeconds));
  }, [targetSeconds]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const dismissed = window.localStorage.getItem(MOBILE_TIMER_NOTE_KEY) === "true";
    const isMobileViewport = window.matchMedia("(hover: none), (pointer: coarse), (max-width: 679px)").matches;
    setShowMobileTimerNote(isMobileViewport && !dismissed);
  }, []);

  const startPauseLabel = isRunning ? "Pause" : (elapsedSeconds === 0 ? "Start" : "Resume");

  function commitTarget(value: string) {
    if (!onCommitTarget(value)) {
      setTimerTargetDraft(formatTime(targetSeconds));
    }
  }

  function dismissMobileTimerNote() {
    window.localStorage.setItem(MOBILE_TIMER_NOTE_KEY, "true");
    setShowMobileTimerNote(false);
  }

  return (
    <>
      {showMobileTimerNote ? (
        <div className="mobile-timer-modal" role="dialog" aria-modal="true" aria-labelledby="mobileTimerNoteTitle">
          <button
            className="mobile-timer-modal-backdrop"
            type="button"
            aria-label="Dismiss mobile timer note"
            onClick={dismissMobileTimerNote}
          ></button>

          <div className="mobile-timer-modal-card">
            <div className="mobile-timer-note-title" id="mobileTimerNoteTitle">Mobile Browser Limitation</div>
            <p className="mobile-timer-note-copy">
              Mobile browsers may delay sounds and notifications after you lock your phone or switch tabs.
            </p>
            <p className="mobile-timer-note-copy">
              The timer will still catch up when the page wakes back up.
            </p>
            <button className="mobile-timer-note-btn" type="button" onClick={dismissMobileTimerNote}>
              Got it
            </button>
          </div>
        </div>
      ) : null}

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

      <p className="mobile-timer-reminder">
        Mobile background alerts may be delayed or missed.
      </p>
    </>
  );
}
