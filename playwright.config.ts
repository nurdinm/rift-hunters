import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: [
    {
      command: "PORT=3101 CLIENT_ORIGIN=http://127.0.0.1:4173 npm run dev -w @rift/server",
      url: "http://127.0.0.1:3101/ready",
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: "VITE_SERVER_URL=http://127.0.0.1:3101 npm run dev -w @rift/client -- --host 127.0.0.1 --port 4173",
      url: "http://127.0.0.1:4173",
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
