import assert from 'node:assert/strict'
import { test } from 'node:test'

import { fail, jsonResponse, ok } from './envelope.ts'

// The wire envelope is `{ success, message, data? }` and is unchanged from the
// Rust service and the existing client (web/src/lib/api-client.ts).

test('an ok envelope carries the existing camelCase shape', () => {
  assert.deepEqual(ok('Fetched', [{ id: 'one' }]), {
    success: true,
    message: 'Fetched',
    data: [{ id: 'one' }],
  })
})

test('an ok envelope without data omits the key', () => {
  const envelope = ok('Deleted')

  assert.equal(Object.hasOwn(envelope, 'data'), false)
})

test('a failure envelope carries no data key', () => {
  const envelope = fail('Invalid')

  assert.deepEqual(envelope, { success: false, message: 'Invalid' })
  assert.equal(Object.hasOwn(envelope, 'data'), false)
})

test('builds a JSON response with the given status', async () => {
  const response = jsonResponse(201, ok('Created', { id: 'one' }))

  assert.equal(response.status, 201)
  assert.equal(response.headers.get('content-type'), 'application/json')
  assert.deepEqual(await response.json(), {
    success: true,
    message: 'Created',
    data: { id: 'one' },
  })
})
