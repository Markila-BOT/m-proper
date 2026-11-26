import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const run = promisify(execFile)
const script = resolve(dirname(fileURLToPath(import.meta.url)), 'migrate.ts')

function envWithout(...names: string[]): NodeJS.ProcessEnv {
  const env = { ...process.env }
  for (const name of names) delete env[name]
  return env
}

test('refuses to run, and to fall back to the pooled URL, without DIRECT_DATABASE_URL', async () => {
  const env = envWithout('DIRECT_DATABASE_URL')
  // A pooled URL is present, but it is not a migration target. Production is
  // the mode that reads no web/.env, so the missing name must reach the guard.
  env.NODE_ENV = 'production'
  env.DATABASE_URL = 'postgres://pooled.invalid:6543/postgres'

  const outcome = await run(
    process.execPath,
    ['--experimental-strip-types', script],
    { env },
  ).then(
    () => ({ code: 0, stderr: '' }),
    (error: { code?: number; stderr?: string }) => ({
      code: error.code ?? 1,
      stderr: String(error.stderr ?? ''),
    }),
  )

  assert.notEqual(outcome.code, 0)
  assert.match(outcome.stderr, /DIRECT_DATABASE_URL/)
})
