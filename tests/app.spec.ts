import { expect, test } from "@playwright/test";
import { AppPage } from "./app.page";
import { buildSyncFingerprint } from "../src/lib/sync-fingerprint";
import { buildIncrementalSyncPlan } from "../src/lib/sync-plan";
import { appReducer, defaultState, loadStateFromStorageValue, serializeStateForStorage } from "../src/state/app-state";

test("migrates local state into normalized cache with derived outcomes", async () => {
  const legacyState = {
    activeWorkspaceId: "workspace-2",
    activeTaskId: "task-landing-hero",
    workspaces: [{
      id: "workspace-2",
      name: "Workspace 2",
      activeProjectId: "workspace-2-project-2",
      visibleProjectIds: ["workspace-2-project-1", "workspace-2-project-2"],
      projects: [
        { id: "workspace-2-project-1", name: "Project 1", tasks: [] },
        {
          id: "workspace-2-project-2",
          name: "Project 2",
          tasks: [
            {
              id: "task-landing-hero",
              text: "Landing page - hero copy",
              type: "design",
              notes: "Tighten value prop",
              agentEligible: false,
              done: false
            },
            {
              id: "task-landing-mobile",
              text: "Landing page - mobile polish",
              type: "design",
              notes: "",
              agentEligible: true,
              done: true
            }
          ]
        }
      ]
    }]
  };

  const state = loadStateFromStorageValue(legacyState);
  const cache = serializeStateForStorage(state);
  const outcomeIds = cache.outcomeIdsByProjectId["workspace-2-project-2"] || [];

  expect(cache.version).toBe(4);
  expect(outcomeIds).toHaveLength(1);
  expect(cache.outcomesById[outcomeIds[0]]?.title).toBe("Landing page");
  expect(Object.keys(cache.burstsById)).toHaveLength(0);

  const hydrated = loadStateFromStorageValue(cache);
  const hydratedProjectOutcomes = hydrated.outcomes.filter((outcome) => outcome.projectId === "workspace-2-project-2");
  expect(hydratedProjectOutcomes).toHaveLength(1);
  expect(hydrated.bursts).toHaveLength(0);
});

test("sync fingerprint ignores navigation-only project selection", () => {
  const before = defaultState();
  const after = appReducer(before, { type: "select-project", projectId: "workspace-2-project-3" });

  expect(buildSyncFingerprint(after)).toBe(buildSyncFingerprint(before));
});

test("sync fingerprint changes for durable project edits", () => {
  const before = defaultState();
  const after = appReducer(before, { type: "rename-project", projectId: "workspace-2-project-2", name: "Roadmap" });

  expect(buildSyncFingerprint(after)).not.toBe(buildSyncFingerprint(before));
});

test("incremental sync plan skips project selection churn", () => {
  const before = defaultState();
  const after = appReducer(before, { type: "select-project", projectId: "workspace-2-project-3" });
  const plan = buildIncrementalSyncPlan(before, after);

  expect(plan.workspacesToUpsert).toHaveLength(0);
  expect(plan.projectsToUpsert).toHaveLength(0);
  expect(plan.outcomesToUpsert).toHaveLength(0);
  expect(plan.burstsToUpsert).toHaveLength(0);
  expect(plan.shouldUpsertPreferences).toBe(false);
});

test("incremental sync plan sends only changed durable records", () => {
  const before = defaultState();
  const after = appReducer(before, { type: "rename-project", projectId: "workspace-2-project-2", name: "Roadmap" });
  const plan = buildIncrementalSyncPlan(before, after);

  expect(plan.projectsToUpsert).toHaveLength(1);
  expect(plan.projectsToUpsert[0].id).toBe("workspace-2-project-2");
  expect(plan.projectsToUpsert[0].name).toBe("Roadmap");
  expect(plan.workspacesToUpsert).toHaveLength(0);
  expect(plan.outcomesToUpsert).toHaveLength(0);
  expect(plan.burstsToUpsert).toHaveLength(0);
});

test.beforeEach(async ({ page }) => {
  const app = new AppPage(page);
  await app.goto();
});

test("workspace and project can be renamed from dropdowns", async ({ page }) => {
  const app = new AppPage(page);

  await app.renameWorkspace("Workspace 2", "Studio");
  await expect(app.workspaceTrigger).toHaveText(/studio/i);

  await app.renameProject("Project 2", "Roadmap");
  await expect(app.projectTabs.filter({ hasText: "Roadmap" })).toHaveCount(1);
});

test("always shows two project tabs and keeps the active visible tab in place", async ({ page }) => {
  const app = new AppPage(page);
  const { projectTabs } = app;

  await expect(projectTabs).toHaveCount(2);
  await expect(projectTabs).toHaveText(["Project 1", "Project 2"]);

  await app.selectProject("Project 3");

  await expect(projectTabs).toHaveCount(2);
  await expect(projectTabs).toHaveText(["Project 3", "Project 2"]);
  await expect(projectTabs.nth(0)).toHaveClass(/active/);

  await projectTabs.nth(1).click();
  await expect(projectTabs).toHaveText(["Project 3", "Project 2"]);
  await expect(projectTabs.nth(1)).toHaveClass(/active/);
});

