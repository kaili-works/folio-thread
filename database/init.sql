-- 由 scripts/build-init-sql.mjs 自动生成，请勿手动编辑。
-- 用法：在 Supabase Dashboard -> SQL Editor 中整段执行。
-- 源文件：0001_schema.sql, 0002_images.sql, 0003_semantic.sql, 0004_toc_depth.sql, 0005_reading_speed.sql, 0006_private_library.sql, 0007_theme_status.sql, 0008_theme_domain.sql
-- 重新生成：npm run db:init

-- ============================================================
-- 0001_schema.sql
-- ============================================================

-- ================================================================
-- 每日研读 demo · 数据库迁移 0001
-- 建表 + RLS 策略 + 单活跃会话支持
-- 目标环境：Supabase（PostgreSQL 15+）
-- 权限规则依据《项目需求说明》第 5 节
-- ================================================================

create extension if not exists "pgcrypto";

-- ================================================================
-- 通用辅助函数
-- ================================================================

-- 自动更新时间戳
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ================================================================
-- profiles：用户资料 + 单活跃会话
-- ================================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'member' check (role in ('admin', 'member')),
  active_session_token text,
  created_at timestamptz not null default now()
);

-- 判断当前登录用户是否为管理员（security definer，避免 RLS 递归查询 profiles 自身）
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

-- 新用户注册后自动创建 profile
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;

create policy "profiles_read_self" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_read_admin" on public.profiles
  for select using (public.is_admin());
create policy "profiles_update_self" on public.profiles
  for update using (auth.uid() = id);
create policy "profiles_update_admin" on public.profiles
  for update using (public.is_admin());
create policy "profiles_insert_admin" on public.profiles
  for insert with check (public.is_admin() or auth.uid() = id);

-- ================================================================
-- documents：书籍（共享书库，仅管理员可写）
-- ================================================================
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  author text,
  description text,
  cover_url text,
  category text,
  language text,
  file_path text,
  file_hash text,
  parse_version int,
  total_words_original bigint,
  total_words_translated_estimate bigint,
  created_at timestamptz not null default now()
);

alter table public.documents enable row level security;

create policy "documents_read_all" on public.documents
  for select using (true);
create policy "documents_insert_admin" on public.documents
  for insert with check (public.is_admin());
create policy "documents_update_admin" on public.documents
  for update using (public.is_admin());
create policy "documents_delete_admin" on public.documents
  for delete using (public.is_admin());

-- ================================================================
-- chapters：章节
-- ================================================================
create table public.chapters (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  order_index int not null,
  title text,
  word_count_original bigint,
  word_count_translated_estimate bigint,
  unique (document_id, order_index)
);

alter table public.chapters enable row level security;

create policy "chapters_read_all" on public.chapters
  for select using (true);
create policy "chapters_insert_admin" on public.chapters
  for insert with check (public.is_admin());
create policy "chapters_update_admin" on public.chapters
  for update using (public.is_admin());
create policy "chapters_delete_admin" on public.chapters
  for delete using (public.is_admin());

-- ================================================================
-- paragraphs：段落
-- ================================================================
create table public.paragraphs (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  order_index int not null,
  text_original text,
  word_count_original bigint,
  cfi text,
  unique (chapter_id, order_index)
);

alter table public.paragraphs enable row level security;

create policy "paragraphs_read_all" on public.paragraphs
  for select using (true);
create policy "paragraphs_insert_admin" on public.paragraphs
  for insert with check (public.is_admin());
create policy "paragraphs_update_admin" on public.paragraphs
  for update using (public.is_admin());
create policy "paragraphs_delete_admin" on public.paragraphs
  for delete using (public.is_admin());

-- ================================================================
-- translations：段落翻译缓存（全局共享，仅管理员/服务端可写）
-- ================================================================
create table public.translations (
  id uuid primary key default gen_random_uuid(),
  paragraph_id uuid not null references public.paragraphs(id) on delete cascade,
  content_hash text not null,
  model_version text not null,
  text_translated text,
  status text not null default 'pending' check (status in ('pending', 'done', 'failed')),
  created_at timestamptz not null default now(),
  unique (paragraph_id, content_hash, model_version)
);

alter table public.translations enable row level security;

create policy "translations_read_all" on public.translations
  for select using (true);
