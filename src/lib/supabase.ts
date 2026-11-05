import { createClient } from '@supabase/supabase-js';

const defaultUrl = 'https://vamzxqqihnldfbxfapsy.supabase.co';
const defaultKey = 'sb_publishable_YttINEd0lUW46udimREKuA_eosmxCrK';

const rawUrl = import.meta.env.VITE_SUPABASE_URL || defaultUrl;
const supabaseUrl = rawUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || defaultKey;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    })
  : null;
