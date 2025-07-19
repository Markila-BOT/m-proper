import { useState, useEffect } from "react";
import { Transaction, Category, Property } from "../types";
import { defaultCategories } from "../data/defaultCategories";
import { defaultProperties } from "../data/defaultProperties";

export function useLocalStorage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>(defaultCategories);
  const [properties, setProperties] = useState<Property[]>(defaultProperties);
  const [selectedProperty, setSelectedProperty] = useState<string>("all");

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

  return {
    transactions,
    setTransactions,
    categories,
    setCategories,
    properties,
    setProperties,
    selectedProperty,
    setSelectedProperty,
  };
}
