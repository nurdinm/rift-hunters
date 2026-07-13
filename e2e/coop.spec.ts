import { expect, test } from "@playwright/test";

test("display links two controllers and receives touch aim", async ({ browser }) => {
  const displayContext = await browser.newContext();
  const display = await displayContext.newPage();
  await display.goto("/");
  await display.getByRole("button", { name: "BUKA COMMAND SCREEN" }).click();
  await expect(display).toHaveURL(/\/display$/);

  const room = display.getByTestId("room-code");
  await expect(room).toHaveText(/^[A-Z0-9]{6}$/);
  const code = await room.textContent();
  expect(code).toBeTruthy();

  const p1Context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p2Context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p1 = await p1Context.newPage();
  const p2 = await p2Context.newPage();

  await p1.goto(`/controller/${code}`);
  await expect(p1.getByRole("heading", { name: "PLAYER 01" })).toBeVisible();
  await p2.goto(`/controller/${code}`);
  await expect(p2.getByRole("heading", { name: "PLAYER 02" })).toBeVisible();
  await expect(display.getByRole("button", { name: "INITIATE BREACH" })).toBeEnabled();

  await display.getByRole("button", { name: "INITIATE BREACH" }).click();
  await expect(display.getByTestId("crosshair-1")).toBeVisible({ timeout: 6_000 });

  const before = await display.getByTestId("crosshair-1").evaluate((node) => (node as HTMLElement).style.left);
  const pad = p1.getByTestId("touchpad");
  const box = await pad.boundingBox();
  expect(box).not.toBeNull();
  await p1.mouse.move(box!.x + box!.width * 0.85, box!.y + box!.height * 0.25);
  await p1.mouse.down();
  await p1.mouse.move(box!.x + box!.width * 0.85, box!.y + box!.height * 0.25);
  await p1.mouse.up();

  await expect.poll(async () => display.getByTestId("crosshair-1").evaluate((node) => (node as HTMLElement).style.left)).not.toBe(before);

  await Promise.all([p1Context.close(), p2Context.close(), displayContext.close()]);
});
