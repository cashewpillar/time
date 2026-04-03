import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Burst } from "../types/app";

const HEATMAP_DAY_COUNT = 84;
const MIN_HEATMAP_WEEKS = 17;
const HEATMAP_CELL_SIZE = 9;
const HEATMAP_GAP = 4;
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type HeatmapCell = {
  dateKey: string;
  dayLabel: string;
  fullDateLabel: string;
  weekdayLabel: string;
  durationSeconds: number;
  burstCount: number;
  intensityLevel: 0 | 1 | 2 | 3 | 4;
  isToday: boolean;
  isFuture: boolean;
  isPadding: boolean;
};

type HeatmapWeek = {
  key: string;
  monthLabel: string | null;
  cells: HeatmapCell[];
};

type ActiveHeatmapTooltip = {
  text: string;
  anchorX: number;
  anchorY: number;
};

type SelectedDayWorkItem = {
  key: string;
  label: string;
  totalSeconds: number;
  burstCount: number;
};

function getDateKey(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatHeatmapDuration(totalSeconds: number): string {
  if (totalSeconds <= 0) return "0m";

  const totalMinutes = Math.round(totalSeconds / 60);
  if (totalMinutes < 60) return `${totalMinutes}m`;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
}

function formatHeatmapTooltip(cell: HeatmapCell): string {
  const burstLabel = `${cell.burstCount} burst${cell.burstCount === 1 ? "" : "s"}`;
  return `${formatHeatmapDuration(cell.durationSeconds)} across ${burstLabel} on ${cell.fullDateLabel}`;
}

function buildHeatmapCells(bursts: Burst[]): {
  cells: HeatmapCell[];
  totalSeconds: number;
  activeDayCount: number;
  busiestDay: HeatmapCell | null;
} {
  const dailyTotals = new Map<string, number>();
  const dailyBurstCounts = new Map<string, number>();

  for (const burst of bursts) {
    const dateKey = getDateKey(burst.loggedAt);
    dailyTotals.set(dateKey, (dailyTotals.get(dateKey) || 0) + burst.durationSeconds);
    dailyBurstCounts.set(dateKey, (dailyBurstCounts.get(dateKey) || 0) + 1);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startDay = new Date(today);
  startDay.setDate(today.getDate() - (HEATMAP_DAY_COUNT - 1));
  const startOffset = startDay.getDay();
  const alignedStartDay = new Date(startDay);
  alignedStartDay.setDate(startDay.getDate() - startOffset);
  const endOffset = 6 - today.getDay();
  const alignedEndDay = new Date(today);
  alignedEndDay.setDate(today.getDate() + endOffset);

  const cells: HeatmapCell[] = [];
  let maxDurationSeconds = 0;
  let totalSeconds = 0;
  let activeDayCount = 0;

  for (const currentDay = new Date(alignedStartDay); currentDay <= alignedEndDay; currentDay.setDate(currentDay.getDate() + 1)) {
    const dateKey = getDateKey(currentDay.getTime());
    const isFuture = currentDay > today;
    const durationSeconds = isFuture ? 0 : (dailyTotals.get(dateKey) || 0);
    const burstCount = isFuture ? 0 : (dailyBurstCounts.get(dateKey) || 0);
    const isToday = currentDay.getTime() === today.getTime();

    if (durationSeconds > 0) {
      maxDurationSeconds = Math.max(maxDurationSeconds, durationSeconds);
      totalSeconds += durationSeconds;
      activeDayCount += 1;
    }

    cells.push({
      dateKey,
      dayLabel: currentDay.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      fullDateLabel: currentDay.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }),
      weekdayLabel: WEEKDAY_LABELS[currentDay.getDay()],
      durationSeconds,
      burstCount,
      intensityLevel: 0,
      isToday,
      isFuture,
      isPadding: false
    });
  }

  const cellsWithIntensity = cells.map((cell) => {
    if (cell.durationSeconds <= 0 || maxDurationSeconds <= 0) return cell;
    const intensityLevel = Math.min(4, Math.max(1, Math.ceil((cell.durationSeconds / maxDurationSeconds) * 4))) as 1 | 2 | 3 | 4;
    return { ...cell, intensityLevel };
  });

  const busiestDay = cellsWithIntensity.reduce<HeatmapCell | null>((currentBest, cell) => {
    if (cell.durationSeconds <= 0) return currentBest;
    if (!currentBest || cell.durationSeconds > currentBest.durationSeconds) return cell;
    return currentBest;
  }, null);

  return {
    cells: cellsWithIntensity,
    totalSeconds,
    activeDayCount,
    busiestDay
  };
}

