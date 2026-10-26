# CashGap LinkedIn drafts

Status: drafts for owner review. Nothing has been published or sent. All business examples use synthetic data; this is a self-initiated ConsoleLog Studio portfolio project.

## Post 1 — The problem

A project can look profitable and still leave an agency short on payroll day.

The problem is often the dates.

A client payment expected on Friday and contractor costs due on Wednesday look fine in a project total. They look different on a daily cash timeline.

I built CashGap as a self-initiated ConsoleLog Studio project to make that timing easier to inspect.

Enter an opening balance, expected receipts, planned expenses, and a reserve. Then move a payment date and see which days fall below that reserve.

The demonstration uses a fictional agency. It makes no prediction about whether a client will pay.

If you run an agency, how do you check the gap between invoicing a project and actually receiving the money?

Suggested visual: `desktop.png`. Suggested first comment: “The demo uses synthetic records. Receipts before the forecast start are assumed included in opening balance.”

## Post 2 — The build decision

A cash-flow chart should be able to explain its own numbers.

That was one of my main decisions while building CashGap.

Every point comes from a daily calculation: previous closing balance + receipts − expenses. The same result powers the chart, the table, the day explanation, and the print report.

There are a few details that matter:

• Receiving an invoice moves the receipt to its actual date. It does not count it twice.
• A monthly expense anchored to January 31 returns to March 31 after February.
• Previewing a payment delay does not change saved records.
• One invalid CSV row prevents the entire import.

These choices are less visible than a chart animation, but they make the workflow useful.

CashGap is a self-initiated ConsoleLog Studio project. Its financial records stay in the browser, with explicit JSON backups.

What is the first calculation you would want to trace before trusting a business dashboard?

Suggested visual: `day-detail.png` or the daily table. Suggested first comment: “The forecast combines transactions into daily closing balances. Intraday clearing is outside this version.”

## Post 3 — The demonstration

Move one client payment by two weeks. Watch the cash gap appear.

That is the main workflow in CashGap, a self-initiated ConsoleLog Studio portfolio project for small agencies.

In the fictional sample beginning October 25, 2026, the saved forecast stays above a $3,000 reserve. Delaying an $8,500 client receipt by 14 days lowers the minimum projected balance to −$690.

The planner shows the first danger day and the $3,690 initial top-up that would keep projected closing balances at the reserve or above.

Those are results from the synthetic fixture, not customer outcomes or a borrowing recommendation.

The app includes an explainable daily table, recurring expenses, scenario previews, CSV import, JSON backup, and a printable report. It runs locally in the browser; bank feeds and cross-device sync are outside this version.

The walkthrough shows the complete flow. If your team has a similar planning workflow, I would be interested in how you handle it today.

[ConsoleLog Studio](https://consolelog.studio/)

Suggested visual: `scenario.png` or the walkthrough recording. Add a public demo link only after deployment and verification.

## Additional angles and publication notes

Five possible follow-ups: explain a danger day; show January 31 recurrence; compare preview and Apply; demonstrate invalid-import recovery; explain why browser storage still needs backups.

Recommended first post: **Post 1**, because it introduces the workflow before the implementation details. Publish the three drafts separately; a date or recurring schedule has not been created.

Optional CTA: “If your team has a manual planning workflow like this, tell me where the process becomes difficult.” Relevant readers include agency owners, operations leads, and freelance teams. Do not tag specific people or claim customer involvement without their permission.
