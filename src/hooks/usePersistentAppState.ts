import { useEffect, useReducer, useRef, useState } from "react";
import type { Dispatch } from "react";
import type { AppState } from "../types/app";
import type { AppAction } from "../state/app-state";
import {
  appReducer,
  defaultState,
  LEGACY_STORAGE_KEY,
  loadStateFromStorageValue,
  serializeStateForStorage,
  STORAGE_KEY
} from "../state/app-state";
import { isSupabaseSyncEnabled, loadStateFromSupabase, saveStateToSupabase } from "../lib/supabase-sync";

export type SyncStatus = "disabled" | "auth_required" | "connecting" | "connected" | "syncing" | "error";

export type SyncInfo = {
  enabled: boolean;
  status: SyncStatus;
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

type Options = {
  userId: string | null;
};

function buildSyncFingerprint(state: AppState): string {
  return JSON.stringify({
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
}

const DEFAULT_FINGERPRINT = buildSyncFingerprint(defaultState());

export function usePersistentAppState({ userId }: Options): PersistentAppStateResult {
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
  const [syncInfo, setSyncInfo] = useState<SyncInfo>(() => ({
    enabled: isSupabaseSyncEnabled(),
    status: !isSupabaseSyncEnabled() ? "disabled" : (userId ? "connecting" : "auth_required"),
    lastSyncedAt: null,
    lastError: null
  }));
  const lastUploadedFingerprintRef = useRef<string | null>(null);
  const lastLoadedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeStateForStorage(state)));
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  }, [state]);

  useEffect(() => {
    setSyncInfo((current) => ({
      ...current,
      enabled: isSupabaseSyncEnabled(),
      status: !isSupabaseSyncEnabled()
        ? "disabled"
        : (userId ? (current.status === "syncing" ? "syncing" : "connected") : "auth_required")
    }));
  }, [userId]);

  useEffect(() => {
    if (!isSupabaseSyncEnabled() || !userId || lastLoadedUserIdRef.current === userId) return;

    lastLoadedUserIdRef.current = userId;
    setSyncInfo((current) => ({
      ...current,
      enabled: true,
      status: "connecting",
      lastError: null
    }));

    let cancelled = false;

    async function maybeLoadRemoteState() {
      try {
        const remoteState = await loadStateFromSupabase(userId);
        if (cancelled) return;

        if (remoteState && buildSyncFingerprint(state) === DEFAULT_FINGERPRINT) {
          dispatch({
            type: "hydrate-state",
            state: remoteState,
            status: "Loaded your synced data."
          });
          lastUploadedFingerprintRef.current = buildSyncFingerprint(loadStateFromStorageValue(serializeStateForStorage({
            ...defaultState(),
            ...remoteState
          })));
        }

        setSyncInfo((current) => ({
          ...current,
          enabled: true,
          status: "connected",
          lastError: null
        }));
      } catch (error) {
        console.error("Unable to load state from Supabase.", error);
        if (cancelled) return;
        setSyncInfo((current) => ({
          ...current,
          enabled: true,
          status: "error",
          lastError: error instanceof Error ? error.message : "Unknown Supabase load error."
        }));
      }
    }

    void maybeLoadRemoteState();

    return () => {
      cancelled = true;
    };
  }, [state, userId]);

  const autoSyncFingerprint = buildSyncFingerprint(state);

  useEffect(() => {
    if (!isSupabaseSyncEnabled() || !userId) return;
    if (lastUploadedFingerprintRef.current === autoSyncFingerprint) return;

    const timeoutId = window.setTimeout(() => {
      setSyncInfo((current) => ({
        ...current,
        enabled: true,
        status: "syncing",
        lastError: null
      }));

      void saveStateToSupabase(userId, state)
        .then(() => {
          lastUploadedFingerprintRef.current = autoSyncFingerprint;
          setSyncInfo((current) => ({
            ...current,
            enabled: true,
            status: "connected",
            lastSyncedAt: Date.now(),
            lastError: null
          }));
        })
        .catch((error) => {
          console.error("Unable to save state to Supabase.", error);
          setSyncInfo((current) => ({
            ...current,
            enabled: true,
            status: "error",
            lastError: error instanceof Error ? error.message : "Unknown Supabase save error."
          }));
        });
    }, 10000);

    return () => window.clearTimeout(timeoutId);
  }, [autoSyncFingerprint, state, userId]);

  async function syncNow(): Promise<void> {
    if (!isSupabaseSyncEnabled() || !userId) return;

    setSyncInfo((current) => ({
      ...current,
      enabled: true,
      status: "syncing",
      lastError: null
    }));

    try {
      await saveStateToSupabase(userId, state);
      lastUploadedFingerprintRef.current = autoSyncFingerprint;
      setSyncInfo((current) => ({
        ...current,
        enabled: true,
        status: "connected",
        lastSyncedAt: Date.now(),
        lastError: null
      }));
    } catch (error) {
      console.error("Unable to sync state to Supabase.", error);
      setSyncInfo((current) => ({
        ...current,
        enabled: true,
        status: "error",
        lastError: error instanceof Error ? error.message : "Unknown Supabase sync error."
      }));
    }
  }

  async function pullFromRemote(): Promise<void> {
    if (!isSupabaseSyncEnabled() || !userId) return;

    setSyncInfo((current) => ({
      ...current,
      enabled: true,
      status: "syncing",
      lastError: null
    }));

    try {
      const remoteState = await loadStateFromSupabase(userId);
      if (!remoteState) {
        setSyncInfo((current) => ({
          ...current,
          enabled: true,
          status: "connected",
          lastError: "No remote data found for this account."
        }));
        return;
      }

      dispatch({
        type: "hydrate-state",
        state: remoteState,
        status: "Downloaded from Supabase."
      });
      const nextState = {
        ...defaultState(),
        ...remoteState,
        workspaces: remoteState.workspaces ?? defaultState().workspaces,
        projects: remoteState.projects ?? defaultState().projects,
        outcomes: remoteState.outcomes ?? [],
        bursts: remoteState.bursts ?? []
      } as AppState;
      lastUploadedFingerprintRef.current = buildSyncFingerprint(nextState);
      setSyncInfo((current) => ({
        ...current,
        enabled: true,
        status: "connected",
        lastSyncedAt: Date.now(),
        lastError: null
      }));
    } catch (error) {
      console.error("Unable to pull state from Supabase.", error);
      setSyncInfo((current) => ({
        ...current,
        enabled: true,
        status: "error",
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
