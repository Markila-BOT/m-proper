// web/src/lib/api/fallback.ts
/**
 * The JSON not-found for the `/api` family.
 *
 * TanStack Start only runs a route's `server.handlers` on an exact match, so a
 * splat route cannot answer an unknown `/api/*`. The request middleware uses
 * these helpers instead: when the router falls through to its document (HTML)
 * not-found for an `/api` path, the response is replaced with the envelope. A
 * route's own JSON 404 — a foreign property — is left untouched.
 */
import { fail, jsonResponse } from './envelope.ts'

export function isApiPath(pathname: string): boolean {
  return pathname === '/api' || pathname.startsWith('/api/')
}

export function shouldAnswerApiNotFound(
  pathname: string,
  response: Response,
): boolean {
  if (!isApiPath(pathname)) {
    return false
  }

  const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''

  return contentType.startsWith('text/html')
}

export function apiNotFoundResponse(): Response {
  return jsonResponse(404, fail('Not found'))
}
