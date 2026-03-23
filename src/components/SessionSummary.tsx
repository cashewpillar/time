type SessionSummaryProps = {
  completedSessions: number;
  message: string;
};

export function SessionSummary({ completedSessions, message }: SessionSummaryProps) {
  return (
    <section className="session-copy" aria-live="polite">
      <span className="session-count" id="sessionCount">#{Math.max(1, completedSessions + 1)}</span>
      <div className="session-title" id="sessionMessage">{message}</div>
    </section>
  );
}
