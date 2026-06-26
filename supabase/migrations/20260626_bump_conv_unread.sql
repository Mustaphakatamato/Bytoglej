-- Atomisk inkrementering af ulæst-tællere på conversations.
--
-- Baggrund: klienterne satte tidligere modtagerens tæller med en
-- læs-fra-cache-og-skriv ( owner_unread: (cached || 0) + 1 ). Afsenderens
-- cachede samtale-objekt nulstilles aldrig når modtageren læser, så hver
-- ny besked lagde +1 oven på en forældet base. Resultatet var at tælleren
-- voksede mod det samlede antal beskeder i samtalen i stedet for det reelle
-- antal ulæste. Denne funktion inkrementerer i stedet direkte i databasen,
-- så basen altid er den aktuelle DB-værdi (race-fri).

create or replace function public.bump_conv_unread(p_conv_id uuid, p_field text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_field = 'owner_unread' then
    update public.conversations
       set owner_unread = coalesce(owner_unread, 0) + 1
     where id = p_conv_id;
  elsif p_field = 'initiator_unread' then
    update public.conversations
       set initiator_unread = coalesce(initiator_unread, 0) + 1
     where id = p_conv_id;
  else
    raise exception 'bump_conv_unread: ugyldigt felt %', p_field;
  end if;
end;
$$;

grant execute on function public.bump_conv_unread(uuid, text) to authenticated, anon;
