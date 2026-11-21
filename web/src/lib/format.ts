// web/src/lib/format.ts
// The one pair of display formatters (the C6 fold): every surface imports
// formatMoney and formatDate from here; nothing re-creates a local copy.
//
// Money is PHP with exactly two fraction digits everywhere — the sidebar's
// zero-digit variant is retired deliberately, and tabular-nums is applied at
// the surface (monospace figures belong to the ledger's print idiom, not to
// this pure formatter).

const moneyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
})

export function formatMoney(amount: number): string {
  return moneyFormatter.format(amount)
}

export function formatDate(dateString: string): string {
  return dateFormatter.format(new Date(dateString))
}
