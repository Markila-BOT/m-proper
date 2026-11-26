// web/src/lib/api-client.ts
// Hand-maintained client for the properties routes the app serves on its own
// origin (`/api/properties`, `/api/properties/:id`). There is no generated
// contract and no API host: the domain types here and the route handlers share
// `#/lib/domain`, so a shape drift fails the type check.

import type { CreatePropertyRequest, Property } from '#/lib/domain'

export type ApiEnvelope<T = unknown> = {
  message: string
  success: boolean
  data?: T
}

// The properties routes live on the app's own origin (web-app spec "Property
// calls stay on the app's origin"), so there is no API host to configure. The
// browser sends its session cookie with every call; `credentials:
// 'same-origin'` states that intent rather than leaning on the default.
const UNREADABLE_RESPONSE =
  'The server sent an unreadable response. Try again shortly.'

async function parseEnvelope<T>(response: Response): Promise<ApiEnvelope<T>> {
  try {
    return (await response.json()) as ApiEnvelope<T>
  } catch {
    // A proxy's HTML page or an empty body is not an envelope. Rejecting here
    // keeps the failure in the app's own voice (and the query's error branch
    // mounts the unreachable state) instead of leaking a SyntaxError.
    throw new Error(UNREADABLE_RESPONSE)
  }
}

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(path, {
    ...init,
    credentials: 'same-origin',
  })
}

export const propertiesApi = {
  async getAll(): Promise<Property[]> {
    const response = await apiFetch('/api/properties')
    const result = await parseEnvelope<Property[]>(response)
    if (!result.success) {
      throw new Error(result.message)
    }
    return result.data ?? []
  },

  async create(property: CreatePropertyRequest): Promise<Property> {
    const response = await apiFetch('/api/properties', {
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
    const response = await apiFetch(`/api/properties/${id}`, {
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
