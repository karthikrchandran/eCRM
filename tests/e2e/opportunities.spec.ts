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

test("opportunity pipeline smoke", async ({ page }) => {
  const title = `Northstar pipeline smoke ${Date.now()}`;

  await signIn(page, "admin@example.com", "Admin@12345");

  await page.goto("/opportunities/new");
  await selectOptionByText(page.getByLabel("Lead/customer"), /Northstar Learning Pvt Ltd/);
  await selectOptionByText(page.getByLabel("Branch"), /Bengaluru Delivery Office/);
  await selectOptionByText(page.getByLabel("Stage"), /Qualified/);
  await selectOptionByText(page.getByRole("combobox", { exact: true, name: "Owner" }), /Kavya Iyer/);
  await page.getByLabel("Opportunity title").fill(title);
  await page.getByLabel("Product/service interest").fill("Custom LMS rollout");
  await page.getByLabel("Estimated value INR").fill("1750000");
  await page.getByLabel("Probability").fill("55");
  await page.getByLabel("Next follow-up").fill("2026-06-20T10:00");
  await page.getByRole("button", { name: "Create opportunity" }).click();

  await expect(page).toHaveURL(/\/opportunities\/[^/]+$/, { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(page.getByText("Northstar Learning Pvt Ltd", { exact: true })).toBeVisible();

  await page.goto("/opportunities");
  await expect(page.getByRole("link", { name: title })).toBeVisible();
  await page.getByRole("link", { exact: true, name: "Board" }).click();
  await expect(page).toHaveURL(/view=board/);
  await expect(page.getByRole("heading", { name: "Qualified" })).toBeVisible();
  await expect(page.getByRole("link", { name: title })).toBeVisible();

  await page.goto("/opportunities/targets");
  await expect(page.getByRole("heading", { name: "Sales targets" })).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await signIn(page, "sales@example.com", "Sales@12345");

  await page.goto("/opportunities");
  await expect(page.getByRole("heading", { name: "Opportunities" })).toBeVisible();
  await expect(page.getByRole("link", { name: title })).toBeVisible();

  await selectOptionByText(page.getByRole("combobox", { exact: true, name: "Owner" }), /Kavya Iyer/);
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page).toHaveURL(/ownerId=/);
  await expect(page.getByRole("link", { name: title })).toBeVisible();
});
