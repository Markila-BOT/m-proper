import assert from 'node:assert/strict'
import { test } from 'node:test'

import type { AppDatabase } from '../db.ts'
import { DatabaseConfigError } from '../db.ts'
import {
  handleCreateProperty,
  handleDeleteProperty,
  handleDeleteWithoutId,
  handleListProperties,
} from './routes.ts'
import type { PropertyRouteDeps } from './routes.ts'

// The route boundary's status matrix, without a database or a network. Identity
// and the database are the collaborators; validation and the 404 rule are the
// modules' own behaviour (tested in properties.test.ts).

const OWNER = '0f8fad5b-d9cb-469f-a165-70867728950e'
const APP_ORIGIN = 'https://app.test'

const authorized = async () => ({
  ok: true as const,
  identity: { userId: OWNER, email: null },
})

function databaseNotCalled(): () => AppDatabase {
  return () => {
    throw new Error('the database must not be reached on this path')
  }
}

function databaseFailing(error: unknown): () => AppDatabase {
  return () =>
    ({
      select: () => {
        throw error
      },
      insert: () => {
        throw error
      },
      delete: () => {
        throw error
      },
    }) as unknown as AppDatabase
}

function deps(overrides: Partial<PropertyRouteDeps> = {}): PropertyRouteDeps {
  return {
    identity: authorized,
    database: databaseNotCalled(),
    ...overrides,
  }
}

