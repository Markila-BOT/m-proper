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
    <div className="p-6">
      <Summary
        transactions={filteredTransactions}
        properties={properties}
        selectedProperty={selectedProperty}
      />
    </div>
  )
}
