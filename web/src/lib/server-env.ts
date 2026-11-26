// web/src/lib/server-env.ts
/**
 * Loads `web/.env` into `process.env` for local runs.
 *
 * Vite reads `.env` for `import.meta.env`, but only `VITE_`-prefixed values
 * reach the browser, and it does not put the server-only names in
 * `process.env`. The database URL and the auth configuration are read from
 * `process.env`, so development needs this file poured in before the first
 * request.
 *
 * `process.loadEnvFile` does not override a name that is already set, so a
 * value the shell (or the acceptance harness) exported wins over the file.
 *
 * This module is imported by `src/start.ts` only in development, and by the
 * operator entry points (`scripts/migrate.ts`, `drizzle.config.ts`). Production
 * reads the platform's environment; nothing here touches a file there.
 */
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** `web/.env`, resolved from this file rather than the caller's cwd. */
const MODULE_ENV_FILE = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../.env',
)

/** The outcome of one load attempt. */
export interface ServerEnvResult {
  loaded: boolean
  file: string | null
  error: Error | null
}

export type EnvReader = (file: string) => void

/**
 * The first candidate that exists. The module-relative copy is the app's
 * `web/.env`; the cwd copy covers tools (drizzle-kit) that bundle this module
 * elsewhere.
 */
export function resolveServerEnvFile(
  candidates: readonly string[] = [
    MODULE_ENV_FILE,
    resolve(process.cwd(), '.env'),
  ],
): string | undefined {
  return candidates.find((candidate) => existsSync(candidate))
}

/**
 * Builds a loader that runs at most once and never throws. `read` is the test
 * seam: production passes Node's `process.loadEnvFile`.
 */
export function createServerEnvLoader(
  read: EnvReader = (file) => process.loadEnvFile(file),
): (file?: string) => ServerEnvResult {
  let result: ServerEnvResult | undefined

  return (file = resolveServerEnvFile()): ServerEnvResult => {
    if (result) {
      return result
    }

    if (!file) {
      result = { loaded: false, file: null, error: null }

      return result
    }

    try {
      read(file)
      result = { loaded: true, file, error: null }
    } catch (cause) {
      if (isMissingFile(cause)) {
        // No `.env` is a normal state; the platform or the shell provides the
        // values instead.
        result = { loaded: false, file, error: null }
      } else {
        // A malformed or unreadable file must not take the process down, and
        // one report is enough for the whole run.
        const error = toError(cause)
        console.error(`web: could not read ${file}: ${error.message}`)
        result = { loaded: false, file, error }
      }
    }

    return result
  }
}

/** The process-wide loader. The first call decides; later calls reuse it. */
export const loadServerEnv = createServerEnvLoader()

function isMissingFile(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'ENOENT'
  )
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}
