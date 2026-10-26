import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const origin = "https://cashgap.pages.dev";
const directory = new URL("../docs/qa/", import.meta.url);
await mkdir(directory, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 1080 },
  timezoneId: "Asia/Dhaka",
  reducedMotion: "reduce",
});
const page = await context.newPage();
const errors = [];
const requests = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});
page.on("request", (request) => {
  requests.push({ url: request.url(), body: request.postData() ?? "" });
});
page.on("response", (response) => {
  if (response.status() >= 400)
    errors.push(`HTTP ${response.status()}: ${response.url()}`);
});

async function snapshot() {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open("cashgap", 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction("workspace", "readonly");
      const read = transaction.objectStore("workspace").get("current");
      read.onsuccess = () => resolve(read.result);
      read.onerror = () => reject(read.error);
      transaction.oncomplete = () => db.close();
    };
  }));
}

try {
  await page.clock.install({ time: new Date("2026-10-25T06:00:00.000Z") });
  const routes = [];
  for (const route of ["/", "/invoices/", "/expenses/", "/settings/"]) {
    const response = await page.goto(origin + route);
    assert.equal(response.status(), 200);
    assert.equal(new URL(page.url()).pathname, route);
    const headers = await response.allHeaders();
    assert.equal(headers["x-content-type-options"], "nosniff");
    assert.equal(headers["x-frame-options"], "DENY");
    assert.equal(headers["referrer-policy"], "no-referrer");
    assert.match(headers["permissions-policy"], /camera=\(\)/);
    await expect(page).toHaveTitle(/CashGap/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator(".save-status")).toHaveText("Saved on this device");
    await expect(page.locator("nextjs-portal")).toHaveCount(0);
    const retainedHeaders = Object.fromEntries(
      ["content-type", "server", "x-content-type-options", "x-frame-options", "referrer-policy", "permissions-policy"]
        .map((name) => [name, headers[name]]),
    );
    routes.push({ route, status: response.status(), headers: retainedHeaders });
  }
  await page.goto(origin);
  await expect(page.getByTestId("metric-lowest")).toHaveText("$7,810.00");
  await expect(page.locator(".forecast-chart svg.recharts-surface")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: fileURLToPath(new URL("deployed-desktop.png", directory)), fullPage: true });
  await page.setViewportSize({ width: 360, height: 800 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: fileURLToPath(new URL("deployed-mobile.png", directory)), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1080 });
  const before = await snapshot();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export backup", exact: true }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const backup = Buffer.concat(chunks);
  assert.deepEqual(JSON.parse(backup.toString()).payload, before.workspace);
  assert.equal(JSON.parse(backup.toString()).appId, "P05");

  await page.getByRole("button", { name: "Preview scenario" }).click();
  await expect(page.getByTestId("metric-lowest")).toHaveText("-$690.00");
  await expect(page.getByTestId("top-up")).toHaveText("$3,690.00");
  assert.deepEqual(await snapshot(), before);
  await page.getByRole("button", { name: "Cancel preview" }).click();
  await expect(page.getByTestId("metric-lowest")).toHaveText("$7,810.00");
  await page.getByRole("button", { name: "Preview scenario" }).click();
  await page.getByRole("button", { name: "Apply scenario" }).click();
  await expect(page.getByRole("button", { name: "Preview scenario" })).toBeVisible();
  assert.equal((await snapshot()).revision, before.revision + 1);
  await page.reload();
  await expect(page.getByTestId("metric-lowest")).toHaveText("-$690.00");

  await page.getByRole("link", { name: "Settings & data", exact: true }).click();
  await page.getByRole("button", { name: "Import CSV", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("CSV file").setInputFiles({
    name: "deployment-private-sentinel.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("type,label,clientName,amount,date\ninvoice,deployment-private-sentinel,,0.29,2026-12-01"),
  });
  await expect(dialog.getByText("Ready to add 1 invoice(s) and 0 expense(s).")).toBeVisible();
  await dialog.getByRole("button", { name: "Import all valid rows" }).click();
  await expect(dialog).not.toBeVisible();
  assert.equal((await snapshot()).workspace.invoices.at(-1).amountMinor, 29);

  await page.getByRole("button", { name: "Restore backup", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("CashGap backup file").setInputFiles({
    name: "deployment-private-sentinel.json", mimeType: "application/json", buffer: backup,
  });
  await expect(dialog.getByText(/Valid backup:/)).toBeVisible();
  await dialog.getByRole("button", { name: "Review replacement" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Replace current workspace", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  assert.deepEqual((await snapshot()).workspace, before.workspace);
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await expect(page.getByTestId("metric-lowest")).toHaveText("$7,810.00");
  await page.getByRole("button", { name: "View daily breakdown" }).click();
  await expect(page.locator(".daily-table tbody tr")).toHaveCount(90);
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".print-only")).toContainText("intraday shortfalls");
  await expect(page.locator(".print-only tbody tr")).toHaveCount(90);
  const pdf = await page.pdf({ format: "A4", printBackground: true });
  assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
  assert.ok(pdf.length > 10_000);
  assert.deepEqual(errors, []);
  assert.deepEqual(requests.filter((request) => new URL(request.url).origin !== origin), []);
  assert.deepEqual(requests.filter((request) => JSON.stringify(request).includes("deployment-private-sentinel")), []);

  await writeFile(new URL("deployed-smoke-results.json", directory), JSON.stringify({
    checkedAt: new Date().toISOString(), url: origin, browser: browser.version(),
    method: "Isolated Playwright Chromium; Browser plugin not available",
    timezone: "Asia/Dhaka", fixtureDate: "2026-10-25", routes,
    checks: ["direct routes and refresh", "provider security headers", "synthetic initialization", "1440px and 360px layout", "backup download", "preview/cancel without writes", "single scenario apply and reload", "local CSV import", "exact backup restoration", "90 daily/print rows", "A4 PDF generation", "no file contents or filenames in requests", "no off-origin requests", "no console or HTTP errors"],
    backupFilename: download.suggestedFilename(), backupBytes: backup.length, pdfBytes: pdf.length,
    requestCount: requests.length, consoleErrors: errors, result: "Passed",
  }, null, 2));
  console.log(`Public deployment verified: ${origin}. Results and screenshots saved in docs/qa.`);
} finally {
  await browser.close();
}