create policy "translations_insert_admin" on public.translations
  for insert with check (public.is_admin());
create policy "translations_update_admin" on public.translations
  for update using (public.is_admin());
create policy "translations_delete_admin" on public.translations
  for delete using (public.is_admin());

-- ================================================================
-- themes：研究主题
-- ================================================================
create table public.themes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  daily_budget_minutes int not null default 30,
  daily_budget_weight numeric not null default 1.0,
  created_at timestamptz not null default now()
);

alter table public.themes enable row level security;

create policy "themes_select_own" on public.themes
  for select using (auth.uid() = user_id);
create policy "themes_insert_own" on public.themes
  for insert with check (auth.uid() = user_id);
create policy "themes_update_own" on public.themes
  for update using (auth.uid() = user_id);
create policy "themes_delete_own" on public.themes
  for delete using (auth.uid() = user_id);

-- ================================================================
-- reading_lists：阅读清单
-- ================================================================
create table public.reading_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  theme_id uuid not null references public.themes(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  created_at timestamptz not null default now()
);

alter table public.reading_lists enable row level security;

create policy "reading_lists_select_own" on public.reading_lists
  for select using (auth.uid() = user_id);
create policy "reading_lists_insert_own" on public.reading_lists
  for insert with check (auth.uid() = user_id);
create policy "reading_lists_update_own" on public.reading_lists
  for update using (auth.uid() = user_id);
create policy "reading_lists_delete_own" on public.reading_lists
  for delete using (auth.uid() = user_id);

-- ================================================================
-- list_items：清单项（= 一整本书）
-- ================================================================
create table public.list_items (
  id uuid primary key default gen_random_uuid(),
  reading_list_id uuid not null references public.reading_lists(id) on delete cascade,
  order_index int not null,
  document_id uuid references public.documents(id) on delete set null,
  reason text,
  estimated_minutes int,
  availability text not null default 'readable' check (availability in ('readable', 'pending_supplement', 'stale')),
  source text not null default 'library' check (source in ('library', 'ai_web', 'manual')),
  candidate_metadata jsonb not null default '{}'::jsonb,
  matched_document_id uuid references public.documents(id) on delete set null,
  supplement_requested boolean not null default false,
  last_checked_at timestamptz,
  status text not null default 'unread' check (status in ('unread', 'in_progress', 'completed', 'skipped', 'shelved')),
  locked boolean not null default false,
  deleted_at timestamptz
);

alter table public.list_items enable row level security;

create policy "list_items_select_own" on public.list_items
  for select using (
    auth.uid() = (select user_id from public.reading_lists rl where rl.id = reading_list_id)
  );
create policy "list_items_insert_own" on public.list_items
  for insert with check (
    auth.uid() = (select user_id from public.reading_lists rl where rl.id = reading_list_id)
  );
create policy "list_items_update_own" on public.list_items
  for update using (
    auth.uid() = (select user_id from public.reading_lists rl where rl.id = reading_list_id)
  );
create policy "list_items_delete_own" on public.list_items
  for delete using (
    auth.uid() = (select user_id from public.reading_lists rl where rl.id = reading_list_id)
  );

-- ================================================================
-- reading_progress：阅读进度（书内进度，chapter 级 + paragraph 级）
-- ================================================================
create table public.reading_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  paragraph_id uuid references public.paragraphs(id) on delete set null,
  status text not null default 'unread' check (status in ('unread', 'in_progress', 'completed')),
  completed_at timestamptz,
  unique (user_id, chapter_id)
);

alter table public.reading_progress enable row level security;

create policy "reading_progress_select_own" on public.reading_progress
  for select using (auth.uid() = user_id);
create policy "reading_progress_insert_own" on public.reading_progress
  for insert with check (auth.uid() = user_id);
create policy "reading_progress_update_own" on public.reading_progress
  for update using (auth.uid() = user_id);
create policy "reading_progress_delete_own" on public.reading_progress
  for delete using (auth.uid() = user_id);

