// web/src/transactions/filter.ts
// Pure filtering with the same predicate semantics as the
// useTransactionFilters hook: property first, then search (description or
// category), category, type, and inclusive date range.
import type { Transaction } from '../types/transactions'

export type TransactionFilters = {
  searchTerm?: string
  selectedCategory?: string
  selectedType?: string
  dateRange?: { start: string; end: string }
  selectedProperty?: string
}

export function filterTransactions(
  transactions: Transaction[],
  filters: TransactionFilters = {},
): Transaction[] {
  const {
    searchTerm = '',
    selectedCategory = '',
    selectedType = '',
    dateRange = { start: '', end: '' },
    selectedProperty = 'all',
  } = filters

  let filtered = transactions

  // Filter by selected property
  if (selectedProperty !== 'all') {
    filtered = filtered.filter((t) => t.property === selectedProperty)
  }

  return filtered.filter((transaction) => {
    const matchesSearch =
      transaction.description
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      transaction.category.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesCategory =
      !selectedCategory || transaction.category === selectedCategory
    const matchesType = !selectedType || transaction.type === selectedType

    const matchesDateRange =
      (!dateRange.start || transaction.date >= dateRange.start) &&
      (!dateRange.end || transaction.date <= dateRange.end)

    return matchesSearch && matchesCategory && matchesType && matchesDateRange
  })
}
