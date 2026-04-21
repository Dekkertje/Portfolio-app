import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

// Use the standard client with localStorage so the PKCE code verifier
// survives the cross-domain OAuth redirect chain (cookie-based storage
// from @supabase/ssr loses the verifier on Vercel).
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession:     true,
    autoRefreshToken:   true,
    detectSessionInUrl: true,
  },
})

/**
 * fetch() wrapper that attaches the current user's Bearer token as an
 * Authorization header. Use this for all calls to /api/** routes so they
 * can authenticate the user (session is stored in localStorage, not cookies).
 */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession()
  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers ?? {}),
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
  })
}
