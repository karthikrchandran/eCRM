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

test("admin books an accepted proposal and completes production stages", async ({ page }) => {
  const timestamp = Date.now();
  const proposalTitle = `Orders production proposal ${timestamp}`;
  const pdfName = `orders-production-${timestamp}.pdf`;

  await signIn(page, "admin@example.com", "Admin@12345");

  await page.goto("/opportunities");
  await page.getByRole("link", { name: "Acme LMS rollout" }).click();
  await page.getByRole("link", { name: "New proposal" }).click();

  await page.getByLabel("Proposal title").fill(proposalTitle);
  await page.getByLabel("Version label").fill("Order flow");
  await page.getByLabel("Commercial summary").fill("Accepted proposal for order booking smoke.");
  await selectOptionByText(page.getByLabel("Product or service"), /eLearning - eLearning/);
  await page.getByLabel("Line description").fill("Five onboarding modules.");
  await page.getByLabel("Quantity").fill("5");
  await page.getByLabel("Unit price paise").fill("100000");
  await page.getByRole("button", { name: "Create proposal" }).click();

  await expect(page).toHaveURL(/\/opportunities\/[^/]+\/proposals\/[^/]+$/);
  await expect(page.getByRole("heading", { name: proposalTitle })).toBeVisible();

  await page.getByLabel("Original file name").fill(pdfName);
  await page.getByLabel("Stored file name").fill(`stored-${pdfName}`);
  await page.getByLabel("Storage provider").fill("local");
  await page.getByLabel("Storage key").fill(`e2e/${pdfName}`);
  await page.getByLabel("MIME type").fill("application/pdf");
  await page.getByLabel("File size bytes").fill("2048");
  await page.getByRole("button", { name: "Save PDF metadata" }).click();
  await expect(page.getByText("Proposal PDF metadata saved.")).toBeVisible();

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
  await page.getByLabel("Note").first().fill("Production started");
  await page.getByRole("button", { name: "Mark in progress" }).first().click();
  await expect(page.getByText("Production stage updated.")).toBeVisible();
  await page.reload();
  await expect(page.getByText("IN_PROGRESS", { exact: true })).toBeVisible();

  const doneButtons = page.getByRole("button", { name: "Mark done" });
  for (let remaining = await doneButtons.count(); remaining > 0; remaining -= 1) {
    await page.getByLabel("Note").first().fill(`Completed stage ${7 - remaining}`);
    await doneButtons.first().click();
    await expect(doneButtons).toHaveCount(remaining - 1, { timeout: 15_000 });
  }

  await expect(page.getByRole("button", { name: "Mark done" })).toHaveCount(0);
  await page.getByRole("link", { name: "Back to production" }).click();
  await expect(page.getByRole("heading", { name: "Production" })).toBeVisible();
  await expect(page.getByText("DONE")).toBeVisible();
});
