import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database.types';

/**
 * Supabase client.
 *
 * Configuration comes from the environment, never from source. Expo inlines any
 * `EXPO_PUBLIC_*` variable into the client bundle at build time, which is the
 * correct place for the project URL and the publishable key — both are designed
 * to be shipped in a client, and the database is protected by row-level
 * security rather than by hiding them.
 *
 * The service role key must never appear here or anywhere else the app bundles.
 * It bypasses RLS entirely and belongs only in server-side or one-off admin
 * contexts (see scripts/, which reads it from a gitignored .env.local).
 */

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/**
 * Whether a backend is configured at all. When false the app runs entirely on
 * the bundled seed data, which keeps it working offline (U-07) and keeps a
 * missing key from turning into a blank screen.
 */
export const hasBackend = Boolean(url && publishableKey);

export const supabase: SupabaseClient<Database> | null = hasBackend
  ? createClient<Database>(url!, publishableKey!, {
      auth: {
        // React Native has no localStorage; sessions persist through AsyncStorage.
        storage: AsyncStorage,
        persistSession: true,
        autoRefreshToken: true,
        // Native apps have no URL to parse a session out of.
        detectSessionInUrl: false,
      },
      global: {
        headers: { 'x-client-info': 'nightlife-mobile' },
      },
    })
  : null;

/** Throws if called when no backend is configured. Use `hasBackend` to branch. */
export function requireSupabase(): SupabaseClient<Database> {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and ' +
        'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env, then restart the bundler ' +
        'with `npx expo start --clear`.',
    );
  }
  return supabase;
}
