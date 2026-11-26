// The Supabase Auth configuration the browser and the server share: the
// project URL and the publishable key, both public by design. No secret or
// service key ever reaches the web (design §10, ADR-0007).
export interface SupabaseConfig {
  url: string
  publishableKey: string
}

const MISSING_CONFIG_MESSAGE =
  'Supabase Auth is not configured: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in web/.env.'

export function readSupabaseConfig(): SupabaseConfig {
  const env = import.meta.env
  const url: string | undefined = env.VITE_SUPABASE_URL
  const publishableKey: string | undefined = env.VITE_SUPABASE_ANON_KEY

  if (!url || !publishableKey) {
    throw new Error(MISSING_CONFIG_MESSAGE)
  }

  return { url, publishableKey }
}
