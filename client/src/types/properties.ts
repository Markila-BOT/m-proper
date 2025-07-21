import type { Property } from "shared";

export type { Property };

export type PropertySummary = {
  property: Property;
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
  transactionCount: number;
};
