// The access-token verifier, ported from `api/src/auth/verifier.rs`. It is the
// only place a caller's identity is established: everything here runs on the
// server, and a failure is returned as a status the route can answer with, so
// no route needs a `try`/`catch`. ES256 only, pinned issuer/audience, a
// sixty-second expiry leeway, a UUID subject, the `authenticated` role, and no
// anonymous claim. A bad token is 401; an unusable key set is 503 (ADR-0010).

import {
  createRemoteJWKSet,
  decodeProtectedHeader,
  errors,
  jwtVerify,
} from 'jose'
import type {
  JSONWebKeySet,
  JWTVerifyGetKey,
  JWTVerifyOptions,
  JWTPayload,
} from 'jose'

/** The key set is cached no longer than ten minutes (ADR-0010). */
export const JWKS_CACHE_MS = 10 * 60 * 1_000

/** How long a key-set request may take before verification fails closed. */
export const JWKS_TIMEOUT_MS = 10_000

/** Tolerated clock skew when checking `exp`. */
export const CLOCK_TOLERANCE = '60s'

const AUTHENTICATED_ROLE = 'authenticated'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// A verified caller: the token subject, used as the owner of every row, and
// the email when the token carries one.
export interface Identity {
  userId: string
  email: string | null
}

export type VerifyResult =
  | { ok: true; identity: Identity }
  | { ok: false; status: 401 | 503; reason: string }

/**
 * Resolves the public key for a token header. Production uses
 * {@link createRemoteJWKSet}; the tests pass a resolver backed by an
 * in-memory key set. `jwks` is exposed by jose's remote resolver and lets
 * verification tell an empty key set (503) apart from an unknown key id (401).
 */
export type KeyResolver = JWTVerifyGetKey & {
  jwks?: () => JSONWebKeySet | undefined
}

export interface TokenVerifier {
  verify: (token: string) => Promise<VerifyResult>
}

export interface AuthConfig {
  /** The Supabase project URL; its host's first label names the cookie. */
  projectUrl: string
  jwksUrl: string
  issuer: string
  audience: string
}

export interface VerifierConfig {
  jwksUrl: string
  issuer: string
  audience: string
}

export type AuthEnv = Record<string, string | undefined>

const REQUIRED_ENV = [
  'SUPABASE_URL',
  'SUPABASE_JWKS_URL',
  'SUPABASE_JWT_ISSUER',
  'SUPABASE_JWT_AUD',
] as const

/** Raised when the server environment lacks auth configuration. */
export class AuthConfigError extends Error {
  readonly missing: string[]

  constructor(missing: string[]) {
    super(
      `Supabase auth is not configured: set ${missing.join(', ')}. ` +
        'It must be present in the server environment before the app serves requests.',
    )
    this.name = 'AuthConfigError'
    this.missing = missing
  }
}

/**
 * Reads the auth configuration from the server environment. Called per request,
 * and reused by the start entry's one-time check (`server-config.ts`) so both
 * report the same names; every missing name is reported at once.
 */
export function readAuthConfig(env: AuthEnv = process.env): AuthConfig {
  const missing: string[] = []

  const read = (name: (typeof REQUIRED_ENV)[number]): string => {
    const value = env[name]?.trim()

    if (!value) {
      missing.push(name)

      return ''
    }

    return value
  }

  const projectUrl = read('SUPABASE_URL')
  const jwksUrl = read('SUPABASE_JWKS_URL')
  const issuer = read('SUPABASE_JWT_ISSUER')
  const audience = read('SUPABASE_JWT_AUD')

  if (missing.length > 0) {
    throw new AuthConfigError(missing)
  }

  return { projectUrl, jwksUrl, issuer, audience }
}

/**
 * Builds a verifier. `resolveKeys` is the test seam: pass a resolver backed by
 * a local key set and no test touches the network.
 */
