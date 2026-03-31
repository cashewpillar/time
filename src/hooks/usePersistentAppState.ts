import { useEffect, useReducer } from "react";
import type { Dispatch } from "react";
import type { AppState } from "../types/app";
import type { AppAction } from "../state/app-state";
import {
  appReducer,
  LEGACY_STORAGE_KEY,
  loadStateFromStorageValue,
  serializeStateForStorage,
  STORAGE_KEY
} from "../state/app-state";

type PersistentAppStateResult = {
  state: AppState;
  dispatch: Dispatch<AppAction>;
};

export function usePersistentAppState(): PersistentAppStateResult {
  const [state, dispatch] = useReducer(appReducer, undefined, () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return loadStateFromStorageValue(JSON.parse(saved));
      }

      const legacySaved = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacySaved) {
        return loadStateFromStorageValue(JSON.parse(legacySaved));
      }

      return loadStateFromStorageValue();
    } catch {
      return loadStateFromStorageValue();
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeStateForStorage(state)));
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  }, [state]);

  return {
    state,
    dispatch
  };
}
