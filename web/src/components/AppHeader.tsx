// web/src/components/AppHeader.tsx
// The passbook shell's top rule: the product's name set with quiet
// confidence in ink, the export control disclosing the slice it writes
// (the displayed ledger while filters narrow it, all entries at rest),
// and "+ Add transaction" as the one primary control. The data flow is
// one store deep — export writes the displayed slice the Transactions
// page shows, and the control now says so.
//
// The name is a link home, not a heading: each route's title is the
// page's one h1, so the landmarks stay clean.
//
// Below the lg breakpoint the rule composes as a masthead block: the name,
// the quiet disclosure control, then the primary control full-width —
// nothing clips, and the labels keep their words. At lg the rule is one
// line, exactly the desktop passbook header.
import { Link } from '@tanstack/react-router'
import type { Ref } from 'react'

type AppHeaderProps = {
  exportScopeLabel: string
  onExport: () => void
  onAddTransaction: () => void
  // The dialog's focus-return target (7.3): the trigger keeps the ref the
  // root's close handler focuses.
  addTriggerRef: Ref<HTMLButtonElement>
}

export default function AppHeader({
  exportScopeLabel,
  onExport,
  onAddTransaction,
  addTriggerRef,
}: AppHeaderProps) {
  return (
    <header className="border-b border-rule bg-paper">
      <div className="flex flex-col gap-y-2.5 px-6 py-2.5 lg:h-14 lg:flex-row lg:items-center lg:justify-between lg:gap-x-2 lg:px-9 lg:py-0">
        <Link
          to="/overview"
          className="self-start text-[17px] font-bold tracking-[0.01em] text-ink focus-visible:outline-2 focus-visible:outline-print lg:mr-auto"
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
      </div>
    </header>
  )
}
