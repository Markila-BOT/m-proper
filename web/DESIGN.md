---
name: Landlord Ledger — Bank Passbook
description: A landlord income/expense ledger that reads the way a bank records money — a machine-print green hairline grid on ivory paper, ink-navy type, and a running balance auditable by eye.
colors:
  paper: "#fbf8f1"
  ink: "#1b2a41"
  ink-soft: "rgba(27, 42, 65, 0.72)"
  ink-faint: "rgba(27, 42, 65, 0.66)"
  print: "#2e5e4e"
  print-wash: "rgba(46, 94, 78, 0.06)"
  print-soft: "#e9f1ea"
  rule: "rgba(46, 94, 78, 0.38)"
  stamp: "#a31621"
typography:
  page-title:
    fontFamily: "Manrope, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif"
    fontSize: "17px"
    fontWeight: 700
    letterSpacing: "0.01em"
  caption:
    fontFamily: "Manrope, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 600
    lineHeight: 1.45
    letterSpacing: "0.14em"
  body:
    fontFamily: "Manrope, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
  ledger:
    fontFamily: "IBM Plex Mono, ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.45
    fontFeature: "tnum"
  totals-figure:
    fontFamily: "IBM Plex Mono, ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace"
    fontSize: "21px"
    fontWeight: 600
    fontFeature: "tnum"
  stamp-mark:
    fontFamily: "IBM Plex Mono, ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace"
    fontSize: "11px"
    fontWeight: 700
    letterSpacing: "0.18em"
rounded:
  sm: "2px"
spacing:
  ledger-row: "2.375rem"
  control: "2.25rem"
  cell: "0.75rem 0.625rem"
  page-gutter: "1.5rem"
  page-gutter-lg: "2.25rem"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    height: "2.25rem"
    padding: "0 1rem"
  button-primary-hover:
    backgroundColor: "rgba(27, 42, 65, 0.9)"
    textColor: "{colors.paper}"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.ink-soft}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "0.5rem 0.75rem"
  button-quiet-hover:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
  stamp-confirm:
    backgroundColor: "{colors.stamp}"
    textColor: "{colors.paper}"
    typography: "{typography.stamp-mark}"
    rounded: "{rounded.sm}"
    padding: "0.125rem 0.5rem"
  stamp-confirm-hover:
    backgroundColor: "rgba(163, 22, 33, 0.9)"
    textColor: "{colors.paper}"
  nav-tab-active:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    padding: "0.625rem 0"
  ledger-balance-cell:
    backgroundColor: "{colors.print-wash}"
    textColor: "{colors.ink}"
    typography: "{typography.ledger}"
    padding: "0.75rem 0.625rem"
    width: "9.5rem"
---

# Design System: Landlord Ledger — Bank Passbook

Recorded from the built code on 2026-11-21 (`src/styles.css` and the components under `src/components/`), after the finish review. Every value below is evidenced by the shipped artifact, not by the plan that preceded it. Where the build and the earlier direction contract diverge, the build wins and the divergence is noted.

## Overview

**Creative North Star: "The Bank Passbook"**

The ledger reads the way a bank records money. The surface is a passbook page: ivory paper carries dense printed columns ruled in machine-print green hairlines, every date and peso figure is set in IBM Plex Mono with tabular numerals at print density, and a running balance marches down the right edge on a pale print wash so the eye can audit the month by running down the rail. The category's default — a dashboard of white cards floating on a gray ground — is refused wholesale: no cards, no shadows at rest, no chart rings. Every total is a ruled printed strip, the trend is a ruled table, and the empty ledger is a ruled line, never an illustrated panel.

Depth comes from rules and ground, never elevation. Ink navy does the reading; print green is the machine's voice — it owns the hairline grid, income figures, focus, selection, and the selected rail's wash; stamp red is held out for state marks only, the red of a rubber stamp landing on a confirmation or a rejected line. The browser surfaces carry the world too: selection, caret, native accents, link underlines, and scrollbars are all passbook-toned, the cheap tell that it was built rather than assembled. One authored motion exists — a newly recorded line prints itself onto the page — and nothing else animates; hover and focus are color states, not motion.

