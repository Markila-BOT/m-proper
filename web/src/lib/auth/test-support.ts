// Shared fixtures for the auth unit tests, ported from the Rust suite's
// `api/src/auth/test_support.rs`: one P-256 key pair, its public key set,
// token builders, and a key server that speaks the remote-JWKS protocol from
// memory. Nothing here reaches the network.

import {
  SignJWT,
  createRemoteJWKSet,
  customFetch,
  exportJWK,
  generateKeyPair,
} from 'jose'
import type { CryptoKey, JSONWebKeySet, JWTPayload } from 'jose'

import { JWKS_CACHE_MS } from './verifier.ts'
import type { AuthConfig, KeyResolver } from './verifier.ts'

export const KID = 'test-key-1'
export const PROJECT_URL = 'https://test.supabase.co'
export const ISSUER = `${PROJECT_URL}/auth/v1`
export const AUDIENCE = 'authenticated'
export const JWKS_URL = `${ISSUER}/.well-known/jwks.json`
export const USER_ID = '0f8fad5b-d9cb-469f-a165-70867728950e'
export const USER_EMAIL = 'landlord@example.com'

export const authConfig: AuthConfig = {
  projectUrl: PROJECT_URL,
  jwksUrl: JWKS_URL,
  issuer: ISSUER,
  audience: AUDIENCE,
}

const signing = await generateKeyPair('ES256')
const forgery = await generateKeyPair('ES256')
const publicJwk = await exportJWK(signing.publicKey)

export const signingKey: CryptoKey = signing.privateKey
export const forgingKey: CryptoKey = forgery.privateKey

export const keySet: JSONWebKeySet = {
  keys: [{ ...publicJwk, kid: KID, alg: 'ES256', use: 'sig' }],
}

export function validClaims(overrides: JWTPayload = {}): JWTPayload {
  const now = Math.floor(Date.now() / 1000)

  return {
    sub: USER_ID,
    iss: ISSUER,
    aud: AUDIENCE,
    role: 'authenticated',
    email: USER_EMAIL,
    iat: now,
    exp: now + 3_600,
    ...overrides,
  }
}

export interface SignOptions {
  kid?: string | null
  alg?: 'ES256' | 'HS256'
  key?: CryptoKey | Uint8Array
}

export function signToken(
  claims: JWTPayload,
  { kid = KID, alg = 'ES256', key = signingKey }: SignOptions = {},
): Promise<string> {
  const jwt = new SignJWT(claims)

  return kid === null
    ? jwt.setProtectedHeader({ alg }).sign(key)
    : jwt.setProtectedHeader({ alg, kid }).sign(key)
}

// An `alg: none` token, which `SignJWT` refuses to produce.
export function unsignedToken(claims: JWTPayload): string {
  const header = { alg: 'none', typ: 'JWT', kid: KID }

  return `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}.`
}

function base64url(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64url')
}

// A stand-in for the project JWKS endpoint. It is a real `createRemoteJWKSet`
// resolver fed by a fake transport, so the cache, the one-refetch rule, and
// the failure modes are jose's, not the test's.
export interface KeyServer {
  resolver: KeyResolver
  readonly fetches: number
  fail: (error?: Error) => void
}

export function keyServer(keys: JSONWebKeySet = keySet): KeyServer {
  let fetches = 0
  let failure: Error | null = null

  const resolver = createRemoteJWKSet(new URL(JWKS_URL), {
    cacheMaxAge: JWKS_CACHE_MS,
    // Match the Rust verifier: an unknown kid refetches once per attempt,
    // even immediately after a successful fetch.
    cooldownDuration: 0,
    timeoutDuration: 1_000,
    [customFetch]: async () => {
      fetches += 1

      if (failure) {
        throw failure
      }

      return new Response(JSON.stringify(keys), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    },
  })

  return {
    resolver,
    get fetches() {
      return fetches
    },
    fail(error = new Error('the key set is unreachable')) {
      failure = error
    },
  }
}
