// web/src/lib/api/routes.ts
/**
 * The `/api/properties` handlers. Each one is a plain function over a Request
 * and an injectable set of collaborators, so the whole status matrix is
 * testable without a database and the route files stay one-liners.
 *
 * Order at the boundary: identity (401/503), then the same-origin gate on
 * state-changing methods (403), then validation (400), then the query. A
 * database that fails to connect is 503; any other query error is 500 and never
 * carries the driver's text.
 */
import { fail, jsonResponse, ok } from './envelope.ts'
import { databaseFailure } from './errors.ts'
import {
  deleteOwnedPropertyQuery,
  deletedOrNotFound,
  insertOwnedPropertyQuery,
  listOwnedPropertiesQuery,
  parsePropertyId,
  toProperty,
  validateCreateProperty,
} from './properties.ts'
import { readIdentity, assertSameOrigin } from '../auth/session.ts'
import { getDatabase } from '../db.ts'
import type { AppDatabase } from '../db.ts'
import type { IdentityResult } from '../auth/session.ts'
import type { Identity } from '../auth/verifier.ts'

export const UNAUTHORIZED_MESSAGE = 'Unauthorized'
export const AUTH_UNAVAILABLE_MESSAGE =
  'Authentication is temporarily unavailable. Try again shortly.'
export const ORIGIN_REFUSED_MESSAGE = 'Request origin is not allowed'
export const PROPERTY_ID_REQUIRED_MESSAGE = 'Property ID is required'
const INVALID_BODY_MESSAGE = 'Invalid request body'

export interface PropertyRouteDeps {
  identity: (request: Request) => Promise<IdentityResult>
  database: () => AppDatabase
}

/** The production collaborators. Both read their environment per request. */
export function defaultPropertyRouteDeps(): PropertyRouteDeps {
  return {
    identity: readIdentity,
    database: () => getDatabase().db,
  }
}

type Authorization =
  { ok: true; identity: Identity } | { ok: false; response: Response }

async function authorize(
  request: Request,
  deps: PropertyRouteDeps,
  { mutating }: { mutating: boolean },
): Promise<Authorization> {
  const result = await deps.identity(request)

  if (!result.ok) {
    return {
      ok: false,
      response: jsonResponse(
        result.status,
        fail(
          result.status === 401
            ? UNAUTHORIZED_MESSAGE
            : AUTH_UNAVAILABLE_MESSAGE,
        ),
      ),
    }
  }

  if (mutating) {
    const origin = assertSameOrigin(request)

    if (!origin.ok) {
      return {
        ok: false,
        response: jsonResponse(403, fail(ORIGIN_REFUSED_MESSAGE)),
      }
    }
  }

  return { ok: true, identity: result.identity }
}

function failureResponse(error: unknown): Response {
  const failure = databaseFailure(error)

  return jsonResponse(failure.status, fail(failure.message))
}

/** GET /api/properties — the owner's rows, active-first then newest-first. */
export async function handleListProperties(
  request: Request,
  deps: PropertyRouteDeps = defaultPropertyRouteDeps(),
): Promise<Response> {
  const authorization = await authorize(request, deps, { mutating: false })

  if (!authorization.ok) {
    return authorization.response
  }

  try {
    const rows = await listOwnedPropertiesQuery(
      deps.database(),
      authorization.identity.userId,
    )

    return jsonResponse(
      200,
      ok(
        'Properties fetched successfully',
        rows.map((row) => toProperty(row)),
      ),
    )
  } catch (error) {
    return failureResponse(error)
  }
}

/** POST /api/properties — validate, then write the verified owner's row. */
export async function handleCreateProperty(
  request: Request,
  deps: PropertyRouteDeps = defaultPropertyRouteDeps(),
): Promise<Response> {
  const authorization = await authorize(request, deps, { mutating: true })

  if (!authorization.ok) {
    return authorization.response
  }

  let body: unknown

  try {
    body = await request.json()
  } catch {
    return jsonResponse(400, fail(INVALID_BODY_MESSAGE))
  }

  const validated = validateCreateProperty(body, authorization.identity)

  if (!validated.ok) {
    return jsonResponse(validated.status, fail(validated.message))
  }

  try {
    const [row] = await insertOwnedPropertyQuery(
      deps.database(),
      validated.value,
    )

    return jsonResponse(
      201,
      ok('Property created successfully', toProperty(row)),
    )
  } catch (error) {
    return failureResponse(error)
  }
}

/** DELETE /api/properties/:id — matched by id and owner together. */
export async function handleDeleteProperty(
  request: Request,
  rawId: string | undefined,
  deps: PropertyRouteDeps = defaultPropertyRouteDeps(),
): Promise<Response> {
  const authorization = await authorize(request, deps, { mutating: true })

  if (!authorization.ok) {
    return authorization.response
  }

  const id = parsePropertyId(rawId ?? '')

  if (id === null) {
    return jsonResponse(400, fail(PROPERTY_ID_REQUIRED_MESSAGE))
  }

  try {
    const deleted = await deleteOwnedPropertyQuery(
      deps.database(),
      id,
      authorization.identity.userId,
    )
    const mapped = deletedOrNotFound(deleted.length, id)

    if (!mapped.ok) {
      return jsonResponse(mapped.status, fail(mapped.message))
    }

    return jsonResponse(200, ok('Property deleted successfully'))
  } catch (error) {
    return failureResponse(error)
  }
}

/** DELETE /api/properties — no id, so the spec's 400 envelope. */
export async function handleDeleteWithoutId(
  request: Request,
  deps: PropertyRouteDeps = defaultPropertyRouteDeps(),
): Promise<Response> {
  const authorization = await authorize(request, deps, { mutating: true })

  if (!authorization.ok) {
    return authorization.response
  }

  return jsonResponse(400, fail(PROPERTY_ID_REQUIRED_MESSAGE))
}
