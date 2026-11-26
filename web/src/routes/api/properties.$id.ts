import { createFileRoute } from '@tanstack/react-router'

import { handleDeleteProperty } from '#/lib/api/routes.ts'

// Matched by id and owner together: a foreign row and an unknown id both match
// zero rows and answer the identical 404.
export const Route = createFileRoute('/api/properties/$id')({
  server: {
    handlers: {
      DELETE: ({ request, params }) => handleDeleteProperty(request, params.id),
    },
  },
})
