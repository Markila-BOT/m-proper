// web/src/lib/format.ts
// The one pair of display formatters (the C6 fold): every surface imports
// formatMoney and formatDate from here; nothing re-creates a local copy.
// The stored-string date derivations live here too — localDateString and
// localMonthKey are the pipeline's one source of local truth, so no
// surface ever reaches for toISOString again.
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

// A stored date is a calendar string ('YYYY-MM-DD') — the name of a day on
// the page, not a UTC instant. The bare ISO constructor reads it as UTC
// midnight, which prints the day before everywhere west of UTC; the
// string's own parts construct the local calendar date it names.
export function formatDate(dateString: string): string {
  const [year, month, day] = dateString.split('-').map(Number)
  return dateFormatter.format(new Date(year, month - 1, day))
}

// The local date as the stored calendar string — the form's blank line
// and the export's filename stamp both write this. Derived from local
// parts, never toISOString: whose UTC day is yesterday's page for most
// of a UTC+8 morning, and tomorrow's for a New York evening.
export function localDateString(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// The month a local date belongs to, as the stored string's own bucket
// key ('YYYY-MM'). The current-month check and the trend buckets compare
// this against a stored date's own parts — never toISOString, whose UTC
// month is the previous one at a month's first hours in UTC+8.
export function localMonthKey(date = new Date()): string {
  return localDateString(date).slice(0, 7)
}

// A typed calendar string, read strictly. Only 'YYYY-MM-DD' is a calendar
// date here: the parts construct the LOCAL date the string names (never
// the ISO constructor, never toISOString), and the parts round-trip back
// so overflow days — 2025-02-30, 2025-13-01 — are rejected rather than
// silently rolled into March.
const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/

export function parseCalendarDate(text: string): Date | null {
  if (!CALENDAR_DATE.test(text)) return null
  const [year, month, day] = text.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  const roundTrips =
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  return roundTrips ? date : null
}

export type CalendarDateIssue = 'required' | 'invalid' | 'before' | 'after'

// Why a typed calendar string cannot be stored, or null when it can. The
// pickers turn the issue into a message that names the problem and the
// recovery; the stored value never changes on an issue.
export function calendarDateIssue(
  text: string,
  {
    required = false,
    min,
    max,
  }: { required?: boolean; min?: string; max?: string } = {},
): CalendarDateIssue | null {
  if (text === '') return required ? 'required' : null
  if (!parseCalendarDate(text)) return 'invalid'
  if (min && text < min) return 'before'
  if (max && text > max) return 'after'
  return null
}
