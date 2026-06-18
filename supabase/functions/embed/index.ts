// Genererer tekst-embeddings med Supabase's INDBYGGEDE gte-small-model.
// Kører lokalt i Edge Runtime — ingen ekstern API, ingen nøgle, ingen udgift.
// Output: 384-dimensionel vektor (matcher listings.description_embedding).
//
// Deploy: supabase functions deploy embed
// Kald:   POST { "text": "..." } → { "embedding": number[384] }

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// @ts-ignore — Supabase.ai findes kun i Edge Runtime, ikke i typecheck lokalt
const model = new Supabase.ai.Session('gte-small');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { text } = await req.json();
    if (!text || !String(text).trim()) {
      return new Response(JSON.stringify({ error: 'Tom tekst' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // mean_pool + normalize giver en vektor klar til cosine-sammenligning.
    const embedding = await model.run(String(text).trim(), {
      mean_pool: true,
      normalize: true,
    });

    return new Response(JSON.stringify({ embedding }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('embed error:', err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
