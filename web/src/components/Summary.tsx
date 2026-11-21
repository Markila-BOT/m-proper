// web/src/components/Summary.tsx
// The summary as a printed totals line — dense, tabular, ruled like the
// totals row of a passbook page (the card shapes are retired). Overview
// composes the strip with the six-month trend table; the Transactions view
// reuses the strip alone.
import type { Transaction } from '../types/transactions'
import type { Property } from '../types/properties'
import { monthlyTotals, summarizeTransactions } from '../transactions'
import { formatMoney } from '#/lib/format'

type TotalsLineProps = {
  transactions: Transaction[]
  scopeLabel: string
}

export function TotalsLine({ transactions, scopeLabel }: TotalsLineProps) {
  const {
    currentMonth: { income, expenses, profit },
  } = summarizeTransactions(transactions)
  const monthLabel = new Date().toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })

  return (
    <section
      aria-label={`Totals for ${monthLabel}`}
      className="flex flex-wrap items-center gap-x-7 gap-y-3 border-t border-print border-b border-rule py-3.5 pr-3"
    >
      <div>
        <p className="font-sans text-caption font-semibold uppercase tracking-[0.18em] text-ink-soft">
          Income
        </p>
        <p className="mt-1 font-mono text-[21px] font-semibold text-ink tabular-nums">
          {formatMoney(income)}
        </p>
      </div>
      <div className="border-l border-rule pl-7">
        <p className="font-sans text-caption font-semibold uppercase tracking-[0.18em] text-ink-soft">
          Expenses
        </p>
        <p className="mt-1 font-mono text-[21px] font-semibold text-ink tabular-nums">
          {formatMoney(expenses)}
        </p>
      </div>
      <div className="border-l border-rule pl-7">
        <p className="font-sans text-caption font-semibold uppercase tracking-[0.18em] text-ink-soft">
          Net
        </p>
        <p className="mt-1 font-mono text-[21px] font-semibold text-ink tabular-nums">
          {formatMoney(profit)}
        </p>
      </div>
      <p className="ml-auto font-mono text-caption font-medium uppercase tracking-[0.1em] text-ink-soft">
        For {monthLabel} · {scopeLabel}
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
      : (properties.find((p) => p.id === selectedProperty)?.name ??
        'Unknown Property')

  // The six-month trend as a small green-ruled table: hairline row rules,
  // mono tabular figures. No rings, no bars — the numbers in print.
  const sixMonthTrend = monthlyTotals(transactions, 6)

  return (
    <div className="space-y-6">
      <TotalsLine transactions={transactions} scopeLabel={scopeLabel} />
      <table className="w-full border-collapse">
        <caption className="border-b border-print px-3 pb-2.5 text-left font-sans text-caption font-semibold uppercase tracking-[0.16em] text-ink-soft">
          Six-month trend
          <span className="ml-3 font-mono text-[10px] font-medium normal-case tracking-[0.1em] text-ink-faint">
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
          {sixMonthTrend.map((month) => (
            <tr key={month.month}>
              <td className="border-b border-rule px-3 py-2.5 font-mono text-[12.5px] text-ink-soft">
                {month.month}
              </td>
              <td className="border-b border-rule px-3 py-2.5 text-right font-mono text-ledger text-print tabular-nums">
                +{formatMoney(month.income)}
              </td>
              <td className="border-b border-rule px-3 py-2.5 text-right font-mono text-ledger text-ink-soft tabular-nums">
                {formatMoney(-month.expenses)}
              </td>
              <td className="border-b border-rule px-3 py-2.5 text-right font-mono text-ledger font-semibold text-ink tabular-nums">
                {formatMoney(month.profit)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
