// One reading of a Supabase Auth failure for every server-side caller
// (design §7, §10): a 401/403 is "no session", a missing status or a 5xx is
// Supabase being unreachable. The distinction matters because an outage must
// never look like a signed-out landlord.
export function isSupabaseUnavailable(error: { status?: number }): boolean {
  return error.status === undefined || error.status === 0 || error.status >= 500
}

// The session cookie is gone (or never arrived), which is not an outage: the
// recovery link or the form needs a fresh sign-in.
export function isAuthSessionMissing(error: { name?: string }): boolean {
  return error.name === 'AuthSessionMissingError'
}
