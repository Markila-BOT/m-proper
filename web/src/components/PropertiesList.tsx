import {
  usePropertiesWithStates,
  useDeleteProperty,
} from '../hooks/useProperties'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { FiHome, FiAlertCircle, FiTrash2 } from 'react-icons/fi'
import { PropertyTypeIcon } from './PropertyTypeIcon'
import { Skeleton } from './ui/skeleton'
import { useState } from 'react'
import { formatDate } from '../lib/format'

// The Properties page's recorded passbook pass (6.3): the layout stays
// what it was — the page's own composition of cards — but every leftover
// of the default-template world retires. Text prints in the ink tokens
// (no gray below contrast), the status pills become squared passbook
// marks, the loading state holds the world's outline with pulsing
// print-wash blocks instead of a blue spinner, and hover is a color
// state on a hairline rule, never a lifted shadow.
export default function PropertiesList() {
  const { properties, isLoading, error, isEmpty } = usePropertiesWithStates()
  const deleteProperty = useDeleteProperty()
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  if (isLoading) {
    // The ruled skeleton: print-wash blocks pulsing at the widths of the
    // composed blocks they stand in for, in the grid the loaded page uses.
    return (
      <div className="p-6" aria-busy="true" aria-label="Loading properties">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              aria-hidden="true"
              className="space-y-3 rounded-lg border border-rule p-6"
            >
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-5 w-16" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3.5 w-40" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="flex items-center space-x-2 text-stamp">
          <FiAlertCircle className="w-5 h-5" />
          <span>Error loading properties: {error.message}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-[17px] font-bold text-ink">Properties</h1>
        <p className="mt-2 text-sm text-ink-soft">
          View detailed information about all your properties
        </p>
        {deleteError && (
          <div className="flex items-center mt-4 space-x-2 text-stamp">
            <FiAlertCircle className="w-4 h-4" />
            <span>{deleteError}</span>
          </div>
        )}
      </div>
      {isEmpty ? (
        <Card className="border-rule shadow-none">
          <CardContent className="flex flex-col justify-center items-center p-8">
            <FiHome className="mb-4 w-12 h-12 text-ink-faint" />
            <h3 className="mb-2 text-lg font-medium text-ink">
              No properties found
            </h3>
            <p className="mb-4 text-center text-ink-soft">
              Add your first property using the sidebar to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {properties.map((property) => (
            <Card
              key={property.id}
              className="border-rule shadow-none transition-colors hover:border-print"
            >
              <CardHeader>
                <div className="flex justify-between items-center">
                  {/* The passbook's narrow-column idiom (the expanded rail
                      does the same): the name truncates under pressure and
                      the state marks keep their words — the rail below lg
                      widens to name its entries, so the card's column is
                      narrower and the row must give somewhere. */}
                  <div className="flex min-w-0 flex-1 items-center space-x-2">
                    <PropertyTypeIcon
                      type={property.type}
                      className="flex-shrink-0 w-5 h-5"
                    />
                    <CardTitle className="truncate text-lg">
                      {property.name}
                    </CardTitle>
                  </div>
                  <div className="flex flex-shrink-0 items-center space-x-2">
                    {/* The status mark, printed like the passbook's own:
                        squared, bordered, mono uppercase — never a pill. */}
                    <span
                      className={`rounded-[2px] border px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] ${
                        property.isActive
                          ? 'border-print text-print'
                          : 'border-rule text-ink-soft'
                      }`}
                    >
                      {property.isActive ? 'Active' : 'Inactive'}
                    </span>
                    <button
                      className="p-2 text-ink-faint rounded-[2px] transition-colors hover:text-stamp hover:bg-print-wash focus-visible:text-stamp focus-visible:outline-2 focus-visible:outline-print"
                      title="Delete property"
                      onClick={() => setConfirmingId(property.id)}
                      disabled={deleteProperty.isPending}
                    >
                      <FiTrash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {/* Confirm cluster — the passbook's destructive idiom: the
                    question in the caption style, stamp-red only on the
                    destructive action, Cancel a quiet hairline control on
                    paper. */}
                {confirmingId === property.id && (
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className="font-sans text-caption font-semibold uppercase tracking-[0.14em] text-ink-soft">
                      Delete this property?
                    </span>
                    <button
                      className="px-2 py-1 text-xs font-semibold text-paper bg-stamp rounded-[2px] transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-print"
                      onClick={async () => {
                        setDeleteError(null)
                        try {
                          await deleteProperty.mutateAsync(property.id)
                          setConfirmingId(null)
                        } catch (err: unknown) {
                          if (err instanceof Error) {
                            setDeleteError(err.message)
                          } else {
                            setDeleteError('Failed to delete property')
                          }
                        }
                      }}
                      disabled={deleteProperty.isPending}
                    >
                      {deleteProperty.isPending ? 'Deleting...' : 'Confirm'}
                    </button>
                    <button
                      className="px-2 py-1 text-xs font-semibold text-ink-soft bg-paper border border-rule rounded-[2px] transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-print"
                      onClick={() => setConfirmingId(null)}
                      disabled={deleteProperty.isPending}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-sm text-ink-soft">{property.address}</p>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-ink-soft">Type: {property.type}</span>
                    {property.units && (
                      <span className="text-ink-soft">
                        {property.units} units
                      </span>
                    )}
                  </div>
                  {/* The record's date is a figure: mono, tabular, in ink —
                      never a gray in the sans face. */}
                  <p className="font-mono text-[11px] text-ink-soft">
                    Created: {formatDate(property.createdAt)}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
