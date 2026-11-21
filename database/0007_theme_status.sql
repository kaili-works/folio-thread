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
