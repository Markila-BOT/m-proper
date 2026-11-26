// Where a signed-in landlord may be sent back to (design §7). The guard,
// the confirm route, and the new-password route all call this one function,
// so a tampered `redirect` cannot leave the app's own origin: only a
// same-origin relative path beginning with a single `/` is accepted, and
// everything else falls back to the default landing page.

// The default page a refused target lands on. `/` is the shell's entry
// point; its own route redirects to the first ledger screen.
export const DEFAULT_RETURN_PATH = '/'

// A fixed base only used to ask the URL parser what a value would resolve
// to. It is never navigated to and never shared with the browser.
const PARSER_BASE = 'http://return-path.local'

// Any leading scheme — `javascript:`, `https:`, even a Windows drive
// letter — makes the value an absolute URL rather than a path.
const SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:/i

export function validateReturnPath(value: unknown): string {
  if (typeof value !== 'string') {
    return DEFAULT_RETURN_PATH
  }

  if (SCHEME_PATTERN.test(value)) {
    return DEFAULT_RETURN_PATH
  }

  // Exactly one leading slash: `//host` is protocol-relative, which the
  // browser would resolve to another origin.
  if (!value.startsWith('/') || value.startsWith('//')) {
    return DEFAULT_RETURN_PATH
  }

  // Some browsers treat a backslash as a path separator, so `/\evil.test`
  // becomes another origin even though it starts with `/`.
  if (value.includes('\\')) {
    return DEFAULT_RETURN_PATH
  }

  // Browsers strip control characters (a tab inside `//host`) before
  // resolving a URL, which would smuggle a protocol-relative target past
  // the checks above.
  if (hasControlCharacter(value)) {
    return DEFAULT_RETURN_PATH
  }

  // The parser normalizes dot segments: `/..//evil.test` resolves to a
  // protocol-relative path. Ask it, and require the answer to stay on the
  // parser's own origin with a path that still begins with one slash.
  try {
    const resolved = new URL(value, PARSER_BASE)
    if (
      resolved.origin !== PARSER_BASE ||
      !resolved.pathname.startsWith('/') ||
      resolved.pathname.startsWith('//')
    ) {
      return DEFAULT_RETURN_PATH
    }
  } catch {
    return DEFAULT_RETURN_PATH
  }

  return value
}

function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    if (code <= 0x1f || code === 0x7f) {
      return true
    }
  }

  return false
}