function groupHeatmapCellsByWeek(cells: HeatmapCell[], minWeeks: number): HeatmapWeek[] {
  const weeks: HeatmapWeek[] = [];
  let previousMonthLabel: string | null = null;

  for (let index = 0; index < cells.length; index += 7) {
    const weekCells = cells.slice(index, index + 7);
    const monthAnchor = weekCells.find((cell) => !cell.isFuture && new Date(`${cell.dateKey}T00:00:00`).getDate() <= 7)
      || weekCells.find((cell) => !cell.isFuture)
      || weekCells[0];
    const nextMonthLabel = monthAnchor
      ? new Date(`${monthAnchor.dateKey}T00:00:00`).toLocaleDateString(undefined, { month: "short" })
      : null;
    const monthLabel = nextMonthLabel && nextMonthLabel !== previousMonthLabel ? nextMonthLabel : null;

    weeks.push({
      key: weekCells[0]?.dateKey || `week-${index}`,
      monthLabel,
      cells: weekCells
    });

    if (nextMonthLabel) {
      previousMonthLabel = nextMonthLabel;
    }
  }

  while (weeks.length < minWeeks) {
    const paddingCells: HeatmapCell[] = Array.from({ length: 7 }, (_, dayIndex) => ({
      dateKey: `padding-${weeks.length}-${dayIndex}`,
      dayLabel: "",
      fullDateLabel: "",
      weekdayLabel: WEEKDAY_LABELS[dayIndex],
      durationSeconds: 0,
      burstCount: 0,
      intensityLevel: 0,
      isToday: false,
      isFuture: false,
      isPadding: true
    }));

    weeks.unshift({
      key: `padding-week-${weeks.length}`,
      monthLabel: null,
      cells: paddingCells
    });
  }

  return weeks;
}

function HeatmapTooltip({ anchorX, anchorY, text }: { anchorX: number; anchorY: number; text: string }) {
  const tooltipWidth = 220;
  const viewportPadding = 12;
  const tooltipLeft = Math.min(
    Math.max(anchorX - (tooltipWidth / 2), viewportPadding),
    Math.max(viewportPadding, window.innerWidth - tooltipWidth - viewportPadding)
  );
  const arrowLeft = Math.min(
    Math.max(anchorX - tooltipLeft, 12),
    tooltipWidth - 12
  );

  return (
    <div
      className="trends-tooltip-floating"
      role="tooltip"
      style={{
        left: `${tooltipLeft}px`,
        top: `${anchorY}px`,
        ["--tooltip-arrow-left" as string]: `${arrowLeft}px`
      }}
    >
      {text}
    </div>
  );
}

