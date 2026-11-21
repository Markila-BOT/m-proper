// web/src/transactions/core.ts
// Transaction mutations. The id policy is unchanged: Date.now().toString().
import type { Transaction } from '../types/transactions'
import { updateStoredTransactions } from './storage'

export function addTransaction(
  transactionData: Omit<Transaction, 'id'>,
): Transaction {
  const newTransaction: Transaction = {
    ...transactionData,
    id: Date.now().toString(),
  }
  updateStoredTransactions((prev) => [newTransaction, ...prev])
  return newTransaction
}

export function removeTransaction(id: string): void {
  updateStoredTransactions((prev) => prev.filter((t) => t.id !== id))
}
