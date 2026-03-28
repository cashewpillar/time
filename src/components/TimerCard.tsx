import { useEffect, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent, WheelEvent as ReactWheelEvent } from "react";
import {
  formatManualDuration,
  formatTimerTime,
  parseManualDurationInput,
  parseTimerInput
} from "../lib/time";
import type { RecentTaskSlot } from "../types/app";

const MOBILE_TIMER_NOTE_KEY = "time-mobile-timer-note-dismissed-v1";
const TIMER_VIEW_MODE_KEY = "time-timer-view-mode-v1";
const CUSTOM_TIMER_TARGET_KEY = "time-custom-timer-target-v1";
const CUSTOM_MANUAL_DURATION_KEY = "time-custom-manual-duration-v1";
const CUSTOM_MANUAL_OPEN_KEY = "time-custom-manual-open-v1";
const DURATION_PRESETS_MINUTES = [10, 15, 20, 25, 30, 45];
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
  onPreviewManualDuration: (durationSeconds: number) => void;
  onSelectRecentSlot: (slot: RecentTaskSlot) => void;
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
  onPreviewManualDuration,
  onSelectRecentSlot,
  onManualLog
}: TimerCardProps) {
  const dragStateRef = useRef<{ element: HTMLDivElement; startX: number; startScrollLeft: number; didDrag: boolean } | null>(null);
  const suppressClickRef = useRef(false);
  const [timerTargetDraft, setTimerTargetDraft] = useState(() => {
    if (typeof window === "undefined") return formatTimerTime(targetSeconds);
    return window.localStorage.getItem(CUSTOM_TIMER_TARGET_KEY) || formatTimerTime(targetSeconds);
  });
  const [showMobileTimerNote, setShowMobileTimerNote] = useState(false);
  const [viewMode, setViewMode] = useState<TimerViewMode>(() => {
    if (typeof window === "undefined") return "timer";
    const saved = window.localStorage.getItem(TIMER_VIEW_MODE_KEY);
    return saved === "manual" ? "manual" : "timer";
  });
  const [manualDurationDraft, setManualDurationDraft] = useState(() => {
    if (typeof window === "undefined") return "00:30";
    return window.localStorage.getItem(CUSTOM_MANUAL_DURATION_KEY) || "00:30";
  });
  const [selectedManualSlotId, setSelectedManualSlotId] = useState<string | null>(null);
  const [isSubmittingManualLog, setIsSubmittingManualLog] = useState(false);
  const [showCustomTimerInput, setShowCustomTimerInput] = useState(() => !DURATION_PRESETS_MINUTES.includes(Math.round(targetSeconds / 60)));
  const [showCustomManualInput, setShowCustomManualInput] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(CUSTOM_MANUAL_OPEN_KEY) === "true";
  });

  useEffect(() => {
    setTimerTargetDraft(formatTimerTime(targetSeconds));
  }, [targetSeconds]);

  useEffect(() => {
    setShowCustomTimerInput(!DURATION_PRESETS_MINUTES.includes(Math.round(targetSeconds / 60)));
  }, [targetSeconds]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const dismissed = window.localStorage.getItem(MOBILE_TIMER_NOTE_KEY) === "true";
    const isMobileViewport = window.matchMedia("(hover: none), (pointer: coarse), (max-width: 679px)").matches;
    setShowMobileTimerNote(isMobileViewport && !dismissed);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(TIMER_VIEW_MODE_KEY, viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (typeof window === "undefined" || !showCustomTimerInput) return;
    window.localStorage.setItem(CUSTOM_TIMER_TARGET_KEY, timerTargetDraft);
  }, [showCustomTimerInput, timerTargetDraft]);

  useEffect(() => {
    if (typeof window === "undefined" || !showCustomManualInput) return;
    window.localStorage.setItem(CUSTOM_MANUAL_DURATION_KEY, manualDurationDraft);
  }, [manualDurationDraft, showCustomManualInput]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(CUSTOM_MANUAL_OPEN_KEY, String(showCustomManualInput));
  }, [showCustomManualInput]);

  const startPauseLabel = isRunning ? "Pause" : (elapsedSeconds === 0 ? "Start" : "Resume");
  const selectedRecentSlot = recentTaskSlots.find((slot) => slot.id === selectedManualSlotId) || null;
  const hasManualTarget = Boolean(selectedTaskName || selectedRecentSlot);
  const manualTargetLabel = selectedRecentSlot?.taskText || selectedTaskName || "Pick a task or choose a recent slot";
  const activeTimerPresetMinutes = targetSeconds % 60 === 0 ? targetSeconds / 60 : null;
  const activeManualPresetMinutes = (() => {
    const parsed = parseManualDurationInput(manualDurationDraft);
    if (!parsed || parsed % 60 !== 0) return null;
    return parsed / 60;
  })();

  useEffect(() => {
    if (!selectedRecentSlot) return;

    const selectedRecentSlotContext = `${selectedRecentSlot.workspaceName} / ${selectedRecentSlot.projectName}`;
    if (!selectedTaskName || selectedTaskName !== selectedRecentSlot.taskText || selectedTaskContext !== selectedRecentSlotContext) {
      setSelectedManualSlotId(null);
    }
  }, [selectedRecentSlot, selectedTaskContext, selectedTaskName]);

  useEffect(() => {
    if (typeof selectedRecentSlot?.lastDurationSeconds !== "number") return;
    setManualDurationDraft(formatManualDuration(selectedRecentSlot.lastDurationSeconds));
    setShowCustomManualInput(!DURATION_PRESETS_MINUTES.includes(Math.round(selectedRecentSlot.lastDurationSeconds / 60)));
  }, [selectedRecentSlot?.id, selectedRecentSlot?.lastDurationSeconds]);

  function applyRecentSlot(slot: RecentTaskSlot) {
    setSelectedManualSlotId(slot.id);
    onSelectRecentSlot(slot);
    if (typeof slot.lastDurationSeconds === "number") {
      setManualDurationDraft(formatManualDuration(slot.lastDurationSeconds));
      setShowCustomManualInput(!DURATION_PRESETS_MINUTES.includes(Math.round(slot.lastDurationSeconds / 60)));
    }
  }

  function commitTarget(value: string) {
    if (!onCommitTarget(value)) {
      setTimerTargetDraft(formatTimerTime(targetSeconds));
    }
  }

  function selectTimerPreset(minutes: number) {
    const nextValue = `${String(minutes).padStart(2, "0")}:00`;
    setTimerTargetDraft(nextValue);
    setShowCustomTimerInput(false);
    onCommitTarget(nextValue);
  }

  function selectManualPreset(minutes: number) {
    const durationSeconds = minutes * 60;
    setManualDurationDraft(formatManualDuration(durationSeconds));
    setShowCustomManualInput(false);
    onPreviewManualDuration(durationSeconds);
  }

  function dismissMobileTimerNote() {
    window.localStorage.setItem(MOBILE_TIMER_NOTE_KEY, "true");
    setShowMobileTimerNote(false);
  }

  function openCustomTimerInput() {
    if (typeof window !== "undefined") {
      setTimerTargetDraft(window.localStorage.getItem(CUSTOM_TIMER_TARGET_KEY) || timerTargetDraft);
    }
    setShowCustomTimerInput(true);
  }

  function openCustomManualInput() {
    if (typeof window !== "undefined") {
      setManualDurationDraft(window.localStorage.getItem(CUSTOM_MANUAL_DURATION_KEY) || manualDurationDraft);
    }
    setShowCustomManualInput(true);
  }

  useEffect(() => {
    function handleWindowMouseMove(event: MouseEvent) {
      const dragState = dragStateRef.current;
      if (!dragState) return;

      const deltaX = event.clientX - dragState.startX;
      if (Math.abs(deltaX) > 10) {
        dragState.didDrag = true;
        suppressClickRef.current = true;
        dragState.element.dataset.dragging = "true";
      }

      dragState.element.scrollLeft = dragState.startScrollLeft - deltaX;
      if (dragState.didDrag) {
        event.preventDefault();
      }
    }

    function handleWindowMouseUp() {
      if (!dragStateRef.current) return;
      delete dragStateRef.current.element.dataset.dragging;
      dragStateRef.current = null;
    }

    window.addEventListener("mousemove", handleWindowMouseMove);
    window.addEventListener("mouseup", handleWindowMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleWindowMouseMove);
      window.removeEventListener("mouseup", handleWindowMouseUp);
    };
  }, []);

  function handleHorizontalDragStart(event: ReactMouseEvent<HTMLDivElement>) {
    if (event.button !== 0) return;

    suppressClickRef.current = false;
    dragStateRef.current = {
      element: event.currentTarget,
      startX: event.clientX,
      startScrollLeft: event.currentTarget.scrollLeft,
      didDrag: false
    };
  }

  function handleHorizontalDragClickCapture(event: ReactMouseEvent<HTMLDivElement>) {
    if (!suppressClickRef.current) return;

    event.preventDefault();
    event.stopPropagation();
    suppressClickRef.current = false;
  }

  function handleHorizontalWheel(event: ReactWheelEvent<HTMLDivElement>) {
    const element = event.currentTarget;
    const canScrollHorizontally = element.scrollWidth > element.clientWidth;
    if (!canScrollHorizontally) return;

    const horizontalDelta = event.deltaX;
    const verticalDelta = event.deltaY;
    const intendedDelta = Math.abs(horizontalDelta) > 0 ? horizontalDelta : verticalDelta;
    if (intendedDelta === 0) return;

    element.scrollBy({
      left: intendedDelta,
      behavior: "smooth"
    });
    event.preventDefault();
  }

  async function handleManualLogSubmit() {
    const parsed = parseManualDurationInput(manualDurationDraft);
    if (!parsed || parsed <= 0 || isSubmittingManualLog) return;

    setIsSubmittingManualLog(true);
    try {
      const didSave = await onManualLog(parsed, selectedManualSlotId);
      if (didSave && !showCustomManualInput) {
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
        {selectedTaskContext ? <div className="timer-focus-context">{selectedTaskContext}</div> : null}
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
          <div className="timer-preset-group">
            <div className="timer-preset-heading">Target</div>
            <div className="timer-preset-scroll">
              <div
                className="timer-preset-list"
                role="group"
                aria-label="Timer target presets"
                onMouseDown={handleHorizontalDragStart}
                onWheel={handleHorizontalWheel}
                onClickCapture={handleHorizontalDragClickCapture}
              >
                {DURATION_PRESETS_MINUTES.map((minutes) => (
                  <button
                    key={minutes}
                    className={`timer-preset-chip${activeTimerPresetMinutes === minutes && !showCustomTimerInput ? " active" : ""}`}
                    type="button"
                    onClick={() => selectTimerPreset(minutes)}
                  >
                    {minutes}m
                  </button>
                ))}
                {showCustomTimerInput ? (
                  <label className="timer-preset-chip timer-preset-chip-custom active" htmlFor="timerTargetInput">
                    <span>Custom</span>
                    <input
                      id="timerTargetInput"
                      type="text"
                      inputMode="numeric"
                      value={timerTargetDraft}
                      aria-label="Timer target"
                      placeholder="00:00"
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
                ) : (
                  <button
                    className="timer-preset-chip"
                    type="button"
                    onClick={openCustomTimerInput}
                  >
                    Custom
                  </button>
                )}
              </div>
            </div>
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
          <div className="timer-preset-group">
            <div className="timer-preset-heading">Time spent</div>
            <div className="timer-preset-scroll">
              <div
                className="timer-preset-list"
                role="group"
                aria-label="Manual duration presets"
                onMouseDown={handleHorizontalDragStart}
                onWheel={handleHorizontalWheel}
                onClickCapture={handleHorizontalDragClickCapture}
              >
                {DURATION_PRESETS_MINUTES.map((minutes) => (
                  <button
                    key={minutes}
                    className={`timer-preset-chip${activeManualPresetMinutes === minutes && !showCustomManualInput ? " active" : ""}`}
                    type="button"
                    onClick={() => selectManualPreset(minutes)}
                  >
                    {minutes}m
                  </button>
                ))}
                {showCustomManualInput ? (
                  <label className="timer-preset-chip timer-preset-chip-custom active" htmlFor="manualDurationInput">
                    <span>Custom</span>
                    <input
                      id="manualDurationInput"
                      type="text"
                      inputMode="numeric"
                      value={manualDurationDraft}
                      aria-label="Manual duration (hours and minutes)"
                      placeholder="00:00"
                      onChange={(event) => setManualDurationDraft(event.target.value)}
                    />
                  </label>
                ) : (
                  <button
                    className="timer-preset-chip"
                    type="button"
                    onClick={openCustomManualInput}
                  >
                    Custom
                  </button>
                )}
              </div>
            </div>
          </div>

          {recentTaskSlots.length ? (
            <div className="manual-slot-group">
              <div className="manual-slot-heading">Recent slots from the last 3 days</div>
              <div className="manual-slot-scroll">
                <div
                  className="manual-slot-list"
                  onMouseDown={handleHorizontalDragStart}
                  onWheel={handleHorizontalWheel}
                  onClickCapture={handleHorizontalDragClickCapture}
                >
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
