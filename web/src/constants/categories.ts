import type { Category } from '../types/categories'

export const INCOME_CATEGORIES: Category[] = [
  { id: '1', name: 'Rental Income', type: 'income' },
  { id: '2', name: 'Late Fees', type: 'income' },
  { id: '3', name: 'Parking Fees', type: 'income' },
  { id: '4', name: 'Pet Fees', type: 'income' },
  { id: '5', name: 'Application Fees', type: 'income' },
  { id: '6', name: 'Security Deposit Interest', type: 'income' },
  { id: '7', name: 'Laundry Income', type: 'income' },
  { id: '8', name: 'Storage Fees', type: 'income' },
]

export const EXPENSE_CATEGORIES: Category[] = [
  { id: '9', name: 'Property Management', type: 'expense' },
  { id: '10', name: 'Maintenance & Repairs', type: 'expense' },
  { id: '11', name: 'Property Insurance', type: 'expense' },
  { id: '12', name: 'Property Taxes', type: 'expense' },
  { id: '13', name: 'Utilities', type: 'expense' },
  { id: '14', name: 'Advertising', type: 'expense' },
  { id: '15', name: 'Legal & Professional', type: 'expense' },
  { id: '16', name: 'Mortgage Interest', type: 'expense' },
  { id: '17', name: 'Cleaning & Landscaping', type: 'expense' },
  { id: '18', name: 'Office Supplies', type: 'expense' },
  { id: '19', name: 'Travel & Transportation', type: 'expense' },
  { id: '20', name: 'Software & Subscriptions', type: 'expense' },
  { id: '21', name: 'Banking Fees', type: 'expense' },
  { id: '22', name: 'Depreciation', type: 'expense' },
]

export const ALL_CATEGORIES: Category[] = [
  ...INCOME_CATEGORIES,
  ...EXPENSE_CATEGORIES,
]
