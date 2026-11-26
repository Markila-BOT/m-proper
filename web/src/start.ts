import { createCsrfMiddleware, createStart } from '@tanstack/react-start'

import { sessionRefreshMiddleware } from '#/lib/supabase/session'

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
  ],
}))
