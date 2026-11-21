import { useCallback, useEffect, useRef, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useLocalStorage, useTransactionFilters } from '../hooks'
import {
  useSelectedProperty,
  usePropertiesWithStates,
} from '../hooks/useProperties'
import { removeTransaction, restoreTransaction } from '../transactions'
import type { Transaction } from '../types/transactions'
import FilterControls from '../components/FilterControls'
import TransactionList from '../components/TransactionList'
import { TotalsLine, propertyScopeLabel } from '../components/Summary'

export const Route = createFileRoute('/transactions')({
  component: TransactionsView,
})

// The undo window: five seconds to change your mind about a deleted line.
const UNDO_WINDOW_MS = 5000

function TransactionsView() {
  // Local storage management
  const { transactions } = useLocalStorage()

  const { selectedProperty, setSelectedProperty } = useSelectedProperty()
  const { properties } = usePropertiesWithStates()

  // The ledger owns its filters (ADR-0003): search, category, type, and
  // date range live here in the view, not in the shell.
  const {
    searchTerm,
    setSearchTerm,
    selectedCategory,
    setSelectedCategory,
    selectedType,
    setSelectedType,
    dateRange,
    setDateRange,
    filteredTransactions,
  } = useTransactionFilters(transactions, selectedProperty)

  // The "/" accelerator: one keystroke reaches the ledger's search field
  // from anywhere on the page — unless the hand is already writing in a
  // field, where "/" is the visitor's own character to keep.
  const searchInputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '/') return
      const target = event.target as HTMLElement | null
      if (
        target &&
        (target.isContentEditable ||
          ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
      ) {
        return
      }
      event.preventDefault()
      searchInputRef.current?.focus()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // The delete's honest recovery: the removed line can come back within
  // the undo window, restored with its original id — the very line that
  // left, not a re-recorded twin. Focus lands on the page title (the
  // deleted row cannot hold it), and the snackbar announces itself.
  const [deletedEntry, setDeletedEntry] = useState<Transaction | null>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)

  const handleDeleteTransaction = useCallback(
    (id: string) => {
      const entry = transactions.find((t) => t.id === id) ?? null
      removeTransaction(id)
      setDeletedEntry(entry)
      titleRef.current?.focus()
    },
    [transactions],
  )

  const handleUndoDelete = useCallback(() => {
    if (deletedEntry === null) return
    restoreTransaction(deletedEntry)
    setDeletedEntry(null)
    titleRef.current?.focus()
  }, [deletedEntry])

  useEffect(() => {
    if (deletedEntry === null) return
    const timer = window.setTimeout(() => setDeletedEntry(null), UNDO_WINDOW_MS)
    return () => window.clearTimeout(timer)
  }, [deletedEntry])

  // The strip follows the display: its label names the property scope the
  // ledger beneath it shows, and its figures total that displayed slice.
  const scopeLabel =
    selectedProperty === 'all'
      ? 'All properties'
      : propertyScopeLabel(selectedProperty, properties)

  return (
    <div className="space-y-5 px-6 py-6 lg:px-9">
      <header className="flex items-baseline justify-between gap-4">
        <h1
          ref={titleRef}
          tabIndex={-1}
          className="text-[17px] font-bold text-ink focus-visible:outline-2 focus-visible:outline-print"
        >
          Transactions
        </h1>
        <p className="font-mono text-caption font-semibold text-ink-soft">
          {filteredTransactions.length}{' '}
          {filteredTransactions.length === 1 ? 'entry' : 'entries'}
        </p>
      </header>
      <TotalsLine transactions={filteredTransactions} scopeLabel={scopeLabel} />
      <FilterControls
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        selectedType={selectedType}
        onTypeChange={setSelectedType}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        properties={properties}
        selectedProperty={selectedProperty}
        showPropertyFilter={selectedProperty === 'all'}
        onPropertyChange={setSelectedProperty}
        searchInputRef={searchInputRef}
      />
      <TransactionList
        transactions={filteredTransactions}
        bookTransactions={transactions}
        properties={properties}
        onDeleteTransaction={handleDeleteTransaction}
      />
      {deletedEntry !== null && (
        <div
          role="status"
          className="fixed bottom-4 inset-x-4 z-40 sm:inset-x-auto sm:bottom-6 sm:left-6"
        >
          <div className="flex items-center justify-between gap-4 rounded-[2px] border border-rule bg-paper py-2 pl-4 pr-2 shadow-lg">
            <p className="font-sans text-caption font-semibold uppercase tracking-[0.14em] text-ink-soft">
              Entry deleted
            </p>
            <button
              type="button"
              onClick={handleUndoDelete}
              className="flex h-11 items-center rounded-[2px] px-3 font-sans text-sm font-semibold text-ink transition-colors hover:text-print focus-visible:outline-2 focus-visible:outline-print sm:h-9"
            >
              Undo
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
