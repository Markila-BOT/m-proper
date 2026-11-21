import { createFileRoute, redirect } from '@tanstack/react-router'

// `/` redirects to the Overview view so no existing entry point breaks:
// the app root, bookmarks, and the acceptance suite's shell.open all land
// on a real route (ADR-0003 — URL as state).
export const Route = createFileRoute('/')({
  beforeLoad: () => {
    throw redirect({ to: '/overview' })
  },
})