function request(
  path: string,
  method = 'GET',
  {
    body,
    headers = {},
  }: { body?: unknown; headers?: Record<string, string> } = {},
): Request {
  return new Request(`${APP_ORIGIN}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}

function sameOrigin(method: string, path: string, body?: unknown): Request {
  return request(path, method, { body, headers: { origin: APP_ORIGIN } })
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Riverside Duplex',
    address: '12 River Road',
    type: 'residential',
    ...overrides,
  }
}

async function readBody(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>
}

// 401: no verified identity. The response carries no data.

test('list answers 401 without an identity', async () => {
  const response = await handleListProperties(
    request('/api/properties'),
    deps({ identity: async () => ({ ok: false, status: 401 }) }),
  )

  assert.equal(response.status, 401)
  assert.deepEqual(await readBody(response), {
    success: false,
    message: 'Unauthorized',
  })
})

test('list answers 503 when the key set is unavailable', async () => {
  const response = await handleListProperties(
    request('/api/properties'),
    deps({ identity: async () => ({ ok: false, status: 503 }) }),
  )

  assert.equal(response.status, 503)
  assert.deepEqual(await readBody(response), {
    success: false,
    message: 'Authentication is temporarily unavailable. Try again shortly.',
  })
})

test('list answers 503 when the database is unreachable', async () => {
  const error = Object.assign(new Error('connect ECONNREFUSED'), {
    code: 'ECONNREFUSED',
  })

  const response = await handleListProperties(
    request('/api/properties'),
    deps({ database: databaseFailing(error) }),
  )

  assert.equal(response.status, 503)
  assert.deepEqual(await readBody(response), {
    success: false,
    message: 'The database is temporarily unavailable. Try again shortly.',
  })
})

test('list answers 500 for a query error and leaks no detail', async () => {
  const error = Object.assign(new Error('syntax error near secret_table'), {
    code: '42601',
  })

  const response = await handleListProperties(
    request('/api/properties'),
    deps({ database: databaseFailing(error) }),
  )

  assert.equal(response.status, 500)
  const envelope = await readBody(response)
  assert.deepEqual(envelope, {
    success: false,
    message: 'Internal server error',
  })
  assert.doesNotMatch(JSON.stringify(envelope), /secret_table/)
})

test('list does not require an Origin header', async () => {
  const response = await handleListProperties(
    request('/api/properties'),
    deps({ identity: async () => ({ ok: false, status: 401 }) }),
  )

  assert.equal(response.status, 401)
})

// POST: identity, then the same-origin gate, then validation. The body owner is
// never read (properties.test.ts proves it at the validation boundary).

test('create answers 401 without an identity', async () => {
  const response = await handleCreateProperty(
    sameOrigin('POST', '/api/properties', validBody()),
    deps({ identity: async () => ({ ok: false, status: 401 }) }),
  )

  assert.equal(response.status, 401)
})

test('create answers 403 for a cross-origin request', async () => {
  const response = await handleCreateProperty(
    request('/api/properties', 'POST', {
      body: validBody(),
      headers: { origin: 'https://evil.test' },
    }),
    deps(),
  )

  assert.equal(response.status, 403)
  assert.deepEqual(await readBody(response), {
    success: false,
    message: 'Request origin is not allowed',
  })
})

test('create answers 403 with neither Origin nor Sec-Fetch-Site', async () => {
  const response = await handleCreateProperty(
    request('/api/properties', 'POST', { body: validBody() }),
    deps(),
  )

  assert.equal(response.status, 403)
})

test('create answers 400 for an invalid body without querying', async () => {
  const response = await handleCreateProperty(
    sameOrigin('POST', '/api/properties', { ...validBody(), units: -1 }),
    deps(),
  )

  assert.equal(response.status, 400)
  assert.equal((await readBody(response)).success, false)
})

test('create answers 400 for an unparsable JSON body', async () => {
  const response = await handleCreateProperty(
    new Request(`${APP_ORIGIN}/api/properties`, {
      method: 'POST',
      headers: { origin: APP_ORIGIN, 'content-type': 'application/json' },
      body: 'not json',
    }),
    deps(),
  )

  assert.equal(response.status, 400)
})

test('create answers 503 when the database is unreachable', async () => {
  const error = new DatabaseConfigError(['DATABASE_URL'])

  const response = await handleCreateProperty(
    sameOrigin('POST', '/api/properties', validBody()),
    deps({ database: databaseFailing(error) }),
  )

  assert.equal(response.status, 503)
})

test('create answers 500 for a query error', async () => {
  const response = await handleCreateProperty(
    sameOrigin('POST', '/api/properties', validBody()),
    deps({
      database: databaseFailing(
        Object.assign(new Error('bad statement'), { code: '42601' }),
      ),
    }),
  )

  assert.equal(response.status, 500)
})

// DELETE by id: identity, origin, then id parsing. An unparsable id is a 400
// and never reaches the query.

test('delete answers 401 without an identity', async () => {
  const response = await handleDeleteProperty(
    sameOrigin('DELETE', '/api/properties/not-a-uuid'),
    'not-a-uuid',
    deps({ identity: async () => ({ ok: false, status: 401 }) }),
  )

  assert.equal(response.status, 401)
})

test('delete answers 403 for a cross-origin request', async () => {
  const response = await handleDeleteProperty(
    request('/api/properties/9b1c3f22-6a1e-4f8f-9f0e-2c3b4a5d6e7f', 'DELETE', {
      headers: { origin: 'https://evil.test' },
    }),
    '9b1c3f22-6a1e-4f8f-9f0e-2c3b4a5d6e7f',
    deps(),
  )

  assert.equal(response.status, 403)
})

test('delete answers 400 for an unparsable id without querying', async () => {
  const response = await handleDeleteProperty(
    sameOrigin('DELETE', '/api/properties/not-a-uuid'),
    'not-a-uuid',
    deps(),
  )

  assert.equal(response.status, 400)
  assert.deepEqual(await readBody(response), {
    success: false,
    message: 'Property ID is required',
  })
})

test('delete answers 400 for an empty id', async () => {
  const response = await handleDeleteProperty(
    sameOrigin('DELETE', '/api/properties/'),
    '',
    deps(),
  )

  assert.equal(response.status, 400)
})

test('delete answers 503 when the database is unreachable', async () => {
  const error = Object.assign(new Error('connection terminated'), {
    code: 'CONNECTION_ENDED',
  })

  const response = await handleDeleteProperty(
    sameOrigin(
      'DELETE',
      '/api/properties/9b1c3f22-6a1e-4f8f-9f0e-2c3b4a5d6e7f',
    ),
    '9b1c3f22-6a1e-4f8f-9f0e-2c3b4a5d6e7f',
    deps({ database: databaseFailing(error) }),
  )

  assert.equal(response.status, 503)
})

test('delete answers 500 for a query error', async () => {
  const response = await handleDeleteProperty(
    sameOrigin(
      'DELETE',
      '/api/properties/9b1c3f22-6a1e-4f8f-9f0e-2c3b4a5d6e7f',
    ),
    '9b1c3f22-6a1e-4f8f-9f0e-2c3b4a5d6e7f',
    deps({
      database: databaseFailing(
        Object.assign(new Error('permission denied'), { code: '42501' }),
      ),
    }),
  )

  assert.equal(response.status, 500)
})

// DELETE without an id: a distinct handler that keeps the spec's 400 envelope,
// behind the same identity and origin gates.

test('delete without an id answers 401 without an identity', async () => {
  const response = await handleDeleteWithoutId(
    sameOrigin('DELETE', '/api/properties'),
    deps({ identity: async () => ({ ok: false, status: 401 }) }),
  )

  assert.equal(response.status, 401)
})

test('delete without an id answers 403 for a cross-origin request', async () => {
  const response = await handleDeleteWithoutId(
    request('/api/properties', 'DELETE', {
      headers: { origin: 'https://evil.test' },
    }),
    deps(),
  )

  assert.equal(response.status, 403)
})

test('delete without an id answers the 400 envelope', async () => {
  const response = await handleDeleteWithoutId(
    sameOrigin('DELETE', '/api/properties'),
    deps(),
  )

  assert.equal(response.status, 400)
  assert.deepEqual(await readBody(response), {
    success: false,
    message: 'Property ID is required',
  })
})
