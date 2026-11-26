import assert from 'node:assert/strict'
import { test } from 'node:test'

import { parseLinkPayload } from './auth-payload.ts'

// The confirmation and recovery links share one reading of the payload
// (authentication spec, "A recovery session sets a new password"). A PKCE
// `code` or a token hash opens the link; the token hash reaches the server
// both as the URL's `token_hash` and as the routes' `tokenHash`.

test('reads a token hash the routes send in camelCase', () => {
  assert.equal(
    parseLinkPayload({ tokenHash: 'hash-from-route' }).tokenHash,
    'hash-from-route',
  )
})

test('reads a token hash the link spells in snake_case', () => {
  assert.equal(
    parseLinkPayload({ token_hash: 'hash-from-url' }).tokenHash,
    'hash-from-url',
  )
})

test('prefers the camelCase token hash when both are present', () => {
  const payload = parseLinkPayload({
    tokenHash: 'hash-from-route',
    token_hash: 'hash-from-url',
  })

  assert.equal(payload.tokenHash, 'hash-from-route')
})

test('reads a PKCE code', () => {
  assert.equal(parseLinkPayload({ code: 'pkce-code' }).code, 'pkce-code')
})

test('reads neither a code nor a token hash from an empty payload', () => {
  const payload = parseLinkPayload({})

  assert.equal(payload.code, undefined)
  assert.equal(payload.tokenHash, undefined)
})
