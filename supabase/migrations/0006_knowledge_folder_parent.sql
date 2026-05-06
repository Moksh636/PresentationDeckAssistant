alter table if exists public.knowledge_folders
  add column if not exists parent_folder_id uuid references public.knowledge_folders(id) on delete set null;

create index if not exists knowledge_folders_parent_idx
  on public.knowledge_folders (parent_folder_id);
