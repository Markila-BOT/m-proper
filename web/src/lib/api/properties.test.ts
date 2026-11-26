import assert from 'node:assert/strict'
import { after, test } from 'node:test'

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import * as schema from '../../../db/schema.ts'
import {
  deleteOwnedPropertyQuery,
  deletedOrNotFound,
  insertOwnedPropertyQuery,
  listOwnedPropertiesQuery,
  parsePropertyId,
  toProperty,
  validateCreateProperty,
} from './properties.ts'
import type { PropertyRow } from './properties.ts'

// Validation mirrors `api/src/routes/properties.rs::NewProperty::from_request`
// and the properties spec: required trimmed name/address/type, the closed type
// enum, units absent/null/>= 0, an optional boolean isActive, and an owner that
// only ever comes from the verified identity.

const OWNER = { userId: '0f8fad5b-d9cb-469f-a165-70867728950e' }
const OTHER_OWNER = '3b7d4f7c-5a1e-4d76-9a1f-2c9b8e6a4d10'

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Riverside Duplex',
    address: '12 River Road',
    type: 'residential',
    ...overrides,
  }
}

function assertBadRequest(
  result: ReturnType<typeof validateCreateProperty>,
  pattern: RegExp,
) {
  assert.equal(result.ok, false)
  assert.equal(result.status, 400)
  assert.match(result.message, pattern)
}

test('accepts a valid body and derives the owner from the identity', () => {
  const result = validateCreateProperty(validBody(), OWNER)

  assert.deepEqual(result, {
    ok: true,
    value: {
      name: 'Riverside Duplex',
      address: '12 River Road',
      type: 'residential',
      units: null,
      isActive: true,
      ownerId: OWNER.userId,
    },
  })
})

test('trims the required text fields', () => {
  const result = validateCreateProperty(
    {
      name: '  Riverside Duplex  ',
      address: '\t12 River Road\n',
      type: ' residential ',
    },
    OWNER,
  )

  assert.equal(result.ok, true)
  assert.equal(result.value.name, 'Riverside Duplex')
  assert.equal(result.value.address, '12 River Road')
  assert.equal(result.value.type, 'residential')
})

for (const field of ['name', 'address', 'type'] as const) {
  test(`rejects a body missing ${field}`, () => {
    const body = validBody()
    delete (body as Record<string, unknown>)[field]

    assertBadRequest(
      validateCreateProperty(body, OWNER),
      /Missing required fields/,
    )
  })

  test(`rejects a blank ${field}`, () => {
    assertBadRequest(
      validateCreateProperty(validBody({ [field]: '   ' }), OWNER),
      /Missing required fields/,
    )
  })

  test(`rejects a non-string ${field}`, () => {
    assertBadRequest(
      validateCreateProperty(validBody({ [field]: 42 }), OWNER),
      /Missing required fields/,
    )
  })
}

for (const type of ['residential', 'commercial', 'lot']) {
  test(`accepts the ${type} type`, () => {
    const result = validateCreateProperty(validBody({ type }), OWNER)

    assert.equal(result.ok, true)
    assert.equal(result.value.type, type)
  })
}

test('rejects a type outside the closed enum', () => {
  assertBadRequest(
    validateCreateProperty(validBody({ type: 'industrial' }), OWNER),
    /Invalid property type/,
  )
})

test('rejects a negative units value', () => {
  assertBadRequest(
    validateCreateProperty(validBody({ units: -1 }), OWNER),
    /Invalid units/,
  )
})

test('accepts zero units', () => {
  const result = validateCreateProperty(validBody({ units: 0 }), OWNER)

  assert.equal(result.ok, true)
  assert.equal(result.value.units, 0)
})

test('reads absent units as null', () => {
  const result = validateCreateProperty(validBody(), OWNER)

  assert.equal(result.ok, true)
  assert.equal(result.value.units, null)
})

test('reads null units as null', () => {
  const result = validateCreateProperty(validBody({ units: null }), OWNER)

  assert.equal(result.ok, true)
  assert.equal(result.value.units, null)
})

