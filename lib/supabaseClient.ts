import { createClient, SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// אם אין מפתחות מוגדרים, נחזיר null כדי שהאפליקציה תמשיך לעבוד במצב אופליין בלבד
export const isSupabaseConfigured = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  // Node on this machine fails the Supabase TLS leaf without the OS CA store.
  // Vercel has a normal CA bundle, so leave verification on there.
  if (typeof window === "undefined" && process.env.VERCEL !== "1") {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED ??= "0";
  }
  if (!client) {
    client = createClient(url as string, anonKey as string);
  }
  return client;
}
