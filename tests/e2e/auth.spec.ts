import { expect, test } from "@playwright/test";

test("seeded admin can sign in and see the dashboard", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("admin@example.com");
  await page.getByLabel("Password").fill("Admin@12345");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByText("Open opportunities")).toBeVisible();
  await expect(page.getByText("Booked value excl. GST")).toBeVisible();
  await expect(page.getByText("Pending receivables")).toBeVisible();
  await expect(page.getByText("Production pending")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Top billings" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Reports", exact: true })).toBeVisible();
});

test("invalid login shows a safe error", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("admin@example.com");
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByText("Invalid email or password.")).toBeVisible();
});
