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
    "Access-Control-Allow-Headers": "Content-Type",
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

  return [];
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
