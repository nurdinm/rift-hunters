import { expect, test } from "@playwright/test";

test("hand mode exposes calibration and waits for real hand presence", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "BUKA COMMAND SCREEN" }).click();
  await expect(page.getByTestId("room-code")).toHaveText(/^[A-Z0-9]{6}$/);

  await page.getByRole("button", { name: "ENABLE HAND MODE" }).click();
  await expect(page.getByText("KIRI LAYAR = P1")).toBeVisible();
  await expect(page.getByText("SHOW HAND LEFT")).toBeVisible();
  await expect(page.getByText("SHOW HAND RIGHT")).toBeVisible();
  await expect(page.getByText("PLAYER 1").locator("..")).toContainText("WAITING");
  await expect(page.getByText("PLAYER 2").locator("..")).toContainText("WAITING");
  await expect(page.getByRole("button", { name: "INITIATE BREACH" })).toBeDisabled();
});
