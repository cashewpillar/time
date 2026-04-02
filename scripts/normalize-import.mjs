import fs from "node:fs";
import path from "node:path";

const DEFAULT_INPUT = "import.csv";
const DEFAULT_OUT_DIR = "tmp/import";
const DEFAULT_TARGET_SECONDS = 20 * 60;
const DEFAULT_OUTCOME_TYPES = new Set(["development", "design", "product"]);

function printUsage() {
  console.log(`Usage:
  node scripts/normalize-import.mjs [input.csv] [--out-dir tmp/import] [--user-id <uuid>] [--active-workspace "<name>"]

Examples:
  node scripts/normalize-import.mjs
  node scripts/normalize-import.mjs import.csv --out-dir tmp/import
  node scripts/normalize-import.mjs import.csv --user-id 00000000-0000-0000-0000-000000000000`);
}

function parseArgs(argv) {
  const args = {
    input: DEFAULT_INPUT,
    outDir: DEFAULT_OUT_DIR,
    userId: "",
    activeWorkspace: ""
  };

  const values = [...argv];
  if (values[0] && !values[0].startsWith("--")) {
    args.input = values.shift();
  }

  for (let index = 0; index < values.length; index += 1) {
    const token = values[index];
    const next = values[index + 1];

    if (token === "--help" || token === "-h") {
      printUsage();
      process.exit(0);
    }

    if (token === "--out-dir" && next) {
      args.outDir = next;
      index += 1;
      continue;
    }

    if (token === "--user-id" && next) {
      args.userId = next;
      index += 1;
      continue;
    }

    if (token === "--active-workspace" && next) {
      args.activeWorkspace = next;
      index += 1;
      continue;
    }

    throw new Error(`Unknown or incomplete argument: ${token}`);
  }

  return args;
}

function parseCsv(input) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < input.length; index += 1) {
    const current = input[index];
    const next = input[index + 1];

    if (inQuotes) {
      if (current === '"' && next === '"') {
        field += '"';
        index += 1;
      } else if (current === '"') {
        inQuotes = false;
      } else {
        field += current;
      }
      continue;
    }

    if (current === '"') {
      inQuotes = true;
      continue;
    }

    if (current === ",") {
      row.push(field);
      field = "";
      continue;
    }

    if (current === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
      continue;
    }

    field += current;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }

  return rows;
}

function slugify(value, fallback) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  return slug || fallback;
}

