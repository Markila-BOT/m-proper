// web/src/components/TransactionForm.tsx
// Use split income/expense categories for the category dropdown
import React, { useState } from "react";
import { FiPlus, FiX } from "react-icons/fi";
import type { Transaction } from "../types/transactions";
import type { Property } from "../types/properties";
import { TRANSACTION_TYPE, TRANSACTION_TYPE_LABELS } from "#/lib/domain";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/constants/categories";

type TransactionFormProps = {
  properties: Property[];
  selectedProperty: string;
  onAddTransaction: (transaction: Omit<Transaction, "id">) => void;
  isOpen: boolean;
  onClose: () => void;
};

export default function TransactionForm({
  properties,
  selectedProperty,
  onAddTransaction,
  isOpen,
  onClose,
}: TransactionFormProps) {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    description: "",
    category: "",
    amount: "",
    type: TRANSACTION_TYPE.EXPENSE as Transaction["type"],
    property: selectedProperty !== "all" ? selectedProperty : "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !formData.description ||
      !formData.category ||
      !formData.amount ||
      !formData.property
    )
      return;

    onAddTransaction({
      date: formData.date,
      description: formData.description,
      category: formData.category,
      amount: parseFloat(formData.amount),
      type: formData.type,
      property: formData.property,
    });

    setFormData({
      date: new Date().toISOString().split("T")[0],
      description: "",
      category: "",
      amount: "",
      type: TRANSACTION_TYPE.EXPENSE,
      property: selectedProperty !== "all" ? selectedProperty : "",
    });
    onClose();
  };

  // Use the correct category array based on type
  const categoryOptions =
    formData.type === TRANSACTION_TYPE.INCOME
      ? INCOME_CATEGORIES
      : EXPENSE_CATEGORIES;
  const activeProperties = properties.filter((p) => p.isActive);

  if (!isOpen) return null;

  return (
    <div className="flex fixed inset-0 z-50 justify-center items-center p-4 bg-black bg-opacity-50">
      <div className="w-full max-w-md bg-white rounded-xl shadow-2xl">
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            Add Transaction
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 rounded-lg transition-colors hover:text-gray-600 hover:bg-gray-100"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="flex space-x-4">
            <label className="flex items-center">
              <input
                type="radio"
                name="type"
                value={TRANSACTION_TYPE.INCOME}
                checked={formData.type === TRANSACTION_TYPE.INCOME}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    type: e.target.value as Transaction["type"],
                    category: "",
                  }))
                }
                className="text-emerald-500 focus:ring-emerald-500"
              />
              <span className="ml-2 font-medium text-emerald-600">
                {TRANSACTION_TYPE_LABELS[TRANSACTION_TYPE.INCOME]}
              </span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="type"
                value={TRANSACTION_TYPE.EXPENSE}
                checked={formData.type === TRANSACTION_TYPE.EXPENSE}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    type: e.target.value as Transaction["type"],
                    category: "",
                  }))
                }
                className="text-red-500 focus:ring-red-500"
              />
              <span className="ml-2 font-medium text-red-600">
                {TRANSACTION_TYPE_LABELS[TRANSACTION_TYPE.EXPENSE]}
              </span>
            </label>
          </div>

          <div>
            <label className="block mb-1 text-sm font-medium text-gray-700">
              Property
            </label>
            <select
              value={formData.property}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, property: e.target.value }))
              }
              className="px-3 py-2 w-full rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="">Select property</option>
              {activeProperties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block mb-1 text-sm font-medium text-gray-700">
              Date
            </label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, date: e.target.value }))
              }
              className="px-3 py-2 w-full rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block mb-1 text-sm font-medium text-gray-700">
              Description
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              className="px-3 py-2 w-full rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter description"
              required
            />
          </div>

          <div>
            <label className="block mb-1 text-sm font-medium text-gray-700">
              Category
            </label>
            <select
              value={formData.category}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, category: e.target.value }))
              }
              className="px-3 py-2 w-full rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="">Select category</option>
              {categoryOptions.map((category) => (
                <option key={category.id} value={category.name}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block mb-1 text-sm font-medium text-gray-700">
              Amount
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.amount}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, amount: e.target.value }))
              }
              className="px-3 py-2 w-full rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="0.00"
              required
            />
          </div>

          <div className="flex pt-4 space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-700 rounded-lg border border-gray-300 transition-colors hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex flex-1 justify-center items-center px-4 py-2 space-x-2 text-white bg-blue-600 rounded-lg transition-colors hover:bg-blue-700"
            >
              <FiPlus className="w-4 h-4" />
              <span>Add Transaction</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
