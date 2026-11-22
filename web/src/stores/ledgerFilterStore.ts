// web/src/stores/ledgerFilterStore.ts
// The ledger's interactive filter state (search, category, type, date
// range) — lifted out of the Transactions view so the shell's export can
// write the same displayed slice the ledger shows, without reopening the
// prop-drilling corridor ADR-0003 closed. This is a store the header
// reads, not a prop chain. The selected-property SCOPE keeps its own
// home (propertyStore); this one holds only the ledger view's apparatus.
// Not persisted: a reload opens onto the book, exactly as the view's
// local state did before the lift.
import { create } from 'zustand'

type DateRange = { start: string; end: string }

// The reset control lives in FilterControls, not here: unwinding every
// filter also clears the in-row property select (whose home is the
// property store), so the component composes the individual setters
// below plus its property reset — a store-level reset would only know
// half the row.
type LedgerFilterState = {
  searchTerm: string
  selectedCategory: string
  selectedType: string
  dateRange: DateRange
  setSearchTerm: (value: string) => void
  setSelectedCategory: (value: string) => void
  setSelectedType: (value: string) => void
  setDateRange: (range: DateRange) => void
}

export const useLedgerFilterStore = create<LedgerFilterState>()((set) => ({
  searchTerm: '',
  selectedCategory: '',
  selectedType: '',
  dateRange: { start: '', end: '' },
  setSearchTerm: (searchTerm) => set({ searchTerm }),
  setSelectedCategory: (selectedCategory) => set({ selectedCategory }),
  setSelectedType: (selectedType) => set({ selectedType }),
  setDateRange: (dateRange) => set({ dateRange }),
}))
