import type { Transaction } from '../types/transactions'
import Summary from './Summary'
import FilterControls from './FilterControls'
import TransactionList from './TransactionList'
import PropertiesList from './PropertiesList'
import {
  useSelectedProperty,
  usePropertiesWithStates,
} from '../hooks/useProperties'

type TabType = 'overview' | 'transactions' | 'reports' | 'properties'

type MainContentProps = {
  activeTab: TabType
  filteredTransactions: Transaction[]
  onDeleteTransaction: (id: string) => void
  searchTerm: string
  onSearchChange: (value: string) => void
  selectedCategory: string
  onCategoryChange: (value: string) => void
  selectedType: string
  onTypeChange: (value: string) => void
  dateRange: { start: string; end: string }
  onDateRangeChange: (range: { start: string; end: string }) => void
}

export default function MainContent({
  activeTab,
  filteredTransactions,
  onDeleteTransaction,
  searchTerm,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  selectedType,
  onTypeChange,
  dateRange,
  onDateRangeChange,
}: MainContentProps) {
  const { selectedProperty, setSelectedProperty } = useSelectedProperty()
  const { properties } = usePropertiesWithStates()

  return (
    <main className="flex-1">
      {activeTab === 'overview' && (
        <div className="p-6">
          <Summary
            transactions={filteredTransactions}
            properties={properties}
            selectedProperty={selectedProperty}
          />
        </div>
      )}

      {activeTab === 'transactions' && (
        <div className="p-6">
          <FilterControls
            searchTerm={searchTerm}
            onSearchChange={onSearchChange}
            selectedCategory={selectedCategory}
            onCategoryChange={onCategoryChange}
            selectedType={selectedType}
            onTypeChange={onTypeChange}
            dateRange={dateRange}
            onDateRangeChange={onDateRangeChange}
            properties={properties}
            selectedProperty={selectedProperty}
            showPropertyFilter={selectedProperty === 'all'}
            onPropertyChange={setSelectedProperty}
          />
          <TransactionList
            transactions={filteredTransactions}
            properties={properties}
            onDeleteTransaction={onDeleteTransaction}
          />
        </div>
      )}

      {activeTab === 'properties' && <PropertiesList />}

      {activeTab === 'reports' && (
        <div className="p-6">
          <div className="p-6 bg-white rounded-lg shadow">
            <h2 className="mb-4 text-xl font-semibold text-gray-900">
              Reports & Analytics
            </h2>
            <p className="text-gray-600">
              Advanced reporting and analytics features coming soon...
            </p>
          </div>
        </div>
      )}
    </main>
  )
}
