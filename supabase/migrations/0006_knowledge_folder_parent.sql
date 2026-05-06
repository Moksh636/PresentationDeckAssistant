alter table public.knowledge_folders
  add column if not exists parent_folder_id text;

create index if not exists knowledge_folders_parent_idx
  on public.knowledge_folders (parent_folder_id);
