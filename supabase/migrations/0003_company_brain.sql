-- Company Brain relational scaffold (no embeddings / no AI tables yet).
-- Apply after `0002_workspace_snapshots.sql`. Does not modify workspace_snapshots.

create extension if not exists pgcrypto;

-- --- Core org + membership ---

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_by_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null default '',
  display_name text not null default '',
  role_title text not null default '',
  department text not null default '',
  access_role text not null check (access_role in ('owner', 'admin', 'member', 'viewer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index if not exists organization_memberships_org_idx
  on public.organization_memberships (organization_id);

create index if not exists organization_memberships_user_idx
  on public.organization_memberships (user_id);

-- --- Knowledge library ---

create table if not exists public.knowledge_folders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists knowledge_folders_org_idx on public.knowledge_folders (organization_id);

create table if not exists public.company_knowledge_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  folder_id uuid references public.knowledge_folders(id) on delete set null,
  uploaded_by_user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text not null default '',
  file_asset_id uuid,
  source_type text not null check (
    source_type in (
      'contract',
      'deck',
      'proposal',
      'notes',
      'case-study',
      'product-doc',
      'policy',
      'transcript',
      'other'
    )
  ),
  tags text[] not null default '{}'::text[],
  approval_status text not null check (
    approval_status in ('approved', 'needs-review', 'rejected', 'archived')
  ),
  visibility text not null check (visibility in ('company', 'department', 'role', 'private')),
  allowed_departments text[] default null,
  allowed_role_titles text[] default null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_reviewed_at timestamptz
);

create index if not exists company_knowledge_items_org_idx
  on public.company_knowledge_items (organization_id);

-- --- Brand + messaging ---

create table if not exists public.company_brand_kits (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  logo_asset_id text,
  primary_color text not null default '#111827',
  secondary_color text not null default '#6b7280',
  accent_color text not null default '#2563eb',
  font_family text not null default 'system-ui',
  default_deck_tone text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists company_brand_kits_org_idx on public.company_brand_kits (organization_id);

create table if not exists public.approved_messaging_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  content text not null,
  category text not null default '',
  tags text[] not null default '{}'::text[],
  approval_status text not null check (
    approval_status in ('approved', 'needs-review', 'rejected', 'archived')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists approved_messaging_items_org_idx
  on public.approved_messaging_items (organization_id);

create table if not exists public.case_study_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  customer_name text not null default '',
  industry text not null default '',
  challenge text not null default '',
  solution text not null default '',
  outcome text not null default '',
  approved_quote text,
  source_knowledge_item_ids uuid[] not null default '{}'::uuid[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists case_study_items_org_idx on public.case_study_items (organization_id);

create table if not exists public.product_service_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text not null default '',
  target_buyer text not null default '',
  key_benefits text[] not null default '{}'::text[],
  proof_points text[] not null default '{}'::text[],
  common_objections text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists product_service_items_org_idx on public.product_service_items (organization_id);

create table if not exists public.company_activity_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  detail text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists company_activity_logs_org_idx on public.company_activity_logs (organization_id);

-- ========= RLS =========

alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.knowledge_folders enable row level security;
alter table public.company_knowledge_items enable row level security;
alter table public.company_brand_kits enable row level security;
alter table public.approved_messaging_items enable row level security;
alter table public.case_study_items enable row level security;
alter table public.product_service_items enable row level security;
alter table public.company_activity_logs enable row level security;

-- Organizations: members can read orgs they belong to
drop policy if exists "org members read organizations" on public.organizations;
create policy "org members read organizations"
  on public.organizations
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.organization_memberships m
      where m.organization_id = organizations.id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists "users create organizations" on public.organizations;
create policy "users create organizations"
  on public.organizations
  for insert
  to authenticated
  with check (created_by_user_id = auth.uid());

drop policy if exists "org owners update organizations" on public.organizations;
create policy "org owners update organizations"
  on public.organizations
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.organization_memberships m
      where m.organization_id = organizations.id
        and m.user_id = auth.uid()
        and m.access_role in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1
      from public.organization_memberships m
      where m.organization_id = organizations.id
        and m.user_id = auth.uid()
        and m.access_role in ('owner', 'admin')
    )
  );

-- Memberships: members can read rows in their orgs
drop policy if exists "org members read memberships" on public.organization_memberships;
create policy "org members read memberships"
  on public.organization_memberships
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.organization_memberships self
      where self.organization_id = organization_memberships.organization_id
        and self.user_id = auth.uid()
    )
  );

