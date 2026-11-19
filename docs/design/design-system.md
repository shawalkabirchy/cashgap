# CashGap visual reference

Built-in Image Gen generated `dashboard-concept.png` for this project. This is a visual reference; the interface, data, text, charts, logo glyph, and controls are implemented natively.

Prompt: Generate the complete CashGap desktop dashboard for a local, small-agency cash-flow planner. Use a white 220–240px sidebar, almost-white green-gray canvas, deep forest text and primary buttons, subtle mint selection and amber reserve warnings. Include the sample-data banner, Overview/Invoices/Expenses/Settings & data navigation, task heading, backup/print/add-invoice actions, four financial metrics, forecast chart with reserve line and horizon controls, right-hand payment-delay scenario panel, and upcoming cash movements table. Use Inter-like sans-serif, fine borders, 12px panel radii and generous spacing. Exclude accounts, banking, invented analytics, marketing sections, illustrations and gradients.

## System

The tokens live on `:root` in `src/app/globals.css`; components never use raw hex values.

- **Colour:** canvas `--background #f6f8f7`, surfaces white, ink `--foreground #132c26` (secondary ink `--ink-2`), one accent `--primary #146b52` with `--secondary` mint for selection, amber `--warning` for reserve states, `--notice` tones for the sample banner, `--chart-baseline` for the saved-plan line and `--danger-zone` for the below-reserve band. The interface stays mostly neutral; no violet anywhere.
- **Type:** self-hosted Geist Sans. h1 28px/620 (24px on phones), card headings 16px/600, body and controls 14px, page sub-lines 15px, labels 13px/500. Nothing renders under 13px, including chart ticks, the legend, badges and the footer. Money uses tabular figures.
- **Radius:** sharp family for a finance tool: 4px badges and segment pills, 6px buttons, fields and alerts, 8px cards and dialogs.
- **Spacing:** 4, 8, 12, 16, 24, 32, 48. Desktop gutter 32px (24px under 1280), phones 16px; cards pad 24px (16px on phones).
- **Buttons:** one pair. A filled primary marks the one main action in a view (Add invoice, Apply scenario, Save plan settings); every other action is the outline secondary; text links draw a 1px underline on hover.
- **Headings:** plain nouns that name the screen or the thing (“Cash-flow forecast”, “Late payment scenario”, “Invoices”, “Plan settings and data”), with a sub-line of real facts from the workspace.

## Components

- **Metrics strip:** four figures; the lowest balance states its distance from the reserve; during a scenario preview each changed figure shows its saved-plan value underneath.
- **Forecast chart:** daily step balances with round y-axis steps, a dashed amber reserve line, a shaded below-reserve band, an optional dashed saved-plan line, and a legend. It fills its card next to the scenario panel. Selecting a day opens its explanation.
- **Segmented control** (`src/components/segmented-control.tsx`): Radix toggle group (`role="radio"`) with one ink pill that slides to the chosen option; used for the forecast horizon and the invoice status filter.
- **Scenario panel:** invoice choice, a ±7-day stepper around a free whole-number field, preview, then apply or cancel, and a reserve result.
- **Tables:** 48px rows, aligned date links, signed and coloured amounts. Under 640px, secondary columns (`.col-wide`) fold into the description line (`.col-compact`), so no table scrolls sideways on a phone.
- **Navigation:** 232px sidebar on desktop with a mint active state and a 2px accent bar; on phones a slim top bar and a fixed bottom tab bar (56px plus the safe area).
- Required extensions follow the same system: invoice/expense forms, import preview, recovery alerts, setup and print view; components are official shadcn sources restyled through semantic tokens.

## Motion

Short state changes only, from the motion tokens (`--m-in` 140ms, `--m-out` 200ms, `--m-press` 90ms, `--m-slide` 240ms, ease `cubic-bezier(.2,.8,.2,1)`):

- buttons step up 1px on hover (fine pointers only) and sink 1px at 98.5% on press;
- focus shows a 2px accent outline whose offset settles from 6px to 2px;
- fields take the accent border and a 3px soft ring;
- table rows tint on hover; the segment pill slides.

Nothing animates on load or scroll, and the chart draws without animation. Under reduced motion, only colours change and the pill jumps.

Concept numbers/dates are illustrative. Runtime values, exact daily step geometry, and all explanatory copy follow the forecast contract and synthetic fixture.
