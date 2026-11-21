// web/src/components/FilterControls.tsx
// The ledger's filters row — the passbook form idiom: caption labels in
// navy, hairline print-green fields on ivory, Radix Selects (no raw
// <select>). The "all" filter states translate to Radix's non-empty
// sentinel at this boundary; the view keeps its '' contract.
import type { Property } from '../types/properties'
import { TRANSACTION_TYPE, TRANSACTION_TYPE_LABELS } from '#/lib/domain'
import { ALL_CATEGORIES } from '../transactions'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'

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
}: FilterControlsProps) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-3 items-end">
      {/* Search */}
      <div className="min-w-[12rem] flex-1">
        <label htmlFor="ledger-search" className={fieldLabel}>
          Search
        </label>
        <input
          id="ledger-search"
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

      {/* Date range */}
      <div className="min-w-[9.5rem]">
        <label htmlFor="ledger-start-date" className={fieldLabel}>
          Start date
        </label>
        <input
          id="ledger-start-date"
          type="date"
          value={dateRange.start}
          onChange={(e) =>
            onDateRangeChange({ ...dateRange, start: e.target.value })
          }
          className={fieldInput}
        />
      </div>
      <div className="min-w-[9.5rem]">
        <label htmlFor="ledger-end-date" className={fieldLabel}>
          End date
        </label>
        <input
          id="ledger-end-date"
          type="date"
          value={dateRange.end}
          onChange={(e) =>
            onDateRangeChange({ ...dateRange, end: e.target.value })
          }
          className={fieldInput}
        />
      </div>
    </div>
  )
}
