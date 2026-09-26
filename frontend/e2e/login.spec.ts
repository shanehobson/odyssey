import { test, expect } from "@playwright/test";
import "./env";

test("user can log in and is routed to create trip page", async ({ page }) => {
  // Set mobile viewport since the app is mobile-first
  await page.setViewportSize({ width: 375, height: 667 });
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  if (!email || !password) {
    throw new Error("Missing E2E_EMAIL or E2E_PASSWORD in .env.e2e");
  }

  await page.goto("/login");

  // Fill in the email field
  await page.locator('input[id="email"]').fill(email);
  
  // Fill in the password field
  await page.locator('input[id="password"]').fill(password);

  // Click the Log In button
  await page.getByRole("button", { name: /log in/i }).click();

  // Wait for navigation to create trip page
  await expect(page).toHaveURL(/\/trips\/new/, { timeout: 15000 });

  // Check that the create trip page is loaded by looking for the heading
  await expect(page.getByRole("heading", { name: /describe your ideal road trip/i })).toBeVisible();
});