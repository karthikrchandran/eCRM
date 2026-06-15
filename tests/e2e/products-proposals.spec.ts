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

test("admin manages products and proposals, then sales can view the proposal", async ({ page }) => {
  const timestamp = Date.now();
  const productName = `Proposal e2e service ${timestamp}`;
  const proposalTitle = `Acme proposal e2e ${timestamp}`;
  const pdfName = `proposal-${timestamp}.pdf`;

  await signIn(page, "admin@example.com", "Admin@12345");

  await page.getByRole("link", { name: "Products" }).click();
  await expect(page.getByRole("heading", { name: "Products and services" })).toBeVisible();

  await page.getByRole("link", { name: "New product/service" }).click();
  await page.getByLabel("Name").fill(productName);
  await page.getByLabel("Code").fill(`E2E-${timestamp}`);
  await page.getByLabel("Category").fill("eLearning");
  await page.getByLabel("Description").fill("Browser smoke proposal service.");
  await page.getByLabel("GST basis points").fill("1800");
  await page.getByLabel("Production template key").fill("elearning");
  await page.getByLabel("Sort order").fill("5");
  await page.getByRole("button", { name: "Create product/service" }).click();

  await expect(page).toHaveURL(/\/admin\/products$/);
  await expect(page.getByRole("link", { name: productName })).toBeVisible();

  await page.goto("/opportunities");
  await page.getByRole("link", { name: "Acme LMS rollout" }).click();
  await expect(page.getByRole("heading", { name: "Acme LMS rollout" })).toBeVisible();
  await page.getByRole("link", { name: "New proposal" }).click();

  await page.getByLabel("Proposal title").fill(proposalTitle);
  await page.getByLabel("Version label").fill("V1");
  await page.getByLabel("Valid until").fill("2026-07-15");
  await page.getByLabel("Commercial summary").fill("E2E commercial proposal.");
  await page.getByLabel("Assumptions").fill("Client provides inputs.");
  await page.getByLabel("Inclusions").fill("Design and development.");
  await page.getByLabel("Exclusions").fill("Translation.");
  await page.getByLabel("Payment terms").fill("50 percent advance.");
  await page.getByLabel("Delivery timeline").fill("6 weeks.");
  await page.getByLabel("Internal notes").fill("E2E internal note.");
  await selectOptionByText(page.getByLabel("Product or service"), new RegExp(productName));
  await page.getByLabel("Line description").fill("Five interactive modules.");
  await page.getByLabel("Quantity").fill("5");
  await page.getByLabel("Unit price paise").fill("100000");
  await page.getByLabel("GST basis points").last().fill("1800");
  await page.getByRole("button", { name: "Create proposal" }).click();

  await expect(page).toHaveURL(/\/opportunities\/[^/]+\/proposals\/[^/]+$/);
  await expect(page.getByRole("heading", { name: proposalTitle })).toBeVisible();
  await expect(page.getByText(productName)).toBeVisible();
  await expect(page.getByText("INR 5,000.00")).toHaveCount(2);

  await page.getByLabel("Original file name").fill(pdfName);
  await page.getByLabel("Stored file name").fill(`stored-${pdfName}`);
  await page.getByLabel("Storage provider").fill("local");
  await page.getByLabel("Storage key").fill(`e2e/${pdfName}`);
  await page.getByLabel("MIME type").fill("application/pdf");
  await page.getByLabel("File size bytes").fill("2048");
  await page.getByLabel("Canva design URL").fill("https://www.canva.com/design/e2e");
  await page.getByRole("button", { name: "Save PDF metadata" }).click();

  await expect(page.getByText("Proposal PDF metadata saved.")).toBeVisible();
  await expect(page.getByText(pdfName, { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Mark sent" }).click();
  await expect(page.getByText("SENT", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await signIn(page, "sales@example.com", "Sales@12345");

  await page.goto("/opportunities");
  await page.getByRole("link", { name: "Acme LMS rollout" }).click();
  await expect(page.getByRole("heading", { name: "Acme LMS rollout" })).toBeVisible();
  await expect(page.getByRole("link", { name: proposalTitle })).toBeVisible();
});
