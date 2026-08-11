import {
  usePropertiesWithStates,
  useDeleteProperty,
} from '../hooks/useProperties'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { FiHome, FiLoader, FiAlertCircle, FiTrash2 } from 'react-icons/fi'
import { PropertyTypeIcon } from './PropertyTypeIcon'
import { useState } from 'react'

export default function PropertiesList() {
  const { properties, isLoading, error, isEmpty } = usePropertiesWithStates()
  const deleteProperty = useDeleteProperty()
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="flex items-center space-x-2">
          <FiLoader className="w-5 h-5 text-blue-600 animate-spin" />
          <span className="text-gray-600">Loading properties...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="flex items-center space-x-2 text-red-600">
          <FiAlertCircle className="w-5 h-5" />
          <span>Error loading properties: {error.message}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Properties</h2>
        <p className="mt-2 text-gray-600">
          View detailed information about all your properties
        </p>
        {deleteError && (
          <div className="flex items-center mt-4 space-x-2 text-red-600">
            <FiAlertCircle className="w-4 h-4" />
            <span>{deleteError}</span>
          </div>
        )}
      </div>
      {isEmpty ? (
        <Card>
          <CardContent className="flex flex-col justify-center items-center p-8">
            <FiHome className="mb-4 w-12 h-12 text-gray-400" />
            <h3 className="mb-2 text-lg font-medium text-gray-900">
              No properties found
            </h3>
            <p className="mb-4 text-center text-gray-500">
              Add your first property using the sidebar to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {properties.map((property) => (
            <Card
              key={property.id}
              className="transition-shadow hover:shadow-md"
            >
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <PropertyTypeIcon
                      type={property.type}
                      className="w-5 h-5"
                    />
                    <CardTitle className="text-lg">{property.name}</CardTitle>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        property.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {property.isActive ? 'Active' : 'Inactive'}
                    </div>
                    <button
                      className="p-2 text-gray-400 rounded-lg transition-colors hover:text-red-600 hover:bg-red-50"
                      title="Delete property"
                      onClick={() => setConfirmingId(property.id)}
                      disabled={deleteProperty.isPending}
                    >
                      <FiTrash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {/* Confirm dialog */}
                {confirmingId === property.id && (
                  <div className="flex items-center mt-2 space-x-2">
                    <span>Delete this property?</span>
                    <button
                      className="px-2 py-1 text-xs text-white bg-red-600 rounded hover:bg-red-700"
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
                      className="px-2 py-1 text-xs text-gray-700 bg-gray-200 rounded hover:bg-gray-300"
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
                  <p className="text-sm text-gray-600">{property.address}</p>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Type: {property.type}</span>
                    {property.units && (
                      <span className="text-gray-500">
                        {property.units} units
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">
                    Created: {new Date(property.createdAt).toLocaleDateString()}
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
