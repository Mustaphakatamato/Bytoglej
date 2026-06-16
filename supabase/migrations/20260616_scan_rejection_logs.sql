-- scan_rejection_logs: logs person-detection rejections from the AI scan flow.
-- Image is stored in listing-images/scan-rejections/{id}.jpg and can be deleted by admin for GDPR.
-- The DB record (institution, reason, date) is retained even after image deletion.

create table if not exists public.scan_rejection_logs (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  user_id         uuid references auth.users(id) on delete set null,
  institution_name text,
  ai_reason       text,
  image_path      text,
  user_disputed   boolean not null default false,
  deleted_at      timestamptz
);

alter table public.scan_rejection_logs enable row level security;

-- Users can insert their own records (via service role in API, but policy needed for direct access)
create policy "Users insert own rejection logs"
  on public.scan_rejection_logs for insert
  to authenticated
  with check (user_id = auth.uid());

-- Users can update user_disputed on their own records
create policy "Users dispute own rejection logs"
  on public.scan_rejection_logs for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Admins can select all
create policy "Admins select rejection logs"
  on public.scan_rejection_logs for select
  to authenticated
  using (
    exists (select 1 from public.admins where user_id = auth.uid())
  );

-- Admins can update all (for image deletion)
create policy "Admins update rejection logs"
  on public.scan_rejection_logs for update
  to authenticated
  using (
    exists (select 1 from public.admins where user_id = auth.uid())
  );

-- Service role bypasses RLS — API routes using createServerClient (service role) can always write
