import { createClient, type Session, type User as SupabaseUser } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

const createDisabledSupabaseClient = () => {
  const disabledError = (action: string) => new Error(`Supabase is not configured. ${action} is unavailable in local mode.`);
  const queryBuilder = {
    insert: async () => ({ data: null, error: disabledError('Database logging') }),
    select() {
      return this;
    },
    eq() {
      return this;
    },
    order: async () => ({ data: [], error: disabledError('History loading') }),
  };

  return {
    auth: {
      getSession: async () => ({ data: { session: null as Session | null }, error: null }),
      getUser: async () => ({ data: { user: null as SupabaseUser | null }, error: disabledError('User lookup') }),
      onAuthStateChange: (_callback: (event: string, session: Session | null) => void) => ({
        data: {
          subscription: {
            unsubscribe() {
              return undefined;
            },
          },
        },
      }),
      signInWithPassword: async () => ({ data: { user: null, session: null }, error: disabledError('Sign in') }),
      signUp: async () => ({ data: { user: null, session: null }, error: disabledError('Sign up') }),
      signOut: async () => ({ error: null }),
    },
    from: () => queryBuilder,
  };
};

if (!isSupabaseConfigured) {
  console.warn('Supabase credentials missing. Running in local mode without authentication or cloud history.');
}

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : (createDisabledSupabaseClient() as ReturnType<typeof createClient>);
