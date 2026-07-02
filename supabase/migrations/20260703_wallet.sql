-- ── byt&leg Wallet: institutionskonto med append-only hovedbog ────────
-- Sælgere optjener saldo ved salg (krediteres ved leveringsbekræftelse),
-- kan bruge den i checkout og hæve den til bankkonto (manuel udbetaling
-- via admin-kø). Pengesikkerhed: al saldo-mutation sker gennem atomiske
-- funktioner der låser konto-rækken, så to samtidige træk aldrig kan
-- overtrække. wallet_ledger er append-only (kilden til sandhed).

-- Cachet saldo — muteres KUN via wallet_credit/wallet_debit nedenfor.
create table if not exists public.wallet_accounts (
  institution_id uuid primary key references public.institutions(id) on delete cascade,
  balance        numeric(10,2) not null default 0 check (balance >= 0),
  updated_at     timestamptz not null default now()
);

-- Append-only hovedbog. Ingen UPDATE/DELETE — korrektioner sker som nye poster.
create table if not exists public.wallet_ledger (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  amount         numeric(10,2) not null,            -- fortegn: + kredit, − debet
  type           text not null check (type in (
                   'sale_credit','purchase_debit','withdrawal_debit',
                   'withdrawal_reversal','refund_credit','adjustment')),
  reference_type text,                              -- 'order' | 'payout' | 'swap' | ...
  reference_id   text,
  balance_after  numeric(10,2) not null,
  note           text,
  created_at     timestamptz not null default now()
);
create index if not exists wallet_ledger_inst_idx on public.wallet_ledger(institution_id, created_at desc);

-- Udbetalingsanmodninger. Admin markerer paid efter manuel bankoverførsel.
create table if not exists public.payouts (
  id              uuid primary key default gen_random_uuid(),
  institution_id  uuid not null references public.institutions(id),
  amount          numeric(10,2) not null check (amount > 0),
  status          text not null default 'pending' check (status in ('pending','paid','rejected')),
  bank_reg_nr     text,
  bank_account_nr text,
  ledger_id       uuid references public.wallet_ledger(id),
  requested_by    uuid,
  requested_at    timestamptz not null default now(),
  processed_by    uuid,
  processed_at    timestamptz,
  note            text
);
create index if not exists payouts_status_idx on public.payouts(status, requested_at);

-- ── Atomiske saldo-funktioner ────────────────────────────────────────
-- Låser konto-rækken (FOR UPDATE), tjekker/opdaterer saldo og skriver
-- ledger-posten i én transaktion. wallet_debit fejler ved utilstrækkelig
-- dækning, så samtidige træk aldrig kan overtrække.

create or replace function public.wallet_credit(
  _inst uuid, _amount numeric, _type text, _ref_type text, _ref_id text, _note text
) returns public.wallet_ledger
language plpgsql security definer set search_path = public as $$
declare _bal numeric(10,2); _row public.wallet_ledger;
begin
  if _amount is null or _amount <= 0 then raise exception 'credit amount must be positive'; end if;
  insert into public.wallet_accounts(institution_id, balance) values (_inst, 0)
    on conflict (institution_id) do nothing;
  select balance into _bal from public.wallet_accounts where institution_id = _inst for update;
  _bal := _bal + _amount;
  insert into public.wallet_ledger(institution_id, amount, type, reference_type, reference_id, balance_after, note)
    values (_inst, _amount, _type, _ref_type, _ref_id, _bal, _note) returning * into _row;
  update public.wallet_accounts set balance = _bal, updated_at = now() where institution_id = _inst;
  return _row;
end $$;

create or replace function public.wallet_debit(
  _inst uuid, _amount numeric, _type text, _ref_type text, _ref_id text, _note text
) returns public.wallet_ledger
language plpgsql security definer set search_path = public as $$
declare _bal numeric(10,2); _row public.wallet_ledger;
begin
  if _amount is null or _amount <= 0 then raise exception 'debit amount must be positive'; end if;
  select balance into _bal from public.wallet_accounts where institution_id = _inst for update;
  if _bal is null then raise exception 'no wallet account for institution %', _inst; end if;
  if _bal < _amount then raise exception 'insufficient balance'; end if;
  _bal := _bal - _amount;
  insert into public.wallet_ledger(institution_id, amount, type, reference_type, reference_id, balance_after, note)
    values (_inst, -_amount, _type, _ref_type, _ref_id, _bal, _note) returning * into _row;
  update public.wallet_accounts set balance = _bal, updated_at = now() where institution_id = _inst;
  return _row;
end $$;

-- ── RLS: institutioner kan LÆSE egne rækker; skrivning kun via service-role/RPC ─
alter table public.wallet_accounts enable row level security;
alter table public.wallet_ledger   enable row level security;
alter table public.payouts         enable row level security;

drop policy if exists wallet_accounts_select on public.wallet_accounts;
create policy wallet_accounts_select on public.wallet_accounts
  for select using (public.user_in_institution(institution_id));

drop policy if exists wallet_ledger_select on public.wallet_ledger;
create policy wallet_ledger_select on public.wallet_ledger
  for select using (public.user_in_institution(institution_id));

drop policy if exists payouts_select on public.payouts;
create policy payouts_select on public.payouts
  for select using (public.user_in_institution(institution_id));

-- ── Ordre-felter til fulfillment/kreditering/checkout ────────────────
alter table public.orders
  add column if not exists ship_by            timestamptz,   -- afsendelsesfrist (5 hverdage efter betaling)
  add column if not exists ship_reminder_sent boolean not null default false,
  add column if not exists credited_at        timestamptz,   -- idempotens for wallet-kreditering ved levering
  add column if not exists wallet_applied      numeric(10,2) not null default 0;  -- del af beløbet betalt fra saldo

-- payment_intent_id må være NULL for wallet-only-ordrer (ingen Stripe-betaling).
-- Unik-constraint bevares; Postgres tillader flere NULL-værdier.
alter table public.orders alter column payment_intent_id drop not null;

-- Sælger-flag: tæller manglende afsendelser (auto-annullerede handler).
-- Registreres nu; håndhævelse (kontobegrænsning) besluttes senere.
alter table public.institutions
  add column if not exists ship_fail_count integer not null default 0;
