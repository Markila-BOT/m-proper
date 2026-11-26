import { createServerFn } from '@tanstack/react-start'
import { getRequestUrl } from '@tanstack/react-start/server'
import type { EmailOtpType } from '@supabase/supabase-js'

import {
  optionalString,
  parseLinkPayload,
  requireString,
} from '../auth-payload'
import type { LinkPayload } from '../auth-payload'
import { isAuthSessionMissing, isSupabaseUnavailable } from './errors'
import { createServerSupabaseClient } from './server'

// The auth mutations. Every write runs on the Start server because that is
// where the cookie session lives: a password, a code, or a token hash never
// needs to leave the server, and the browser keeps only the publishable key
// (design §1, §10). Each handler answers with a small status the form can map
// to its own words — a Supabase error string never reaches the UI.

export type SignInStatus =
  'ok' | 'email_not_confirmed' | 'invalid_credentials' | 'unavailable'

export type SignUpStatus = 'ok' | 'weak_password' | 'unavailable' | 'error'

export type UpdatePasswordStatus =
  'ok' | 'weak_password' | 'no_session' | 'unavailable' | 'error'

export type LinkStatus = 'ok' | 'invalid_link' | 'unavailable'

export interface SignInResult {
  status: SignInStatus
}

export interface SignUpResult {
  status: SignUpStatus
}

export interface UpdatePasswordResult {
  status: UpdatePasswordStatus
}

export interface LinkResult {
  status: LinkStatus
}

export interface SignOutResult {
  status: 'ok' | 'unavailable'
}

export interface ResetRequestResult {
  status: 'ok'
}

// Password reset and confirmation resend deliberately answer the same thing
// for a known and an unknown address, including when the Auth server cannot
// be reached at all: the sentence must not be a probe for which addresses
// exist (authentication spec, "Password reset does not enumerate accounts").
export interface GenericResult {
  status: 'ok'
}

export const signIn = createServerFn({ method: 'POST' })
  .validator((data: unknown): { email: string; password: string } => ({
    email: requireString(data, 'email').trim(),
    password: requireString(data, 'password'),
  }))
  .handler(async ({ data }): Promise<SignInResult> => {
    if (!data.email || !data.password) {
      // An empty field is a refused credential like any other; it is not a
      // reason to tell the visitor which field the server disliked.
      return { status: 'invalid_credentials' }
    }

    const supabase = createServerSupabaseClient()
    const { error } = await supabase.auth.signInWithPassword(data)

    if (!error) {
      return { status: 'ok' }
    }

    if (error.code === 'email_not_confirmed') {
      return { status: 'email_not_confirmed' }
    }

    if (isSupabaseUnavailable(error)) {
      return { status: 'unavailable' }
    }

    // Wrong password and unknown address share one answer on purpose.
    return { status: 'invalid_credentials' }
  })

export const signUp = createServerFn({ method: 'POST' })
  .validator((data: unknown): { email: string; password: string } => ({
    email: requireString(data, 'email').trim(),
    password: requireString(data, 'password'),
  }))
  .handler(async ({ data }): Promise<SignUpResult> => {
    if (!data.email || !data.password) {
      return { status: 'error' }
    }

    const supabase = createServerSupabaseClient()
    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: { emailRedirectTo: `${requestOrigin()}/confirm` },
    })

    if (!error) {
      // Supabase answers a duplicate address without an error (the user
      // carries no identities) when confirmation is on, so this branch and
      // the duplicate branch say exactly the same thing to the visitor.
      return { status: 'ok' }
    }

    if (error.code === 'user_already_exists' || error.code === 'email_exists') {
      // A project that reports the duplicate instead of answering softly
      // still gets the soft answer here: the form must not become a way to
      // ask whether an address is registered.
      return { status: 'ok' }
    }

    if (error.code === 'weak_password') {
      return { status: 'weak_password' }
    }

    if (isSupabaseUnavailable(error)) {
      return { status: 'unavailable' }
    }

    return { status: 'error' }
  })

export const signOut = createServerFn({ method: 'POST' }).handler(
  async (): Promise<SignOutResult> => {
    const supabase = createServerSupabaseClient()
    const { error } = await supabase.auth.signOut()

    if (!error) {
      return { status: 'ok' }
    }

    if (isSupabaseUnavailable(error)) {
      // The refresh token may not have been revoked, but the visitor asked
      // to leave; the local cookies are cleared either way so this browser
      // is signed out.
      await supabase.auth.signOut({ scope: 'local' })
      return { status: 'unavailable' }
    }

    return { status: 'ok' }
  },
)

