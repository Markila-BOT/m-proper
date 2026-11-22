// web/src/lib/api-client.ts
// Hand-maintained client aligned with api/openapi.json.
// Regenerate guidance: pnpm run generate:api-client

import type { CreatePropertyRequest, Property } from '#/lib/domain'

export type ApiEnvelope<T = unknown> = {
  message: string
  success: boolean
  data?: T
}

// A dev/test affordance, not a product feature: the base URL can be
// overridden at runtime from the page's own storage, ahead of the baked
// env value, so a test load can point one page at a dead port without a
// second build or boot. Nothing in the product writes this key; the
// acceptance suite's unreachable scenario does (change:
// surface-api-unreachable-state).
const API_BASE_URL_OVERRIDE_KEY = 'landlord-api-base-url-override'

function getApiBaseUrl(): string {
  // The override wins only in the browser, where storage exists — the
  // server render keeps the baked base. Storage can be unavailable
  // (private mode); the baked base still stands then.
  if (typeof window !== 'undefined') {
    try {
      const override = window.localStorage.getItem(API_BASE_URL_OVERRIDE_KEY)
      if (override && override.trim()) {
        return override.trim()
      }
    } catch {
      /* no storage — fall through to the baked base */
    }
  }
  return (
    import.meta.env.VITE_API_BASE_URL ??
    import.meta.env.API_BASE_URL ??
    'http://localhost:3000'
  )
}

async function parseEnvelope<T>(response: Response): Promise<ApiEnvelope<T>> {
  return (await response.json()) as ApiEnvelope<T>
}

export const propertiesApi = {
  async getAll(): Promise<Property[]> {
    const response = await fetch(`${getApiBaseUrl()}/properties`)
    const result = await parseEnvelope<Property[]>(response)
    if (!result.success) {
      throw new Error(result.message)
    }
    return result.data ?? []
  },

  async create(property: CreatePropertyRequest): Promise<Property> {
    const response = await fetch(`${getApiBaseUrl()}/properties`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(property),
    })
    const result = await parseEnvelope<Property>(response)
    if (!result.success) {
      throw new Error(result.message)
    }
    if (!result.data) {
      throw new Error('No data returned from server')
    }
    return result.data
  },

  async delete(id: string): Promise<boolean> {
    const response = await fetch(`${getApiBaseUrl()}/properties/${id}`, {
      method: 'DELETE',
    })
    const result = await parseEnvelope(response)
    if (!result.success) {
      throw new Error(result.message)
    }
    return true
  },
}

export const queryKeys = {
  properties: {
    all: ['properties'] as const,
    lists: () => [...queryKeys.properties.all, 'list'] as const,
    list: (filters: string) =>
      [...queryKeys.properties.lists(), { filters }] as const,
    details: () => [...queryKeys.properties.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.properties.details(), id] as const,
  },
}
