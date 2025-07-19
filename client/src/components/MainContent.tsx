import { Transaction, Category, Property } from "../types";
import Summary from "./Summary";
import FilterControls from "./FilterControls";
import TransactionList from "./TransactionList";
import PropertiesList from "./PropertiesList";

type TabType = "overview" | "transactions" | "reports" | "properties";

interface MainContentProps {
  activeTab: TabType;
  filteredTransactions: Transaction[];
  properties: Property[];
  selectedProperty: string;
  onDeleteTransaction: (id: string) => void;
  // Filter controls props
  searchTerm: string;
  onSearchChange: (value: string) => void;
  selectedCategory: string;
  onCategoryChange: (value: string) => void;
  selectedType: string;
  onTypeChange: (value: string) => void;
  dateRange: { start: string; end: string };
  onDateRangeChange: (range: { start: string; end: string }) => void;
  categories: Category[];
  onPropertyChange: (propertyId: string) => void;
}

export default function MainContent({
  activeTab,
  filteredTransactions,
  properties,
  selectedProperty,
  onDeleteTransaction,
  searchTerm,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  selectedType,
  onTypeChange,
  dateRange,
  onDateRangeChange,
  categories,
  onPropertyChange,
}: MainContentProps) {
  return (
    <main className="flex-1">
      {activeTab === "overview" && (
        <div className="p-6">
          <Summary
            transactions={filteredTransactions}
            properties={properties}
            selectedProperty={selectedProperty}
          />
        </div>
      )}

      {activeTab === "transactions" && (
        <div className="p-6">
          <FilterControls
            searchTerm={searchTerm}
            onSearchChange={onSearchChange}
            selectedCategory={selectedCategory}
            onCategoryChange={onCategoryChange}
            selectedType={selectedType}
            onTypeChange={onTypeChange}
            dateRange={dateRange}
            onDateRangeChange={onDateRangeChange}
            categories={categories}
            properties={properties}
            selectedProperty={selectedProperty}
            showPropertyFilter={selectedProperty === "all"}
            onPropertyChange={onPropertyChange}
          />
          <TransactionList
            transactions={filteredTransactions}
            properties={properties}
            onDeleteTransaction={onDeleteTransaction}
          />
        </div>
      )}

      {activeTab === "properties" && <PropertiesList />}

      {activeTab === "reports" && (
        <div className="p-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Reports & Analytics
            </h2>
            <p className="text-gray-600">
              Advanced reporting and analytics features coming soon...
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
