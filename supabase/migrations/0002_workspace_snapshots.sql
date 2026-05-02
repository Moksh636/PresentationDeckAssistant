-- Single-row-per-user workspace JSON snapshots for the first persistence pass.
-- This keeps the local/mock WorkspaceState contract intact while backend tables mature.

create extension if not exists pgcrypto;

create table if not exists public.workspace_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_json jsonb not null,
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create index if not exists workspace_snapshots_user_id_idx
  on public.workspace_snapshots (user_id);

alter table public.workspace_snapshots enable row level security;

drop policy if exists "Users can select own workspace snapshot" on public.workspace_snapshots;
create policy "Users can select own workspace snapshot"
  on public.workspace_snapshots
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users can insert own workspace snapshot" on public.workspace_snapshots;
create policy "Users can insert own workspace snapshot"
  on public.workspace_snapshots
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users can update own workspace snapshot" on public.workspace_snapshots;
create policy "Users can update own workspace snapshot"
  on public.workspace_snapshots
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users can delete own workspace snapshot" on public.workspace_snapshots;
create policy "Users can delete own workspace snapshot"
  on public.workspace_snapshots
  for delete
  to authenticated
  using (user_id = auth.uid());
