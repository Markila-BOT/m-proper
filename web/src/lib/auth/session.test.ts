import assert from 'node:assert/strict'
import { test } from 'node:test'

import { sessionCookieName } from './cookie.ts'
import { assertSameOrigin, readIdentity } from './session.ts'
import {
  PROJECT_URL,
  USER_EMAIL,
  USER_ID,
  forgingKey,
  keyServer,
  signToken,
  validClaims,
} from './test-support.ts'
import { createTokenVerifier } from './verifier.ts'
import type { TokenVerifier } from './verifier.ts'

// The route boundary: identity from the cookie, and the CSRF check that
// replaces the CORS allow-list now that the credential is ambient (ADR-0010).

const APP_ORIGIN = 'https://app.test'
const ENDPOINT = `${APP_ORIGIN}/api/properties`

const sessionName = sessionCookieName(PROJECT_URL)

function sessionCookie(token: string): string {
  const value = Buffer.from(JSON.stringify({ access_token: token })).toString(
    'base64url',
  )

  return `${sessionName}=base64-${value}`
}

function request(
  method: string,
  headers: Record<string, string> = {},
): Request {
  return new Request(ENDPOINT, { method, headers })
}

function verifierWithKeys(): TokenVerifier {
  return createTokenVerifier(
    {
      jwksUrl: `${PROJECT_URL}/auth/v1/.well-known/jwks.json`,
      issuer: `${PROJECT_URL}/auth/v1`,
      audience: 'authenticated',
    },
    keyServer().resolver,
  )
}

const config = {
  projectUrl: PROJECT_URL,
  jwksUrl: `${PROJECT_URL}/auth/v1/.well-known/jwks.json`,
  issuer: `${PROJECT_URL}/auth/v1`,
  audience: 'authenticated',
}

test('reads the identity from a valid session cookie', async () => {
  const result = await readIdentity(
    request('GET', { cookie: sessionCookie(await signToken(validClaims())) }),
    { config, verifier: verifierWithKeys() },
  )

  assert.deepEqual(result, {
    ok: true,
    identity: { userId: USER_ID, email: USER_EMAIL },
  })
})

test('answers 401 when the session cookie is absent', async () => {
  const result = await readIdentity(request('GET'), {
    config,
    verifier: verifierWithKeys(),
  })

  assert.deepEqual(result, { ok: false, status: 401 })
})

test('answers 401 when the session cookie is malformed', async () => {
  const result = await readIdentity(
    request('GET', { cookie: `${sessionName}=base64-not-json` }),
    { config, verifier: verifierWithKeys() },
  )

  assert.deepEqual(result, { ok: false, status: 401 })
})

test('answers 401 when the cookie token is refused', async () => {
  const forged = await signToken(validClaims(), { key: forgingKey })

  const result = await readIdentity(
    request('GET', { cookie: sessionCookie(forged) }),
    { config, verifier: verifierWithKeys() },
  )

  assert.deepEqual(result, { ok: false, status: 401 })
})

test('answers 503 when the key set is unavailable', async () => {
  const server = keyServer()
  server.fail()

  const result = await readIdentity(
    request('GET', { cookie: sessionCookie(await signToken(validClaims())) }),
    {
      config,
      verifier: createTokenVerifier(
        {
          jwksUrl: config.jwksUrl,
          issuer: config.issuer,
          audience: config.audience,
        },
        server.resolver,
      ),
    },
  )

  assert.deepEqual(result, { ok: false, status: 503 })
})

// CSRF: every state-changing request must be same-origin. A safe method, or a
// GET with no Origin, is not a state change and passes.

test('passes a same-origin POST', () => {
  assert.deepEqual(assertSameOrigin(request('POST', { origin: APP_ORIGIN })), {
    ok: true,
  })
})

test('refuses a cross-origin POST', () => {
  assert.deepEqual(
    assertSameOrigin(request('POST', { origin: 'https://evil.test' })),
    { ok: false, status: 403 },
  )
})

test('passes a same-origin DELETE', () => {
  assert.deepEqual(
    assertSameOrigin(request('DELETE', { origin: APP_ORIGIN })),
    { ok: true },
  )
})

test('refuses a cross-origin DELETE', () => {
  assert.deepEqual(
    assertSameOrigin(request('DELETE', { origin: 'https://evil.test' })),
    { ok: false, status: 403 },
  )
})

test('passes a GET with no Origin', () => {
  assert.deepEqual(assertSameOrigin(request('GET')), { ok: true })
})

test('passes a HEAD with no Origin', () => {
  assert.deepEqual(assertSameOrigin(request('HEAD')), { ok: true })
})

test('passes a POST with only a same-origin Sec-Fetch-Site', () => {
  assert.deepEqual(
    assertSameOrigin(request('POST', { 'sec-fetch-site': 'same-origin' })),
    { ok: true },
  )
})

test('refuses a cross-site Sec-Fetch-Site without an Origin', () => {
  assert.deepEqual(
    assertSameOrigin(request('POST', { 'sec-fetch-site': 'cross-site' })),
    { ok: false, status: 403 },
  )
})

test('refuses a state-changing request with no Origin and no Sec-Fetch-Site', () => {
  assert.deepEqual(assertSameOrigin(request('POST')), {
    ok: false,
    status: 403,
  })
})

test('refuses an opaque Origin', () => {
  assert.deepEqual(assertSameOrigin(request('POST', { origin: 'null' })), {
    ok: false,
    status: 403,
  })
})

test('refuses an Origin on a different port', () => {
  assert.deepEqual(
    assertSameOrigin(request('POST', { origin: 'https://app.test:8443' })),
    { ok: false, status: 403 },
  )
})
