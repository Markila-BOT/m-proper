// web/src/components/TransactionForm.tsx
// The add-transaction form: a passbook line being written. Radix dialog
// portal, hairline grid fields with navy caption labels, Radix selects,
// and validation that names the problem and its recovery as a stamp —
// bordered on all sides, uppercase mono, stamp-red ink on paper (the
// craft floor's generic left-stripe alert is refused).
import { useState } from 'react'
import type { Transaction } from '../types/transactions'
import type { Property } from '../types/properties'
import { TRANSACTION_TYPE, TRANSACTION_TYPE_LABELS } from '#/lib/domain'
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../transactions'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { Label } from './ui/label'
import { Button } from './ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'

// Radix forbids the empty string as an item value; the form's "not chosen
// yet" state maps onto this sentinel and back.
const UNCHOSEN = '__none__'

type TransactionFormProps = {
  properties: Property[]
  selectedProperty: string
  onAddTransaction: (transaction: Omit<Transaction, 'id'>) => void
  isOpen: boolean
  onClose: () => void
}

const fieldLabel =
  'mb-1.5 block font-sans text-caption font-semibold uppercase tracking-[0.14em] text-ink-soft'
const fieldInput =
  'h-9 w-full rounded-[2px] border border-rule bg-paper px-3 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-paper'

export default function TransactionForm({
  properties,
  selectedProperty,
  onAddTransaction,
  isOpen,
  onClose,
}: TransactionFormProps) {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '',
    category: '',
    amount: '',
    type: TRANSACTION_TYPE.EXPENSE as Transaction['type'],
    property: selectedProperty !== 'all' ? selectedProperty : '',
  })
  const [validationError, setValidationError] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const amount = Number.parseFloat(formData.amount)
    if (!formData.description || !formData.category || !formData.property) {
      setValidationError(
        'The line is unfinished: give it a description, a category, and a property.',
      )
      return
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setValidationError(
        'The amount is missing or not a number — enter what the entry is worth, then record it.',
      )
      return
    }

    onAddTransaction({
      date: formData.date,
      description: formData.description,
      category: formData.category,
      amount,
      type: formData.type,
      property: formData.property,
    })

    setFormData({
      date: new Date().toISOString().split('T')[0],
      description: '',
      category: '',
      amount: '',
      type: TRANSACTION_TYPE.EXPENSE,
      property: selectedProperty !== 'all' ? selectedProperty : '',
    })
    setValidationError(null)
    onClose()
  }

  // The category list follows the entry's type, exactly as before.
  const categoryOptions = Object.values(
    formData.type === TRANSACTION_TYPE.INCOME
      ? INCOME_CATEGORIES
      : EXPENSE_CATEGORIES,
  )
  const activeProperties = properties.filter((p) => p.isActive)

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Write a line into the ledger</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset className="flex gap-5">
            <legend className="sr-only">Entry type</legend>
            <label className="flex items-center gap-2 text-sm font-medium text-ink">
              <input
                type="radio"
                name="type"
                value={TRANSACTION_TYPE.INCOME}
                checked={formData.type === TRANSACTION_TYPE.INCOME}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    type: e.target.value as Transaction['type'],
                    category: '',
                  }))
                }
                className="h-4 w-4"
              />
              {TRANSACTION_TYPE_LABELS[TRANSACTION_TYPE.INCOME]}
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-ink">
              <input
                type="radio"
                name="type"
                value={TRANSACTION_TYPE.EXPENSE}
                checked={formData.type === TRANSACTION_TYPE.EXPENSE}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    type: e.target.value as Transaction['type'],
                    category: '',
                  }))
                }
                className="h-4 w-4"
              />
              {TRANSACTION_TYPE_LABELS[TRANSACTION_TYPE.EXPENSE]}
            </label>
          </fieldset>

          <div>
            <Label htmlFor="transaction-property" className={fieldLabel}>
              Property
            </Label>
            <Select
              value={formData.property === '' ? UNCHOSEN : formData.property}
              onValueChange={(value) =>
                setFormData((prev) => ({
                  ...prev,
                  property: value === UNCHOSEN ? '' : value,
                }))
              }
            >
              <SelectTrigger id="transaction-property" aria-label="Property">
                <SelectValue placeholder="Select property" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNCHOSEN}>Select property</SelectItem>
                {activeProperties.map((property) => (
                  <SelectItem key={property.id} value={property.id}>
                    {property.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="transaction-date" className={fieldLabel}>
              Date
            </Label>
            <input
              id="transaction-date"
              type="date"
              value={formData.date}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, date: e.target.value }))
              }
              className={fieldInput}
              required
            />
          </div>

          <div>
            <Label htmlFor="transaction-description" className={fieldLabel}>
              Description
            </Label>
            <input
              id="transaction-description"
              type="text"
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              className={fieldInput}
              placeholder="What was this entry for"
              required
            />
          </div>

          <div>
            <Label htmlFor="transaction-category" className={fieldLabel}>
              Category
            </Label>
            <Select
              value={formData.category === '' ? UNCHOSEN : formData.category}
              onValueChange={(value) =>
                setFormData((prev) => ({
                  ...prev,
                  category: value === UNCHOSEN ? '' : value,
                }))
              }
            >
              <SelectTrigger id="transaction-category" aria-label="Category">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNCHOSEN}>Select category</SelectItem>
                {categoryOptions.map((category) => (
                  <SelectItem key={category.name} value={category.name}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="transaction-amount" className={fieldLabel}>
              Amount
            </Label>
            <input
              id="transaction-amount"
              type="number"
              step="0.01"
              value={formData.amount}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, amount: e.target.value }))
              }
              className={`${fieldInput} font-mono tabular-nums`}
              placeholder="0.00"
              required
            />
          </div>

          {validationError && (
            <p
              role="alert"
              className="rounded-[2px] border-[1.5px] border-stamp bg-paper px-3 py-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-stamp"
            >
              {validationError}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1 rounded-[2px]"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1 rounded-[2px]">
              Record entry
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
