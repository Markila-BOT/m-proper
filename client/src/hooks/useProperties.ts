import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { propertiesApi, queryKeys } from "../lib/api";
import type { CreatePropertyRequest } from "shared";
import { usePropertyStore } from "../stores/propertyStore";

// Hook to get all properties
export const useProperties = () => {
  return useQuery({
    queryKey: queryKeys.properties.all,
    queryFn: propertiesApi.getAll,
  });
};

// Hook to create a new property
export const useCreateProperty = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (property: CreatePropertyRequest) =>
      propertiesApi.create(property),
    onSuccess: () => {
      // Invalidate and refetch properties list
      queryClient.invalidateQueries({ queryKey: queryKeys.properties.all });
    },
    onError: (error: Error) => {
      console.error("Failed to create property:", error);
    },
  });
};

// Hook to get properties with loading and error states
export const usePropertiesWithStates = () => {
  const { data: properties, isLoading, error, refetch } = useProperties();

  return {
    properties: properties || [],
    isLoading,
    error,
    refetch,
    isEmpty: !isLoading && (!properties || properties.length === 0),
  };
};

// Hook to get selected property from Zustand store
export const useSelectedProperty = () => {
  const { selectedProperty, setSelectedProperty } = usePropertyStore();

  return {
    selectedProperty,
    setSelectedProperty,
  };
};
