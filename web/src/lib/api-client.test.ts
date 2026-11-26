import assert from 'node:assert/strict'
import { test } from 'node:test'

import { authorizedFetch } from './api-client.ts'
import type { AuthorizedFetchDeps } from './api-client.ts'

// The authenticated fetch's decision table (design §8, web-app spec "API
// requests carry the landlord's access token"): every call carries the
// bearer, a 401 gets exactly one refresh-and-retry, a second 401 or a
// failed refresh signs out, and a 503 stays the unreachable response so an
// auth outage never clears the session.

type FetchCall = {
  url: string
  init: RequestInit | undefined
  authorization: string | null
}

type FakeOptions = {
  token?: string | null
  refreshed?: string | null
  refreshThrows?: boolean
  responses: ReadonlyArray<number>
}

function respond(status: number): Response {
  return new Response(
    JSON.stringify({
      message: status < 400 ? 'ok' : 'refused',
      success: status < 400,
    }),
    { status, headers: { 'Content-Type': 'application/json' } },
  )
}

function fakeDeps(options: FakeOptions): {
  deps: AuthorizedFetchDeps
  calls: FetchCall[]
  counts: { refreshes: number; signOuts: number }
} {
  const calls: FetchCall[] = []
  const counts = { refreshes: 0, signOuts: 0 }
  const responses = [...options.responses]

  const deps: AuthorizedFetchDeps = {
    getToken: async () =>
      options.token === undefined ? 'current-token' : options.token,
    refresh: async () => {
      counts.refreshes += 1

      if (options.refreshThrows) {
        throw new Error('refresh failed')
      }

      return options.refreshed ?? null
    },
    signOut: async () => {
      counts.signOuts += 1
    },
    fetch: async (url, init) => {
      calls.push({
        url,
        init,
        authorization: new Headers(init?.headers).get('Authorization'),
      })

      const status = responses.shift()

      if (status === undefined) {
        throw new Error('unexpected fetch call')
      }

      return respond(status)
    },
  }

  return { deps, calls, counts }
}

test('sends the access token as a bearer credential', async () => {
  const { deps, calls, counts } = fakeDeps({
    token: 'token-one',
    responses: [200],
  })

  const response = await authorizedFetch(
    'http://api.test/properties',
    undefined,
    deps,
  )

  assert.equal(response.status, 200)
  assert.equal(calls.length, 1)
  assert.equal(calls[0]?.authorization, 'Bearer token-one')
  assert.deepEqual(counts, { refreshes: 0, signOuts: 0 })
})

test('refreshes once and retries with the new token after a 401', async () => {
  const { deps, calls, counts } = fakeDeps({
    token: 'stale-token',
    refreshed: 'fresh-token',
    responses: [401, 200],
  })

  const response = await authorizedFetch(
    'http://api.test/properties',
    undefined,
    deps,
  )

  assert.equal(response.status, 200)
  assert.equal(calls.length, 2)
  assert.equal(calls[1]?.authorization, 'Bearer fresh-token')
  assert.deepEqual(counts, { refreshes: 1, signOuts: 0 })
})

test('signs out when the retried request is also a 401', async () => {
  const { deps, calls, counts } = fakeDeps({
    token: 'stale-token',
    refreshed: 'fresh-token',
    responses: [401, 401],
  })

  await assert.rejects(
    authorizedFetch('http://api.test/properties', undefined, deps),
    Error,
  )

  assert.equal(calls.length, 2)
  assert.deepEqual(counts, { refreshes: 1, signOuts: 1 })
})

test('signs out when the refresh returns no session', async () => {
  const { deps, calls, counts } = fakeDeps({
    token: 'stale-token',
    refreshed: null,
    responses: [401],
  })

  await assert.rejects(
    authorizedFetch('http://api.test/properties', undefined, deps),
    Error,
  )

  assert.equal(calls.length, 1)
  assert.deepEqual(counts, { refreshes: 1, signOuts: 1 })
})

test('signs out when the refresh throws', async () => {
  const { deps, calls, counts } = fakeDeps({
    token: 'stale-token',
    refreshThrows: true,
    responses: [401],
  })

  await assert.rejects(
    authorizedFetch('http://api.test/properties', undefined, deps),
    Error,
  )

  assert.equal(calls.length, 1)
  assert.deepEqual(counts, { refreshes: 1, signOuts: 1 })
})

test('keeps a 503 as the unreachable response without signing out', async () => {
  const { deps, calls, counts } = fakeDeps({ responses: [503] })

  const response = await authorizedFetch(
    'http://api.test/properties',
    undefined,
    deps,
  )

  assert.equal(response.status, 503)
  assert.equal(calls.length, 1)
  assert.deepEqual(counts, { refreshes: 0, signOuts: 0 })
})

test('rejects without a network call when there is no session', async () => {
  const { deps, calls, counts } = fakeDeps({ token: null, responses: [] })

  await assert.rejects(
    authorizedFetch('http://api.test/properties', undefined, deps),
    Error,
  )

  assert.equal(calls.length, 0)
  assert.deepEqual(counts, { refreshes: 0, signOuts: 0 })
})

test('keeps the request method, body, and headers beside the credential', async () => {
  const { deps, calls } = fakeDeps({ token: 'token-one', responses: [200] })

  await authorizedFetch(
    'http://api.test/properties',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"name":"One"}',
    },
    deps,
  )

  const init = calls[0].init

  if (!init) {
    throw new Error('expected the request init')
  }

  const headers = new Headers(init.headers)

  assert.equal(init.method, 'POST')
  assert.equal(init.body, '{"name":"One"}')
  assert.equal(headers.get('Content-Type'), 'application/json')
  assert.equal(headers.get('Authorization'), 'Bearer token-one')
})
