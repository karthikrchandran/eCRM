import { expect, test } from "@playwright/test";
import type { Locator } from "@playwright/test";

async function signIn(page: import("@playwright/test").Page, email: string, password: string) {
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

test("admin creates a lead, branch, contact, follow-up, and reassigns owner", async ({ page }) => {
  await signIn(page, "admin@example.com", "Admin@12345");

  await page.goto("/leads");
  await page.getByRole("link", { name: "New lead/customer" }).click();
  await page.getByLabel("Lead/customer name").fill("Northstar Training Pvt Ltd");
  await page.getByLabel("State").selectOption("LEAD");
  await selectOptionByText(page.getByLabel("Owner"), /Sales User/);
  await page.getByLabel("Industry").fill("Corporate Training");
  await page.getByLabel("Source").fill("Website");
  await page.getByRole("button", { name: "Create lead/customer" }).click();

  await expect(page.getByRole("heading", { name: "Northstar Training Pvt Ltd" })).toBeVisible();

  await page.getByRole("link", { name: "Add branch" }).click();
  await page.getByLabel("Branch name").fill("Mumbai Branch");
  await page.getByLabel("City").fill("Mumbai");
  await page.getByLabel("Region").fill("Maharashtra");
  await page.getByLabel("Sales context").fill("HR buying team");
  await page.getByRole("button", { name: "Create branch" }).click();
  await expect(page.getByText("Mumbai Branch")).toBeVisible();

  await page.getByRole("link", { name: "Add contact" }).click();
  await page.getByLabel("Contact name").fill("Priya Nair");
  await page.getByLabel("Email").fill("priya.nair@example.com");
  await page.getByLabel("Phone").fill("+91 99887 77665");
  await page.getByLabel("Primary contact").check();
  await page.getByRole("button", { name: "Create contact" }).click();
  await expect(page.getByText("Priya Nair")).toBeVisible();

  await page.getByRole("link", { name: "Add activity" }).click();
  await page.getByLabel("Type").selectOption("FOLLOW_UP");
  await page.getByLabel("Status").selectOption("OPEN");
  await selectOptionByText(page.getByLabel("Owner"), /Sales User/);
  await page.getByLabel("Subject").fill("Schedule discovery call");
  await page.getByLabel("Due date").fill("2026-06-20T10:00");
  await page.getByRole("button", { name: "Add activity" }).click();
  await expect(page.getByText("Schedule discovery call")).toBeVisible();

  await selectOptionByText(page.getByLabel("New owner"), /Admin User/);
  await page.getByLabel("Reassignment reason").fill("Admin taking temporary ownership for onboarding");
  await page.getByRole("button", { name: "Reassign owner" }).click();
  await expect(page.getByText("Admin taking temporary ownership for onboarding")).toBeVisible();
});

test("sales can see company-wide leads regardless of owner", async ({ page }) => {
  await signIn(page, "sales@example.com", "Sales@12345");

  await page.goto("/leads");
  await expect(page.getByRole("heading", { name: "Leads / Customers" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Acme Learning Pvt Ltd" })).toBeVisible();

  await selectOptionByText(page.getByLabel("Owner"), /Admin User/);
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page).toHaveURL(/ownerId=/);
});
