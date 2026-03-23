import { expect, test } from "@playwright/test";
import { AppPage } from "./app.page";

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

test("task card controls are top-aligned", async ({ page }) => {
  const app = new AppPage(page);

  await app.createTask({
    name: "Check alignment",
    type: "development"
  });

  const alignment = await page.locator(".task-item").evaluate((element) => getComputedStyle(element).alignItems);
  const checkboxAlignment = await page.locator(".task-checkbox-row").evaluate((element) => getComputedStyle(element).alignItems);

  expect(alignment).toBe("flex-start");
  expect(checkboxAlignment).toBe("flex-start");
});
