// web/src/lib/api/properties.integration.ts
/**
 * Real-database checks for the properties routes, ported in intent from
 * `api/tests/ownership.rs`.
 *
 * These run only when the process environment supplies a database and both
 * seeded landlord ids; otherwise the test is skipped with a printed notice so
 * `test:unit` stays offline. Run them with:
 *
 *   DATABASE_URL='postgresql://…' \
 *   TEST_OWNER_A_ID='<seeded landlord A uuid>' \
 *   TEST_OWNER_B_ID='<seeded landlord B uuid>' \
 *   pnpm --filter web test:integration
 *
 * What it touches: only rows it creates itself, named `api-integration-<tag>-…`
 * with a fresh tag per run. Cleanup matches that prefix even when an assertion
 * panics. It never reads, updates, or deletes an existing row, and it runs no
 * migrations.
 *
 * The direct Data API refusal (a `/rest/v1/properties` request) is proven by
 * the acceptance suite, which owns the network; this file never calls it.
 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'

import { closeDatabase, createDatabase } from '../db.ts'
import type { DatabaseConnection } from '../db.ts'
import type { ApiEnvelope } from './envelope.ts'
import type { Property } from '../domain.ts'
import {
  handleCreateProperty,
  handleDeleteProperty,
  handleListProperties,
} from './routes.ts'
import type { PropertyRouteDeps } from './routes.ts'

const APP_ORIGIN = 'https://app.test'
const NAME_PREFIX = 'api-integration'

function envValue(name: string): string | null {
  const value = process.env[name]?.trim()

  return value ? value : null
}

function ownerId(name: string): string | null {
  const value = envValue(name)

  if (!value) {
    return null
  }

  const canonical =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

  return canonical.test(value) ? value.toLowerCase() : null
}

function skipNotice(): string | null {
  if (!envValue('DATABASE_URL')) {
    return 'DATABASE_URL is not set; this test needs the Supabase Postgres it names'
  }

  if (!ownerId('TEST_OWNER_A_ID') || !ownerId('TEST_OWNER_B_ID')) {
    return 'TEST_OWNER_A_ID and TEST_OWNER_B_ID must hold seeded landlord ids (see `pnpm run seed:auth`)'
  }

  return null
}

function depsFor(
  userId: string,
  connection: DatabaseConnection,
): PropertyRouteDeps {
  return {
    identity: async () => ({
      ok: true,
      identity: { userId, email: null },
    }),
    database: () => connection.db,
  }
}

function createRequest(payload: unknown): Request {
  return new Request(`${APP_ORIGIN}/api/properties`, {
    method: 'POST',
    headers: { origin: APP_ORIGIN, 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

function listRequest(): Request {
  return new Request(`${APP_ORIGIN}/api/properties`)
}

function deleteRequest(id: string): Request {
  return new Request(`${APP_ORIGIN}/api/properties/${id}`, {
    method: 'DELETE',
    headers: { origin: APP_ORIGIN },
  })
}

async function envelope<T>(response: Response): Promise<ApiEnvelope<T>> {
  return (await response.json()) as ApiEnvelope<T>
}

const skip = skipNotice()

if (skip) {
  console.log(`properties integration test skipped: ${skip}`)
  test('properties integration (real database)', { skip }, () => {})
} else {
  test('scopes listings and deletes by owner against the real database', async () => {
    const databaseUrl = envValue('DATABASE_URL')
    const ownerA = ownerId('TEST_OWNER_A_ID')
    const ownerB = ownerId('TEST_OWNER_B_ID')

    assert.ok(databaseUrl)
    assert.ok(ownerA)
    assert.ok(ownerB)

    const tag = randomUUID().replaceAll('-', '')
    const prefix = `${NAME_PREFIX}-${tag}-`
    const connection = createDatabase(databaseUrl)

    try {
      const depsA = depsFor(ownerA, connection)
      const depsB = depsFor(ownerB, connection)

      // Owner A's payload carries every body-owner shape; none may reach the row.
      const createdA = await handleCreateProperty(
        createRequest({
          name: `${prefix}a`,
          address: `${prefix}a address`,
          type: 'residential',
          units: 2,
          ownerId: ownerB,
          owner_id: ownerB,
          owner: ownerB,
        }),
        depsA,
      )
      assert.equal(createdA.status, 201, 'owner A should create its row')
      const propertyA = (await envelope<Property>(createdA)).data
      assert.ok(propertyA, 'the create response carries the property')
      assert.equal(propertyA.units, 2)

      const createdB = await handleCreateProperty(
        createRequest({
          name: `${prefix}b`,
          address: `${prefix}b address`,
          type: 'commercial',
          isActive: false,
        }),
        depsB,
      )
      assert.equal(createdB.status, 201, 'owner B should create its row')
      const propertyB = (await envelope<Property>(createdB)).data
      assert.ok(propertyB, 'the create response carries the property')

      // List scoping: A sees its own row and never B's, and vice versa. The
      // body owner A sent (B) was ignored, so the row is A's.
      const listedA = await handleListProperties(listRequest(), depsA)
      assert.equal(listedA.status, 200)
      const rowsA = (await envelope<Property[]>(listedA)).data ?? []
      assert.ok(
        rowsA.some((row) => row.id === propertyA.id),
        'owner A should see the row it created',
      )
      assert.ok(
        !rowsA.some((row) => row.id === propertyB.id),
        "owner B's row must not leak into owner A's listing",
      )

      const listedB = await handleListProperties(listRequest(), depsB)
      assert.equal(listedB.status, 200)
      const rowsB = (await envelope<Property[]>(listedB)).data ?? []
      assert.ok(
        rowsB.some((row) => row.id === propertyB.id),
        'owner B should see the row it created',
      )
      assert.ok(
        !rowsB.some((row) => row.id === propertyA.id),
        "owner A's row must not leak into owner B's listing",
      )

      // A foreign delete matches zero rows and answers exactly what an unknown
      // id answers: the same status and envelope shape, with no data.
      const unknownId = randomUUID()
      const foreign = await handleDeleteProperty(
        deleteRequest(propertyA.id),
        propertyA.id,
        depsB,
      )
      const unknown = await handleDeleteProperty(
        deleteRequest(unknownId),
        unknownId,
        depsB,
      )

      assert.equal(foreign.status, 404)
      assert.equal(unknown.status, 404)
      const foreignBody = await envelope(foreign)
      const unknownBody = await envelope(unknown)
      assert.equal(foreignBody.success, false)
      assert.equal(unknownBody.success, false)
      assert.equal(Object.hasOwn(foreignBody, 'data'), false)
      assert.equal(Object.hasOwn(unknownBody, 'data'), false)

      const afterForeign = await handleListProperties(listRequest(), depsA)
      const surviving = (await envelope<Property[]>(afterForeign)).data ?? []
      assert.ok(
        surviving.some((row) => row.id === propertyA.id),
        'a foreign delete must leave the row in place',
      )

      // The owner's own delete removes exactly that row.
      const deleted = await handleDeleteProperty(
        deleteRequest(propertyA.id),
        propertyA.id,
        depsA,
      )
      assert.equal(deleted.status, 200)
      assert.deepEqual(await envelope(deleted), {
        success: true,
        message: 'Property deleted successfully',
      })

      const afterDelete = await handleListProperties(listRequest(), depsA)
      const remaining = (await envelope<Property[]>(afterDelete)).data ?? []
      assert.ok(
        !remaining.some((row) => row.id === propertyA.id),
        'the deleted row is still listed',
      )
    } finally {
      // Only this run's rows: the prefix carries a fresh tag.
      try {
        await connection.client`delete from properties where name like ${prefix + '%'}`
      } finally {
        await connection.client.end({ timeout: 5 })
        await closeDatabase()
      }
    }
  })
}
