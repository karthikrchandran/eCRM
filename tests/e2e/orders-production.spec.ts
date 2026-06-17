import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function selectOptionByText(control: Locator, text: RegExp) {
  const value = await control.locator("option").filter({ hasText: text }).first().getAttribute("value");
  expect(value).toBeTruthy();
  await control.selectOption(value ?? "");
}

async function updateStageStatus(page: Page, index: number, status: string, note: string) {
  await page.getByLabel("Change status").nth(index).selectOption(status);
  await page.getByLabel("Note").nth(index).fill(note);
  await page.getByRole("button", { name: "Update status" }).nth(index).click();
  await expect(page.getByText("Production stage updated.").first()).toBeVisible();
}

test("admin books an accepted proposal and completes production stages", async ({ page }) => {
  const timestamp = Date.now();
  const proposalTitle = `Orders production proposal ${timestamp}`;
  const documentName = `orders-production-${timestamp}.pdf`;
  const documentUrl = `https://example.com/proposals/orders-production-${timestamp}.pdf`;

  await signIn(page, "admin@example.com", "Admin@12345");

  await page.goto("/opportunities");
  await page.getByRole("link", { name: "Northstar LMS modernization" }).click();
  await page.getByRole("link", { name: "New proposal" }).click();

  await page.getByLabel("Proposal title").fill(proposalTitle);
  await page.getByLabel("Version label").fill("Order flow");
  await page.getByLabel("Commercial summary").fill("Accepted proposal for order booking smoke.");
  await selectOptionByText(page.getByLabel("Product or service"), /eLearning - eLearning/);
  await page.getByLabel("Line description").fill("Five onboarding modules.");
  await page.getByLabel("Quantity").fill("5");
  await page.getByLabel("Unit price (paise)").fill("100000");
  await page.getByRole("button", { name: "Create proposal" }).click();

  await expect(page).toHaveURL(/\/opportunities\/[^/]+\/proposals\/[^/]+$/);
  await expect(page.getByRole("heading", { name: proposalTitle })).toBeVisible();

  await page.getByLabel("Document name").fill(documentName);
  await page.getByLabel("Document URL").fill(documentUrl);
  await page.getByLabel("Document source").selectOption("external");
  await page.getByLabel("Canva/design URL").fill("https://www.canva.com/design/e2e-orders");
  await page.getByRole("button", { name: "Save document link" }).click();
  await expect(page.getByText("Proposal document link saved.")).toBeVisible();

  await page.getByRole("button", { name: "Mark sent" }).click();
  await expect(page.getByText("SENT", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Mark accepted" }).click();
  await expect(page.getByText("ACCEPTED", { exact: true })).toBeVisible();

  const proposalUrl = page.url();
  const bookOrderLink = page.getByRole("link", { name: "Book order" });
  await expect(bookOrderLink).toHaveAttribute("href", /\/book-order$/);
  await Promise.all([page.waitForURL(/\/book-order$/), bookOrderLink.click()]);
  await expect(page.getByRole("heading", { name: "Book order" })).toBeVisible();
  await page.getByLabel("PO number").fill(`PO-${timestamp}`);
  await page.getByLabel("Delivery due date").fill("2026-08-15");
  await page.getByRole("button", { name: "Book order" }).click();

  await expect(page).toHaveURL(/\/orders\/[^/]+$/);
  await expect(page.getByRole("heading", { name: /ORD-2026-/ })).toBeVisible();
  await expect(page.getByText(proposalTitle)).toBeVisible();
  const orderUrl = page.url();

  await page.goto(proposalUrl);
  await expect(page.getByRole("link", { name: /View order ORD-2026-/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Book order" })).toHaveCount(0);
  await page.goto(orderUrl);

  await page.getByRole("button", { name: "Create production work" }).click();
  await expect(page.getByRole("link", { name: "View production" })).toBeVisible();
  await page.getByRole("link", { name: "View production" }).click();

  await expect(page).toHaveURL(/\/production\/[^/]+$/);
  await expect(page.getByRole("heading", { name: /ORD-2026-/ })).toBeVisible();
  await updateStageStatus(page, 0, "IN_PROGRESS", "Production started");
  await page.reload();
  await expect(page.getByText("IN_PROGRESS", { exact: true })).toBeVisible();

  const stageCount = await page.getByLabel("Change status").count();
  for (let index = 0; index < stageCount; index += 1) {
    await updateStageStatus(page, index, "DONE", `Completed stage ${index + 1}`);
  }

  await expect(page.getByText("DONE", { exact: true }).first()).toBeVisible();
  await page.getByRole("link", { name: "Back to production" }).click();
  await expect(page.getByRole("heading", { name: "Production" })).toBeVisible();
  await expect(page.getByText("DONE")).toBeVisible();
});
