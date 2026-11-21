import { createFileRoute } from '@tanstack/react-router'
import { useLocalStorage, useTransactionFilters } from '../hooks'
import {
  useSelectedProperty,
  usePropertiesWithStates,
} from '../hooks/useProperties'
import Summary from '../components/Summary'

export const Route = createFileRoute('/overview')({
  component: OverviewView,
})

function OverviewView() {
  // Local storage management
  const { transactions } = useLocalStorage()

  const { selectedProperty } = useSelectedProperty()
  const { properties } = usePropertiesWithStates()

  // The Overview's slice of the ledger: the selected property's
  // transactions (ADR-0003 — each view owns its filter state; the
  // interactive filters belong to the Transactions view).
  const { filteredTransactions } = useTransactionFilters(
    transactions,
    selectedProperty,
  )

  return (
    <div className="space-y-5 px-6 py-6 lg:px-9">
      <header>
        <h1 className="text-[17px] font-bold text-ink">Overview</h1>
      </header>
      <Summary
        transactions={filteredTransactions}
        properties={properties}
        selectedProperty={selectedProperty}
      />
    </div>
  )
}
