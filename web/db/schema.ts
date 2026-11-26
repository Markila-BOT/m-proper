// web/db/schema.ts
/**
 * The Drizzle description of the schema Supabase Postgres already carries.
 *
 * It exists for typing and queries, not as the sole authority on the database
 * (ADR-0011). `auth.users`, the `owner_id` foreign key, RLS policies, and the
 * grant revokes stay hand-authored in `db/migrations`, because drizzle-kit
 * cannot model them and would emit drops for them.
 */
import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  pgSchema,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

/**
 * Supabase owns `auth.users`. It is declared only so the owner reference is
 * typed; it is deliberately not exported, so drizzle-kit never treats it as
 * schema this repository owns.
 */
const authUsers = pgSchema('auth').table('users', {
  id: uuid('id').primaryKey(),
})

export const properties = pgTable(
  'properties',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: text('name').notNull(),
    address: text('address').notNull(),
    type: text('type').notNull(),
    units: integer('units'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    ownerId: uuid('owner_id').notNull(),
  },
  (table) => [
    // PostgreSQL named the applied foreign key after the column, so the
    // table-level declaration reproduces that name instead of drizzle-kit's
    // generated one (which a catalog diff would report as drift).
    foreignKey({
      name: 'properties_owner_id_fkey',
      columns: [table.ownerId],
      foreignColumns: [authUsers.id],
    }).onDelete('cascade'),
    // Constraint names match PostgreSQL's defaults for the unnamed checks in
    // the applied migration, so a generated diff has nothing to rename.
    check('properties_name_check', sql`length(btrim(${table.name})) > 0`),
    check('properties_address_check', sql`length(btrim(${table.address})) > 0`),
    check(
      'properties_type_check',
      sql`${table.type} in ('residential', 'commercial', 'lot')`,
    ),
    check(
      'properties_units_check',
      sql`${table.units} is null or ${table.units} >= 0`,
    ),
    // The applied index was created with `desc`, whose default is NULLS
    // FIRST. Drizzle defaults to NULLS LAST, so it is stated explicitly.
    index('properties_active_created_at_idx').on(
      table.isActive.desc().nullsFirst(),
      table.createdAt.desc().nullsFirst(),
    ),
    index('properties_owner_id_idx').on(table.ownerId),
  ],
)
