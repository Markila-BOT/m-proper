import { createFileRoute } from '@tanstack/react-router'

import {
  handleCreateProperty,
  handleDeleteWithoutId,
  handleListProperties,
} from '#/lib/api/routes.ts'

// The HTTP contract, unchanged from the Rust service: same paths, envelope and
// status codes. A distinctive DELETE handler keeps the no-id 400 envelope.
export const Route = createFileRoute('/api/properties')({
  server: {
    handlers: {
      GET: ({ request }) => handleListProperties(request),
      POST: ({ request }) => handleCreateProperty(request),
      DELETE: ({ request }) => handleDeleteWithoutId(request),
    },
  },
})
