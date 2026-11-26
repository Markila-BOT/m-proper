import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  USER_EMAIL,
  USER_ID,
  authConfig,
  forgingKey,
  keyServer,
  signToken,
  unsignedToken,
  validClaims,
} from './test-support.ts'
import {
  AuthConfigError,
  createTokenVerifier,
  readAuthConfig,
} from './verifier.ts'

// The Rust decision table (`api/src/auth/tests.rs`), re-expressed against the
// `jose` verifier. Identity is read from the cookie elsewhere; here only the
// token rules matter.

function verifier() {
  const server = keyServer()

  return { verify: createTokenVerifier(authConfig, server.resolver), server }
}

async function statusOf(token: string): Promise<401 | 503 | null> {
  const result = await verifier().verify.verify(token)

  return result.ok ? null : result.status
}

test('accepts a valid ES256 token', async () => {
  const { verify } = verifier()
  const result = await verify.verify(await signToken(validClaims()))

  assert.deepEqual(result, {
    ok: true,
    identity: { userId: USER_ID, email: USER_EMAIL },
  })
})

test('accepts a token expired within the sixty-second leeway', async () => {
  const { verify } = verifier()
  const exp = Math.floor(Date.now() / 1000) - 30

  const result = await verify.verify(await signToken(validClaims({ exp })))

  assert.equal(result.ok, true)
})

test('refuses a token expired beyond the leeway', async () => {
  const exp = Math.floor(Date.now() / 1000) - 120

  assert.equal(await statusOf(await signToken(validClaims({ exp }))), 401)
})

test('refuses a token with a tampered signature', async () => {
  const [header, payload, signature] = (await signToken(validClaims())).split(
    '.',
  )
  // Flip a character mid-signature: the final character may only carry
  // padding bits, which would leave the signature unchanged.
  const index = Math.floor(signature.length / 2)
  const flipped = signature[index] === 'A' ? 'B' : 'A'
  const tampered = `${header}.${payload}.${signature.slice(0, index)}${flipped}${signature.slice(index + 1)}`

  assert.equal(await statusOf(tampered), 401)
})

test('refuses a token signed with another key', async () => {
  assert.equal(
    await statusOf(await signToken(validClaims(), { key: forgingKey })),
    401,
  )
})

test('refuses a token from another issuer', async () => {
  assert.equal(
    await statusOf(
      await signToken(
        validClaims({ iss: 'https://other.supabase.co/auth/v1' }),
      ),
    ),
    401,
  )
})

test('refuses a token for another audience', async () => {
  assert.equal(
    await statusOf(await signToken(validClaims({ aud: 'another-project' }))),
    401,
  )
})

test('refuses a token without the authenticated role', async () => {
  assert.equal(
    await statusOf(await signToken(validClaims({ role: 'anon' }))),
    401,
  )
})

test('refuses an anonymous user token', async () => {
  assert.equal(
    await statusOf(await signToken(validClaims({ is_anonymous: true }))),
    401,
  )
})

test('refuses a token without a subject', async () => {
  const claims = validClaims()
  delete claims.sub

  assert.equal(await statusOf(await signToken(claims)), 401)
})

test('refuses a token with a blank subject', async () => {
  assert.equal(
    await statusOf(await signToken(validClaims({ sub: '   ' }))),
    401,
  )
})

test('refuses a token whose subject is not a UUID', async () => {
  assert.equal(
    await statusOf(await signToken(validClaims({ sub: 'not-a-uuid' }))),
    401,
  )
})

test('refuses an HS256 token without touching the key set', async () => {
  const { verify, server } = verifier()
  const token = await signToken(validClaims(), {
    alg: 'HS256',
    key: new TextEncoder().encode('the-anon-key'),
  })

  const result = await verify.verify(token)

  assert.equal(result.ok, false)
  assert.equal(result.status, 401)
  assert.equal(server.fetches, 0)
})

test('refuses an unsigned none token without touching the key set', async () => {
  const { verify, server } = verifier()

  const result = await verify.verify(unsignedToken(validClaims()))

  assert.equal(result.ok, false)
  assert.equal(result.status, 401)
  assert.equal(server.fetches, 0)
})

test('refetches the key set once for an unknown kid', async () => {
  const { verify, server } = verifier()

  await verify.verify(await signToken(validClaims()))
  assert.equal(server.fetches, 1)

  const unknown = await signToken(validClaims(), { kid: 'rotated-key' })
  const result = await verify.verify(unknown)

  assert.equal(result.ok, false)
  assert.equal(result.status, 401)
  assert.equal(server.fetches, 2)
})

test('reuses the cached key set', async () => {
  const { verify, server } = verifier()
  const token = await signToken(validClaims())

  await verify.verify(token)
  await verify.verify(token)

  assert.equal(server.fetches, 1)
})

test('reports an unreachable key set as unavailable', async () => {
  const { verify, server } = verifier()
  server.fail()

  const result = await verify.verify(await signToken(validClaims()))

  assert.equal(result.ok, false)
  assert.equal(result.status, 503)
})

test('reports an empty key set as unavailable', async () => {
  const server = keyServer({ keys: [] })
  const verify = createTokenVerifier(authConfig, server.resolver)

  const result = await verify.verify(await signToken(validClaims()))

  assert.equal(result.ok, false)
  assert.equal(result.status, 503)
})

// The routes read configuration per call; the start entry also validates the
// same names once at module load (see server-config.test.ts).

const completeEnv = {
  SUPABASE_URL: 'https://ref.supabase.co',
  SUPABASE_JWKS_URL: 'https://ref.supabase.co/auth/v1/.well-known/jwks.json',
  SUPABASE_JWT_ISSUER: 'https://ref.supabase.co/auth/v1',
  SUPABASE_JWT_AUD: 'authenticated',
}

test('reads a complete auth environment', () => {
  assert.deepEqual(readAuthConfig(completeEnv), {
    projectUrl: 'https://ref.supabase.co',
    jwksUrl: 'https://ref.supabase.co/auth/v1/.well-known/jwks.json',
    issuer: 'https://ref.supabase.co/auth/v1',
    audience: 'authenticated',
  })
})

test('names every missing auth variable at once', () => {
  assert.throws(
    () => readAuthConfig({}),
    (error: unknown) => {
      assert.ok(error instanceof AuthConfigError)
      assert.deepEqual(error.missing, [
        'SUPABASE_URL',
        'SUPABASE_JWKS_URL',
        'SUPABASE_JWT_ISSUER',
        'SUPABASE_JWT_AUD',
      ])
      assert.match(error.message, /SUPABASE_JWKS_URL/)
      assert.match(error.message, /SUPABASE_JWT_AUD/)

      return true
    },
  )
})

test('treats a blank auth variable as missing', () => {
  assert.throws(
    () => readAuthConfig({ ...completeEnv, SUPABASE_JWT_AUD: '   ' }),
    (error: unknown) => {
      assert.ok(error instanceof AuthConfigError)
      assert.deepEqual(error.missing, ['SUPABASE_JWT_AUD'])

      return true
    },
  )
})
