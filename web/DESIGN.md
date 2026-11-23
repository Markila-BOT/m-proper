---
name: Landlord Ledger — Liquid Glass
description: A landlord income/expense ledger on a passbook page under a liquid-glass chrome — a machine-print hairline grid and ink-navy figures on ivory paper, with a bounded translucent header, nav, and rail chrome that floats over the content and refuses to paint where text must be read.
colors:
  glass-tint: 'rgba(251, 248, 241, 0.72)'
  glass-edge: 'rgba(46, 94, 78, 0.72)'
  glass-shadow: '0 1px 0 0 rgba(27, 42, 65, 0.06), 0 10px 24px -16px rgba(27, 42, 65, 0.24)'
  paper: '#fbf8f1'
  ink: '#1b2a41'
  ink-soft: 'rgba(27, 42, 65, 0.72)'
  ink-faint: 'rgba(27, 42, 65, 0.66)'
  print: '#2e5e4e'
  print-wash: 'rgba(46, 94, 78, 0.06)'
  print-soft: '#e9f1ea'
  rule: 'rgba(46, 94, 78, 0.38)'
  stamp: '#a31621'
typography:
  page-title:
    fontFamily: "Manrope, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif"
    fontSize: '17px'
    fontWeight: 700
    letterSpacing: '0.01em'
  caption:
    fontFamily: "Manrope, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif"
    fontSize: '0.6875rem'
    fontWeight: 600
    lineHeight: 1.45
    letterSpacing: '0.14em'
  body:
    fontFamily: "Manrope, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif"
    fontSize: '0.875rem'
    fontWeight: 500
  ledger:
    fontFamily: "IBM Plex Mono, ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace"
    fontSize: '0.8125rem'
    fontWeight: 500
    lineHeight: 1.45
    fontFeature: 'tnum'
  totals-figure:
    fontFamily: "IBM Plex Mono, ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace"
    fontSize: '21px'
    fontWeight: 600
    fontFeature: 'tnum'
  stamp-mark:
    fontFamily: "IBM Plex Mono, ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace"
    fontSize: '11px'
    fontWeight: 700
    letterSpacing: '0.18em'
rounded:
  sm: '2px'
spacing:
  ledger-row: '2.375rem'
  control: '2.25rem'
  cell: '0.75rem 0.625rem'
  page-gutter: '1.5rem'
  page-gutter-lg: '2.25rem'
components:
  button-primary:
    backgroundColor: '{colors.ink}'
    textColor: '{colors.paper}'
    typography: '{typography.body}'
    rounded: '{rounded.sm}'
    height: '2.25rem'
    padding: '0 1rem'
  button-primary-hover:
    backgroundColor: 'rgba(27, 42, 65, 0.9)'
    textColor: '{colors.paper}'
  button-quiet:
    backgroundColor: 'transparent'
    textColor: '{colors.ink-soft}'
    typography: '{typography.body}'
    rounded: '{rounded.sm}'
    padding: '0.5rem 0.75rem'
  button-quiet-hover:
    backgroundColor: 'transparent'
    textColor: '{colors.ink}'
  button-outline-quiet:
    backgroundColor: '{colors.paper}'
    textColor: '{colors.ink-soft}'
    typography: '{typography.body}'
    rounded: '{rounded.sm}'
    height: '2.25rem'
    padding: '0 1rem'
  button-outline-quiet-hover:
    backgroundColor: '{colors.print-wash}'
    textColor: '{colors.ink}'
  stamp-confirm:
    backgroundColor: '{colors.stamp}'
    textColor: '{colors.paper}'
    typography: '{typography.stamp-mark}'
    rounded: '{rounded.sm}'
    padding: '0.125rem 0.5rem'
  stamp-confirm-hover:
    backgroundColor: 'rgba(163, 22, 33, 0.9)'
    textColor: '{colors.paper}'
  nav-tab-active:
    backgroundColor: 'transparent'
    textColor: '{colors.ink}'
    typography: '{typography.body}'
    padding: '0.625rem 0'
  ledger-balance-cell:
    backgroundColor: '{colors.print-wash}'
    textColor: '{colors.ink}'
    typography: '{typography.ledger}'
    padding: '0.75rem 0.625rem'
    width: '8rem'
  register-net-cell:
    backgroundColor: '{colors.print-wash}'
    textColor: '{colors.ink}'
    typography: '{typography.ledger}'
    padding: '0.75rem 0.625rem'
    width: '8rem'
---

# Design System: Landlord Ledger — Liquid Glass

