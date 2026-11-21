// web/src/transactions/storage.ts
// The storage adapter for client-side transactions. Owns the storage key and
// the custom event name, and provides the useSyncExternalStore semantics the
// useLocalStorage hook adapts: a raw-string snapshot (stable across calls),
// a parse that never throws, a read-modify-write, and a subscribe that
// listens for both the custom event and the cross-tab 'storage' event.
import type { Transaction } from '../types/transactions'

export const STORAGE_KEY = 'landlord-transactions'
export const STORAGE_EVENT = 'landlord-transactions'

export function getTransactionsSnapshot(): string {
  if (typeof window === 'undefined') return '[]'
  try {
    return localStorage.getItem(STORAGE_KEY) ?? '[]'
  } catch {
    return '[]'
  }
}

export function parseStoredTransactions(raw: string): Transaction[] {
  try {
    return JSON.parse(raw) as Transaction[]
  } catch {
    return []
  }
}

export function loadTransactions(): Transaction[] {
  return parseStoredTransactions(getTransactionsSnapshot())
}

export function saveTransactions(transactions: Transaction[]): void {
  writeStoredTransactions(JSON.stringify(transactions))
}

export function updateStoredTransactions(
  updater: Transaction[] | ((prev: Transaction[]) => Transaction[]),
): void {
  const prev = loadTransactions()
  const next = typeof updater === 'function' ? updater(prev) : updater
  writeStoredTransactions(JSON.stringify(next))
}

function writeStoredTransactions(raw: string): void {
  localStorage.setItem(STORAGE_KEY, raw)
  window.dispatchEvent(new Event(STORAGE_EVENT))
}

export function subscribeToTransactions(onStoreChange: () => void): () => void {
  const handler = () => onStoreChange()
  window.addEventListener('storage', handler)
  window.addEventListener(STORAGE_EVENT, handler)
  return () => {
    window.removeEventListener('storage', handler)
    window.removeEventListener(STORAGE_EVENT, handler)
  }
}
