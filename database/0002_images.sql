-- ================================================================
-- 每日研读 demo · 数据库迁移 0002
-- 段落图片支持：paragraphs.image_path 标记图片段
-- ================================================================

alter table public.paragraphs
  add column if not exists image_path text;

-- image_path 非空表示这是一个图片段（正文中的插图），阅读器据此渲染 <img>
