import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function expectReportsSections(page: Page) {
  await Promise.all([page.waitForURL(/\/reports$/), page.getByRole("link", { name: "Reports", exact: true }).click()]);
  await expect(page.getByRole("heading", { name: "Reports", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Top clients" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Top products/services" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Top billings" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Collections" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Recent booked orders" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Open pipeline by stage" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Production pending" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Upcoming follow-ups" })).toBeVisible();
}

test("admin can view read-only company reports", async ({ page }) => {
  await signIn(page, "admin@example.com", "Admin@12345");

  await expectReportsSections(page);
  await expect(page.getByRole("button", { name: "Approve incentive" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Approve cost" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Save" })).toHaveCount(0);
});

test("sales can view reports without mutation controls", async ({ page }) => {
  await signIn(page, "sales@example.com", "Sales@12345");

  await expectReportsSections(page);
  await expect(page.getByRole("button", { name: "Approve incentive" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Approve cost" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Save" })).toHaveCount(0);
});
