-- AI-billedsøgning: find opslag hvis billedbeskrivelse "minder om" et søge-foto.
--
-- Flow (alt gratis i drift):
--   1. Ved upload genererer Groq en dansk billedbeskrivelse → gemmes i image_description.
--   2. Beskrivelsen embeddes med Supabase's indbyggede gte-small-model (384 dim) → description_embedding.
--   3. Ved søgning med foto laves samme analyse → query-vektor → pgvector finder nærmeste opslag.
--
-- gte-small giver ALTID 384-dimensionelle vektorer. Skiftes embedding-model senere,
-- skal kolonne + index laves om og backfilles igen.

create extension if not exists vector;

alter table public.listings
  add column if not exists image_description text,            -- AI'ens rå billedbeskrivelse (redigeres aldrig af brugeren)
  add column if not exists description_embedding vector(384); -- gte-small = 384 dimensioner

-- Cosine-index. HNSW giver god kvalitet og er fint til vores datamængde.
create index if not exists listings_embedding_idx
  on public.listings using hnsw (description_embedding vector_cosine_ops);

-- Søge-RPC: returnér de nærmeste aktive, ikke-"søges"-opslag.
-- security definer så RPC'en kan tilgås af klienten via PostgREST uden at omgå
-- forretningsfiltrene nedenfor (kun aktive, offentlige opslag returneres).
create or replace function public.match_listings(
  query_embedding vector(384),
  match_count int default 40
)
returns setof public.listings
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.listings
  where is_active = true
    and type <> 'søges'
    and description_embedding is not null
  order by description_embedding <=> query_embedding
  limit match_count;
$$;

-- Lad både anonyme og indloggede kalde søge-RPC'en (kun offentlige opslag returneres).
grant execute on function public.match_listings(vector, int) to anon, authenticated;
