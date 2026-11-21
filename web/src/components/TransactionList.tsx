// web/src/components/TransactionList.tsx
// The ledger — a bank passbook page. TanStack Table v9 owns the column
// model and the sort state; the running balance rail is the transactions
// module's runningBalance computed over the rows in the order the eye
// reads them (sorted, filtered), so the balance follows whatever is
// displayed. Below the last entry the page carries its blank printed
// lines — aria-hidden ruled rows with the balance column's print wash,
// no text and no pointer — the unfilled remainder of a sparse page.
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  createSortedRowModel,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_text,
  tableFeatures,
  useTable,
} from '@tanstack/react-table'
import type { ColumnDef, SortingState } from '@tanstack/react-table'
import type { Transaction } from '../types/transactions'
import type { Property } from '../types/properties'
import { TRANSACTION_TYPE } from '#/lib/domain'
import { runningBalance } from '../transactions'
import { formatDate, formatMoney } from '#/lib/format'

type LedgerColumnMeta = {
  label: string
  align?: 'left' | 'right'
}

// The blank printed lines below the last entry cap at a page's worth —
// viewport height over one ruled line, never more than fifteen — so a
// sparse page carries mass without faking an endless sheet.
const BLANK_LINE_CAP = 15
const BLANK_LINE_HEIGHT = 40

// Module scope, stable: the ledger's feature set — column sorting with a
// client-side sorted model, the comparators its columns resolve to, and
// the per-table column meta type.
const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    text: sortFn_text,
    basic: sortFn_basic,
  },
  columnMeta: {} as LedgerColumnMeta,
})

type TransactionListProps = {
  transactions: Transaction[]
  properties: Property[]
  onDeleteTransaction: (id: string) => void
}

