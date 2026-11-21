// web/src/components/Summary.tsx
// The summary as a printed totals line — dense, tabular, ruled like the
// totals row of a passbook page (the card shapes are retired). The strip
// totals the slice its caller passes, and its label names what that
// slice is on the page that renders it — the displayed ledger on
// Transactions, where the rows beneath audit the claim, or all entries
// of the selected scope on Overview, which shows no ledger rows to
// audit; the six-month trend keeps its own labeled semantics. Overview
// composes the strip with the trend table; the Transactions view reuses
// the strip alone.
import type { Transaction } from '../types/transactions'
import type { Property } from '../types/properties'
import { monthlyTotals, summarizeTransactions } from '../transactions'
import { formatMoney } from '#/lib/format'

// The scope every "displayed ledger" surface names: the selected
// property's own name, or "All properties" for the combined slice.
export function propertyScopeLabel(
  selectedProperty: string,
  properties: Property[],
): string {
  return (
    properties.find((p) => p.id === selectedProperty)?.name ??
    'Unknown Property'
  )
}

// What the strip's figures total on the page that renders it. The
// Transactions view totals the slice its ledger rows display, so its
// label claims exactly the audit the eye can run beneath it. The
// Overview page displays no ledger rows, so its strip claims the honest
// thing instead — every entry of the selected scope. The figures keep
// their own semantics either way: the caller passes the slice it
// totals.
export type TotalsScope = 'displayed-ledger' | 'all-entries'

const SCOPE_WORDING: Record<TotalsScope, { label: string; aria: string }> = {
  'displayed-ledger': {
    label: 'Displayed ledger',
    aria: 'Totals for the displayed ledger',
  },
  'all-entries': {
    label: 'All entries',
    aria: 'Totals for all entries',
  },
}

type TotalsLineProps = {
  transactions: Transaction[]
  scopeLabel: string
  scope?: TotalsScope
}

export function TotalsLine({
  transactions,
  scopeLabel,
  scope = 'displayed-ledger',
}: TotalsLineProps) {
  // The strip follows its page: its figures total exactly the slice the
  // caller passes — on Transactions the displayed ledger beneath it
  // (property selection, search, category, type, and date range all
  // included), on Overview every entry of the selected scope — never a
  // calendar month of its own.
  const { totalIncome, totalExpenses, netProfit } =
    summarizeTransactions(transactions)
  const wording = SCOPE_WORDING[scope]

  return (
    <section
      aria-label={`${wording.aria} · ${scopeLabel}`}
      className="flex flex-wrap items-center gap-x-7 gap-y-3 border-t border-t-print border-b border-b-rule py-3.5 pr-3"
    >
      <div>
        <p className="font-sans text-caption font-semibold uppercase tracking-[0.18em] text-ink-soft">
          Income
        </p>
        {/* Income prints green on every surface that carries it — the
            ledger's amounts, the trend's income column, and this strip. */}
        <p className="mt-1 font-mono text-[21px] font-semibold text-print tabular-nums">
          {formatMoney(totalIncome)}
        </p>
      </div>
      <div className="border-l border-rule pl-7">
        <p className="font-sans text-caption font-semibold uppercase tracking-[0.18em] text-ink-soft">
          Expenses
        </p>
        <p className="mt-1 font-mono text-[21px] font-semibold text-ink tabular-nums">
          {formatMoney(totalExpenses)}
        </p>
      </div>
      <div className="border-l border-rule pl-7">
        <p className="font-sans text-caption font-semibold uppercase tracking-[0.18em] text-ink-soft">
          Net
        </p>
        <p className="mt-1 font-mono text-[21px] font-semibold text-ink tabular-nums">
          {formatMoney(netProfit)}
        </p>
      </div>
      <p className="ml-auto font-mono text-caption font-medium uppercase tracking-[0.1em] text-ink-soft">
        {wording.label} · {scopeLabel}
      </p>
    </section>
  )
}

type SummaryProps = {
  transactions: Transaction[]
  properties: Property[]
  selectedProperty: string
}

export default function Summary({
  transactions,
  properties,
  selectedProperty,
}: SummaryProps) {
  const scopeLabel =
    selectedProperty === 'all'
      ? 'All properties'
      : propertyScopeLabel(selectedProperty, properties)

  // The Overview page displays no ledger rows, so its strip names what it
  // totals on this page: all entries of the selected scope (ADR-0003 —
  // the interactive filters, and with them the "displayed ledger"
  // claim, belong to the Transactions view).
  //
  // The six-month trend as a small green-ruled table: hairline row rules,
  // mono tabular figures. No rings, no bars — the numbers in print. Like
  // the ledger sheet, the table slides inside its own ruled region when
  // the viewport is narrower than the print.
  //
  // The trend tells the truth about quiet months: a month with no
  // activity does not print a row of zeros, and a side that did not move
  // prints its zero without a sign — no +₱0.00/−₱0.00 pairs.
  const sixMonthTrend = monthlyTotals(transactions, 6).filter(
    (month) => month.income !== 0 || month.expenses !== 0,
  )

  return (
    <div className="space-y-6">
      <TotalsLine
        transactions={transactions}
        scopeLabel={scopeLabel}
        scope="all-entries"
      />
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <caption className="border-b border-print px-3 pb-2.5 text-left font-sans text-caption font-semibold uppercase tracking-[0.16em] text-ink-soft">
            Six-month trend
            {/* Mixed-case print keeps a tight tracking (≤0.06em) — wide
                letterspacing belongs to the uppercase caption voice. */}
            <span className="ml-3 font-mono text-[11px] font-medium normal-case tracking-[0.05em] text-ink-faint">
              income against expenses, by month
            </span>
          </caption>
          <thead>
            <tr>
              {['Month', 'Income', 'Expenses', 'Net'].map((label, index) => (
                <th
                  key={label}
                  scope="col"
                  className={`border-b border-rule px-3 py-2 font-sans text-caption font-semibold uppercase tracking-[0.16em] text-ink-soft ${
                    index > 0 ? 'text-right' : ''
                  }`}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sixMonthTrend.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="border-b border-rule px-3 py-3.5 font-sans text-caption font-semibold uppercase tracking-[0.14em] text-ink-soft"
                >
                  No entries in the last six months
                </td>
              </tr>
            ) : (
              sixMonthTrend.map((month) => (
                <tr key={month.month}>
                  <td className="border-b border-rule px-3 py-2.5 font-mono text-[12.5px] text-ink-soft">
                    {month.month}
                  </td>
                  <td
                    className={`border-b border-rule px-3 py-2.5 text-right font-mono text-ledger tabular-nums ${
                      month.income > 0 ? 'text-print' : 'text-ink-soft'
                    }`}
                  >
                    {month.income > 0
                      ? `+${formatMoney(month.income)}`
                      : formatMoney(month.income)}
                  </td>
                  <td className="border-b border-rule px-3 py-2.5 text-right font-mono text-ledger text-ink-soft tabular-nums">
                    {month.expenses > 0
                      ? formatMoney(-month.expenses)
                      : formatMoney(month.expenses)}
                  </td>
                  <td className="border-b border-rule px-3 py-2.5 text-right font-mono text-ledger font-semibold text-ink tabular-nums">
                    {formatMoney(month.profit)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
