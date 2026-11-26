import assert from 'node:assert/strict'
import { test } from 'node:test'

import { DatabaseConfigError } from '../db.ts'
import { handleHealth } from './health.ts'
import type { HealthDeps } from './health.ts'

// `/api/health` is a database readiness answer: 200 when a trivial query
// succeeds, 503 with the envelope when it does not. It never throws, so the
// process keeps serving.

function deps(checkDatabase: HealthDeps['checkDatabase']): HealthDeps {
  return { checkDatabase }
}

test('answers 200 when the database answers', async () => {
  const response = await handleHealth(
    deps(async () => {
      return
    }),
  )

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { success: true, message: 'ok' })
})

test('answers 503 when the database is unreachable', async () => {
  const response = await handleHealth(
    deps(async () => {
      throw Object.assign(new Error('connect ECONNREFUSED'), {
        code: 'ECONNREFUSED',
      })
    }),
  )

  assert.equal(response.status, 503)
  assert.deepEqual(await response.json(), {
    success: false,
    message: 'Database unreachable',
  })
})

test('answers 503 when DATABASE_URL is missing', async () => {
  const response = await handleHealth(
    deps(async () => {
      throw new DatabaseConfigError(['DATABASE_URL'])
    }),
  )

  assert.equal(response.status, 503)
})

test('answers 503, not 500, for any probe failure', async () => {
  const response = await handleHealth(
    deps(async () => {
      throw new Error('unexpected')
    }),
  )

  assert.equal(response.status, 503)
})