drop policy if exists "users insert self membership" on public.organization_memberships;
create policy "users insert self membership"
  on public.organization_memberships
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "admins manage memberships" on public.organization_memberships;
create policy "admins manage memberships"
  on public.organization_memberships
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.organization_memberships m
      where m.organization_id = organization_memberships.organization_id
        and m.user_id = auth.uid()
        and m.access_role in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1
      from public.organization_memberships m
      where m.organization_id = organization_memberships.organization_id
        and m.user_id = auth.uid()
        and m.access_role in ('owner', 'admin')
    )
  );

drop policy if exists "admins delete memberships" on public.organization_memberships;
create policy "admins delete memberships"
  on public.organization_memberships
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.organization_memberships m
      where m.organization_id = organization_memberships.organization_id
        and m.user_id = auth.uid()
        and m.access_role in ('owner', 'admin')
    )
  );

-- Folders CRUD within org membership
drop policy if exists "members read knowledge folders" on public.knowledge_folders;
create policy "members read knowledge folders"
  on public.knowledge_folders
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.organization_memberships m
      where m.organization_id = knowledge_folders.organization_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists "members manage knowledge folders" on public.knowledge_folders;
create policy "members manage knowledge folders"
  on public.knowledge_folders
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.organization_memberships m
      where m.organization_id = knowledge_folders.organization_id
        and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.organization_memberships m
      where m.organization_id = knowledge_folders.organization_id
        and m.user_id = auth.uid()
    )
  );

-- Knowledge items visibility + approvals (server-side scaffold)
drop policy if exists "members read knowledge items" on public.company_knowledge_items;
create policy "members read knowledge items"
  on public.company_knowledge_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.organization_memberships me
      where me.organization_id = company_knowledge_items.organization_id
        and me.user_id = auth.uid()
    )
    and (
      company_knowledge_items.approval_status = 'approved'
      or company_knowledge_items.uploaded_by_user_id = auth.uid()
      or exists (
        select 1
        from public.organization_memberships ma
        where ma.organization_id = company_knowledge_items.organization_id
          and ma.user_id = auth.uid()
          and ma.access_role in ('owner', 'admin')
      )
    )
    and (
      company_knowledge_items.visibility = 'company'
      or (
        company_knowledge_items.visibility = 'private'
        and company_knowledge_items.uploaded_by_user_id = auth.uid()
      )
      or (
        company_knowledge_items.visibility = 'department'
        and (
          company_knowledge_items.allowed_departments is null
          or cardinality(company_knowledge_items.allowed_departments) = 0
          or exists (
            select 1
            from public.organization_memberships md
            where md.organization_id = company_knowledge_items.organization_id
              and md.user_id = auth.uid()
              and md.department = any (company_knowledge_items.allowed_departments)
          )
        )
      )
      or (
        company_knowledge_items.visibility = 'role'
        and (
          company_knowledge_items.allowed_role_titles is null
          or cardinality(company_knowledge_items.allowed_role_titles) = 0
          or exists (
            select 1
            from public.organization_memberships mr
            where mr.organization_id = company_knowledge_items.organization_id
              and mr.user_id = auth.uid()
              and mr.role_title = any (company_knowledge_items.allowed_role_titles)
          )
        )
      )
    )
  );

drop policy if exists "members insert knowledge items" on public.company_knowledge_items;
create policy "members insert knowledge items"
  on public.company_knowledge_items
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.organization_memberships m
      where m.organization_id = company_knowledge_items.organization_id
        and m.user_id = auth.uid()
    )
    and uploaded_by_user_id = auth.uid()
  );

