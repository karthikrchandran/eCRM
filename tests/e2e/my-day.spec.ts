import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test("salesperson plans, completes, reopens, reviews, and uploads a voice note", async ({ page }) => {
  const timestamp = Date.now();
  const taskTitle = `My Day call ${timestamp}`;

  await signIn(page, "sales@example.com", "Sales@12345");
  await page.getByRole("link", { name: "My Day" }).click();
  await expect(page.getByRole("heading", { name: "My Day", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Add new task" }).click();
  const addTaskDialog = page.getByRole("dialog", { name: "Add new task" });
  await addTaskDialog.getByLabel("Task title").fill(taskTitle);
  await addTaskDialog.getByLabel("Type").selectOption("CALL");
  await addTaskDialog.getByLabel("Priority").selectOption("HIGH");
  await addTaskDialog.getByRole("button", { name: "Add task" }).click();
  await expect(page.getByRole("heading", { name: taskTitle })).toBeVisible();

  const taskRow = page.getByTestId(/sales-task-row-/).filter({ hasText: taskTitle }).first();
  await taskRow.getByRole("button", { name: "Complete" }).click();
  await expect(page.getByRole("heading", { name: "Completed today" })).toBeVisible();
  await expect(taskRow).toContainText(taskTitle);
  await expect(taskRow).toHaveClass(/opacity-60/);

  await taskRow.getByRole("button", { name: "Reopen" }).click();
  await expect(taskRow.getByRole("button", { name: "Complete" })).toBeVisible();

  await page.getByRole("link", { name: "Insights" }).click();
  await expect(page.getByRole("heading", { name: "Suggested tomorrow plan" })).toBeVisible();

  await page.getByRole("link", { name: "End-of-Day Review" }).click();
  const reviewRow = page.getByRole("group", { name: `Review ${taskTitle}` });
  await reviewRow.getByLabel("Outcome").selectOption("MOVE_TO_TOMORROW");
  await page.getByRole("button", { name: "Save review" }).click();
  await expect(page.getByText("End-of-day review saved.")).toBeVisible();

  const upload = await page.request.post("/my-day/voice-notes", {
    multipart: {
      audio: {
        name: `voice-${timestamp}.webm`,
        mimeType: "audio/webm",
        buffer: Buffer.from("fake webm payload")
      }
    }
  });
  expect(upload.ok(), await upload.text()).toBeTruthy();
  const uploaded = (await upload.json()) as { voiceNoteId: string };
  await page.request.post(`/my-day/voice-notes/${uploaded.voiceNoteId}/transcribe`);

  await page.goto("/my-day?note=voice");
  await expect(page.getByLabel(`Replay voice note ${uploaded.voiceNoteId}`)).toBeVisible();
});
