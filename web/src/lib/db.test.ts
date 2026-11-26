import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'

import {
  DatabaseConfigError,
  closeDatabase,
  createDatabase,
  getDatabase,
  readDatabaseUrl,
} from './db.ts'

// The runtime connection is created lazily from DATABASE_URL and is never a
// migration target (ADR-0011). Importing this module must not connect or throw;
// a missing variable is reported when a request needs the database.

const UNUSED_URL = 'postgres://unused:unused@127.0.0.1:1/unused'

afterEach(async () => {
  await closeDatabase()
})

test('reads DATABASE_URL from the environment', () => {
  assert.equal(
    readDatabaseUrl({ DATABASE_URL: '  postgres://db.test/app  ' }),
    'postgres://db.test/app',
  )
})

test('reports a missing DATABASE_URL by name', () => {
  assert.throws(
    () => readDatabaseUrl({}),
    (error: unknown) =>
      error instanceof DatabaseConfigError &&
      error.missing.includes('DATABASE_URL') &&
      /DATABASE_URL/.test(error.message),
  )
})

test('reports a blank DATABASE_URL as missing', () => {
  assert.throws(() => readDatabaseUrl({ DATABASE_URL: '   ' }), {
    name: 'DatabaseConfigError',
  })
})

test('creates a pooled client with prepared statements disabled', async () => {
  const connection = createDatabase(UNUSED_URL)

  try {
    assert.equal(connection.client.options.prepare, false)
    assert.ok(
      connection.client.options.max <= 5,
      'the functions run with a small pool',
    )
    assert.equal(connection.url, UNUSED_URL)
  } finally {
    await connection.client.end({ timeout: 1 })
  }
})

test('creates the database lazily without opening a connection', async () => {
  // 127.0.0.1:1 refuses connections, so reaching the network here would throw.
  const connection = getDatabase({ DATABASE_URL: UNUSED_URL })

  try {
    assert.ok(connection.db, 'the Drizzle client is built on demand')
  } finally {
    await closeDatabase()
  }
})

test('reuses one connection for the same URL', () => {
  const env = { DATABASE_URL: UNUSED_URL }

  assert.equal(getDatabase(env), getDatabase(env))
})

test('refuses to build a connection without DATABASE_URL', () => {
  assert.throws(() => getDatabase({}), { name: 'DatabaseConfigError' })
})
