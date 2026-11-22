import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { propertiesApi, queryKeys } from '#/lib/api-client'
import type { CreatePropertyRequest } from '#/lib/domain'
import { usePropertyStore } from '../stores/propertyStore'

// Hook to get all properties
export const useProperties = () => {
  return useQuery({
    queryKey: queryKeys.properties.all,
    queryFn: propertiesApi.getAll,
    // One quick retry covers a dev-server restart blip; the unreachable
    // state lands within ~1s instead of the default three-attempt window,
    // so the page says what happened instead of sitting on the silent
    // zero. This query only — no retry-policy redesign.
    retry: 1,
  })
}

// Hook to create a new property
export const useCreateProperty = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (property: CreatePropertyRequest) =>
      propertiesApi.create(property),
    onSuccess: () => {
      // Invalidate and refetch properties list
      queryClient.invalidateQueries({ queryKey: queryKeys.properties.all })
    },
    onError: (error: Error) => {
      console.error('Failed to create property:', error)
    },
  })
}

// Hook to delete a property by ID
export const useDeleteProperty = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => propertiesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.properties.all })
    },
    onError: (error: Error) => {
      console.error('Failed to delete property:', error)
    },
  })
}

// Hook to get properties with loading and error states
export const usePropertiesWithStates = () => {
  const { data: properties, isLoading, error, refetch } = useProperties()

  return {
    properties: properties || [],
    isLoading,
    error,
    refetch,
    isEmpty: !isLoading && (!properties || properties.length === 0),
  }
}

// Hook to get selected property from Zustand store
export const useSelectedProperty = () => {
  const { selectedProperty, setSelectedProperty } = usePropertyStore()

  return {
    selectedProperty,
    setSelectedProperty,
  }
}
