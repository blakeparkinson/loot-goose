import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function assignUniquePlayerName(existingPlayers: Array<{ name: string }>, requestedName: string): string {
  const base = String(requestedName).trim() || 'Goose Player';
  const existing = new Set(existingPlayers.map((player) => player.name.toLowerCase()));
  if (!existing.has(base.toLowerCase())) return base;

  let suffix = 2;
  while (existing.has(`${base} #${suffix}`.toLowerCase())) suffix += 1;
  return `${base} #${suffix}`;
}

function generateCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { huntData, playerName } = await req.json();

    if (!huntData || !playerName) {
      return new Response(JSON.stringify({ error: 'huntData and playerName are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const assignedName = assignUniquePlayerName([], String(playerName));
    const players = [{ name: assignedName, joinedAt: new Date().toISOString() }];

    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateCode();
      const { error } = await supabase
        .from('coop_sessions')
        .insert({ code, hunt_data: huntData, players });

      if (!error) {
        return new Response(JSON.stringify({ code, playerName: assignedName }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!error.message.includes('unique') && !error.message.includes('duplicate')) {
        throw new Error(error.message);
      }
    }

    throw new Error('Could not generate a unique code. Please try again.');
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
