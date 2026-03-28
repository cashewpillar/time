import { useEffect, useState } from "react";
import {
  formatManualDuration,
  formatTimerTime,
  parseManualDurationInput,
  parseTimerInput
} from "../lib/time";
import type { RecentTaskSlot } from "../types/app";

const MOBILE_TIMER_NOTE_KEY = "time-mobile-timer-note-dismissed-v1";
type TimerViewMode = "timer" | "manual";

type TimerCardProps = {
  elapsedSeconds: number;
  targetSeconds: number;
  isRunning: boolean;
  selectedTaskName: string | null;
  selectedTaskContext: string | null;
  recentTaskSlots: RecentTaskSlot[];
  timerStatusMessage: string | null;
  shouldHighlightStart: boolean;
  onToggleTimer: () => void;
  onReset: () => void;
  onCommitTarget: (value: string) => boolean;
  onManualLog: (durationSeconds: number, slotId: string | null) => Promise<boolean>;
};

export function TimerCard({
  elapsedSeconds,
  targetSeconds,
  isRunning,
  selectedTaskName,
  selectedTaskContext,
  recentTaskSlots,
  timerStatusMessage,
  shouldHighlightStart,
  onToggleTimer,
  onReset,
  onCommitTarget,
  onManualLog
}: TimerCardProps) {
  const [timerTargetDraft, setTimerTargetDraft] = useState(() => formatTimerTime(targetSeconds));
  const [showMobileTimerNote, setShowMobileTimerNote] = useState(false);
  const [viewMode, setViewMode] = useState<TimerViewMode>("timer");
  const [manualDurationDraft, setManualDurationDraft] = useState("00:30");
  const [selectedManualSlotId, setSelectedManualSlotId] = useState<string | null>(null);
  const [isSubmittingManualLog, setIsSubmittingManualLog] = useState(false);
  const [manualStepMinutes, setManualStepMinutes] = useState(5);

  useEffect(() => {
    setTimerTargetDraft(formatTimerTime(targetSeconds));
  }, [targetSeconds]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const dismissed = window.localStorage.getItem(MOBILE_TIMER_NOTE_KEY) === "true";
    const isMobileViewport = window.matchMedia("(hover: none), (pointer: coarse), (max-width: 679px)").matches;
    setShowMobileTimerNote(isMobileViewport && !dismissed);
  }, []);

  useEffect(() => {
    if (!selectedTaskName || selectedManualSlotId !== null) return;
    setSelectedManualSlotId(null);
  }, [selectedManualSlotId, selectedTaskName]);

  const startPauseLabel = isRunning ? "Pause" : (elapsedSeconds === 0 ? "Start" : "Resume");
  const selectedRecentSlot = recentTaskSlots.find((slot) => slot.id === selectedManualSlotId) || null;
  const hasManualTarget = Boolean(selectedTaskName || selectedRecentSlot);
  const manualTargetLabel = selectedRecentSlot
    ? `${selectedRecentSlot.taskText} / ${selectedRecentSlot.projectName}`
    : (selectedTaskName || "Pick a task or choose a recent slot");

  useEffect(() => {
    if (typeof selectedRecentSlot?.lastDurationSeconds !== "number") return;
    setManualDurationDraft(formatManualDuration(selectedRecentSlot.lastDurationSeconds));
  }, [selectedRecentSlot?.id, selectedRecentSlot?.lastDurationSeconds]);

  function adjustManualDuration(direction: 1 | -1) {
    const currentValue = parseManualDurationInput(manualDurationDraft) || 0;
    const nextValue = Math.max(0, currentValue + direction * manualStepMinutes * 60);
    setManualDurationDraft(formatManualDuration(nextValue));
  }

  function applyRecentSlot(slot: RecentTaskSlot) {
    setSelectedManualSlotId(slot.id);
    if (typeof slot.lastDurationSeconds === "number") {
      setManualDurationDraft(formatManualDuration(slot.lastDurationSeconds));
    }
  }

  function commitTarget(value: string) {
    if (!onCommitTarget(value)) {
      setTimerTargetDraft(formatTimerTime(targetSeconds));
    }
  }

  function dismissMobileTimerNote() {
    window.localStorage.setItem(MOBILE_TIMER_NOTE_KEY, "true");
    setShowMobileTimerNote(false);
  }

  async function handleManualLogSubmit() {
    const parsed = parseManualDurationInput(manualDurationDraft);
    if (!parsed || parsed <= 0 || isSubmittingManualLog) return;

    setIsSubmittingManualLog(true);
    try {
      const didSave = await onManualLog(parsed, selectedManualSlotId);
      if (didSave) {
        setManualDurationDraft("00:30");
      }
    } finally {
      setIsSubmittingManualLog(false);
    }
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

      <div className="timer-view-toggle" role="tablist" aria-label="Timer mode">
        <button
          className={`timer-view-chip${viewMode === "timer" ? " active" : ""}`}
          type="button"
          role="tab"
          aria-selected={viewMode === "timer"}
          aria-controls="timerViewPanel"
          onClick={() => setViewMode("timer")}
        >
          Live timer
        </button>
        <button
          className={`timer-view-chip${viewMode === "manual" ? " active" : ""}`}
          type="button"
          role="tab"
          aria-selected={viewMode === "manual"}
          aria-controls="timerViewPanel"
          onClick={() => setViewMode("manual")}
        >
          Log time
        </button>
      </div>

      {viewMode === "timer" ? (
        <div id="timerViewPanel" role="tabpanel">
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
            {formatTimerTime(elapsedSeconds)}
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
        </div>
      ) : (
        <div className="manual-log-panel" id="timerViewPanel" role="tabpanel">
          <label className="timer-config manual-duration-field" htmlFor="manualDurationInput">
            Time spent
            <input
              id="manualDurationInput"
              type="text"
              inputMode="numeric"
              value={manualDurationDraft}
              aria-label="Manual duration (hours and minutes)"
              onChange={(event) => setManualDurationDraft(event.target.value)}
            />
          </label>

          <div className="manual-adjusters">
            <button className="manual-step-btn" type="button" onClick={() => adjustManualDuration(-1)}>
              -{manualStepMinutes}m
            </button>
            <div className="manual-step-toggle" role="group" aria-label="Duration step size">
              <button
                className={`manual-step-chip${manualStepMinutes === 5 ? " active" : ""}`}
                type="button"
                onClick={() => setManualStepMinutes(5)}
              >
                5m
              </button>
              <button
                className={`manual-step-chip${manualStepMinutes === 10 ? " active" : ""}`}
                type="button"
                onClick={() => setManualStepMinutes(10)}
              >
                10m
              </button>
            </div>
            <button className="manual-step-btn" type="button" onClick={() => adjustManualDuration(1)}>
              +{manualStepMinutes}m
            </button>
          </div>

          <div className="manual-target-card" aria-live="polite">
            <div className="manual-target-label">Logging against</div>
            <div className="manual-target-name">{manualTargetLabel}</div>
            {selectedRecentSlot ? (
              <div className="manual-target-meta">{selectedRecentSlot.workspaceName} / {selectedRecentSlot.projectName}</div>
            ) : selectedTaskContext ? (
              <div className="manual-target-meta">{selectedTaskContext}</div>
            ) : null}
          </div>

          {recentTaskSlots.length ? (
            <div className="manual-slot-group">
              <div className="manual-slot-heading">Recent slots from the last 3 days</div>
              <div className="manual-slot-list">
                {recentTaskSlots.map((slot) => (
                  <button
                    key={slot.id}
                    className={`manual-slot-chip${selectedManualSlotId === slot.id ? " active" : ""}`}
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      applyRecentSlot(slot);
                    }}
                    onClick={() => applyRecentSlot(slot)}
                  >
                    <span>{slot.taskText}</span>
                    <span>
                      {slot.workspaceName} / {slot.projectName}
                      {slot.lastDurationSeconds ? ` / ${formatManualDuration(slot.lastDurationSeconds)}` : ""}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="timer-actions manual-actions">
            <button
              className="primary-btn"
              type="button"
              onClick={() => void handleManualLogSubmit()}
              disabled={!hasManualTarget || !parseManualDurationInput(manualDurationDraft) || isSubmittingManualLog}
            >
              {isSubmittingManualLog ? "Logging..." : "Save time"}
            </button>
          </div>
        </div>
      )}

      {timerStatusMessage ? (
        <div className="timer-status" role="status" aria-live="polite">
          {timerStatusMessage}
        </div>
      ) : null}

      {viewMode === "timer" ? (
        <p className="mobile-timer-reminder">
          Mobile background alerts may be delayed or missed. Manual log mode works better if your phone suspends timers in the background.
        </p>
      ) : null}
    </>
  );
}
