-- Company-managed role/department catalogs + membership invite scaffold.
-- Apply after 0003_company_brain.sql. Does not modify workspace_snapshots.

create table if not exists public.organization_departments (
  id uuid primary key default gen_random_uuid (),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  description text,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists organization_departments_org_idx on public.organization_departments (
  organization_id
);

create table if not exists public.organization_roles (
  id uuid primary key default gen_random_uuid (),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  description text,
  default_department_id uuid references public.organization_departments (id) on delete set null,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists organization_roles_org_idx on public.organization_roles (organization_id);

alter table public.organization_memberships
  add column if not exists invited_role_title text;

alter table public.organization_memberships
  add column if not exists invited_department text;

alter table public.organization_memberships
  add column if not exists role_locked boolean not null default false;

alter table public.organization_memberships
  add column if not exists department_locked boolean not null default false;

-- ========= RLS =========

alter table public.organization_departments enable row level security;

alter table public.organization_roles enable row level security;

drop policy if exists "members read organization_departments" on public.organization_departments;

create policy "members read organization_departments" on public.organization_departments for select to authenticated using (
  exists (
    select
      1
    from
      public.organization_memberships m
    where
      m.organization_id = organization_departments.organization_id
      and m.user_id = auth.uid ()
  )
);

drop policy if exists "admins insert organization_departments" on public.organization_departments;

create policy "admins insert organization_departments" on public.organization_departments for insert to authenticated
with
  check (
    exists (
      select
        1
      from
        public.organization_memberships m
      where
        m.organization_id = organization_departments.organization_id
        and m.user_id = auth.uid ()
        and m.access_role in ('owner', 'admin')
    )
  );

drop policy if exists "admins update organization_departments" on public.organization_departments;

create policy "admins update organization_departments" on public.organization_departments
for update
  to authenticated using (
    exists (
      select
        1
      from
        public.organization_memberships m
      where
        m.organization_id = organization_departments.organization_id
        and m.user_id = auth.uid ()
        and m.access_role in ('owner', 'admin')
    )
  )
with
  check (
    exists (
      select
        1
      from
        public.organization_memberships m
      where
        m.organization_id = organization_departments.organization_id
        and m.user_id = auth.uid ()
        and m.access_role in ('owner', 'admin')
    )
  );

drop policy if exists "admins delete organization_departments" on public.organization_departments;

create policy "admins delete organization_departments" on public.organization_departments for delete to authenticated using (
  exists (
    select
      1
    from
      public.organization_memberships m
    where
      m.organization_id = organization_departments.organization_id
      and m.user_id = auth.uid ()
      and m.access_role in ('owner', 'admin')
  )
);

drop policy if exists "members read organization_roles" on public.organization_roles;

create policy "members read organization_roles" on public.organization_roles for select to authenticated using (
  exists (
    select
      1
    from
      public.organization_memberships m
    where
      m.organization_id = organization_roles.organization_id
      and m.user_id = auth.uid ()
  )
);

drop policy if exists "admins insert organization_roles" on public.organization_roles;

create policy "admins insert organization_roles" on public.organization_roles for insert to authenticated
with
  check (
    exists (
      select
        1
      from
        public.organization_memberships m
      where
        m.organization_id = organization_roles.organization_id
        and m.user_id = auth.uid ()
        and m.access_role in ('owner', 'admin')
    )
  );

drop policy if exists "admins update organization_roles" on public.organization_roles;

create policy "admins update organization_roles" on public.organization_roles
for update
  to authenticated using (
    exists (
      select
        1
      from
        public.organization_memberships m
      where
        m.organization_id = organization_roles.organization_id
        and m.user_id = auth.uid ()
        and m.access_role in ('owner', 'admin')
    )
  )
with
  check (
    exists (
      select
        1
      from
        public.organization_memberships m
      where
        m.organization_id = organization_roles.organization_id
        and m.user_id = auth.uid ()
        and m.access_role in ('owner', 'admin')
    )
  );

drop policy if exists "admins delete organization_roles" on public.organization_roles;

create policy "admins delete organization_roles" on public.organization_roles for delete to authenticated using (
  exists (
    select
      1
    from
      public.organization_memberships m
    where
      m.organization_id = organization_roles.organization_id
      and m.user_id = auth.uid ()
      and m.access_role in ('owner', 'admin')
  )
);
