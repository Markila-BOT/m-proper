import { createFileRoute } from '@tanstack/react-router'
import { useLocalStorage, useTransactionFilters } from '../hooks'
import {
  useSelectedProperty,
  usePropertiesWithStates,
} from '../hooks/useProperties'
import { removeTransaction } from '../transactions'
import FilterControls from '../components/FilterControls'
import TransactionList from '../components/TransactionList'

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

  return (
    <div className="p-6">
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
