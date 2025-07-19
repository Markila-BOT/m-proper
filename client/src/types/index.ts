import type { Property } from "shared";

export interface Transaction {
  id: string;
  date: string;
  description: string;
  category: string;
  amount: number;
  type: "income" | "expense"; //TODO: use as const
  property: string;
}

export interface Category {
  id: string;
  name: string;
  type: "income" | "expense";
  isDefault: boolean;
}

export interface MonthlyTotal {
  month: string;
  income: number;
  expenses: number;
  profit: number;
}

// Re-export Property from shared
export type { Property };

export interface PropertySummary {
  property: Property;
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
  transactionCount: number;
}
