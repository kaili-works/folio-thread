-- ================================================================
-- 每日研读 demo · 数据库迁移 0005
-- 阅读速度可配置：profiles 增加 reading_speed（字/分钟，默认 300）
-- ================================================================

alter table public.profiles
  add column if not exists reading_speed int not null default 300;