function hashText(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function buildId(prefix, ...parts) {
  return `${prefix}-${hashText(parts.join("::"))}`;
}

function normalizeText(value, fallback = "") {
  const trimmed = String(value || "").trim().replace(/\s+/g, " ");
  return trimmed || fallback;
}

function normalizeBoolean(value) {
  return normalizeText(value).toLowerCase() === "yes";
}

function normalizeType(value) {
  return normalizeText(value).toLowerCase();
}

function normalizeDurationSeconds(row) {
  const minutes = Number.parseFloat(row["Minutes"]);
  if (Number.isFinite(minutes) && minutes > 0) {
    return Math.round(minutes * 60);
  }

  const hours = Number.parseFloat(row["Hours"]);
  if (Number.isFinite(hours) && hours > 0) {
    return Math.round(hours * 60 * 60);
  }

  const days = Number.parseFloat(row["Days"]);
  if (Number.isFinite(days) && days > 0) {
    return Math.round(days * 24 * 60 * 60);
  }

  throw new Error(`Unable to determine duration for entry "${row.Entry}"`);
}

function normalizeLoggedAt(value) {
  const normalized = normalizeText(value).replace(/\(GMT([+-]\d{1,2})\)$/, (_, offsetHours) => {
    const sign = offsetHours.startsWith("-") ? "-" : "+";
    const hours = offsetHours.replace(/^[-+]/, "").padStart(2, "0");
    return `${sign}${hours}:00`;
  });

  const parsed = Date.parse(normalized);
  if (Number.isNaN(parsed)) {
    throw new Error(`Unable to parse Start datetime: ${value}`);
  }

  return parsed;
}

function readRows(csvPath) {
  const raw = fs.readFileSync(csvPath, "utf8").replace(/^\uFEFF/, "");
  const [header, ...records] = parseCsv(raw);
  if (!header?.length) {
    throw new Error("CSV is empty.");
  }

  return records
    .filter((record) => record.some((value) => normalizeText(value).length > 0))
    .map((record, index) => {
      const row = Object.fromEntries(header.map((name, columnIndex) => [name, record[columnIndex] ?? ""]));

      return {
        sourceRowNumber: index + 2,
        entry: normalizeText(row.Entry, "Untitled"),
        aiWorkflow: normalizeBoolean(row["AI workflow"]),
        days: normalizeText(row.Days),
        hours: normalizeText(row.Hours),
        minutes: normalizeText(row.Minutes),
        notes: normalizeText(row.Notes),
        projectName: normalizeText(row.Project, "General"),
        workspaceName: normalizeText(row.Workspace, "Default"),
        taskType: normalizeType(row["Task type"]),
        startDatetime: normalizeText(row["Start datetime"]),
        durationSeconds: normalizeDurationSeconds(row),
        loggedAt: normalizeLoggedAt(row["Start datetime"])
      };
    });
}

function buildNormalizedState(rows, activeWorkspaceName) {
  const workspaces = [];
  const projects = [];
  const outcomes = [];
  const bursts = [];
  const customOutcomeTypes = new Set();

  const workspaceByName = new Map();
  const projectByKey = new Map();
  const outcomeByKey = new Map();
  const projectNamesByWorkspaceId = new Map();

  for (const row of rows) {
    let workspace = workspaceByName.get(row.workspaceName);
    if (!workspace) {
      const workspaceId = `workspace-${slugify(row.workspaceName, buildId("workspace", row.workspaceName))}`;
      workspace = {
        id: workspaceId,
        name: row.workspaceName,
        activeProjectId: "",
        visibleProjectIds: []
      };
      workspaceByName.set(row.workspaceName, workspace);
      projectNamesByWorkspaceId.set(workspaceId, []);
      workspaces.push(workspace);
    }

    const projectKey = `${workspace.id}::${row.projectName}`;
    let project = projectByKey.get(projectKey);
    if (!project) {
      project = {
        id: `project-${slugify(`${workspace.name}-${row.projectName}`, buildId("project", workspace.id, row.projectName))}`,
        workspaceId: workspace.id,
        name: row.projectName
      };
      projectByKey.set(projectKey, project);
      projects.push(project);

      const projectIds = projectNamesByWorkspaceId.get(workspace.id) || [];
      projectIds.push(project.id);
      projectNamesByWorkspaceId.set(workspace.id, projectIds);
      if (!workspace.activeProjectId) {
        workspace.activeProjectId = project.id;
      }
      if (workspace.visibleProjectIds.length < 2) {
        workspace.visibleProjectIds.push(project.id);
      }
    }

    const outcomeKey = `${workspace.id}::${project.id}::${row.entry}`;
    let outcome = outcomeByKey.get(outcomeKey);
    if (!outcome) {
      outcome = {
        id: buildId("outcome", workspace.id, project.id, row.entry),
        workspaceId: workspace.id,
        projectId: project.id,
        title: row.entry,
        type: row.taskType,
        notes: row.notes,
        agentEligible: row.aiWorkflow,
        done: false
      };
      outcomeByKey.set(outcomeKey, outcome);
      outcomes.push(outcome);
    }

    if (row.taskType && !DEFAULT_OUTCOME_TYPES.has(row.taskType)) {
      customOutcomeTypes.add(row.taskType);
    }

    bursts.push({
      id: buildId("burst", workspace.id, project.id, row.entry, String(row.loggedAt), String(row.durationSeconds), String(row.sourceRowNumber)),
      workspaceId: workspace.id,
      projectId: project.id,
      outcomeId: outcome.id,
      title: outcome.title,
      sessionLabel: "",
      type: outcome.type,
      notes: row.notes,
      agentEligible: row.aiWorkflow,
      durationSeconds: row.durationSeconds,
      loggedAt: row.loggedAt
    });
  }

  const activeWorkspace = workspaces.find((workspace) => workspace.name === activeWorkspaceName) || workspaces[0] || null;
  const activeProjectId = activeWorkspace?.activeProjectId || projects[0]?.id || "";
  const activeOutcomeId = outcomes.find((outcome) => outcome.projectId === activeProjectId)?.id || null;

  return {
    activeWorkspaceId: activeWorkspace?.id || "",
    elapsedSeconds: 0,
    targetSeconds: DEFAULT_TARGET_SECONDS,
    isRunning: false,
    completedSessions: bursts.length,
    lastTickAt: null,
    activeOutcomeId,
    isOutcomeFormOpen: false,
    editingOutcomeId: null,
    isWorkspaceMenuOpen: false,
    isProjectMenuOpen: false,
    customOutcomeTypes: [...customOutcomeTypes].sort(),
    status: `Imported ${bursts.length} historical sessions from CSV.`,
    workspaces,
    projects,
    outcomes,
    bursts: [...bursts].sort((left, right) => right.loggedAt - left.loggedAt)
  };
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeJsonFile(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlNullable(value) {
  return value === null || value === undefined ? "null" : sqlString(value);
}

function sqlBoolean(value) {
  return value ? "true" : "false";
}

function sqlTextArray(values) {
  return `ARRAY[${values.map((value) => sqlString(value)).join(", ")}]::text[]`;
}

function buildSqlInserts(state, userId) {
  const lines = [
    "-- Generated by scripts/normalize-import.mjs",
    "begin;",
    ""
  ];

  lines.push(
    "insert into public.workspaces (user_id, id, name, active_project_id, visible_project_ids, sort_order)",
    "values"
  );
  lines.push(state.workspaces.map((workspace, index) =>
    `  (${sqlString(userId)}, ${sqlString(workspace.id)}, ${sqlString(workspace.name)}, ${sqlString(workspace.activeProjectId)}, ${sqlTextArray(workspace.visibleProjectIds)}, ${index})`
  ).join(",\n"));
  lines.push("on conflict (user_id, id) do update set");
  lines.push("  name = excluded.name,");
  lines.push("  active_project_id = excluded.active_project_id,");
  lines.push("  visible_project_ids = excluded.visible_project_ids,");
  lines.push("  sort_order = excluded.sort_order,");
  lines.push("  updated_at = timezone('utc', now());");
  lines.push("");

  lines.push(
    "insert into public.projects (user_id, id, workspace_id, name, sort_order)",
    "values"
  );
  lines.push(state.projects.map((project, index) =>
    `  (${sqlString(userId)}, ${sqlString(project.id)}, ${sqlString(project.workspaceId)}, ${sqlString(project.name)}, ${index})`
  ).join(",\n"));
  lines.push("on conflict (user_id, id) do update set");
  lines.push("  workspace_id = excluded.workspace_id,");
  lines.push("  name = excluded.name,");
  lines.push("  sort_order = excluded.sort_order,");
  lines.push("  updated_at = timezone('utc', now());");
  lines.push("");

  lines.push(
    "insert into public.outcomes (user_id, id, workspace_id, project_id, title, type, notes, agent_eligible, done, sort_order)",
    "values"
  );
  lines.push(state.outcomes.map((outcome, index) =>
    `  (${sqlString(userId)}, ${sqlString(outcome.id)}, ${sqlString(outcome.workspaceId)}, ${sqlString(outcome.projectId)}, ${sqlString(outcome.title)}, ${sqlString(outcome.type)}, ${sqlString(outcome.notes)}, ${sqlBoolean(outcome.agentEligible)}, ${sqlBoolean(outcome.done)}, ${index})`
  ).join(",\n"));
  lines.push("on conflict (user_id, id) do update set");
  lines.push("  workspace_id = excluded.workspace_id,");
  lines.push("  project_id = excluded.project_id,");
  lines.push("  title = excluded.title,");
  lines.push("  type = excluded.type,");
  lines.push("  notes = excluded.notes,");
  lines.push("  agent_eligible = excluded.agent_eligible,");
  lines.push("  done = excluded.done,");
  lines.push("  sort_order = excluded.sort_order,");
  lines.push("  updated_at = timezone('utc', now());");
  lines.push("");

  lines.push(
    "insert into public.bursts (user_id, id, workspace_id, project_id, outcome_id, title, session_label, type, notes, agent_eligible, duration_seconds, logged_at)",
    "values"
  );
  lines.push(state.bursts.map((burst) =>
    `  (${sqlString(userId)}, ${sqlString(burst.id)}, ${sqlString(burst.workspaceId)}, ${sqlString(burst.projectId)}, ${sqlNullable(burst.outcomeId)}, ${sqlString(burst.title)}, ${sqlString(burst.sessionLabel)}, ${sqlString(burst.type)}, ${sqlString(burst.notes)}, ${sqlBoolean(burst.agentEligible)}, ${burst.durationSeconds}, ${burst.loggedAt})`
  ).join(",\n"));
  lines.push("on conflict (user_id, id) do update set");
  lines.push("  workspace_id = excluded.workspace_id,");
  lines.push("  project_id = excluded.project_id,");
  lines.push("  outcome_id = excluded.outcome_id,");
  lines.push("  title = excluded.title,");
  lines.push("  session_label = excluded.session_label,");
  lines.push("  type = excluded.type,");
  lines.push("  notes = excluded.notes,");
  lines.push("  agent_eligible = excluded.agent_eligible,");
  lines.push("  duration_seconds = excluded.duration_seconds,");
  lines.push("  logged_at = excluded.logged_at,");
  lines.push("  updated_at = timezone('utc', now());");
  lines.push("");

  lines.push(
    "insert into public.app_preferences (user_id, active_workspace_id, elapsed_seconds, target_seconds, is_running, completed_sessions, last_tick_at, active_outcome_id, is_outcome_form_open, editing_outcome_id, is_workspace_menu_open, is_project_menu_open, custom_outcome_types, status)",
    "values",
    `  (${sqlString(userId)}, ${sqlString(state.activeWorkspaceId)}, ${state.elapsedSeconds}, ${state.targetSeconds}, ${sqlBoolean(state.isRunning)}, ${state.completedSessions}, null, ${sqlNullable(state.activeOutcomeId)}, ${sqlBoolean(state.isOutcomeFormOpen)}, null, ${sqlBoolean(state.isWorkspaceMenuOpen)}, ${sqlBoolean(state.isProjectMenuOpen)}, ${sqlTextArray(state.customOutcomeTypes)}, ${sqlString(state.status)})`,
    "on conflict (user_id) do update set",
    "  active_workspace_id = excluded.active_workspace_id,",
    "  elapsed_seconds = excluded.elapsed_seconds,",
    "  target_seconds = excluded.target_seconds,",
    "  is_running = excluded.is_running,",
    "  completed_sessions = excluded.completed_sessions,",
    "  last_tick_at = excluded.last_tick_at,",
    "  active_outcome_id = excluded.active_outcome_id,",
    "  is_outcome_form_open = excluded.is_outcome_form_open,",
    "  editing_outcome_id = excluded.editing_outcome_id,",
    "  is_workspace_menu_open = excluded.is_workspace_menu_open,",
    "  is_project_menu_open = excluded.is_project_menu_open,",
    "  custom_outcome_types = excluded.custom_outcome_types,",
    "  status = excluded.status,",
    "  updated_at = timezone('utc', now());",
    "",
    "commit;"
  );

  return `${lines.join("\n")}\n`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = path.resolve(process.cwd(), args.input);
  const outDir = path.resolve(process.cwd(), args.outDir);

  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input file not found: ${inputPath}`);
  }

  const rows = readRows(inputPath);
  const state = buildNormalizedState(rows, normalizeText(args.activeWorkspace));
  ensureDir(outDir);

  const normalizedJsonPath = path.join(outDir, "normalized-state.json");
  writeJsonFile(normalizedJsonPath, state);

  let sqlPath = "";
  if (args.userId) {
    sqlPath = path.join(outDir, "supabase-import.sql");
    fs.writeFileSync(sqlPath, buildSqlInserts(state, args.userId), "utf8");
  }

  const summary = {
    rows: rows.length,
    workspaces: state.workspaces.length,
    projects: state.projects.length,
    outcomes: state.outcomes.length,
    bursts: state.bursts.length,
    customOutcomeTypes: state.customOutcomeTypes
  };

  console.log(JSON.stringify({
    input: inputPath,
    normalizedJsonPath,
    sqlPath: sqlPath || null,
    summary
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
