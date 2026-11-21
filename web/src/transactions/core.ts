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

// The delete undo (5-second window): restores the removed entry with its
// ORIGINAL id, so the line returns as the very line that left — not as a
// re-recorded twin. Prepends like addTransaction; the guard keeps a
// double-undo from duplicating the line.
export function restoreTransaction(transaction: Transaction): void {
  updateStoredTransactions((prev) => [
    transaction,
    ...prev.filter((t) => t.id !== transaction.id),
  ])
}
