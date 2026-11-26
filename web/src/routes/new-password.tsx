import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'

import AuthPage, {
  AuthField,
  AUTH_LINK_CLASS,
  AuthMessage,
  AuthSubmit,
} from '#/components/auth/AuthPage'
import { validateReturnPath } from '#/lib/return-path'
import { startRecovery, updatePassword } from '#/lib/supabase/auth'

// The recovery link's landing page (design §1). Opening the link establishes
// a recovery session in cookies, then the form updates the password. An
// expired or already-used link gets the same recovery path as a failed
// confirmation: back to the reset request, then back to sign-in.
export const Route = createFileRoute('/new-password')({
  validateSearch: (
    search: Record<string, unknown>,
  ): {
    code?: string
    token_hash?: string
    redirect?: string
    error?: string
  } => ({
    code: asString(search.code),
    token_hash: asString(search.token_hash),
    redirect: asString(search.redirect),
    error: asString(search.error),
  }),
  component: NewPasswordView,
})

const INVALID_LINK_MESSAGE =
  'This password reset link is invalid or has expired. Request a new one.'
const WEAK_PASSWORD_MESSAGE =
  'Choose a longer password — at least 8 characters.'
const UNAVAILABLE_MESSAGE =
  "We couldn't reach the password service. Try again in a moment."

type LinkState = 'working' | 'ready' | 'invalid' | 'unavailable'

function NewPasswordView() {
  const { code, token_hash: tokenHash, redirect, error } = Route.useSearch()

  const [linkState, setLinkState] = useState<LinkState>(() => {
    if (error) return 'invalid'
    if (code || tokenHash) return 'working'
    return 'ready'
  })

  const [password, setPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // One exchange per arrival: it is what puts the recovery session in the
  // cookies the update will use.
  const started = useRef(false)

  useEffect(() => {
    if (started.current || (!code && !tokenHash)) return
    started.current = true

    void startRecovery({ data: { code, tokenHash } })
      .then((result) => {
        setLinkState(
          result.status === 'ok'
            ? 'ready'
            : result.status === 'unavailable'
              ? 'unavailable'
              : 'invalid',
        )
      })
      .catch(() => setLinkState('unavailable'))
  }, [code, tokenHash])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (isSubmitting) return

    setIsSubmitting(true)
    setMessage(null)

    try {
      const result = await updatePassword({ data: { password } })

      if (result.status === 'ok') {
        window.location.assign(validateReturnPath(redirect))
        return
      }

      if (result.status === 'weak_password') {
        setMessage(WEAK_PASSWORD_MESSAGE)
      } else if (result.status === 'no_session') {
        // The recovery session is gone; the invalid-link copy already names
        // the way back.
        setLinkState('invalid')
        setMessage(null)
      } else {
        setMessage(UNAVAILABLE_MESSAGE)
      }
    } catch {
      setMessage(UNAVAILABLE_MESSAGE)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthPage
      title="Choose a new password"
      description="Setting a new password also ends the recovery link."
    >
      {linkState === 'working' && (
        <AuthMessage tone="status">Opening your reset link…</AuthMessage>
      )}

      {(linkState === 'invalid' || linkState === 'unavailable') && (
        <div className="space-y-4">
          <AuthMessage tone="error">
            {linkState === 'invalid'
              ? INVALID_LINK_MESSAGE
              : UNAVAILABLE_MESSAGE}
          </AuthMessage>
          <p className="text-sm text-ink-soft">
            <Link className={AUTH_LINK_CLASS} to="/reset">
              Request a new reset link
            </Link>
          </p>
          <p className="text-sm text-ink-soft">
            <Link className={AUTH_LINK_CLASS} to="/sign-in">
              Back to sign in
            </Link>
          </p>
        </div>
      )}

      {linkState === 'ready' && (
        <form className="space-y-4" onSubmit={handleSubmit}>
          <AuthField
            id="password"
            label="New password"
            type="password"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            required
            minLength={8}
            hint="At least 8 characters."
            disabled={isSubmitting}
          />

          {message && <AuthMessage tone="error">{message}</AuthMessage>}

          <AuthSubmit disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Set new password'}
          </AuthSubmit>
        </form>
      )}
    </AuthPage>
  )
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}