export function createTokenVerifier(
  config: VerifierConfig,
  resolveKeys: KeyResolver = remoteKeyResolver(config.jwksUrl),
): TokenVerifier {
  const options: JWTVerifyOptions = {
    algorithms: ['ES256'],
    issuer: config.issuer,
    audience: config.audience,
    clockTolerance: CLOCK_TOLERANCE,
    requiredClaims: ['exp'],
  }

  return {
    async verify(token: string): Promise<VerifyResult> {
      let header: ReturnType<typeof decodeProtectedHeader>

      try {
        header = decodeProtectedHeader(token)
      } catch (error) {
        return invalid(`malformed token header: ${describe(error)}`)
      }

      // ES256 only. `none`, the HS family, and every other algorithm are
      // refused before a key is selected, so a forged symmetric token never
      // causes a key-set fetch.
      if (header.alg !== 'ES256') {
        return invalid(`algorithm ${String(header.alg)} is not allowed`)
      }

      if (typeof header.kid !== 'string' || header.kid.trim() === '') {
        return invalid('the token names no key id')
      }

      let payload: JWTPayload

      try {
        const verified = await jwtVerify(token, resolveKeys, options)
        payload = verified.payload
      } catch (error) {
        return refuse(error, resolveKeys)
      }

      const subject = typeof payload.sub === 'string' ? payload.sub.trim() : ''

      if (subject === '') {
        return invalid('the token has no subject')
      }

      if (!UUID_PATTERN.test(subject)) {
        return invalid('the subject is not a UUID')
      }

      if (payload.is_anonymous === true) {
        return invalid('anonymous users are not allowed')
      }

      if (payload.role !== AUTHENTICATED_ROLE) {
        return invalid(`role ${String(payload.role)} is not allowed`)
      }

      return {
        ok: true,
        identity: {
          userId: subject,
          email:
            typeof payload.email === 'string' && payload.email !== ''
              ? payload.email
              : null,
        },
      }
    },
  }
}

/**
 * The production resolver: fetches the project key set once and caches it for
 * ten minutes. `cooldownDuration: 0` is deliberate — the Rust verifier refetched
 * once per attempt on an unknown key id even right after a successful fetch, and
 * jose performs exactly one retry per resolution before refusing.
 */
function remoteKeyResolver(jwksUrl: string): KeyResolver {
  return createRemoteJWKSet(new URL(jwksUrl), {
    cacheMaxAge: JWKS_CACHE_MS,
    cooldownDuration: 0,
    timeoutDuration: JWKS_TIMEOUT_MS,
  })
}

function refuse(error: unknown, resolveKeys: KeyResolver): VerifyResult {
  return isUnavailable(error, resolveKeys)
    ? { ok: false, status: 503, reason: describe(error) }
    : { ok: false, status: 401, reason: describe(error) }
}

// A token can only produce a specific jose validation error. Everything a
// token cannot cause — a timeout, a malformed key set, a non-200, a transport
// failure, or an empty set — is an outage and answers 503 so the caller can
// retry rather than sign in again (ADR-0010).
function isUnavailable(error: unknown, resolveKeys: KeyResolver): boolean {
  if (error instanceof errors.JWKSTimeout) {
    return true
  }

  if (error instanceof errors.JWKSInvalid) {
    return true
  }

  if (error instanceof errors.JWKSMultipleMatchingKeys) {
    return true
  }

  if (error instanceof errors.JWKSNoMatchingKey) {
    // An unknown kid also lands here, but only after the single refetch.
    // A cached set with no keys at all is an empty key set, not a bad token.
    const keys = resolveKeys.jwks?.()

    return keys !== undefined && keys.keys.length === 0
  }

  if (error instanceof errors.JOSEError) {
    // The remote resolver reports a non-200 or an unparsable body as a plain
    // JOSEError; every token-level failure has a more specific class above.
    return error.code === 'ERR_JOSE_GENERIC'
  }

  // Not a jose error at all: the key transport failed (DNS, TLS, abort).
  return true
}

function invalid(reason: string): VerifyResult {
  return { ok: false, status: 401, reason }
}

function describe(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}
