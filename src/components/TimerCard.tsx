import { useEffect, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent, WheelEvent as ReactWheelEvent } from "react";
import {
  formatManualDuration,
  formatTimerTime,
  parseManualDurationInput
} from "../lib/time";
import type { RecentTaskSlot } from "../types/app";

const MOBILE_TIMER_NOTE_KEY = "time-mobile-timer-note-dismissed-v1";
const TIMER_VIEW_MODE_KEY = "time-timer-view-mode-v1";
const CUSTOM_TIMER_MINUTES_KEY = "time-custom-timer-minutes-v1";
const CUSTOM_MANUAL_HOURS_KEY = "time-custom-manual-hours-v1";
const CUSTOM_MANUAL_MINUTES_KEY = "time-custom-manual-minutes-v1";
const CUSTOM_MANUAL_OPEN_KEY = "time-custom-manual-open-v1";
const DURATION_PRESETS_MINUTES = [10, 15, 20, 25, 30, 45];
type TimerViewMode = "timer" | "manual";
type ScrollFadeState = {
  showStart: boolean;
  showEnd: boolean;
};

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
  onClearRecentSlots: () => void;
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
  onClearRecentSlots,
  onManualLog
}: TimerCardProps) {
  const dragStateRef = useRef<{ element: HTMLDivElement; startX: number; startScrollLeft: number; didDrag: boolean } | null>(null);
  const suppressClickRef = useRef(false);
  const timerPresetScrollRef = useRef<HTMLDivElement | null>(null);
  const manualPresetScrollRef = useRef<HTMLDivElement | null>(null);
  const recentSlotScrollRef = useRef<HTMLDivElement | null>(null);
  const [showMobileTimerNote, setShowMobileTimerNote] = useState(false);
  const [viewMode, setViewMode] = useState<TimerViewMode>(() => {
    if (typeof window === "undefined") return "timer";
    const saved = window.localStorage.getItem(TIMER_VIEW_MODE_KEY);
    return saved === "manual" ? "manual" : "timer";
  });
  const [manualDurationDraft, setManualDurationDraft] = useState(() => {
    if (typeof window === "undefined") return "00:30";
    const savedHours = window.localStorage.getItem(CUSTOM_MANUAL_HOURS_KEY);
    const savedMinutes = window.localStorage.getItem(CUSTOM_MANUAL_MINUTES_KEY);
    if (savedHours !== null || savedMinutes !== null) {
      return `${String(Number(savedHours || "0")).padStart(2, "0")}:${String(Number(savedMinutes || "0")).padStart(2, "0")}`;
    }
    return "00:30";
  });
  const [customTimerMinutesDraft, setCustomTimerMinutesDraft] = useState(() => {
    if (typeof window === "undefined") return String(Math.max(1, Math.round(targetSeconds / 60)));
    return window.localStorage.getItem(CUSTOM_TIMER_MINUTES_KEY) || String(Math.max(1, Math.round(targetSeconds / 60)));
  });
  const [customManualHoursDraft, setCustomManualHoursDraft] = useState(() => {
    if (typeof window === "undefined") return "0";
    return window.localStorage.getItem(CUSTOM_MANUAL_HOURS_KEY) || "0";
  });
  const [customManualMinutesDraft, setCustomManualMinutesDraft] = useState(() => {
    if (typeof window === "undefined") return "30";
    return window.localStorage.getItem(CUSTOM_MANUAL_MINUTES_KEY) || "30";
  });
  const [selectedManualSlotId, setSelectedManualSlotId] = useState<string | null>(null);
  const [isSubmittingManualLog, setIsSubmittingManualLog] = useState(false);
  const [showCustomTimerInput, setShowCustomTimerInput] = useState(() => !DURATION_PRESETS_MINUTES.includes(Math.round(targetSeconds / 60)));
  const [showCustomManualInput, setShowCustomManualInput] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(CUSTOM_MANUAL_OPEN_KEY) === "true";
  });
  const [timerPresetFade, setTimerPresetFade] = useState<ScrollFadeState>({ showStart: false, showEnd: true });
  const [manualPresetFade, setManualPresetFade] = useState<ScrollFadeState>({ showStart: false, showEnd: true });
  const [recentSlotFade, setRecentSlotFade] = useState<ScrollFadeState>({ showStart: false, showEnd: true });

  useEffect(() => {
    setShowCustomTimerInput(!DURATION_PRESETS_MINUTES.includes(Math.round(targetSeconds / 60)));
    if (!DURATION_PRESETS_MINUTES.includes(Math.round(targetSeconds / 60))) {
      setCustomTimerMinutesDraft(String(Math.max(1, Math.round(targetSeconds / 60))));
    }
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
    if (typeof window === "undefined") return;
    window.localStorage.setItem(CUSTOM_TIMER_MINUTES_KEY, customTimerMinutesDraft);
  }, [customTimerMinutesDraft]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(CUSTOM_MANUAL_HOURS_KEY, customManualHoursDraft);
  }, [customManualHoursDraft]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(CUSTOM_MANUAL_MINUTES_KEY, customManualMinutesDraft);
  }, [customManualMinutesDraft]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(CUSTOM_MANUAL_OPEN_KEY, String(showCustomManualInput));
  }, [showCustomManualInput]);

  const startPauseLabel = isRunning ? "Pause" : (elapsedSeconds === 0 ? "Start" : "Resume");
  const selectedRecentSlot = recentTaskSlots.find((slot) => slot.id === selectedManualSlotId) || null;
  const hasManualTarget = Boolean(selectedTaskName || selectedRecentSlot);
  const activeTimerPresetMinutes = targetSeconds % 60 === 0 ? targetSeconds / 60 : null;
  const customManualDurationSeconds = (() => {
    const hours = Number(customManualHoursDraft || "0");
    const minutes = Number(customManualMinutesDraft || "0");
    if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours < 0 || minutes < 0) return 0;
    return (hours * 60 + minutes) * 60;
  })();
  const activeManualPresetMinutes = (() => {
    if (showCustomManualInput) return null;
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
    const totalMinutes = Math.round(selectedRecentSlot.lastDurationSeconds / 60);
    setCustomManualHoursDraft(String(Math.floor(totalMinutes / 60)));
    setCustomManualMinutesDraft(String(totalMinutes % 60));
    setShowCustomManualInput(!DURATION_PRESETS_MINUTES.includes(totalMinutes));
  }, [selectedRecentSlot?.id, selectedRecentSlot?.lastDurationSeconds]);

  function applyRecentSlot(slot: RecentTaskSlot) {
    setSelectedManualSlotId(slot.id);
    onSelectRecentSlot(slot);
    if (typeof slot.lastDurationSeconds === "number") {
      setManualDurationDraft(formatManualDuration(slot.lastDurationSeconds));
      const totalMinutes = Math.round(slot.lastDurationSeconds / 60);
      setCustomManualHoursDraft(String(Math.floor(totalMinutes / 60)));
      setCustomManualMinutesDraft(String(totalMinutes % 60));
      setShowCustomManualInput(!DURATION_PRESETS_MINUTES.includes(totalMinutes));
    }
  }

  function commitTarget(value: string) {
    if (!onCommitTarget(value)) {
      setCustomTimerMinutesDraft(String(Math.max(1, Math.round(targetSeconds / 60))));
    }
  }

  function commitCustomTimerMinutes(value: string) {
    const parsedMinutes = Number(value);
    if (!Number.isFinite(parsedMinutes) || parsedMinutes <= 0) {
      setCustomTimerMinutesDraft(String(Math.max(1, Math.round(targetSeconds / 60))));
      return;
    }

    const normalizedMinutes = Math.round(parsedMinutes);
    setCustomTimerMinutesDraft(String(normalizedMinutes));
    commitTarget(`${String(normalizedMinutes).padStart(2, "0")}:00`);
  }

  function selectTimerPreset(minutes: number) {
    setShowCustomTimerInput(false);
    onCommitTarget(`${String(minutes).padStart(2, "0")}:00`);
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
    setShowCustomTimerInput(true);
  }

  function openCustomManualInput() {
    setShowCustomManualInput(true);
  }

  function normalizeCustomManualHours(value: string) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setCustomManualHoursDraft("0");
      return;
    }

    setCustomManualHoursDraft(String(Math.floor(parsed)));
  }

  function normalizeCustomManualMinutes(value: string) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setCustomManualMinutesDraft("0");
      return;
    }

    setCustomManualMinutesDraft(String(Math.min(59, Math.floor(parsed))));
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

  function computeFadeState(element: HTMLDivElement | null): ScrollFadeState {
    if (!element) {
      return { showStart: false, showEnd: false };
    }

    const maxScrollLeft = element.scrollWidth - element.clientWidth;
    if (maxScrollLeft <= 1) {
      return { showStart: false, showEnd: false };
    }

    return {
      showStart: element.scrollLeft > 1,
      showEnd: element.scrollLeft < maxScrollLeft - 1
    };
  }

  useEffect(() => {
    const updateFadeStates = () => {
      setTimerPresetFade(computeFadeState(timerPresetScrollRef.current));
      setManualPresetFade(computeFadeState(manualPresetScrollRef.current));
      setRecentSlotFade(computeFadeState(recentSlotScrollRef.current));
    };

    updateFadeStates();
    window.addEventListener("resize", updateFadeStates);
    return () => window.removeEventListener("resize", updateFadeStates);
  }, [recentTaskSlots.length, showCustomManualInput, showCustomTimerInput, viewMode]);

  async function handleManualLogSubmit() {
    const parsed = showCustomManualInput ? customManualDurationSeconds : parseManualDurationInput(manualDurationDraft);
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

  const currentManualDurationSeconds = showCustomManualInput
    ? customManualDurationSeconds
    : (parseManualDurationInput(manualDurationDraft) || 0);

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
            <div
              className={`timer-preset-scroll${timerPresetFade.showStart ? " fade-start" : ""}${timerPresetFade.showEnd ? " fade-end" : ""}`}
            >
              <div
                ref={timerPresetScrollRef}
                className="timer-preset-list"
                role="group"
                aria-label="Timer target presets"
                onMouseDown={handleHorizontalDragStart}
                onScroll={() => setTimerPresetFade(computeFadeState(timerPresetScrollRef.current))}
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
                      type="number"
                      min="1"
                      step="1"
                      inputMode="numeric"
                      value={customTimerMinutesDraft}
                      aria-label="Custom timer minutes"
                      placeholder="45"
                      onChange={(event) => setCustomTimerMinutesDraft(event.target.value)}
                      onBlur={(event) => commitCustomTimerMinutes(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          commitCustomTimerMinutes(event.currentTarget.value);
                          event.currentTarget.blur();
                        }
                      }}
                    />
                    <span>min</span>
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
            <div
              className={`timer-preset-scroll${manualPresetFade.showStart ? " fade-start" : ""}${manualPresetFade.showEnd ? " fade-end" : ""}`}
            >
              <div
                ref={manualPresetScrollRef}
                className="timer-preset-list"
                role="group"
                aria-label="Manual duration presets"
                onMouseDown={handleHorizontalDragStart}
                onScroll={() => setManualPresetFade(computeFadeState(manualPresetScrollRef.current))}
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
                      id="manualDurationHoursInput"
                      type="number"
                      min="0"
                      step="1"
                      inputMode="numeric"
                      value={customManualHoursDraft}
                      aria-label="Manual duration hours"
                      placeholder="0"
                      onChange={(event) => setCustomManualHoursDraft(event.target.value)}
                      onBlur={(event) => normalizeCustomManualHours(event.target.value)}
                    />
                    <span>hr</span>
                    <input
                      id="manualDurationMinutesInput"
                      type="number"
                      min="0"
                      max="59"
                      step="1"
                      inputMode="numeric"
                      value={customManualMinutesDraft}
                      aria-label="Manual duration minutes"
                      placeholder="30"
                      onChange={(event) => setCustomManualMinutesDraft(event.target.value)}
                      onBlur={(event) => normalizeCustomManualMinutes(event.target.value)}
                    />
                    <span>min</span>
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
              <div className="manual-slot-heading-row">
                <div className="manual-slot-heading">Recent slots from the last 3 days</div>
                <button className="manual-slot-clear-btn" type="button" onClick={onClearRecentSlots}>
                  Clear
                </button>
              </div>
              <div
                className={`manual-slot-scroll${recentSlotFade.showStart ? " fade-start" : ""}${recentSlotFade.showEnd ? " fade-end" : ""}`}
              >
                <div
                  ref={recentSlotScrollRef}
                  className="manual-slot-list"
                  onMouseDown={handleHorizontalDragStart}
                  onScroll={() => setRecentSlotFade(computeFadeState(recentSlotScrollRef.current))}
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
              disabled={!hasManualTarget || currentManualDurationSeconds <= 0 || isSubmittingManualLog}
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
