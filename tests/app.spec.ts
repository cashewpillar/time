import { expect, test } from "@playwright/test";
import { AppPage } from "./app.page";
import { appReducer, defaultState } from "../src/state/app-state";

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

  await app.logManualTime("00:30");

  await expect(app.statusMessage).toContainText("Logged 00:30 for Mobile planning.");
  const recentSlot = page.getByRole("button", { name: /mobile planning workspace 2 \/ project 2 \/ 00:30/i });
  await expect(recentSlot).toBeVisible();

  await app.setManualPreset(10);
  await recentSlot.click();
  await expect(app.manualDurationPresets.getByRole("button", { name: "30m", exact: true })).toHaveClass(/active/);
});

test("notion import dedupes duplicate title-only tasks", async () => {
  const nextState = appReducer(defaultState(), {
    type: "import-notion-options",
    taskTypes: [],
    workspaces: [{
      name: "Imported Workspace",
      projects: [{
        name: "Imported Project",
        tasks: [
          { entry: "Same task", taskType: "development", notes: "", aiWorkflow: false },
          { entry: "Same task", taskType: "design", notes: "   ", aiWorkflow: true },
          { entry: "Same task", taskType: "development", notes: "Has notes", aiWorkflow: false }
        ]
      }]
    }]
  });

  const importedTasks = nextState.workspaces[0]?.projects[0]?.tasks ?? [];
  expect(importedTasks).toHaveLength(2);
  expect(importedTasks.map((task) => task.notes)).toEqual(["", "Has notes"]);
});
