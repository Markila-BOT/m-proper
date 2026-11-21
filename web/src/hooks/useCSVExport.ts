import type { Transaction } from '../types/transactions'
import type { Property } from '../types/properties'
import { toCSV } from '../transactions'

export function useCSVExport() {
  const exportToCSV = (
    filteredTransactions: Transaction[],
    properties: Property[],
    selectedProperty: string,
  ) => {
    // The transactions module owns the row building (RFC-4180 quoting);
    // the browser dance stays here.
    const csvContent = toCSV(filteredTransactions, properties)

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `landlord-ledger-${
      selectedProperty === 'all' ? 'all-properties' : 'property'
    }-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return { exportToCSV }
}
