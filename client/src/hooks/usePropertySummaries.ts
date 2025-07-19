import { useMemo } from "react";
import { Transaction, Property, PropertySummary } from "../types";
import { TRANSACTION_TYPE } from "shared";

export function usePropertySummaries(
  properties: Property[],
  transactions: Transaction[]
) {
  // Calculate property summaries
  const propertySummaries = useMemo((): PropertySummary[] => {
    return properties.map((property) => {
      const propertyTransactions = transactions.filter(
        (t) => t.property === property.id
      );
      const totalIncome = propertyTransactions
        .filter((t) => t.type === TRANSACTION_TYPE.INCOME)
        .reduce((sum, t) => sum + t.amount, 0);
      const totalExpenses = propertyTransactions
        .filter((t) => t.type === TRANSACTION_TYPE.EXPENSE)
        .reduce((sum, t) => sum + t.amount, 0);

      return {
        property,
        totalIncome,
        totalExpenses,
        netProfit: totalIncome - totalExpenses,
        transactionCount: propertyTransactions.length,
      };
    });
  }, [properties, transactions]);

  return propertySummaries;
}
