import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

import { readSupabaseConfig } from './config'

// The landlord's browser-side identity client. It talks to Supabase Auth
// only — never the Data API (ADR-0007) — and keeps its session in cookies so
// the Start server can read and refresh the same session.
export type SupabaseBrowserClient = SupabaseClient

let browserClient: SupabaseBrowserClient | null = null

// Created on first call, not at import: the server render imports this module
// too, and a browser client needs a document. The missing-config error is
// raised at call time for the same reason — the build must not depend on a
// developer's local .env.
export function getSupabaseBrowserClient(): SupabaseBrowserClient {
  if (browserClient) {
    return browserClient
  }

  const { url, publishableKey } = readSupabaseConfig()
  browserClient = createBrowserClient(url, publishableKey)

  return browserClient
}
