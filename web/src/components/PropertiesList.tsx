// web/src/components/PropertiesList.tsx
// The Properties page — a ruled register, one line per property, the
// product question answered in money: Net on the print wash, Income in
// machine green, Expenses in ink. The card grid is retired: no cards, no
// shadows at rest, hairline rules and the 3px double closing rule carry
// the page. The register is a fixed-budget printed sheet like the ledger
// (table-fixed, one line per row, names truncate under pressure with the
// full text in the title), and its delete lives in the reserved trailing
// cell exactly as the ledger's does — hover/focus-revealed control, the
// stamp confirm cluster at sm and up, a 44px bottom sheet below it, focus
// arriving at Keep and returning to the control that opened it.
import { useEffect, useRef, useState } from 'react'
import {
  usePropertiesWithStates,
  useDeleteProperty,
} from '../hooks/useProperties'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { usePropertySummaries } from '../hooks/usePropertySummaries'
import { FiAlertCircle, FiTrash2 } from 'react-icons/fi'
import { PropertyTypeIcon } from './PropertyTypeIcon'
import { UnreachableState } from './UnreachableState'
import { Skeleton } from './ui/skeleton'
import { PROPERTY_TYPE_LABELS } from '#/lib/domain'
import type { Property } from '#/lib/domain'
import { formatMoney } from '../lib/format'
import { useMediaQuery } from '../hooks/useMediaQuery'

// The register's frozen first column (below sm): the property cell pins
// to the left edge with an opaque paper ground and its own right rule,
// and the rest of the print slides inside the ruled region.
const frozenNameCell =
  'max-sm:sticky max-sm:left-0 max-sm:z-10 max-sm:bg-paper max-sm:border-r max-sm:border-r-rule'

