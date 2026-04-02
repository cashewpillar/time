import type { AppState, Burst, Outcome, Project, Workspace } from "../types/app";

export type SyncPlan = {
  workspacesToUpsert: Workspace[];
  workspaceIdsToDelete: string[];
  projectsToUpsert: Project[];
  projectIdsToDelete: string[];
  outcomesToUpsert: Outcome[];
  outcomeIdsToDelete: string[];
  burstsToUpsert: Burst[];
  burstIdsToDelete: string[];
  shouldUpsertPreferences: boolean;
};

function mapById<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}

function arraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((entry, index) => entry === right[index]);
}

function sameWorkspace(left: Workspace, right: Workspace): boolean {
  return left.name === right.name;
}

function sameProject(left: Project, right: Project): boolean {
  return left.workspaceId === right.workspaceId
    && left.name === right.name;
}

function sameOutcome(left: Outcome, right: Outcome): boolean {
  return left.workspaceId === right.workspaceId
    && left.projectId === right.projectId
    && left.title === right.title
    && left.type === right.type
    && left.notes === right.notes
    && left.agentEligible === right.agentEligible
    && left.done === right.done;
}

function sameBurst(left: Burst, right: Burst): boolean {
  return left.workspaceId === right.workspaceId
    && left.projectId === right.projectId
    && left.outcomeId === right.outcomeId
    && left.title === right.title
    && left.sessionLabel === right.sessionLabel
    && left.type === right.type
    && left.notes === right.notes
    && left.agentEligible === right.agentEligible
    && left.durationSeconds === right.durationSeconds
    && left.loggedAt === right.loggedAt;
}

function buildChangedItems<T extends { id: string }>(
  previousItems: T[] | null,
  nextItems: T[],
  isSame: (left: T, right: T) => boolean
): T[] {
  if (!previousItems) return nextItems;

  const previousById = mapById(previousItems);
  return nextItems.filter((item) => {
    const previousItem = previousById.get(item.id);
    if (!previousItem) return true;
    return !isSame(previousItem, item);
  });
}

function buildDeletedIds<T extends { id: string }>(previousItems: T[] | null, nextItems: T[]): string[] {
  if (!previousItems) return [];

  const nextIds = new Set(nextItems.map((item) => item.id));
  return previousItems
    .map((item) => item.id)
    .filter((id) => !nextIds.has(id));
}

export function buildIncrementalSyncPlan(previousState: AppState | null, nextState: AppState): SyncPlan {
  return {
    workspacesToUpsert: buildChangedItems(previousState?.workspaces ?? null, nextState.workspaces, sameWorkspace),
    workspaceIdsToDelete: buildDeletedIds(previousState?.workspaces ?? null, nextState.workspaces),
    projectsToUpsert: buildChangedItems(previousState?.projects ?? null, nextState.projects, sameProject),
    projectIdsToDelete: buildDeletedIds(previousState?.projects ?? null, nextState.projects),
    outcomesToUpsert: buildChangedItems(previousState?.outcomes ?? null, nextState.outcomes, sameOutcome),
    outcomeIdsToDelete: buildDeletedIds(previousState?.outcomes ?? null, nextState.outcomes),
    burstsToUpsert: buildChangedItems(previousState?.bursts ?? null, nextState.bursts, sameBurst),
    burstIdsToDelete: buildDeletedIds(previousState?.bursts ?? null, nextState.bursts),
    shouldUpsertPreferences: !previousState || !arraysEqual(previousState.customOutcomeTypes, nextState.customOutcomeTypes)
  };
}
