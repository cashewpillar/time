import { useEffect, useReducer } from "react";
import type { Dispatch } from "react";
import type { AppState } from "../types/app";
import type { AppAction } from "../state/app-state";
import { appReducer, normalizeState, STORAGE_KEY } from "../state/app-state";
import type { PersistedState } from "../types/app";

export function usePersistentAppState(): [AppState, Dispatch<AppAction>] {
  const [state, dispatch] = useReducer(appReducer, undefined, () => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") as PersistedState | null;
      return normalizeState(saved || undefined);
    } catch {
      return normalizeState();
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  return [state, dispatch];
}
