const { expect } = require("@playwright/test");

class AppPage {
  constructor(page) {
    this.page = page;
    this.workspaceTrigger = page.locator("#workspaceTrigger");
    this.workspaceDropdown = page.locator("#workspaceDropdown");
    this.projectTabs = page.locator("#projectTabs .project-tab");
    this.projectMenuTrigger = page.locator("#projectMenuTrigger");
    this.projectDropdown = page.locator("#projectDropdown");
    this.addTaskButton = page.getByRole("button", { name: /add task/i });
    this.taskNameInput = page.getByLabel("Task name");
    this.taskTypeSelect = page.getByLabel("Task type", { exact: true });
    this.customTaskTypeInput = page.getByLabel("Add a task type", { exact: true });
    this.taskNotesInput = page.getByLabel("Task notes");
    this.aiEligibleCheckbox = page.getByLabel(/can be handled by an ai agent/i);
  }

  async goto() {
    await this.page.addInitScript(() => {
      localStorage.clear();
    });
    await this.page.goto("/time/");
  }

  async openWorkspaceMenu() {
    await this.workspaceTrigger.click();
    await expect(this.workspaceDropdown).toBeVisible();
  }

  async openProjectMenu() {
    await this.projectMenuTrigger.click();
    await expect(this.projectDropdown).toBeVisible();
  }

  async acceptPromptAndClick(trigger, value) {
    this.page.once("dialog", async (dialog) => {
      await dialog.accept(value);
    });
    await trigger.click();
  }

  async renameWorkspace(currentName, nextName) {
    await this.openWorkspaceMenu();
    await this.acceptPromptAndClick(
      this.workspaceDropdown.getByRole("button", {
        name: `Rename ${currentName}`,
        exact: true
      }),
      nextName
    );
  }

  async renameProject(currentName, nextName) {
    await this.openProjectMenu();
    await this.acceptPromptAndClick(
      this.projectDropdown.getByRole("button", {
        name: `Rename ${currentName}`,
        exact: true
      }),
      nextName
    );
  }

  async selectProject(name) {
    await this.openProjectMenu();
    await this.projectDropdown.getByRole("button", { name, exact: true }).click();
  }

  async openAddTaskForm() {
    await this.addTaskButton.click();
  }

  async createTask({ name, type, notes, aiEligible = false, customType }) {
    await this.openAddTaskForm();
    await this.taskNameInput.fill(name);
    await this.taskTypeSelect.selectOption(type);

    if (type === "__custom__" && customType) {
      await expect(this.customTaskTypeInput).toBeVisible();
      await this.customTaskTypeInput.fill(customType);
    }

    if (notes) {
      await this.taskNotesInput.fill(notes);
    }

    if (aiEligible) {
      await this.aiEligibleCheckbox.check();
    }

    await this.page.getByRole("button", { name: /save task/i }).click();
  }

  async editFirstTask({ type, notes, aiEligible, customType }) {
    await this.page.getByRole("button", { name: /edit task/i }).click();

    if (type) {
      await this.taskTypeSelect.selectOption(type);
    }

    if (type === "__custom__" && customType) {
      await expect(this.customTaskTypeInput).toBeVisible();
      await this.customTaskTypeInput.fill(customType);
    }

    if (typeof notes === "string") {
      await this.taskNotesInput.fill(notes);
    }

    if (typeof aiEligible === "boolean") {
      if (aiEligible) {
        await this.aiEligibleCheckbox.check();
      } else {
        await this.aiEligibleCheckbox.uncheck();
      }
    }

    await this.page.getByRole("button", { name: /save changes/i }).click();
  }
}

module.exports = { AppPage };
