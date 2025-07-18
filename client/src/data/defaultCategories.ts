import { Category } from '../types';

export const defaultCategories: Category[] = [
  // Income Categories
  { id: '1', name: 'Rental Income', type: 'income', isDefault: true },
  { id: '2', name: 'Late Fees', type: 'income', isDefault: true },
  { id: '3', name: 'Parking Fees', type: 'income', isDefault: true },
  { id: '4', name: 'Pet Fees', type: 'income', isDefault: true },
  { id: '5', name: 'Application Fees', type: 'income', isDefault: true },
  { id: '6', name: 'Security Deposit Interest', type: 'income', isDefault: true },
  { id: '7', name: 'Laundry Income', type: 'income', isDefault: true },
  { id: '8', name: 'Storage Fees', type: 'income', isDefault: true },

  // Expense Categories
  { id: '9', name: 'Property Management', type: 'expense', isDefault: true },
  { id: '10', name: 'Maintenance & Repairs', type: 'expense', isDefault: true },
  { id: '11', name: 'Property Insurance', type: 'expense', isDefault: true },
  { id: '12', name: 'Property Taxes', type: 'expense', isDefault: true },
  { id: '13', name: 'Utilities', type: 'expense', isDefault: true },
  { id: '14', name: 'Advertising', type: 'expense', isDefault: true },
  { id: '15', name: 'Legal & Professional', type: 'expense', isDefault: true },
  { id: '16', name: 'Mortgage Interest', type: 'expense', isDefault: true },
  { id: '17', name: 'Cleaning & Landscaping', type: 'expense', isDefault: true },
  { id: '18', name: 'Office Supplies', type: 'expense', isDefault: true },
  { id: '19', name: 'Travel & Transportation', type: 'expense', isDefault: true },
  { id: '20', name: 'Software & Subscriptions', type: 'expense', isDefault: true },
  { id: '21', name: 'Banking Fees', type: 'expense', isDefault: true },
  { id: '22', name: 'Depreciation', type: 'expense', isDefault: true },
];