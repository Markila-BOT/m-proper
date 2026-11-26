import assert from 'node:assert/strict'
import { test } from 'node:test'

import { readSessionCookie, sessionCookieName } from './cookie.ts'

// The cookie contract from ADR-0010: `sb-<project-ref>-auth-token`, chunked as
// `.0`, `.1`, … when large, base64url JSON. Every malformed input answers "no
// session" — never an exception — so the route can answer 401.

const PROJECT_URL = 'https://test.supabase.co'
const NAME = 'sb-test-auth-token'
const ACCESS_TOKEN =
  'eyJhbGciOiJFUzI1NiIsImtpZCI6InRlc3Qta2V5LTEifQ.eyJzdWIiOiJ4In0.signature'

function header(cookies: Record<string, string>): string {
  return Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ')
}

function encode(session: unknown): string {
  return `base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`
}

function legacy(session: unknown): string {
  return Buffer.from(JSON.stringify(session)).toString('base64url')
}

test('derives the cookie name from the project URL host', () => {
  assert.equal(
    sessionCookieName('https://abcdefghijklmnop.supabase.co'),
    'sb-abcdefghijklmnop-auth-token',
  )
})

test('derives the cookie name for a local Supabase URL', () => {
  assert.equal(
    sessionCookieName('http://localhost:54321'),
    'sb-localhost-auth-token',
  )
})

test('reads an unchunked base64 session cookie', () => {
  const session = readSessionCookie(
    header({ [NAME]: encode({ access_token: ACCESS_TOKEN }) }),
    PROJECT_URL,
  )

  assert.equal(session?.accessToken, ACCESS_TOKEN)
})

test('reads a bare base64url session cookie', () => {
  const session = readSessionCookie(
    header({ [NAME]: legacy({ access_token: ACCESS_TOKEN }) }),
    PROJECT_URL,
  )

  assert.equal(session?.accessToken, ACCESS_TOKEN)
})

test('reads a legacy plain JSON session cookie', () => {
  const session = readSessionCookie(
    header({ [NAME]: JSON.stringify({ access_token: ACCESS_TOKEN }) }),
    PROJECT_URL,
  )

  assert.equal(session?.accessToken, ACCESS_TOKEN)
})

test('reads a percent-encoded session cookie', () => {
  const encoded = encodeURIComponent(
    JSON.stringify({ access_token: ACCESS_TOKEN }),
  )

  const session = readSessionCookie(header({ [NAME]: encoded }), PROJECT_URL)

  assert.equal(session?.accessToken, ACCESS_TOKEN)
})

test('tolerates a large single cookie', () => {
  const largeToken = 'a'.repeat(5_000)

  const session = readSessionCookie(
    header({ [NAME]: encode({ access_token: largeToken }) }),
    PROJECT_URL,
  )

  assert.equal(session?.accessToken, largeToken)
})

test('assembles chunks in index order', () => {
  const value = encode({ access_token: ACCESS_TOKEN })
  const middle = Math.floor(value.length / 2)

  // Written out of order: only the index decides the order.
  const session = readSessionCookie(
    header({
      [`${NAME}.1`]: value.slice(middle),
      [`${NAME}.0`]: value.slice(0, middle),
    }),
    PROJECT_URL,
  )

  assert.equal(session?.accessToken, ACCESS_TOKEN)
})

test('reads the refresh token and expiry when present', () => {
  const session = readSessionCookie(
    header({
      [NAME]: encode({
        access_token: ACCESS_TOKEN,
        refresh_token: 'refresh-me',
        expires_at: 1_900_000_000,
      }),
    }),
    PROJECT_URL,
  )

  assert.deepEqual(session, {
    accessToken: ACCESS_TOKEN,
    refreshToken: 'refresh-me',
    expiresAt: 1_900_000_000,
  })
})

test('returns no session when the cookie is absent', () => {
  assert.equal(readSessionCookie(null, PROJECT_URL), null)
  assert.equal(readSessionCookie('', PROJECT_URL), null)
})

test('ignores a session cookie for another project', () => {
  const cookie = header({
    'sb-other-auth-token': encode({ access_token: ACCESS_TOKEN }),
  })

  assert.equal(readSessionCookie(cookie, PROJECT_URL), null)
})

test('returns no session for malformed cookie JSON', () => {
  const cookie = header({ [NAME]: 'base64-dGhpcyBpcyBub3QganNvbg' })

  assert.equal(readSessionCookie(cookie, PROJECT_URL), null)
})

test('returns no session when the access token is missing', () => {
  const cookie = header({ [NAME]: encode({ refresh_token: 'only-a-refresh' }) })

  assert.equal(readSessionCookie(cookie, PROJECT_URL), null)
})

test('returns no session when the access token is not a string', () => {
  const cookie = header({ [NAME]: encode({ access_token: 42 }) })

  assert.equal(readSessionCookie(cookie, PROJECT_URL), null)
})

test('returns no session when a chunk is missing', () => {
  const value = encode({ access_token: ACCESS_TOKEN })
  const middle = Math.floor(value.length / 2)

  const cookie = header({ [`${NAME}.0`]: value.slice(0, middle) })

  assert.equal(readSessionCookie(cookie, PROJECT_URL), null)
})

test('returns no session when a chunk is corrupt', () => {
  const value = encode({ access_token: ACCESS_TOKEN })
  const middle = Math.floor(value.length / 2)

  const cookie = header({
    [`${NAME}.0`]: value.slice(0, middle),
    [`${NAME}.1`]: 'not-the-rest-of-the-session',
  })

  assert.equal(readSessionCookie(cookie, PROJECT_URL), null)
})

test('returns no session for an unparsable project URL', () => {
  const cookie = header({ [NAME]: encode({ access_token: ACCESS_TOKEN }) })

  assert.equal(readSessionCookie(cookie, 'not a url'), null)
})
