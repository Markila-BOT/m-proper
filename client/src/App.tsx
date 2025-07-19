import { useState } from "react";
import { Transaction } from "./types";
import {
  AppLayout,
  AppHeader,
  NavigationTabs,
  MainContent,
  AppModals,
} from "./components";
import { useLocalStorage, useTransactionFilters, useCSVExport } from "./hooks";
import {
  useSelectedProperty,
  usePropertiesWithStates,
} from "./hooks/useProperties";

type TabType = "overview" | "transactions" | "reports" | "properties";

function App() {
  // Local storage management
  const { transactions, setTransactions, categories } = useLocalStorage();

  const { selectedProperty } = useSelectedProperty();
  const { properties } = usePropertiesWithStates();

  // UI state
  const [isTransactionFormOpen, setIsTransactionFormOpen] = useState(false);
  const [isPropertyFormOpen, setIsPropertyFormOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Transaction filtering
  const {
    searchTerm,
    setSearchTerm,
    selectedCategory,
    setSelectedCategory,
    selectedType,
    setSelectedType,
    dateRange,
    setDateRange,
    filteredTransactions,
  } = useTransactionFilters(transactions, selectedProperty);

  // CSV export
  const { exportToCSV } = useCSVExport();

  // Event handlers
  const addTransaction = (transactionData: Omit<Transaction, "id">) => {
    const newTransaction: Transaction = {
      ...transactionData,
      id: Date.now().toString(),
    };
    setTransactions((prev) => [newTransaction, ...prev]);
  };

  const deleteTransaction = (id: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  };

  const handleExport = () => {
    exportToCSV(filteredTransactions, properties, selectedProperty);
  };

  const handleAddTransaction = () => {
    setIsTransactionFormOpen(true);
  };

  const handleAddProperty = () => {
    setIsPropertyFormOpen(true);
  };

  const handleCloseTransactionForm = () => {
    setIsTransactionFormOpen(false);
  };

  const handleClosePropertyForm = () => {
    setIsPropertyFormOpen(false);
  };

  const handleToggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  return (
    <AppLayout
      onAddProperty={handleAddProperty}
      isSidebarCollapsed={isSidebarCollapsed}
      onToggleSidebar={handleToggleSidebar}
    >
      <AppHeader
        onExport={handleExport}
        onAddTransaction={handleAddTransaction}
      />
      <NavigationTabs activeTab={activeTab} onTabChange={setActiveTab} />
      <MainContent
        activeTab={activeTab}
        filteredTransactions={filteredTransactions}
        onDeleteTransaction={deleteTransaction}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        selectedType={selectedType}
        onTypeChange={setSelectedType}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        categories={categories}
      />
      <AppModals
        isTransactionFormOpen={isTransactionFormOpen}
        onCloseTransactionForm={handleCloseTransactionForm}
        isPropertyFormOpen={isPropertyFormOpen}
        onClosePropertyForm={handleClosePropertyForm}
        categories={categories}
        properties={properties}
        selectedProperty={selectedProperty}
        onAddTransaction={addTransaction}
      />
    </AppLayout>
  );
}

export default App;
