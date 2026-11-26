import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'

import AuthPage, {
  AuthField,
  AUTH_LINK_CLASS,
  AuthMessage,
  AuthSecondary,
  AuthSubmit,
} from '#/components/auth/AuthPage'
import { validateReturnPath } from '#/lib/return-path'
import { resendConfirmation, signIn } from '#/lib/supabase/auth'

// Sign-in (design §1). A signed-in visitor who opens this page is left on
// the form rather than bounced: the public routes never read the session, so
// there is no redirect loop through a tampered or self-referential return
// target, and the header is one click away. A successful sign-in returns to
// the guard's validated target.
export const Route = createFileRoute('/sign-in')({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
    // Anything that is not a string is dropped here; the path itself is
    // validated by the one shared rule at the moment it is used.
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
  }),
  component: SignInView,
})

const INVALID_CREDENTIALS_MESSAGE = 'Email or password is incorrect.'
const UNCONFIRMED_MESSAGE =
  'That address has not been confirmed yet. Open the confirmation link we sent you, then sign in.'
const UNAVAILABLE_MESSAGE =
  "We couldn't reach the sign-in service. Try again in a moment."
const RESEND_MESSAGE =
  'If that address is waiting for confirmation, a new link is on its way.'
const RESEND_FAILED_MESSAGE =
  "We couldn't resend the confirmation email. Try again in a moment."

type Message = { tone: 'error' | 'status'; text: string }

function SignInView() {
  const { redirect } = Route.useSearch()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState<Message | null>(null)
  const [needsConfirmation, setNeedsConfirmation] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isResending, setIsResending] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (isSubmitting) return

    setIsSubmitting(true)
    setMessage(null)
    setNeedsConfirmation(false)

    try {
      const result = await signIn({ data: { email, password } })

      if (result.status === 'ok') {
        // The session cookies were written by the server function's
        // response; a document load picks them up and the guard lets the
        // validated target through.
        window.location.assign(validateReturnPath(redirect))
        return
      }

      if (result.status === 'email_not_confirmed') {
        setNeedsConfirmation(true)
        setMessage({ tone: 'error', text: UNCONFIRMED_MESSAGE })
      } else if (result.status === 'unavailable') {
        setMessage({ tone: 'error', text: UNAVAILABLE_MESSAGE })
      } else {
        setMessage({ tone: 'error', text: INVALID_CREDENTIALS_MESSAGE })
      }
    } catch {
      setMessage({ tone: 'error', text: UNAVAILABLE_MESSAGE })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResend = async () => {
    if (isResending) return

    setIsResending(true)

    try {
      await resendConfirmation({ data: { email } })
      setMessage({ tone: 'status', text: RESEND_MESSAGE })
    } catch {
      setMessage({ tone: 'error', text: RESEND_FAILED_MESSAGE })
    } finally {
      setIsResending(false)
    }
  }

  return (
    <AuthPage
      title="Sign in"
      description="Use the email and password for your landlord account."
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <AuthField
          id="email"
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          required
          disabled={isSubmitting}
        />
        <AuthField
          id="password"
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          required
          disabled={isSubmitting}
        />

        {message && (
          <AuthMessage tone={message.tone}>{message.text}</AuthMessage>
        )}

        {needsConfirmation && (
          <AuthSecondary
            onClick={handleResend}
            disabled={isResending || !email}
          >
            {isResending ? 'Resending…' : 'Resend the confirmation email'}
          </AuthSecondary>
        )}

        <AuthSubmit disabled={isSubmitting}>
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </AuthSubmit>
      </form>

      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 border-t border-rule pt-4 text-sm">
        <Link className={AUTH_LINK_CLASS} to="/sign-up">
          Create an account
        </Link>
        <Link className={AUTH_LINK_CLASS} to="/reset">
          Forgot your password?
        </Link>
      </div>
    </AuthPage>
  )
}
