import { useState, useEffect, useMemo } from "react";
import {
  FiPlus,
  FiHome,
  FiBarChart,
  FiSettings,
  FiDownload,
  FiDatabase,
} from "react-icons/fi";
import { Transaction, Category, Property, PropertySummary } from "./types";
import { defaultCategories } from "./data/defaultCategories";
import { defaultProperties } from "./data/defaultProperties";
import PropertySidebar from "./components/PropertySidebar";
import PropertyForm from "./components/PropertyForm";
import TransactionForm from "./components/TransactionForm";
import TransactionList from "./components/TransactionList";
import Summary from "./components/Summary";
import FilterControls from "./components/FilterControls";
import PropertiesList from "./components/PropertiesList";

function App() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>(defaultCategories);
  const [properties, setProperties] = useState<Property[]>(defaultProperties);
  const [selectedProperty, setSelectedProperty] = useState<string>("all");
  const [isTransactionFormOpen, setIsTransactionFormOpen] = useState(false);
  const [isPropertyFormOpen, setIsPropertyFormOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "overview" | "transactions" | "reports" | "properties"
  >("overview");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });

  // Load data from localStorage on mount
  useEffect(() => {
    const savedTransactions = localStorage.getItem("landlord-transactions");
    const savedCategories = localStorage.getItem("landlord-categories");
    const savedProperties = localStorage.getItem("landlord-properties");
    const savedSelectedProperty = localStorage.getItem(
      "landlord-selected-property"
    );

    if (savedTransactions) {
      setTransactions(JSON.parse(savedTransactions));
    }

    if (savedCategories) {
      setCategories(JSON.parse(savedCategories));
    }

    if (savedProperties) {
      setProperties(JSON.parse(savedProperties));
    }

    if (savedSelectedProperty) {
      setSelectedProperty(savedSelectedProperty);
    }
  }, []);

  // Save to localStorage when data changes
  useEffect(() => {
    localStorage.setItem("landlord-transactions", JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem("landlord-categories", JSON.stringify(categories));
  }, [categories]);

  useEffect(() => {
    localStorage.setItem("landlord-properties", JSON.stringify(properties));
  }, [properties]);

  useEffect(() => {
    localStorage.setItem("landlord-selected-property", selectedProperty);
  }, [selectedProperty]);

  const addTransaction = (transactionData: Omit<Transaction, "id">) => {
    const newTransaction: Transaction = {
      ...transactionData,
      id: Date.now().toString(),
    };
    setTransactions((prev) => [newTransaction, ...prev]);
  };

  const addProperty = (propertyData: Omit<Property, "id" | "createdAt">) => {
    const newProperty: Property = {
      ...propertyData,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
    };
    setProperties((prev) => [newProperty, ...prev]);
  };

  const deleteTransaction = (id: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  };

  // Filter transactions based on selected property and other filters
  const filteredTransactions = useMemo(() => {
    let filtered = transactions;

    // Filter by selected property
    if (selectedProperty !== "all") {
      filtered = filtered.filter((t) => t.property === selectedProperty);
    }

    // Apply other filters
    return filtered.filter((transaction) => {
      const matchesSearch =
        transaction.description
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        transaction.category.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCategory =
        !selectedCategory || transaction.category === selectedCategory;
      const matchesType = !selectedType || transaction.type === selectedType;

      const matchesDateRange =
        (!dateRange.start || transaction.date >= dateRange.start) &&
        (!dateRange.end || transaction.date <= dateRange.end);

      return (
        matchesSearch && matchesCategory && matchesType && matchesDateRange
      );
    });
  }, [
    transactions,
    selectedProperty,
    searchTerm,
    selectedCategory,
    selectedType,
    dateRange,
  ]);

  // Calculate property summaries
  const propertySummaries = useMemo((): PropertySummary[] => {
    return properties.map((property) => {
      const propertyTransactions = transactions.filter(
        (t) => t.property === property.id
      );
      const totalIncome = propertyTransactions
        .filter((t) => t.type === "income")
        .reduce((sum, t) => sum + t.amount, 0);
      const totalExpenses = propertyTransactions
        .filter((t) => t.type === "expense")
        .reduce((sum, t) => sum + t.amount, 0);

      return {
        property,
        totalIncome,
        totalExpenses,
        netProfit: totalIncome - totalExpenses,
        transactionCount: propertyTransactions.length,
      };
    });
  }, [properties, transactions]);

  const exportToCSV = () => {
    const headers = [
      "Date",
      "Description",
      "Category",
      "Type",
      "Amount",
      "Property",
    ];
    const csvContent = [
      headers.join(","),
      ...filteredTransactions.map((t) => {
        const property = properties.find((p) => p.id === t.property);
        return [
          t.date,
          `"${t.description}"`,
          `"${t.category}"`,
          t.type,
          t.amount,
          `"${property ? property.name : "Unknown Property"}"`,
        ].join(",");
      }),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `landlord-ledger-${
      selectedProperty === "all" ? "all-properties" : "property"
    }-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Property Sidebar */}
      <PropertySidebar
        properties={properties}
        selectedProperty={selectedProperty}
        onSelectProperty={setSelectedProperty}
        propertySummaries={propertySummaries}
        onAddProperty={() => setIsPropertyFormOpen(true)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />

      {/* Main Content */}
      <div className="flex flex-col flex-1">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 shadow-sm">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-600 rounded-lg">
                  <FiHome className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">
                    Landlord Ledger
                  </h1>
                  <p className="text-sm text-gray-500">
                    Property Management Finance
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <button
                  onClick={exportToCSV}
                  className="flex items-center px-4 py-2 space-x-2 text-gray-600 rounded-lg transition-colors hover:text-gray-900 hover:bg-gray-100"
                >
                  <FiDownload className="w-4 h-4" />
                  <span>Export</span>
                </button>

                <button
                  onClick={() => setIsTransactionFormOpen(true)}
                  className="flex items-center px-4 py-2 space-x-2 text-white bg-blue-600 rounded-lg shadow-sm transition-colors hover:bg-blue-700"
                >
                  <FiPlus className="w-4 h-4" />
                  <span>Add Transaction</span>
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Navigation Tabs */}
        <nav className="bg-white border-b border-gray-200">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex space-x-8">
              <button
                onClick={() => setActiveTab("overview")}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === "overview"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                <FiBarChart className="w-4 h-4 inline mr-2" />
                Overview
              </button>
              <button
                onClick={() => setActiveTab("transactions")}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === "transactions"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                <FiBarChart className="w-4 h-4 inline mr-2" />
                Transactions
              </button>
              <button
                onClick={() => setActiveTab("properties")}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === "properties"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                <FiDatabase className="w-4 h-4 inline mr-2" />
                Properties (React Query)
              </button>
              <button
                onClick={() => setActiveTab("reports")}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === "reports"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                <FiSettings className="w-4 h-4 inline mr-2" />
                Reports
              </button>
            </div>
          </div>
        </nav>

        {/* Main Content Area */}
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
                onSearchChange={setSearchTerm}
                selectedCategory={selectedCategory}
                onCategoryChange={setSelectedCategory}
                selectedType={selectedType}
                onTypeChange={setSelectedType}
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
                categories={categories}
                properties={properties}
                selectedProperty={selectedProperty}
                showPropertyFilter={selectedProperty === "all"}
                onPropertyChange={setSelectedProperty}
              />
              <TransactionList
                transactions={filteredTransactions}
                properties={properties}
                onDeleteTransaction={deleteTransaction}
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
      </div>

      {/* Modals */}
      <TransactionForm
        categories={categories}
        properties={properties}
        selectedProperty={selectedProperty}
        onAddTransaction={addTransaction}
        isOpen={isTransactionFormOpen}
        onClose={() => setIsTransactionFormOpen(false)}
      />

      <PropertyForm
        onAddProperty={addProperty}
        isOpen={isPropertyFormOpen}
        onClose={() => setIsPropertyFormOpen(false)}
      />
    </div>
  );
}

export default App;
