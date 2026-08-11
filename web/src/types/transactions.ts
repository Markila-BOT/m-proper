import type { TransactionType } from '#/lib/domain'

export type Transaction = {
  id: string
  date: string
  description: string
  category: string
  amount: number
  type: TransactionType
  property: string
}

export type MonthlyTotal = {
  month: string
  income: number
  expenses: number
  profit: number
}
