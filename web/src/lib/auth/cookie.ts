// Reading the Supabase session cookie. `@supabase/ssr` stores the session as
// `sb-<project-ref>-auth-token`, base64url-encoded JSON under a `base64-`
// prefix, split into `.0`, `.1`, … chunks when the value is large. This reader
// assembles whatever shape is present and answers `null` for anything it
// cannot trust: a missing cookie, a bad chunk, malformed JSON, or no access
// token is "no session", never an exception (ADR-0010).

/** The `base64-` marker `@supabase/ssr` writes before a base64url value. */
const BASE64_PREFIX = 'base64-'

export interface SessionCookie {
  accessToken: string
  refreshToken: string | null
  expiresAt: number | null
}

/**
 * The cookie name supabase-js uses: `sb-<project-ref>-auth-token`, where the
 * ref is the project URL host's first label (`abcdefgh` in
 * `https://abcdefgh.supabase.co`, `localhost` in `http://localhost:54321`).
 */
export function sessionCookieName(projectUrl: string): string {
  const host = new URL(projectUrl).hostname
  const projectRef = host.split('.')[0]

  return `sb-${projectRef}-auth-token`
}

/**
 * Reads the session from a request's `Cookie` header. `null` means "no
 * session" — absent, incomplete, or malformed — and the caller answers 401.
 */
export function readSessionCookie(
  cookieHeader: string | null | undefined,
  projectUrl: string,
): SessionCookie | null {
  try {
    const jar = parseCookieHeader(cookieHeader)

    let name: string

    try {
      name = sessionCookieName(projectUrl)
    } catch {
      return null
    }

    const value = readCookieValue(jar, name)

    return value === null ? null : parseSessionCookieValue(value)
  } catch {
    return null
  }
}

/**
 * Decodes one assembled cookie value. Accepts the `base64-`-prefixed form
 * `@supabase/ssr` writes, a bare base64url value, and a legacy plain-JSON
 * value that the browser may have percent-encoded.
 */
export function parseSessionCookieValue(value: string): SessionCookie | null {
  if (typeof value !== 'string' || value === '') {
    return null
  }

  const json = decodeCookieValue(value)

  if (json === null) {
    return null
  }

  let payload: unknown

  try {
    payload = JSON.parse(json)
  } catch {
    return null
  }

  if (
    typeof payload !== 'object' ||
    payload === null ||
    Array.isArray(payload)
  ) {
    return null
  }

  const record = payload as Record<string, unknown>
  const accessToken = record.access_token

  if (typeof accessToken !== 'string' || accessToken.trim() === '') {
    return null
  }

  return {
    accessToken,
    refreshToken:
      typeof record.refresh_token === 'string' && record.refresh_token !== ''
        ? record.refresh_token
        : null,
    expiresAt:
      typeof record.expires_at === 'number' &&
      Number.isFinite(record.expires_at)
        ? record.expires_at
        : null,
  }
}

function decodeCookieValue(value: string): string | null {
  const body = value.startsWith(BASE64_PREFIX)
    ? value.slice(BASE64_PREFIX.length)
    : value

  const decoded = decodePercentEncoding(body).trim()

  // A legacy value is already JSON. Everything else is base64url of JSON;
  // Node's base64url decoder also accepts the standard `+`/`/` alphabet.
  if (decoded.startsWith('{')) {
    return decoded
  }

  try {
    return Buffer.from(decoded, 'base64url').toString('utf8')
  } catch {
    return null
  }
}

function decodePercentEncoding(value: string): string {
  if (!value.includes('%')) {
    return value
  }

  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

/**
 * The unchunked cookie when present (a large single cookie is fine), otherwise
 * `.0`, `.1`, … joined by index until the first gap. A gap leaves a partial
 * value, which fails JSON parsing and becomes "no session".
 */
function readCookieValue(
  jar: Map<string, string>,
  name: string,
): string | null {
  const single = jar.get(name)

  if (single) {
    return single
  }

  const chunks: string[] = []

  for (let index = 0; ; index += 1) {
    const chunk = jar.get(`${name}.${index}`)

    if (chunk === undefined) {
      break
    }

    chunks.push(chunk)
  }

  return chunks.length === 0 ? null : chunks.join('')
}

function parseCookieHeader(
  cookieHeader: string | null | undefined,
): Map<string, string> {
  const jar = new Map<string, string>()

  if (!cookieHeader) {
    return jar
  }

  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=')

    if (separator < 0) {
      continue
    }

    const name = part.slice(0, separator).trim()

    if (name === '') {
      continue
    }

    let value = part.slice(separator + 1).trim()

    if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1)
    }

    // Last wins, matching the `cookie` parser `@supabase/ssr` uses.
    jar.set(name, value)
  }

  return jar
}
