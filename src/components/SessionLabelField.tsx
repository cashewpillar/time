export const SESSION_LABEL_PRESETS = [
  "brute-force debugging",
  "stuck on repro"
] as const;

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

  return (
    <div className={`session-label-field${className ? ` ${className}` : ""}`}>
      <div className="timer-preset-heading">Session label</div>
      <div className="session-label-options" role="group" aria-label="Session label presets">
        {SESSION_LABEL_PRESETS.map((preset) => (
          <button
            key={preset}
            className={`session-label-chip${trimmedValue === preset ? " active" : ""}`}
            type="button"
            onClick={() => onChange(trimmedValue === preset ? "" : preset)}
          >
            {preset}
          </button>
        ))}
        <button
          className={`session-label-chip${isCustomSelected ? " active" : ""}`}
          type="button"
          onClick={() => {
            if (!isCustomSelected) onChange("");
          }}
        >
          Custom
        </button>
      </div>
      <input
        id={inputId}
        className="task-input session-label-input"
        type="text"
        maxLength={80}
        placeholder="Optional custom session label"
        aria-label="Session label"
        value={isPresetSelected ? "" : value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