-- ================================================================
-- annotations：私有笔记（整段标记 + 评论）
-- ================================================================
create table public.annotations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  paragraph_id uuid not null references public.paragraphs(id) on delete cascade,
  comment text,
  color text check (color is null or color in ('yellow', 'blue', 'green')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.annotations enable row level security;

create policy "annotations_select_own" on public.annotations
  for select using (auth.uid() = user_id);
create policy "annotations_insert_own" on public.annotations
  for insert with check (auth.uid() = user_id);
create policy "annotations_update_own" on public.annotations
  for update using (auth.uid() = user_id);
create policy "annotations_delete_own" on public.annotations
  for delete using (auth.uid() = user_id);

create trigger annotations_set_updated_at
  before update on public.annotations
  for each row execute function public.set_updated_at();

-- ================================================================
-- book_note_status：全书笔记状态（可选）
-- ================================================================
create table public.book_note_status (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  notes_completed boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (user_id, document_id)
);

alter table public.book_note_status enable row level security;

create policy "book_note_status_select_own" on public.book_note_status
  for select using (auth.uid() = user_id);
create policy "book_note_status_insert_own" on public.book_note_status
  for insert with check (auth.uid() = user_id);
create policy "book_note_status_update_own" on public.book_note_status
  for update using (auth.uid() = user_id);
create policy "book_note_status_delete_own" on public.book_note_status
  for delete using (auth.uid() = user_id);

create trigger book_note_status_set_updated_at
  before update on public.book_note_status
  for each row execute function public.set_updated_at();

-- ================================================================
-- daily_packs：每日包
-- ================================================================
create table public.daily_packs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  status text not null default 'draft' check (status in ('draft', 'confirmed')),
  items jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null default now(),
  unique (user_id, date)
);

alter table public.daily_packs enable row level security;

create policy "daily_packs_select_own" on public.daily_packs
  for select using (auth.uid() = user_id);
create policy "daily_packs_insert_own" on public.daily_packs
  for insert with check (auth.uid() = user_id);
create policy "daily_packs_update_own" on public.daily_packs
  for update using (auth.uid() = user_id);
create policy "daily_packs_delete_own" on public.daily_packs
  for delete using (auth.uid() = user_id);

-- ================================================================
-- reading_stats：统计
-- ================================================================
create table public.reading_stats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  completed_chapters int not null default 0,
  completed_units int not null default 0,
  completed_books int not null default 0,
  words_original bigint not null default 0,
  words_translated_estimate bigint not null default 0,
  unique (user_id, date)
);

alter table public.reading_stats enable row level security;

create policy "reading_stats_select_own" on public.reading_stats
  for select using (auth.uid() = user_id);
create policy "reading_stats_insert_own" on public.reading_stats
  for insert with check (auth.uid() = user_id);
create policy "reading_stats_update_own" on public.reading_stats
  for update using (auth.uid() = user_id);
create policy "reading_stats_delete_own" on public.reading_stats
  for delete using (auth.uid() = user_id);

-- ================================================================
-- 单活跃会话辅助（由服务端 API 调用，绕过 RLS）
-- ================================================================