Recorded from the built code on 2026-11-22 (`src/styles.css`, the components under `src/components/`, and the record's own pipeline — `src/lib/format.ts`, `src/transactions/summarize.ts`, `src/stores/ledgerFilterStore.ts`, the routes), after the third refinement pass — local-truth dates, the displayed-slice export, the mount-gated empty state, and the minors (the skip link, 44px sort headers, the count caption, the caveat's why, the rail's quiet Add Property). The second pass's records — one-line density at real widths, the book-authority rail, the Properties register, the accelerators (Reset filters, "/") — still stand. Every value below is evidenced by the shipped artifact, not by the plan that preceded it. Where the build and the earlier direction contract diverge, the build wins and the divergence is noted.

## Overview

**Creative North Star: "The Bank Passbook"**

The ledger reads the way a bank records money. The surface is a passbook page: ivory paper carries dense printed columns ruled in machine-print green hairlines, every date and peso figure is set in IBM Plex Mono with tabular numerals at print density, and a running balance marches down the right edge on a pale print wash so the eye can audit the month by running down the rail. The category's default — a dashboard of white cards floating on a gray ground — is refused wholesale: no cards, no shadows at rest, no chart rings. Every total is a ruled printed strip, the trend is a ruled table, and the empty ledger is a ruled line, never an illustrated panel.

Depth comes from rules and ground on the content, never elevation — while the shell's chrome is the one floating material. A bounded liquid-glass pane carries the header and the section nav as one sticky surface, and the rail's header and footer are glass blocks; the entry list between them is opaque paper. The glass is translucent enough for the page to move under it and refuses to paint anywhere text must be read (see Material). Ink navy does the reading; print green is the machine's voice — it owns the hairline grid, income figures, focus, selection, and the selected rail's wash; stamp red is held out for state marks only, the red of a rubber stamp landing on a confirmation or a rejected line. The browser surfaces carry the world too: selection, caret, native accents, link underlines, and scrollbars are all passbook-toned, the cheap tell that it was built rather than assembled. One authored motion belongs to the page — a newly recorded line prints itself onto the page — and the pickers' occluding popovers enter in 250ms and leave in 150ms from their trigger origin; hover and focus are color states, not motion.

The world is an Operate surface: a landlord completing bookkeeping, where scanability, density, and trust outrank expression. The finished world covers the shell (rail, header, tabs, footer), the Overview, Transactions, and Properties views, and the shared primitives; the Properties page has had its register pass — the card grid retired wholesale, one ruled line per property answering the product question in money (Net on the print wash first, Income in green, Expenses in ink-soft), the ledger's own trailing-cell delete and stamp confirm — and the third pass tightened the record's own truths: every user-visible date now derives from local parts (The Local-Date Rule), the export writes the displayed slice and says so on its control, its stamp, and its filename, and the empty page's paint is mount-gated so the first honest paint is silent. The record tells the truth about itself: the shell's footer names where the data lives on every page, the export's stamp names the slice that was written, and a delete carries a five-second undo. One deferral remains, recorded, not canonized (see Elevation & Depth and the contracted records): the Add-Property modal's native checkbox and pending spinner. The unlinked Reports route is the world's honest placeholder now; round three's unpicked fronts are queued in the change's records, not canonized here.

**Key Characteristics:**

- Ivory paper ground (#fbf8f1), ink-navy type (#1b2a41), machine-print green hairline rules (#2e5e4e), stamp red (#a31621) reserved for state marks.
- One glass material, on the shell chrome only: a sticky header+nav pane and the rail's header/footer blocks — paper tinted to 72%, 16px blur, 140% saturate, a print edge at 72% (3.29:1). Every content panel under text is opaque.
- IBM Plex Mono with tabular numerals for every date and money figure, at print density (0.8125rem line; one-line rows ≈39.84px, held at real widths).
- Every user-visible date tells the local truth: a stored date is a calendar name, never a UTC instant, and the one format module owns every derivation (The Local-Date Rule, verified under TZ=Asia/Manila and TZ=America/New_York).
- Structure from rules — 1px hairlines everywhere, a 3px double totals rule for closing lines — never from shadows.
- The running balance rail on a print wash down the ledger's right edge always accumulates the book (every entry, date ascending) whatever the display; the caveat "Balance follows the book" prints whenever the view is not the book's own order and names why — "this view is filtered", "sorted newest first", or both.
- Properties is a ruled register, not a card grid: one line per property, Net on the print wash first, Income in green, Expenses in ink-soft, the delete in the reserved trailing margin.
- Motion is authored and bounded: the print-in for a recorded line, and the pickers' popovers (250ms in / 150ms out, scale 0.96 from the trigger origin); reduced motion keeps the opacity cross-fade and gates the travel.
- Honesty signals throughout: the footer's storage note, the export's stamp acknowledgment naming the slice it wrote (all entries at rest, the displayed ledger whenever anything narrows), the five-second delete undo that restores the original id, and the shared unreachable state that names a dead connection where the silent zero used to print.
- 2px corners everywhere: squared, printed form fields.

## Colors

Four palette colors carry the whole world; nothing in the finished surfaces uses a raw hex outside this set.

### Primary

- **Machine-Print Green** (#2e5e4e): the machine's voice. It prints the hairline grid (as the rule alpha below), the income figures on every surface that carries them — the ledger's amounts, the strip's Income, the trend's income column, the register's Income cell — the sort marks, the focus rings and outlines, the chevrons, the checkmarks, the selected rail's icon and inset bar, and the Properties register's Active mark. It is the only saturated green; it is spent on structure and affirmation, never on decoration.
- **Print Wash** (rgba(46, 94, 78, 0.06)): print at 6% over paper — the balance column's ground, the register's Net cell ground, hover ground for rail entries, and the skeleton's pulse tint. The palest claim the green makes on the page.
- **Print Soft** (#e9f1ea): a premixed print tint — the selected rail entry's ground and a select option's focus ground. The one place the world uses a mixed tint instead of an alpha, kept for the shadcn HSL layer's secondary/muted/accent slots (130 22% 93%).
- **Hairline Rule** (rgba(46, 94, 78, 0.38)): print at 38% over paper — the 1px hairline itself, drawn as borders on rows, fields, and internal dividers.

### Secondary

- **Stamp Red** (#a31621): state marks only — the destructive confirm's rotated question and its stamp-ground Delete action (the ledger's cluster and the register's alike), the export's acknowledgment stamp, and the validation alert. It never decorates. Its standing role was renegotiated 2026-11-21 (full record under Do's and Don'ts → Contracted records): the original direction contract's over-budget mark had no trigger, since the product has no budget concept; no budget scope was added, and stamp red remains the state-mark idiom.

### Neutral

- **Passbook Paper** (#fbf8f1): the ground everywhere — body, rail, panels, fields. Warm ivory, slightly darker than white, so ink and green both sit on it like print on a page.
- **Ink Navy** (#1b2a41): all primary text and the primary buttons' ground. Deep and quiet, never black; the machine's green owns the rules, ink owns the reading.
- **Ink Soft** (rgba(27, 42, 65, 0.72)): secondary text — labels, dates, categories, properties, quiet controls.
- **Ink Faint** (rgba(27, 42, 65, 0.66)): placeholders and the least-important affordances — the resting delete icons, the register's type icons, the trend's sublabel.
- (Declared but currently unused: `--color-paper-raised: #ffffff` sits in the token layer; no surface references it yet. Recorded so a future surface either uses it or removes it deliberately.)

The shadcn HSL layer underneath the ui/* primitives is re-pointed at this same palette rather than carrying its own: `--background`/`--card` are paper (43 56% 96.5%), `--foreground`/`--primary` are ink (217 41% 18%), `--secondary`/`--muted`/`--accent` are print soft (130 22% 93%), `--destructive` is stamp (355 76% 36%), and `--input`/`--ring` are a print-family green lifted one lightness step for 2px legibility (160 34% 35%). One deliberate outsider: `--border` (77 12% 71%) is a warm sage-gray, not the green hairline — passbook surfaces draw their hairlines with the rule token directly, and the sage survives only as the Card primitive's default, a primitive no built surface imports since the register retired the card grid.

### Named Rules

**The Stamp Rule.** Stamp red is a state mark only: destructive confirms and validation failures, always uppercase mono, always bordered or grounded — never a tint, tint never a decoration. If the red doesn't say "act on me" or "this was rejected," it doesn't appear.

**The Owned Browser Chrome Rule.** Selection prints as print green at 22% over paper with ink text; carets and native checkbox/radio accents are print green; links carry ink text over a 1px print underline at 3px offset, turning print green on hover; scrollbars are thin ink (34% alpha) on a transparent track with a paper-framed thumb. The world does not stop at the components.

## Material

**The glass is a job, not a texture.** One material layer (ADR-0004) paints only where a surface floats over the page or occludes it: the shell's header+nav pane, the rail's header and footer chrome, and — within the material's rules — sheets and popovers. Body copy, table numerals, ledger figures, the rail's entry list, form fields, and every content panel under text stay on opaque paper. Glass never appears where it would put a record on a translucent ground.

**The tokens.** `--glass-tint` is paper at 72% (the content behind keeps a quarter of its light for the blur to hold); `--glass-highlight` is a lit 1px top edge over a full inset ring; `--glass-shadow` is a 1px contact shadow under a soft ambient one; `--glass-edge` is print at 72% (the pane's boundary, 3.29:1); `--glass-blur` is 16px and `--glass-saturate` 140% — the budget is blur ≤ 24px and saturate ≤ 160%, and no component invents a value.

**The blur boundary is structural.** No glass element contains a scrolling descendant. Glass chrome is `position: sticky` with `overflow: visible`; the rail's scrolling entry list lives on an opaque paper panel between the glass header and footer, so the material never sits over a scroll container.

**The refusal cascade.** One implementation, four conditions: reduced transparency → an opaque tint, no translucency; no `backdrop-filter` support → an opaque tint behind the solid border; forced colors → Canvas/CanvasText with borders preserved and no blur (links take LinkText); reduced motion → animation off and `transition-property` keeps opacity, so the cross-fade survives and travel is gated. Forced colors is the last rule in source order, so the combined forced-colors + no-backdrop-filter case is an opaque Canvas panel with a solid CanvasText border.

**Measured, not asserted.** At 1440×900, DPR 2, over a populated ledger scrolling under the pane: chrome labels 5.62–13.24:1 against their worst composite; body and figure text 5.73–13.62:1 on paper; the pane edge 3.29:1; the active tab underline 6.81:1; the focus ring 7.00:1; the calendar popover border 3.64:1. The full-band scan's darkest composite is rgb(217,217,215), where ink-soft is 4.87:1 — still above the 4.5:1 floor. The numbers and the sampling method are recorded beside the tokens in `src/styles.css`. A clipped screenshot re-renders without the `backdrop-filter`, so measurements use one full-viewport capture.

## Typography

**Body Font:** Manrope (system-ui sans fallback)
**Figure/Label-Mono Font:** IBM Plex Mono (native mono fallback)

**Character:** Manrope carries the reading and the uppercase micro-labels; IBM Plex Mono carries every figure — measurement, not costume. The pairing is the passbook's split: the human hand writes labels in sans, the machine prints the numbers in mono.

There is no display face. The largest type on any page is a 21px mono total; titles are body-scale ink set with quiet confidence.

### Hierarchy

- **Page title** (700, 17px, ink): each view's own heading — the page's one h1. The product name "Landlord Ledger" prints at the same size and weight (tracking 0.01em) but as a styled link home, never a heading. Both are set in bold sans, not scaled up. Confidence comes from weight and position, not size.
- **Caption label** (600, 0.6875rem / 1.45, uppercase, ink-soft): the world's micro-label — field labels, table headers, strip labels, the tfoot legend, rail headers, the caveat above the ledger, and the Reset control. Letter-spacing stops at three points: 0.14em on form fields, 0.16em on table headers, 0.18em on totals legends, stamp marks, and the scope tag (which drops to 0.10em in mono).
- **Body** (500, 0.875rem, ink): form input text, tab labels, quiet controls; 600 on controls that act (buttons, tab labels when active).
- **Ledger figures** (500, 0.8125rem / 1.45, IBM Plex Mono, tabular): every ledger cell — dates, descriptions, categories, properties, amounts, balances — and the register's figures (Net, Income, Expenses at the 13px step; Units and the type label at 12.5px). Descriptions run 500 in ink; dates, amounts, and balances at the full 13px step; categories and properties ink-soft at 12.5px.
- **Totals figure** (600, 21px, IBM Plex Mono, tabular): the strip's Income / Expenses / Net — the biggest figures on any page.
- **Stamp mark** (700, 11px, IBM Plex Mono, uppercase, 0.18em, stamp red): the validation alert, the rotated delete-confirm question, and the export's acknowledgment stamp. The same 11px mono outside the stamp role carries the sort arrows (print), the trend's sublabel (ink-faint, mixed-case at a tight 0.05em tracking), and the Properties register's status marks — the ramp's caption floor; nothing prints smaller.

### Named Rules

**The Tabular Numerals Rule.** Every figure — money, dates, counts — is set in IBM Plex Mono with tabular numerals (`tabular-nums`), so columns of pesos align down the page like a printed ledger. Money is formatted by the one `formatMoney` (₱, exactly two fraction digits everywhere) and dates by the one `formatDate` (en-US, "Mon D, YYYY"); no surface re-creates a local copy, and the sans face never sets a figure — the form's date and amount inputs print in the mono face with tabular numerals, a date inside a field no less than a date on the page.

**The Local-Date Rule.** Every user-visible date derives from local parts, and `localDateString`/`localMonthKey` in `src/lib/format.ts` are the one source of date truth. A stored date is a calendar string ('YYYY-MM-DD') — the name of a day on the page, not a UTC instant — so `formatDate` parses the string's own parts and never hands it to the bare ISO constructor (which reads UTC midnight and prints the day before everywhere west of UTC). The form's blank line and the export's filename stamp write `localDateString`; the current-month check and the trend buckets compare a stored string's own prefix against `localMonthKey`, each bucket month derived from local parts with the day pinned to the 1st, so a 31st can never skip a bucket; the carried-forward label reads the stored string's parts the same way. No surface reaches for `toISOString`, whose UTC day is yesterday's page for most of a UTC+8 morning. Verified under TZ=Asia/Manila and TZ=America/New_York.

## Layout

The shell is two columns on paper under one sticky glass chrome. The header and the section nav share a single glass pane pinned to the top (the material's one place on the shell); the rail is a structural frame whose head and foot are glass blocks and whose middle is an opaque paper list, so no glass element contains a scroll container. The rail has three composed states. Below lg (1024px) it is w-28 (7rem) and every entry prints its name as a tiny centered caption under its icon — a touch user cannot hover a tooltip — truncated like any narrow printed column. At lg it is either w-16 (4rem) icon-only with hover tooltips, or the expanded w-80 (20rem) list with the collapse toggle; the toggle is a desktop-only control and hides below lg. `useIsDesktop` mirrors the lg media query through matchMedia, SSR-safe: the server paints the desktop rail and narrow viewports correct it on hydration.

The main column floors at `min-w-0` so a wide ledger sheet can never push or clip the paper — wide regions scroll inside their own ruled areas instead. Page gutters are 1.5rem below lg and 2.25rem at lg; each view's header row is the 17px bold title with a right-aligned mono caption where a count exists — the plain count at rest, and on the ledger "N of M entries" while filters hide lines (N displayed of the property scope's M) — and the Properties view carries its product question under the title instead. Landmarks stay honest: the product name in the header is a styled link home, never a heading, each route carries exactly one h1 — its own title, with the register's line names as h2s beneath it — and the browser tab is titled "Landlord Ledger". The keyboard reader's front door is the document's first Tab stop: a "Skip to content" link, quiet until it holds focus, then a printed ink stamp pinned to the page's top-left corner, jumping past the rail to `#main-content` — the routed page's own region, focusable so the jump is real, its outline quiet because a destination is not a control. The app header composes as a stacked masthead below lg (name, quiet export control, then the primary control full-width at the 44px touch height) and one 3.5rem line at lg, the primary back at the 2.25rem control height.

Density is the passbook's: ledger rows run one line at print density (declared `--passbook-row` 2.375rem, realized as 0.625rem cell padding plus the 0.8125rem ledger line and the 1px row rule — ≈39.84px, held at real widths: 1280 and 1440 both), and the register's lines run the same budget; every field, select trigger, and primary button is 2.25rem high (`--passbook-control`, h-9); the blank ruled lines below the last entry run at the entries' own rhythm (2.5rem, 40px) and cap at fifteen. Touch reaches 44px wherever a thumb owns the surface: the masthead's primary below lg, the form's radios (by label padding — the mark itself stays 16px), the bottom-sheet confirms and the Undo target below sm.

The two calendar pickers and the searchable category combobox are the one new primitive group: each opens an opaque paper popover (they hold text and scroll, so they are not glass), sized to the viewport and capped against the available height. The date fields accept typed `YYYY-MM-DD` and reject an impossible day or a reversed range with a message naming the problem and the recovery; the ledger's from/to pair is one range picker whose bounds stack with visible labels below sm and sit side by side above it.

Overflow is owned, never leaked: the two tables are horizontal overflow regions (`overflow-x-auto`), and the body clips nothing (`overflow-x: hidden`). The section nav carries no scroll container — its three labels wrap when the window is narrow, because the blur boundary forbids a scroller inside glass. Below sm the narrow window opens onto the record, not a wall of apparatus: the filters row folds behind a disclosure control that names its active count ("Filters · N", `aria-expanded`, CSS-composed so the server paints it collapsed with no hydration flash), the ledger sheet holds its wider print (64rem below sm, a 55rem floor at sm and up) and slides inside its ruled region with the date column frozen at the left edge (opaque paper ground, its own right rule — header, entries, and blank lines alike), and the destructive confirm pins as a fixed bottom sheet with 44px targets — gated by the live sm query (`useMediaQuery`, SSR-safe), so the sheet is never sat `display:none` in a desktop page: at sm and up the inline cluster is the confirm and the sheet is not in the DOM at all. At 390px the composition is leak-free by construction — the rail's captions truncate, the header stacks its masthead, the section nav wraps to two rows inside the glass pane (chrome measures 229.5px at 390 and 290.5px at 320; both are recorded rather than hidden), the sheet slides inside its own, and `min-w-0` keeps the paper intact. The mobile captures in `.impeccable/review/` (finish and critique passes) are the provenance of that width.

## Elevation & Depth

The content is flat: no shadows at rest; depth is conveyed by rules (hairline green), ground (paper, wash, soft), and ink weight. The glass chrome is the one elevated material — a 1px contact shadow under a soft ambient one (`--glass-shadow`) beneath its edge — and every floating surface carries a soft shadow: the pickers' and combobox's opaque paper popovers (`--glass-shadow`), the dialog panel, the destructive confirm (the inline cluster on the row's edge at sm and up, the fixed bottom sheet below it), the export stamp, and the delete-undo snackbar (each `shadow-lg`) — the one soft shadow a floating surface is allowed. A dialog's page beneath stays legible through a 35% ink wash rather than going dark. The selected rail entry marks itself with an inset print bar (2px on the collapsed rail, 3px expanded) — a printed inset, not a raised edge. The Properties register has no cards to lift: its lines rule themselves like the ledger's, and a row's hover reveals the delete control and changes nothing else.

### Named Rules

**The Flat Page Rule.** The page never casts shadows; a floating surface may cast one, softly. Hover on a page element changes color, never elevation.

Drift, recorded not canonized: one pre-world leftover survives outside the passes that reached it — the Add-Property modal's native checkbox still wears a gray default border (`border-gray-300`) and its submit button still spins a pending spinner. Inherited deferral, not a rule future surfaces should follow. The unlinked Reports route was re-skinned in the glass pass: it is the world's honest placeholder now, not the old template card.

## Motion

The page's one authored motion is the print-in: a newly recorded line wipes itself onto the page left to right with an exponential ease-out, the balance landing last; a restored line prints back in. The pickers' and combobox's occluding popovers enter in 250ms and leave in 150ms, scaling from 0.96 at `--radix-popover-content-transform-origin` (the trigger's side, never the center); they are opened during data entry, and the short exit keeps a cancelled open from lingering over the field. The calendar cross-fades its month change in 150ms (opacity only); react-day-picker's own animate hook runs it and skips it while a day holds keyboard focus. Hover and focus are color states, not travel. Under `prefers-reduced-motion: reduce` the cascade sets `animation: none` on glass and gates the popover travel, while `transition-property` keeps `opacity` — the cross-fade survives, the movement does not.

## Shapes

One corner: 2px. Every field, button, select trigger, dialog panel, stamp mark, status mark, and skeleton block is squared like a printed form field (`rounded-[2px]`); the shadcn radius base is re-pointed to 0.125rem so its lg/md steps collapse to the same 2px. No pill shapes survive anywhere in the built world. The one corner outside the system is the scrollbar thumb's 5px radius — browser chrome, a recorded detector flag (contracted records), not a form-language precedent.

The rule system is the form language:

- **Hairline** (1px, print at 38%): every ledger and register row, field edge, rail entry, and internal divider — drawn with the rule token, never a gray.
- **Print rule** (1px, solid print): the ledger's and the register's header underlines, the totals strip's top edge (drawn per side — `border-t-print` above, `border-b-rule` below — so no all-sides border-color can quietly win the anchor), the trend caption's underline; 2px as the active tab's underline.
- **Totals rule** (3px double, print): the accountant's closing line, owned by exactly one side of its seam — `.rule-totals` prints it on a top edge (the empty page's "No entries" line), `.rule-totals-b` on the bottom edge of the row that closes the sheet: the last entry when no blank lines follow, the last blank line when they do, always immediately above the tfoot. Spelled once each in the stylesheet, deterministic against Tailwind's all-sides border-color utilities. The one place the world says "this line closes the account."

## Components

### Buttons

- **Shape:** squared (2px radius), 2.25rem high for the primary.
- **Primary:** ink ground, paper text, semibold — exactly one per screen, and the masthead owns it: "+ Add transaction" in the header (full-width and 44px high below lg, the masthead's touch standard; the 2.25rem control line at lg), with "Record entry" carrying the ink while the add-transaction dialog is open. Hover dims to 90% ink; focus-visible is a 2px print outline (2px offset on the header's). The rail's "Add Property" has stepped down to the quiet outline treatment — hairline rule, soft ink, the print wash on hover — a way to add a property, not the page's one loudest claim.
- **Quiet:** the export control — transparent ground, ink-soft semibold text that deepens to ink on hover. It reads "Export CSV · All entries" at rest and "Export CSV · Displayed ledger" whenever anything narrows the page (a property scope or any active filter), always disclosing the slice it writes: the shell reads the ledger's filters from the ledger filter store (`src/stores/ledgerFilterStore.ts` — the view's apparatus lifted one store deep, so the header reads the same displayed slice the ledger shows, with no prop corridor), and at rest the displayed slice is the book, so the footer's backup promise holds exactly.
- **Outline:** the dialog's quiet actions — Cancel and "Record & new" — paper ground with the shadcn `--input` print-family border; Cancel, "Record & new", and "Record entry" run the same 2.25rem control height as even thirds of the dialog's width.
- **Destructive confirm:** stamp ground, paper text, 2px radius — appears only inside a confirm cluster beside the question and a hairline Keep control.
- **Focus, two ways:** fields and selects take a 2px print-green ring offset 1px on paper; every other actionable surface — primary and quiet buttons, links, nav tabs, rail entries and the rail's collapse toggle, sortable headers, the filters disclosure, the row's delete control — takes a 2px print outline on focus-visible. Never the browser default.

### The Ledger (signature component)

The page's mass: a full-width ruled table (TanStack Table v9) that opens chronological — date ascending is the default sort and sorting removal is off, so the display order is always an explicit sort and never the storage order (storage records newest-first). The sheet is a fixed-budget printed page (`table-fixed`): Date 7.5rem / Description the fixed-layout remainder / Category 7.5rem / Property 7.5rem / Amount 7.5rem, right / Balance 8rem, right / a reserved trailing Actions cell (2.75rem, header screen-reader-only). At sm and up the sheet floors at 55rem — the budget that holds one line at print density at real widths (≈39.84px at 1280 and 1440) — and Description, Category, and Property truncate under pressure with the full text carried in the cell's `title`, so a long line never wraps the page's rhythm. Headers are caption-uppercase ink-soft over a 1px print underline; sortable headers are buttons carrying `aria-sort`, hover-underlined, with an 11px mono ▲/▼ in print green, grown to 44px targets by padding (0.875rem top and bottom) — the caption type never grows to fake the reach. Cells are mono, tabular, 0.75rem/0.625rem padded: descriptions medium ink; dates, amounts, and balances at the 13px ledger step; categories and properties ink-soft at 12.5px; income amounts print green with a leading `+`, expenses in ink; a 1px left rule separates the Amount and Balance figures from the prose columns. Below sm the sheet holds its wider print (64rem) and slides inside its ruled region, the date column pinned to the left edge with an opaque paper ground and its own right rule.

The balance is a derived measurement, not a field, and never a sort key; the rail audits the book, not the view. It always accumulates the book — computed over every entry the browser holds, sorted date-ascending, whatever slice or order the page displays — so each row prints the balance the book's own printed order owes it, and a filtered or re-sorted page can never invent an account that never existed. The caveat names the divergence whenever the display is not the book itself — and it names WHY, not only that: any active filter (the displayed slice is always a subset of the book, so equal cardinality means equal sets) or any sort that is not date-ascending prints "Balance follows the book · {why}" above the sheet, caption-voiced — "this view is filtered" when a filter took lines away, "sorted newest first" under date-descending, "sorted by description" / "sorted by category" / "sorted by property" / "sorted by amount" under another column, the two joined with " · " when both; in the book's own order no caveat prints, because there is nothing to disclose. The strip above keeps its own displayed-slice claim; the tfoot below keeps the carried-forward of what the page displays. Balance cells sit on the print wash; the tfoot closes the page — "Balance carried forward · {Mon YYYY}" in caption-uppercase beneath the 3px double totals rule (the last row's bottom edge), the balance figure bold 13px mono on the wash. Carried forward derives from the latest date the page displays, whatever order the rows sit in, and totals the net of every displayed entry; the month label reads the stored string's own parts (The Local-Date Rule).

**The Book-Authority Rule.** The running balance is the book's, not the view's: it always accumulates every entry in date-ascending order, whatever slice or sort the page displays, and the caveat names the divergence — and why ("this view is filtered", "sorted newest first", or both) — whenever the display is not the book itself. A rail that recomputed per view would print accounts that never existed.

Below the last entry, the page carries its blank printed lines: ruled rows at the entries' own rhythm (2.5rem, 40px), the balance column washed, the date-side cell frozen like the entries above it, nothing written on them — capped at a viewport's worth (fifteen), computed after mount so server and client paint identically, `aria-hidden` and transparent to the pointer. They are paper, not content. An empty ledger gets the totals idiom for nothing: a ruled line with "No entries" and a caption nudge, never a card. Its paint is mount-gated on the blank lines' own pattern — the server's snapshot is '[]' by design, and a lagging hydration window would print "No entries" over a book the browser already holds, so the region stays quiet until mount and the ruled line belongs to the live snapshot alone: the first honest paint is silent.

The delete flow lives in the reserved trailing cell — the page's margin. At rest the cell holds nothing visible: an icon-only control (a 16px trash, titled and aria-labeled "Delete entry", ink-faint) appears on row hover, keyboard focus, touch (a pointer-coarse variant keeps it printed), or an open confirm, reddening to stamp on hover/focus — no destructive word sewn into the description line. At sm and up the confirm cluster lands on the row's right edge — paper ground, hairline rule, the one soft shadow a floating surface is allowed — printing the slightly rotated (−2°) stamp-red bordered mark "Delete this entry?" beside a stamp-ground Delete and a hairline Keep. Focus arrives at Keep when the cluster opens; Keep or Escape closes it and returns focus to the row's delete control. Below sm the same question pins as a fixed bottom sheet — hairline top rule on paper, Keep and Delete as full-width 44px targets in the thumb's zone, not the row's far edge — and the live sm query owns which composition exists at all: the sheet renders only below sm and is absent from the desktop DOM.

**The One Authored Motion.** A row that appears after first paint prints itself onto the page: a left-to-right `clip-path` wipe plus a fade, 500ms, exponential ease-out `cubic-bezier(0.16, 1, 0.3, 1)`, the balance figure landing last. First paint is still — the page simply is the record; a restored line (the undo's own small ceremony) prints back in too. `prefers-reduced-motion: reduce` removes it entirely. Nothing else is authored: hovers transition color/opacity only (150ms), the skeleton keeps its stock pulse, and the one remaining spin (the deferred Add-Property modal's pending state) is stock, not authored.

### The Totals Strip

Income / Expenses / Net as printed columns — not cards, not a chart. Figures are 21px mono semibold tabular — Income prints green on every surface that carries it, Expenses and Net in ink; hairline rules divide the columns; the strip's edges are drawn per side — solid print on top, hairline below (`border-t-print` / `border-b-rule`) — so the anchor can never be quietly lost to an all-sides border-color; the labels are caption-uppercase. The scope tag sits right-justified in mono caption and names what the figures total on this page: "Displayed ledger · {scope}" on Transactions, where the rows beneath audit the claim, and "All entries · {scope}" on Overview, which displays no rows to audit. The section's `aria-label` carries the same claim. The figures total exactly the slice the caller passes — property selection, search, category, type, and date range included on Transactions — never a calendar month of their own. Overview keeps totaling the pure property scope: the page composes its strip from the selected property's slice alone and never reads the ledger view's filters (now a store the shell also reads for its export), so the "All entries" claim is audited by the scope and nothing else. When the properties fetch cannot be verified, the strip prints the one shared unreachable state in its scope-note slot and its figures stay unwritten — no ₱0.00 beside a line that says the totals cannot be trusted (the change's parity note records the suppression as an explained difference; suite and audit runs always boot a reachable API and never see it).

### The Six-Month Trend

A green-ruled table, no rings, no bars: the caption "Six-month trend" over a print underline with an 11px mono sublabel ("income against expenses, by month" — ink-faint, mixed-case at a tight 0.05em tracking, since wide letterspacing belongs to the uppercase caption voice); rows hairline-ruled with mono tabular figures — income prints green with a leading `+`, expenses ink-soft, net semibold ink. The trend tells the truth about quiet months: a month with no activity prints no row at all, and a side that did not move prints its zero without a sign. Slides inside its own ruled region when the viewport is narrower than the print.

### Fields and Selects

Hairline print-green border on paper, 2.25rem high, 2px corners, ink text, faint placeholders; labels are caption-uppercase ink-soft above. Focus is the 2px print ring. Every select is a Radix Select — no native `<select>` anywhere: the trigger is the same hairline field with a print chevron; the option list is paper with one hairline rule and the one soft shadow, each option squared with a print-green checkmark on the chosen one. Empty-string values are impossible in Radix, so each select maps its "no choice" state onto a named sentinel at the boundary.

The date and amount inputs print in the mono face with tabular numerals — a date is a figure inside a field no less than on the page. The add-transaction dialog is a passbook line being written: "Write a line into the ledger" — a paper panel with a hairline rule over the 35% ink wash, the same hairline fields, and validation that names the problem and its recovery as a stamp: an all-sides 1.5px stamp border, uppercase mono, stamp ink on paper. The stamp is the form's ONE validation voice — no native `required` bubbles pre-empt it — and it names only the fields the line is actually missing, in the list-voice a person uses ("give it a description and a category"). Two ways to record: "Record entry" closes the sheet; "Record & new" records the line and keeps the dialog open with a clean form, the hand landing on the description for the next line — the batch path stays inside. Every close path — Record, Escape, Cancel, the close control, an outside click — returns focus to the "+ Add transaction" trigger through Radix's close-auto-focus seam, the one hook that fires after the focus trap is gone. The type radios carry the sheet's 44px touch standard by label padding (the mark itself stays 16px). Below sm the panel keeps paper margins at its sides instead of running edge-to-edge, and its close control grows to a 44px target around a 16px icon. The generic left-stripe alert is refused.

### The Filters Row

The ledger's apparatus, in the passbook form idiom: caption-uppercase labels, hairline fields, Radix selects whose "no filter" states map onto named sentinels at the boundary. Six counted controls — search, category, type, the property scope (shown only while the shell's scope is "all"), and the two date bounds. The row's state lives in the ledger filter store (`src/stores/ledgerFilterStore.ts`) — the lift that lets the shell's export read the same displayed slice without a prop corridor; it is not persisted, so a reload opens onto the book. The Reset control is the escape hatch: a caption-voiced "Reset filters" that prints at the row's end only while some filter is active, and whose one action unwinds exactly the controls the count counts — it never claims more than it does. The "/" accelerator reaches the search field from anywhere on the page — one keystroke into the record — suppressed while the hand is already writing in a field, where "/" is the visitor's own character to keep. Below sm the row folds behind the disclosure that names its active count ("Filters · N").

### Navigation

Tabs are router Links — the URL is the tab state. Three of them: Overview, Transactions, Properties. Reports is not a tab — its route stays reachable by direct URL as the honest placeholder it is, unlinked until the page is built. One green-ruled row: the active tab carries ink text at 600 and a solid 2px print underline; inactive tabs sit in ink-soft at 500 with a hairline underline appearing on hover — each weight owns its state alone, no base font-weight on the shared class, so no two weight utilities ever compete on one element; focus-visible is the 2px print outline. The row scrolls inside its own rule when the viewport is narrower; wide viewports never see a scrollbar.

### The Property Rail

A ruled index on paper. Entries are spans, never nested headings — an entry name does not borrow the page's landmarks; the expanded entry's name prints at the 16px step an h3 would have set, bold when selected, medium when not, and the rail's visual hierarchy is untouched. Entries are hairline-separated; the selected entry carries the print-soft ground, a print icon, an inset print bar on its left edge, and a bold ink name; unselected entries hover onto the print wash. The collapse toggle is icon-only and named (`aria-label` "Expand/Collapse properties"), and every rail entry, the toggle, and the add control take the 2px print outline on focus-visible. The expanded rail's "Add Property" is the demoted control — a quiet outline (hairline rule, soft ink, the print wash on hover), because the masthead's "+ Add transaction" owns the screen's one ink primary. The expanded entry prints name (truncated under pressure), address with a map-pin line icon, units, a caption-uppercase type tag, and a hairline-ruled financial block: Net in semibold mono ink, Income in print green, Expenses in ink-soft — all tabular. The address lives here — the Properties register's line deliberately does not carry it. The loading state is print-wash blocks pulsing at the widths of the composed blocks they stand in for; the unreachable state is the one shared status line (see Honesty Signals), not a per-surface improvisation.

### The Properties Page

A ruled register — the card grid is retired wholesale. One line per property on a fixed-budget printed sheet (`table-fixed`, a 55rem floor, the name column frozen at the left edge below sm with an opaque paper ground and its own right rule), closed by the 3px double totals rule above an "All properties" tfoot — the portfolio's Net bold on the wash, Income in print, Expenses in ink-soft. The page's one h1 is "Properties"; each line's name is an h2 at the 17px print step, truncated under pressure with the full text in the `title`. Under the title the product question prints in the world's own voice — "What is each property making me? The register answers line by line." — and the line answers it in money only: Net first, on the print wash behind a left rule (the balance rail's own idiom, semibold mono ink), Income in print green, Expenses in ink-soft, all tabular; Type prints its icon once beside the label; Units prints its figure or an em dash. Address and created-date are deliberately off the line — the address lives in the rail's expanded entry and the API record, not repeated as prose beneath the money the question is really asking for. The status mark prints like the passbook's own — squared, bordered, mono uppercase 11px: Active in print ink on a print border, Inactive ink-soft on a hairline — never a pill.

The delete is the ledger's own margin idiom: a reserved trailing cell (2.75rem, header screen-reader-only) holding an icon-only control (titled "Delete property"), ink-faint at rest, printed on hover, keyboard focus, touch, or an open confirm, reddening to stamp, dimmed to 40% while a delete is pending — the same stamp confirm cluster at sm and up ("Delete this property?" rotated −2°, a stamp-ground Delete, a hairline Keep), the same 44px bottom sheet below sm, gated by the live sm query and absent from the desktop DOM. Focus arrives at Keep when the cluster opens and returns to the delete control on Keep; after a successful delete it lands on the page title, the honest place when the row cannot hold it, and a failed delete puts the hand back on Keep. The empty register gets the totals idiom for nothing ("No properties" on a ruled line); the loading state is the ruled skeleton — print-wash blocks pulsing in ruled rows at the register's own column widths, no spinner. The page's modal (Add Property) is the recorded deferral: its Active control is a native checkbox with a gray default border, and its submit button spins a pending spinner.

### Honesty Signals

The record tells the truth about itself, in four quiet instruments. The shell's last line is its honesty note, rendered once on every page over a hairline rule: "Recorded in this browser · CSV is your backup" — the storage story named, not discovered the hard way. The export writes the DISPLAYED slice — the same rows the Transactions page shows — and every artifact says so: the control reads "Export CSV · All entries" at rest and "Export CSV · Displayed ledger" whenever anything narrows; the stamp — a slightly rotated (−2°) stamp-red bordered mark — announces itself as a live status (`role="status"`) at the bottom right as "Exported · All entries" or "Exported · Displayed ledger", and clears after four seconds; the CSV's filename names the slice too (`landlord-ledger-all-entries-{date}.csv` / `landlord-ledger-displayed-ledger-{date}.csv`, the date stamped from local parts — The Local-Date Rule). At rest the displayed slice IS the book, so the footer's backup promise holds exactly; a repeat export within the window re-stamps, so the mark always tells the truth about the most recent write. The delete carries an undo: a snackbar (`role="status"`, hairline-ruled paper, the one soft shadow) pins at the bottom left — "Entry deleted" with an Undo control — for a five-second window. Undo restores the line with its original id — the very line that left, not a re-recorded twin, guarded against a double-undo — the restored line prints back in, and focus lands on the page title both after the delete and after the undo. The Undo target runs 44px below sm. The connection carries one shared unreachable state (`role="status"`, ink caption line, `data-unreachable="properties"`, web/src/components/UnreachableState.tsx): when the properties fetch rejects — server down, stale env, dead port — the rail's entry region, the register's ruled region, and the totals strip's scope-note slot all carry the same line naming the problem and the recovery ("The ledger server is unreachable — start the API, then reload."), and the strip's figures stay unwritten while it shows, so the silent zero — empty lists with ₱0.00 as though the ledger were merely empty — never renders unaccompanied. Recorded 2026-11-22 (change: surface-api-unreachable-state); the state never renders in suite or audit runs, which always boot a reachable API, so any future parity pass that exercises a dead base URL sees this explained difference, not a regression.

### Icons

One icon map for property types (`PropertyTypeIcon`): home, office building, landscape — inline line icons at 20px, currentColor, so they print in ink or green as their context does. Rail controls use the same family of line icons (plus, chevron, map pin, users); the destructive controls use its trash, icon-only at 16px and named by `title`/`aria-label` — never a word sewn into the line. No emoji, no filled multicolor icon art.

### Skeleton

Print-wash blocks with 2px corners and the stock pulse — a loading page that holds the world's outline instead of reaching for a spinner.

## Do's and Don'ts

The Do list is the keep-list — the invariants that never get diluted as the world extends to new surfaces.

### Do:

- **Do** set every figure in IBM Plex Mono with tabular numerals, formatted through the one `formatMoney` (₱, two fraction digits always) and the one `formatDate`.
- **Do** tell the local truth in every date: a stored string is a calendar name, not a UTC instant — parse its parts (`formatDate`), write local parts (`localDateString`), bucket by parts with the day pinned to the 1st (`localMonthKey`), and never reach for `toISOString` or the bare ISO constructor on a stored string (The Local-Date Rule).
- **Do** build structure from the rules: 1px hairlines for rows, fields, and dividers; the 3px double totals rule for closing lines; print underlines for headers and the active tab.
- **Do** keep the rail on the book: it always accumulates every entry, date ascending, whatever the page displays (sorting removal is off, so the sheet opens chronological), and the caveat "Balance follows the book" prints whenever the display differs — any active filter, any sort that is not date-ascending — naming why: "this view is filtered", "sorted newest first", or both. No caveat in the book's own order.
- **Do** name every totals claim honestly: the strip's label and `aria-label` total exactly the slice its page displays, and say which page semantics they carry ("Displayed ledger" vs "All entries").
- **Do** write the displayed slice and say so: the export control reads "Export CSV · All entries" at rest and "Export CSV · Displayed ledger" whenever anything narrows, the stamp and the CSV's filename name the same slice, at rest the displayed slice IS the book (the footer's backup promise holds exactly), and the Transactions header's count caption names what filters hide — "N of M entries" against the property scope's total, the plain count at rest; Overview keeps totaling the pure scope, never the ledger's filters.
- **Do** say where the record lives and what each write did: the footer's storage note on every page, the export's stamp acknowledgment, and the delete's five-second undo restoring the original id.
- **Do** keep every actionable surface on the 2px print outline (or the field ring) on focus-visible — rail, toggle, tabs, disclosure, delete control — never the browser default.
- **Do** keep stamp red for state marks only — destructive confirms and validation failures — squared, uppercase mono, bordered or grounded.
- **Do** keep one ink primary per screen — the masthead's "+ Add transaction"; the rail's "Add Property" is a quiet outline, and everything else is quiet ink.
- **Do** keep every overflow inside its own ruled region (the tables scroll; the section nav wraps because glass may not contain a scroller; the main column floors at `min-w-0`) so the paper never leaks at 390px.
- **Do** honor `prefers-reduced-motion` by removing the print-in entirely.
- **Do** keep the form's validation to one voice: the authored stamp names only the actually-missing fields, read as a person says them — no native `required` bubbles.
- **Do** keep every accelerator honest: "Reset filters" prints only when there is something to reset and unwinds exactly the counted controls; "/" reaches the search field unless the hand is already writing in a field; the dialog's every close path returns focus to the trigger that opened it.
- **Do** carry the 44px touch standard wherever a thumb owns the surface — the masthead's primary below lg, the form's radios by label padding, the ledger's sort headers grown by padding (the caption type never grows to fake it), the bottom-sheet confirms, the Undo — while the desktop control line stays 2.25rem.
- **Do** keep the skip link the document's first Tab stop — quiet until it holds focus, then the printed ink stamp at the page's corner, landing on `#main-content`.

### Don't:

- **Don't** put shadows on the page at rest — only a floating surface gets one, softly.
- **Don't** invent a budget mark, an over-budget row tint, or any other stamp-red decoration; no budget concept exists in the product (renegotiated 2026-11-21).
- **Don't** set money in the sans face, drop the fraction digits, or re-create a local formatter.
- **Don't** reach for `toISOString` or hand a stored date to the bare ISO constructor — the stored string is a calendar name, not a UTC instant (The Local-Date Rule).
- **Don't** round past 2px, and don't introduce pills, rings, or cards — the Properties register retired the world's one card grid; no built surface ships a card.
- **Don't** sew a destructive word into the record: the delete control is an icon in the sheet's reserved trailing margin, revealed on hover, focus, or touch — never a caption link inside the description line.
- **Don't** replace the ruled empty state with a card or illustration.
- **Don't** animate anything beyond the print-in; hover and focus are color states.
- **Don't** spend print green on decoration — it belongs to rules, income, focus, selection, and the rail's selected state.
- **Don't** inherit the recorded deferral — the Add-Property modal's native gray-bordered checkbox and pending spinner; it is recorded, not canonized.

### Contracted records

1. **The stamp-red renegotiation (2026-11-21).** The original direction contract carried an over-budget mark in stamp red; it had no trigger — no budget concept exists in the product. No budget scope was added. Stamp-red's standing role is state marks only — destructive confirms and validation failures — never decoration. The over-budget row tint retired with the first-viewport plan; the built ledger's rows carry no such mark.
2. **The deferred unknown-category edge.** A transaction already in storage whose category string is not one of the app's category records is unreachable through the app's own form — the form's Category select offers only `INCOME_CATEGORIES` / `EXPENSE_CATEGORIES` — and the ledger's category filter, which lists the same records, can never select it, so no filter state isolates it. In the built code the row itself still renders, printing its raw stored category string in the Category cell and totaling into every summary; what is truly unreachable is its creation and its isolation, not its display — the edge is deferred rather than resolved. No semantics (validation, migration, display treatment) were decided; this record exists so a future change decides them deliberately instead of inheriting an accident.
3. **The two known contextual detector flags (2026-11-21).** Two real deviations survive every pass, both in the browser's chrome rather than the world's surfaces, and both are deliberately left alone: the scrollbar thumb's 5px radius (`styles.css` — the one corner outside the 2px system) and the devtools widget's own panel headings (the TanStack devtools mounted in the root route render h3s that trip the heading-order detector — dev chrome outside the world's landmarks, dev-only and stripped from production builds by the devtools vite plugin's remove-devtools-on-build pass, so no shipped page carries them). Neither is a pattern to extend; this record exists so a future audit recognizes them instead of re-litigating them.
4. **The round-three queued ledger (2026-11-22).** The third pass's picked fronts are closed in the build; four remain queued in the change's task ledger (§8), recorded here as queued work, not canonized: the reading-column rebalance (description truncation at 1280), Unknown-Property denormalization + a property-delete line warning, the undo snackbar re-pin + a permanent-deletion status + the entry-editing path, and the filtered-empty "No matches" wiring. Code-verified context for two of them: the ledger's Property cell prints an "Unknown Property" fallback for a stored id with no property record, and a filter that empties the sheet still meets the scoped "No entries" line rather than a filtered-empty one of its own.
