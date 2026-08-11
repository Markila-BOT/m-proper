// web/src/hooks/useLocalStorage.ts
// Only manage transactions in localStorage; category data is static
import { useCallback, useSyncExternalStore } from 'react'
import type { Transaction } from '../types/transactions'

const STORAGE_KEY = 'landlord-transactions'

function readRaw(): string {
  if (typeof window === 'undefined') return '[]'
  try {
    return localStorage.getItem(STORAGE_KEY) ?? '[]'
  } catch {
    return '[]'
  }
}

function writeRaw(raw: string) {
  localStorage.setItem(STORAGE_KEY, raw)
  window.dispatchEvent(new Event('landlord-transactions'))
}

function subscribe(onStoreChange: () => void) {
  const handler = () => onStoreChange()
  window.addEventListener('storage', handler)
  window.addEventListener('landlord-transactions', handler)
  return () => {
    window.removeEventListener('storage', handler)
    window.removeEventListener('landlord-transactions', handler)
  }
}

export function useLocalStorage() {
  const raw = useSyncExternalStore(subscribe, readRaw, () => '[]')

  let transactions: Transaction[] = []
  try {
    transactions = JSON.parse(raw) as Transaction[]
  } catch {
    transactions = []
  }

  const setTransactions = useCallback(
    (updater: Transaction[] | ((prev: Transaction[]) => Transaction[])) => {
      const prev = (() => {
        try {
          return JSON.parse(readRaw()) as Transaction[]
        } catch {
          return [] as Transaction[]
        }
      })()
      const next = typeof updater === 'function' ? updater(prev) : updater
      writeRaw(JSON.stringify(next))
    },
    [],
  )

  return {
    transactions,
    setTransactions,
  }
}
