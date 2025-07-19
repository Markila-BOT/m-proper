import { Transaction, Category, Property } from "../types";
import TransactionForm from "./TransactionForm";
import PropertyForm from "./PropertyForm";

interface AppModalsProps {
  isTransactionFormOpen: boolean;
  onCloseTransactionForm: () => void;
  isPropertyFormOpen: boolean;
  onClosePropertyForm: () => void;
  categories: Category[];
  properties: Property[];
  selectedProperty: string;
  onAddTransaction: (transactionData: Omit<Transaction, "id">) => void;
}

export default function AppModals({
  isTransactionFormOpen,
  onCloseTransactionForm,
  isPropertyFormOpen,
  onClosePropertyForm,
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

      <PropertyForm isOpen={isPropertyFormOpen} onClose={onClosePropertyForm} />
    </>
  );
}
