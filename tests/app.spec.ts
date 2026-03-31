import { expect, test } from "@playwright/test";
import { AppPage } from "./app.page";
import { getRecentTaskSlots, loadStateFromStorageValue, serializeStateForStorage } from "../src/state/app-state";

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
    }],
    recentTaskSlots: [{
      id: "recent-landing-cta",
      taskId: null,
      taskText: "Landing page - CTA review",
      taskType: "design",
      taskNotes: "Check conversion copy",
      agentEligible: false,
      workspaceId: "workspace-2",
      workspaceName: "Workspace 2",
      projectId: "workspace-2-project-2",
      projectName: "Project 2",
      lastDurationSeconds: 15 * 60,
      loggedAt: Date.now()
    }]
  };

  const state = loadStateFromStorageValue(legacyState);
  const cache = serializeStateForStorage(state);
  const outcomeIds = cache.outcomeIdsByProjectId["workspace-2-project-2"] || [];

  expect(cache.version).toBe(3);
  expect(outcomeIds).toHaveLength(1);
  expect(cache.outcomesById[outcomeIds[0]]?.title).toBe("Landing page");
  expect(cache.outcomesById[outcomeIds[0]]?.sourceBurstIds).toHaveLength(3);
  expect(cache.taskBurstIdsByProjectId["workspace-2-project-2"]).toHaveLength(2);
  expect(cache.recentBurstIds).toHaveLength(1);

  const hydrated = loadStateFromStorageValue(cache);
  const hydratedProjectOutcomes = hydrated.outcomes.filter((outcome) => outcome.projectId === "workspace-2-project-2");
  expect(hydratedProjectOutcomes).toHaveLength(1);
  expect(getRecentTaskSlots(hydrated)).toHaveLength(1);
  expect(getRecentTaskSlots(hydrated)[0]?.taskText).toBe("Landing page - CTA review");
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

test("task form supports built-in types, custom types, AI eligibility, and editing", async ({ page }) => {
  const app = new AppPage(page);

  await app.createTask({
    name: "Build onboarding flow",
    type: "development",
    notes: "Implement the happy path first.",
    aiEligible: true
  });

  await expect(page.locator(".task-name")).toContainText("Build onboarding flow");
  await expect(page.locator(".task-badge")).toContainText(["development", "AI Agent OK"]);
  await expect(page.locator(".task-notes-copy")).toContainText("Implement the happy path first.");

  await app.editFirstTask({
    type: "__custom__",
    customType: "research",
    notes: "Investigate implementation options.",
    aiEligible: false
  });

  await expect(page.locator(".task-badge")).toContainText("research");
  await expect(page.locator(".task-badges")).not.toContainText("AI Agent OK");
  await expect(page.locator(".task-notes-copy")).toContainText("Investigate implementation options.");

  await app.openAddTaskForm();
  await expect(app.taskTypeSelect).toContainText("Research");
});

test("live timer and manual log expose duration presets", async ({ page }) => {
  const app = new AppPage(page);

  await app.setTimerPreset(25);
  await expect(page.locator(".timer-status")).toContainText("Timer target set to 25:00.");

  await app.setManualPreset(45);
  await expect(app.manualDurationPresets.getByRole("button", { name: "45m", exact: true })).toHaveClass(/active/);
  await expect(page.locator(".timer-status")).toContainText("Time spent set to 00:45.");
});

test("remembers the last visited timer mode after reload", async ({ page }) => {
  const app = new AppPage(page);

  await app.timerModeLogTime.click();
  await page.reload();

  await expect(app.timerModeLogTime).toHaveAttribute("aria-selected", "true");
  await expect(app.manualDurationPresets).toBeVisible();
});

test("manual log mode saves time against the selected task and caches it for reuse", async ({ page }) => {
  const app = new AppPage(page);

  await app.createTask({
    name: "Mobile planning",
    type: "product",
    notes: "Capture time manually from phone."
  });
  await app.createTask({
    name: "Desk planning",
    type: "design"
  });

  await app.logManualTime("00:30");

  await expect(app.statusMessage).toContainText("Logged 00:30 for Desk planning.");
  const recentSlot = page.getByRole("button", { name: /desk planning workspace 2 \/ project 2 \/ 00:30/i });
  await expect(recentSlot).toBeVisible();

  await app.setManualPreset(10);
  await recentSlot.click();
  await expect(app.manualDurationPresets.getByRole("button", { name: "30m", exact: true })).toHaveClass(/active/);
  await expect(page.locator(".timer-focus-name")).toContainText("Desk planning");
});

test("clicking a recent slot syncs workspace, project, and selected task", async ({ page }) => {
  const app = new AppPage(page);

  await app.selectWorkspace("Workspace 1");
  await app.selectProject("Project 1");
  await app.createTask({
    name: "Slot sync task",
    type: "design",
    notes: "Sync me back"
  });
  await app.logManualTime("00:15");

  await app.selectWorkspace("Workspace 2");
  await app.selectProject("Project 2");
  await app.createTask({
    name: "Other task",
    type: "product"
  });

  await app.timerModeLogTime.click();
  await app.recentSlot(/slot sync task workspace 1 \/ project 1 \/ 00:15/i).click();

  await expect(app.workspaceTrigger).toHaveText(/workspace 1/i);
  await expect(app.projectTabs.nth(0)).toHaveClass(/active/);
  await expect(app.projectTabs.nth(0)).toHaveText(/project 1/i);
  await expect(page.locator(".selected-task-panel .task-name")).toContainText("Slot sync task");
  await expect(page.locator(".selected-task-panel .task-notes-copy")).toContainText("Sync me back");
});
