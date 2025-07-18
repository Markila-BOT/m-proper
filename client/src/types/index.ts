export interface Transaction {
  id: string;
  date: string;
  description: string;
  category: string;
  amount: number;
  type: 'income' | 'expense';
  property: string;
}

export interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  isDefault: boolean;
}

export interface MonthlyTotal {
  month: string;
  income: number;
  expenses: number;
  profit: number;
}

export interface Property {
  id: string;
  name: string;
  address: string;
  type: 'residential' | 'commercial';
  units?: number;
  isActive: boolean;
  createdAt: string;
}

export interface PropertySummary {
  property: Property;
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
  transactionCount: number;
}