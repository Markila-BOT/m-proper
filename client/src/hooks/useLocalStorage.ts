// client/src/hooks/useLocalStorage.ts
// Only manage transactions in localStorage; category data is now static
import { useState, useEffect } from "react";
import { Transaction } from "../types/transactions";

export function useLocalStorage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // Load data from localStorage on mount
  useEffect(() => {
    const savedTransactions = localStorage.getItem("landlord-transactions");
    if (savedTransactions) {
      setTransactions(JSON.parse(savedTransactions));
    }
  }, []);

  // Save to localStorage when data changes
  useEffect(() => {
    localStorage.setItem("landlord-transactions", JSON.stringify(transactions));
  }, [transactions]);

  return {
    transactions,
    setTransactions,
  };
}
