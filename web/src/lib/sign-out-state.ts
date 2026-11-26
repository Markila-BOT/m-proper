// web/src/lib/sign-out-state.ts
// The browser state that belongs to one landlord's session. Sign-out is the
// only point that must forget it (design §6; requirement "Sign-out clears
// the visible state"): the query cache holds the properties list and every
// derived query, the property store holds the selected scope — persisted, so
// the next account would otherwise reopen on the previous landlord's
// property — and the ledger filter store holds the view's search and
// narrowing.
//
// The collaborators are parameters, not module imports: the router's query
// client is created per app instance in `getContext()`, never as a module
// singleton, so the caller hands over the client it already has. Keeping
// them injectable also means the reset is testable without a browser.
//
// The ledger's own storage key and its legacy import are not here: re-keying
// the local ledger, offering a pre-auth one for import, and retiring it are
// owned by `server-transactions` (ADR-0009).

export type QueryCache = { clear: () => void }

// The parts of the two zustand stores a reset needs, stated structurally so
// the helper takes the real stores and any stand-in.
export type PropertySelectionStore = {
  setState: (state: { selectedProperty: 'all' }) => void
  // The persist middleware attaches this only when the browser gave it
  // storage; with storage blocked there is no entry to remove, and the
  // method is absent rather than empty.
  persist?: { clearStorage: () => void }
}

export type LedgerFilterStore = {
  setState: (state: {
    searchTerm: ''
    selectedCategory: ''
    selectedType: ''
    dateRange: { start: ''; end: '' }
  }) => void
}

export type SharedState = {
  // Absent only on the API client's 401 path, which has no route context to
  // reach the router's client from; the store resets still run there.
  queryClient?: QueryCache
  propertyStore: PropertySelectionStore
  filterStore: LedgerFilterStore
}

// The order is the requirement's: the cached server data, then the persisted
// property scope, then the filters. The scope goes back to its initial value
// (which `persist` writes through) and its storage entry is removed as well,
// so the next account starts on all properties whichever way it hydrates.
export function resetSharedState({
  queryClient,
  propertyStore,
  filterStore,
}: SharedState): void {
  queryClient?.clear()

  propertyStore.setState({ selectedProperty: 'all' })
  propertyStore.persist?.clearStorage()

  filterStore.setState({
    searchTerm: '',
    selectedCategory: '',
    selectedType: '',
    dateRange: { start: '', end: '' },
  })
}

// Clear first, end the session second, and let the end's failure travel to
// the caller: a sign-out request that never reaches the server must still
// leave none of that shared state behind, while the control that asked is
// entitled to know the session may not have ended.
export async function endSessionAfterClearing(
  state: SharedState,
  endSession: () => Promise<unknown>,
): Promise<void> {
  resetSharedState(state)
  await endSession()
}
