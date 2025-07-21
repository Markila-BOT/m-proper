import { FiSearch } from "react-icons/fi";
import { Property } from "../types/properties";
import { TRANSACTION_TYPE, TRANSACTION_TYPE_LABELS } from "shared";
import { ALL_CATEGORIES } from "@/constants/categories";

type FilterControlsProps = {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  selectedCategory: string;
  onCategoryChange: (value: string) => void;
  selectedType: string;
  onTypeChange: (value: string) => void;
  dateRange: { start: string; end: string };
  onDateRangeChange: (range: { start: string; end: string }) => void;
  properties: Property[];
  selectedProperty: string;
  showPropertyFilter: boolean;
  onPropertyChange: (value: string) => void;
};

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
    <div className="p-6 mb-6 bg-white rounded-lg border border-gray-200 shadow-sm">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Search */}
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 w-4 h-4 text-gray-400 transform -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search transactions..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="py-2 pr-4 pl-10 w-full rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Category Filter */}
        <div>
          <select
            value={selectedCategory}
            onChange={(e) => onCategoryChange(e.target.value)}
            className="px-3 py-2 w-full rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Categories</option>
            {ALL_CATEGORIES.map((category) => (
              <option key={category.id} value={category.name}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        {/* Type Filter */}
        <div>
          <select
            value={selectedType}
            onChange={(e) => onTypeChange(e.target.value)}
            className="px-3 py-2 w-full rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Types</option>
            <option value={TRANSACTION_TYPE.INCOME}>
              {TRANSACTION_TYPE_LABELS[TRANSACTION_TYPE.INCOME]}
            </option>
            <option value={TRANSACTION_TYPE.EXPENSE}>
              {TRANSACTION_TYPE_LABELS[TRANSACTION_TYPE.EXPENSE]}
            </option>
          </select>
        </div>

        {/* Property Filter (only show when "all" is selected) */}
        {showPropertyFilter && (
          <div>
            <select
              value={selectedProperty}
              onChange={(e) => onPropertyChange(e.target.value)}
              className="px-3 py-2 w-full rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Properties</option>
              {properties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Date Range */}
      <div className="grid grid-cols-1 gap-4 mt-4 md:grid-cols-2">
        <div>
          <label className="block mb-1 text-sm font-medium text-gray-700">
            Start Date
          </label>
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) =>
              onDateRangeChange({ ...dateRange, start: e.target.value })
            }
            className="px-3 py-2 w-full rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block mb-1 text-sm font-medium text-gray-700">
            End Date
          </label>
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) =>
              onDateRangeChange({ ...dateRange, end: e.target.value })
            }
            className="px-3 py-2 w-full rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>
    </div>
  );
}
