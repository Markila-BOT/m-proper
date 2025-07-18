import { useState, useEffect, useMemo } from "react";
import {
  FiPlus,
  FiHome,
  FiBarChart,
  FiSettings,
  FiDownload,
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

function App() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>(defaultCategories);
  const [properties, setProperties] = useState<Property[]>(defaultProperties);
  const [selectedProperty, setSelectedProperty] = useState<string>("all");
  const [isTransactionFormOpen, setIsTransactionFormOpen] = useState(false);
  const [isPropertyFormOpen, setIsPropertyFormOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "overview" | "transactions" | "reports"
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
              {[
                { id: "overview", label: "Overview", icon: FiBarChart },
                { id: "transactions", label: "Transactions", icon: FiSettings },
                { id: "reports", label: "Reports", icon: FiBarChart },
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                      activeTab === tab.id
                        ? "border-blue-500 text-blue-600"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </nav>

        {/* Main Content Area */}
        <main className="flex-1 px-4 py-8 sm:px-6 lg:px-8">
          {activeTab === "overview" && (
            <div className="space-y-8">
              <Summary
                transactions={filteredTransactions}
                properties={properties}
                selectedProperty={selectedProperty}
              />
              <div className="grid gap-8 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <TransactionList
                    transactions={filteredTransactions.slice(0, 10)}
                    properties={properties}
                    onDeleteTransaction={deleteTransaction}
                  />
                </div>
                <div className="space-y-6">
                  <div className="p-6 bg-white rounded-xl border border-gray-200 shadow-sm">
                    <h3 className="mb-4 text-lg font-semibold text-gray-900">
                      Quick Stats
                    </h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600">
                          Total Transactions
                        </span>
                        <span className="font-medium">
                          {filteredTransactions.length}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">This Month</span>
                        <span className="font-medium">
                          {
                            filteredTransactions.filter((t) =>
                              t.date.startsWith(
                                new Date().toISOString().slice(0, 7)
                              )
                            ).length
                          }
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Active Properties</span>
                        <span className="font-medium">
                          {properties.filter((p) => p.isActive).length}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "transactions" && (
            <div className="space-y-6">
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

          {activeTab === "reports" && (
            <div className="space-y-8">
              <Summary
                transactions={filteredTransactions}
                properties={properties}
                selectedProperty={selectedProperty}
              />

              {/* Category Breakdown */}
              <div className="grid gap-8 md:grid-cols-2">
                <div className="p-6 bg-white rounded-xl border border-gray-200 shadow-sm">
                  <h3 className="mb-4 text-lg font-semibold text-gray-900">
                    Income by Category
                  </h3>
                  <div className="space-y-3">
                    {categories
                      .filter((cat) => cat.type === "income")
                      .map((category) => {
                        const total = filteredTransactions
                          .filter(
                            (t) =>
                              t.type === "income" &&
                              t.category === category.name
                          )
                          .reduce((sum, t) => sum + t.amount, 0);

                        if (total === 0) return null;

                        return (
                          <div
                            key={category.id}
                            className="flex justify-between items-center"
                          >
                            <span className="text-gray-700">
                              {category.name}
                            </span>
                            <span className="font-medium text-emerald-600">
                              ${total.toLocaleString()}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </div>

                <div className="p-6 bg-white rounded-xl border border-gray-200 shadow-sm">
                  <h3 className="mb-4 text-lg font-semibold text-gray-900">
                    Expenses by Category
                  </h3>
                  <div className="space-y-3">
                    {categories
                      .filter((cat) => cat.type === "expense")
                      .map((category) => {
                        const total = filteredTransactions
                          .filter(
                            (t) =>
                              t.type === "expense" &&
                              t.category === category.name
                          )
                          .reduce((sum, t) => sum + t.amount, 0);

                        if (total === 0) return null;

                        return (
                          <div
                            key={category.id}
                            className="flex justify-between items-center"
                          >
                            <span className="text-gray-700">
                              {category.name}
                            </span>
                            <span className="font-medium text-red-600">
                              ${total.toLocaleString()}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Forms */}
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
