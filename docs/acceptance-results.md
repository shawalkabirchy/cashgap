# CashGap acceptance results

Recorded October 26, 2026 (Asia/Dhaka). This is the locally runnable static release. Public Cloudflare deployment has not been performed.

## Recorded runs

| Command | Result | Evidence |
| --- | --- | --- |
| `npm run lint` | Passed | [Lint log](qa/lint.log) |
| `npm run typecheck` | Passed | [Type-check log](qa/typecheck.log) |
| `npm test -- --reporter=default --reporter=json --outputFile=docs/qa/unit-results.json` | 26 passed in two files | [Console and performance log](qa/unit.log), [Vitest JSON](qa/unit-results.json) |
| `npm run build` | Passed; four routes exported to `out` | [Production build log](qa/build.log) |
| `npm run test:e2e` | 54 passed; 0 failed, skipped, or flaky; 115.01 seconds | [Playwright JSON](qa/e2e-results.json), [test source](../tests/app.spec.ts) |
| `npm run capture:portfolio` | Passed; synthetic screenshots, print PDFs, and installed-browser keyboard checks | [Capture environment](portfolio/capture-environment.json), [capture script](../scripts/capture-portfolio.mjs) |

The browser suite ran against the production export served at `http://localhost:4173`, with two workers, isolated test workspaces, and no retries. It contains 18 cases per engine. The final rebuild uses the same application source as that tested export; subsequent edits were tests and documentation. Evidence copies under `docs/qa` survive replacement of the temporary `test-results` directory.

## Product acceptance

| Check ID | Method | Result | Evidence location |
| --- | --- | --- | --- |
| P05-A1 | Pure engine fixture: opening 1,000.00; expense 1,200.00 on January 3; receipt 2,000.00 on January 10. Verify daily equation and horizon boundaries. | Passed: minimum −200.00; closing 1,800.00. | [Domain tests](../src/lib/domain.test.ts), [unit results](qa/unit-results.json) |
| P05-A2 | Same fixture with reserve 300.00; separate equality and negative-opening cases. | Passed: initial top-up 500.00; equality is safe. | [Domain tests](../src/lib/domain.test.ts), [unit log](qa/unit.log) |
| P05-A3 | January 31 anchor through February and March, leap year, and exclusive end date; create a monthly rule through the expense form. | Passed: February clamps; March returns to the 31st; end-date payment excluded. | Domain test `P05-A3`; browser test `monthly expense form keeps its anchor and exclusive end date` in [results](qa/e2e-results.json) |
| P05-A4 | Move an expected invoice to its actual receipt date; inspect contributing events. Test earlier receipts, cancelled invoices, overdue items, and future actual receipt rejection. | Passed: counted once on the actual date; receipts before start covered by opening; excluded lifecycle cases contribute nothing. | Domain receipt tests; browser test `P05-A4` in [results](qa/e2e-results.json) |
| P05-A5 | Preview +14 days, compare persisted snapshot, cancel, apply, reload, and inspect revision. Shift multiple selected invoices in one commit. Open another tab, save during a preview, then attempt stale Apply. | Passed: preview/cancel do not write; Apply advances revision once; stale Apply preserves the newer tab's entire snapshot and retains the preview. | Three scenario tests in [browser results](qa/e2e-results.json); immutable shift test in [unit results](qa/unit-results.json) |
| P05-A6 | Parse quoted/malformed CSV, bad rows, duplicates, invalid headers/types/dates, row/file/workspace limits. Download backup, replace with an empty BDT plan, reject foreign backup, restore, and compare full forecasts. | Passed: invalid candidates produce no partial writes; round trip preserves entities, balances, recurrence, and exact cents. | [Transfer tests](../src/lib/transfers.test.ts), CSV/backup browser cases in [results](qa/e2e-results.json) |
| P05-A7 | Count a table row for every forecast day, open a day's movements, inspect print assumptions, and compare summaries to the engine. Inspect generated A4 and Letter reports. | Passed: 90 displayed/report rows for the fixture; dated report states opening-before-transactions, daily netting, recurrence, exclusions, and horizon. | Browser `P05-A7` and horizon cases; [PDF checks](qa/pdf-results.json); [A4](portfolio/report-a4.pdf), [Letter](portfolio/report-letter.pdf) |

## Shared and recovery checks