export default function PropertiesList() {
  const { properties, isLoading, error, isEmpty } = usePropertiesWithStates()
  const { transactions } = useLocalStorage()
  const deleteProperty = useDeleteProperty()
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  // The destructive confirm composes as the ledger's does: an inline
  // stamp cluster anchored to the row at sm and up, a bottom sheet with
  // 44px targets below it. The live breakpoint decides which one is in
  // the DOM and which Keep receives focus.
  const isWide = useMediaQuery('(min-width: 640px)')

  // The per-property money — the transactions module's own summary over
  // each property's entries.
  const propertySummaries = usePropertySummaries(properties, transactions)
  const summaryByPropertyId = new Map(
    propertySummaries.map((summary) => [summary.property.id, summary]),
  )

  // Focus discipline as the codebase keeps it: the page title is where
  // focus lands when a deleted row cannot hold it.
  const titleRef = useRef<HTMLHeadingElement>(null)
  const deleteControlRefs = useRef(new Map<string, HTMLButtonElement>())
  const keepPanelRef = useRef<HTMLButtonElement | null>(null)
  const keepSheetRef = useRef<HTMLButtonElement | null>(null)

  const confirmingProperty =
    confirmingId === null
      ? null
      : (properties.find((p) => p.id === confirmingId) ?? null)

  useEffect(() => {
    if (confirmingId === null) return
    const keep = isWide ? keepPanelRef.current : keepSheetRef.current
    keep?.focus()
  }, [confirmingId, isWide])

  const closeConfirm = (id: string) => {
    setConfirmingId(null)
    deleteControlRefs.current.get(id)?.focus()
  }

  const confirmDelete = async (property: Property) => {
    setDeleteError(null)
    try {
      await deleteProperty.mutateAsync(property.id)
      setConfirmingId(null)
      // The row is gone; the page title is the honest place for the hand.
      titleRef.current?.focus()
    } catch (err: unknown) {
      if (err instanceof Error) {
        setDeleteError(err.message)
      } else {
        setDeleteError('Failed to delete property')
      }
      // The row is still there; put the hand back on its Keep.
      const keep = isWide ? keepPanelRef.current : keepSheetRef.current
      keep?.focus()
    }
  }

  if (isLoading) {
    // The ruled skeleton: print-wash blocks pulsing at the widths of the
    // register's own columns, in the ruled rows they stand in for — the
    // page holds its shape while the record loads.
    return (
      <div
        className="space-y-5 px-6 py-6 lg:px-9"
        aria-busy="true"
        aria-label="Loading properties"
      >
        <header>
          <h1 className="text-[17px] font-bold text-ink">Properties</h1>
          <p className="mt-2 text-sm text-ink-soft">
            What is each property making me? The register answers line by line.
          </p>
        </header>
        <div className="overflow-x-auto">
          <div className="w-full min-w-[55rem]">
            {[0, 1, 2].map((index) => (
              <div
                key={index}
                aria-hidden="true"
                className="flex items-center gap-3 border-b border-rule px-3 py-2.5"
              >
                <Skeleton className="h-5 w-5" />
                <Skeleton className="h-5 w-40" />
                <Skeleton className="ml-auto h-4 w-20" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-14" />
                <Skeleton className="h-4 w-4" />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    // The register's mount of the one shared unreachable state: the page
    // keeps its landmarks (the title, the product question) and the state
    // prints on the ruled idiom where the sheet would — no register
    // lines, no zeroed totals row, beneath a line that says the figures
    // cannot be verified.
    return (
      <div className="space-y-5 px-6 py-6 lg:px-9">
        <header>
          <h1 className="text-[17px] font-bold text-ink">Properties</h1>
          <p className="mt-2 text-sm text-ink-soft">
            What is each property making me? The register answers line by line.
          </p>
        </header>
        <div className="rule-totals rule-hairline py-4">
          <UnreachableState />
        </div>
      </div>
    )
  }

  const registerHead =
    'border-b border-print px-3 pb-2.5 font-sans text-caption font-semibold uppercase tracking-[0.16em] text-ink-soft'

  return (
    <div className="space-y-5 px-6 py-6 lg:px-9">
      <header>
        <h1
          ref={titleRef}
          tabIndex={-1}
          className="text-[17px] font-bold text-ink focus-visible:outline-2 focus-visible:outline-print"
        >
          Properties
        </h1>
        {/* The product question, in the world's own voice — the page
            exists to answer it in money. */}
        <p className="mt-2 text-sm text-ink-soft">
          What is each property making me? The register answers line by line.
        </p>
        {deleteError && (
          <div className="flex items-center mt-4 space-x-2 text-stamp">
            <FiAlertCircle className="w-4 h-4" />
            <span>{deleteError}</span>
          </div>
        )}
      </header>
      {isEmpty ? (
        // The printed-totals idiom for nothing: a ruled line, not a card.
        <div className="rule-totals rule-hairline py-4">
          <p className="font-mono text-ledger text-ink">No properties</p>
          <p className="mt-1 font-sans text-caption text-ink-soft">
            This register is blank. Add your first property from the rail's add
            control to begin the book.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          {/* The printed sheet: fixed column budget, one ruled line per
              property, the money in tabular mono. Below sm the name
              column freezes at the left edge and the print slides inside
              its ruled region. */}
          <table className="w-full table-fixed min-w-[55rem] border-separate border-spacing-0">
            <thead>
              <tr>
                <th
                  scope="col"
                  className={`${registerHead} max-sm:sticky max-sm:left-0 max-sm:z-30 max-sm:bg-paper max-sm:border-r max-sm:border-r-rule`}
                >
                  Property
                </th>
                <th scope="col" className={`${registerHead} w-[8.5rem]`}>
                  Type
                </th>
                <th
                  scope="col"
                  className={`${registerHead} w-[4.5rem] text-right`}
                >
                  Units
                </th>
                <th
                  scope="col"
                  className={`${registerHead} w-[8rem] border-l border-rule text-right`}
                >
                  Net
                </th>
                <th
                  scope="col"
                  className={`${registerHead} w-[8rem] text-right`}
                >
                  Income
                </th>
                <th
                  scope="col"
                  className={`${registerHead} w-[8rem] text-right`}
                >
                  Expenses
                </th>
                <th scope="col" className={`${registerHead} w-[5.5rem]`}>
                  Status
                </th>
                <th scope="col" className="w-[2.75rem]">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {properties.map((property, index) => {
                const summary = summaryByPropertyId.get(property.id)
                const isConfirming = confirmingId === property.id
                const isLastRow = index === properties.length - 1
                // The closing rule owns its seam: the last line carries the
                // 3px double totals rule as its bottom edge.
                const bottom = isLastRow
                  ? 'rule-totals-b'
                  : 'border-b border-rule'

                return (
                  <tr key={property.id} className="group/row">
                    {/* The line's subject: the property's name at the 17px
                        print step, truncated under pressure with the full
                        text in the title. The type's icon prints in the
                        Type column, once. */}
                    <td className={`px-3 py-2.5 ${frozenNameCell} ${bottom}`}>
                      <h2
                        title={property.name}
                        className="truncate text-[17px] font-semibold leading-[1.45] text-ink"
                      >
                        {property.name}
                      </h2>
                    </td>
                    <td
                      className={`w-[8.5rem] px-3 py-2.5 font-mono text-[12.5px] text-ink-soft ${bottom}`}
                    >
                      <div className="flex items-center gap-2">
                        <PropertyTypeIcon
                          type={property.type}
                          className="h-4 w-4 flex-shrink-0 text-ink-faint"
                          aria-hidden="true"
                        />
                        {PROPERTY_TYPE_LABELS[property.type]}
                      </div>
                    </td>
                    <td
                      className={`w-[4.5rem] px-3 py-2.5 text-right font-mono text-[12.5px] text-ink-soft tabular-nums ${bottom}`}
                    >
                      {property.units ?? '—'}
                    </td>
                    {/* The product question's answer, first: Net on the
                        print wash, semibold, separated by the left rule —
                        the balance rail's own idiom. */}
                    <td
                      className={`w-[8rem] border-l border-rule bg-print-wash px-3 py-2.5 text-right font-mono text-ledger font-semibold text-ink tabular-nums ${bottom}`}
                    >
                      {formatMoney(summary?.netProfit ?? 0)}
                    </td>
                    <td
                      className={`w-[8rem] px-3 py-2.5 text-right font-mono text-ledger text-print tabular-nums ${bottom}`}
                    >
                      {formatMoney(summary?.totalIncome ?? 0)}
                    </td>
                    <td
                      className={`w-[8rem] px-3 py-2.5 text-right font-mono text-ledger text-ink-soft tabular-nums ${bottom}`}
                    >
                      {formatMoney(summary?.totalExpenses ?? 0)}
                    </td>
                    <td className={`w-[5.5rem] px-3 py-2.5 ${bottom}`}>
                      {/* The status mark, printed like the passbook's own:
                          squared, bordered, mono uppercase — never a
                          pill. */}
                      <span
                        className={`inline-block rounded-[2px] border px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] ${
                          property.isActive
                            ? 'border-print text-print'
                            : 'border-rule text-ink-soft'
                        }`}
                      >
                        {property.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    {/* The reserved trailing cell — the page's margin, the
                        ledger's own delete idiom: nothing at rest; the
                        control prints on hover, keyboard focus, touch, or
                        an open confirm. */}
                    <td className={`relative w-[2.75rem] ${bottom}`}>
                      <button
                        ref={(el) => {
                          if (el) deleteControlRefs.current.set(property.id, el)
                          else deleteControlRefs.current.delete(property.id)
                        }}
                        type="button"
                        title="Delete property"
                        aria-label="Delete property"
                        onClick={() => setConfirmingId(property.id)}
                        disabled={deleteProperty.isPending}
                        className={`absolute inset-y-0 left-0 flex w-full items-center justify-center text-ink-faint transition-colors hover:text-stamp focus-visible:text-stamp focus-visible:outline-2 focus-visible:outline-print focus-visible:opacity-100 group-hover/row:opacity-100 pointer-coarse:opacity-100 disabled:opacity-40 ${
                          isConfirming ? 'opacity-100' : 'opacity-0'
                        }`}
                      >
                        <FiTrash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                      {/* The inline stamp cluster, at sm and up: paper
                          ground, hairline rule, the one soft shadow a
                          floating surface is allowed — focus arrives at
                          its Keep. */}
                      {isConfirming && isWide && (
                        <div
                          role="group"
                          aria-label="Delete this property?"
                          onKeyDown={(event) => {
                            if (event.key === 'Escape')
                              closeConfirm(property.id)
                          }}
                          className="absolute top-1/2 right-0 z-20 hidden -translate-y-1/2 items-center gap-2.5 rounded-[2px] border border-rule bg-paper px-2.5 py-1.5 shadow-lg sm:flex"
                        >
                          <span className="inline-block -rotate-2 rounded-[2px] border-[1.5px] border-stamp px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-stamp">
                            Delete this property?
                          </span>
                          <button
                            type="button"
                            onClick={() => void confirmDelete(property)}
                            disabled={deleteProperty.isPending}
                            className="rounded-[2px] bg-stamp px-2 py-0.5 font-sans text-caption font-semibold text-paper transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-print disabled:opacity-40"
                          >
                            Delete
                          </button>
                          <button
                            ref={keepPanelRef}
                            type="button"
                            onClick={() => closeConfirm(property.id)}
                            disabled={deleteProperty.isPending}
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
            <tfoot>
              {/* The register closes as the ledger does: the 3px double
                  rule above the portfolio's own figures. */}
              <tr>
                <td
                  colSpan={3}
                  className="px-3 py-3.5 font-sans text-caption font-semibold uppercase tracking-[0.18em] text-ink-soft"
                >
                  All properties
                </td>
                <td className="bg-print-wash px-3 py-3.5 text-right font-mono text-[13px] font-bold text-ink tabular-nums">
                  {formatMoney(
                    propertySummaries.reduce(
                      (sum, summary) => sum + summary.netProfit,
                      0,
                    ),
                  )}
                </td>
                <td className="px-3 py-3.5 text-right font-mono text-[13px] text-print tabular-nums">
                  {formatMoney(
                    propertySummaries.reduce(
                      (sum, summary) => sum + summary.totalIncome,
                      0,
                    ),
                  )}
                </td>
                <td className="px-3 py-3.5 text-right font-mono text-[13px] text-ink-soft tabular-nums">
                  {formatMoney(
                    propertySummaries.reduce(
                      (sum, summary) => sum + summary.totalExpenses,
                      0,
                    ),
                  )}
                </td>
                <td />
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      {/* Below sm the destructive confirm is a bottom sheet — the ledger's
          own: the stamp question, then Keep and Delete as full-width 44px
          targets pinned to the window's bottom, in the DOM only below sm. */}
      {confirmingProperty !== null && !isWide && (
        <div
          role="group"
          aria-label="Delete this property?"
          onKeyDown={(event) => {
            if (event.key === 'Escape') closeConfirm(confirmingProperty.id)
          }}
          className="fixed inset-x-0 bottom-0 z-50 border-t border-rule bg-paper p-4 shadow-lg sm:hidden"
        >
          <p className="mb-3">
            <span className="inline-block -rotate-2 rounded-[2px] border-[1.5px] border-stamp px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-stamp">
              Delete this property?
            </span>
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              ref={keepSheetRef}
              type="button"
              onClick={() => closeConfirm(confirmingProperty.id)}
              className="h-11 rounded-[2px] border border-rule font-sans text-sm font-semibold text-ink-soft transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-print"
            >
              Keep
            </button>
            <button
              type="button"
              onClick={() => void confirmDelete(confirmingProperty)}
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
