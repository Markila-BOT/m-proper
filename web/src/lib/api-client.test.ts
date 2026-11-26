import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { TestContext } from 'node:test'

import { propertiesApi } from './api-client.ts'

// The client's wire contract after the routes moved beside the pages (web-app
// spec "Property calls stay on the app's origin"): every properties call is a
// same-origin `/api` request whose session cookie the browser sends, no token
// is attached, a successful envelope is read, and a failed or unreadable
// answer rejects instead of passing for an empty record.

type FetchCall = {
  url: string
  init: RequestInit | undefined
}

function stubFetch(
  t: TestContext,
  respond: () => Response | Promise<Response>,
): FetchCall[] {
  const calls: FetchCall[] = []

  t.mock.method(
    globalThis,
    'fetch',
    async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init })

      return respond()
    },
  )

  return calls
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function success<T>(data: T, status = 200): Response {
  return json({ message: 'ok', success: true, data }, status)
}

const property = {
  id: 'property-one',
  name: 'One',
  address: '1 Main St',
  type: 'residential',
  units: 2,
  isActive: true,
  createdAt: '2026-11-26T00:00:00.000Z',
} as const

test("requests the properties list on the app's own origin", async (t) => {
  const calls = stubFetch(t, () => success([]))

  await propertiesApi.getAll()

  assert.equal(calls.length, 1)
  assert.equal(calls[0]?.url, '/api/properties')
  assert.equal(calls[0]?.init?.credentials, 'same-origin')
})

test('sends no Authorization header', async (t) => {
  const calls = stubFetch(t, () => success([]))

  await propertiesApi.getAll()

  const headers = new Headers(calls[0]?.init?.headers)

  assert.equal(headers.get('Authorization'), null)
})

test('creates a property through the same-origin collection route', async (t) => {
  const calls = stubFetch(t, () => success(property, 201))

  await propertiesApi.create({
    name: 'One',
    address: '1 Main St',
    type: 'residential',
  })

  assert.equal(calls[0]?.url, '/api/properties')
  assert.equal(calls[0]?.init?.method, 'POST')
})

test('deletes a property through the same-origin item route', async (t) => {
  const calls = stubFetch(t, () => success(undefined))

  await propertiesApi.delete('property-one')

  assert.equal(calls[0]?.url, '/api/properties/property-one')
  assert.equal(calls[0]?.init?.method, 'DELETE')
})

test('returns the data from a successful envelope', async (t) => {
  stubFetch(t, () => success([property]))

  const properties = await propertiesApi.getAll()

  assert.deepEqual(properties, [property])
})

test('rejects with the envelope message when the call is unsuccessful', async (t) => {
  stubFetch(t, () =>
    json(
      {
        message: 'The database is temporarily unavailable. Try again shortly.',
        success: false,
      },
      503,
    ),
  )

  await assert.rejects(propertiesApi.getAll(), {
    message: 'The database is temporarily unavailable. Try again shortly.',
  })
})

test('rejects a non-JSON response with the app message', async (t) => {
  stubFetch(
    t,
    () =>
      new Response('<html>Not found</html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      }),
  )

  await assert.rejects(propertiesApi.getAll(), (error: unknown) => {
    assert.ok(error instanceof Error)
    assert.equal(
      error.message,
      'The server sent an unreadable response. Try again shortly.',
    )

    return true
  })
})

test('rejects when the network request fails', async (t) => {
  stubFetch(t, () => {
    throw new TypeError('fetch failed')
  })

  await assert.rejects(propertiesApi.getAll(), TypeError)
})
