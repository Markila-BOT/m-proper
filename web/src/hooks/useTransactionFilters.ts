import { useState, useMemo } from "react";
import type { Transaction } from "../types/transactions";

export function useTransactionFilters(
  transactions: Transaction[],
  selectedProperty: string
) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });

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
  };
}
