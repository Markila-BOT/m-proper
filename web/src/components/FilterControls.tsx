// web/src/components/FilterControls.tsx
// The ledger's filters row — the passbook form idiom: caption labels in
// navy, hairline print-green fields on ivory, Radix Selects (no raw
// <select>). The "all" filter states translate to Radix's non-empty
// sentinel at this boundary; the view keeps its '' contract. A caption-
// voiced Reset control prints at the row's end whenever any filter is
// active, and unwinds every counted control in one action.
//
// Below sm the row folds behind a disclosure control that names how many
// filters are active ("Filters · 2") — the narrow window opens onto the
// record, not onto a wall of apparatus. The row itself is CSS-composed:
// the server paints it collapsed below sm and expanded at sm and up, no
// hydration flash.
import { useState } from 'react'
import type { Ref } from 'react'
import type { Property } from '../types/properties'
import { FiChevronDown } from 'react-icons/fi'
import { TRANSACTION_TYPE, TRANSACTION_TYPE_LABELS } from '#/lib/domain'
import { ALL_CATEGORIES } from '../transactions'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'
import { DateRangePicker } from './ui/date-picker'

// Radix forbids the empty string as an item value; the filter's "no
// filter" state maps onto this sentinel and back.
const ALL = '__all__'

type FilterControlsProps = {
  searchTerm: string
  onSearchChange: (value: string) => void
  selectedCategory: string
  onCategoryChange: (value: string) => void
  selectedType: string
  onTypeChange: (value: string) => void
  dateRange: { start: string; end: string }
  onDateRangeChange: (range: { start: string; end: string }) => void
  properties: Property[]
  selectedProperty: string
  showPropertyFilter: boolean
  onPropertyChange: (value: string) => void
  // The "/" accelerator's target (7.4): the view owns the keydown, this
  // row owns the field it reaches.
  searchInputRef?: Ref<HTMLInputElement>
}

const fieldLabel =
  'mb-1.5 block font-sans text-caption font-semibold uppercase tracking-[0.14em] text-ink-soft'
const fieldInput =
  'h-9 w-full rounded-[2px] border border-rule bg-paper px-3 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-paper'

export default function FilterControls({
  searchTerm,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  selectedType,
  onTypeChange,
  dateRange,
  onDateRangeChange,
  properties,
  selectedProperty,
  showPropertyFilter,
  onPropertyChange,
  searchInputRef,
}: FilterControlsProps) {
  // The disclosure's honest count: every control inside the folded row
  // that is not at its default. The property scope counts only while its
  // select is shown folded inside the row.
  const [isFiltersOpen, setIsFiltersOpen] = useState(false)
  const activeFilterCount = [
    searchTerm !== '',
    selectedCategory !== '',
    selectedType !== '',
    showPropertyFilter && selectedProperty !== 'all',
    // The pair is ONE filter: either bound being set narrows the ledger.
    dateRange.start !== '' || dateRange.end !== '',
  ].filter(Boolean).length

  // One action unwinds every active control — the escape hatch from a
  // six-field apparatus. It clears exactly what the count counts, so the
  // control never claims more than it does.
  const resetFilters = () => {
    onSearchChange('')
    onCategoryChange('')
    onTypeChange('')
    if (showPropertyFilter) onPropertyChange('all')
    onDateRangeChange({ start: '', end: '' })
  }

  return (
    <div>
      <button
        type="button"
        aria-expanded={isFiltersOpen}
        aria-controls="ledger-filters"
        onClick={() => setIsFiltersOpen((open) => !open)}
        className="flex w-full items-center justify-between border-b border-rule py-2.5 font-sans text-caption font-semibold uppercase tracking-[0.14em] text-ink-soft transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-print sm:hidden"
      >
        <span>
          Filters{activeFilterCount > 0 ? ` · ${activeFilterCount}` : ''}
        </span>
        <FiChevronDown
          className={`h-4 w-4 ${isFiltersOpen ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>
      <div
        id="ledger-filters"
        className={`${isFiltersOpen ? 'flex' : 'hidden'} flex-wrap items-end gap-x-4 gap-y-3 pt-3 sm:flex`}
      >
        {/* Search */}
        <div className="min-w-[12rem] flex-1">
          <label htmlFor="ledger-search" className={fieldLabel}>
            Search
          </label>
          <input
            id="ledger-search"
            ref={searchInputRef}
            type="text"
            placeholder="Description or category"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className={fieldInput}
          />
        </div>

        {/* Category Filter */}
        <div className="min-w-[11rem]">
          <label htmlFor="ledger-category" className={fieldLabel}>
            Category
          </label>
          <Select
            value={selectedCategory === '' ? ALL : selectedCategory}
            onValueChange={(value) =>
              onCategoryChange(value === ALL ? '' : value)
            }
          >
            <SelectTrigger id="ledger-category" aria-label="Category">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All categories</SelectItem>
              {Object.values(ALL_CATEGORIES).map((category) => (
                <SelectItem key={category.name} value={category.name}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Type Filter */}
        <div className="min-w-[8rem]">
          <label htmlFor="ledger-type" className={fieldLabel}>
            Type
          </label>
          <Select
            value={selectedType === '' ? ALL : selectedType}
            onValueChange={(value) => onTypeChange(value === ALL ? '' : value)}
          >
            <SelectTrigger id="ledger-type" aria-label="Type">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All types</SelectItem>
              <SelectItem value={TRANSACTION_TYPE.INCOME}>
                {TRANSACTION_TYPE_LABELS[TRANSACTION_TYPE.INCOME]}
              </SelectItem>
              <SelectItem value={TRANSACTION_TYPE.EXPENSE}>
                {TRANSACTION_TYPE_LABELS[TRANSACTION_TYPE.EXPENSE]}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Property Filter (only when the shell's scope is "all") */}
        {showPropertyFilter && (
          <div className="min-w-[13rem]">
            <label htmlFor="ledger-property" className={fieldLabel}>
              Property
            </label>
            <Select value={selectedProperty} onValueChange={onPropertyChange}>
              <SelectTrigger id="ledger-property" aria-label="Property">
                <SelectValue placeholder="All properties" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All properties</SelectItem>
                {properties.map((property) => (
                  <SelectItem key={property.id} value={property.id}>
                    {property.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Date range — one picker for the from/to pair; the typed fields
            and the calendar trigger share the pair's state. */}
        <DateRangePicker
          start={dateRange.start}
          end={dateRange.end}
          onChange={onDateRangeChange}
          className="min-w-[20rem]"
        />

        {/* The reset control prints only when there is something to reset,
            in the row's own caption voice — one action, every counted
            filter back to its default. */}
        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={resetFilters}
            className="pb-2.5 font-sans text-caption font-semibold uppercase tracking-[0.14em] text-ink-soft transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-print"
          >
            Reset filters
          </button>
        )}
      </div>
    </div>
  )
}
