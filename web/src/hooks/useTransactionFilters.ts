import { useState, useMemo } from 'react'
import type { Transaction } from '../types/transactions'
import { filterTransactions } from '../transactions'

export function useTransactionFilters(
  transactions: Transaction[],
  selectedProperty: string,
) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedType, setSelectedType] = useState('')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })

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
