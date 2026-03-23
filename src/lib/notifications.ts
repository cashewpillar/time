export async function requestTimerNotificationPermission(): Promise<NotificationPermission> {
  if (!("Notification" in window)) {
    return "denied";
  }

  if (Notification.permission !== "default") {
    return Notification.permission;
  }

  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}

export function showTimerCompleteNotification(taskName: string, projectName: string): void {
  if (!("Notification" in window) || Notification.permission !== "granted") {
    return;
  }

  const body = `${taskName} finished in ${projectName}.`;

  try {
    const notification = new Notification("Timer complete", {
      body,
      tag: "time-timer-complete",
      renotify: true
    });

    window.setTimeout(() => {
      notification.close();
    }, 8000);
  } catch {
    // Ignore notification failures on browsers that expose the API but reject at runtime.
  }
}