| Check ID | Method | Result | Evidence location |
| --- | --- | --- | --- |
| G-A1 — usable UI | Render at 1440 px and 360 px; assert navigation and page bounds. Run axe WCAG 2 A/AA checks on desktop, mobile, and invoice dialog. Check Escape, focus restoration, associated invalid fields, and reduced-motion capture. Navigate, preview/cancel, and save an invoice using Tab/Enter/type in installed Chrome and Edge. | Passed in the tested views. Data tables intentionally scroll within their region. No axe violations in those scans. | Responsive/focus/validation browser cases in [results](qa/e2e-results.json); [keyboard capture record](portfolio/capture-environment.json); [desktop](portfolio/desktop-annotated.png), [mobile](portfolio/mobile-annotated.png) |
| G-A2 — truthful state | Observe initial loading, explicit unsaved sample when storage is blocked, invalid input, failed save, successful transaction, and preview status. Abort an actual write transaction after request success. | Passed: aborted transaction never reports Saved; draft survives; invalid fields retain values. | Blocked/quota/aborted-transaction browser cases in [results](qa/e2e-results.json) |
| G-A3 — reliable records | Reload committed data; race two same-origin tabs; abort transaction; inject quota failure; attempt invalid import/restore. Export committed data after a failed replacement. | Passed: no stale overwrite, partial write, or accidental export of a failed replacement as the old saved workspace. | Stale tab/scenario, quota, abort, failed replacement, and backup browser cases in [results](qa/e2e-results.json) |
| G-A4 — privacy | Record request URLs and bodies before and after selecting/importing a sentinel CSV. Check for its filename, contents, and client text; reject non-local requests. Inspect file workflows and locally bundled fonts. | Passed: no sentinel or off-origin requests during that workflow. There are no application upload/analytics APIs. | Browser `CSV validates every row, preserves data, then imports locally`; [transfer source](../src/lib/transfers.ts); [capture console record](portfolio/capture-environment.json) |
| G-A5 — bounded work | Validate 500 invoices, 500 one-time expenses, 50 monthly rules, horizons, amount bounds, 500 CSV rows/1 MiB, and 10 MiB JSON before committing. Restore maximum negative BDT expense totals and check mobile/print bounds. | Passed: exceeded limits rejected; largest tested displayed amounts remain complete; all 1,460 print monetary cells fit their columns. | Unit bounds tests and browser `maximum expense totals stay readable without mobile page overflow` in [results](qa/e2e-results.json) |
| G-A6 — evidence | Retain machine-readable results, exact environment, calculation timing, browser screenshots, print files, and commands. | Passed for recorded local checks; unrun environments listed below. | This record, [QA files](qa/), [capture environment](portfolio/capture-environment.json) |

Storage-full and blocked-storage conditions use deterministic `QuotaExceededError`/`SecurityError` fault injection. Transaction failure aborts a real IndexedDB transaction after its put request succeeds. The suite does not fill the physical disk. Pending edits remain in memory with explicit recovery export and a navigation warning; committed and pending exports are separate choices.

## Environment and performance

| Item | Actual environment |
| --- | --- |
| OS / hardware | Windows 11, OS build 10.0.26200; Intel Core i7-1355U; 12 logical cores; 15.6 GiB usable memory |
| Runtime | Node 24.14.0; npm 11.14.1 |
| Toolchain | Next.js 16.4.3, React 19.3.1, TypeScript 6.0.3, Vitest 5.0.5, Playwright 1.64.1, axe-core 4.14.0 |
| Full automated browser suite | Chromium 156.0.8078.4, Firefox 157.0, WebKit 27.2 |
| Installed-browser keyboard smoke | Google Chrome 156.0.8078.47; Microsoft Edge 156.0.4314.42 |
| Screenshot setup | Desktop 1440 × 1080; phone 390 × 844; minimum width 360; Asia/Dhaka; reduced motion |
| Synthetic capture clock | October 25, 2026; the capture clock intentionally stays fixed while actual run timestamps use the host clock |

The final logged pure-engine invocation processed **500 invoices, 500 one-time expenses, 50 monthly rules, and 365 days in 6.87 ms**. It retained safe integer precision and passed the **200 ms calculation target**. See [unit.log](qa/unit.log) and its test fixture for the exact measured operation. This is one Node/Vitest forecast invocation, not a percentile, storage benchmark, browser interaction-to-paint measurement, or performance guarantee on other devices.

The portfolio fixture starts with $12,500 and reserve $3,000. Its baseline minimum is $7,810 and closing balance $19,230. A +14-day shift to the $8,500 Juniper receipt produces a minimum of −$690 and an initial top-up of $3,690. Capture asserts these values before saving promotional assets. They are synthetic demonstrations, not customer results.

Both print PDFs contain four pages and all 90 daily rows. A4 first page and Letter final page were rendered and visually inspected after the final currency-header layout change. Browser tests additionally check print cells at 703 px printable width using maximum supported BDT totals. [A4 preview](portfolio/report-a4-preview-1.png), [Letter final page](portfolio/report-letter-last-4.png), [PDF dimensions and row counts](qa/pdf-results.json).

The dependency audit during setup reported zero known vulnerabilities after applying the pinned preview-server compression fix. Application and dependency versions are recorded in `package-lock.json`; third-party license notices are retained in the export.

## Not run and release limits

| Environment or check | Result | Reason / next step |
| --- | --- | --- |
| Public Cloudflare Pages deployment, provider headers, direct public routes and downloads | **Not run** | Requires the owner's account access and publication authorization. Follow [deployment.md](deployment.md), then verify the real origin. |
| Actual Safari, iOS devices, Android devices, and screen-reader session | **Not run** | No physical-device or screen-reader session was available. Managed WebKit and axe are the recorded substitutes, not proof of those environments. |
| Physical A4/Letter printer output | **Not run** | Browser-generated PDFs and CSS print rendering were verified; paper output was not. |
| Full interaction-to-paint latency at maximum records | **Not run** | The recorded performance figure measures only the pure forecast calculation. |
| Browser eviction, hardware failure, and operating-system disk exhaustion | **Not run** | Failure injection verifies application responses; it does not simulate every environmental failure. Export JSON for retention. |

The app is ready for local portfolio review. Public-release verification remains an owner deployment step. Browser storage belongs to a device and origin, can be cleared, and has no cloud replica; JSON backup/restore is the recovery path.
