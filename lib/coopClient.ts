import { createClient, RealtimeChannel } from '@supabase/supabase-js';
import { CoopCompletion } from './api';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

// Module-level singleton — one WebSocket connection shared across the app
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { params: { eventsPerSecond: 10 } },
});

let activeChannel: RealtimeChannel | null = null;
let activeCode: string | null = null;

export type CompletionHandler = (completion: CoopCompletion) => void;

/**
 * Subscribe to INSERT events on coop_completions for a session code.
 * Calling with the same code while already subscribed is a no-op.
 * Calling with a different code unsubscribes the previous channel first.
 */
export function subscribeToSession(code: string, onCompletion: CompletionHandler): void {
  if (activeChannel && activeCode === code) return;
  unsubscribeFromSession();

  activeChannel = supabase
    .channel(`coop:${code}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'coop_completions',
        filter: `session_code=eq.${code}`,
      },
      (payload) => onCompletion(payload.new as CoopCompletion),
    )
    .subscribe((status) => {
      if (__DEV__) {
        console.log(`[coop] Realtime status for ${code}:`, status);
      }
    });

  activeCode = code;
}

/**
 * Remove the active subscription. Call from useEffect cleanup in the coop screen.
 */
export function unsubscribeFromSession(): void {
  if (activeChannel) {
    supabase.removeChannel(activeChannel);
    activeChannel = null;
    activeCode = null;
  }
}
