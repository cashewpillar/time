import { expect, type Locator, type Page } from "@playwright/test";

type TaskInput = {
  name: string;
  type: string;
  notes?: string;
  aiEligible?: boolean;
  customType?: string;
};

type TaskEditInput = {
  type?: string;
  notes?: string;
  aiEligible?: boolean;
  customType?: string;
};

export class AppPage {
  readonly page: Page;
  readonly workspaceTrigger: Locator;
  readonly workspaceDropdown: Locator;
  readonly projectTabs: Locator;
  readonly projectMenuTrigger: Locator;
  readonly projectDropdown: Locator;
  readonly addTaskButton: Locator;
  readonly taskNameInput: Locator;
  readonly taskTypeSelect: Locator;
  readonly customTaskTypeInput: Locator;
  readonly taskNotesInput: Locator;
  readonly aiEligibleCheckbox: Locator;
  readonly timerModeLogTime: Locator;
  readonly timerModeLiveTimer: Locator;
  readonly manualDurationHoursInput: Locator;
  readonly manualDurationMinutesInput: Locator;
  readonly statusMessage: Locator;
  readonly timerTargetPresets: Locator;
  readonly manualDurationPresets: Locator;

  constructor(page: Page) {
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
    this.timerModeLiveTimer = page.getByRole("tab", { name: /live timer/i });
    this.timerModeLogTime = page.getByRole("tab", { name: /log time|time logger/i });
    this.manualDurationHoursInput = page.getByLabel("Manual duration hours");
    this.manualDurationMinutesInput = page.getByLabel("Manual duration minutes");
    this.statusMessage = page.locator(".timer-status");
    this.timerTargetPresets = page.getByRole("group", { name: "Timer target presets" });
    this.manualDurationPresets = page.getByRole("group", { name: "Manual duration presets" });
  }

  async goto(): Promise<void> {
    await this.page.goto("/time/");
    await this.page.evaluate(() => {
      localStorage.clear();
    });
    await this.page.reload();
  }

  async openWorkspaceMenu(): Promise<void> {
    await this.workspaceTrigger.click();
    await expect(this.workspaceDropdown).toBeVisible();
  }

  async openProjectMenu(): Promise<void> {
    await this.projectMenuTrigger.click();
    await expect(this.projectDropdown).toBeVisible();
  }

  async acceptPromptAndClick(trigger: Locator, value: string): Promise<void> {
    this.page.once("dialog", async (dialog) => {
      await dialog.accept(value);
    });
    await trigger.click();
  }

  async renameWorkspace(currentName: string, nextName: string): Promise<void> {
    await this.openWorkspaceMenu();
    await this.acceptPromptAndClick(
      this.workspaceDropdown.getByRole("button", {
        name: `Rename ${currentName}`,
        exact: true
      }),
      nextName
    );
  }

  async selectWorkspace(name: string): Promise<void> {
    await this.openWorkspaceMenu();
    await this.workspaceDropdown.getByRole("button", { name, exact: true }).click();
  }

  async renameProject(currentName: string, nextName: string): Promise<void> {
    await this.openProjectMenu();
    await this.acceptPromptAndClick(
      this.projectDropdown.getByRole("button", {
        name: `Rename ${currentName}`,
        exact: true
      }),
      nextName
    );
  }

  async selectProject(name: string): Promise<void> {
    await this.openProjectMenu();
    await this.projectDropdown.getByRole("button", { name, exact: true }).click();
  }

  async openAddTaskForm(): Promise<void> {
    await this.addTaskButton.click();
  }

  async createTask({ name, type, notes, aiEligible = false, customType }: TaskInput): Promise<void> {
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

  async editFirstTask({ type, notes, aiEligible, customType }: TaskEditInput): Promise<void> {
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

  async selectTask(name: string): Promise<void> {
    await this.page.locator(".task-copy").filter({ hasText: name }).first().click();
  }

  async logManualTime(duration: string): Promise<void> {
    await this.timerModeLogTime.click();
    const [hours, minutes] = duration.split(":").map((part) => Number(part));
    const totalMinutes = hours * 60 + minutes;
    await this.manualDurationPresets.getByRole("button", { name: `${totalMinutes}m`, exact: true }).click();
    await this.page.getByRole("button", { name: /save time/i }).click();
  }

  async setTimerPreset(minutes: number): Promise<void> {
    await this.timerModeLiveTimer.click();
    await this.timerTargetPresets.getByRole("button", { name: `${minutes}m`, exact: true }).click();
  }

  async setManualPreset(minutes: number): Promise<void> {
    await this.timerModeLogTime.click();
    await this.manualDurationPresets.getByRole("button", { name: `${minutes}m`, exact: true }).click();
  }

  async showCustomManualInput(): Promise<void> {
    await this.timerModeLogTime.click();
    await this.manualDurationPresets.getByRole("button", { name: "Custom", exact: true }).click();
  }

  recentSlot(name: RegExp): Locator {
    return this.page.getByRole("button", { name });
  }
}
