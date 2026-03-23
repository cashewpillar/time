import type { NotionConfig, NotionSyncStatus } from "../types/app";

const WORKER_URL = import.meta.env.VITE_NOTION_WORKER_URL || "https://sweet-star-6f5f.cashewpillar.workers.dev";
const CONFIG_KEY = "workspace-timer-notion-config-v1";
const STATE_CHUNK_SIZE = 1800;

export type NotionTaskEntry = {
  entry: string;
  taskType: string;
  task: string;
  epic: string;
  minutes: number;
  startDatetime: string;
  notes: string;
  aiWorkflow: boolean;
};

export type NotionSelectOptions = {
  taskTypes: string[];
  workspaces: Array<{
    name: string;
    projects: Array<{
      name: string;
      tasks: Array<{
        entry: string;
        taskType: string;
        notes: string;
        aiWorkflow: boolean;
      }>;
    }>;
  }>;
};

function hasValidConfig(config: NotionConfig): boolean {
  return Boolean(config.databaseId.trim() && config.ownerToken.trim());
}

function chunkText(value: string): string[] {
  if (!value) return [""];

  const chunks: string[] = [];
  for (let index = 0; index < value.length; index += STATE_CHUNK_SIZE) {
    chunks.push(value.slice(index, index + STATE_CHUNK_SIZE));
  }
  return chunks;
}

function richText(value: string) {
  return chunkText(value).map((content) => ({
    type: "text",
    text: { content }
  }));
}

export const RECENT_IMPORT_DAYS = 90;


async function notionFetch<T>(config: NotionConfig, path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${WORKER_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-App-Token": config.ownerToken,
      ...(init.headers || {})
    }
  });

  if (!response.ok) {
    let message = `${response.status}`;
    try {
      const payload = await response.json() as { message?: string };
      if (payload.message) {
        message = payload.message;
      }
    } catch {
      // Ignore JSON parse failures and fall back to the status code.
    }

    if (response.status === 401) {
      throw new Error("Unauthorized. Check that your Notion integration token is valid.");
    }

    if (response.status === 404) {
      throw new Error("Database not found. Check the database ID and make sure the integration can access it.");
    }

    if (response.status === 429) {
      throw new Error("Notion rate limited the request. Please wait a moment and try again.");
    }

    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export function loadNotionConfig(): NotionConfig {
  try {
    const saved = JSON.parse(localStorage.getItem(CONFIG_KEY) || "null") as Partial<NotionConfig> | null;
    return {
      databaseId: typeof saved?.databaseId === "string" ? saved.databaseId : "",
      ownerToken: typeof saved?.ownerToken === "string" ? saved.ownerToken : ""
    };
  } catch {
    return { databaseId: "", ownerToken: "" };
  }
}

export function saveNotionConfig(config: NotionConfig): NotionConfig {
  const nextConfig = {
    databaseId: config.databaseId.trim(),
    ownerToken: config.ownerToken.trim()
  };

  localStorage.setItem(CONFIG_KEY, JSON.stringify(nextConfig));
  return nextConfig;
}

export function getNotionConnectionStatus(config: NotionConfig): NotionSyncStatus {
  if (!config.databaseId.trim()) {
    return { phase: "idle", message: "Notion database not configured." };
  }

  if (!config.ownerToken.trim()) {
    return { phase: "idle", message: "Owner token required for Notion sync." };
  }

  return { phase: "idle", message: "Notion sync configured." };
}

export async function fetchNotionSelectOptions(config: NotionConfig): Promise<NotionSelectOptions> {
  if (!hasValidConfig(config)) {
    return { taskTypes: [], workspaces: [] };
  }

  return notionFetch(config, "/recent", {
    method: "POST",
    body: JSON.stringify({
      databaseId: config.databaseId,
      days: RECENT_IMPORT_DAYS
    })
  });
}

export async function saveTaskEntryToNotion(config: NotionConfig, taskEntry: NotionTaskEntry): Promise<void> {
  if (!hasValidConfig(config)) return;

  const properties: Record<string, unknown> = {
    Entry: {
      title: [{ text: { content: taskEntry.entry } }]
    },
    Task: {
      select: { name: taskEntry.task }
    },
    Epic: {
      select: { name: taskEntry.epic }
    },
    Minutes: {
      number: taskEntry.minutes
    },
    "Start datetime": {
      date: { start: taskEntry.startDatetime }
    },
    "AI workflow": {
      checkbox: taskEntry.aiWorkflow
    }
  };

  if (taskEntry.taskType.trim()) {
    properties["Task type"] = {
      multi_select: [{ name: taskEntry.taskType }]
    };
  }

  if (taskEntry.notes.trim()) {
    properties.Notes = {
      rich_text: richText(taskEntry.notes)
    };
  }

  await notionFetch(config, "/", {
    method: "POST",
    body: JSON.stringify({
      databaseId: config.databaseId,
      properties
    })
  });
}
