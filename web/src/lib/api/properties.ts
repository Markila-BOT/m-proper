// web/src/lib/api/properties.ts
/**
 * The properties contract, ported from `api/src/routes/properties.rs`.
 *
 * Validation happens before any query, the owner always comes from the verified
 * identity, and every statement carries the owner predicate. The connection is
 * the database owner, so RLS is not what scopes these rows (ADR-0008); the
 * queries are.
 */
import { and, desc, eq } from 'drizzle-orm'

import { PROPERTY_TYPE } from '../domain.ts'
import type { Property, PropertyType } from '../domain.ts'
import { properties as propertiesTable } from '../../../db/schema.ts'
import type { AppDatabase } from '../db.ts'

export const MISSING_FIELDS_MESSAGE =
  'Missing required fields: name, address, and type are required'
export const INVALID_TYPE_MESSAGE =
  'Invalid property type. Must be one of: "residential", "commercial", "lot"'
export const INVALID_UNITS_MESSAGE =
  'Invalid units. Units must be zero or greater'
export const INVALID_IS_ACTIVE_MESSAGE =
  'Invalid isActive. It must be a boolean'

/** A validated create, with the owner already derived from the identity. */
export interface NewProperty {
  name: string
  address: string
  type: PropertyType
  units: number | null
  isActive: boolean
  ownerId: string
}

export type CreateValidation =
  { ok: true; value: NewProperty } | { ok: false; status: 400; message: string }

interface Owner {
  userId: string
}

const VALID_TYPES: ReadonlySet<string> = new Set(Object.values(PROPERTY_TYPE))

function invalid(message: string): CreateValidation {
  return { ok: false, status: 400, message }
}

function isRecord(body: unknown): body is Record<string, unknown> {
  return typeof body === 'object' && body !== null && !Array.isArray(body)
}

function requiredText(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()

  return trimmed === '' ? null : trimmed
}

export function isPropertyType(value: string): value is PropertyType {
  return VALID_TYPES.has(value)
}

/**
 * Validates a create body. Any owner the client sends is simply never read:
 * only `owner.userId` reaches the row.
 */
export function validateCreateProperty(
  body: unknown,
  owner: Owner,
): CreateValidation {
  if (!isRecord(body)) {
    return invalid(MISSING_FIELDS_MESSAGE)
  }

  const name = requiredText(body.name)
  const address = requiredText(body.address)
  const type = requiredText(body.type)

  if (name === null || address === null || type === null) {
    return invalid(MISSING_FIELDS_MESSAGE)
  }

  if (!isPropertyType(type)) {
    return invalid(INVALID_TYPE_MESSAGE)
  }

  const units = body.units

  if (units !== undefined && units !== null) {
    if (typeof units !== 'number' || !Number.isInteger(units) || units < 0) {
      return invalid(INVALID_UNITS_MESSAGE)
    }
  }

  const isActive = body.isActive

  if (
    isActive !== undefined &&
    isActive !== null &&
    typeof isActive !== 'boolean'
  ) {
    return invalid(INVALID_IS_ACTIVE_MESSAGE)
  }

  return {
    ok: true,
    value: {
      name,
      address,
      type,
      units: typeof units === 'number' ? units : null,
      isActive: typeof isActive === 'boolean' ? isActive : true,
      ownerId: owner.userId,
    },
  }
}

const UUID_CANONICAL =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const UUID_SIMPLE = /^[0-9a-f]{32}$/i

/**
 * Parses a property id the way the Rust route did before its query: a
 * hyphenated or hyphenless UUID is accepted and normalised; anything else is an
 * unparsable id and answers 400. Never reaches Postgres.
 */
export function parsePropertyId(value: string): string | null {
  const trimmed = value.trim()

  if (UUID_CANONICAL.test(trimmed)) {
    return trimmed.toLowerCase()
  }

  if (UUID_SIMPLE.test(trimmed)) {
    const hex = trimmed.toLowerCase()

    return [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20),
    ].join('-')
  }

  return null
}

export interface PropertyRow {
  id: string
  name: string
  address: string
  type: string
  units: number | null
  isActive: boolean
  createdAt: Date
}

/** The wire property: domain fields only, and no owner in either convention. */
export function toProperty(row: PropertyRow): Property {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    type: row.type as PropertyType,
    ...(row.units === null ? {} : { units: row.units }),
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
  }
}

export type DeleteMapping =
  { ok: true } | { ok: false; status: 404; message: string }

/**
 * The one place an affected-row count becomes a result. Zero matched rows is
 * the same 404 for a foreign row and an unknown id, so existence never leaks.
 */
export function deletedOrNotFound(
  rowsAffected: number,
  id: string,
): DeleteMapping {
  if (rowsAffected === 0) {
    return { ok: false, status: 404, message: `Property ${id} not found` }
  }

  return { ok: true }
}

/** The columns every response and every query shares; owner is absent. */
export const PROPERTY_COLUMNS = {
  id: propertiesTable.id,
  name: propertiesTable.name,
  address: propertiesTable.address,
  type: propertiesTable.type,
  units: propertiesTable.units,
  isActive: propertiesTable.isActive,
  createdAt: propertiesTable.createdAt,
} as const

export function listOwnedPropertiesQuery(db: AppDatabase, ownerId: string) {
  return db
    .select(PROPERTY_COLUMNS)
    .from(propertiesTable)
    .where(eq(propertiesTable.ownerId, ownerId))
    .orderBy(desc(propertiesTable.isActive), desc(propertiesTable.createdAt))
}

export function insertOwnedPropertyQuery(
  db: AppDatabase,
  property: NewProperty,
) {
  return db
    .insert(propertiesTable)
    .values({
      name: property.name,
      address: property.address,
      type: property.type,
      units: property.units,
      isActive: property.isActive,
      ownerId: property.ownerId,
    })
    .returning(PROPERTY_COLUMNS)
}

export function deleteOwnedPropertyQuery(
  db: AppDatabase,
  id: string,
  ownerId: string,
) {
  return db
    .delete(propertiesTable)
    .where(
      and(eq(propertiesTable.id, id), eq(propertiesTable.ownerId, ownerId)),
    )
    .returning({ id: propertiesTable.id })
}
