import { FiTrendingUp, FiTrendingDown, FiCalendar } from 'react-icons/fi'
import { FaPesoSign } from 'react-icons/fa6'
import { PropertyTypeIcon } from './PropertyTypeIcon'
import { PROPERTY_TYPE } from '#/lib/domain'
import type { Transaction } from '../types/transactions'
import type { Property } from '../types/properties'
import { summarizeTransactions, monthlyTotals } from '../transactions'

type SummaryProps = {
  transactions: Transaction[]
  properties: Property[]
  selectedProperty: string
}

export default function Summary({
  transactions,
  properties,
  selectedProperty,
}: SummaryProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'PHP',
    }).format(amount)
  }

  const getSelectedPropertyName = () => {
    if (selectedProperty === 'all') return 'All Properties'
    const property = properties.find((p) => p.id === selectedProperty)
    return property ? property.name : 'Unknown Property'
  }

  // Aggregation belongs to the transactions module
  const {
    totalIncome,
    totalExpenses,
    netProfit,
    currentMonth: {
      income: monthlyIncome,
      expenses: monthlyExpenses,
      profit: monthlyProfit,
    },
  } = summarizeTransactions(transactions)

  const profitMargin = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0

  // Monthly trends (last 6 months)
  const sixMonthTrend = monthlyTotals(transactions, 6)

  return (
    <div className="space-y-6">
      {/* Property Header */}
      <div className="p-6 bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-blue-100 rounded-xl">
            <PropertyTypeIcon
              type={
                selectedProperty === 'all'
                  ? PROPERTY_TYPE.COMMERCIAL
                  : properties.find((p) => p.id === selectedProperty)?.type ||
                    PROPERTY_TYPE.COMMERCIAL
              }
              className="w-6 h-6 text-blue-600"
            />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {getSelectedPropertyName()}
            </h2>
            <p className="text-sm text-gray-500">
              {selectedProperty === 'all'
                ? `${
                    properties.filter((p) => p.isActive).length
                  } active properties`
                : 'Property financial overview'}
            </p>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="p-6 bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Income</p>
              <p className="text-2xl font-bold text-emerald-600">
                {formatCurrency(totalIncome)}
              </p>
            </div>
            <div className="p-3 bg-emerald-100 rounded-xl">
              <FiTrendingUp className="w-6 h-6 text-emerald-600" />
            </div>
          </div>
        </div>

        <div className="p-6 bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-gray-600">
                Total Expenses
              </p>
              <p className="text-2xl font-bold text-red-600">
                {formatCurrency(totalExpenses)}
              </p>
            </div>
            <div className="p-3 bg-red-100 rounded-xl">
              <FiTrendingDown className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>

        <div className="p-6 bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-gray-600">Net Profit</p>
              <p
                className={`text-2xl font-bold ${
                  netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'
                }`}
              >
                {formatCurrency(netProfit)}
              </p>
            </div>
            <div
              className={`p-3 rounded-xl ${
                netProfit >= 0 ? 'bg-emerald-100' : 'bg-red-100'
              }`}
            >
              <FaPesoSign
                className={`w-6 h-6 ${
                  netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'
                }`}
              />
            </div>
          </div>
        </div>

        <div className="p-6 bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-gray-600">Profit Margin</p>
              <p
                className={`text-2xl font-bold ${
                  profitMargin >= 0 ? 'text-emerald-600' : 'text-red-600'
                }`}
              >
                {profitMargin.toFixed(1)}%
              </p>
            </div>
            <div className="p-3 bg-blue-100 rounded-xl">
              <FiCalendar className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Current Month */}
      <div className="p-6 bg-white rounded-xl border border-gray-200 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">
          Current Month
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="p-4 text-center bg-emerald-50 rounded-lg">
            <p className="text-sm font-medium text-emerald-600">Income</p>
            <p className="text-xl font-bold text-emerald-700">
              {formatCurrency(monthlyIncome)}
            </p>
          </div>
          <div className="p-4 text-center bg-red-50 rounded-lg">
            <p className="text-sm font-medium text-red-600">Expenses</p>
            <p className="text-xl font-bold text-red-700">
              {formatCurrency(monthlyExpenses)}
            </p>
          </div>
          <div
            className={`text-center p-4 rounded-lg ${
              monthlyProfit >= 0 ? 'bg-emerald-50' : 'bg-red-50'
            }`}
          >
            <p
              className={`text-sm font-medium ${
                monthlyProfit >= 0 ? 'text-emerald-600' : 'text-red-600'
              }`}
            >
              Net Profit
            </p>
            <p
              className={`text-xl font-bold ${
                monthlyProfit >= 0 ? 'text-emerald-700' : 'text-red-700'
              }`}
            >
              {formatCurrency(monthlyProfit)}
            </p>
          </div>
        </div>
      </div>

      {/* Monthly Trends */}
      <div className="p-6 bg-white rounded-xl border border-gray-200 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">
          6-Month Trend
        </h3>
        <div className="space-y-4">
          {sixMonthTrend.map((month, index) => (
            <div
              key={index}
              className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
            >
              <span className="font-medium text-gray-900">{month.month}</span>
              <div className="flex items-center space-x-4 text-sm">
                <span className="text-emerald-600">
                  +{formatCurrency(month.income)}
                </span>
                <span className="text-red-600">
                  -{formatCurrency(month.expenses)}
                </span>
                <span
                  className={`font-semibold ${
                    month.profit >= 0 ? 'text-emerald-600' : 'text-red-600'
                  }`}
                >
                  {formatCurrency(month.profit)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
