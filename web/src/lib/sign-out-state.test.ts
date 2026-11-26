import assert from 'node:assert/strict'
import { test } from 'node:test'

// The browser's storage is a system boundary: the property store's
// `persist` middleware reaches for `window.localStorage` when the store is
// created, so the test installs a memory stand-in before importing the
// store. The stores themselves are the real ones — this test substitutes
// the boundary, not code this repo owns.
const memory = new Map<string, string>()

const memoryLocalStorage: Storage = {
  get length() {
    return memory.size
  },
  clear: () => {
    memory.clear()
  },
  getItem: (key) => memory.get(key) ?? null,
  key: (index) => Array.from(memory.keys())[index] ?? null,
  removeItem: (key) => {
    memory.delete(key)
  },
  setItem: (key, value) => {
    memory.set(key, value)
  },
}

Object.defineProperty(globalThis, 'window', {
  value: { localStorage: memoryLocalStorage },
  configurable: true,
})

const { usePropertyStore } = await import('../stores/propertyStore.ts')
const { useLedgerFilterStore } = await import('../stores/ledgerFilterStore.ts')
const { resetSharedState, endSessionAfterClearing } =
  await import('./sign-out-state.ts')

const PROPERTY_KEY = 'landlord-selected-property'

// The query client's `clear` is the one collaborator the test replaces: it
// stands in for the cache the router creates, so the test can see that the
// clear happened without a browser.
function fakeQueryCache() {
  const calls = { clear: 0 }

  return {
    queryClient: {
      clear: () => {
        calls.clear += 1
      },
    },
    calls,
  }
}

function sharedState(queryClient?: { clear: () => void }) {
  return {
    queryClient,
    propertyStore: usePropertyStore,
    filterStore: useLedgerFilterStore,
  }
}

test('clears the query cache', () => {
  const { queryClient, calls } = fakeQueryCache()

  resetSharedState(sharedState(queryClient))

  assert.equal(calls.clear, 1)
})

test('resets the selected property to all properties', () => {
  usePropertyStore.setState({ selectedProperty: 'property-a' })

  resetSharedState(sharedState())

  assert.equal(usePropertyStore.getState().selectedProperty, 'all')
})

test('removes the persisted selected property', () => {
  memory.clear()
  usePropertyStore.setState({ selectedProperty: 'property-a' })
  assert.ok(memory.has(PROPERTY_KEY), 'the fixture persisted a selection')

  resetSharedState(sharedState())

  assert.equal(memory.has(PROPERTY_KEY), false)
})

test('resets the ledger filters to their empty values', () => {
  useLedgerFilterStore.setState({
    searchTerm: 'rent',
    selectedCategory: 'rent',
    selectedType: 'income',
    dateRange: { start: '2026-01-01', end: '2026-02-01' },
  })

  resetSharedState(sharedState())

  const filters = useLedgerFilterStore.getState()
  assert.equal(filters.searchTerm, '')
  assert.equal(filters.selectedCategory, '')
  assert.equal(filters.selectedType, '')
  assert.deepEqual(filters.dateRange, { start: '', end: '' })
})

test('clears the visible state before the session ends', async () => {
  memory.clear()
  usePropertyStore.setState({ selectedProperty: 'property-a' })
  useLedgerFilterStore.setState({ searchTerm: 'rent' })
  const { queryClient, calls } = fakeQueryCache()

  let observed: { property: string; search: string; clears: number } | null =
    null

  await endSessionAfterClearing(sharedState(queryClient), async () => {
    observed = {
      property: usePropertyStore.getState().selectedProperty,
      search: useLedgerFilterStore.getState().searchTerm,
      clears: calls.clear,
    }
  })

  assert.deepEqual(observed, { property: 'all', search: '', clears: 1 })
})

test('keeps the visible state cleared when the session cannot be ended', async () => {
  memory.clear()
  usePropertyStore.setState({ selectedProperty: 'property-a' })
  useLedgerFilterStore.setState({ searchTerm: 'rent' })
  const { queryClient, calls } = fakeQueryCache()

  await assert.rejects(
    endSessionAfterClearing(sharedState(queryClient), async () => {
      throw new Error('the sign-out request never reached the server')
    }),
    /never reached the server/,
  )

  assert.equal(usePropertyStore.getState().selectedProperty, 'all')
  assert.equal(useLedgerFilterStore.getState().searchTerm, '')
  assert.equal(calls.clear, 1)
})
