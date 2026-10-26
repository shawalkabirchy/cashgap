import { chromium, firefox, webkit, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import { fileURLToPath } from "node:url";

const directory = new URL("../docs/portfolio/", import.meta.url);
const output = (name) => fileURLToPath(new URL(name, directory));
async function keyboardTo(page, target) {
  for (let count = 0; count < 60; count++) {
    if (await target.evaluate((element) => element === document.activeElement)) return;
    await page.keyboard.press("Tab");
  }
  throw new Error("Required control was not reachable with the keyboard");
}

async function keyboardActivate(page, target) {
  await keyboardTo(page, target);
  await page.keyboard.press("Enter");
}

await mkdir(directory, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 1080 },
  timezoneId: "Asia/Dhaka",
  reducedMotion: "reduce",
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});

try {
  await page.clock.install({ time: new Date("2026-10-25T06:00:00.000Z") });
  await page.goto("http://localhost:4173/");
  await expect(page.getByTestId("metric-opening")).toHaveText("$12,500.00");
  await expect(
    page.locator(".forecast-chart svg.recharts-surface"),
  ).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: output("desktop.png"), fullPage: true });
  const targets = [
    ".metrics",
    ".dashboard-grid > [data-slot=card]",
    ".scenario-panel",
    ".movement-table",
  ];
  const points = [];
  for (const selector of targets) {
    const box = await page.locator(selector).first().boundingBox();
    assert.ok(box, `Missing annotation target ${selector}`);
    points.push({ x: box.x - 11, y: box.y + 10 });
  }
  await page.getByRole("button", { name: "Preview scenario" }).click();
  await expect(page.getByTestId("metric-lowest")).toHaveText("-$690.00");
  await expect(page.getByTestId("top-up")).toHaveText("$3,690.00");
  await page.screenshot({ path: output("scenario.png"), fullPage: true });
  await page.getByRole("button", { name: "Cancel preview" }).click();
  await page.getByRole("button", { name: "View daily breakdown" }).click();
  await page
    .locator(".daily-table tbody tr")
    .nth(10)
    .getByRole("button")
    .click();
  await expect(
    page.getByRole("dialog").getByText("Team payroll", { exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: output("day-detail.png"), fullPage: false });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Hide daily breakdown" }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.pdf({
    path: output("report-a4.pdf"),
    format: "A4",
    printBackground: true,
  });
  await page.pdf({
    path: output("report-letter.pdf"),
    format: "Letter",
    printBackground: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "Mobile layout overflows",
  );
  await page.screenshot({ path: output("mobile.png"), fullPage: true });
  await page.setViewportSize({ width: 360, height: 800 });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "360px layout overflows",
  );
  assert.deepEqual(errors, [], "Application console errors during capture");

  const screenshot = await readFile(new URL("desktop.png", directory));
  await page.close();
  const board = await context.newPage();
  const width = screenshot.readUInt32BE(16);
  const height = screenshot.readUInt32BE(20);
  const notes = [
    "Four metrics make the forecast's starting point and low point explicit.",
    "Daily step balances and the reserve line show when cash gets tight.",
    "Preview a client payment delay before changing any saved record.",
    "Trace the transactions in the daily table and individual day explanations.",
  ];
  const image = `data:image/png;base64,${screenshot.toString("base64")}`;
  const document = `<!doctype html><html lang="en"><meta charset="utf-8"><title>CashGap annotated overview</title><style>*{box-sizing:border-box}body{margin:0;padding:28px;background:#e9f0ec;color:#132c26;font:15px/1.5 system-ui,sans-serif}h1{font-size:24px;margin:0 0 18px}figure{position:relative;margin:0;background:white;border:1px solid #d3dfd8;border-radius:12px;overflow:hidden}img{display:block;width:100%}.point{position:absolute;border:3px solid white;background:#146b52;color:white;width:30px;height:30px;border-radius:50%;display:grid;place-items:center;font-weight:700;box-shadow:0 1px 8px #132c2630}ol{display:grid;grid-template-columns:1fr 1fr;gap:16px 40px;padding-left:25px;margin:22px 0 0}p{color:#52685c;margin:0 0 16px}li::marker{font-weight:700;color:#146b52}</style><h1>CashGap · An explainable cash-flow planner</h1><p>Self-initiated ConsoleLog Studio project · Synthetic sample · Actual browser screenshot</p><figure><img alt="CashGap dashboard with sample agency" src="${image}">${points.map((point, index) => `<span class="point" style="left:${(point.x / width) * 100}%;top:${(point.y / height) * 100}%">${index + 1}</span>`).join("")}</figure><ol>${notes.map((note) => `<li>${note}</li>`).join("")}</ol></html>`;
  await board.setViewportSize({ width: 1440, height: 1080 });
  await board.setContent(document, { waitUntil: "load" });
  await board.locator("img").evaluate((image) => image.decode());
  await board.screenshot({
    path: output("desktop-annotated.png"),
    fullPage: true,
  });
  await writeFile(
    new URL("screenshots.html", directory),
    document.replace(image, "desktop.png"),
  );

  const mobile = await readFile(new URL("mobile.png", directory));
  const mobileDocument = `<!doctype html><html lang="en"><meta charset="utf-8"><title>CashGap mobile walkthrough</title><style>body{margin:0;padding:28px;background:#e9f0ec;color:#132c26;font:16px/1.6 system-ui,sans-serif}h1{margin:0 0 8px;font-size:26px}.layout{display:flex;align-items:flex-start;gap:28px}img{width:390px;border:1px solid #d3dfd8;border-radius:14px}aside{position:sticky;top:28px;max-width:300px}li{margin-bottom:26px}p{color:#52685c}</style><h1>CashGap on a phone</h1><p>Actual responsive UI · Synthetic sample · 390px viewport</p><div class="layout"><img alt="CashGap mobile dashboard" src="data:image/png;base64,${mobile.toString("base64")}"><aside><ol><li>Compact navigation keeps the four workflows reachable.</li><li>The sample banner identifies fictional data and offers a personal plan.</li><li>Financial metrics reflow into two columns.</li><li>The forecast and scenario stack vertically; every control remains usable.</li><li>Wide data tables scroll within their own region. The page itself does not overflow.</li></ol></aside></div></html>`;
  await board.setViewportSize({ width: 820, height: 1080 });
  await board.setContent(mobileDocument, { waitUntil: "load" });
  await board.locator("img").evaluate((image) => image.decode());
  await board.screenshot({
    path: output("mobile-annotated.png"),
    fullPage: true,
  });
  const systemBrowsers = [];
  const managedBrowsers = [{ engine: "chromium", version: browser.version() }];
  for (const [engine, driver] of [
    ["firefox", firefox],
    ["webkit", webkit],
  ]) {
    const managed = await driver.launch();
    try {
      managedBrowsers.push({ engine, version: managed.version() });
    } finally {
      await managed.close();
    }
  }
  for (const channel of ["chrome", "msedge"]) {
    const system = await chromium.launch({ channel });
    try {
      const isolated = await system.newContext({ timezoneId: "Asia/Dhaka" });
      const check = await isolated.newPage();
      await check.clock.install({ time: new Date("2026-10-25T06:00:00.000Z") });
      await check.goto("http://localhost:4173/");
      await expect(check.getByTestId("metric-lowest")).toHaveText("$7,810.00");
      await keyboardActivate(check, check.getByRole("button", { name: "Preview scenario" }));
      await expect(check.getByTestId("metric-lowest")).toHaveText("-$690.00");
      await keyboardActivate(check, check.getByRole("button", { name: "Cancel preview" }));
      await expect(check.getByTestId("metric-lowest")).toHaveText("$7,810.00");
      await keyboardActivate(check, check.getByRole("link", { name: "Invoices", exact: true }));
      await keyboardActivate(check, check.getByRole("button", { name: "Add invoice", exact: true }));
      const form = check.getByRole("dialog");
      await keyboardTo(check, form.getByLabel("Description", { exact: true }));
      await check.keyboard.type("System browser smoke fixture");
      await keyboardTo(check, form.getByLabel("Amount (USD)", { exact: true }));
      await check.keyboard.type("25.00");
      await keyboardActivate(check, form.getByRole("button", { name: "Add invoice", exact: true }));
      await expect(form).not.toBeVisible();
      await expect(
        check.getByText("System browser smoke fixture", { exact: true }),
      ).toBeVisible();
      systemBrowsers.push({
        channel,
        version: system.version(),
        result: "Passed with keyboard only: preview, cancel, static navigation and invoice save",
      });
    } finally {
      await system.close();
    }
  }
  await writeFile(
    new URL("capture-environment.json", directory),
    JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        fixtureDate: "2026-10-25",
        timezone: "Asia/Dhaka",
        browser: browser.version(),
        systemBrowsers,
        managedBrowsers,
        node: process.version,
        platform: os.platform(),
        os: os.release(),
        cpu: os.cpus()[0]?.model,
        logicalCores: os.cpus().length,
        memoryGiB: Number((os.totalmem() / 1024 ** 3).toFixed(1)),
        desktop: { width: 1440, height: 1080 },
        mobile: { width: 390, height: 844 },
        minimumWidthChecked: 360,
        consoleErrors: errors,
      },
      null,
      2,
    ),
  );
  console.log(
    "Captured desktop, scenario, day details, mobile, annotated figures, and A4/Letter reports in docs/portfolio.",
  );
} finally {
  await browser.close();
}
