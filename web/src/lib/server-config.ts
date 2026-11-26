// web/src/lib/server-config.ts
/**
 * Validates the server environment once, while the server entry module
 * initialises, so a missing value fails before any request is served.
 *
 * What "refuses to serve" means for this runtime: `src/start.ts` throws during
 * module initialisation. Vercel loads the entry per instance and fails the
 * invocation on a module-initialisation throw (the message is surfaced in the
 * logs and the response is a 500); locally Vite answers every request with the
 * same error. Either way no request is answered successfully, and the message
 * names every absent variable without including any configured value.
 *
 * The database and auth readers are reused rather than reimplemented, so this
 * check cannot drift from the per-request parsers: a name added to
 * `readAuthConfig` or `readDatabaseUrl` is reported here automatically.
 */
import { AuthConfigError, readAuthConfig } from './auth/verifier.ts'
import { DatabaseConfigError, readDatabaseUrl } from './db.ts'

/** The server-side names the app cannot start without. */
export type ServerEnv = Record<string, string | undefined>

/** Raised when the server environment is missing one or more required names. */
export class ServerConfigError extends Error {
  readonly missing: string[]

  constructor(missing: string[]) {
    super(
      `The server environment is incomplete: set ${missing.join(', ')}. ` +
        'The app refuses to serve until every required variable is present.',
    )
    this.name = 'ServerConfigError'
    this.missing = missing
  }
}

/**
 * Every required name that is absent or blank, in a stable order (the database
 * URL first, then the auth names). Values never appear in the result.
 */
export function findMissingServerEnv(env: ServerEnv = process.env): string[] {
  const missing: string[] = []

  const collect = (read: () => unknown): void => {
    try {
      read()
    } catch (error) {
      if (
        error instanceof DatabaseConfigError ||
        error instanceof AuthConfigError
      ) {
        missing.push(...error.missing)

        return
      }

      throw error
    }
  }

  collect(() => readDatabaseUrl(env))
  collect(() => readAuthConfig(env))

  return missing
}

/** Throws {@link ServerConfigError} when any required name is absent. */
export function assertServerEnv(env: ServerEnv = process.env): void {
  const missing = findMissingServerEnv(env)

  if (missing.length > 0) {
    throw new ServerConfigError(missing)
  }
}