test("outcome form supports built-in types, custom types, and editing", async ({ page }) => {
  const app = new AppPage(page);

  await app.createOutcome({
    name: "Build onboarding flow",
    type: "development",
    notes: "Implement the happy path first."
  });

  await expect(page.locator(".task-name")).toContainText("Build onboarding flow");
  await expect(page.locator(".burst-summary-pill-type")).toContainText("development");
  await expect(page.locator(".task-notes-copy")).toContainText("Implement the happy path first.");

  await app.editFirstOutcome({
    type: "__custom__",
    customType: "research",
    notes: "Investigate implementation options."
  });

  await expect(page.locator(".burst-summary-pill-type")).toContainText("research");
  await expect(page.locator(".task-notes-copy")).toContainText("Investigate implementation options.");

  await app.openAddOutcomeForm();
  await expect(app.outcomeTypeSelect).toContainText("Research");
});

test("live timer and manual log expose duration presets", async ({ page }) => {
  const app = new AppPage(page);

  await expect(page.locator(".timer-readout")).toHaveText("20:00");

  await app.setTimerPreset(25);
  await expect(page.locator(".timer-status")).toContainText("Timer target set to 25:00.");
  await expect(page.locator(".timer-readout")).toHaveText("25:00");

  await app.setManualPreset(45);
  await expect(app.manualDurationPresets.getByRole("button", { name: "45m", exact: true })).toHaveClass(/active/);
  await expect(page.locator(".timer-status")).toContainText("Time spent set to 00:45.");
});

test("remembers the last visited timer mode after reload", async ({ page }) => {
  const app = new AppPage(page);

  await app.timerModeToday.click();
  await page.reload();

  await expect(app.timerModeToday).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("No bursts logged yet.", { exact: true })).toBeVisible();
});

test("trends opens from the page header instead of the timer tabs", async ({ page }) => {
  const app = new AppPage(page);

  await expect(app.page.getByRole("tab", { name: /trends/i })).toHaveCount(0);
  await app.trendsToggle.click();

  await expect(app.trendsToggle).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#trendsPanel")).toBeVisible();
  await expect(page.getByLabel("Daily tracked time heatmap")).toBeVisible();
});

test("manual log mode saves time against the selected outcome and shows entry history", async ({ page }) => {
  const app = new AppPage(page);

  await app.createOutcome({
    name: "Mobile planning",
    type: "product",
    notes: "Capture time manually from phone."
  });
  await app.createOutcome({
    name: "Desk planning",
    type: "design"
  });

  await app.logManualTime("00:30");

  await expect(app.statusMessage).toContainText("Logged 00:30 for Desk planning.");
  await expect(page.locator(".burst-summary-pill")).toContainText(["1 burst", "00:30 tracked"]);
  await page.getByRole("button", { name: "Show entry log", exact: true }).click();
  await expect(page.locator(".burst-history-meta")).toContainText("00:30");
  await expect(page.locator(".timer-focus-name")).toContainText("Desk planning");
});

test("today mode shows grouped bursts logged for the current day", async ({ page }) => {
  const app = new AppPage(page);

  await app.createOutcome({
    name: "Desk planning",
    type: "design"
  });

  await app.logManualTime("00:30");
  await app.logManualTime("00:45");
  await app.timerModeToday.click();

  await expect(page.getByText("1h 15m tracked", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Today's bursts")).toContainText("Desk planning");
  await expect(page.getByLabel("Today's bursts")).toContainText("2 bursts");
  await expect(page.getByLabel("Today's bursts")).toContainText("1h 15m");
});

test("other outcomes are sorted by latest tracked burst", async ({ page }) => {
  const app = new AppPage(page);

  await app.createOutcome({
    name: "Alpha planning",
    type: "product"
  });
  await app.createOutcome({
    name: "Beta planning",
    type: "design"
  });
  await app.createOutcome({
    name: "Gamma planning",
    type: "development"
  });

  await app.selectOutcome("Alpha planning");
  await app.logManualTime("00:30");

  await app.selectOutcome("Beta planning");
  await app.logManualTime("00:45");

  await app.selectOutcome("Gamma planning");
  await page.getByRole("button", { name: /other outcomes .*show/i }).click();

  const queueNames = await page.locator(".task-queue-list .task-name").allTextContents();
  expect(queueNames).toEqual(["Beta planning", "Alpha planning"]);
});

test("desktop task card expands for entry history and project dropdown overlays", async ({ page }) => {
  const app = new AppPage(page);
  const tasksSection = page.locator(".tasks-section-top");

  await page.setViewportSize({ width: 1280, height: 900 });

  await app.createOutcome({
    name: "Mobile planning",
    type: "product",
    notes: "Capture time manually from phone."
  });
  await app.createOutcome({
    name: "Desk planning",
    type: "design"
  });
  await app.logManualTime("00:30");

  await expect(tasksSection).not.toHaveClass(/expanded/);

  await page.getByRole("button", { name: "Show entry log", exact: true }).click();
  await expect(tasksSection).toHaveClass(/expanded/);

  await page.getByRole("button", { name: "Hide entry log", exact: true }).click();
  await expect(tasksSection).not.toHaveClass(/expanded/);

  await app.openProjectMenu();
  await expect(tasksSection).not.toHaveClass(/expanded/);
  await expect(app.projectDropdown).toBeVisible();
});
