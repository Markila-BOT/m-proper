// client/src/components/AppModals.tsx
// Pass split income/expense categories to TransactionForm
import { Transaction } from "../types/transactions";
import { Property } from "../types/properties";
import TransactionForm from "./TransactionForm";

import { incomeCategories, expenseCategories } from "../constants/categories";

type AppModalsProps = {
  isTransactionFormOpen: boolean;
  onCloseTransactionForm: () => void;
  properties: Property[];
  selectedProperty: string;
  onAddTransaction: (transactionData: Omit<Transaction, "id">) => void;
};

export default function AppModals({
  isTransactionFormOpen,
  onCloseTransactionForm,
  properties,
  selectedProperty,
  onAddTransaction,
}: AppModalsProps) {
  return (
    <>
      <TransactionForm
        incomeCategories={incomeCategories}
        expenseCategories={expenseCategories}
        properties={properties}
        selectedProperty={selectedProperty}
        onAddTransaction={onAddTransaction}
        isOpen={isTransactionFormOpen}
        onClose={onCloseTransactionForm}
      />
    </>
  );
}
