// web/src/lib/domain.ts
// Domain constants previously in shared/ — kept local to the web app.

export const PROPERTY_TYPE = {
  RESIDENTIAL: 'residential',
  COMMERCIAL: 'commercial',
  LOT: 'lot',
} as const

export type PropertyType = (typeof PROPERTY_TYPE)[keyof typeof PROPERTY_TYPE]

export const TRANSACTION_TYPE = {
  INCOME: 'income',
  EXPENSE: 'expense',
} as const

export type TransactionType =
  (typeof TRANSACTION_TYPE)[keyof typeof TRANSACTION_TYPE]

export const PROPERTY_TYPE_LABELS = {
  [PROPERTY_TYPE.RESIDENTIAL]: 'Residential',
  [PROPERTY_TYPE.COMMERCIAL]: 'Commercial',
  [PROPERTY_TYPE.LOT]: 'Lot',
} as const

export const TRANSACTION_TYPE_LABELS = {
  [TRANSACTION_TYPE.INCOME]: 'Income',
  [TRANSACTION_TYPE.EXPENSE]: 'Expense',
} as const

export type Property = {
  id: string
  name: string
  address: string
  type: PropertyType
  units?: number
  isActive: boolean
  createdAt: string
}

export type CreatePropertyRequest = {
  name: string
  address: string
  type: PropertyType
  units?: number
  isActive?: boolean
}
