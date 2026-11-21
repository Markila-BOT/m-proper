// web/src/components/AppHeader.tsx
// The passbook shell's top rule: the product's name set with quiet
// confidence in ink, the export control quiet, and "+ Add transaction" as
// the one primary control. The data flow is unchanged — export writes the
// selected property scope's transactions to CSV.
type AppHeaderProps = {
  onExport: () => void
  onAddTransaction: () => void
}

export default function AppHeader({
  onExport,
  onAddTransaction,
}: AppHeaderProps) {
  return (
    <header className="border-b border-rule bg-paper">
      <div className="flex h-14 items-center justify-between gap-6 px-6 lg:px-9">
        <h1 className="text-[17px] font-bold tracking-[0.01em] text-ink">
          Landlord Ledger
        </h1>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onExport}
            className="rounded-[2px] px-3 py-2 text-sm font-semibold text-ink-soft transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-print"
          >
            Export CSV
          </button>

          <button
            type="button"
            onClick={onAddTransaction}
            className="h-9 rounded-[2px] bg-ink px-4 text-sm font-semibold text-paper transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-print"
          >
            + Add transaction
          </button>
        </div>
      </div>
    </header>
  )
}