drop policy if exists "members update own draft knowledge" on public.company_knowledge_items;
create policy "members update own draft knowledge"
  on public.company_knowledge_items
  for update
  to authenticated
  using (
    uploaded_by_user_id = auth.uid()
    and approval_status in ('needs-review')
  )
  with check (
    uploaded_by_user_id = auth.uid()
  );

drop policy if exists "admins update knowledge items" on public.company_knowledge_items;
create policy "admins update knowledge items"
  on public.company_knowledge_items
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.organization_memberships m
      where m.organization_id = company_knowledge_items.organization_id
        and m.user_id = auth.uid()
        and m.access_role in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1
      from public.organization_memberships m
      where m.organization_id = company_knowledge_items.organization_id
        and m.user_id = auth.uid()
        and m.access_role in ('owner', 'admin')
    )
  );

drop policy if exists "admins delete knowledge items" on public.company_knowledge_items;
create policy "admins delete knowledge items"
  on public.company_knowledge_items
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.organization_memberships m
      where m.organization_id = company_knowledge_items.organization_id
        and m.user_id = auth.uid()
        and m.access_role in ('owner', 'admin')
    )
  );

-- Brand kits + messaging: members read; owners/admins write
drop policy if exists "members read brand kits" on public.company_brand_kits;
create policy "members read brand kits"
  on public.company_brand_kits
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.organization_memberships m
      where m.organization_id = company_brand_kits.organization_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists "admins manage brand kits" on public.company_brand_kits;
create policy "admins manage brand kits"
  on public.company_brand_kits
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.organization_memberships m
      where m.organization_id = company_brand_kits.organization_id
        and m.user_id = auth.uid()
        and m.access_role in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1
      from public.organization_memberships m
      where m.organization_id = company_brand_kits.organization_id
        and m.user_id = auth.uid()
        and m.access_role in ('owner', 'admin')
    )
  );

drop policy if exists "members read approved messaging" on public.approved_messaging_items;
create policy "members read approved messaging"
  on public.approved_messaging_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.organization_memberships m
      where m.organization_id = approved_messaging_items.organization_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists "admins manage approved messaging" on public.approved_messaging_items;
create policy "admins manage approved messaging"
  on public.approved_messaging_items
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.organization_memberships m
      where m.organization_id = approved_messaging_items.organization_id
        and m.user_id = auth.uid()
        and m.access_role in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1
      from public.organization_memberships m
      where m.organization_id = approved_messaging_items.organization_id
        and m.user_id = auth.uid()
        and m.access_role in ('owner', 'admin')
    )
  );

-- Case studies / products: members read, members write scaffold (adjust later for stricter approvals)
drop policy if exists "members read case studies" on public.case_study_items;
create policy "members read case studies"
  on public.case_study_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.organization_memberships m
      where m.organization_id = case_study_items.organization_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists "members upsert case studies" on public.case_study_items;
create policy "members upsert case studies"
  on public.case_study_items
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.organization_memberships m
      where m.organization_id = case_study_items.organization_id
        and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.organization_memberships m
      where m.organization_id = case_study_items.organization_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists "members read products" on public.product_service_items;
create policy "members read products"
  on public.product_service_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.organization_memberships m
      where m.organization_id = product_service_items.organization_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists "members upsert products" on public.product_service_items;
create policy "members upsert products"
  on public.product_service_items
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.organization_memberships m
      where m.organization_id = product_service_items.organization_id
        and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.organization_memberships m
      where m.organization_id = product_service_items.organization_id
        and m.user_id = auth.uid()
    )
  );

-- Activity logs: owners/admins read; any member can insert (activity writer is client for now)
drop policy if exists "admins read activity logs" on public.company_activity_logs;
create policy "admins read activity logs"
  on public.company_activity_logs
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.organization_memberships m
      where m.organization_id = company_activity_logs.organization_id
        and m.user_id = auth.uid()
        and m.access_role in ('owner', 'admin')
    )
  );

drop policy if exists "members insert activity logs" on public.company_activity_logs;
create policy "members insert activity logs"
  on public.company_activity_logs
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.organization_memberships m
      where m.organization_id = company_activity_logs.organization_id
        and m.user_id = auth.uid()
    )
    and actor_user_id = auth.uid()
  );
