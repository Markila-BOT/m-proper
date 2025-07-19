import { useState, useEffect } from "react";
import { Transaction, Category } from "../types";
import { defaultCategories } from "../data/defaultCategories";

export function useLocalStorage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>(defaultCategories);

  // Load data from localStorage on mount
  useEffect(() => {
    const savedTransactions = localStorage.getItem("landlord-transactions");
    const savedCategories = localStorage.getItem("landlord-categories");

    if (savedTransactions) {
      setTransactions(JSON.parse(savedTransactions));
    }

    if (savedCategories) {
      setCategories(JSON.parse(savedCategories));
    }
  }, []);

  // Save to localStorage when data changes
  useEffect(() => {
    localStorage.setItem("landlord-transactions", JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem("landlord-categories", JSON.stringify(categories));
  }, [categories]);

  return {
    transactions,
    setTransactions,
    categories,
    setCategories,
  };
}
