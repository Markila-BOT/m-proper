import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type PropertyState = {
  selectedProperty: string
  setSelectedProperty: (propertyId: string) => void
}

export const usePropertyStore = create<PropertyState>()(
  persist(
    (set) => ({
      selectedProperty: 'all',
      setSelectedProperty: (propertyId: string) =>
        set({ selectedProperty: propertyId }),
    }),
    {
      name: 'landlord-selected-property',
    },
  ),
)
