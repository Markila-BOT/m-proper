// web/src/components/TransactionList.tsx
// The ledger — a bank passbook page. TanStack Table v9 owns the column
// model and the sort state; the running balance rail is the transactions
// module's runningBalance. A real passbook opens at its oldest unfilled
// line, so the default sort is date ascending and the "none" state is
// unreachable (enableSortingRemoval: false) — the sheet never silently
// falls back to storage order, which records newest-first. Newest-first
// stays an explicit choice: while it is active the rail freezes to the
// book's printed (chronological) accumulation — every row keeps the
// balance the printed order owes it — and a caption caveat names the
// freeze, because the rail audits the book, not the sort.
//
// Below the last entry the page carries its blank printed lines —
// aria-hidden ruled rows with the balance column's print wash, no text
// and no pointer — the unfilled remainder of a sparse page. Below sm the
// sheet composes for a narrow window: the date column freezes at the
// left edge and the rest of the print slides inside its ruled region.
import { useEffect, useMemo, useRef, useState } from 'react'
import { FiTrash2 } from 'react-icons/fi'
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
import { useMediaQuery } from '../hooks/useMediaQuery'

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

// The sheet's frozen first column (below sm): the date cell pins to the
// left edge with an opaque paper ground and its own right rule, and the
// rest of the print slides inside the ruled region.
const frozenDateCell =
  'max-sm:sticky max-sm:left-0 max-sm:z-10 max-sm:bg-paper max-sm:border-r max-sm:border-r-rule'

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
  // The ledger opens chronological — the passbook's own order. Sorting
  // removal is off, so the display order is always an explicit sort:
  // ascending (the rail marches down the page), newest-first (the rail
  // freezes and the caveat prints), or another column's order (the rail
  // audits whatever is displayed).
  const [sorting, setSorting] = useState<SortingState>(() => [
    { id: 'date', desc: false },
  ])
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  // The destructive confirm composes two ways: an inline stamp cluster
  // anchored to the row at sm and up, a bottom sheet with 44px targets
  // below it. The live breakpoint decides which Keep receives focus.
  const isWide = useMediaQuery('(min-width: 640px)')

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
  // measurement, not a field, and it is never a sort key. The trailing
  // `actions` cell is the page's margin — the reserved place where the
  // hand reaches for a line, holding nothing at rest. Its 2.75rem comes
  // from the two wide prose columns (Category and Property each give up
  // width), so the description column keeps the reading width it always
  // had and rows hold their one-line print density.
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
      {
        id: 'actions',
        enableSorting: false,
        meta: { label: 'Actions' },
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
    // The passbook never falls back to storage order: sorting off is not a
    // choice the sheet offers.
    enableSortingRemoval: false,
  })

  const displayedRows = table.getRowModel().rows
  const isDateDesc =
    sorting.length === 1 && sorting[0].id === 'date' && sorting[0].desc

  // The rail: when the display is the book's own order the balance
  // accumulates down the page as read; when the rows display newest-first
  // the rail freezes — computed over date-ascending regardless of
  // display, so each row prints the balance the book's printed order
  // owes it.
  const balanceById = useMemo(() => {
    const railRows = isDateDesc
      ? [...transactions].sort((a, b) => a.date.localeCompare(b.date))
      : displayedRows.map((row) => row.original)
    const railBalances = runningBalance(railRows)
    const map = new Map<string, number>()
    for (let i = 0; i < railRows.length; i += 1) {
      map.set(railRows[i].id, railBalances[i])
    }
    return map
  }, [isDateDesc, transactions, displayedRows])

  // The one authored motion moment: a newly recorded line prints itself
  // onto the page. On first paint the page simply is the record; only rows
  // that appear afterwards get the print-in (a restored line prints back
  // in, too — the undo's own small ceremony).
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

  // Focus discipline for the destructive moment: the confirm cluster's
  // Keep control is where focus lands when the cluster opens, and the
  // row's delete control is where it returns on Keep.
  const deleteControlRefs = useRef(new Map<string, HTMLButtonElement>())
  const keepPanelRef = useRef<HTMLButtonElement | null>(null)
  const keepSheetRef = useRef<HTMLButtonElement | null>(null)
  useEffect(() => {
    if (confirmingId === null) return
    const keep = isWide ? keepPanelRef.current : keepSheetRef.current
    keep?.focus()
  }, [confirmingId, isWide])

  const closeConfirm = (id: string) => {
    setConfirmingId(null)
    deleteControlRefs.current.get(id)?.focus()
  }

  const confirmDelete = (id: string) => {
    setConfirmingId(null)
    onDeleteTransaction(id)
  }

  const confirmingTransaction =
    confirmingId === null
      ? null
      : (transactions.find((t) => t.id === confirmingId) ?? null)

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
  // "Carried forward" is the book's closing claim: the latest date the
  // page shows, whatever order the rows sit in, with the net of every
  // displayed entry beneath the 3px double rule.
  const carriedForwardDate = Math.max(
    ...displayedRows.map((row) => +new Date(row.original.date)),
  )
  const carriedForwardMonth = new Date(carriedForwardDate).toLocaleDateString(
    'en-US',
    { month: 'short', year: 'numeric' },
  )
  const netBalance = displayedRows.reduce(
    (sum, row) =>
      sum +
      (row.original.type === TRANSACTION_TYPE.INCOME
        ? row.original.amount
        : -row.original.amount),
    0,
  )

  // The closing rule owns its seam: the last row before the tfoot carries
  // the 3px double totals rule as its bottom edge (the sheet draws its
  // borders per cell, so the rule must live on one side of the seam, not
  // both).
  const lastEntryIndex = displayedRows.length - 1
  const rowBottom = (isLastBeforeTfoot: boolean) =>
    isLastBeforeTfoot ? 'rule-totals-b' : 'border-b border-rule'

  return (
    <div>
      {isDateDesc && (
        <p className="pb-2 font-sans text-caption font-semibold uppercase tracking-[0.14em] text-ink-soft">
          Newest first — balance follows the printed order of the book
        </p>
      )}
      <div className="overflow-x-auto">
        {/* Below sm the sheet holds its print width and slides inside this
            ruled region — the frozen date column pins at the left edge —
            rather than crushing its columns to the narrow window. */}
        <table className="w-full max-sm:min-w-[64rem] border-separate border-spacing-0">
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
                      }${
                        header.id === 'date'
                          ? ` max-sm:sticky max-sm:left-0 max-sm:z-30 max-sm:bg-paper max-sm:border-r max-sm:border-r-rule`
                          : ''
                      }`}
                    >
                      {header.id === 'actions' ? (
                        <span className="sr-only">Actions</span>
                      ) : canSort ? (
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
                              className="font-mono text-[11px] leading-none text-print"
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
              const isLastBeforeTfoot =
                index === lastEntryIndex && blankLineCount === 0
              const bottom = rowBottom(isLastBeforeTfoot)

              return (
                <tr
                  key={row.id}
                  className={`group/row ${
                    printedIds.has(transaction.id) ? 'ledger-line-printed' : ''
                  }`}
                >
                  <td
                    className={`w-[7.5rem] px-3 py-2.5 font-mono text-ledger text-ink-soft tabular-nums ${frozenDateCell} ${bottom}`}
                  >
                    {formatDate(transaction.date)}
                  </td>
                  <td
                    className={`px-3 py-2.5 font-mono text-ledger font-medium text-ink ${bottom}`}
                  >
                    <span>{transaction.description}</span>
                  </td>
                  <td
                    className={`w-[10rem] px-3 py-2.5 font-mono text-[12.5px] text-ink-soft ${bottom}`}
                  >
                    {transaction.category}
                  </td>
                  <td
                    className={`w-[13rem] px-3 py-2.5 font-mono text-[12.5px] text-ink-soft ${bottom}`}
                  >
                    {propertyNames.get(transaction.property) ??
                      'Unknown Property'}
                  </td>
                  <td
                    className={`w-[8.75rem] border-l border-rule px-3 py-2.5 text-right font-mono text-ledger font-semibold tabular-nums ${
                      isIncome ? 'text-print' : 'text-ink'
                    } ${bottom}`}
                  >
                    {isIncome
                      ? `+${formatMoney(transaction.amount)}`
                      : formatMoney(-transaction.amount)}
                  </td>
                  <td
                    className={`w-[9.5rem] border-l border-rule bg-print-wash px-3 py-2.5 text-right font-mono text-ledger font-semibold text-ink tabular-nums ${bottom}`}
                  >
                    {formatMoney(balanceById.get(transaction.id) ?? 0)}
                  </td>
                  {/* The reserved trailing cell — the page's margin. The
                      delete control prints there and only there; hover,
                      keyboard focus, touch, or an open confirm reveal it.
                      The row itself stays one line at print density. */}
                  <td className={`relative w-[2.75rem] ${bottom}`}>
                    <button
                      ref={(el) => {
                        if (el) deleteControlRefs.current.set(row.id, el)
                        else deleteControlRefs.current.delete(row.id)
                      }}
                      type="button"
                      title="Delete entry"
                      aria-label="Delete entry"
                      onClick={() => setConfirmingId(transaction.id)}
                      className={`absolute inset-y-0 left-0 flex w-full items-center justify-center text-ink-faint transition-colors hover:text-stamp focus-visible:text-stamp focus-visible:outline-2 focus-visible:outline-print focus-visible:opacity-100 group-hover/row:opacity-100 pointer-coarse:opacity-100 ${
                        isConfirming ? 'opacity-100' : 'opacity-0'
                      }`}
                    >
                      <FiTrash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                    {/* The inline stamp cluster, at sm and up: it lands on
                        the row's right edge — paper ground, hairline rule,
                        the one soft shadow a floating surface is allowed —
                        and focus arrives at its Keep. */}
                    {isConfirming && (
                      <div
                        role="group"
                        aria-label="Delete this entry?"
                        onKeyDown={(event) => {
                          if (event.key === 'Escape')
                            closeConfirm(transaction.id)
                        }}
                        className="absolute top-1/2 right-0 z-20 hidden -translate-y-1/2 items-center gap-2.5 rounded-[2px] border border-rule bg-paper px-2.5 py-1.5 shadow-lg sm:flex"
                      >
                        <span className="inline-block -rotate-2 rounded-[2px] border-[1.5px] border-stamp px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-stamp">
                          Delete this entry?
                        </span>
                        <button
                          type="button"
                          onClick={() => confirmDelete(transaction.id)}
                          className="rounded-[2px] bg-stamp px-2 py-0.5 font-sans text-caption font-semibold text-paper transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-print"
                        >
                          Delete
                        </button>
                        <button
                          ref={keepPanelRef}
                          type="button"
                          onClick={() => closeConfirm(transaction.id)}
                          className="rounded-[2px] border border-rule px-2 py-0.5 font-sans text-caption font-semibold text-ink-soft transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-print"
                        >
                          Keep
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
          {/* The passbook's unfilled printed lines: hairline row rules and
              the balance column's print wash, nothing written on them.
              aria-hidden and transparent to the pointer — they are paper,
              not content. The date-side cell freezes like the entries
              above it, so the frozen column holds its ground over the
              blank remainder too. */}
          {blankLineCount > 0 && (
            <tbody aria-hidden="true" className="pointer-events-none">
              {Array.from({ length: blankLineCount }, (_, index) => {
                const bottom = rowBottom(index === blankLineCount - 1)
                return (
                  <tr key={`blank-line-${index}`}>
                    <td
                      className={`h-10 w-[7.5rem] ${frozenDateCell} ${bottom}`}
                    />
                    <td colSpan={4} className={`h-10 ${bottom}`} />
                    <td
                      className={`h-10 border-l border-rule bg-print-wash ${bottom}`}
                    />
                    <td className={`h-10 ${bottom}`} />
                  </tr>
                )
              })}
            </tbody>
          )}
          <tfoot>
            <tr>
              <td
                colSpan={5}
                className="px-3 py-3.5 font-sans text-caption font-semibold uppercase tracking-[0.18em] text-ink-soft"
              >
                Balance carried forward · {carriedForwardMonth}
              </td>
              <td className="bg-print-wash px-3 py-3.5 text-right font-mono text-[13px] font-bold text-ink tabular-nums">
                {formatMoney(netBalance)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      {/* Below sm the destructive confirm is a bottom sheet: the stamp
          question, then Keep and Delete as full-width 44px targets —
          the thumb's zone, not the row's far edge. It renders outside the
          scrolling sheet so it pins to the window. */}
      {confirmingTransaction !== null && (
        <div
          role="group"
          aria-label="Delete this entry?"
          onKeyDown={(event) => {
            if (event.key === 'Escape') closeConfirm(confirmingTransaction.id)
          }}
          className="fixed inset-x-0 bottom-0 z-50 border-t border-rule bg-paper p-4 shadow-lg sm:hidden"
        >
          <p className="mb-3">
            <span className="inline-block -rotate-2 rounded-[2px] border-[1.5px] border-stamp px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-stamp">
              Delete this entry?
            </span>
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              ref={keepSheetRef}
              type="button"
              onClick={() => closeConfirm(confirmingTransaction.id)}
              className="h-11 rounded-[2px] border border-rule font-sans text-sm font-semibold text-ink-soft transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-print"
            >
              Keep
            </button>
            <button
              type="button"
              onClick={() => confirmDelete(confirmingTransaction.id)}
              className="h-11 rounded-[2px] bg-stamp font-sans text-sm font-semibold text-paper transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-print"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
