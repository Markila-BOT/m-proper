// web/src/components/TransactionList.tsx
// The ledger — a bank passbook page. TanStack Table v9 owns the column
// model and the sort state; the running balance rail is the transactions
// module's runningBalance. A real passbook opens at its oldest unfilled
// line, so the default sort is date ascending and the "none" state is
// unreachable (enableSortingRemoval: false) — the sheet never silently
// falls back to storage order, which records newest-first.
//
// The rail speaks for the book, not the view: whatever order or slice the
// rows display, the balance printed on each line is the one the BOOK's own
// chronological accumulation owes it — every entry, date ascending, filters
// and sorts notwithstanding. A caption caveat names the divergence
// whenever the display is not the book's own order — any active filter,
// any sort that is not date-ascending — and names WHY (filtered, sorted,
// or both), because a rail that recomputed itself per view would print
// accounts that never existed. The totals strip above keeps its own
// displayed-slice claim; the tfoot below keeps the carried-forward of
// what the page displays.
//
// The sheet is a printed page of fixed column budget (table-fixed): the
// description keeps the reading width, Category and Property print as
// narrow columns that truncate under pressure (title carries the full
// text), and a row is one line at print density at every width — the
// table holds its minimum print width and slides inside its ruled region
// when the window is narrower, as it does below sm with the date column
// frozen at the left edge.
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
  // The slice the page displays — the property scope plus the view's
  // interactive filters.
  transactions: Transaction[]
  // The whole record, every entry the browser holds: the book the rail
  // audits regardless of what the page displays.
  bookTransactions: Transaction[]
  properties: Property[]
  onDeleteTransaction: (id: string) => void
}

