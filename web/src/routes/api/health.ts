import { createFileRoute } from '@tanstack/react-router'

import { handleHealth } from '#/lib/api/health.ts'

// Database readiness, not liveness (design §8). No identity: a probe must be
// able to answer before a caller can hold a session.
export const Route = createFileRoute('/api/health')({
  server: {
    handlers: {
      GET: () => handleHealth(),
    },
  },
})
