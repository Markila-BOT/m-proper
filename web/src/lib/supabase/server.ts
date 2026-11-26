import { createServerClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  getCookies,
  setCookie,
  setResponseHeader,
} from '@tanstack/react-start/server'

import { readSupabaseConfig } from './config'

// The server's Supabase client. Start owns the cookie lifecycle: the incoming
// request cookies seed the session and `setAll` writes rotated tokens back to
// the outgoing response, so a refresh survives the request.
export type SupabaseServerClient = SupabaseClient

// Always create a fresh client per request. @supabase/ssr documents that a
// shared client leaves later responses without the cache headers a cookie
// write must carry.
export function createServerSupabaseClient(): SupabaseServerClient {
  const { url, publishableKey } = readSupabaseConfig()

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        // Start parses the request's Cookie header into a name/value record.
        return Object.entries(getCookies()).map(([name, value]) => ({
          name,
          value,
        }))
      },
      setAll(cookiesToSet, headers) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            setCookie(name, value, options)
          }
          // Auth cookie writes must not be cached by a CDN or proxy, or one
          // landlord's session could be served to another.
          for (const [name, value] of Object.entries(headers)) {
            setResponseHeader(name, value)
          }
        } catch {
          // The response may already be streaming — a route component or a
          // late refresh can call this after the headers are sent. The token
          // rotation is then lost for this response; the next request
          // refreshes again, which is the documented, safe failure.
        }
      },
    },
  })
}
