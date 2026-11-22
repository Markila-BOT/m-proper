// web/src/transactions/summarize.ts
// Every money computation over transactions: totals, the current-month
// figures, the six-month trend, and the running balance.
//
// Month bucketing preserves Summary.tsx's exact boundaries: each month is
// the local calendar month i months back (day pinned to the 1st, so a 31st
// can never roll a subtraction into the next month), keyed by its own
// local parts (localMonthKey — never toISOString, whose UTC month lags a
// UTC+8 month's first hours), matched with date.startsWith, and labeled
// with toLocaleDateString('en-US').
import { TRANSACTION_TYPE } from '../lib/domain'
import { localMonthKey } from '../lib/format'
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

  // The month the local clock sits in, as a stored string's own bucket
  // key — a stored 'YYYY-MM-DD' belongs to it by its own prefix.
  const currentMonthKey = localMonthKey()
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
  // The local clock's own position, read once: every bucket derives from
  // these local parts, with the day pinned to the 1st.
  const now = new Date()
  for (let i = months - 1; i >= 0; i--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const monthKey = localMonthKey(monthDate)
    const monthTransactions = transactions.filter((t) =>
      t.date.startsWith(monthKey),
    )

    const income = sumAmounts(monthTransactions, TRANSACTION_TYPE.INCOME)
    const expenses = sumAmounts(monthTransactions, TRANSACTION_TYPE.EXPENSE)

    totals.push({
      month: monthDate.toLocaleDateString('en-US', {
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
