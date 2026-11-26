import { createFileRoute, redirect } from '@tanstack/react-router'

import AppShell from '#/components/AppShell'
import { validateReturnPath } from '#/lib/return-path'
import { getSessionIdentity } from '#/lib/supabase/session'

// The authenticated shell (design §7). Every ledger screen hangs off this
// pathless layout, and its `beforeLoad` is the one place the app decides
// whether a visitor may see the shell: the five public auth surfaces are
// siblings outside it, so they are never caught by the guard, and the
// sign-out action is a server function, not a route.
//
// The guard returns the identity so the shell and the header can show the
// signed-in landlord without a second session read.
export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ location }) => {
    const identity = await getSessionIdentity()

    if (!identity) {
      // The visitor is returned here after sign-in. The target is the whole
      // current location, and the one validator decides whether it may be
      // honoured.
      throw redirect({
        to: '/sign-in',
        search: { redirect: validateReturnPath(location.href) },
      })
    }

    return { identity }
  },
  component: AuthenticatedShell,
})

function AuthenticatedShell() {
  // The router's context is the one owner of the query client; the guard's
  // identity rides alongside it. Sign-out is cleaned up through the same
  // client, handed down to the header rather than imported.
  const { identity, queryClient } = Route.useRouteContext()

  return <AppShell identity={identity} queryClient={queryClient} />
}
