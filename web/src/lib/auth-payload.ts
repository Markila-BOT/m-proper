// Reading the payloads the auth server functions receive. Kept free of the
// Start server so the rules can be exercised on their own.

export interface LinkPayload {
  code?: string
  tokenHash?: string
}

// A confirmation or recovery link arrives either as a PKCE `code` or as a
// token hash. The routes read the hash from the URL's `token_hash` and hand
// it over as `tokenHash`, so this is the one place that accepts both
// spellings; the two link server functions share it so they cannot drift.
export function parseLinkPayload(data: unknown): LinkPayload {
  return {
    code: optionalString(data, 'code'),
    tokenHash:
      optionalString(data, 'tokenHash') ?? optionalString(data, 'token_hash'),
  }
}

export function requireString(data: unknown, field: string): string {
  const value = asPayload(data)[field]

  if (typeof value !== 'string') {
    throw new Error(`Invalid auth payload: ${field} must be a string`)
  }

  return value
}

export function optionalString(
  data: unknown,
  field: string,
): string | undefined {
  const value = asPayload(data)[field]

  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function asPayload(data: unknown): Record<string, unknown> {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Invalid auth payload')
  }

  return data as Record<string, unknown>
}
