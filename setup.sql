-- LegetøjsByt database setup
-- Kør dette i Supabase SQL Editor

create extension if not exists "uuid-ossp";

-- Institutions
create table if not exists institutions (
  id uuid default uuid_generate_v4() primary key,
  cvr text unique not null,
  name text not null,
  institution_type text,
  ownership_type   text,
  address text,
  zipcode text,
  city text,
  children_count integer,
  phone text,
  website text,
  leader_name  text,
  leader_phone text,
  leader_email text,
  contact_name text,
  email text,
  created_at timestamptz default now()
);

-- Listings
create table if not exists listings (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  description text default '',
  type text not null check (type in ('køb', 'byd', 'byt')),
  price integer,
  condition text default 'God',
  age_group text default '3-6 år',
  city text default 'København',
  institution_name text not null,
  emoji text default '🧸',
  color text default '#FFD166',
  bid_count integer default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Bids
create table if not exists bids (
  id uuid default uuid_generate_v4() primary key,
  listing_id uuid references listings(id) on delete cascade,
  bidder_name text not null,
  amount integer not null,
  created_at timestamptz default now()
);

-- Messages
create table if not exists messages (
  id uuid default uuid_generate_v4() primary key,
  listing_id uuid references listings(id) on delete cascade,
  sender_name text not null,
  message text not null,
  created_at timestamptz default now()
);

-- RLS policies (public read/write for demo)
alter table institutions enable row level security;
alter table listings enable row level security;
alter table bids enable row level security;
alter table messages enable row level security;

create policy "Public read" on institutions for select using (true);
create policy "Public insert" on institutions for insert with check (true);
create policy "Public read" on listings for select using (true);
create policy "Public insert" on listings for insert with check (true);
create policy "Public update" on listings for update using (true);
create policy "Public read" on bids for select using (true);
create policy "Public insert" on bids for insert with check (true);
create policy "Public read" on messages for select using (true);
create policy "Public insert" on messages for insert with check (true);

-- Seed data
insert into listings (title, description, type, price, condition, age_group, city, institution_name, emoji, color, bid_count) values
  ('LEGO Duplo stor kasse', 'Stor kasse med blandede LEGO Duplo klodser. Ca. 200 stk. Enkelte stykker mangler, men det meste er intakt. Farverige og velegnede til de mindste.', 'byt', null, 'God', '1-3 år', 'Aarhus', 'Solsikken Vuggestue', '🧱', '#FFD166', 3),
  ('Træ-køkken med tilbehør', 'Flot træ-køkken med medfølgende tilbehør: gryder, tallerkener, madvarer i træ. Lettere slitage på toppen. Afhentes i København NV.', 'køb', 350, 'Meget god', '3-6 år', 'København', 'Regnbuen Børnehave', '🍳', '#06D6A0', 0),
  ('Sandkasse-sæt (30 dele)', 'Komplet sandkasse-sæt med spande, former, skovle og harver. Sættes til salg da institutionen har fået nye. Startbud: 100 kr.', 'byd', null, 'Acceptabel', '3-8 år', 'Odense', 'Havet SFO', '🏖️', '#FFB347', 7),
  ('Balancecykler × 4', '4 stk. balancecykler i god stand. To er røde, to er blå. Alle har fungerende bremser. Sælges samlet.', 'køb', 800, 'God', '2-5 år', 'Aalborg', 'Lindebjerg Skole', '🚲', '#A78BFA', 0),
  ('Puslespil-samling (15 stk)', '15 puslespil i varierende størrelser (24-100 brikker). De fleste er komplette. Ønsker at bytte mod motorik-legetøj.', 'byt', null, 'God', '4-8 år', 'Esbjerg', 'Månen Børnehave', '🧩', '#EF476F', 0),
  ('Motorik-pude sæt', 'Næsten nyt sæt motorik-puder. 8 stk. i forskellige former og farver. Bruges til bevægelse og balance. Startbud: 200 kr.', 'byd', null, 'Ny', '1-4 år', 'Randers', 'Stjernerne SFO', '🎯', '#118AB2', 2),
  ('Rollespils-kostumer (20 stk)', '20 rollespilskostumer inkl. prinsesse, ridder, dyrekostumer mv. Ønsker at bytte mod naturmaterialer eller bøger.', 'byt', null, 'God', '3-7 år', 'Vejle', 'Eventyrhaven Børnehave', '🎭', '#F4831F', 0),
  ('Klatrevæg-modul', 'Fritstående klatrevæg-modul i træ. 180 cm høj, 120 cm bred. Alle greb intakte. Demonteret klar til afhentning.', 'køb', 1200, 'Meget god', '6-12 år', 'Kolding', 'Bakkeskolen SFO', '🧗', '#4CAF50', 0),
  ('Bamse-samling × 12', 'Stor samling bløde bamser i alle størrelser. Rengjorte og klar til ny institution. Perfekt til vuggestue.', 'byt', null, 'God', '0-3 år', 'København', 'Skovtrolden Vuggestue', '🧸', '#FFD166', 1),
  ('Krea-materiale kasse', 'Stor kasse med kreativt materiale: farver, papir, lim, sakse, perler mv. Alt er næsten nyt.', 'køb', 200, 'Ny', '3-8 år', 'Aarhus', 'Regnbuen Børnehave', '🎨', '#FF6B9D', 0);
