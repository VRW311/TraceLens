import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/browser",
  fullyParallel: true,
  workers: 2,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4173/TraceLens/",
    viewport: { width: 1440, height: 1100 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run preview -- --port 4173",
    url: "http://127.0.0.1:4173/TraceLens/",
    reuseExistingServer: !process.env.CI,
  },
});
