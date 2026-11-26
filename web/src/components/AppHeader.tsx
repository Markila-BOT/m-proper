// web/src/components/AppHeader.tsx
// The passbook shell's top rule: the product's name set with quiet
// confidence in ink, the export control disclosing the slice it writes
// (the displayed ledger while filters narrow it, all entries at rest),
// "+ Add transaction" as the one primary control, and — since accounts
// exist — the signed-in landlord's email and the one way out.
//
// Sign-out goes through `signOutEverywhere()`: the shared browser state —
// the query cache, the property store, the filter store — is cleared there
// before the server function ends the session, so this control never grows
// a second cleanup path.
//
// The name is a link home, not a heading: each route's title is the
// page's one h1, so the landmarks stay clean.
//
// The header is the top row of the shell's glass chrome pane (ADR-0004): it
// paints no tint of its own — the pane under it is the material — and carries
// only chrome text, so no record text ever lands on glass.
//
// Below the lg breakpoint the rule composes as a masthead block: the name,
// the quiet disclosure control, then the primary control full-width —
// nothing clips, and the labels keep their words. At lg the rule is one
// line, exactly the desktop passbook header.
import { useState } from 'react'
import type { Ref } from 'react'
import type { QueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'

import { signOutEverywhere } from '../lib/supabase/sign-out'

type AppHeaderProps = {
  // The signed-in landlord, as the guard read it. Null when the Auth record
  // carries no email; the control still says the browser is signed in.
  email: string | null
  // The router's query client, from the route context: sign-out clears the
  // cached properties and derived queries through it (design §6). It is
  // passed, never imported, because the client belongs to the router
  // instance.
  queryClient: QueryClient
  exportScopeLabel: string
  onExport: () => void
  onAddTransaction: () => void
  // The dialog's focus-return target (7.3): the trigger keeps the ref the
  // shell's close handler focuses.
  addTriggerRef: Ref<HTMLButtonElement>
}

const SIGN_OUT_FAILED_MESSAGE = "Couldn't sign out. Try again."

export default function AppHeader({
  email,
  queryClient,
  exportScopeLabel,
  onExport,
  onAddTransaction,
  addTriggerRef,
}: AppHeaderProps) {
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [signOutFailed, setSignOutFailed] = useState(false)

  const handleSignOut = async () => {
    if (isSigningOut) return

    setIsSigningOut(true)
    setSignOutFailed(false)

    try {
      await signOutEverywhere({ queryClient })
    } catch {
      // The clear ran before the request, so nothing cached survives it;
      // but the cookies were not ended, so this stays on the page and says
      // so rather than sending the landlord to a sign-in screen that
      // pretends the session is gone.
      setIsSigningOut(false)
      setSignOutFailed(true)
      return
    }

    // A document load, not a client navigation: the guard must read the
    // cleared cookies on the server and no shell data may linger.
    window.location.assign('/sign-in')
  }

  return (
    <header className="border-b border-rule">
      <div className="flex flex-col gap-y-2.5 px-6 py-2.5 lg:h-14 lg:flex-row lg:items-center lg:justify-between lg:gap-x-2 lg:px-9 lg:py-0">
        <Link
          to="/overview"
          className="self-center text-[17px] font-bold tracking-[0.01em] text-ink focus-visible:outline-2 focus-visible:outline-print lg:mr-auto"
        >
          Landlord Ledger
        </Link>

        <button
          type="button"
          onClick={onExport}
          className="self-start rounded-[2px] px-3 py-2 text-sm font-semibold text-ink-soft transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-print lg:self-auto"
        >
          Export CSV · {exportScopeLabel}
        </button>

        {/* The one primary control. Below lg the masthead stacks it
            full-width, and a thumb reaches for it — so it carries the
            sheet's 44px touch standard there (height, not icon growth);
            at lg it returns to the 36px control line. */}
        <button
          ref={addTriggerRef}
          type="button"
          onClick={onAddTransaction}
          className="h-11 w-full rounded-[2px] bg-ink px-4 text-sm font-semibold text-paper transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-print lg:h-9 lg:w-auto"
        >
          + Add transaction
        </button>

        {/* Who this ledger belongs to, and the way out. The email is chrome
            text, so it sits in ink-soft; a failed sign-out takes the same
            slot in stamp red rather than adding a second line to the rule. */}
        <div className="flex items-center justify-between gap-x-3 self-stretch lg:self-auto">
          <p
            role={signOutFailed ? 'alert' : undefined}
            title={signOutFailed ? undefined : (email ?? undefined)}
            className={
              signOutFailed
                ? 'min-w-0 truncate text-sm text-stamp'
                : 'min-w-0 max-w-[22ch] truncate text-sm text-ink-soft'
            }
          >
            {signOutFailed ? SIGN_OUT_FAILED_MESSAGE : (email ?? 'Signed in')}
          </p>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="rounded-[2px] px-3 py-2 text-sm font-semibold text-ink-soft transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-print disabled:opacity-60"
          >
            {isSigningOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </div>
    </header>
  )
}
