import {
  expect,
  test
} from "@playwright/test";

if (!process.env.E2E_BASE_URL) {
  test.skip("Set E2E_BASE_URL to run browser smoke tests against a running web app.");
}

test("login screen loads", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
});
