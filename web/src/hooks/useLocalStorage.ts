// web/src/hooks/useLocalStorage.ts
// Thin adapter over the transactions module's storage adapter — the module
// owns the key, the event name, and the store semantics. Only manage
// transactions in localStorage; category data is static.
import { useSyncExternalStore } from 'react'
import {
  EMPTY_SNAPSHOT,
  getTransactionsSnapshot,
  parseStoredTransactions,
  subscribeToTransactions,
  updateStoredTransactions,
} from '../transactions'

export function useLocalStorage() {
  const raw = useSyncExternalStore(
    subscribeToTransactions,
    getTransactionsSnapshot,
    () => EMPTY_SNAPSHOT,
  )

  return {
    transactions: parseStoredTransactions(raw),
    setTransactions: updateStoredTransactions,
  }
}
