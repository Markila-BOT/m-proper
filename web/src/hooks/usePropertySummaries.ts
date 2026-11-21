import { useMemo } from 'react'
import type { Transaction } from '../types/transactions'
import type { Property, PropertySummary } from '../types/properties'
import { summarizeTransactions } from '../transactions'

export function usePropertySummaries(
  properties: Property[],
  transactions: Transaction[],
) {
  // Calculate property summaries — the money math belongs to the
  // transactions module.
  const propertySummaries = useMemo(
    (): PropertySummary[] =>
      properties.map((property) => {
        const propertyTransactions = transactions.filter(
          (t) => t.property === property.id,
        )
        const summary = summarizeTransactions(propertyTransactions)
        return {
          property,
          totalIncome: summary.totalIncome,
          totalExpenses: summary.totalExpenses,
          netProfit: summary.netProfit,
          transactionCount: propertyTransactions.length,
        }
      }),
    [properties, transactions],
  )

  return propertySummaries
}
