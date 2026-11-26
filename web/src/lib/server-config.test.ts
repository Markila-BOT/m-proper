import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  ServerConfigError,
  assertServerEnv,
  findMissingServerEnv,
} from './server-config.ts'

// The start entry validates the server environment once, at module load, so a
// missing value fails every request instead of one route halfway through. The
// check reuses the database and auth readers, so a name added there appears
// here without a second list to maintain.

const completeEnv = {
  DATABASE_URL: 'postgres://user:secret@db.test/app',
  SUPABASE_URL: 'https://ref.supabase.co',
  SUPABASE_JWKS_URL: 'https://ref.supabase.co/auth/v1/.well-known/jwks.json',
  SUPABASE_JWT_ISSUER: 'https://ref.supabase.co/auth/v1',
  SUPABASE_JWT_AUD: 'authenticated',
}

test('accepts a complete server environment', () => {
  assert.doesNotThrow(() => assertServerEnv(completeEnv))
  assert.deepEqual(findMissingServerEnv(completeEnv), [])
})

test('names every missing required variable at once', () => {
  assert.throws(
    () => assertServerEnv({}),
    (error: unknown) => {
      assert.ok(error instanceof ServerConfigError)
      assert.deepEqual(error.missing, [
        'DATABASE_URL',
        'SUPABASE_URL',
        'SUPABASE_JWKS_URL',
        'SUPABASE_JWT_ISSUER',
        'SUPABASE_JWT_AUD',
      ])

      return true
    },
  )
})

test('names a missing JWKS location', () => {
  assert.throws(
    () => assertServerEnv({ ...completeEnv, SUPABASE_JWKS_URL: undefined }),
    (error: unknown) => {
      assert.ok(error instanceof ServerConfigError)
      assert.deepEqual(error.missing, ['SUPABASE_JWKS_URL'])
      assert.match(error.message, /SUPABASE_JWKS_URL/)

      return true
    },
  )
})

test('names a missing database URL', () => {
  assert.throws(
    () => assertServerEnv({ ...completeEnv, DATABASE_URL: '   ' }),
    (error: unknown) => {
      assert.ok(error instanceof ServerConfigError)
      assert.deepEqual(error.missing, ['DATABASE_URL'])

      return true
    },
  )
})

test('reports names without exposing configured values', () => {
  assert.throws(
    () => assertServerEnv({ ...completeEnv, SUPABASE_JWT_AUD: '' }),
    (error: unknown) => {
      assert.ok(error instanceof ServerConfigError)
      assert.doesNotMatch(error.message, /user:secret/)
      assert.doesNotMatch(error.message, /ref\.supabase\.co/)

      return true
    },
  )
})
