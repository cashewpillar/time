import { useEffect, useState } from "react";
import type { Burst } from "../types/app";
import {
  formatManualDuration,
  formatTimerTime,
  parseManualDurationInput
} from "../lib/time";
import { ActivityHeatmap } from "./ActivityHeatmap";
import { HorizontalPillStrip } from "./HorizontalPillStrip";
import { SessionLabelField } from "./SessionLabelField";

const MOBILE_TIMER_NOTE_KEY = "time-mobile-timer-note-dismissed-v1";
const TIMER_VIEW_MODE_KEY = "time-timer-view-mode-v1";
const CUSTOM_TIMER_MINUTES_KEY = "time-custom-timer-minutes-v1";
const CUSTOM_MANUAL_HOURS_KEY = "time-custom-manual-hours-v1";
const CUSTOM_MANUAL_MINUTES_KEY = "time-custom-manual-minutes-v1";
const CUSTOM_MANUAL_OPEN_KEY = "time-custom-manual-open-v1";
const DURATION_PRESETS_MINUTES = [10, 15, 20, 25, 30, 45];
type TimerViewMode = "timer" | "manual" | "trends";

type TimerCardProps = {
  elapsedSeconds: number;
  targetSeconds: number;
  isRunning: boolean;
  bursts: Burst[];
  selectedOutcomeName: string | null;
  selectedOutcomeContext: string | null;
  timerStatusMessage: string | null;
  shouldHighlightStart: boolean;
  onToggleTimer: () => void;
  onReset: () => void;
  onCommitTarget: (value: string) => boolean;
  onPreviewManualDuration: (durationSeconds: number) => void;
  onManualLog: (durationSeconds: number, slotId: string | null, sessionLabel: string) => Promise<boolean>;
};

export function TimerCard({
  elapsedSeconds,
  targetSeconds,
  isRunning,
  bursts,
  selectedOutcomeName,
  selectedOutcomeContext,
  timerStatusMessage,
  shouldHighlightStart,
  onToggleTimer,
  onReset,
  onCommitTarget,
  onPreviewManualDuration,
  onManualLog
}: TimerCardProps) {
  const [showMobileTimerNote, setShowMobileTimerNote] = useState(false);
  const [viewMode, setViewMode] = useState<TimerViewMode>(() => {
    if (typeof window === "undefined") return "timer";
    const saved = window.localStorage.getItem(TIMER_VIEW_MODE_KEY);
    return saved === "manual" || saved === "trends" ? saved : "timer";
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
  const [sessionLabel, setSessionLabel] = useState("");
  const [isSubmittingManualLog, setIsSubmittingManualLog] = useState(false);
  const [showCustomTimerInput, setShowCustomTimerInput] = useState(() => !DURATION_PRESETS_MINUTES.includes(Math.round(targetSeconds / 60)));
  const [showCustomManualInput, setShowCustomManualInput] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(CUSTOM_MANUAL_OPEN_KEY) === "true";
  });

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

  const remainingSeconds = Math.max(0, targetSeconds - elapsedSeconds);
  const startPauseLabel = isRunning ? "Pause" : (elapsedSeconds === 0 || elapsedSeconds >= targetSeconds ? "Start" : "Resume");
  const startDisabled = !selectedOutcomeName && !isRunning;
  const startTooltip = "Select an outcome before starting the timer.";
  const hasManualTarget = Boolean(selectedOutcomeName);
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

  async function handleManualLogSubmit() {
    const parsed = showCustomManualInput ? customManualDurationSeconds : parseManualDurationInput(manualDurationDraft);
    if (!parsed || parsed <= 0 || isSubmittingManualLog) return;

    setIsSubmittingManualLog(true);
    try {
      const didSave = await onManualLog(parsed, null, sessionLabel);
      if (didSave && !showCustomManualInput) {
        setManualDurationDraft("00:30");
      }
      if (didSave) {
        setSessionLabel("");
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

      <div className="timer-card-inner">
        <div className="timer-focus-banner">
          <div className="timer-focus-label">{selectedOutcomeName ? "Now focusing" : "Not focusing"}</div>
          <div className="timer-focus-name">{selectedOutcomeName || "Pick an outcome to start"}</div>
          {selectedOutcomeContext ? <div className="timer-focus-context">{selectedOutcomeContext}</div> : null}
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
            Time logger
          </button>
          <button
            className={`timer-view-chip${viewMode === "trends" ? " active" : ""}`}
            type="button"
            role="tab"
            aria-selected={viewMode === "trends"}
            aria-controls="timerViewPanel"
            onClick={() => setViewMode("trends")}
          >
            Trends
          </button>
        </div>

        {viewMode === "timer" ? (
          <div id="timerViewPanel" role="tabpanel">
            <div className="timer-preset-group">
              <div className="timer-preset-heading">Target</div>
              <HorizontalPillStrip ariaLabel="Timer target presets">
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
                  <button className="timer-preset-chip" type="button" onClick={openCustomTimerInput}>
                    Custom
                  </button>
                )}
              </HorizontalPillStrip>
            </div>

            <h2 className="sr-only" id="timerTitle">Project Timer</h2>
            <div className="timer-readout" id="timerDisplay" aria-live="polite">
              {formatTimerTime(remainingSeconds)}
            </div>

            <div className="timer-actions">
              <span className="button-tooltip-wrap" title={startDisabled ? startTooltip : undefined}>
                <button
                  className={`primary-btn${shouldHighlightStart ? " idle-sheen" : ""}`}
                  id="startPauseBtn"
                  type="button"
                  onClick={onToggleTimer}
                  disabled={startDisabled}
                  aria-describedby={startDisabled ? "startButtonTooltip" : undefined}
                >
                  {startPauseLabel}
                </button>
              </span>
              <button className="ghost-btn" id="resetBtn" type="button" onClick={onReset}>
                Reset
              </button>
            </div>

            {startDisabled ? (
              <div className="button-tooltip-note" id="startButtonTooltip" role="note">
                {startTooltip}
              </div>
            ) : null}
          </div>
        ) : viewMode === "manual" ? (
          <div className="manual-log-panel" id="timerViewPanel" role="tabpanel">
            <div className="timer-preset-group">
              <div className="timer-preset-heading">Time spent</div>
              <HorizontalPillStrip ariaLabel="Manual duration presets">
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
                  <button className="timer-preset-chip" type="button" onClick={openCustomManualInput}>
                    Custom
                  </button>
                )}
              </HorizontalPillStrip>
            </div>

            <SessionLabelField
              value={sessionLabel}
              onChange={setSessionLabel}
              inputId="manualSessionLabelInput"
            />

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
        ) : (
          <ActivityHeatmap bursts={bursts} />
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
      </div>
    </>
  );
}
