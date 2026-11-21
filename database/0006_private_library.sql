-- ================================================================
-- 每日研读 demo · 数据库迁移 0006
-- v2 权限模型：每用户私有书库（所有者隔离）
--   1. documents 增加 owner_id，去重约束改为 (owner_id, file_hash)
--   2. documents / chapters / paragraphs / translations 的 RLS
--      从「全员可读」改为「经 document_id 递推到 owner_id」
--   3. 删除角色概念：profiles.role / is_admin() / 管理员策略
--   4. 删除 supplement_requested（v2 已无跨用户待补充视图）
-- 目标环境：Supabase（PostgreSQL 15+）
-- 执行顺序：0001 → 0002 → 0003 → 0004 → 0005 → 0006
-- ================================================================

-- ================================================================
-- 1. documents.owner_id
-- ================================================================
alter table public.documents
  add column if not exists owner_id uuid references auth.users(id) on delete cascade;

-- 历史数据回填：v1 是共享书库，没有归属信息。
-- 策略：把历史书籍归给实例中最早创建的账号（通常是第一个注册者）；
--       若实例中已无任何账号，则清理这些无法归属的历史书籍。
do $$
declare
  v_owner uuid;
begin
  if exists (select 1 from public.documents where owner_id is null) then
    select id into v_owner from public.profiles order by created_at asc limit 1;

    if v_owner is not null then
      update public.documents set owner_id = v_owner where owner_id is null;
      raise notice '历史书籍已归属到账号 %（如需改归属请手动更新 owner_id）', v_owner;
    else
      delete from public.documents where owner_id is null;
      raise notice '实例中没有任何账号，已清理无法归属的历史书籍';
    end if;
  end if;
end;
$$;

alter table public.documents
  alter column owner_id set not null;

create index if not exists idx_documents_owner on public.documents(owner_id);

-- 去重按「所有者 + file_hash」：不同用户上传同一文件互不影响
create unique index if not exists idx_documents_owner_file_hash
  on public.documents(owner_id, file_hash)
  where file_hash is not null;

-- ================================================================
-- 2. 删除角色概念（先删策略，再删函数与字段）
-- ================================================================

-- 2.1 profiles：删除管理员策略，仅保留本人策略
drop policy if exists "profiles_read_admin" on public.profiles;
drop policy if exists "profiles_update_admin" on public.profiles;
drop policy if exists "profiles_insert_admin" on public.profiles;
drop policy if exists "profiles_insert_self" on public.profiles;

create policy "profiles_insert_self" on public.profiles
  for insert with check (auth.uid() = id);

-- 2.2 documents / chapters / paragraphs / translations：删除旧策略（含 is_admin()）
drop policy if exists "documents_read_all" on public.documents;
drop policy if exists "documents_insert_admin" on public.documents;
drop policy if exists "documents_update_admin" on public.documents;
drop policy if exists "documents_delete_admin" on public.documents;

drop policy if exists "chapters_read_all" on public.chapters;
drop policy if exists "chapters_insert_admin" on public.chapters;
drop policy if exists "chapters_update_admin" on public.chapters;
drop policy if exists "chapters_delete_admin" on public.chapters;

drop policy if exists "paragraphs_read_all" on public.paragraphs;
drop policy if exists "paragraphs_insert_admin" on public.paragraphs;
drop policy if exists "paragraphs_update_admin" on public.paragraphs;
drop policy if exists "paragraphs_delete_admin" on public.paragraphs;

drop policy if exists "translations_read_all" on public.translations;
drop policy if exists "translations_insert_admin" on public.translations;
drop policy if exists "translations_update_admin" on public.translations;
drop policy if exists "translations_delete_admin" on public.translations;

-- 2.3 删除角色函数与字段
drop function if exists public.is_admin();
alter table public.profiles drop column if exists role;

-- ================================================================
-- 3. 所有者判定辅助函数（security definer，避免策略里的嵌套 RLS）
-- ================================================================
create or replace function public.auth_owns_document(p_document_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.documents d
    where d.id = p_document_id
      and d.owner_id = auth.uid()
  );
$$;

create or replace function public.auth_owns_chapter(p_chapter_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.chapters c
    join public.documents d on d.id = c.document_id
    where c.id = p_chapter_id
      and d.owner_id = auth.uid()
  );
$$;

create or replace function public.auth_owns_paragraph(p_paragraph_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.paragraphs p
    join public.chapters c on c.id = p.chapter_id
    join public.documents d on d.id = c.document_id
    where p.id = p_paragraph_id
      and d.owner_id = auth.uid()
  );
$$;

-- ================================================================
-- 4. 新的所有者隔离策略
-- ================================================================

-- 4.1 documents：仅所有者可读写
create policy "documents_select_own" on public.documents
  for select using (owner_id = auth.uid());
create policy "documents_insert_own" on public.documents
  for insert with check (owner_id = auth.uid());
create policy "documents_update_own" on public.documents
  for update using (owner_id = auth.uid());
create policy "documents_delete_own" on public.documents
  for delete using (owner_id = auth.uid());

-- 4.2 chapters：经 document_id 递推到所有者
create policy "chapters_select_own" on public.chapters
  for select using (public.auth_owns_document(document_id));
create policy "chapters_insert_own" on public.chapters
  for insert with check (public.auth_owns_document(document_id));
create policy "chapters_update_own" on public.chapters
  for update using (public.auth_owns_document(document_id));
create policy "chapters_delete_own" on public.chapters
  for delete using (public.auth_owns_document(document_id));

-- 4.3 paragraphs：经 chapter_id 递推到所有者
create policy "paragraphs_select_own" on public.paragraphs
  for select using (public.auth_owns_chapter(chapter_id));
create policy "paragraphs_insert_own" on public.paragraphs
  for insert with check (public.auth_owns_chapter(chapter_id));
create policy "paragraphs_update_own" on public.paragraphs
  for update using (public.auth_owns_chapter(chapter_id));
create policy "paragraphs_delete_own" on public.paragraphs
  for delete using (public.auth_owns_chapter(chapter_id));

-- 4.4 translations：经 paragraph_id 递推到所有者；写入由服务端 service_role 完成
create policy "translations_select_own" on public.translations
  for select using (public.auth_owns_paragraph(paragraph_id));
create policy "translations_insert_own" on public.translations
  for insert with check (public.auth_owns_paragraph(paragraph_id));
create policy "translations_update_own" on public.translations
  for update using (public.auth_owns_paragraph(paragraph_id));
create policy "translations_delete_own" on public.translations
  for delete using (public.auth_owns_paragraph(paragraph_id));

-- ================================================================
-- 5. 删除 supplement_requested（v2 无跨用户待补充视图）
-- ================================================================
alter table public.list_items drop column if exists supplement_requested;

-- ================================================================
-- 说明：
-- 1. Storage 仍用私有 bucket，但路径改为 users/{user_id}/{document_id}/...；
--    服务端签名 URL 前校验文档归属。
-- 2. 账号运维（关闭注册、清理异常账号）走 Supabase 控制台或服务端脚本，
--    产品内不存在管理员角色与管理员界面。
-- 3. 历史书籍的 Storage 路径仍是 {document_id}/...，签名接口兼容两种路径，
--    但新上传一律写 users/{user_id}/...。
-- ================================================================
