// web/src/lib/supabase/sign-out.ts
// The single call site the shell uses to leave. The session cookies are
// cleared by the sign-out server function; the shared browser state — the
// query cache, the property store (and its persisted selection), and the
// ledger filter store — is cleared first, so every consumer inherits the
// reset without another edit and even a sign-out request that never reaches
// the server leaves no cached or selected state behind.
//
// The query client is the router's, created per app instance in
// `getContext()` and never a module singleton (design §6): the caller hands
// over the client it can already reach from the route context. The API
// client's 401 path also calls this, but has no route context to read one
// from; there the store resets still run, and the sign-in that follows is a
// document load, which discards the cache with the page.
//
// Not here: re-keying the ledger per account, offering a pre-auth ledger for
// import, and retiring the local ledger. Those belong to
// `server-transactions` (ADR-0009).
import type { QueryClient } from '@tanstack/react-query'

import { useLedgerFilterStore } from '../../stores/ledgerFilterStore'
import { usePropertyStore } from '../../stores/propertyStore'
import { endSessionAfterClearing } from '../sign-out-state'
import { signOut } from './auth'

export type SignOutOptions = {
  queryClient?: QueryClient
}

export async function signOutEverywhere({
  queryClient,
}: SignOutOptions = {}): Promise<void> {
  await endSessionAfterClearing(
    {
      queryClient,
      propertyStore: usePropertyStore,
      filterStore: useLedgerFilterStore,
    },
    signOut,
  )
}
