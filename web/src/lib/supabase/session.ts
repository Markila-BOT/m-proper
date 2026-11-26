import {
  createMiddleware,
  createServerFn,
  getGlobalStartContext,
} from '@tanstack/react-start'

import { isSupabaseUnavailable } from './errors'
import { createServerSupabaseClient } from './server'

// The signed-in landlord, as far as the Start server can tell. `email` comes
// from Supabase Auth; the id is the JWT subject the Rust API scopes data by.
export interface SessionIdentity {
  userId: string
  email: string | null
}

// What a document request learned about the session. An outage is recorded
// here rather than thrown: a Supabase hiccup must not take the page down, and
// the next request gets another chance.
export interface SessionRefreshResult {
  identity: SessionIdentity | null
  error: Error | null
}

// Asset paths end in a file extension and never need a session. Start does not
// route static files here, but the filter keeps a misrouted asset from paying
// for a Supabase round trip.
const ASSET_PATH_PATTERN = /\.[a-z0-9]+$/i

// Refreshes an expired access token (rotating the cookies onto the response)
// once per request, and hands the result to the rest of the pipeline through
// the request context. Server-function requests run it too, so a client-side
// navigation gets the same answer as the document load.
export const sessionRefreshMiddleware = createMiddleware({
  type: 'request',
}).server(async ({ pathname, handlerType, next }) => {
  if (handlerType === 'router' && ASSET_PATH_PATTERN.test(pathname)) {
    return next()
  }

  const session = await refreshSession()

  return next({ context: { session } })
})

// The shell's one identity read. A server function so the `beforeLoad` guard
// in the next change can call it on both the server render and a client-side
// navigation. Null means "not signed in"; nothing here redirects.
export const getSessionIdentity = createServerFn({ method: 'GET' }).handler(
  async (): Promise<SessionIdentity | null> => {
    const session = readRequestSession()

    if (session) {
      return session.identity
    }

    // A request that never ran the middleware (a prerender, a direct server
    // call) still gets one chance to read the cookie session.
    const { identity } = await refreshSession()

    return identity
  },
)

async function refreshSession(): Promise<SessionRefreshResult> {
  try {
    const supabase = createServerSupabaseClient()
    // getUser() also refreshes an expired access token, which is what writes
    // the rotated cookies back to the response.
    const { data, error } = await supabase.auth.getUser()

    if (error) {
      return {
        identity: null,
        // A 401/403 is "no session", not an outage. A missing status or a 5xx
        // is Supabase being unreachable, and is worth reporting.
        error: isSupabaseUnavailable(error) ? error : null,
      }
    }

    return {
      identity: {
        userId: data.user.id,
        email: data.user.email ?? null,
      },
      error: null,
    }
  } catch (cause) {
    return {
      identity: null,
      error: cause instanceof Error ? cause : new Error(String(cause)),
    }
  }
}

function readRequestSession(): SessionRefreshResult | null {
  try {
    const context: { session?: SessionRefreshResult } | undefined =
      getGlobalStartContext()

    return context?.session ?? null
  } catch {
    // No Start request context (called outside a request) — fall through to
    // reading the cookies directly.
    return null
  }
}
