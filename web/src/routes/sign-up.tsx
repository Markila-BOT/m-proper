import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'

import AuthPage, {
  AuthField,
  AUTH_LINK_CLASS,
  AuthMessage,
  AuthSubmit,
} from '#/components/auth/AuthPage'
import { signUp } from '#/lib/supabase/auth'

// Sign-up (design §1). The account is created but cannot sign in until the
// confirmation link is used. A duplicate address answers exactly like a new
// one — the server ignores the "user without identities" signal Supabase
// returns for an existing address, so this page has no branch that could
// reveal one.
export const Route = createFileRoute('/sign-up')({
  component: SignUpView,
})

const CHECK_EMAIL_MESSAGE =
  "Check your email for a confirmation link. You'll be able to sign in once the address is confirmed."
const WEAK_PASSWORD_MESSAGE =
  'Choose a longer password — at least 8 characters.'
const UNAVAILABLE_MESSAGE =
  "We couldn't reach the sign-up service. Try again in a moment."
const GENERIC_MESSAGE = "We couldn't create the account. Try again."

function SignUpView() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (isSubmitting) return

    setIsSubmitting(true)
    setMessage(null)

    try {
      const result = await signUp({ data: { email, password } })

      if (result.status === 'ok') {
        setIsSubmitted(true)
        return
      }

      if (result.status === 'weak_password') {
        setMessage(WEAK_PASSWORD_MESSAGE)
      } else if (result.status === 'unavailable') {
        setMessage(UNAVAILABLE_MESSAGE)
      } else {
        setMessage(GENERIC_MESSAGE)
      }
    } catch {
      setMessage(UNAVAILABLE_MESSAGE)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthPage
      title="Create an account"
      description="Your portfolio belongs to this account alone — no one else can see it."
    >
      {isSubmitted ? (
        <div className="space-y-4">
          <AuthMessage tone="status">{CHECK_EMAIL_MESSAGE}</AuthMessage>
          <p className="text-sm text-ink-soft">
            <Link className={AUTH_LINK_CLASS} to="/sign-in">
              Back to sign in
            </Link>
          </p>
        </div>
      ) : (
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
            autoComplete="new-password"
            required
            minLength={8}
            hint="At least 8 characters."
            disabled={isSubmitting}
          />

          {message && <AuthMessage tone="error">{message}</AuthMessage>}

          <AuthSubmit disabled={isSubmitting}>
            {isSubmitting ? 'Creating your account…' : 'Create account'}
          </AuthSubmit>
        </form>
      )}

      <p className="border-t border-rule pt-4 text-sm text-ink-soft">
        Already have an account?{' '}
        <Link className={AUTH_LINK_CLASS} to="/sign-in">
          Sign in
        </Link>
      </p>
    </AuthPage>
  )
}
