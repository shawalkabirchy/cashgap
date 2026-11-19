import { defineConfig, devices } from "@playwright/test";

// CASHGAP_URL moves the suite off 4173 when another server holds that port;
// reuseExistingServer would otherwise test whatever is listening there.
const baseURL = new URL(process.env.CASHGAP_URL ?? "http://localhost:4173").origin;
const port = new URL(baseURL).port;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  reporter: [["list"], ["json", { outputFile: "test-results/results.json" }]],
  use: { baseURL, trace: "retain-on-failure" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: {
    command: `npx serve out --listen ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
});
