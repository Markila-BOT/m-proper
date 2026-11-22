import type { Transaction } from '../types/transactions'
import type { Property } from '../types/properties'
import { toCSV } from '../transactions'
import { localDateString } from '../lib/format'

// The honest slice names, shared by the export control and its stamp: at
// rest the displayed ledger IS the book (the backup promise holds), and
// anything narrower says so.
export type ExportSliceLabel = 'All entries' | 'Displayed ledger'

export function useCSVExport() {
  const exportToCSV = (
    // The displayed slice — the same rows the Transactions page shows:
    // the selected-property scope plus the ledger view's active filters.
    displayedTransactions: Transaction[],
    properties: Property[],
    sliceLabel: ExportSliceLabel,
  ) => {
    // The transactions module owns the row building (RFC-4180 quoting);
    // the browser dance stays here.
    const csvContent = toCSV(displayedTransactions, properties)

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `landlord-ledger-${
      sliceLabel === 'All entries' ? 'all-entries' : 'displayed-ledger'
    }-${localDateString()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return { exportToCSV }
}
