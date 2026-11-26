import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  apiNotFoundResponse,
  isApiPath,
  shouldAnswerApiNotFound,
} from './fallback.ts'

// An unmatched `/api/*` must answer the JSON envelope, never the app's HTML
// not-found page. A server route's own JSON 404 (a foreign property) must pass
// straight through.

const HTML = new Response('<html>not found</html>', {
  status: 404,
  headers: { 'content-type': 'text/html; charset=utf-8' },
})

const JSON_RESPONSE = new Response(JSON.stringify({ success: false }), {
  status: 404,
  headers: { 'content-type': 'application/json' },
})

test('recognises the API path family', () => {
  assert.equal(isApiPath('/api'), true)
  assert.equal(isApiPath('/api/'), true)
  assert.equal(isApiPath('/api/properties'), true)
  assert.equal(isApiPath('/api/anything/deeper'), true)
})

test('does not treat a page path as an API path', () => {
  assert.equal(isApiPath('/apian'), false)
  assert.equal(isApiPath('/properties'), false)
  assert.equal(isApiPath('/'), false)
})

test('rewrites the HTML not-found page for an unmatched API path', () => {
  assert.equal(shouldAnswerApiNotFound('/api/unknown', HTML), true)
})

test('leaves the app HTML not-found page alone outside /api', () => {
  assert.equal(shouldAnswerApiNotFound('/unknown', HTML), false)
})

test('leaves a JSON 404 from a route alone', () => {
  assert.equal(
    shouldAnswerApiNotFound('/api/properties/unknown', JSON_RESPONSE),
    false,
  )
})

test('builds the JSON 404 envelope', async () => {
  const response = apiNotFoundResponse()

  assert.equal(response.status, 404)
  assert.equal(response.headers.get('content-type'), 'application/json')
  assert.deepEqual(await response.json(), {
    success: false,
    message: 'Not found',
  })
})
