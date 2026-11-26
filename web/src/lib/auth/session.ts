// The route boundary's two checks. `readIdentity` turns the session cookie
// into a verified identity or the status the route should answer; it returns
// a result rather than throwing, and a missing cookie is 401 while an
// unusable key set is 503. `assertSameOrigin` is the CSRF control that replaces
// the CORS allow-list now that the credential is ambient (ADR-0010).

import { readSessionCookie } from './cookie.ts'
import { createTokenVerifier, readAuthConfig } from './verifier.ts'
import type { AuthConfig, Identity, TokenVerifier } from './verifier.ts'

export type IdentityResult =
  { ok: true; identity: Identity } | { ok: false; status: 401 | 503 }

export interface ReadIdentityOptions {
  /** Defaults to `readAuthConfig()`; injected by tests. */
  config?: AuthConfig
  /** Defaults to a cached verifier for the configured JWKS; injected by tests. */
  verifier?: TokenVerifier
}

/**
 * Reads and verifies the Supabase session cookie on `request`. A missing or
 * malformed cookie, a refused token, and an absent token all answer 401; a key
 * set that cannot be used answers 503 so the caller may retry instead of
 * signing in again. Never throws.
 */
export async function readIdentity(
  request: Request,
  { config, verifier }: ReadIdentityOptions = {},
): Promise<IdentityResult> {
  let resolved: AuthConfig

  if (config) {
    resolved = config
  } else {
    try {
      resolved = readAuthConfig()
    } catch {
      // Missing server configuration is an outage, not the caller's fault.
      return { ok: false, status: 503 }
    }
  }

  const session = readSessionCookie(
    request.headers.get('cookie'),
    resolved.projectUrl,
  )

  if (!session) {
    return { ok: false, status: 401 }
  }

  try {
    const result = await (verifier ?? verifierFor(resolved)).verify(
      session.accessToken,
    )

    return result.ok
      ? { ok: true, identity: result.identity }
      : { ok: false, status: result.status }
  } catch {
    // The verifier returns its failures; a throw here is an unexpected
    // failure, and failing closed as unavailable is the safe answer.
    return { ok: false, status: 503 }
  }
}

export type OriginResult = { ok: true } | { ok: false; status: 403 }

const SAFE_METHODS = new Set(['GET', 'HEAD'])

/**
 * The CSRF gate for a state-changing request. `Origin`, when present, must
 * equal the request's own origin; when it is absent, `Sec-Fetch-Site` must say
 * `same-origin`. GET and HEAD are not state changes and pass. Returns a result
 * so the route answers 403 without a `try`/`catch`.
 */
export function assertSameOrigin(request: Request): OriginResult {
  if (SAFE_METHODS.has(request.method.toUpperCase())) {
    return { ok: true }
  }

  let ownOrigin: string

  try {
    ownOrigin = new URL(request.url).origin
  } catch {
    return { ok: false, status: 403 }
  }

  const origin = request.headers.get('origin')

  if (origin !== null) {
    return matchesOrigin(origin, ownOrigin)
      ? { ok: true }
      : { ok: false, status: 403 }
  }

  return request.headers.get('sec-fetch-site') === 'same-origin'
    ? { ok: true }
    : { ok: false, status: 403 }
}

function matchesOrigin(origin: string, ownOrigin: string): boolean {
  try {
    return new URL(origin).origin === ownOrigin
  } catch {
    // Includes the opaque `Origin: null`.
    return false
  }
}

// One verifier per process so the JWKS cache is shared; rebuilt only when the
// configuration changes. Nothing is read from the environment at import time.
let cached: { key: string; verifier: TokenVerifier } | null = null

function verifierFor(config: AuthConfig): TokenVerifier {
  const key = `${config.jwksUrl}\n${config.issuer}\n${config.audience}`

  if (cached?.key !== key) {
    cached = { key, verifier: createTokenVerifier(config) }
  }

  return cached.verifier
}
