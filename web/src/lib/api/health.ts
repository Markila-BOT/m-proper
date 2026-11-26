// web/src/lib/api/health.ts
/**
 * `GET /api/health` is a readiness probe (design §8): it runs one trivial query
 * and answers 503 — never throws — when the database cannot be reached, so a
 * database outage does not take the process down.
 */
import { checkDatabase as probeDatabase } from '../db.ts'
import { fail, jsonResponse, ok } from './envelope.ts'

const UNREACHABLE_MESSAGE = 'Database unreachable'

export interface HealthDeps {
  checkDatabase: () => Promise<void>
}

export function defaultHealthDeps(): HealthDeps {
  return { checkDatabase: () => probeDatabase() }
}

export async function handleHealth(
  deps: HealthDeps = defaultHealthDeps(),
): Promise<Response> {
  try {
    await deps.checkDatabase()

    return jsonResponse(200, ok('ok'))
  } catch {
    return jsonResponse(503, fail(UNREACHABLE_MESSAGE))
  }
}
