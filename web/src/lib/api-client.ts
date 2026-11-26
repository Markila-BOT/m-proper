// Generated/validated against api/openapi.json (API 0.1.0) on 2026-11-25T13:17:21.141Z
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

// The auth decisions an authenticated request can make, as injected
// collaborators so the decision table is testable without a browser or a
// Supabase project (design §8):
//
//   token, 2xx/4xx/5xx     → pass the response through
//   token, 401             → refresh once, retry once with the new token
//   retry, 2xx/5xx         → pass the response through
//   retry, 401             → sign out, reject
//   refresh returns none   → sign out, reject
//   no token               → reject without a network call
//
// `refresh` returns the new access token, or null when the session can no
// longer be refreshed; a thrown refresh is read the same way. `signOut`
// only ends the session — the guard sends the visitor to sign-in on the
// next navigation, so this module never navigates.
export type AuthorizedFetchDeps = {
  getToken: () => Promise<string | null>
  refresh: () => Promise<string | null>
  signOut: () => Promise<void>
  fetch: (input: string, init?: RequestInit) => Promise<Response>
}

// A 503 is the API saying it cannot verify tokens right now (key-set
// outage). It falls through the pass-through branches below untouched, so
// the envelope rejection it already produced still mounts the unreachable
// state; an auth outage must never look like a sign-out.
const NOT_SIGNED_IN = 'Not signed in — sign in to continue.'
const SESSION_ENDED = 'Your session has ended — sign in again.'

function withAuthorization(
  init: RequestInit | undefined,
  token: string,
): RequestInit {
  const headers = new Headers(init?.headers)
  headers.set('Authorization', `Bearer ${token}`)

  return { ...init, headers }
}

async function signOutAndReject(deps: AuthorizedFetchDeps): Promise<never> {
  try {
    await deps.signOut()
  } catch {
    // The session may already be gone, or the sign-out call may have been
    // lost. Either way the caller still gets the auth failure below.
  }

  throw new Error(SESSION_ENDED)
}

export async function authorizedFetch(
  url: string,
  init: RequestInit | undefined,
  deps: AuthorizedFetchDeps,
): Promise<Response> {
  const token = await deps.getToken()

  if (!token) {
    // No session means signed out; sending the request without a bearer
    // would only earn a 401 the client would then misread as an expiry.
    throw new Error(NOT_SIGNED_IN)
  }

  const first = await deps.fetch(url, withAuthorization(init, token))

  if (first.status !== 401) {
    return first
  }

  let refreshed: string | null

  try {
    refreshed = await deps.refresh()
  } catch {
    refreshed = null
  }

  if (!refreshed) {
    return signOutAndReject(deps)
  }

  // Exactly one retry: a retry that is also a 401 means the session is
  // revoked, not that another refresh will help.
  const second = await deps.fetch(url, withAuthorization(init, refreshed))

  if (second.status === 401) {
    return signOutAndReject(deps)
  }

  return second
}

// The browser's collaborators. Imported lazily because the unit test
// imports this module in plain Node, where the Supabase browser client has
// no document — and because the client is created on first use, not at
// module load.
async function browserApiDeps(): Promise<AuthorizedFetchDeps> {
  const [{ getSupabaseBrowserClient }, { signOutEverywhere }] =
    await Promise.all([
      import('./supabase/browser'),
      import('./supabase/sign-out'),
    ])

  const auth = () => getSupabaseBrowserClient().auth

  return {
    getToken: async () => {
      const { data, error } = await auth().getSession()

      return error ? null : (data.session?.access_token ?? null)
    },
    refresh: async () => {
      const { data, error } = await auth().refreshSession()

      return error ? null : (data.session?.access_token ?? null)
    },
    signOut: signOutEverywhere,
    fetch: (input, init) => fetch(input, init),
  }
}

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return authorizedFetch(
    `${getApiBaseUrl()}${path}`,
    init,
    await browserApiDeps(),
  )
}

export const propertiesApi = {
  async getAll(): Promise<Property[]> {
    const response = await apiFetch('/properties')
    const result = await parseEnvelope<Property[]>(response)
    if (!result.success) {
      throw new Error(result.message)
    }
    return result.data ?? []
  },

  async create(property: CreatePropertyRequest): Promise<Property> {
    const response = await apiFetch('/properties', {
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
    const response = await apiFetch(`/properties/${id}`, {
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