test('rejects fractional units', () => {
  assertBadRequest(
    validateCreateProperty(validBody({ units: 1.5 }), OWNER),
    /Invalid units/,
  )
})

test('rejects non-numeric units', () => {
  assertBadRequest(
    validateCreateProperty(validBody({ units: '2' }), OWNER),
    /Invalid units/,
  )
})

test('defaults isActive to true', () => {
  const result = validateCreateProperty(validBody(), OWNER)

  assert.equal(result.ok, true)
  assert.equal(result.value.isActive, true)
})

test('keeps an explicit false isActive', () => {
  const result = validateCreateProperty(validBody({ isActive: false }), OWNER)

  assert.equal(result.ok, true)
  assert.equal(result.value.isActive, false)
})

test('reads null isActive as the default', () => {
  const result = validateCreateProperty(validBody({ isActive: null }), OWNER)

  assert.equal(result.ok, true)
  assert.equal(result.value.isActive, true)
})

test('rejects a non-boolean isActive', () => {
  assertBadRequest(
    validateCreateProperty(validBody({ isActive: 'yes' }), OWNER),
    /Invalid isActive/,
  )
})

test('ignores every owner shape in the body', () => {
  const result = validateCreateProperty(
    validBody({
      ownerId: OTHER_OWNER,
      owner_id: OTHER_OWNER,
      owner: OTHER_OWNER,
    }),
    OWNER,
  )

  assert.equal(result.ok, true)
  assert.equal(result.value.ownerId, OWNER.userId)
  assert.notEqual(result.value.ownerId, OTHER_OWNER)
})

test('rejects a non-object body', () => {
  assertBadRequest(
    validateCreateProperty(null, OWNER),
    /Missing required fields/,
  )
})

test('rejects an array body', () => {
  assertBadRequest(validateCreateProperty([], OWNER), /Missing required fields/)
})

// The wire shape: domain `Property` and nothing else. The owner must never
// serialise, in either naming convention.

function row(overrides: Partial<PropertyRow> = {}): PropertyRow {
  return {
    id: '9b1c3f22-6a1e-4f8f-9f0e-2c3b4a5d6e7f',
    name: 'Riverside Duplex',
    address: '12 River Road',
    type: 'residential',
    units: 2,
    isActive: true,
    createdAt: new Date('2026-11-26T10:00:00.000Z'),
    ...overrides,
  }
}

test('maps a row to the wire property', () => {
  assert.deepEqual(toProperty(row()), {
    id: '9b1c3f22-6a1e-4f8f-9f0e-2c3b4a5d6e7f',
    name: 'Riverside Duplex',
    address: '12 River Road',
    type: 'residential',
    units: 2,
    isActive: true,
    createdAt: '2026-11-26T10:00:00.000Z',
  })
})

test('omits units on the wire when the row has none', () => {
  const wire = toProperty(row({ units: null }))

  assert.equal(Object.hasOwn(wire, 'units'), false)
})

test('serialises no owner field', () => {
  const wire = toProperty(row()) as unknown as Record<string, unknown>

  assert.equal(Object.hasOwn(wire, 'ownerId'), false)
  assert.equal(Object.hasOwn(wire, 'owner_id'), false)
  assert.equal(Object.hasOwn(wire, 'owner'), false)
})

// The 404 rule: a foreign row and an unknown id both affect zero rows, so both
// take the identical mapping. The database never gets a second predicate to
// tell them apart.

test('maps zero affected rows to the 404 result', () => {
  const id = '9b1c3f22-6a1e-4f8f-9f0e-2c3b4a5d6e7f'

  assert.deepEqual(deletedOrNotFound(0, id), {
    ok: false,
    status: 404,
    message: `Property ${id} not found`,
  })
})

test('maps one affected row to success', () => {
  assert.deepEqual(
    deletedOrNotFound(1, '9b1c3f22-6a1e-4f8f-9f0e-2c3b4a5d6e7f'),
    { ok: true },
  )
})

