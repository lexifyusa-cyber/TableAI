export const env = {
  apiUrl: import.meta.env.VITE_API_URL || "",
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL || "",
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || "",
};

export const supabaseConfigured = Boolean(env.supabaseUrl && env.supabaseAnonKey);
export const localAuthEnabled = !supabaseConfigured;
