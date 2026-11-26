import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

// The public surfaces' frame (design §1, §7). These pages render outside the
// signed-in shell, so they carry the passbook's opening page themselves: the
// head rule, the printed column, the closing note. No glass — glass paints
// only where chrome floats over the page, and nothing floats here.
//
// The world's own vocabulary does the work: caption-uppercase labels, 2px
// squared fields ruled in print, one ink primary, and stamp red held out for
// rejections.

type AuthPageProps = {
  title: string
  description?: string
  children: ReactNode
}

export default function AuthPage({
  title,
  description,
  children,
}: AuthPageProps) {
  return (
    <main className="flex min-h-screen flex-col bg-paper text-ink">
      <div className="mx-auto flex w-full max-w-[72rem] flex-1 flex-col px-6 sm:px-9">
        <header className="flex items-baseline justify-between border-b border-rule py-5">
          <p className="text-caption font-semibold uppercase tracking-[0.18em] text-ink">
            Landlord Ledger
          </p>
          <p className="hidden font-mono text-[11px] font-medium tracking-[0.10em] text-ink-faint sm:block">
            Property income &amp; expenses
          </p>
        </header>

        <div className="flex flex-1 flex-col justify-start py-8 sm:justify-center sm:py-14">
          <section className="w-full max-w-[26rem] self-center">
            <h1 className="text-[17px] font-bold tracking-[0.01em] text-ink">
              {title}
            </h1>
            {description && (
              <p className="mt-2 text-pretty text-sm leading-relaxed text-ink-soft">
                {description}
              </p>
            )}
            {/* The paper panel: a hairline-ruled block on the page, not a card.
                It has no shadow and no radius to speak of — the same printed
                field the ledger draws, at page scale, so the form reads as a
                form on a passbook page rather than as a floating box. */}
            <div className="mt-6 rounded-[2px] border border-rule px-5 py-6 sm:px-6">
              <div className="space-y-5">{children}</div>
            </div>
          </section>
        </div>

        <footer className="border-t border-rule py-4">
          <p className="font-mono text-[11px] leading-relaxed tracking-[0.05em] text-ink-faint">
            Your records live in your own Postgres, exportable at any time.
          </p>
        </footer>
      </div>
    </main>
  )
}

type AuthFieldProps = {
  id: string
  label: string
  type?: 'email' | 'password' | 'text'
  value: string
  onChange: (value: string) => void
  autoComplete?: string
  hint?: string
  required?: boolean
  minLength?: number
  disabled?: boolean
}

// One printed field: caption label, a 2px-squared rule, and the print ring on
// focus. The hint sits under the rule in the faintest ink so it never competes
// with the value the landlord is typing.
export function AuthField({
  id,
  label,
  type = 'text',
  value,
  onChange,
  autoComplete,
  hint,
  required,
  minLength,
  disabled,
}: AuthFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined

  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="block text-caption font-semibold uppercase tracking-[0.14em] text-ink-soft"
      >
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        aria-describedby={hintId}
        required={required}
        minLength={minLength}
        disabled={disabled}
        className={cn(
          'h-[2.25rem] w-full rounded-[2px] border border-rule bg-paper px-3 text-sm text-ink',
          'placeholder:text-ink-faint',
          'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-print',
          'disabled:cursor-not-allowed disabled:opacity-60',
        )}
      />
      {hint && (
        <p id={hintId} className="text-xs leading-relaxed text-ink-faint">
          {hint}
        </p>
      )}
    </div>
  )
}

type AuthMessageProps = {
  tone: 'error' | 'status'
  children: ReactNode
}

// Errors are named by this app, never copied from a response: the server
// functions answer with a status and each page owns its own words.
//
// A rejection wears the world's one stamp (see The Stamp Rule): uppercase mono,
// bordered, never a tint. A status is the page talking, so it takes the
// ordinary rule and the print wash instead.
export function AuthMessage({ tone, children }: AuthMessageProps) {
  if (tone === 'error') {
    return (
      <p
        role="alert"
        className="rounded-[2px] border-[1.5px] border-stamp bg-paper px-3 py-2.5 font-mono text-[11px] font-bold uppercase leading-relaxed tracking-[0.14em] text-stamp"
      >
        {children}
      </p>
    )
  }

  return (
    <p
      role="status"
      className="rounded-[2px] border border-rule bg-print-wash px-3 py-2.5 text-sm leading-relaxed text-ink"
    >
      {children}
    </p>
  )
}

// The one ink control on an auth page. It prints its state in words rather
// than spinning: the world has no spinner, and "Signing in…" says what is
// happening without inventing motion.
export function AuthSubmit({
  disabled,
  children,
}: {
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className={cn(
        'h-[2.25rem] w-full rounded-[2px] bg-ink px-4 text-sm font-semibold text-paper',
        'hover:bg-ink/90',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-print',
        'disabled:cursor-not-allowed disabled:opacity-60',
      )}
    >
      {children}
    </button>
  )
}

// A quiet action beside a message — the resend control. Hairline rule, ink-soft
// label that deepens on hover, never a second loud button on the page.
export function AuthSecondary({
  onClick,
  disabled,
  children,
}: {
  onClick?: () => void
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'h-[2.25rem] rounded-[2px] border border-rule bg-paper px-3 text-sm font-semibold text-ink-soft',
        'hover:bg-print-wash hover:text-ink',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-print',
        'disabled:cursor-not-allowed disabled:opacity-60',
      )}
    >
      {children}
    </button>
  )
}

// The world's link: ink over a 1px print underline at 3px, print green on
// hover. Exported as a class rather than a component so every route keeps
// TanStack's typed `<Link>` (its `to` union is route-specific).
export const AUTH_LINK_CLASS =
  'text-ink underline decoration-print decoration-1 underline-offset-[3px] hover:text-print focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-print'
