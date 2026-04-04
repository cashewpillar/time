import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { HorizontalPillStrip } from "./HorizontalPillStrip";

export const SESSION_LABEL_PRESETS = [
  "brute-force debugging",
  "stuck on repro",
  "frustrated",
  "energized"
] as const;

const SESSION_LABEL_PLACEHOLDER = "Label";

type SessionLabelFieldProps = {
  value: string;
  onChange: (value: string) => void;
  inputId: string;
  className?: string;
};

export function SessionLabelField({ value, onChange, inputId, className = "" }: SessionLabelFieldProps) {
  const trimmedValue = value.trim();
  const isPresetSelected = SESSION_LABEL_PRESETS.includes(trimmedValue as typeof SESSION_LABEL_PRESETS[number]);
  const isCustomSelected = Boolean(trimmedValue) && !isPresetSelected;
  const customInputValue = isPresetSelected ? "" : value;
  const customInputRef = useRef<HTMLInputElement | null>(null);
  const customInputMeasureRef = useRef<HTMLSpanElement | null>(null);
  const [isCustomOpen, setIsCustomOpen] = useState(isCustomSelected);
  const [customInputWidth, setCustomInputWidth] = useState<number | null>(null);

  useEffect(() => {
    if (isCustomSelected) {
      setIsCustomOpen(true);
    }
  }, [isCustomSelected]);

  useEffect(() => {
    if (!isCustomOpen) return;
    customInputRef.current?.focus();
  }, [isCustomOpen]);

  useLayoutEffect(() => {
    const measure = customInputMeasureRef.current;
    if (!measure || !isCustomOpen) return;

    const nextWidth = Math.ceil(measure.getBoundingClientRect().width) + 2;
    setCustomInputWidth(nextWidth);
  }, [customInputValue, isCustomOpen]);

  return (
    <div className={`session-label-field${className ? ` ${className}` : ""}`}>
      <div className="timer-preset-heading">Session label</div>
      <HorizontalPillStrip ariaLabel="Session label presets" listClassName="session-label-options">
        {isCustomOpen ? (
          <label className="timer-preset-chip timer-preset-chip-custom active session-label-chip-custom" htmlFor={inputId}>
            <span>Custom</span>
            <input
              ref={customInputRef}
              id={inputId}
              className="session-label-input-inline timer-preset-chip-custom-input"
              type="text"
              maxLength={80}
              placeholder={SESSION_LABEL_PLACEHOLDER}
              aria-label="Session label"
              value={customInputValue}
              style={customInputWidth ? { width: `${customInputWidth}px` } : undefined}
              onChange={(event) => onChange(event.target.value)}
            />
            <span ref={customInputMeasureRef} className="session-label-input-measure" aria-hidden="true">
              {customInputValue || SESSION_LABEL_PLACEHOLDER}
            </span>
          </label>
        ) : (
          <button
            className={`session-label-chip${isCustomSelected ? " active" : ""}`}
            type="button"
            onClick={() => {
              setIsCustomOpen(true);
              if (!isCustomSelected) onChange("");
            }}
          >
            Custom
          </button>
        )}
        {SESSION_LABEL_PRESETS.map((preset) => (
          <button
            key={preset}
            className={`session-label-chip${trimmedValue === preset ? " active" : ""}`}
            type="button"
            onClick={() => {
              setIsCustomOpen(false);
              onChange(trimmedValue === preset ? "" : preset);
            }}
          >
            {preset}
          </button>
        ))}
      </HorizontalPillStrip>
    </div>
  );
}
