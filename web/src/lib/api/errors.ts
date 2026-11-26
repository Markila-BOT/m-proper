// web/src/lib/api/errors.ts
/**
 * Turns a thrown database error into the status the route answers with.
 *
 * Unreachable is 503 (retry), any other statement error is 500 (an operator
 * problem), and the caller never sees the driver's text or a stack trace.
 */
import { DatabaseConfigError } from '../db.ts'

export interface DatabaseFailure {
  status: 500 | 503
  message: string
}

const UNAVAILABLE_MESSAGE =
  'The database is temporarily unavailable. Try again shortly.'
const NOT_CONFIGURED_MESSAGE =
  'The database is not configured. Try again shortly.'
const INTERNAL_MESSAGE = 'Internal server error'

const UNAVAILABLE_SQLSTATE = new Set([
  '57P01', // admin_shutdown
  '57P02', // crash_shutdown
  '57P03', // cannot_connect_now
  '53300', // too_many_connections
])

const UNAVAILABLE_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ENOTFOUND',
  'ETIMEDOUT',
  'EPIPE',
  'CONNECT_TIMEOUT',
  'CONNECTION_CLOSED',
  'CONNECTION_ENDED',
  'CONNECTION_DESTROYED',
])

function errorCode(error: unknown): string | null {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code

    return typeof code === 'string' ? code : null
  }

  return null
}

function looksLikeConnectionFailure(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }

  return /ECONN|connection|connect timeout|socket|terminated/i.test(
    error.message,
  )
}

/** True when the database could not be reached, as opposed to answering badly. */
export function isDatabaseUnavailable(error: unknown): boolean {
  if (error instanceof DatabaseConfigError) {
    return true
  }

  const code = errorCode(error)

  if (code === null) {
    return looksLikeConnectionFailure(error)
  }

  return (
    code.startsWith('08') ||
    UNAVAILABLE_SQLSTATE.has(code) ||
    UNAVAILABLE_CODES.has(code)
  )
}

export function databaseFailure(error: unknown): DatabaseFailure {
  if (error instanceof DatabaseConfigError) {
    return { status: 503, message: NOT_CONFIGURED_MESSAGE }
  }

  return isDatabaseUnavailable(error)
    ? { status: 503, message: UNAVAILABLE_MESSAGE }
    : { status: 500, message: INTERNAL_MESSAGE }
}
