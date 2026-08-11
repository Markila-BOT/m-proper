import { usePropertiesWithStates } from './useProperties'
import { usePropertySummaries } from './usePropertySummaries'
import { useLocalStorage } from './useLocalStorage'

export function usePropertySidebar() {
  const { properties, isLoading, error } = usePropertiesWithStates()
  const { transactions } = useLocalStorage()
  const propertySummaries = usePropertySummaries(properties, transactions)

  return {
    properties,
    propertySummaries,
    isLoading,
    error,
  }
}