// A UUID path param is parsed before the query; an unparsable one is a 400 and
// never reaches Postgres.

test('parses a canonical UUID', () => {
  assert.equal(
    parsePropertyId('9B1C3F22-6A1E-4F8F-9F0E-2C3B4A5D6E7F'),
    '9b1c3f22-6a1e-4f8f-9f0e-2c3b4a5d6e7f',
  )
})

test('parses a hyphenless UUID', () => {
  assert.equal(
    parsePropertyId('9b1c3f226a1e4f8f9f0e2c3b4a5d6e7f'),
    '9b1c3f22-6a1e-4f8f-9f0e-2c3b4a5d6e7f',
  )
})

test('refuses an unparsable id', () => {
  assert.equal(parsePropertyId('not-a-uuid'), null)
})

test('refuses an empty id', () => {
  assert.equal(parsePropertyId('   '), null)
})

// The SQL the three queries end up as. The owner predicate stays in the query:
// the connection is the table owner, so RLS is not the control (ADR-0008).

const client = postgres('postgres://unused:unused@127.0.0.1:1/unused', {
  prepare: false,
  max: 1,
})
const db = drizzle(client, { schema })

after(async () => {
  await client.end({ timeout: 1 })
})

test('the list query scopes to the owner and orders active-first, newest-first', () => {
  const { sql } = listOwnedPropertiesQuery(db, OWNER.userId).toSQL()
  const oneLine = sql.replace(/\s+/g, ' ').trim()

  assert.match(oneLine, /where "properties"\."owner_id" = \$1/)
  assert.match(
    oneLine,
    /order by "properties"\."is_active" desc, "properties"\."created_at" desc$/,
  )
})

test('the list query selects no owner column', () => {
  const { sql } = listOwnedPropertiesQuery(db, OWNER.userId).toSQL()
  const selectList = sql.slice(0, sql.indexOf(' from '))

  assert.doesNotMatch(selectList, /owner_id/)
  assert.match(
    selectList,
    /"id", "name", "address", "type", "units", "is_active", "created_at"/,
  )
})

test('the insert query writes the verified owner last', () => {
  const { sql, params } = insertOwnedPropertyQuery(db, {
    name: 'Riverside Duplex',
    address: '12 River Road',
    type: 'residential',
    units: null,
    isActive: true,
    ownerId: OWNER.userId,
  }).toSQL()
  const oneLine = sql.replace(/\s+/g, ' ').trim()

  assert.match(
    oneLine,
    /insert into "properties" \("id", "name", "address", "type", "units", "is_active", "created_at", "owner_id"\) values \(default, \$1, \$2, \$3, \$4, \$5, default, \$6\)/,
  )
  assert.equal(params.at(-1), OWNER.userId)
})

test('the insert returns the wire columns and no owner', () => {
  const { sql } = insertOwnedPropertyQuery(db, {
    name: 'Riverside Duplex',
    address: '12 River Road',
    type: 'residential',
    units: null,
    isActive: true,
    ownerId: OWNER.userId,
  }).toSQL()
  const returning = sql.slice(sql.indexOf(' returning ') + ' returning '.length)

  assert.doesNotMatch(returning, /owner_id/)
  assert.match(
    returning,
    /"id", "name", "address", "type", "units", "is_active", "created_at"/,
  )
})

test('the delete query matches the id and the owner together', () => {
  const { sql, params } = deleteOwnedPropertyQuery(
    db,
    '9b1c3f22-6a1e-4f8f-9f0e-2c3b4a5d6e7f',
    OWNER.userId,
  ).toSQL()
  const oneLine = sql.replace(/\s+/g, ' ').trim()

  assert.match(oneLine, /delete from "properties"/)
  assert.match(
    oneLine,
    /"properties"\."id" = \$1 and "properties"\."owner_id" = \$2/,
  )
  assert.deepEqual(params, [
    '9b1c3f22-6a1e-4f8f-9f0e-2c3b4a5d6e7f',
    OWNER.userId,
  ])
})