export default function TransactionList({
  transactions,
  bookTransactions,
  properties,
  onDeleteTransaction,
}: TransactionListProps) {
  // The ledger opens chronological — the passbook's own order. Sorting
  // removal is off, so the display order is always an explicit sort:
  // ascending (the book's own order), or another choice — under which the
  // rail still audits the book and the caveat names the divergence.
  const [sorting, setSorting] = useState<SortingState>(() => [
    { id: 'date', desc: false },
  ])
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  // The destructive confirm composes two ways: an inline stamp cluster
  // anchored to the row at sm and up, a bottom sheet with 44px targets
  // below it. The live breakpoint decides which one is in the DOM at all
  // — the sheet never sits display:none in a desktop page — and which
  // Keep receives focus.
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

  // The empty page's own paint is mount-gated, the blank lines' own
  // pattern: the server renders against its empty snapshot while the
  // browser may already hold entries, and a lagging hydration window
  // would print "No entries" over a held book — A3's empty-page episode,
  // reproduced at the load boundary. The first honest paint is silent;
  // the ruled "No entries" line belongs to the live snapshot alone.
  const [isLedgerMounted, setIsLedgerMounted] = useState(false)
  useEffect(() => {
    setIsLedgerMounted(true)
  }, [])

  const propertyNames = useMemo(() => {
    const names = new Map<string, string>()
    for (const property of properties) names.set(property.id, property.name)
    return names
  }, [properties])

  // The ledger's columns. `balance` carries no accessor: it is a derived
  // measurement, not a field, and it is never a sort key. The trailing
  // `actions` cell is the page's margin — the reserved place where the
  // hand reaches for a line, holding nothing at rest.
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
  const isDateAsc =
    sorting.length === 1 && sorting[0].id === 'date' && !sorting[0].desc

  // Does the page display the book itself — every entry, no filter taking
  // a line away? The displayed slice is always a subset of the book, so
  // equal cardinality means equal sets.
  const isBookSlice = transactions.length === bookTransactions.length

  // The caveat names WHY the display is not the book's own order, not
  // only that it isn't: a filter took lines away, the sort is not the
  // passbook's chronological one, or both. Date-descending is "newest
  // first" in the world's own words; any other column names itself.
  const SORT_DIVERGENCE_LABELS: Record<string, string> = {
    date: 'sorted newest first',
    description: 'sorted by description',
    category: 'sorted by category',
    property: 'sorted by property',
    amount: 'sorted by amount',
  }
  const caveatWhy = [
    !isBookSlice && 'this view is filtered',
    !isDateAsc &&
      (SORT_DIVERGENCE_LABELS[sorting[0]?.id ?? ''] ??
        'sorted by another column'),
  ].filter((bit): bit is string => bit !== false)

  // The rail: the book's own accumulation, always — every entry in the
  // record, date ascending, stable for equal dates. Each displayed row
  // prints the balance the book owes it whatever order the rows sit in,
  // so a filtered or re-sorted page can never invent an account that
  // never existed.
  const balanceById = useMemo(() => {
    const bookRows = [...bookTransactions].sort((a, b) =>
      a.date.localeCompare(b.date),
    )
    const railBalances = runningBalance(bookRows)
    const map = new Map<string, number>()
    for (let i = 0; i < bookRows.length; i += 1) {
      map.set(bookRows[i].id, railBalances[i])
    }
    return map
  }, [bookTransactions])

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
    // Pre-mount, the region stays quiet (see isLedgerMounted above): the
    // book's absence is the live snapshot's claim to make.
    if (!isLedgerMounted) return null
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
  // "Carried forward" is the page's closing claim, and it claims what the
  // page displays: the latest date of the displayed rows, whatever order
  // they sit in — a stored 'YYYY-MM-DD' string compared as the calendar
  // string it is (lexicographic order IS chronological order for the
  // stored format), with the net of every displayed entry beneath the 3px
  // double rule. (The rail's book-claim lives above; the strip's
  // displayed-slice claim lives higher still.)
  const carriedForwardDate = displayedRows.reduce(
    (latest, row) => (row.original.date > latest ? row.original.date : latest),
    displayedRows[0].original.date,
  )
  const [carriedYear, carriedMonth] = carriedForwardDate.split('-').map(Number)
  const carriedForwardMonth = new Date(
    carriedYear,
    carriedMonth - 1,
    1,
  ).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
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
      {/* The caveat: one line, caption-voiced, printed whenever the
          display is not the book's own order — and it names why: a filter
          took lines away ("this view is filtered"), the sort is not the
          chronological one ("sorted newest first" / "sorted by a column"),
          or both. The rail keeps auditing the book either way; the caveat
          is the honesty that says so. */}
      {caveatWhy.length > 0 && (
        <p className="pb-2 font-sans text-caption font-semibold uppercase tracking-[0.14em] text-ink-soft">
          Balance follows the book · {caveatWhy.join(' · ')}
        </p>
      )}
      <div className="relative overflow-x-auto">
        {/* The printed page: fixed column budget, one-line rows. At sm and
            up the sheet floors at its 55rem print width — wide enough that
            Category and Property print their words and the description
            keeps a reading column — and the ruled region slides it when
            the window is narrower. Below sm the composition is the
            verified mobile one: the 64rem sheet slides with the date
            column frozen at the left edge. */}
        <table className="w-full table-fixed min-w-[55rem] max-sm:min-w-[64rem] border-separate border-spacing-0">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const meta = header.column.columnDef.meta
                  const sorted = header.column.getIsSorted()
                  const canSort = header.column.getCanSort()
                  const align = meta?.align ?? 'left'
                  const width =
                    header.id === 'date'
                      ? 'w-[7.5rem]'
                      : header.id === 'category' || header.id === 'property'
                        ? 'w-[7.5rem]'
                        : header.id === 'amount'
                          ? 'w-[7.5rem]'
                          : header.id === 'balance'
                            ? 'w-[8rem]'
                            : header.id === 'actions'
                              ? 'w-[2.75rem]'
                              : ''

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
                      }${width ? ` ${width}` : ''}${
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
                          // The sheet's touch standard reaches the sort
                          // headers: 44px of target grown by padding — the
                          // caption type never grows to fake it.
                          className={`inline-flex items-center gap-1.5 py-3.5 underline-offset-4 transition-colors hover:text-ink hover:underline focus-visible:text-ink focus-visible:outline-2 focus-visible:outline-print${
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
              const propertyName =
                propertyNames.get(transaction.property) ?? 'Unknown Property'

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
                  {/* The reading column: it takes the width the fixed
                      budget leaves, truncates under pressure, and the
                      title carries the whole line — a wrapped description
                      would break the page's one-line rhythm. */}
                  <td
                    title={transaction.description}
                    className={`truncate px-3 py-2.5 font-mono text-ledger font-medium text-ink ${bottom}`}
                  >
                    <span>{transaction.description}</span>
                  </td>
                  <td
                    title={transaction.category}
                    className={`w-[7.5rem] truncate px-3 py-2.5 font-mono text-[12.5px] text-ink-soft ${bottom}`}
                  >
                    {transaction.category}
                  </td>
                  <td
                    title={propertyName}
                    className={`w-[7.5rem] truncate px-3 py-2.5 font-mono text-[12.5px] text-ink-soft ${bottom}`}
                  >
                    {propertyName}
                  </td>
                  <td
                    className={`w-[7.5rem] border-l border-rule px-3 py-2.5 text-right font-mono text-ledger font-semibold tabular-nums ${
                      isIncome ? 'text-print' : 'text-ink'
                    } ${bottom}`}
                  >
                    {isIncome
                      ? `+${formatMoney(transaction.amount)}`
                      : formatMoney(-transaction.amount)}
                  </td>
                  <td
                    className={`w-[8rem] border-l border-rule bg-print-wash px-3 py-2.5 text-right font-mono text-ledger font-semibold text-ink tabular-nums ${bottom}`}
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
                    {isConfirming && isWide && (
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
              not content — and ruled at the entries' own line height so
              the blank remainder carries the page's rhythm. The date-side
              cell freezes like the entries above it, so the frozen column
              holds its ground over the blank remainder too. */}
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
          question, then Keep and Delete as full-width 44px targets — the
          thumb's zone, not the row's far edge. It renders outside the
          scrolling sheet so it pins to the window, and only below sm: at
          sm and up the inline cluster is the confirm, and this sheet is
          not in the desktop DOM at all. */}
      {confirmingTransaction !== null && !isWide && (
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
