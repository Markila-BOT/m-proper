// web/src/transactions/index.ts
// The transactions module — one pure TypeScript seam, no React imports.
// Views and hooks adapt to this interface; a future server cutover swaps
// the storage adapter alone.
export {
  STORAGE_KEY,
  STORAGE_EVENT,
  EMPTY_SNAPSHOT,
  getTransactionsSnapshot,
  parseStoredTransactions,
  loadTransactions,
  saveTransactions,
  updateStoredTransactions,
  subscribeToTransactions,
} from './storage'

export { addTransaction, removeTransaction, restoreTransaction } from './core'

export { filterTransactions } from './filter'
export type { TransactionFilters } from './filter'

export {
  summarizeTransactions,
  monthlyTotals,
  runningBalance,
} from './summarize'
export type { TransactionSummary } from './summarize'

export { toCSV } from './csv'

export {
  INCOME_CATEGORIES,
  EXPENSE_CATEGORIES,
  ALL_CATEGORIES,
} from './categories'

export type { Transaction, MonthlyTotal } from '../types/transactions'
export type { Category } from '../types/categories'
