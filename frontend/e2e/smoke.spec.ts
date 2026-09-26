import { test, expect } from "@playwright/test";
import "./env";

test("app loads", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/?/);
});