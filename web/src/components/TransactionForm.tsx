// web/src/components/TransactionForm.tsx
// The add-transaction form: a passbook line being written. Radix dialog
// portal, hairline grid fields with navy caption labels, Radix selects,
// and validation that names the problem and its recovery as a stamp —
// bordered on all sides, uppercase mono, stamp-red ink on paper (the
// craft floor's generic left-stripe alert is refused). The stamp names
// only the fields the line is actually missing. Two ways to record:
// "Record entry" closes the sheet, "Record & new" records and re-opens
// the form clean for the next line — focus stays inside for the batch.
import { useRef, useState } from 'react'
import type { RefObject } from 'react'
import type { Transaction } from '../types/transactions'
import type { Property } from '../types/properties'
import { TRANSACTION_TYPE, TRANSACTION_TYPE_LABELS } from '#/lib/domain'
import { localDateString } from '#/lib/format'
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
  // Where focus lands when the dialog closes: the "+ Add transaction"
  // trigger's ref. Every close path — Record, Escape, Cancel, the close
  // control, an outside click — funnels through the dialog's
  // close-auto-focus hook, which is the one seam that fires after the
  // focus trap is gone.
  returnFocusRef?: RefObject<HTMLButtonElement | null>
}

const fieldLabel =
  'mb-1.5 block font-sans text-caption font-semibold uppercase tracking-[0.14em] text-ink-soft'
const fieldInput =
  'h-9 w-full rounded-[2px] border border-rule bg-paper px-3 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-paper'
// The tabular-numerals rule reaches inside the form: the date input
// prints in the mono face — the sans never sets a figure.
const fieldDateInput = `${fieldInput} font-mono tabular-nums`

// The blank line the form re-opens as after a record: today's LOCAL date
// (never toISOString — whose UTC day is yesterday's page for a UTC+8
// morning entry), the expense type, the shell's property scope.
function blankFormData(selectedProperty: string) {
  return {
    date: localDateString(),
    description: '',
    category: '',
    amount: '',
    type: TRANSACTION_TYPE.EXPENSE as Transaction['type'],
    property: selectedProperty !== 'all' ? selectedProperty : '',
  }
}

export default function TransactionForm({
  properties,
  selectedProperty,
  onAddTransaction,
  isOpen,
  onClose,
  returnFocusRef,
}: TransactionFormProps) {
  const [formData, setFormData] = useState(() =>
    blankFormData(selectedProperty),
  )
  const [validationError, setValidationError] = useState<string | null>(null)

  // Where "Record & new" leaves the hand for the next line: the
  // description is where the writing starts.
  const descriptionRef = useRef<HTMLInputElement>(null)

  // The stamp names only what is actually missing — a line half-written
  // is told which halves, never scolded for fields it already carries.
  // It is the form's one validation voice: no native `required`
  // attributes pre-empt it with the browser's own bubble.
  const missingFields = [
    !formData.description && 'a description',
    !formData.category && 'a category',
    !formData.property && 'a property',
    !formData.date && 'a date',
  ].filter((entry): entry is string => entry !== false)

  // "a description and a category" / "a description, a category, and a
  // property" — the list reads as a person says it.
  const englishList = (items: string[]): string =>
    items.length === 1
      ? items[0]
      : items.length === 2
        ? `${items[0]} and ${items[1]}`
        : `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`

  // Records one line and re-opens the form clean. Returns whether the
  // line recorded; the two submit paths differ only in what happens
  // next — Record closes the dialog, Record & new keeps it open.
  const record = (): boolean => {
    if (missingFields.length > 0) {
      setValidationError(
        `The line is unfinished: give it ${englishList(missingFields)}.`,
      )
      return false
    }
    const amount = Number.parseFloat(formData.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      setValidationError(
        'The amount is missing or not a number — enter what the entry is worth, then record it.',
      )
      return false
    }

    onAddTransaction({
      date: formData.date,
      description: formData.description,
      category: formData.category,
      amount,
      type: formData.type,
      property: formData.property,
    })

    setFormData(blankFormData(selectedProperty))
    setValidationError(null)
    return true
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (record()) onClose()
  }

  // The batch-entry path: record the line, keep the dialog open with a
  // clean form, and the hand stays inside — the next line begins at the
  // description.
  const handleRecordAndNew = () => {
    if (record()) descriptionRef.current?.focus()
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
      <DialogContent
        className="max-w-md"
        onCloseAutoFocus={(event) => {
          // Radix's designed seam for the close: its own default returns
          // focus to the dialog's trigger ref, which this controlled
          // dialog has none of — so focus would fall to the body. The
          // trigger that opens the sheet is the honest target; taking
          // the event's default here keeps the return after the focus
          // trap is gone.
          event.preventDefault()
          returnFocusRef?.current?.focus()
        }}
      >
        <DialogHeader>
          <DialogTitle>Write a line into the ledger</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset className="flex gap-5">
            <legend className="sr-only">Entry type</legend>
            {/* The radios carry the sheet's 44px touch standard: the label
                is the target and its padding grows the reach — the mark
                itself stays 16px. */}
            <label className="flex items-center gap-2 py-3 text-sm font-medium text-ink">
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
                className="h-4 w-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-paper"
              />
              {TRANSACTION_TYPE_LABELS[TRANSACTION_TYPE.INCOME]}
            </label>
            <label className="flex items-center gap-2 py-3 text-sm font-medium text-ink">
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
                className="h-4 w-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-paper"
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
              className={fieldDateInput}
            />
          </div>

          <div>
            <Label htmlFor="transaction-description" className={fieldLabel}>
              Description
            </Label>
            <input
              id="transaction-description"
              ref={descriptionRef}
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
              className="h-9 flex-1 rounded-[2px]"
              onClick={onClose}
            >
              Cancel
            </Button>
            {/* The batch-entry secondary: records the line and keeps the
                sheet open, clean, for the next one. */}
            <Button
              type="button"
              variant="outline"
              className="h-9 flex-1 rounded-[2px]"
              onClick={handleRecordAndNew}
            >
              Record & new
            </Button>
            <Button type="submit" className="h-9 flex-1 rounded-[2px]">
              Record entry
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
