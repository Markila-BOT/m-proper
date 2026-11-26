import { createFileRoute } from '@tanstack/react-router'

// Reports is the honest placeholder (ADR-0003): it is reachable by its URL
// so the absence is visible, but the nav does not point at it because it is
// not built. The panel wears the world's paper and hairline and says what
// exists instead — no "coming soon" promise, no card from another product.
export const Route = createFileRoute('/_authenticated/reports')({
  component: ReportsView,
})

function ReportsView() {
  return (
    <div className="space-y-5 px-6 py-6 lg:px-9">
      <header>
        <h1 className="text-[17px] font-bold text-ink">Reports</h1>
      </header>
      <section className="border-y border-rule bg-paper py-6">
        <p className="font-sans text-caption font-semibold uppercase tracking-[0.18em] text-ink-soft">
          Not built
        </p>
        <p className="mt-2 max-w-[60ch] text-pretty text-sm leading-relaxed text-ink">
          Reports is not built yet. This page keeps its address so the gap is
          visible rather than hidden, but there is no report to show.
        </p>
        <p className="mt-2 max-w-[60ch] text-pretty text-sm leading-relaxed text-ink-soft">
          The ledger&apos;s totals, the property register, and the overview
          strip are the record today.
        </p>
      </section>
    </div>
  )
}
