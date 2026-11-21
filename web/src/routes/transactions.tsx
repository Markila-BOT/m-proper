import { createFileRoute } from '@tanstack/react-router'
import { useLocalStorage, useTransactionFilters } from '../hooks'
import {
  useSelectedProperty,
  usePropertiesWithStates,
} from '../hooks/useProperties'
import { removeTransaction } from '../transactions'
import FilterControls from '../components/FilterControls'
import TransactionList from '../components/TransactionList'
import { TotalsLine } from '../components/Summary'

export const Route = createFileRoute('/transactions')({
  component: TransactionsView,
})

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

  // The strip's scope note names the property filter's current state;
  // the figures total the displayed page for the current month.
  const scopeProperty =
    selectedProperty === 'all'
      ? 'All properties'
      : (properties.find((p) => p.id === selectedProperty)?.name ??
        'Unknown Property')

  return (
    <div className="space-y-5 px-6 py-6 lg:px-9">
      <header className="flex items-baseline justify-between gap-4">
        <h1 className="text-[17px] font-bold text-ink">Transactions</h1>
        <p className="font-mono text-caption text-ink-soft">
          {filteredTransactions.length}{' '}
          {filteredTransactions.length === 1 ? 'entry' : 'entries'}
        </p>
      </header>
      <TotalsLine
        transactions={filteredTransactions}
        scopeLabel={scopeProperty}
      />
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
      />
      <TransactionList
        transactions={filteredTransactions}
        properties={properties}
        onDeleteTransaction={removeTransaction}
      />
    </div>
  )
}
