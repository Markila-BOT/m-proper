import { useMemo } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useLocalStorage } from '../hooks'
import {
  useSelectedProperty,
  usePropertiesWithStates,
} from '../hooks/useProperties'
import { filterTransactions } from '../transactions'
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
  // transactions and nothing else (ADR-0003 — the interactive filters
  // belong to the Transactions view, and this page's strip claims "All
  // entries" of the scope, so it must never total a filtered-away slice
  // some other page's apparatus holds).
  const scopedTransactions = useMemo(
    () => filterTransactions(transactions, { selectedProperty }),
    [transactions, selectedProperty],
  )

  return (
    <div className="space-y-5 px-6 py-6 lg:px-9">
      <header>
        <h1 className="text-[17px] font-bold text-ink">Overview</h1>
      </header>
      <Summary
        transactions={scopedTransactions}
        properties={properties}
        selectedProperty={selectedProperty}
      />
    </div>
  )
}
