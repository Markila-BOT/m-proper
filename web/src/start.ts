import {
  createCsrfMiddleware,
  createMiddleware,
  createStart,
} from '@tanstack/react-start'

import {
  apiNotFoundResponse,
  shouldAnswerApiNotFound,
} from '#/lib/api/fallback.ts'
import { sessionRefreshMiddleware } from '#/lib/supabase/session'

// `start.ts` is part of TanStack Start's *client* entry as well as the server
// bundle, so every server-only module here is loaded lazily inside the SSR
// guard: a static import would evaluate `node:fs`/`node:url` (server-env) and
// `postgres` (server-config) in the browser and break hydration before React
// mounts. `import.meta.env.SSR` is a build-time constant, so the client never
// fetches these chunks.
//
// Development reads web/.env so `process.env` carries the database URL and the
// auth variables; production reads the platform's environment only. The loader
// does not override a value the shell already exported, and it is the sole
// entry point for this file (imported once, run once).
//
// Refusing to serve without the required server environment runs at module
// initialisation — before Start installs its handler — so a missing value fails
// the invocation (Vercel) or every request (local Vite) instead of one route
// midway through. The error names every absent variable and no value.
if (import.meta.env.SSR) {
  if (import.meta.env.DEV) {
    const { loadServerEnv } = await import('#/lib/server-env.ts')
    loadServerEnv()
  }

  const { assertServerEnv } = await import('#/lib/server-config.ts')
  assertServerEnv()
}

// Server routes only run on an exact match, so an unknown `/api/*` falls
// through to the router's HTML document not-found. This middleware replaces
// that document with the JSON envelope, and leaves a route's own JSON 404
// (a foreign property) untouched.
const apiNotFoundMiddleware = createMiddleware({ type: 'request' }).server(
  async ({ pathname, next }) => {
    const result = await next()

    return shouldAnswerApiNotFound(pathname, result.response)
      ? apiNotFoundResponse()
      : result
  },
)

// The Start server's request pipeline. The session middleware runs before any
// route loads, so an expired access token is refreshed and its rotated cookies
// are written once per document request (design §7).
//
// Defining `startInstance` replaces Start's built-in CSRF protection, so the
// middleware is registered explicitly and no server function ships without
// it. Only server-function calls are validated: a document navigation is a
// plain GET with no Origin header, and the same-origin rule would refuse it.
export const startInstance = createStart(() => ({
  requestMiddleware: [
    sessionRefreshMiddleware,
    createCsrfMiddleware({
      filter: ({ handlerType }) => handlerType === 'serverFn',
    }),
    apiNotFoundMiddleware,
  ],
}))
