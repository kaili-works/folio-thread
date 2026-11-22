-- 推荐理由的语言：记录生成时的界面语言，便于界面语言不一致时提示重写。
-- 历史理由全部由中文提示词生成，回填 zh；之后写入时按请求语言打标。
alter table public.list_items
  add column if not exists lang text;

update public.list_items
  set lang = 'zh'
  where lang is null and reason is not null;
