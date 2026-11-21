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