export default function TransactionList({
  transactions,
  properties,
  onDeleteTransaction,
}: TransactionListProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  // The unfilled printed lines: enough ruled rows to carry the page to
  // about one viewport's worth of lines, minus the entries already
  // displayed. Decoration only — rendered after mount so server and
  // client paint identically, and aria-hidden so it never reads or
  // intercepts.
  const [blankLineCount, setBlankLineCount] = useState(0)
  useEffect(() => {
    const compute = () => {
      const pageLines = Math.min(
        BLANK_LINE_CAP,
        Math.floor(window.innerHeight / BLANK_LINE_HEIGHT),
      )
      setBlankLineCount(Math.max(0, pageLines - transactions.length))
    }
    compute()
    window.addEventListener('resize', compute)
    return () => window.removeEventListener('resize', compute)
  }, [transactions.length])

  const propertyNames = useMemo(() => {
    const names = new Map<string, string>()
    for (const property of properties) names.set(property.id, property.name)
    return names
  }, [properties])

  // The ledger's columns. `balance` carries no accessor: it is a derived
  // measurement, not a field, and it is never a sort key — the rail reads
  // down the right edge in whatever order the page is displayed.
  const columns = useMemo<ColumnDef<typeof features, Transaction, unknown>[]>(
    () => [
      { id: 'date', accessorKey: 'date', meta: { label: 'Date' } },
      {
        id: 'description',
        accessorKey: 'description',
        meta: { label: 'Description' },
      },
      { id: 'category', accessorKey: 'category', meta: { label: 'Category' } },
      {
        id: 'property',
        // Sort by the printed name, not the hidden id.
        accessorFn: (row) =>
          propertyNames.get(row.property) ?? 'Unknown Property',
        meta: { label: 'Property' },
      },
      {
        id: 'amount',
        // The signed amount is the sort key: income sorts above expenses.
        accessorFn: (row) =>
          row.type === TRANSACTION_TYPE.INCOME ? row.amount : -row.amount,
        meta: { label: 'Amount', align: 'right' },
      },
      {
        id: 'balance',
        enableSorting: false,
        meta: { label: 'Balance', align: 'right' },
      },
    ],
    [propertyNames],
  )

  const table = useTable({
    features,
    columns,
    data: transactions,
    getRowId: (row) => row.id,
    state: { sorting },
    onSortingChange: setSorting,
  })

  // The signature move: the balance accumulates down the right edge in the
  // displayed order — the sorted row model, not the storage order.
  const displayedRows = table.getRowModel().rows
  const balances = useMemo(
    () => runningBalance(displayedRows.map((row) => row.original)),
    [displayedRows],
  )

  // The one authored motion moment: a newly recorded line prints itself
  // onto the page. On first paint the page simply is the record; only rows
  // that appear afterwards get the print-in.
  const knownIdsRef = useRef<Set<string> | null>(null)
  const printedIds = useMemo(() => {
    const known = knownIdsRef.current
    if (known === null) return new Set<string>()
    const appeared = new Set<string>()
    for (const transaction of transactions) {
      if (!known.has(transaction.id)) appeared.add(transaction.id)
    }
    return appeared
  }, [transactions])
  useEffect(() => {
    knownIdsRef.current = new Set(transactions.map((t) => t.id))
  }, [transactions])

  if (transactions.length === 0) {
    // The printed-totals idiom for nothing: a ruled line, not a card.
    return (
      <div className="rule-totals rule-hairline py-4">
        <p className="font-mono text-ledger text-ink">No entries</p>
        <p className="mt-1 font-sans text-caption text-ink-soft">
          This page of the ledger is blank. Record your first line with “+ Add
          transaction”.
        </p>
      </div>
    )
  }

  // The empty page returns above, so at least one row is displayed here.
  const lastRow = displayedRows[displayedRows.length - 1].original
  const carriedForwardMonth = new Date(lastRow.date).toLocaleDateString(
    'en-US',
    { month: 'short', year: 'numeric' },
  )

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const meta = header.column.columnDef.meta
                const sorted = header.column.getIsSorted()
                const canSort = header.column.getCanSort()
                const align = meta?.align ?? 'left'

                return (
                  <th
                    key={header.id}
                    scope="col"
                    aria-sort={
                      sorted === 'asc'
                        ? 'ascending'
                        : sorted === 'desc'
                          ? 'descending'
                          : 'none'
                    }
                    className={`border-b border-print px-3 pb-2.5 font-sans text-caption font-semibold uppercase tracking-[0.16em] text-ink-soft${
                      align === 'right' ? ' text-right' : ''
                    }`}
                  >
                    {canSort ? (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className={`inline-flex items-center gap-1.5 underline-offset-4 transition-colors hover:text-ink hover:underline focus-visible:text-ink focus-visible:outline-2 focus-visible:outline-print${
                          sorted ? ' text-ink' : ''
                        }`}
                      >
                        {meta?.label}
                        {sorted ? (
                          <span
                            aria-hidden="true"
                            className="font-mono text-[10px] leading-none text-print"
                          >
                            {sorted === 'asc' ? '▲' : '▼'}
                          </span>
                        ) : null}
                      </button>
                    ) : (
                      meta?.label
                    )}
                  </th>
                )
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {displayedRows.map((row, index) => {
            const transaction = row.original
            const isIncome = transaction.type === TRANSACTION_TYPE.INCOME
            const isConfirming = confirmingId === transaction.id

            return (
              <tr
                key={row.id}
                className={
                  printedIds.has(transaction.id) ? 'ledger-line-printed' : ''
                }
              >
                <td className="w-[7.5rem] border-b border-rule px-3 py-2.5 font-mono text-ledger text-ink-soft tabular-nums">
                  {formatDate(transaction.date)}
                </td>
                <td className="border-b border-rule px-3 py-2.5 font-mono text-ledger font-medium text-ink">
                  <span>{transaction.description}</span>
                  {isConfirming ? (
                    <span className="ml-3 inline-flex flex-wrap items-center gap-2 font-sans text-caption">
                      <span className="inline-block -rotate-2 rounded-[2px] border-[1.5px] border-stamp px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-stamp">
                        Delete this entry?
                      </span>
                      <button
                        type="button"
                        onClick={() => onDeleteTransaction(transaction.id)}
                        className="rounded-[2px] bg-stamp px-2 py-0.5 font-semibold text-paper transition-colors hover:opacity-90"
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingId(null)}
                        className="rounded-[2px] border border-rule px-2 py-0.5 font-semibold text-ink-soft transition-colors hover:text-ink"
                      >
                        Keep
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmingId(transaction.id)}
                      className="ml-3 font-sans text-caption text-ink-faint underline-offset-2 transition-colors hover:text-stamp focus-visible:text-stamp"
                    >
                      Delete
                    </button>
                  )}
                </td>
                <td className="w-[11.75rem] border-b border-rule px-3 py-2.5 font-mono text-[12.5px] text-ink-soft">
                  {transaction.category}
                </td>
                <td className="w-[14rem] border-b border-rule px-3 py-2.5 font-mono text-[12.5px] text-ink-soft">
                  {propertyNames.get(transaction.property) ??
                    'Unknown Property'}
                </td>
                <td
                  className={`w-[8.75rem] border-b border-l border-rule px-3 py-2.5 text-right font-mono text-ledger font-semibold tabular-nums ${
                    isIncome ? 'text-print' : 'text-ink'
                  }`}
                >
                  {isIncome
                    ? `+${formatMoney(transaction.amount)}`
                    : formatMoney(-transaction.amount)}
                </td>
                <td className="w-[9.5rem] border-b border-l border-rule bg-print-wash px-3 py-2.5 text-right font-mono text-ledger font-semibold text-ink tabular-nums">
                  {formatMoney(balances[index])}
                </td>
              </tr>
            )
          })}
        </tbody>
        {/* The passbook's unfilled printed lines: hairline row rules and
            the balance column's print wash, nothing written on them.
            aria-hidden and transparent to the pointer — they are paper,
            not content. */}
        {blankLineCount > 0 && (
          <tbody aria-hidden="true" className="pointer-events-none">
            {Array.from({ length: blankLineCount }, (_, index) => (
              <tr key={`blank-line-${index}`}>
                <td colSpan={5} className="h-10 border-b border-rule" />
                <td className="h-10 border-b border-l border-rule bg-print-wash" />
              </tr>
            ))}
          </tbody>
        )}
        <tfoot>
          <tr>
            <td
              colSpan={5}
              className="rule-totals px-3 py-3.5 font-sans text-caption font-semibold uppercase tracking-[0.18em] text-ink-soft"
            >
              Balance carried forward · {carriedForwardMonth}
            </td>
            <td className="rule-totals bg-print-wash px-3 py-3.5 text-right font-mono text-[15px] font-bold text-ink tabular-nums">
              {formatMoney(balances[balances.length - 1])}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
