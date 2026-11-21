// web/src/transactions/summarize.ts
// Every money computation over transactions: totals, the current-month
// figures, the six-month trend, and the running balance.
//
// Month bucketing preserves Summary.tsx's exact boundaries: each month is
// `new Date()` with setMonth(getMonth() - i), keyed by toISOString().slice(0, 7),
// matched with date.startsWith, and labeled with toLocaleDateString('en-US').
import { TRANSACTION_TYPE } from '../lib/domain'
import type { Transaction, MonthlyTotal } from '../types/transactions'

export type TransactionSummary = {
  totalIncome: number
  totalExpenses: number
  netProfit: number
  currentMonth: {
    income: number
    expenses: number
    profit: number
  }
}

function sumAmounts(
  transactions: Transaction[],
  type: Transaction['type'],
): number {
  return transactions
    .filter((t) => t.type === type)
    .reduce((sum, t) => sum + t.amount, 0)
}

export function summarizeTransactions(
  transactions: Transaction[],
): TransactionSummary {
  const totalIncome = sumAmounts(transactions, TRANSACTION_TYPE.INCOME)
  const totalExpenses = sumAmounts(transactions, TRANSACTION_TYPE.EXPENSE)

  const currentMonthKey = new Date().toISOString().slice(0, 7)
  const currentMonthTransactions = transactions.filter((t) =>
    t.date.startsWith(currentMonthKey),
  )
  const income = sumAmounts(currentMonthTransactions, TRANSACTION_TYPE.INCOME)
  const expenses = sumAmounts(
    currentMonthTransactions,
    TRANSACTION_TYPE.EXPENSE,
  )

  return {
    totalIncome,
    totalExpenses,
    netProfit: totalIncome - totalExpenses,
    currentMonth: {
      income,
      expenses,
      profit: income - expenses,
    },
  }
}

export function monthlyTotals(
  transactions: Transaction[],
  months = 6,
): MonthlyTotal[] {
  const totals: MonthlyTotal[] = []
  for (let i = months - 1; i >= 0; i--) {
    const date = new Date()
    date.setMonth(date.getMonth() - i)
    const monthKey = date.toISOString().slice(0, 7)
    const monthTransactions = transactions.filter((t) =>
      t.date.startsWith(monthKey),
    )

    const income = sumAmounts(monthTransactions, TRANSACTION_TYPE.INCOME)
    const expenses = sumAmounts(monthTransactions, TRANSACTION_TYPE.EXPENSE)

    totals.push({
      month: date.toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
      }),
      income,
      expenses,
      profit: income - expenses,
    })
  }
  return totals
}

export function runningBalance(transactions: Transaction[]): number[] {
  const balances: number[] = []
  let balance = 0
  for (const transaction of transactions) {
    balance +=
      transaction.type === TRANSACTION_TYPE.INCOME
        ? transaction.amount
        : -transaction.amount
    balances.push(balance)
  }
  return balances
}
