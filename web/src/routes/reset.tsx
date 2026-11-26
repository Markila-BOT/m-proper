import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'

import AuthPage, {
  AuthField,
  AUTH_LINK_CLASS,
  AuthMessage,
  AuthSubmit,
} from '#/components/auth/AuthPage'
import { requestPasswordReset } from '#/lib/supabase/auth'

// The reset request (design §1). One sentence answers a known address, an
// unknown address, and a send that failed inside Supabase, so the page
// cannot be used to ask whether an account exists.
export const Route = createFileRoute('/reset')({
  component: ResetView,
})

const GENERIC_MESSAGE =
  'If that address has an account, a reset link is on its way. Open it to choose a new password.'
const UNAVAILABLE_MESSAGE =
  "We couldn't reach the reset service. Try again in a moment."

function ResetView() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (isSubmitting) return

    setIsSubmitting(true)
    setMessage(null)

    try {
      await requestPasswordReset({ data: { email } })
      setMessage(GENERIC_MESSAGE)
    } catch {
      setMessage(UNAVAILABLE_MESSAGE)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthPage
      title="Reset your password"
      description="Enter the email for your landlord account and we'll send a link to choose a new password."
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

        {message && <AuthMessage tone="status">{message}</AuthMessage>}

        <AuthSubmit disabled={isSubmitting}>
          {isSubmitting ? 'Sending…' : 'Send reset link'}
        </AuthSubmit>
      </form>

      <p className="border-t border-rule pt-4 text-sm text-ink-soft">
        <Link className={AUTH_LINK_CLASS} to="/sign-in">
          Back to sign in
        </Link>
      </p>
    </AuthPage>
  )
}
