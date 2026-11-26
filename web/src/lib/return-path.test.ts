import assert from 'node:assert/strict'
import { test } from 'node:test'

import { validateReturnPath } from './return-path.ts'

// The one rule every post-auth redirect shares (design §7): a same-origin
// relative path beginning with a single `/`, or the default page.

test('accepts a same-origin relative path', () => {
  assert.equal(
    validateReturnPath('/transactions?property=42&filter=rent'),
    '/transactions?property=42&filter=rent',
  )
})

test('accepts the root path', () => {
  assert.equal(validateReturnPath('/'), '/')
})

test('falls back to the default for a missing value', () => {
  assert.equal(validateReturnPath(undefined), '/')
  assert.equal(validateReturnPath(null), '/')
})

test('falls back to the default for a value that is not a string', () => {
  assert.equal(validateReturnPath(42), '/')
  assert.equal(validateReturnPath({ path: '/overview' }), '/')
})

test('falls back to the default for an empty value', () => {
  assert.equal(validateReturnPath(''), '/')
})

test('rejects an absolute URL', () => {
  assert.equal(validateReturnPath('https://evil.test/steal'), '/')
  assert.equal(validateReturnPath('HTTPS://evil.test/steal'), '/')
})

test('rejects a protocol-relative path', () => {
  assert.equal(validateReturnPath('//evil.test/steal'), '/')
})

test('rejects a value with a scheme', () => {
  assert.equal(validateReturnPath('javascript:alert(1)'), '/')
})

test('rejects a path with a backslash', () => {
  assert.equal(validateReturnPath('/\\evil.test'), '/')
})

test('rejects a path that normalizes to a protocol-relative target', () => {
  assert.equal(validateReturnPath('/..//evil.test'), '/')
})

test('rejects a path with control characters', () => {
  assert.equal(validateReturnPath('/\t/evil.test'), '/')
})
