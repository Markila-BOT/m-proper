import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, test } from 'node:test'

import { createServerEnvLoader, resolveServerEnvFile } from './server-env.ts'

// The development loader puts web/.env into process.env without overriding the
// values the shell already exported. Production never calls it (start.ts is
// guarded by import.meta.env.DEV); the migration entry points guard on
// NODE_ENV. A missing file is a no-op and an unreadable one is reported once.

const directory = mkdtempSync(join(tmpdir(), 'm-proper-env-'))
let sequence = 0

after(() => {
  rmSync(directory, { recursive: true, force: true })
})

function envFile(contents: string): string {
  const path = join(directory, `env-${sequence}.env`)
  sequence += 1
  writeFileSync(path, contents)

  return path
}

test('loads values from the environment file into process.env', () => {
  const name = 'SERVER_ENV_TEST_LOADED'
  delete process.env[name]
  const load = createServerEnvLoader()

  const result = load(envFile(`${name}=from-file\n`))

  assert.equal(result.loaded, true)
  assert.equal(process.env[name], 'from-file')
  delete process.env[name]
})

test('keeps a value already present in process.env', () => {
  const name = 'SERVER_ENV_TEST_PRESENT'
  process.env[name] = 'from-process'
  const load = createServerEnvLoader()

  load(envFile(`${name}=from-file\n`))

  assert.equal(process.env[name], 'from-process')
  delete process.env[name]
})

test('ignores a missing environment file without reporting it', (t) => {
  const report = t.mock.method(console, 'error', () => {})
  const load = createServerEnvLoader()

  const result = load(join(directory, 'absent.env'))

  assert.equal(result.loaded, false)
  assert.equal(result.error, null)
  assert.equal(report.mock.callCount(), 0)
})

test('reports an unreadable environment file once and keeps running', (t) => {
  const report = t.mock.method(console, 'error', () => {})
  const load = createServerEnvLoader(() => {
    throw new Error('parse failed')
  })
  const file = envFile('IGNORED=1\n')

  const first = load(file)
  const second = load(file)

  assert.equal(first.loaded, false)
  assert.equal(second.loaded, false)
  assert.match(first.error?.message ?? '', /parse failed/)
  assert.equal(report.mock.callCount(), 1)
})

test('reads the environment file at most once', () => {
  let reads = 0
  const load = createServerEnvLoader(() => {
    reads += 1
  })
  const file = envFile('')

  load(file)
  load(file)

  assert.equal(reads, 1)
})

test('resolves the repository web/.env by default', () => {
  assert.match(resolveServerEnvFile() ?? '', /web\/\.env$/)
})