-- 登录时轮换会话 token：生成新 token 覆盖旧值，旧会话立即失效
-- 注意：Supabase 的 pgcrypto 通常装在 extensions schema，函数里 set search_path=public
-- 会找不到 gen_random_bytes；这里改用 PostgreSQL 内置的 gen_random_uuid()（无需扩展）。
create or replace function public.rotate_session_token(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
begin
  v_token := replace(gen_random_uuid()::text, '-', '') ||
             replace(gen_random_uuid()::text, '-', '');
  update public.profiles
     set active_session_token = v_token
   where id = p_user_id;
  return v_token;
end;
$$;

-- 校验会话 token 是否仍与存储一致（不一致 = 已被其他设备挤下线）
create or replace function public.session_is_valid(p_user_id uuid, p_token text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_user_id
      and p.active_session_token is not null
      and p.active_session_token = p_token
  );
$$;

-- ================================================================
-- 常用索引
-- ================================================================
create index if not exists idx_chapters_document on public.chapters(document_id);
create index if not exists idx_paragraphs_chapter on public.paragraphs(chapter_id);
create index if not exists idx_translations_paragraph on public.translations(paragraph_id);
create index if not exists idx_list_items_reading_list on public.list_items(reading_list_id, order_index);
create index if not exists idx_list_items_document on public.list_items(document_id);
create index if not exists idx_reading_progress_user on public.reading_progress(user_id, document_id);
create index if not exists idx_annotations_user_doc on public.annotations(user_id, document_id);
create index if not exists idx_themes_user on public.themes(user_id);
create index if not exists idx_reading_lists_user_theme on public.reading_lists(user_id, theme_id);
create index if not exists idx_daily_packs_user_date on public.daily_packs(user_id, date);
create index if not exists idx_reading_stats_user_date on public.reading_stats(user_id, date);

-- ================================================================
-- 说明：
-- 1. Storage 私有 bucket（shared/{document_id}）的访问控制需在 Supabase
--    Storage 层单独配置（私有 bucket + 短时签名 URL），不在此迁移中。
-- 2. DeepSeek 翻译由服务端（Edge Function / 后端 API）调用，翻译结果以
--    service_role 或管理员身份写入 translations（service_role 绕过 RLS）。
-- 3. 单会话完整流程在应用层实现：
--    登录成功 → 调用 rotate_session_token() 拿新 token → 客户端随请求携带；
--    每次受保护请求 → 服务端调用 session_is_valid() 校验，不一致则 401。
-- ================================================================

-- ============================================================
-- 0002_images.sql
-- ============================================================

-- ================================================================
-- 每日研读 demo · 数据库迁移 0002
-- 段落图片支持：paragraphs.image_path 标记图片段
-- ================================================================

alter table public.paragraphs
  add column if not exists image_path text;

-- image_path 非空表示这是一个图片段（正文中的插图），阅读器据此渲染 <img>

-- ============================================================
-- 0003_semantic.sql
-- ============================================================

-- ================================================================
-- 每日研读 demo · 数据库迁移 0003
-- HTML 语义渲染：paragraphs 增加 block_type / text_html
-- ================================================================

-- block_type：p / h1 / h2 / h3 / h4 / li / blockquote / pre / hr / image
--   image 由 image_path 非空标识，block_type 默认 'p' 或 'image'
alter table public.paragraphs
  add column if not exists block_type text not null default 'p';

-- text_html：经过白名单清洗的内联 HTML，仅供展示（原文模式）
alter table public.paragraphs
  add column if not exists text_html text;

-- 已有图片段（image_path 非空）统一标为 image
update public.paragraphs
   set block_type = 'image'
 where image_path is not null
   and (block_type is null or block_type = 'p');

-- ============================================================
-- 0004_toc_depth.sql
-- ============================================================

-- ================================================================
-- 每日研读 demo · 数据库迁移 0004
-- 多级目录：chapters 增加 depth（目录层级，用于侧栏缩进）
-- ================================================================

alter table public.chapters
  add column if not exists depth int not null default 0;

-- ============================================================
-- 0005_reading_speed.sql
-- ============================================================

-- ================================================================
-- 每日研读 demo · 数据库迁移 0005
-- 阅读速度可配置：profiles 增加 reading_speed（字/分钟，默认 300）
-- ================================================================

alter table public.profiles
  add column if not exists reading_speed int not null default 300;

-- ============================================================
-- 0006_private_library.sql
-- ============================================================

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

-- ============================================================
-- 0007_theme_status.sql
-- ============================================================

-- ================================================================
-- 0007 主题状态（优先 / 正常 / 搁置）
-- 在 Supabase SQL Editor 执行本文件
-- ================================================================

-- status: priority=优先排入每日包, active=正常, shelved=搁置（不排入每日包）
alter table public.themes
  add column if not exists status text not null default 'active';

alter table public.themes
  drop constraint if exists themes_status_check;

alter table public.themes
  add constraint themes_status_check
  check (status in ('active', 'priority', 'shelved'));

-- ============================================================
-- 0008_theme_domain.sql
-- ============================================================

-- 主题领域：统计页按领域分篮子（AI 自动归类，可手动修改）
alter table public.themes
  add column if not exists domain text;

alter table public.themes
  drop constraint if exists themes_domain_check;

alter table public.themes
  add constraint themes_domain_check
  check (
    domain is null
    or domain in (
      '心理与成长',
      '社会与历史',
      '经济与管理',
      '哲学与思想',
      '文学与写作',
      '科学与技术',
      '健康与生活',
      '艺术与文化',
      '传记与人物',
      '其他'
    )
  );
