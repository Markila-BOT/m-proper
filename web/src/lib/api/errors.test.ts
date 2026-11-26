import assert from 'node:assert/strict'
import { test } from 'node:test'

import { DatabaseConfigError } from '../db.ts'
import { databaseFailure } from './errors.ts'

// A query can fail because the database is unreachable (503: retry) or because
// the statement is wrong (500: an operator problem). The two must never be
// conflated, and no error text may leak to the caller.

function coded(code: string): Error {
  return Object.assign(new Error(`boom: ${code}`), { code })
}

test('maps a missing DATABASE_URL to 503', () => {
  assert.deepEqual(databaseFailure(new DatabaseConfigError(['DATABASE_URL'])), {
    status: 503,
    message: 'The database is not configured. Try again shortly.',
  })
})

for (const code of [
  '08000',
  '08006',
  '57P01',
  '57P02',
  '57P03',
  '53300',
  'ECONNREFUSED',
  'ECONNRESET',
  'ENOTFOUND',
  'ETIMEDOUT',
  'EPIPE',
  'CONNECT_TIMEOUT',
  'CONNECTION_CLOSED',
  'CONNECTION_ENDED',
  'CONNECTION_DESTROYED',
]) {
  test(`treats ${code} as an unavailable database`, () => {
    assert.deepEqual(databaseFailure(coded(code)), {
      status: 503,
      message: 'The database is temporarily unavailable. Try again shortly.',
    })
  })
}

test('treats an uncoded connection failure as unavailable', () => {
  assert.equal(
    databaseFailure(new Error('connect ECONNREFUSED 127.0.0.1:5432')).status,
    503,
  )
})

for (const code of ['23505', '42601', '42P01', '22001']) {
  test(`treats SQLSTATE ${code} as a server error`, () => {
    assert.deepEqual(databaseFailure(coded(code)), {
      status: 500,
      message: 'Internal server error',
    })
  })
}

test('does not leak the query error text', () => {
  const failure = databaseFailure(
    Object.assign(new Error('syntax error near secret_table'), {
      code: '42601',
    }),
  )

  assert.doesNotMatch(failure.message, /secret_table/)
})

test('treats a non-error value as a server error', () => {
  assert.deepEqual(databaseFailure('unexpected'), {
    status: 500,
    message: 'Internal server error',
  })
})
