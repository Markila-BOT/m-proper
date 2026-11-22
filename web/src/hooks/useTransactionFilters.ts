import { useMemo } from 'react'
import type { Transaction } from '../types/transactions'
import { filterTransactions } from '../transactions'
import { useLedgerFilterStore } from '../stores/ledgerFilterStore'

export function useTransactionFilters(
  transactions: Transaction[],
  selectedProperty: string,
) {
  // The interactive filters live in the ledger filter store (critique
  // round three): the Transactions view drives them, the shell's export
  // reads them, and both compute the same displayed slice from this one
  // seam. The selected-property scope arrives as the argument it always
  // was.
  const {
    searchTerm,
    setSearchTerm,
    selectedCategory,
    setSelectedCategory,
    selectedType,
    setSelectedType,
    dateRange,
    setDateRange,
  } = useLedgerFilterStore()

  // Filter transactions based on selected property and other filters
  const filteredTransactions = useMemo(
    () =>
      filterTransactions(transactions, {
        searchTerm,
        selectedCategory,
        selectedType,
        dateRange,
        selectedProperty,
      }),
    [
      transactions,
      selectedProperty,
      searchTerm,
      selectedCategory,
      selectedType,
      dateRange,
    ],
  )

  return {
    searchTerm,
    setSearchTerm,
    selectedCategory,
    setSelectedCategory,
    selectedType,
    setSelectedType,
    dateRange,
    setDateRange,
    filteredTransactions,
  }
}
