-- Worker invite scaffold (no outbound email). Does not modify workspace_snapshots.

create table if not exists public.organization_worker_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  display_name text,
  invited_role_title text,
  invited_department text,
  access_role text not null check (access_role in ('admin', 'member', 'viewer')),
  role_locked boolean not null default false,
  department_locked boolean not null default false,
  status text not null check (status in ('draft', 'invited', 'joined', 'revoked')),
  created_by_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  joined_user_id uuid references auth.users(id) on delete set null,
  joined_at timestamptz
);

create index if not exists organization_worker_invites_org_idx
  on public.organization_worker_invites (organization_id);

create index if not exists organization_worker_invites_email_lower_idx
  on public.organization_worker_invites (lower(trim(email)));

create index if not exists organization_worker_invites_org_status_idx
  on public.organization_worker_invites (organization_id, status);

alter table public.organization_worker_invites enable row level security;

-- Owners/admins manage invites for organizations they administer
drop policy if exists "org admins manage worker invites" on public.organization_worker_invites;
create policy "org admins manage worker invites"
  on public.organization_worker_invites
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.organization_memberships m
      where m.organization_id = organization_worker_invites.organization_id
        and m.user_id = auth.uid()
        and m.access_role in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1
      from public.organization_memberships m
      where m.organization_id = organization_worker_invites.organization_id
        and m.user_id = auth.uid()
        and m.access_role in ('owner', 'admin')
    )
  );

-- Invitees: read rows for their auth email only (drafts hidden — no cross-email leakage)
drop policy if exists "invitee reads own worker invites" on public.organization_worker_invites;
create policy "invitee reads own worker invites"
  on public.organization_worker_invites
  for select
  to authenticated
  using (
    status <> 'draft'
    and lower(trim(email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
    and exists (
      select 1
      from public.organizations o
      where o.id = organization_worker_invites.organization_id
    )
  );
