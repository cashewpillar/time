import { useEffect, useReducer, useRef, useState } from "react";
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
import { isSupabaseSyncEnabled, loadStateFromSupabase, saveStateToSupabase } from "../lib/supabase-sync";

export type SyncStatus = "disabled" | "connecting" | "ready" | "syncing" | "error";

export type SyncInfo = {
  enabled: boolean;
  status: SyncStatus;
  instanceId: string | null;
  lastSyncedAt: number | null;
  lastError: string | null;
};

type PersistentAppStateResult = {
  state: AppState;
  dispatch: Dispatch<AppAction>;
  syncInfo: SyncInfo;
  syncNow: () => Promise<void>;
  pullFromRemote: () => Promise<void>;
};

const INSTANCE_ID_STORAGE_KEY = "workspace-two-supabase-instance-id";

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
  const [isRemoteReady, setIsRemoteReady] = useState(() => isSupabaseSyncEnabled());
  const lastUploadedFingerprintRef = useRef<string | null>(null);
  const [syncInfo, setSyncInfo] = useState<SyncInfo>(() => ({
    enabled: isSupabaseSyncEnabled(),
    status: isSupabaseSyncEnabled() ? "ready" : "disabled",
    instanceId: typeof window === "undefined" ? null : window.localStorage.getItem(INSTANCE_ID_STORAGE_KEY),
    lastSyncedAt: null,
    lastError: null
  }));

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeStateForStorage(state)));
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  }, [state]);

  const autoSyncFingerprint = JSON.stringify({
    activeWorkspaceId: state.activeWorkspaceId,
    targetSeconds: state.targetSeconds,
    completedSessions: state.completedSessions,
    activeOutcomeId: state.activeOutcomeId,
    customOutcomeTypes: state.customOutcomeTypes,
    workspaces: state.workspaces,
    projects: state.projects,
    outcomes: state.outcomes,
    bursts: state.bursts
  });

  useEffect(() => {
    if (!isRemoteReady || !isSupabaseSyncEnabled()) return;
    if (lastUploadedFingerprintRef.current === autoSyncFingerprint) return;

    setSyncInfo((current) => ({
      ...current,
      enabled: true,
      status: current.status === "error" ? "error" : "syncing",
      instanceId: window.localStorage.getItem(INSTANCE_ID_STORAGE_KEY)
    }));

    const timeoutId = window.setTimeout(() => {
      void saveStateToSupabase(state).catch((error) => {
        console.error("Unable to save state to Supabase.", error);
        setSyncInfo((current) => ({
          ...current,
          enabled: true,
          status: "error",
          instanceId: window.localStorage.getItem(INSTANCE_ID_STORAGE_KEY),
          lastError: error instanceof Error ? error.message : "Unknown Supabase save error."
        }));
      }).then(() => {
        setSyncInfo((current) => {
          if (current.status === "error") return current;
          lastUploadedFingerprintRef.current = autoSyncFingerprint;
          return {
            ...current,
            enabled: true,
            status: "ready",
            instanceId: window.localStorage.getItem(INSTANCE_ID_STORAGE_KEY),
            lastSyncedAt: Date.now(),
            lastError: null
          };
        });
      });
    }, 10000);

    return () => window.clearTimeout(timeoutId);
  }, [autoSyncFingerprint, isRemoteReady, state]);

  async function syncNow(): Promise<void> {
    if (!isSupabaseSyncEnabled()) return;

    setSyncInfo((current) => ({
      ...current,
      enabled: true,
      status: "syncing",
      instanceId: typeof window === "undefined" ? current.instanceId : window.localStorage.getItem(INSTANCE_ID_STORAGE_KEY),
      lastError: null
    }));

    try {
      await saveStateToSupabase(state);
      setIsRemoteReady(true);
      lastUploadedFingerprintRef.current = autoSyncFingerprint;
      setSyncInfo((current) => ({
        ...current,
        enabled: true,
        status: "ready",
        instanceId: typeof window === "undefined" ? current.instanceId : window.localStorage.getItem(INSTANCE_ID_STORAGE_KEY),
        lastSyncedAt: Date.now(),
        lastError: null
      }));
    } catch (error) {
      console.error("Unable to sync state to Supabase.", error);
      setSyncInfo((current) => ({
        ...current,
        enabled: true,
        status: "error",
        instanceId: typeof window === "undefined" ? current.instanceId : window.localStorage.getItem(INSTANCE_ID_STORAGE_KEY),
        lastError: error instanceof Error ? error.message : "Unknown Supabase sync error."
      }));
    }
  }

  async function pullFromRemote(): Promise<void> {
    if (!isSupabaseSyncEnabled()) return;

    setSyncInfo((current) => ({
      ...current,
      enabled: true,
      status: "syncing",
      instanceId: typeof window === "undefined" ? current.instanceId : window.localStorage.getItem(INSTANCE_ID_STORAGE_KEY),
      lastError: null
    }));

    try {
      const remoteState = await loadStateFromSupabase();
      if (!remoteState) {
        setSyncInfo((current) => ({
          ...current,
          enabled: true,
          status: "ready",
          instanceId: typeof window === "undefined" ? current.instanceId : window.localStorage.getItem(INSTANCE_ID_STORAGE_KEY),
          lastError: "No remote data found for this instance."
        }));
        return;
      }

      dispatch({
        type: "hydrate-state",
        state: remoteState,
        status: "Pulled from Supabase."
      });
      lastUploadedFingerprintRef.current = JSON.stringify({
        activeWorkspaceId: remoteState.activeWorkspaceId ?? state.activeWorkspaceId,
        targetSeconds: remoteState.targetSeconds ?? state.targetSeconds,
        completedSessions: remoteState.completedSessions ?? state.completedSessions,
        activeOutcomeId: remoteState.activeOutcomeId ?? state.activeOutcomeId,
        customOutcomeTypes: remoteState.customOutcomeTypes ?? state.customOutcomeTypes,
        workspaces: remoteState.workspaces ?? state.workspaces,
        projects: remoteState.projects ?? state.projects,
        outcomes: remoteState.outcomes ?? state.outcomes,
        bursts: remoteState.bursts ?? state.bursts
      });
      setSyncInfo((current) => ({
        ...current,
        enabled: true,
        status: "ready",
        instanceId: typeof window === "undefined" ? current.instanceId : window.localStorage.getItem(INSTANCE_ID_STORAGE_KEY),
        lastSyncedAt: Date.now(),
        lastError: null
      }));
    } catch (error) {
      console.error("Unable to pull state from Supabase.", error);
      setSyncInfo((current) => ({
        ...current,
        enabled: true,
        status: "error",
        instanceId: typeof window === "undefined" ? current.instanceId : window.localStorage.getItem(INSTANCE_ID_STORAGE_KEY),
        lastError: error instanceof Error ? error.message : "Unknown Supabase pull error."
      }));
    }
  }

  return {
    state,
    dispatch,
    syncInfo,
    syncNow,
    pullFromRemote
  };
}