export function ActivityHeatmap({ bursts }: { bursts: Burst[] }) {
  const heatmapBodyRef = useRef<HTMLDivElement | null>(null);
  const [heatmapWeekCapacity, setHeatmapWeekCapacity] = useState(MIN_HEATMAP_WEEKS);
  const [activeHeatmapTooltip, setActiveHeatmapTooltip] = useState<ActiveHeatmapTooltip | null>(null);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);

  useEffect(() => {
    const node = heatmapBodyRef.current;
    if (!node) return undefined;

    const updateHeatmapWeekCapacity = () => {
      const availableWidth = node.clientWidth;
      if (!availableWidth) return;

      const weekWidth = HEATMAP_CELL_SIZE + HEATMAP_GAP;
      const nextCapacity = Math.max(MIN_HEATMAP_WEEKS, Math.floor((availableWidth + HEATMAP_GAP) / weekWidth));
      setHeatmapWeekCapacity((current) => current === nextCapacity ? current : nextCapacity);
    };

    updateHeatmapWeekCapacity();

    const observer = new ResizeObserver(updateHeatmapWeekCapacity);
    observer.observe(node);
    window.addEventListener("resize", updateHeatmapWeekCapacity);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateHeatmapWeekCapacity);
    };
  }, []);

  useEffect(() => {
    if (!activeHeatmapTooltip) return undefined;

    const hideTooltip = () => setActiveHeatmapTooltip(null);

    window.addEventListener("scroll", hideTooltip, true);
    window.addEventListener("resize", hideTooltip);
    return () => {
      window.removeEventListener("scroll", hideTooltip, true);
      window.removeEventListener("resize", hideTooltip);
    };
  }, [activeHeatmapTooltip]);

  const heatmap = buildHeatmapCells(bursts);
  const heatmapWeeks = groupHeatmapCellsByWeek(heatmap.cells, Math.max(heatmapWeekCapacity, Math.ceil(heatmap.cells.length / 7)));
  const heatmapRangeLabel = `${heatmap.cells[0]?.dayLabel || ""} to ${heatmap.cells[heatmap.cells.length - 1]?.dayLabel || ""}`;
  const selectedDayCell = selectedDateKey ? heatmap.cells.find((cell) => cell.dateKey === selectedDateKey) || null : null;
  const selectedDayWorkItems = selectedDateKey
    ? Array.from(
        bursts.reduce((items, burst) => {
          if (getDateKey(burst.loggedAt) !== selectedDateKey) return items;

          const label = burst.sessionLabel.trim()
            ? `${burst.title} -> ${burst.sessionLabel.trim()}`
            : burst.title;
          const existing = items.get(label);
          if (existing) {
            existing.totalSeconds += burst.durationSeconds;
            existing.burstCount += 1;
            return items;
          }

          items.set(label, {
            key: label,
            label,
            totalSeconds: burst.durationSeconds,
            burstCount: 1
          });
          return items;
        }, new Map<string, SelectedDayWorkItem>())
      ).map(([, item]) => item)
        .sort((left, right) => right.totalSeconds - left.totalSeconds || right.burstCount - left.burstCount || left.label.localeCompare(right.label))
    : [];

  function showHeatmapTooltip(cell: HeatmapCell, element: HTMLDivElement) {
    if (cell.isPadding || cell.isFuture) return;

    const cellRect = element.getBoundingClientRect();
    setActiveHeatmapTooltip({
      text: formatHeatmapTooltip(cell),
      anchorX: cellRect.left + (cellRect.width / 2),
      anchorY: cellRect.top
    });
  }

  function hideHeatmapTooltip() {
    setActiveHeatmapTooltip(null);
  }

  function handleSelectHeatmapCell(cell: HeatmapCell) {
    if (cell.isPadding || cell.isFuture || cell.durationSeconds <= 0) return;
    setSelectedDateKey((current) => current === cell.dateKey ? null : cell.dateKey);
  }

  return (
    <>
      <div className="trends-panel" id="timerViewPanel" role="tabpanel">
        <div className="trends-panel-header">
          <div>
            <div className="timer-preset-heading">Cached heatmap</div>
            <div className="trends-range-copy">{heatmapRangeLabel}</div>
          </div>
          <div className="trends-summary">
            <span>{formatHeatmapDuration(heatmap.totalSeconds)} tracked</span>
            <span>{heatmap.activeDayCount} active days</span>
          </div>
        </div>

        <div className="trends-heatmap-layout">
          <div className="trends-day-labels" aria-hidden="true">
            <span></span>
            <span>Mon</span>
            <span></span>
            <span>Wed</span>
            <span></span>
            <span>Fri</span>
            <span></span>
          </div>

          <div ref={heatmapBodyRef} className="trends-heatmap-body">
            <div className="trends-month-labels" aria-hidden="true">
              {heatmapWeeks.map((week) => (
                <span key={`month-${week.key}`} className="trends-month-label">
                  {week.monthLabel || ""}
                </span>
              ))}
            </div>

            <div className="trends-heatmap-shell">
              <div className="trends-heatmap" aria-label="Daily tracked time heatmap">
                {heatmapWeeks.map((week) => (
                  <div key={week.key} className="trends-heatmap-week">
                    {week.cells.map((cell) => (
                      <div
                        key={cell.dateKey}
                        className={`trends-heatmap-cell level-${cell.intensityLevel}${cell.isToday ? " is-today" : ""}${cell.isFuture ? " is-future" : ""}${cell.isPadding ? " is-padding" : ""}${cell.durationSeconds > 0 ? " has-entry" : ""}${selectedDateKey === cell.dateKey ? " selected" : ""}`}
                        tabIndex={cell.isPadding || cell.isFuture || cell.durationSeconds <= 0 ? -1 : 0}
                        onMouseEnter={(event) => showHeatmapTooltip(cell, event.currentTarget)}
                        onMouseLeave={hideHeatmapTooltip}
                        onFocus={(event) => showHeatmapTooltip(cell, event.currentTarget)}
                        onBlur={hideHeatmapTooltip}
                        onClick={() => handleSelectHeatmapCell(cell)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            handleSelectHeatmapCell(cell);
                          }
                        }}
                        role={cell.durationSeconds > 0 && !cell.isFuture && !cell.isPadding ? "button" : undefined}
                        aria-pressed={cell.durationSeconds > 0 && !cell.isFuture && !cell.isPadding ? selectedDateKey === cell.dateKey : undefined}
                        aria-label={cell.isPadding
                          ? "Heatmap padding"
                          : cell.isFuture
                            ? `${cell.dayLabel} ${cell.weekdayLabel}`
                            : formatHeatmapTooltip(cell)}
                      ></div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="trends-legend" aria-hidden="true">
          <span>Less</span>
          <div className="trends-legend-scale">
            {[0, 1, 2, 3, 4].map((level) => (
              <span key={level} className={`trends-legend-cell level-${level}`}></span>
            ))}
          </div>
          <span>More</span>
        </div>

        {selectedDayCell ? (
          <div className="trends-day-detail-card">
            <span className="trends-insight-label">Worked on {selectedDayCell.fullDateLabel}</span>
            <strong>{formatHeatmapDuration(selectedDayCell.durationSeconds)} across {selectedDayCell.burstCount} burst{selectedDayCell.burstCount === 1 ? "" : "s"}</strong>
            {selectedDayWorkItems.length ? (
              <div className="trends-day-detail-list">
                {selectedDayWorkItems.map((item) => (
                  <div key={item.key} className="trends-day-detail-row">
                    <span>{item.label}</span>
                    <strong>{formatHeatmapDuration(item.totalSeconds)}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <span>No tracked work found for that day.</span>
            )}
          </div>
        ) : (
          <div className="trends-insights">
            <div className="trends-insight-card">
              <span className="trends-insight-label">Busiest day</span>
              <strong>{heatmap.busiestDay ? heatmap.busiestDay.dayLabel : "No data yet"}</strong>
              <span>{heatmap.busiestDay ? formatHeatmapDuration(heatmap.busiestDay.durationSeconds) : "Start the timer or log time to fill this in."}</span>
            </div>
            <div className="trends-insight-card">
              <span className="trends-insight-label">Source</span>
              <strong>All cached bursts</strong>
              <span>Built from local burst history, not just the current outcome.</span>
            </div>
          </div>
        )}
      </div>

      {activeHeatmapTooltip && typeof document !== "undefined"
        ? createPortal(
            <HeatmapTooltip
              anchorX={activeHeatmapTooltip.anchorX}
              anchorY={activeHeatmapTooltip.anchorY}
              text={activeHeatmapTooltip.text}
            />,
            document.body
          )
        : null}
    </>
  );
}
