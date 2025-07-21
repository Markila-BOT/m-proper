// Property types
export const PROPERTY_TYPE = {
  RESIDENTIAL: "residential",
  COMMERCIAL: "commercial",
  LOT: "lot",
} as const;

export type PropertyType = (typeof PROPERTY_TYPE)[keyof typeof PROPERTY_TYPE];

// Transaction types
export const TRANSACTION_TYPE = {
  INCOME: "income",
  EXPENSE: "expense",
} as const;

export type TransactionType =
  (typeof TRANSACTION_TYPE)[keyof typeof TRANSACTION_TYPE];

// Property type labels for display
export const PROPERTY_TYPE_LABELS = {
  [PROPERTY_TYPE.RESIDENTIAL]: "Residential",
  [PROPERTY_TYPE.COMMERCIAL]: "Commercial",
  [PROPERTY_TYPE.LOT]: "Lot",
} as const;

// Transaction type labels for display
export const TRANSACTION_TYPE_LABELS = {
  [TRANSACTION_TYPE.INCOME]: "Income",
  [TRANSACTION_TYPE.EXPENSE]: "Expense",
} as const;
