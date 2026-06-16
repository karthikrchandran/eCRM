import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function signOut(page: Page) {
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
}

async function selectOptionByText(control: Locator, text: RegExp) {
  const value = await control.locator("option").filter({ hasText: text }).first().getAttribute("value");
  expect(value).toBeTruthy();
  await control.selectOption(value ?? "");
}

async function bookFreshOrder(page: Page, timestamp: number) {
  const proposalTitle = `Finance proposal ${timestamp}`;
  const documentName = `finance-${timestamp}.pdf`;
  const documentUrl = `https://example.com/proposals/finance-${timestamp}.pdf`;

  await page.goto("/opportunities");
  await page.getByRole("link", { name: "Northstar LMS modernization" }).click();
  await page.getByRole("link", { name: "New proposal" }).click();

  await page.getByLabel("Proposal title").fill(proposalTitle);
  await page.getByLabel("Version label").fill("Finance flow");
  await page.getByLabel("Commercial summary").fill("Accepted proposal for finance smoke.");
  await selectOptionByText(page.getByLabel("Product or service"), /eLearning - eLearning/);
  await page.getByLabel("Line description").fill("Five onboarding modules.");
  await page.getByLabel("Quantity").fill("5");
  await page.getByLabel("Unit price (paise)").fill("100000");
  await page.getByRole("button", { name: "Create proposal" }).click();

  await expect(page.getByRole("heading", { name: proposalTitle })).toBeVisible();
  await page.getByLabel("Document name").fill(documentName);
  await page.getByLabel("Document URL").fill(documentUrl);
  await page.getByLabel("Document source").selectOption("external");
  await page.getByLabel("Canva/design URL").fill("https://www.canva.com/design/e2e-finance");
  await page.getByRole("button", { name: "Save document link" }).click();
  await expect(page.getByText("Proposal document link saved.")).toBeVisible();

  await page.getByRole("button", { name: "Mark sent" }).click();
  await expect(page.getByText("SENT", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Mark accepted" }).click();
  await expect(page.getByText("ACCEPTED", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("ACCEPTED", { exact: true })).toBeVisible();

  const bookOrderLink = page.getByRole("link", { name: "Book order" });
  await expect(bookOrderLink).toHaveAttribute("href", /\/book-order$/);
  await Promise.all([page.waitForURL(/\/book-order$/), bookOrderLink.click()]);
  await expect(page.getByRole("heading", { name: "Book order" })).toBeVisible();
  await page.getByLabel("PO number").fill(`FIN-PO-${timestamp}`);
  await page.getByRole("button", { name: "Book order" }).click();

  await expect(page).toHaveURL(/\/orders\/[^/]+$/);
  await expect(page.getByText(proposalTitle)).toBeVisible();
  return page.url();
}

test("admin manages invoice payment cost and incentive while sales has read-only finance visibility", async ({ page }) => {
  test.setTimeout(60_000);

  const timestamp = Date.now();
  const invoiceNumber = `FIN-${timestamp}`;

  await signIn(page, "admin@example.com", "Admin@12345");
  const orderUrl = await bookFreshOrder(page, timestamp);

  await expect(page.getByRole("heading", { name: "Finance" })).toBeVisible();
  await page.getByLabel("Invoice number").fill(invoiceNumber);
  await page.getByLabel("Invoice date").fill("2026-08-01");
  await page.getByLabel("Due date").fill("2026-08-15");
  await page.getByRole("button", { name: "Save invoice" }).click();
  await expect(page.getByText("Invoice saved.")).toBeVisible();
  await page.reload();
  await expect(page.getByText(`${invoiceNumber} - ISSUED`)).toBeVisible();

  await page.getByLabel("Payment date").fill("2026-08-02");
  await page.getByLabel("Payment amount paise").fill("100000");
  await page.getByLabel("Reference").fill(`UTR-PART-${timestamp}`);
  await page.getByRole("button", { name: "Record payment" }).click();
  await expect(page.getByText("Payment recorded.")).toBeVisible();
  await page.reload();
  await expect(page.getByText(`${invoiceNumber} - PARTIALLY_PAID`)).toBeVisible();
  await expect(page.getByText("READY_FOR_REVIEW", { exact: true })).toHaveCount(0);

  await page.getByLabel("Payment date").fill("2026-08-03");
  await page.getByLabel("Payment amount paise").fill("490000");
  await page.getByLabel("Reference").fill(`UTR-FINAL-${timestamp}`);
  await page.getByRole("button", { name: "Record payment" }).click();
  await expect(page.getByText("Payment recorded.")).toBeVisible();
  await page.reload();
  await expect(page.getByText(`${invoiceNumber} - PAID`)).toBeVisible();
  await expect(page.getByText("READY_FOR_REVIEW", { exact: true }).first()).toBeVisible();

  await page.getByLabel("Cost category").fill("External vendor");
  await page.getByLabel("Cost amount paise").fill("100000");
  await page.getByLabel("Description").fill("Voiceover vendor");
  await page.getByRole("button", { name: "Save cost" }).click();
  await expect(page.getByText("Cost component saved.")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Approve cost" }).click();
  await expect(page.getByText("External vendor - APPROVED")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Priya Menon: 100% - INR 200.00")).toBeVisible();

  await signOut(page);
  await signIn(page, "sales@example.com", "Sales@12345");
  await page.goto(orderUrl);
  await expect(page.getByRole("heading", { name: "Finance" })).toBeVisible();
  await expect(page.getByText("READY_FOR_REVIEW", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve incentive" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Approve cost" })).toHaveCount(0);

  await signOut(page);
  await signIn(page, "admin@example.com", "Admin@12345");
  await page.goto(orderUrl);
  await page.getByRole("button", { name: "Approve incentive" }).click();
  await expect(page.getByText("Incentive approved.")).toBeVisible();
  await page.reload();
  await expect(page.getByText("APPROVED", { exact: true })).toHaveCount(2);
});
