// web/src/transactions/categories.ts
// Category lists as name-keyed records — the name is the identity (and the
// React key); the fake numeric ids are gone. Display names and the
// income/expense split are unchanged. Object values iterate in insertion
// order, so option lists keep today's order.
import { TRANSACTION_TYPE } from '../lib/domain'
import type { Category } from '../types/categories'

export const INCOME_CATEGORIES: Record<string, Category> = {
  'Rental Income': { name: 'Rental Income', type: TRANSACTION_TYPE.INCOME },
  'Late Fees': { name: 'Late Fees', type: TRANSACTION_TYPE.INCOME },
  'Parking Fees': { name: 'Parking Fees', type: TRANSACTION_TYPE.INCOME },
  'Pet Fees': { name: 'Pet Fees', type: TRANSACTION_TYPE.INCOME },
  'Application Fees': {
    name: 'Application Fees',
    type: TRANSACTION_TYPE.INCOME,
  },
  'Security Deposit Interest': {
    name: 'Security Deposit Interest',
    type: TRANSACTION_TYPE.INCOME,
  },
  'Laundry Income': { name: 'Laundry Income', type: TRANSACTION_TYPE.INCOME },
  'Storage Fees': { name: 'Storage Fees', type: TRANSACTION_TYPE.INCOME },
}

export const EXPENSE_CATEGORIES: Record<string, Category> = {
  'Property Management': {
    name: 'Property Management',
    type: TRANSACTION_TYPE.EXPENSE,
  },
  'Maintenance & Repairs': {
    name: 'Maintenance & Repairs',
    type: TRANSACTION_TYPE.EXPENSE,
  },
  'Property Insurance': {
    name: 'Property Insurance',
    type: TRANSACTION_TYPE.EXPENSE,
  },
  'Property Taxes': {
    name: 'Property Taxes',
    type: TRANSACTION_TYPE.EXPENSE,
  },
  Utilities: { name: 'Utilities', type: TRANSACTION_TYPE.EXPENSE },
  Advertising: { name: 'Advertising', type: TRANSACTION_TYPE.EXPENSE },
  'Legal & Professional': {
    name: 'Legal & Professional',
    type: TRANSACTION_TYPE.EXPENSE,
  },
  'Mortgage Interest': {
    name: 'Mortgage Interest',
    type: TRANSACTION_TYPE.EXPENSE,
  },
  'Cleaning & Landscaping': {
    name: 'Cleaning & Landscaping',
    type: TRANSACTION_TYPE.EXPENSE,
  },
  'Office Supplies': {
    name: 'Office Supplies',
    type: TRANSACTION_TYPE.EXPENSE,
  },
  'Travel & Transportation': {
    name: 'Travel & Transportation',
    type: TRANSACTION_TYPE.EXPENSE,
  },
  'Software & Subscriptions': {
    name: 'Software & Subscriptions',
    type: TRANSACTION_TYPE.EXPENSE,
  },
  'Banking Fees': { name: 'Banking Fees', type: TRANSACTION_TYPE.EXPENSE },
  Depreciation: { name: 'Depreciation', type: TRANSACTION_TYPE.EXPENSE },
}

export const ALL_CATEGORIES: Record<string, Category> = {
  ...INCOME_CATEGORIES,
  ...EXPENSE_CATEGORIES,
}
