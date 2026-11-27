-- ================================================================
-- 每日研读 · 数据库迁移 0010
-- reading_daily：每日阅读时长的日聚合表（统计页「实际时长 vs 预算」）
--   1. 粒度：用户 × 日期 × 来源 × 书籍
--   2. source 区分 'read' / 'audio'：听书单独成行，不与阅读合并，
--      预算缺口只按 source='read' 计算
--   3. 增量写入统一走 add_reading_seconds()，单行上限 24 小时
--   4. 日期由调用方按本地时区取当天（与 daily_packs 的 today() 一致）
-- 目标环境：Supabase（PostgreSQL 15+）
-- 执行顺序：0001 → … → 0009 → 0010
-- ================================================================

create table if not exists public.reading_daily (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  date date not null,
  source text not null default 'read' check (source in ('read', 'audio')),
  seconds int not null default 0 check (seconds between 0 and 86400),
  updated_at timestamptz not null default now(),
  unique (user_id, date, source, document_id)
);

alter table public.reading_daily enable row level security;

drop policy if exists "reading_daily_select_own" on public.reading_daily;
create policy "reading_daily_select_own" on public.reading_daily
  for select using (auth.uid() = user_id);
drop policy if exists "reading_daily_insert_own" on public.reading_daily;
create policy "reading_daily_insert_own" on public.reading_daily
  for insert with check (auth.uid() = user_id);
drop policy if exists "reading_daily_update_own" on public.reading_daily;
create policy "reading_daily_update_own" on public.reading_daily
  for update using (auth.uid() = user_id);
drop policy if exists "reading_daily_delete_own" on public.reading_daily;
create policy "reading_daily_delete_own" on public.reading_daily
  for delete using (auth.uid() = user_id);

create index if not exists idx_reading_daily_user_date
  on public.reading_daily(user_id, date);

-- 原子累加：多标签页 / 多设备同时上报时不会互相覆盖。
-- 调用方只报增量（秒），由数据库负责累加与封顶。
create or replace function public.add_reading_seconds(
  p_document_id uuid,
  p_date date,
  p_source text,
  p_seconds int
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if p_document_id is null or p_date is null or p_seconds is null or p_seconds <= 0 then
    return;
  end if;

  insert into public.reading_daily (user_id, document_id, date, source, seconds)
  values (
    auth.uid(),
    p_document_id,
    p_date,
    coalesce(p_source, 'read'),
    least(86400, p_seconds)
  )
  on conflict (user_id, date, source, document_id) do update
    set seconds = least(86400, public.reading_daily.seconds + excluded.seconds),
        updated_at = now();
end;
$$;

-- ================================================================
-- 说明：
-- 1. 若建库时未勾选 Supabase「Grant API access to new tables automatically」，
--    需手动补授权：
--      grant select, insert, update, delete on public.reading_daily to authenticated;
--      grant execute on function public.add_reading_seconds(uuid, date, text, int) to authenticated;
-- 2. 删除书籍会级联删除该书的时长记录；账号删除同样级联清理。
-- 3. 不建阅读事件表（逐条会话明细），日聚合够统计页使用。
-- ================================================================
