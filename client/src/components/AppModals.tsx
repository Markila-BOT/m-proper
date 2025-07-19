import { Transaction, Category, Property } from "../types";
import TransactionForm from "./TransactionForm";

type AppModalsProps = {
  isTransactionFormOpen: boolean;
  onCloseTransactionForm: () => void;
  categories: Category[];
  properties: Property[];
  selectedProperty: string;
  onAddTransaction: (transactionData: Omit<Transaction, "id">) => void;
};

export default function AppModals({
  isTransactionFormOpen,
  onCloseTransactionForm,
  categories,
  properties,
  selectedProperty,
  onAddTransaction,
}: AppModalsProps) {
  return (
    <>
      <TransactionForm
        categories={categories}
        properties={properties}
        selectedProperty={selectedProperty}
        onAddTransaction={onAddTransaction}
        isOpen={isTransactionFormOpen}
        onClose={onCloseTransactionForm}
      />
    </>
  );
}
