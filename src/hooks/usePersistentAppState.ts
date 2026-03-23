import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { Dispatch } from "react";
import type { AppState, NotionConfig, NotionSyncStatus } from "../types/app";
import type { AppAction } from "../state/app-state";
import { appReducer, normalizeState, STORAGE_KEY } from "../state/app-state";
import {
  getNotionConnectionStatus,
  type NotionTaskEntry,
  loadNotionConfig,
  saveNotionConfig,
  saveTaskEntryToNotion
} from "../lib/notion";

type PersistentAppStateResult = {
  state: AppState;
  dispatch: Dispatch<AppAction>;
  notionConfig: NotionConfig;
  updateNotionConfig: (config: NotionConfig) => void;
  syncStatus: NotionSyncStatus;
  logTaskEntry: (entry: NotionTaskEntry) => Promise<void>;
};

export function usePersistentAppState(): PersistentAppStateResult {
  const [state, dispatch] = useReducer(appReducer, undefined, () => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") as PersistedState | null;
      return normalizeState(saved || undefined);
    } catch {
      return normalizeState();
    }
  });
  const [notionConfig, setNotionConfig] = useState<NotionConfig>(() => loadNotionConfig());
  const [syncStatus, setSyncStatus] = useState<NotionSyncStatus>(() => getNotionConnectionStatus(notionConfig));
  const loggingRequestIdRef = useRef(0);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  return {
    state,
    dispatch,
    notionConfig,
    updateNotionConfig: (config) => {
      const nextConfig = saveNotionConfig(config);
      setNotionConfig(nextConfig);
      setSyncStatus(getNotionConnectionStatus(nextConfig));
    },
    syncStatus,
    logTaskEntry: async (entry) => {
      if (!notionConfig.databaseId.trim()) {
        setSyncStatus({ phase: "idle", message: "Notion database not configured." });
        return;
      }

      const requestId = loggingRequestIdRef.current + 1;
      loggingRequestIdRef.current = requestId;
      setSyncStatus({ phase: "saving", message: "Saving work entry to Notion..." });

      try {
        await saveTaskEntryToNotion(notionConfig, entry);
        if (loggingRequestIdRef.current === requestId) {
          setSyncStatus({ phase: "synced", message: "Saved the latest work entry to Notion." });
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown sync error";
        if (loggingRequestIdRef.current === requestId) {
          setSyncStatus({ phase: "error", message: `Notion sync failed: ${message}` });
        }
      }
    }
  };
}
