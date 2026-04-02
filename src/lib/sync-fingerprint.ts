import type { AppState } from "../types/app";

function getSyncableStateSlice(state: AppState) {
  return {
    customOutcomeTypes: state.customOutcomeTypes,
    workspaces: state.workspaces.map((workspace) => ({
      id: workspace.id,
      name: workspace.name
    })),
    projects: state.projects.map((project) => ({
      id: project.id,
      workspaceId: project.workspaceId,
      name: project.name
    })),
    outcomes: state.outcomes,
    bursts: state.bursts
  };
}

export function buildSyncFingerprint(state: AppState): string {
  return JSON.stringify(getSyncableStateSlice(state));
}
