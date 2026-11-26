import { createFileRoute, redirect } from '@tanstack/react-router'

// `/` redirects to the Overview view so no existing entry point breaks:
// the app root, bookmarks, and the acceptance suite's shell.open all land
// on a real route (ADR-0003 — URL as state). The route sits inside the
// authenticated layout, so the shell guard runs first: a signed-out visitor
// is sent to sign in with `/` as the return target, not `/overview`.
export const Route = createFileRoute('/_authenticated/')({
  beforeLoad: () => {
    throw redirect({ to: '/overview' })
  },
})
