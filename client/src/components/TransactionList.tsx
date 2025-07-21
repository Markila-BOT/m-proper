import { FiTrash2, FiCalendar, FiTag } from "react-icons/fi";
import { HiOutlineOfficeBuilding } from "react-icons/hi";
import { Transaction } from "../types/transactions";
import { Property } from "../types/properties";
import { TRANSACTION_TYPE } from "shared";

type TransactionListProps = {
  transactions: Transaction[];
  properties: Property[];
  onDeleteTransaction: (id: string) => void;
};

export default function TransactionList({
  transactions,
  properties,
  onDeleteTransaction,
}: TransactionListProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "PHP",
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getPropertyName = (propertyId: string) => {
    const property = properties.find((p) => p.id === propertyId);
    return property ? property.name : "Unknown Property";
  };

  if (transactions.length === 0) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="mb-2 text-gray-400">
          <FiCalendar className="mx-auto w-12 h-12" />
        </div>
        <h3 className="mb-1 text-lg font-medium text-gray-900">
          No transactions yet
        </h3>
        <p className="text-gray-500">
          Start by adding your first income or expense transaction.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">
          Transactions ({transactions.length})
        </h2>
      </div>
      <div className="divide-y divide-gray-200">
        {transactions.map((transaction) => (
          <div
            key={transaction.id}
            className="p-6 transition-colors hover:bg-gray-50"
          >
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center mb-2 space-x-3">
                  <h3 className="text-sm font-medium text-gray-900">
                    {transaction.description}
                  </h3>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      transaction.type === TRANSACTION_TYPE.INCOME
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {transaction.type}
                  </span>
                </div>
                <div className="flex items-center space-x-4 text-sm text-gray-500">
                  <div className="flex items-center space-x-1">
                    <FiCalendar className="w-4 h-4" />
                    <span>{formatDate(transaction.date)}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <FiTag className="w-4 h-4" />
                    <span>{transaction.category}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <HiOutlineOfficeBuilding className="w-4 h-4" />
                    <span>{getPropertyName(transaction.property)}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <span
                  className={`text-lg font-semibold ${
                    transaction.type === TRANSACTION_TYPE.INCOME
                      ? "text-emerald-600"
                      : "text-red-600"
                  }`}
                >
                  {transaction.type === TRANSACTION_TYPE.INCOME ? "+" : "-"}
                  {formatCurrency(transaction.amount)}
                </span>
                <button
                  onClick={() => onDeleteTransaction(transaction.id)}
                  className="p-2 text-gray-400 rounded-lg transition-colors hover:text-red-600 hover:bg-red-50"
                >
                  <FiTrash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
