import { expect, type Locator, type Page } from "@playwright/test";

type OutcomeInput = {
  name: string;
  type: string;
  notes?: string;
  customType?: string;
};

type OutcomeEditInput = {
  type?: string;
  notes?: string;
  customType?: string;
};

export class AppPage {
  readonly page: Page;
  readonly workspaceTrigger: Locator;
  readonly workspaceDropdown: Locator;
  readonly projectTabs: Locator;
  readonly projectMenuTrigger: Locator;
  readonly projectDropdown: Locator;
  readonly addOutcomeButton: Locator;
  readonly outcomeNameInput: Locator;
  readonly outcomeTypeSelect: Locator;
  readonly customOutcomeTypeInput: Locator;
  readonly outcomeNotesInput: Locator;
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
    this.addOutcomeButton = page.getByRole("button", { name: /add outcome/i });
    this.outcomeNameInput = page.getByLabel("Outcome name");
    this.outcomeTypeSelect = page.getByLabel("Outcome type", { exact: true });
    this.customOutcomeTypeInput = page.getByLabel("Add an outcome type", { exact: true });
    this.outcomeNotesInput = page.getByLabel("Outcome notes");
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

  async openAddOutcomeForm(): Promise<void> {
    const isAddOutcomeVisible = await this.addOutcomeButton.isVisible();
    if (!isAddOutcomeVisible) {
      const queueToggle = this.page.getByRole("button", { name: /other outcomes .*show|outcomes 0 show/i });
      if (await queueToggle.isVisible()) {
        await queueToggle.click();
      }
    }

    await this.addOutcomeButton.click();
  }

  async createOutcome({ name, type, notes, customType }: OutcomeInput): Promise<void> {
    await this.openAddOutcomeForm();
    await this.outcomeNameInput.fill(name);
    await this.outcomeTypeSelect.selectOption(type);

    if (type === "__custom__" && customType) {
      await expect(this.customOutcomeTypeInput).toBeVisible();
      await this.customOutcomeTypeInput.fill(customType);
    }

    if (notes) {
      await this.outcomeNotesInput.fill(notes);
    }

    await this.page.getByRole("button", { name: /save outcome/i }).click();
  }

  async editFirstOutcome({ type, notes, customType }: OutcomeEditInput): Promise<void> {
    await this.page.getByRole("button", { name: /edit outcome/i }).click();

    if (type) {
      await this.outcomeTypeSelect.selectOption(type);
    }

    if (type === "__custom__" && customType) {
      await expect(this.customOutcomeTypeInput).toBeVisible();
      await this.customOutcomeTypeInput.fill(customType);
    }

    if (typeof notes === "string") {
      await this.outcomeNotesInput.fill(notes);
    }

    await this.page.getByRole("button", { name: /save changes/i }).click();
  }

  async selectOutcome(name: string): Promise<void> {
    const outcome = this.page.locator(".task-copy").filter({ hasText: name }).first();
    if (!(await outcome.isVisible())) {
      const queueToggle = this.page.getByRole("button", { name: /other outcomes .*show|outcomes 0 show/i });
      if (await queueToggle.isVisible()) {
        await queueToggle.click();
      }
    }

    await outcome.click();
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
}
