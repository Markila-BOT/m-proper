import { useEffect, useRef, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'

import AuthPage, {
  AUTH_LINK_CLASS,
  AuthMessage,
} from '#/components/auth/AuthPage'
import { validateReturnPath } from '#/lib/return-path'
import { confirmEmail } from '#/lib/supabase/auth'

// The confirmation link's landing page (design §1). Supabase may deliver a
// PKCE `code` or a `token_hash`; both are handed to the same server function,
// which establishes the session in cookies. On success the visitor lands on
// the validated return target — the guard never sees an unconfirmed session.
export const Route = createFileRoute('/confirm')({
  validateSearch: (
    search: Record<string, unknown>,
  ): {
    code?: string
    token_hash?: string
    type?: string
    redirect?: string
    error?: string
  } => ({
    code: asString(search.code),
    token_hash: asString(search.token_hash),
    type: asString(search.type),
    redirect: asString(search.redirect),
    error: asString(search.error),
  }),
  component: ConfirmView,
})

const INVALID_MESSAGE =
  'This confirmation link is invalid or has expired. Sign in with the address to request a new confirmation email.'
const UNAVAILABLE_MESSAGE =
  "We couldn't confirm the link right now. Reload this page to try again."

type Status = 'working' | 'invalid' | 'unavailable'

function ConfirmView() {
  const {
    code,
    token_hash: tokenHash,
    type,
    redirect,
    error,
  } = Route.useSearch()

  const [status, setStatus] = useState<Status>(() => {
    if (error) return 'invalid'
    if (code || tokenHash) return 'working'
    return 'invalid'
  })

  // The exchange must run once: it writes the session cookies, and a second
  // call would consume an already-used link.
  const started = useRef(false)

  useEffect(() => {
    if (started.current || (!code && !tokenHash)) return
    started.current = true

    void confirmEmail({ data: { code, tokenHash, type } })
      .then((result) => {
        if (result.status === 'ok') {
          window.location.replace(validateReturnPath(redirect))
          return
        }

        setStatus(result.status === 'unavailable' ? 'unavailable' : 'invalid')
      })
      .catch(() => setStatus('unavailable'))
  }, [code, tokenHash, type, redirect])

  return (
    <AuthPage title="Confirm your email">
      {status === 'working' && (
        <AuthMessage tone="status">Confirming…</AuthMessage>
      )}

      {status === 'invalid' && (
        <div className="space-y-4">
          <AuthMessage tone="error">{INVALID_MESSAGE}</AuthMessage>
          <p className="text-sm text-ink-soft">
            <Link
              className={AUTH_LINK_CLASS}
              to="/sign-in"
              search={{ redirect: validateReturnPath(redirect) }}
            >
              Go to sign in
            </Link>
          </p>
        </div>
      )}

      {status === 'unavailable' && (
        <div className="space-y-4">
          <AuthMessage tone="error">{UNAVAILABLE_MESSAGE}</AuthMessage>
          <p className="text-sm text-ink-soft">
            <Link className={AUTH_LINK_CLASS} to="/sign-in">
              Go to sign in
            </Link>
          </p>
        </div>
      )}
    </AuthPage>
  )
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}
