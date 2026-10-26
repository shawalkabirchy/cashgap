import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import {
  addDays,
  forecast,
  formatMoney,
  localToday,
  type StoredWorkspace,
} from "../src/lib/domain";

async function openApp(page: Page, path = "/") {
  await page.goto(path);
  await expect(page.locator(".save-status")).toContainText(
    "Saved on this device",
  );
}

async function stored(page: Page): Promise<StoredWorkspace> {
  return page.evaluate(
    () =>
      new Promise<StoredWorkspace>((resolve, reject) => {
        const request = indexedDB.open("cashgap", 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction("workspace", "readonly");
          const read = tx.objectStore("workspace").get("current");
          read.onsuccess = () => resolve(read.result);
          read.onerror = () => reject(read.error);
          tx.oncomplete = () => db.close();
        };
      }),
  );
}

async function invoiceForm(page: Page, label: string, amount = "100.00") {
  await page.getByRole("button", { name: "Add invoice", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Description", { exact: true }).fill(label);
  await dialog.getByLabel("Amount (USD)", { exact: true }).fill(amount);
  return dialog;
}

test("production routes, page identity and console health", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  for (const path of ["/", "/invoices/", "/expenses/", "/settings/"]) {
    await openApp(page, path);
    await expect(page).toHaveTitle(/CashGap/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator("nextjs-portal")).toHaveCount(0);
    expect(new URL(page.url()).pathname).toBe(path);
  }
  expect(errors).toEqual([]);
});

test("P05-A5: scenario preview, cancel, one apply and reload", async ({
  page,
}) => {
  await openApp(page);
  const before = await stored(page);
  const lowest = await page.getByTestId("metric-lowest").textContent();
  await page.getByRole("button", { name: "Preview scenario" }).click();
  await expect(page.getByText("Unapplied preview · +14 days")).toBeVisible();
  await expect(page.getByTestId("metric-lowest")).not.toHaveText(lowest!);
  expect(await stored(page)).toEqual(before);
  await page.getByRole("button", { name: "Cancel preview" }).click();
  await expect(page.getByTestId("metric-lowest")).toHaveText(lowest!);
  await page.getByRole("button", { name: "Preview scenario" }).click();
  const previewLowest = await page.getByTestId("metric-lowest").textContent();
  await page.getByRole("button", { name: "Apply scenario" }).click();
  await expect(
    page.getByRole("button", { name: "Preview scenario" }),
  ).toBeVisible();
  const after = await stored(page);
  expect(after.revision).toBe(before.revision + 1);
  expect(after.workspace.invoices[0].expectedOn).toBe(
    addDays(before.workspace.invoices[0].expectedOn, 14),
  );
  await page.reload();
  await expect(page.getByTestId("metric-lowest")).toHaveText(previewLowest!);
});

test("invoice validation, commit, focus restoration and delete", async ({
  page,
}) => {
  await openApp(page, "/invoices/");
  const before = await stored(page);
  const dialog = await invoiceForm(page, "Browser fixture", "1.999");
  await dialog
    .getByRole("button", { name: "Add invoice", exact: true })
    .click();
  await expect(dialog.locator("#invoice-amount")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  expect(await stored(page)).toEqual(before);
  await dialog.locator("#invoice-amount").fill("0.29");
  await dialog
    .getByRole("button", { name: "Add invoice", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add invoice", exact: true }),
  ).toBeFocused();
  expect((await stored(page)).workspace.invoices.at(-1)?.amountMinor).toBe(29);
  await page.getByRole("button", { name: "Delete Browser fixture" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Delete invoice", exact: true })
    .click();
  await expect(page.getByText("Browser fixture", { exact: true })).toHaveCount(
    0,
  );
  expect((await stored(page)).workspace.invoices).toEqual(
    before.workspace.invoices,
  );
});

test("P05-A4: reject future actual receipt, then count the payment once", async ({
  page,
}) => {
  await openApp(page, "/invoices/");
  const before = await stored(page);
  await page
    .getByRole("button", {
      name: "Mark Website redesign received",
      exact: true,
    })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Actual receipt date").fill(addDays(localToday(), 1));
  await dialog.getByRole("button", { name: "Save invoice" }).click();
  await expect(dialog.locator("#invoice-received")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  expect(await stored(page)).toEqual(before);
  await dialog.getByLabel("Actual receipt date").fill(localToday());
  await dialog.getByRole("button", { name: "Save invoice" }).click();
  await expect(dialog).not.toBeVisible();
  const after = await stored(page);
  const result = forecast(after.workspace);
  expect(
    result.days
      .flatMap((day) => day.events)
      .filter((event) => event.id === before.workspace.invoices[0].id),
  ).toHaveLength(1);
  expect(after.workspace.invoices[0].status).toBe("received");
});

test("monthly expense form keeps its anchor and exclusive end date", async ({
  page,
}) => {
  await openApp(page, "/expenses/");
  await page.getByRole("button", { name: "Add expense", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Description", { exact: true })
    .fill("Month-end software");
  await dialog.getByLabel("Amount (USD)", { exact: true }).fill("19.99");
  await dialog.getByLabel("Frequency").selectOption("monthly");
  await dialog.getByLabel("First payment date").fill("2026-01-31");
  await dialog.getByLabel("End date (optional, excluded)").fill("2026-01-31");
  await dialog
    .getByRole("button", { name: "Add expense", exact: true })
    .click();
  await expect(dialog.locator("#expense-end")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await dialog.getByLabel("End date (optional, excluded)").fill("2026-04-01");
  await dialog
    .getByRole("button", { name: "Add expense", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  const record = (await stored(page)).workspace.expenses.at(-1)!;
  expect(record.startOn).toBe("2026-01-31");
  expect(record.endOn).toBe("2026-04-01");
  expect(record.amountMinor).toBe(1999);
  await page.getByRole("button", { name: "Delete Month-end software" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Delete expense", exact: true })
    .click();
  await expect(
    page.getByText("Month-end software", { exact: true }),
  ).toHaveCount(0);
});

test("CSV validates every row, preserves data, then imports locally", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (request) =>
    requests.push(`${request.url()} ${request.postData() ?? ""}`),
  );
  await openApp(page, "/settings/");
  const before = await stored(page);
  await page.getByRole("button", { name: "Import CSV", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("CSV file").setInputFiles({
    name: "private-sentinel.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "type,label,clientName,amount,date\ninvoice,private-sentinel,,1.00,2026-12-01\nexpense,Bad,,1.999,2026-12-02",
    ),
  });
  await expect(dialog.getByText(/Row 3:/)).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Import all valid rows" }),
  ).toBeDisabled();
  expect(await stored(page)).toEqual(before);
  await dialog.getByLabel("CSV file").setInputFiles({
    name: "private-sentinel.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "type,label,clientName,amount,date\ninvoice,=private-sentinel,@literal,0.29,2026-12-01",
    ),
  });
  await expect(
    dialog.getByText("Ready to add 1 invoice(s) and 0 expense(s)."),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Import all valid rows" }).click();
  await expect(dialog).not.toBeVisible();
  expect((await stored(page)).workspace.invoices.at(-1)?.label).toBe(
    "=private-sentinel",
  );
  expect(
    requests.filter(
      (request) =>
        request.includes("private-sentinel") || request.includes("@literal"),
    ),
  ).toEqual([]);
  expect(
    requests.filter((request) => !request.startsWith("http://localhost:4173/")),
  ).toEqual([]);
});

test("P05-A6: backup download, safe replacement and exact restoration", async ({
  page,
}, testInfo) => {
  await openApp(page);
  const before = await stored(page);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export backup" }).click();
  const download = await downloadPromise;
  const backupPath = testInfo.outputPath("cashgap-backup.json");
  await download.saveAs(backupPath);
  const contents = await readFile(backupPath, "utf8");
  expect(JSON.parse(contents).appId).toBe("P05");
  await page.getByRole("button", { name: "Start my own plan" }).click();
  const setup = page.getByRole("dialog");
  await setup.getByLabel("Workspace currency").selectOption("BDT");
  await setup
    .getByLabel("Replace all current records with my new empty plan.")
    .check();
  await setup.getByRole("button", { name: "Replace with my plan" }).click();
  await expect(setup).not.toBeVisible();
  expect((await stored(page)).workspace.invoices).toHaveLength(0);
  expect((await stored(page)).workspace.settings.currency).toBe("BDT");
  await page
    .getByRole("link", { name: "Settings & data", exact: true })
    .click();
  await page.getByRole("button", { name: "Restore backup" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("CashGap backup file").setInputFiles({
    name: "wrong.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"appId":"P01"}'),
  });
  await expect(dialog.getByText(/Invalid CashGap v1 backup/)).toBeVisible();
  expect((await stored(page)).workspace.invoices).toHaveLength(0);
  await dialog.getByLabel("CashGap backup file").setInputFiles({
    name: "cashgap.json",
    mimeType: "application/json",
    buffer: Buffer.from(contents),
  });
  await expect(dialog.getByText(/Valid backup:/)).toBeVisible();
  await dialog.getByRole("button", { name: "Review replacement" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Replace current workspace", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  const after = await stored(page);
  expect(after.workspace).toEqual(before.workspace);
  expect(forecast(after.workspace)).toEqual(forecast(before.workspace));
  expect(after.revision).toBe(before.revision + 2);
});

test("stale tabs reject overwrites and preserve the other tab's commit", async ({
  page,
  context,
}) => {
  await openApp(page, "/invoices/");
  const dialog = await invoiceForm(page, "Stale tab draft");
  const other = await context.newPage();
  await openApp(other, "/invoices/");
  const otherDialog = await invoiceForm(other, "Other tab saved");
  await otherDialog
    .getByRole("button", { name: "Add invoice", exact: true })
    .click();
  await expect(otherDialog).not.toBeVisible();
  await dialog
    .getByRole("button", { name: "Add invoice", exact: true })
    .click();
  await expect(
    dialog.getByText(/Another tab changed this workspace/),
  ).toBeVisible();
  await expect(dialog.getByLabel("Description", { exact: true })).toHaveValue(
    "Stale tab draft",
  );
  const data = await stored(page);
  expect(
    data.workspace.invoices.some(
      (invoice) => invoice.label === "Other tab saved",
    ),
  ).toBe(true);
  expect(
    data.workspace.invoices.some(
      (invoice) => invoice.label === "Stale tab draft",
    ),
  ).toBe(false);
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Copy unsaved text" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Export unsaved changes" }),
  ).toBeVisible();
});

test("P05-A5: a stale scenario cannot overwrite a newer tab's save", async ({
  page,
  context,
}) => {
  await openApp(page);
  const before = await stored(page);
  await page.getByRole("button", { name: "Preview scenario" }).click();
  const other = await context.newPage();
  await openApp(other, "/invoices/");
  const form = await invoiceForm(other, "Saved during scenario preview");
  await form.getByRole("button", { name: "Add invoice", exact: true }).click();
  await expect(form).not.toBeVisible();
  const latest = await stored(other);
  expect(latest.revision).toBe(before.revision + 1);

  await page.getByRole("button", { name: "Apply scenario" }).click();
  await expect(
    page.locator(".scenario-panel").getByText(/Another tab changed this workspace/),
  ).toBeVisible();
  expect(await stored(page)).toEqual(latest);
  expect(latest.workspace.invoices[0].expectedOn).toBe(
    before.workspace.invoices[0].expectedOn,
  );
  await expect(page.getByText("Unapplied preview · +14 days")).toBeVisible();
});

test("quota failure keeps committed data and pending form values", async ({
  page,
}) => {
  await openApp(page, "/invoices/");
  const before = await stored(page);
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = function () {
      throw new DOMException("Test quota failure", "QuotaExceededError");
    };
  });
  const dialog = await invoiceForm(page, "Unsaved quota fixture");
  await dialog
    .getByRole("button", { name: "Add invoice", exact: true })
    .click();
  await expect(dialog.getByText(/browser storage is full/)).toBeVisible();
  await expect(dialog.getByLabel("Description", { exact: true })).toHaveValue(
    "Unsaved quota fixture",
  );
  expect(await stored(page)).toEqual(before);
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.locator(".save-status")).toHaveText("Not saved");
  await expect(
    page.getByRole("button", { name: "Export unsaved changes" }),
  ).toBeVisible();
  expect(await page.evaluate(() => typeof window.onbeforeunload)).toBe(
    "function",
  );
  page.once("dialog", (dialog) => dialog.accept());
  await page.reload();
  await expect(page.locator(".save-status")).toHaveText("Saved on this device");
  expect(await stored(page)).toEqual(before);
});

test("an aborted transaction cannot report a successful save", async ({
  page,
}) => {
  await openApp(page, "/invoices/");
  const before = await stored(page);
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, key) {
      const request = original.call(this, value, key);
      request.addEventListener("success", () => this.transaction.abort());
      return request;
    };
  });
  const dialog = await invoiceForm(page, "Aborted transaction draft");
  await dialog
    .getByRole("button", { name: "Add invoice", exact: true })
    .click();
  await expect(
    dialog.getByText(/Browser storage is unavailable/),
  ).toBeVisible();
  expect(await stored(page)).toEqual(before);
  await expect(dialog.getByLabel("Description", { exact: true })).toHaveValue(
    "Aborted transaction draft",
  );
});

test("a failed replacement still exports the previously saved workspace", async ({
  page,
}, testInfo) => {
  await openApp(page, "/settings/");
  const before = await stored(page);
  await page.getByRole("button", { name: "Restore backup" }).click();
  const dialog = page.getByRole("dialog");
  const candidate = {
    appId: "P05",
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    payload: { ...before.workspace, invoices: [], expenses: [] },
  };
  await dialog.getByLabel("CashGap backup file").setInputFiles({
    name: "empty-plan.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(candidate)),
  });
  await expect(dialog.getByText(/Valid backup:/)).toBeVisible();
  await dialog.getByRole("button", { name: "Review replacement" }).click();
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = function () {
      throw new DOMException("Test quota failure", "QuotaExceededError");
    };
  });
  const confirmation = page.getByRole("alertdialog");
  await confirmation
    .getByRole("button", { name: "Replace current workspace", exact: true })
    .click();
  await expect(confirmation.getByText(/browser storage is full/)).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await confirmation
    .getByRole("button", { name: "Export current workspace first" })
    .click();
  const download = await downloadPromise;
  const path = testInfo.outputPath("saved-workspace.json");
  await download.saveAs(path);
  expect(JSON.parse(await readFile(path, "utf8")).payload).toEqual(
    before.workspace,
  );
  expect(await stored(page)).toEqual(before);
});

test("blocked storage requires an explicit unsaved-session choice", async ({
  page,
}) => {
  await page.addInitScript(() => {
    IDBFactory.prototype.open = function () {
      throw new DOMException("Test blocked storage", "SecurityError");
    };
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(0);
  await expect(page.getByText("Could not open local storage")).toBeVisible();
  await page.getByRole("button", { name: "Explore an unsaved sample" }).click();
  await expect(
    page.getByRole("heading", { name: "Your cash, a clearer picture." }),
  ).toBeVisible();
  await expect(page.locator(".save-status")).toHaveText("Not saved");
});

test("P05-A7: daily table explains every plotted day and print assumptions", async ({
  page,
}) => {
  await openApp(page);
  const data = await stored(page);
  await page.getByRole("button", { name: "View daily breakdown" }).click();
  const table = page.locator(".daily-table");
  await expect(table.locator("tbody tr")).toHaveCount(
    data.workspace.settings.horizonDays,
  );
  await table.locator("tbody tr").first().getByRole("button").click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Contributing movements")).toBeVisible();
  await expect(
    dialog.getByText("Software & subscriptions", { exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".print-only")).toBeVisible();
  await expect(page.locator(".print-only")).toContainText(
    "intraday shortfalls",
  );
  await expect(page.locator(".print-only")).toContainText(
    "end dates are excluded",
  );
  await expect(page.locator(".print-only tbody tr")).toHaveCount(
    data.workspace.settings.horizonDays,
  );
});

test("responsive layout and accessible dashboard and form", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1050 });
  await openApp(page);
  await expect(
    page.locator(".forecast-chart svg.recharts-surface"),
  ).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze())
      .violations,
  ).toEqual([]);
  await page.getByRole("button", { name: "Add invoice", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCSS("opacity", "1");
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze())
      .violations,
  ).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Add invoice", exact: true }),
  ).toBeFocused();
  await page.setViewportSize({ width: 360, height: 800 });
  expect(
    await page
      .getByRole("navigation", { name: "Main navigation" })
      .evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze())
      .violations,
  ).toEqual([]);
  await page
    .getByRole("link", { name: "Settings & data", exact: true })
    .click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("horizon selection persists and summaries agree with the engine", async ({
  page,
}) => {
  await openApp(page);
  await page.getByRole("radio", { name: "365 days", exact: true }).click();
  await expect(
    page.getByRole("radio", { name: "365 days", exact: true }),
  ).toHaveAttribute("aria-checked", "true");
  await expect
    .poll(async () => (await stored(page)).workspace.settings.horizonDays)
    .toBe(365);
  const data = await stored(page);
  const result = forecast(data.workspace);
  await expect(page.getByTestId("metric-lowest")).toHaveText(
    formatMoney(result.lowestMinor, data.workspace.settings.currency),
  );
  await page.reload();
  await expect(
    page.getByRole("radio", { name: "365 days", exact: true }),
  ).toHaveAttribute("aria-checked", "true");
});

test("a scenario can shift multiple chosen invoices in one commit", async ({
  page,
}) => {
  await openApp(page);
  const before = await stored(page);
  await page
    .getByRole("button", { name: "Choose invoices", exact: true })
    .click();
  const picker = page.getByRole("dialog");
  await picker
    .getByRole("checkbox", { name: /Brand strategy workshop/ })
    .check();
  await picker.getByRole("button", { name: "Done choosing invoices" }).click();
  await expect(picker).not.toBeVisible();
  await page.getByRole("button", { name: "Preview scenario" }).click();
  expect(await stored(page)).toEqual(before);
  await page.getByRole("button", { name: "Apply scenario" }).click();
  await expect(
    page.getByRole("button", { name: "Preview scenario" }),
  ).toBeVisible();
  const after = await stored(page);
  expect(after.revision).toBe(before.revision + 1);
  expect(after.workspace.invoices[0].expectedOn).toBe(
    addDays(before.workspace.invoices[0].expectedOn, 14),
  );
  expect(after.workspace.invoices[1].expectedOn).toBe(
    addDays(before.workspace.invoices[1].expectedOn, 14),
  );
  expect(after.workspace.invoices.slice(2)).toEqual(
    before.workspace.invoices.slice(2),
  );
});

test("maximum expense totals stay readable without mobile page overflow", async ({
  page,
}) => {
  await openApp(page, "/settings/");
  const current = await stored(page);
  const now = new Date().toISOString();
  const workspace = {
    settings: {
      ...current.workspace.settings,
      currency: "BDT" as const,
      openingMinor: -1_000_000_000,
      reserveMinor: 1_000_000_000,
      horizonDays: 365 as const,
    },
    invoices: [],
    expenses: Array.from({ length: 550 }, (_, index) => ({
      id: crypto.randomUUID(),
      label: `Maximum expense ${index}`,
      amountMinor: 1_000_000_000,
      startOn: current.workspace.settings.startOn,
      frequency: index < 500 ? ("once" as const) : ("monthly" as const),
      createdAt: now,
      updatedAt: now,
    })),
  };
  await page.getByRole("button", { name: "Restore backup" }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("CashGap backup file")
    .setInputFiles({
      name: "maximum.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({
          appId: "P05",
          formatVersion: 1,
          exportedAt: now,
          payload: workspace,
        }),
      ),
    });
  await expect(dialog.getByText(/Valid backup:/)).toBeVisible();
  await dialog.getByRole("button", { name: "Review replacement" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Replace current workspace", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await page.setViewportSize({ width: 360, height: 800 });
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await expect(page.getByTestId("metric-lowest")).toHaveText(
    formatMoney(forecast(workspace).lowestMinor, "BDT"),
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 703, height: 1000 });
  await page.emulateMedia({ media: "print" });
  expect(await page.locator(".print-only td.money").evaluateAll((cells) => cells.filter((cell) => cell.scrollWidth > cell.clientWidth).map((cell) => ({ text: cell.textContent, width: cell.clientWidth, contentWidth: cell.scrollWidth })))).toEqual([]);
});
