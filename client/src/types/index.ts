import type { Property, TransactionType } from "shared";

export type Transaction = {
  id: string;
  date: string;
  description: string;
  category: string;
  amount: number;
  type: TransactionType;
  property: string;
};

export type Category = {
  id: string;
  name: string;
  type: TransactionType;
  isDefault: boolean;
};

export type MonthlyTotal = {
  month: string;
  income: number;
  expenses: number;
  profit: number;
};

// Re-export Property from shared
export type { Property };

export type PropertySummary = {
  property: Property;
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
  transactionCount: number;
};
