import { createClient } from 'npm:@supabase/supabase-js@2';

// Browsers send an Origin header and are held to this list. The native app sends
// none, so it is unaffected. Set ALLOWED_ORIGINS (comma separated) to the web
// build's origin(s) in production; the default only covers the Expo web dev server.
const DEFAULT_ALLOWED_ORIGINS = ['http://localhost:8081', 'http://localhost:19006'];

function allowedOrigins(): string[] {
  const raw = Deno.env.get('ALLOWED_ORIGINS');
  if (!raw) return DEFAULT_ALLOWED_ORIGINS;
  return raw.split(',').map((o) => o.trim()).filter(Boolean);
}

function corsHeadersFor(req: Request): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
  const origin = req.headers.get('origin');
  if (origin && allowedOrigins().includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

const serviceClient = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

function clientIp(req: Request): string | null {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim() || null;
  return req.headers.get('cf-connecting-ip') ?? req.headers.get('x-real-ip');
}

// IPs are only stored as an HMAC so the rate-limit table holds no raw addresses.
async function hashIp(ip: string): Promise<string> {
  const secret = Deno.env.get('RATE_LIMIT_SALT') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(ip));
  return Array.from(new Uint8Array(sig).slice(0, 16), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** True when this IP is still under `limit` calls to `name` in the current window. Fails open. */
async function underRateLimit(req: Request, name: string, limit: number, windowSeconds: number): Promise<boolean> {
  const ip = clientIp(req);
  if (!ip) return true;
  const { data, error } = await serviceClient.rpc('loot_goose_rate_limit_hit', {
    p_key: `${name}:${await hashIp(ip)}`,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error(`[rate-limit] ${name}: ${error.message}`);
    return true;
  }
  return data === true;
}

export interface GuardOptions {
  /** Per-IP cap for functions that spend OpenAI quota or sign storage URLs. */
  rateLimit?: { name: string; limit: number; windowSeconds?: number };
}

/**
 * Run at the top of every handler. Answers CORS preflight, refuses browser calls from
 * origins not on the list, and applies the per-IP rate limit. The JWT itself is
 * checked by the platform (verify_jwt in supabase/config.toml) before we get here.
 */
export async function guardRequest(
  req: Request,
  options: GuardOptions = {},
): Promise<{ corsHeaders: Record<string, string>; early: Response | null }> {
  const corsHeaders = corsHeadersFor(req);
  const origin = req.headers.get('origin');

  if (origin && !corsHeaders['Access-Control-Allow-Origin']) {
    return { corsHeaders, early: new Response('Origin not allowed', { status: 403, headers: corsHeaders }) };
  }
  if (req.method === 'OPTIONS') {
    return { corsHeaders, early: new Response('ok', { headers: corsHeaders }) };
  }
  if (options.rateLimit) {
    const { name, limit, windowSeconds = 3600 } = options.rateLimit;
    if (!(await underRateLimit(req, name, limit, windowSeconds))) {
      return {
        corsHeaders,
        early: new Response(JSON.stringify({ error: 'Too many requests. Please try again later.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(windowSeconds) },
        }),
      };
    }
  }
  return { corsHeaders, early: null };
}
