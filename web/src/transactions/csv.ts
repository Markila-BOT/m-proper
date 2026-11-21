// web/src/transactions/csv.ts
// RFC-4180 CSV export: fields are wrapped in double quotes only when they
// contain a quote, comma, or newline, and embedded quotes are doubled. Same
// column order and headers as the useCSVExport hook.
import type { Transaction } from '../types/transactions'
import type { Property } from '../types/properties'

const CSV_HEADERS = [
  'Date',
  'Description',
  'Category',
  'Type',
  'Amount',
  'Property',
]

function csvField(value: string | number): string {
  const text = String(value)
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

export function toCSV(
  transactions: Transaction[],
  properties: Property[] = [],
): string {
  return [
    CSV_HEADERS.join(','),
    ...transactions.map((t) => {
      const property = properties.find((p) => p.id === t.property)
      return [
        csvField(t.date),
        csvField(t.description),
        csvField(t.category),
        csvField(t.type),
        csvField(t.amount),
        csvField(property ? property.name : 'Unknown Property'),
      ].join(',')
    }),
  ].join('\n')
}
