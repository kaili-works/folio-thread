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