The world is an Operate surface: a landlord completing bookkeeping, where scanability, density, and trust outrank expression. The finished world covers the shell (rail, header, tabs), the Overview and Transactions views, and the shared primitives; the Properties page is a recorded chrome-only deferral — its title row and delete cluster are finished in-world, while its card bodies still carry default-Tailwind grays, blues, and pill badges until their own pass lands. Its leftover chrome is recorded, not canonized (see Elevation & Depth and the contracted records).

**Key Characteristics:**

- Ivory paper ground (#fbf8f1), ink-navy type (#1b2a41), machine-print green hairline rules (#2e5e4e), stamp red (#a31621) reserved for state marks.
- IBM Plex Mono with tabular numerals for every date and money figure, at print density (0.8125rem rows, ~2.375rem row rhythm).
- Structure from rules — 1px hairlines everywhere, a 3px double totals rule for closing lines — never from shadows.
- The running balance rail on a print wash down the ledger's right edge, computed over the displayed order.
- One authored motion (the print-in), removed entirely under prefers-reduced-motion.
- 2px corners everywhere: squared, printed form fields.

## Colors

Four palette colors carry the whole world; nothing in the finished surfaces uses a raw hex outside this set.

### Primary

- **Machine-Print Green** (#2e5e4e): the machine's voice. It prints the hairline grid (as the rule alpha below), the income figures, the sort marks, the focus rings and outlines, the chevrons, the checkmarks, and the selected rail's icon and inset bar. It is the only saturated green; it is spent on structure and affirmation, never on decoration.
- **Print Wash** (rgba(46, 94, 78, 0.06)): print at 6% over paper — the balance column's ground, hover ground for rail entries, and the skeleton's pulse tint. The palest claim the green makes on the page.
- **Print Soft** (#e9f1ea): a premixed print tint — the selected rail entry's ground and a select option's focus ground. The one place the world uses a mixed tint instead of an alpha, kept for the shadcn HSL layer's secondary/muted/accent slots (130 22% 93%).
- **Hairline Rule** (rgba(46, 94, 78, 0.38)): print at 38% over paper — the 1px hairline itself, drawn as borders on rows, fields, and internal dividers.

### Secondary

- **Stamp Red** (#a31621): state marks only — the destructive confirm question mark, the Confirm button, and the validation alert. It never decorates. Its standing role was renegotiated 2026-11-21 (full record under Do's and Don'ts → Contracted records): the original direction contract's over-budget mark had no trigger, since the product has no budget concept; no budget scope was added, and stamp red remains the state-mark idiom.

### Neutral

- **Passbook Paper** (#fbf8f1): the ground everywhere — body, rail, panels, fields. Warm ivory, slightly darker than white, so ink and green both sit on it like print on a page.
- **Ink Navy** (#1b2a41): all primary text, the primary buttons' ground, and the ledger's strongest rules (header underline, totals rule). Deep and quiet, never black.
- **Ink Soft** (rgba(27, 42, 65, 0.72)): secondary text — labels, dates, categories, properties, quiet controls.
- **Ink Faint** (rgba(27, 42, 65, 0.66)): placeholders and the least-important affordances (the resting Delete link, the trend's sublabel).
- (Declared but currently unused: `--color-paper-raised: #ffffff` sits in the token layer; no surface references it yet. Recorded so a future surface either uses it or removes it deliberately.)

The shadcn HSL layer underneath the ui/* primitives is re-pointed at this same palette rather than carrying its own: `--background`/`--card` are paper (43 56% 96.5%), `--foreground`/`--primary` are ink (217 41% 18%), `--secondary`/`--muted`/`--accent` are print soft (130 22% 93%), `--destructive` is stamp (355 76% 36%), and `--input`/`--ring` are a print-family green lifted one lightness step for 2px legibility (160 34% 35%). One deliberate outsider: `--border` (77 12% 71%) is a warm sage-gray, not the green hairline — passbook surfaces draw their hairlines with the rule token directly, and the sage border survives only in the deferred Properties page's Card chrome.

### Named Rules

**The Stamp Rule.** Stamp red is a state mark only: destructive confirms and validation failures, always uppercase mono, always bordered or grounded — never a tint, tint never a decoration. If the red doesn't say "act on me" or "this was rejected," it doesn't appear.

**The Owned Browser Chrome Rule.** Selection prints as print green at 22% over paper with ink text; carets and native checkbox/radio accents are print green; links carry ink text over a 1px print underline at 3px offset, turning print green on hover; scrollbars are thin ink (34% alpha) on a transparent track with a paper-framed thumb. The world does not stop at the components.

## Typography

**Body Font:** Manrope (system-ui sans fallback)
**Figure/Label-Mono Font:** IBM Plex Mono (native mono fallback)

**Character:** Manrope carries the reading and the uppercase micro-labels; IBM Plex Mono carries every figure — measurement, not costume. The pairing is the passbook's split: the human hand writes labels in sans, the machine prints the numbers in mono.

There is no display face. The largest type on any page is a 21px mono total; titles are body-scale ink set with quiet confidence.

### Hierarchy

- **Page title** (700, 17px, ink): the product name "Landlord Ledger" (tracking 0.01em) and each view's heading — set in bold sans, not scaled up. Confidence comes from weight and position, not size.
- **Caption label** (600, 0.6875rem / 1.45, uppercase, ink-soft): the world's micro-label — field labels, table headers, strip labels, the tfoot legend, rail headers. Letter-spacing stops at three points: 0.14em on form fields, 0.16em on table headers, 0.18em on totals legends, stamp marks, and the scope tag (which drops to 0.10em in mono).
- **Body** (500, 0.875rem, ink): form input text, tab labels, quiet controls; 600 on controls that act (buttons, tab labels when active).
- **Ledger figures** (500, 0.8125rem / 1.45, IBM Plex Mono, tabular): every ledger cell — dates, descriptions, categories, properties, amounts, balances. Descriptions run 500 in ink; the rest ink-soft at 12.5px.
- **Totals figure** (600, 21px, IBM Plex Mono, tabular): the strip's Income / Expenses / Net — the biggest figures on any page.
- **Stamp mark** (700, 11px, IBM Plex Mono, uppercase, 0.18em, stamp red): the validation alert and the rotated delete-confirm mark; its 10px sibling carries the sort arrows and the trend sublabel.

### Named Rules

**The Tabular Numerals Rule.** Every figure — money, dates, counts — is set in IBM Plex Mono with tabular numerals (`tabular-nums`), so columns of pesos align down the page like a printed ledger. Money is formatted by the one `formatMoney` (₱, exactly two fraction digits everywhere) and dates by the one `formatDate` (en-US, "Mon D, YYYY"); no surface re-creates a local copy, and the sans face never sets a figure.

## Layout

The shell is two columns on paper: a left property rail and the main column. The rail has three composed states. Below lg (1024px) it is w-28 (7rem) and every entry prints its name as a tiny centered caption under its icon — a touch user cannot hover a tooltip — truncated like any narrow printed column. At lg it is either w-16 (4rem) icon-only with hover tooltips, or the expanded w-80 (20rem) list with the collapse toggle; the toggle is a desktop-only control and hides below lg. `useIsDesktop` mirrors the lg media query through matchMedia, SSR-safe: the server paints the desktop rail and narrow viewports correct it on hydration.

The main column floors at `min-w-0` so a wide ledger sheet can never push or clip the paper — wide regions scroll inside their own ruled areas instead. Page gutters are 1.5rem below lg and 2.25rem at lg; each view's header row is the 17px bold title with a right-aligned mono caption where a count exists ("N entries"). The app header composes as a stacked masthead below lg (name, quiet disclosure control, then the primary control full-width) and one 3.5rem line at lg.

Density is the passbook's: ledger rows run ~2.375rem (declared `--passbook-row`, realized as 0.625rem cell padding plus the 0.8125rem ledger line, ~38–39px effective); every field, select trigger, and primary button is 2.25rem high (`--passbook-control`, h-9); the blank ruled lines below the last entry run 2.5rem (40px) and cap at fifteen.

Overflow is owned, never leaked: both tables and the tab row are horizontal overflow regions (`overflow-x-auto`), and the body clips nothing (`overflow-x: hidden`). At 390px the composition is leak-free by construction — the rail's captions truncate, the header stacks its masthead, the tabs scroll inside their rule, the tables slide inside theirs, and `min-w-0` keeps the paper intact. The finish review's mobile captures (`.impeccable/review/`) are the provenance of that width.

## Elevation & Depth

Flat. The finished world casts no shadows at rest; depth is conveyed by rules (hairline green), ground (paper, wash, soft), and ink weight. Exactly two surfaces carry a soft shadow, and both float: the Radix Select option list (`shadow-md`) and the dialog panel (`shadow-lg`) — the one soft shadow a floating surface is allowed. A dialog's page beneath stays legible through a 35% ink wash rather than going dark. The selected rail entry marks itself with an inset print bar (2px on the collapsed rail, 3px expanded) — a printed inset, not a raised edge.

### Named Rules

**The Flat Page Rule.** The page never casts shadows; a floating surface may cast one, softly. Hover on a page element changes color, never elevation.

Drift, recorded not canonized: the deferred Properties page still lifts its cards on hover (`hover:shadow-md`) and its loading state spins a blue default-spinner — pre-existing chrome from before the world, inherited by that page's deferral, not a rule future surfaces should follow.

## Shapes

One corner: 2px. Every field, button, select trigger, dialog panel, stamp mark, and skeleton block is squared like a printed form field (`rounded-[2px]`); the shadcn radius base is re-pointed to 0.125rem so its lg/md steps collapse to the same 2px. No pill shapes in the finished world (the deferral page's `rounded-full` status pills are its own recorded chrome).

The rule system is the form language:

- **Hairline** (1px, print at 38%): every ledger row, field edge, rail entry, and internal divider — drawn with the rule token, never a gray.
- **Print rule** (1px, solid print): the ledger header's underline, the totals strip's top edge, the trend caption's underline; 2px as the active tab's underline.
- **Totals rule** (3px double, print): the accountant's closing line — above the tfoot "Balance carried forward" and above the empty page's "No entries" (`border-top` only; the bottom edge stays a hairline). The one place the world says "this line closes the account."

## Components

### Buttons

- **Shape:** squared (2px radius), 2.25rem high for the primary.
- **Primary:** ink ground, paper text, semibold — exactly one per screen: "+ Add transaction" in the header (full-width below lg), "Record entry" in the dialog, "Add Property" in the expanded rail. Hover dims to 90% ink; focus-visible is a 2px print outline (2px offset on the header's).
- **Quiet:** the export control "Export CSV · {scope}" — transparent ground, ink-soft semibold text that deepens to ink on hover. The control's label always discloses the slice it writes.
- **Outline:** the dialog's Cancel — paper ground with the shadcn `--input` print-family border.
- **Destructive confirm:** stamp ground, paper text, 2px radius — appears only inside a confirm cluster beside the caption question and a hairline Keep control.
- **Focus, two ways:** fields and selects take a 2px print-green ring offset 1px on paper; outline and quiet controls take a 2px print outline. Never the browser default.

### The Ledger (signature component)

The page's mass: a full-width ruled table (TanStack Table v9) with columns Date (7.5rem) / Description / Category (11.75rem) / Property (14rem) / Amount (8.75rem, right) / Balance (9.5rem, right). Headers are caption-uppercase ink-soft over a 1px print underline; sortable headers are buttons carrying `aria-sort`, with a 10px mono ▲/▼ in print green. Cells are mono, tabular, 0.75rem/0.625rem padded: descriptions medium ink; dates, categories, properties ink-soft (12.5px); income amounts print green with a leading `+`, expenses in ink; a 1px left rule separates the Amount and Balance figures from the prose columns.

The balance is a derived measurement, not a field: `runningBalance` over the rows in the order the eye reads them (sorted, filtered), so the rail audits whatever is displayed. It is never a sort key. Balance cells sit on the print wash; the tfoot closes the page — "Balance carried forward · {Mon YYYY}" in caption-uppercase over the 3px double totals rule, the balance figure bold 15px mono on the wash.

Below the last entry, the page carries its blank printed lines: ruled rows at 40px, the balance column washed, nothing written on them — capped at a viewport's worth (fifteen), computed after mount so server and client paint identically, `aria-hidden` and transparent to the pointer. They are paper, not content. An empty ledger gets the totals idiom for nothing: a ruled line with "No entries" and a caption nudge, never a card.

The delete flow is the stamp idiom at rest and in action: a faint caption Delete affordance that reddens on hover/focus; the confirm cluster prints a slightly rotated (−2°) stamp-red bordered mark — "Delete this entry?" — beside a stamp-ground Delete and a hairline Keep.

**The One Authored Motion.** A row that appears after first paint prints itself onto the page: a left-to-right `clip-path` wipe plus a fade, 500ms, exponential ease-out `cubic-bezier(0.16, 1, 0.3, 1)`, the balance figure landing last. First paint is still — the page simply is the record. `prefers-reduced-motion: reduce` removes it entirely. Nothing else is authored: hovers transition color/opacity only (150ms), and the loading states keep stock pulse (skeleton) and spin (spinner) rather than inventing motion.

### The Totals Strip

Income / Expenses / Net as printed columns — not cards, not a chart. Figures are 21px mono semibold tabular; hairline rules divide the columns; the strip's top edge is a 1px print rule and its bottom a hairline; the labels are caption-uppercase. The scope tag sits right-justified in mono caption and names what the figures total on this page: "Displayed ledger · {scope}" on Transactions, where the rows beneath audit the claim, and "All entries · {scope}" on Overview, which displays no rows to audit. The section's `aria-label` carries the same claim. The figures total exactly the slice the caller passes — property selection, search, category, type, and date range included on Transactions — never a calendar month of their own.

### The Six-Month Trend

A green-ruled table, no rings, no bars: the caption "Six-month trend" over a print underline with a 10px mono sublabel ("income against expenses, by month"); rows hairline-ruled with mono tabular figures — income prints green with a leading `+`, expenses ink-soft, net semibold ink. Slides inside its own ruled region when the viewport is narrower than the print.

### Fields and Selects

Hairline print-green border on paper, 2.25rem high, 2px corners, ink text, faint placeholders; labels are caption-uppercase ink-soft above. Focus is the 2px print ring. Every select is a Radix Select — no native `<select>` anywhere: the trigger is the same hairline field with a print chevron; the option list is paper with one hairline rule and the one soft shadow, each option squared with a print-green checkmark on the chosen one. Empty-string values are impossible in Radix, so each select maps its "no choice" state onto a named sentinel at the boundary.

The add-transaction dialog is a passbook line being written: "Write a line into the ledger" — a paper panel with a hairline rule over the 35% ink wash, the same hairline fields, and validation that names the problem and its recovery as a stamp: an all-sides 1.5px stamp border, uppercase mono, stamp ink on paper. The generic left-stripe alert is refused.

### Navigation

Tabs are router Links — the URL is the tab state. One green-ruled row: the active tab carries ink text, bold weight, and a solid 2px print underline; inactive tabs sit in ink-soft with a hairline underline appearing on hover. The row scrolls inside its own rule when the viewport is narrower; wide viewports never see a scrollbar.

### The Property Rail

A ruled index on paper. Entries are hairline-separated; the selected entry carries the print-soft ground, a print icon, an inset print bar on its left edge, and a bold ink name; unselected entries hover onto the print wash. The expanded entry prints name (truncated under pressure), address with a map-pin line icon, units, a caption-uppercase type tag, and a hairline-ruled financial block: Net in semibold mono ink, Income in print green, Expenses in ink-soft — all tabular. The loading state is print-wash blocks pulsing at the widths of the composed blocks they stand in for; the error state prints stamp red.

### Icons

One icon map for property types (`PropertyTypeIcon`): home, office building, landscape — inline line icons at 20px, currentColor, so they print in ink or green as their context does. Rail controls use the same family of line icons (plus, chevron, map pin, users). No emoji, no filled multicolor icon art.

### Skeleton

Print-wash blocks with 2px corners and the stock pulse — a loading page that holds the world's outline instead of reaching for a spinner.

## Do's and Don'ts

The Do list is the keep-list — the invariants that never get diluted as the world extends to new surfaces.

### Do:

- **Do** set every figure in IBM Plex Mono with tabular numerals, formatted through the one `formatMoney` (₱, two fraction digits always) and the one `formatDate`.
- **Do** build structure from the rules: 1px hairlines for rows, fields, and dividers; the 3px double totals rule for closing lines; print underlines for headers and the active tab.
- **Do** keep the balance on its print wash, computed over the displayed order — the rail is the audit.
- **Do** name every totals claim honestly: the strip's label and `aria-label` total exactly the slice its page displays, and say which page semantics they carry ("Displayed ledger" vs "All entries").
- **Do** keep stamp red for state marks only — destructive confirms and validation failures — squared, uppercase mono, bordered or grounded.
- **Do** keep one primary control per screen; everything else is quiet ink.
- **Do** keep every overflow inside its own ruled region (tables and the tab row scroll; the main column floors at `min-w-0`) so the paper never leaks at 390px.
- **Do** honor `prefers-reduced-motion` by removing the print-in entirely.

### Don't:

- **Don't** put shadows on the page at rest — only a floating surface gets one, softly.
- **Don't** invent a budget mark, an over-budget row tint, or any other stamp-red decoration; no budget concept exists in the product (renegotiated 2026-11-21).
- **Don't** set money in the sans face, drop the fraction digits, or re-create a local formatter.
- **Don't** round past 2px, and don't introduce pills, rings, or card grids in the finished world.
- **Don't** replace the ruled empty state with a card or illustration.
- **Don't** animate anything beyond the print-in; hover and focus are color states.
- **Don't** spend print green on decoration — it belongs to rules, income, focus, selection, and the rail's selected state.
- **Don't** finish a new surface by inheriting the deferred Properties page's gray/blue/pill chrome; that page's leftovers are a recorded deferral, not a style.

### Contracted records

1. **The stamp-red renegotiation (2026-11-21).** The original direction contract carried an over-budget mark in stamp red; it had no trigger — no budget concept exists in the product. No budget scope was added. Stamp-red's standing role is state marks only — destructive confirms and validation failures — never decoration. The over-budget row tint retired with the first-viewport plan; the built ledger's rows carry no such mark.
2. **The deferred unknown-category edge.** A transaction already in storage whose category string is not one of the app's category records is unreachable through the app's own form — the form's Category select offers only `INCOME_CATEGORIES` / `EXPENSE_CATEGORIES` — and the ledger's category filter, which lists the same records, can never select it, so no filter state isolates it. In the built code the row itself still renders, printing its raw stored category string in the Category cell and totaling into every summary; what is truly unreachable is its creation and its isolation, not its display — the edge is deferred rather than resolved. No semantics (validation, migration, display treatment) were decided; this record exists so a future change decides them deliberately instead of inheriting an accident.
