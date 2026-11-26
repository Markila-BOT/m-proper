// web/src/lib/api/envelope.ts
/**
 * The HTTP envelope every route answers with: `{ success, message, data? }`.
 * This is the same shape the Rust service produced and the client already
 * parses; `data` is absent on failures and on actions with nothing to return.
 */

export interface ApiEnvelope<T = unknown> {
  success: boolean
  message: string
  data?: T
}

export function ok<T>(message: string, data?: T): ApiEnvelope<T> {
  return data === undefined
    ? { success: true, message }
    : { success: true, message, data }
}

export function fail(message: string): ApiEnvelope<never> {
  return { success: false, message }
}

/** Serialises an envelope as `application/json` with the given status. */
export function jsonResponse<T>(
  status: number,
  envelope: ApiEnvelope<T>,
): Response {
  return new Response(JSON.stringify(envelope), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
    },
  })
}
