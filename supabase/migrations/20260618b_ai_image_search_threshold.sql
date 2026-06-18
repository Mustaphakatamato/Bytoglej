-- Lighedstærskel til AI-billedsøgning.
--
-- gte-small komprimerer cosine-similarity i et smalt højt bånd (typisk 0.80-0.95),
-- så et ægte match og et ikke-match ligger tæt. En fast tærskel alene rammer derfor
-- dårligt. Vi bruger i stedet BÅDE:
--   • en absolut bund (match_threshold) — fjerner det åbenlyst urelaterede, og
--   • en relativ margin fra bedste match (match_margin) — når der findes ét stærkt
--     match, skæres den lange hale af middelmådige ~0.86-resultater væk.
-- Plus et loft (match_count) så flade fordelinger ikke fylder hele kataloget.

drop function if exists public.match_listings(vector, int);
drop function if exists public.match_listings(vector, int, float, float);

create or replace function public.match_listings(
  query_embedding vector(384),
  match_count int default 8,
  match_threshold float default 0.82,
  match_margin float default 0.07
)
returns setof public.listings
language sql
stable
security definer
set search_path = public
as $$
  with scored as (
    select id, 1 - (description_embedding <=> query_embedding) as sim
    from public.listings
    where is_active = true
      and type <> 'søges'
      and description_embedding is not null
  ), top as (select max(sim) as best from scored)
  select l.*
  from public.listings l
  join scored s on s.id = l.id, top
  where s.sim >= greatest(match_threshold, top.best - match_margin)
  order by s.sim desc
  limit match_count;
$$;

grant execute on function public.match_listings(vector, int, float, float) to anon, authenticated;