export const requestPasswordReset = createServerFn({ method: 'POST' })
  .validator((data: unknown): { email: string } => ({
    email: requireString(data, 'email').trim(),
  }))
  .handler(async ({ data }): Promise<ResetRequestResult> => {
    if (!data.email) {
      return { status: 'ok' }
    }

    const supabase = createServerSupabaseClient()

    try {
      await supabase.auth.resetPasswordForEmail(data.email, {
        redirectTo: `${requestOrigin()}/new-password`,
      })
    } catch {
      // Deliberately silent: the answer is the same sentence whatever the
      // address is and whether or not the mail was sent.
    }

    return { status: 'ok' }
  })

export const resendConfirmation = createServerFn({ method: 'POST' })
  .validator((data: unknown): { email: string } => ({
    email: requireString(data, 'email').trim(),
  }))
  .handler(async ({ data }): Promise<GenericResult> => {
    if (!data.email) {
      return { status: 'ok' }
    }

    const supabase = createServerSupabaseClient()

    try {
      await supabase.auth.resend({
        type: 'signup',
        email: data.email,
        options: { emailRedirectTo: `${requestOrigin()}/confirm` },
      })
    } catch {
      // Same non-enumeration rule as the reset request: one answer.
    }

    return { status: 'ok' }
  })

export const updatePassword = createServerFn({ method: 'POST' })
  .validator((data: unknown): { password: string } => ({
    password: requireString(data, 'password'),
  }))
  .handler(async ({ data }): Promise<UpdatePasswordResult> => {
    if (!data.password) {
      return { status: 'weak_password' }
    }

    const supabase = createServerSupabaseClient()
    const { error } = await supabase.auth.updateUser({
      password: data.password,
    })

    if (!error) {
      return { status: 'ok' }
    }

    if (error.code === 'weak_password') {
      return { status: 'weak_password' }
    }

    if (isAuthSessionMissing(error)) {
      return { status: 'no_session' }
    }

    if (isSupabaseUnavailable(error)) {
      return { status: 'unavailable' }
    }

    return { status: 'error' }
  })

// A confirmation link arrives either as a PKCE `code` (the ConfirmationURL
// flow) or as a `token_hash` (the email-template flow). Both are accepted:
// the template belongs to the Supabase project, and the app must not depend
// on which one it was configured with.
export const confirmEmail = createServerFn({ method: 'POST' })
  .validator(
    (
      data: unknown,
    ): { code?: string; tokenHash?: string; type: EmailOtpType } => ({
      ...parseLinkPayload(data),
      type: readOtpType(optionalString(data, 'type')),
    }),
  )
  .handler(async ({ data }): Promise<LinkResult> => {
    const supabase = createServerSupabaseClient()

    if (data.code) {
      return toLinkResult(await supabase.auth.exchangeCodeForSession(data.code))
    }

    if (data.tokenHash) {
      return toLinkResult(
        await supabase.auth.verifyOtp({
          token_hash: data.tokenHash,
          type: data.type,
        }),
      )
    }

    return { status: 'invalid_link' }
  })

// The recovery link's half of the same contract: establish the recovery
// session, then let the new-password form update it.
export const startRecovery = createServerFn({ method: 'POST' })
  .validator((data: unknown): LinkPayload => parseLinkPayload(data))
  .handler(async ({ data }): Promise<LinkResult> => {
    const supabase = createServerSupabaseClient()

    if (data.code) {
      return toLinkResult(await supabase.auth.exchangeCodeForSession(data.code))
    }

    if (data.tokenHash) {
      return toLinkResult(
        await supabase.auth.verifyOtp({
          token_hash: data.tokenHash,
          type: 'recovery',
        }),
      )
    }

    return { status: 'invalid_link' }
  })

// The OTP types a link may carry. A link that names anything else is read as
// the common email-confirmation type rather than handed to Supabase. `email`
// covers a plain signup confirmation, which is what the documented template
// sends.
const OTP_TYPES: ReadonlyArray<string> = [
  'email',
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
]

function readOtpType(value: string | undefined): EmailOtpType {
  if (value && OTP_TYPES.includes(value)) {
    return value
  }

  return 'email'
}

function toLinkResult(result: { error: unknown }): LinkResult {
  const error = result.error as { status?: number } | null

  if (!error) {
    return { status: 'ok' }
  }

  if (isSupabaseUnavailable(error)) {
    return { status: 'unavailable' }
  }

  return { status: 'invalid_link' }
}

// The project's redirect allowlist is the authority on which origins a
// confirmation or recovery mail may point back to; this only supplies the
// origin the request actually arrived on.
function requestOrigin(): string {
  return getRequestUrl().origin
}
