import { expect, test } from "@playwright/test";

test("hand mode starts a two-player game without phones", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "BUKA COMMAND SCREEN" }).click();
  await expect(page.getByTestId("room-code")).toHaveText(/^[A-Z0-9]{6}$/);

  await page.getByRole("button", { name: "ENABLE HAND MODE" }).click();
  await expect(page.getByText("KIRI LAYAR = P1")).toBeVisible();
  await expect(page.getByText("PLAYER 1").locator("..")).toContainText("LINKED");
  await expect(page.getByText("PLAYER 2").locator("..")).toContainText("LINKED");
  await expect(page.getByRole("button", { name: "INITIATE BREACH" })).toBeEnabled();

  await page.getByRole("button", { name: "INITIATE BREACH" }).click();
  await expect(page.getByTestId("crosshair-1")).toBeVisible({ timeout: 6_000 });
  await expect(page.getByTestId("crosshair-2")).toBeVisible();
  await expect(page.locator(".rift-scene canvas")).toBeVisible();
});
