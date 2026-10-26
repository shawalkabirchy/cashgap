# CashGap visual reference

Built-in Image Gen generated `dashboard-concept.png` for this project. This is a visual reference; the interface, data, text, charts, logo glyph, and controls are implemented natively.

Prompt: Generate the complete CashGap desktop dashboard for a local, small-agency cash-flow planner. Use a white 220–240px sidebar, almost-white green-gray canvas, deep forest text and primary buttons, subtle mint selection and amber reserve warnings. Include the sample-data banner, Overview/Invoices/Expenses/Settings & data navigation, task heading, backup/print/add-invoice actions, four financial metrics, forecast chart with reserve line and horizon controls, right-hand payment-delay scenario panel, and upcoming cash movements table. Use Inter-like sans-serif, fine borders, 12px panel radii and generous spacing. Exclude accounts, banking, invented analytics, marketing sections, illustrations and gradients.

- Canvas: `#f7f9f8`; surfaces: white; text: `#132c26`; primary: `#146b52`; mint: `#e9f3ef`.
- Navigation: 232px rail on desktop; compact top bar and scrollable navigation on phones.
- Typography: self-hosted Geist Sans; 28px page headings, 14px controls/body, 12px secondary labels; tabular money.
- Geometry: 28–32px desktop gutters, 16px mobile gutters; 10–12px radii, fine neutral borders, minimal shadow.
- Chart: actual step balances, reserve reference line, optional baseline comparison, accessible table and day details.
- Components: official shadcn source components; semantic theme tokens; native calendar-date inputs.
- Required extensions follow the same system: invoice/expense forms, import preview, recovery alerts, setup and print view.
- Motion: short state transitions only; respect reduced-motion preferences.

Concept numbers/dates are illustrative. Runtime values, exact daily step geometry, and all explanatory copy follow the forecast contract and synthetic fixture.
