-- ================================================================
-- 每日研读 demo · 数据库迁移 0004
-- 多级目录：chapters 增加 depth（目录层级，用于侧栏缩进）
-- ================================================================

alter table public.chapters
  add column if not exists depth int not null default 0;
