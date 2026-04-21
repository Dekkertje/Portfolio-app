import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables")
}

export async function createServerSupabaseClient() {
  const cookieStore = await cookies()

  return createServerClient(
    supabaseUrl!,
    supabaseAnonKey!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch (error) {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch (error) {
            // The `delete` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}

/**
 * Service-role client — bypasses RLS entirely.
 * Use ONLY in server-side API routes that write reference data (prices, fx_rates, securities).
 * Never expose this client to the browser.
 */
export function createServiceSupabaseClient() {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable")
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  })
}

/**
 * Creates a Supabase client authenticated via the Bearer token in the
 * Authorization header. Use this in API Route Handlers so they work with
 * the localStorage-based browser client (which doesn't set cookies).
 */
export function createRouteHandlerClient(request: Request | NextRequest) {
  const token = (request.headers.get('Authorization') ?? '').replace('Bearer ', '').trim()
  if (!supabaseUrl || !supabaseAnonKey) throw new Error('Missing Supabase environment variables')
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: token ? { Authorization: `Bearer ${token}` } : {} },
    auth: { persistSession: false },
  })
}

// Legacy export for backward compatibility
export const supabaseServer = createServerClient(
  supabaseUrl!,
  supabaseAnonKey!,
  {
    cookies: {
      get() { return undefined },
      set() {},
      remove() {},
    },
  }
)

