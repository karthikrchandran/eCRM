import { expect, test } from "@playwright/test";
import type { Browser, Page } from "@playwright/test";

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function expectCockpit(page: Page, bookingHref: string) {
  await expect(page.getByRole("region", { name: "Operations health" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Commercial and cash" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Operating detail" })).toBeVisible();
  await expect(page.getByRole("link", { name: "View booking health" })).toHaveAttribute("href", bookingHref);
}

async function expectCockpitForRole(browser: Browser, credentials: { email: string; password: string }, bookingHref: string) {
  const context = await browser.newContext();

  try {
    const page = await context.newPage();
    await signIn(page, credentials.email, credentials.password);
    await expectCockpit(page, bookingHref);
  } finally {
    await context.close();
  }
}

test("admin and sales receive the shared operations cockpit with role-valid booking drill-through", async ({ browser }) => {
  await expectCockpitForRole(browser, { email: "admin@example.com", password: "Admin@12345" }, "/orders");
  await expectCockpitForRole(browser, { email: "sales@example.com", password: "Sales@12345" }, "/performance");
});
