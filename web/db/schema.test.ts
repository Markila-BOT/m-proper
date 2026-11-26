import assert from 'node:assert/strict'
import { test } from 'node:test'

import { getTableConfig } from 'drizzle-orm/pg-core'

import { properties } from './schema.ts'

// The Drizzle schema mirrors the schema already applied by sqlx (ADR-0011).
// These assertions are the drift guard: a column, a check, the owner index, or
// the auth.users reference that changes here must be a deliberate migration.

const config = getTableConfig(properties)

test('describes the applied columns in order', () => {
  assert.deepEqual(
    config.columns.map((column) => column.name),
    [
      'id',
      'name',
      'address',
      'type',
      'units',
      'is_active',
      'created_at',
      'owner_id',
    ],
  )
})

test('makes every column but units required', () => {
  assert.deepEqual(
    config.columns.filter((column) => !column.notNull).map((c) => c.name),
    ['units'],
  )
})

test('names the four checks the database carries', () => {
  assert.deepEqual(config.checks.map((check) => check.name).sort(), [
    'properties_address_check',
    'properties_name_check',
    'properties_type_check',
    'properties_units_check',
  ])
})

test('references auth.users and deletes properties with the owner', () => {
  assert.equal(config.foreignKeys.length, 1)
  const [foreignKey] = config.foreignKeys
  const reference = foreignKey.reference()

  assert.equal(reference.foreignColumns.length, 1)
  assert.equal(reference.foreignColumns[0].name, 'id')
  assert.equal(reference.columns[0].name, 'owner_id')
  assert.equal(foreignKey.onDelete, 'cascade')
  assert.equal(foreignKey.getName(), 'properties_owner_id_fkey')

  const foreignTable = getTableConfig(reference.foreignTable)
  assert.equal(foreignTable.schema, 'auth')
  assert.equal(foreignTable.name, 'users')
})

test('declares the ordering and owner indexes', () => {
  assert.deepEqual(config.indexes.map((index) => index.config.name).sort(), [
    'properties_active_created_at_idx',
    'properties_owner_id_idx',
  ])
})
