import type { Burst } from "../types/app";

type TodayBurstGroup = {
  key: string;
  label: string;
  totalSeconds: number;
  burstCount: number;
  latestLoggedAt: number;
};

function getDateKey(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDuration(totalSeconds: number): string {
  if (totalSeconds <= 0) return "0m";

  const totalMinutes = Math.round(totalSeconds / 60);
  if (totalMinutes < 60) return `${totalMinutes}m`;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
}

function formatBurstTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit"
  });
}

function buildTodayBurstGroups(bursts: Burst[]) {
  const todayKey = getDateKey(Date.now());
  const todayBursts = bursts
    .filter((burst) => getDateKey(burst.loggedAt) === todayKey)
    .sort((left, right) => right.loggedAt - left.loggedAt);

  const grouped = Array.from(
    todayBursts.reduce((groups, burst) => {
      const label = burst.sessionLabel.trim()
        ? `${burst.title} -> ${burst.sessionLabel.trim()}`
        : burst.title;
      const existing = groups.get(label);
      if (existing) {
        existing.totalSeconds += burst.durationSeconds;
        existing.burstCount += 1;
        existing.latestLoggedAt = Math.max(existing.latestLoggedAt, burst.loggedAt);
        return groups;
      }

      groups.set(label, {
        key: label,
        label,
        totalSeconds: burst.durationSeconds,
        burstCount: 1,
        latestLoggedAt: burst.loggedAt
      });
      return groups;
    }, new Map<string, TodayBurstGroup>())
  )
    .map(([, group]) => group)
    .sort((left, right) =>
      right.totalSeconds - left.totalSeconds
      || right.burstCount - left.burstCount
      || right.latestLoggedAt - left.latestLoggedAt
      || left.label.localeCompare(right.label)
    );

  return {
    todayBursts,
    grouped,
    totalSeconds: todayBursts.reduce((sum, burst) => sum + burst.durationSeconds, 0)
  };
}

export function TodayBursts({ bursts }: { bursts: Burst[] }) {
  const today = new Date();
  const dayLabel = today.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric"
  });
  const { todayBursts, grouped, totalSeconds } = buildTodayBurstGroups(bursts);

  return (
    <div className="today-panel" id="timerViewPanel" role="tabpanel">
      <div className="trends-panel-header">
        <div>
          <div className="timer-preset-heading">Today</div>
          <div className="trends-range-copy">{dayLabel}</div>
        </div>
        <div className="trends-summary">
          <span>{formatDuration(totalSeconds)} tracked</span>
          <span>{todayBursts.length} burst{todayBursts.length === 1 ? "" : "s"}</span>
        </div>
      </div>

      {todayBursts.length ? (
        <>
          <div className="today-burst-list" aria-label="Today's bursts">
            {grouped.map((group) => (
              <div key={group.key} className="today-burst-row">
                <div className="today-burst-copy">
                  <span>{group.label}</span>
                  <small>
                    {group.burstCount} burst{group.burstCount === 1 ? "" : "s"} • latest {formatBurstTime(group.latestLoggedAt)}
                  </small>
                </div>
                <strong>{formatDuration(group.totalSeconds)}</strong>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="trends-day-detail-card">
          <span className="trends-insight-label">Today is still open</span>
          <strong>No bursts logged yet.</strong>
          <span>Start the timer or save time manually and today&apos;s work will show up here.</span>
        </div>
      )}
    </div>
  );
}
