function getAllowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function buildCorsHeaders(origin, env) {
  const allowedOrigins = getAllowedOrigins(env);
  const allowedOrigin = allowedOrigins.length
    ? (origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0])
    : "*";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,X-App-Token",
    "Content-Type": "application/json"
  };
}

function isOriginAllowed(origin, env) {
  const allowedOrigins = getAllowedOrigins(env);
  if (!allowedOrigins.length) return true;
  return Boolean(origin && allowedOrigins.includes(origin));
}

function hasValidOwnerToken(request, env) {
  const appToken = request.headers.get("X-App-Token");
  return Boolean(env.APP_WRITE_TOKEN && appToken && appToken === env.APP_WRITE_TOKEN);
}

function json(data, env, origin, init = {}) {
  const headers = {
    ...buildCorsHeaders(origin, env),
    ...(init.headers || {})
  };

  return new Response(JSON.stringify(data), {
    ...init,
    headers
  });
}

function extractSelectOptions(property) {
  if (!property || typeof property !== "object") return [];

  if (property.type === "select" && property.select?.options) {
    return property.select.options
      .map((option) => option?.name)
      .filter((name) => typeof name === "string" && name.trim().length > 0);
  }

  if (property.type === "status" && property.status?.options) {
    return property.status.options
      .map((option) => option?.name)
      .filter((name) => typeof name === "string" && name.trim().length > 0);
  }

  if (property.type === "multi_select" && property.multi_select?.options) {
    return property.multi_select.options
      .map((option) => option?.name)
      .filter((name) => typeof name === "string" && name.trim().length > 0);
  }

  return [];
}

function getPropertyText(property) {
  if (!property || typeof property !== "object") return "";

  if (property.type === "select") {
    return property.select?.name || "";
  }

  if (property.type === "status") {
    return property.status?.name || "";
  }

  if (property.type === "title") {
    return (property.title || []).map((part) => part?.plain_text || "").join("").trim();
  }

  if (property.type === "rich_text") {
    return (property.rich_text || []).map((part) => part?.plain_text || "").join("").trim();
  }

  return "";
}

function getPropertyMultiSelect(property) {
  if (!property || typeof property !== "object" || property.type !== "multi_select") return [];

  return (property.multi_select || [])
    .map((item) => item?.name)
    .filter((name) => typeof name === "string" && name.trim().length > 0);
}

async function fetchRecentEntries(databaseId, env, days) {
  const workspaces = new Map();
  const taskTypes = new Set();
  let cursor = undefined;
  let fetched = 0;
  const maxEntries = 500;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  while (fetched < maxEntries) {
    const notionResponse = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.NOTION_API_KEY}`,
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28"
      },
      body: JSON.stringify({
        page_size: 100,
        start_cursor: cursor,
        filter: {
          property: "Start datetime",
          date: {
            on_or_after: startDate.toISOString()
          }
        },
        sorts: [
          {
            property: "Start datetime",
            direction: "descending"
          }
        ]
      })
    });

    const payload = await notionResponse.json();
    if (!notionResponse.ok) {
      return { error: payload, status: notionResponse.status };
    }

    for (const result of payload.results || []) {
      const properties = result?.properties || {};
      const workspaceName = getPropertyText(properties.Epic) || "Workspace";
      const projectName = getPropertyText(properties.Task) || getPropertyText(properties.Project) || "Project";

      if (!workspaces.has(workspaceName)) {
        workspaces.set(workspaceName, new Set());
      }
      workspaces.get(workspaceName).add(projectName);

      for (const taskType of getPropertyMultiSelect(properties["Task type"])) {
        taskTypes.add(taskType);
      }
    }

    fetched += (payload.results || []).length;
    if (!payload.has_more || !payload.next_cursor) {
      break;
    }

    cursor = payload.next_cursor;
  }

  return {
    status: 200,
    data: {
      taskTypes: Array.from(taskTypes).sort((left, right) => left.localeCompare(right)),
      workspaces: Array.from(workspaces.entries())
        .map(([name, projects]) => ({
          name,
          projects: Array.from(projects).sort((left, right) => left.localeCompare(right))
        }))
        .sort((left, right) => left.name.localeCompare(right.name))
    }
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");

    if (!isOriginAllowed(origin, env)) {
      return json({ message: "Origin not allowed" }, env, origin, { status: 403 });
    }

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: buildCorsHeaders(origin, env)
      });
    }

    if (request.method !== "POST") {
      return json({ message: "Method not allowed" }, env, origin, { status: 405 });
    }

    if (!env.NOTION_API_KEY) {
      return json({ message: "Missing NOTION_API_KEY secret" }, env, origin, { status: 500 });
    }

    if (!hasValidOwnerToken(request, env)) {
      return json({ message: "Invalid owner token" }, env, origin, { status: 403 });
    }

    try {
      const url = new URL(request.url);
      const body = await request.json();
      const databaseId = typeof body?.databaseId === "string" ? body.databaseId.trim() : "";

      if (!databaseId) {
        return json({ message: "Missing databaseId" }, env, origin, { status: 400 });
      }

      if (url.pathname === "/schema") {
        const notionResponse = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${env.NOTION_API_KEY}`,
            "Notion-Version": "2022-06-28"
          }
        });

        const payload = await notionResponse.json();
        if (!notionResponse.ok) {
          return json(payload, env, origin, { status: notionResponse.status });
        }

        const properties = payload?.properties || {};
        return json({
          taskTypes: extractSelectOptions(properties["Task type"]),
          tasks: extractSelectOptions(properties.Task),
          epics: extractSelectOptions(properties.Epic)
        }, env, origin);
      }

      if (url.pathname === "/recent") {
        const days = typeof body?.days === "number" && body.days > 0 ? Math.min(body.days, 365) : 90;
        const result = await fetchRecentEntries(databaseId, env, days);
        if (result.status !== 200) {
          return json(result.error, env, origin, { status: result.status });
        }
        return json(result.data, env, origin);
      }

      const properties = body?.properties;
      if (!properties || typeof properties !== "object") {
        return json({ message: "Missing properties payload" }, env, origin, { status: 400 });
      }

      const notionResponse = await fetch("https://api.notion.com/v1/pages", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.NOTION_API_KEY}`,
          "Content-Type": "application/json",
          "Notion-Version": "2022-06-28"
        },
        body: JSON.stringify({
          parent: { database_id: databaseId },
          properties
        })
      });

      const payload = await notionResponse.json();
      return json(payload, env, origin, { status: notionResponse.status });
    } catch (error) {
      return json(
        { message: error instanceof Error ? error.message : "Unexpected worker error" },
        env,
        origin,
        { status: 500 }
      );
    }
  }
};
