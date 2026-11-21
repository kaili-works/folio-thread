"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import AppNav from "@/components/AppNav";
import { copy } from "@/lib/copy";
import { DOMAINS } from "@/lib/domains";

type Theme = {
  id: string;
  name: string;
  description: string;
  daily_budget_minutes: number;
  status: string;
  domain: string | null;
};

// 优先在前，搁置在后，其余保持原顺序
function sortThemes(list: Theme[]) {
  const rank = (s: string) =>
    s === "priority" ? 0 : s === "shelved" ? 2 : 1;
  return [...list].sort((a, b) => rank(a.status) - rank(b.status));
}

type ListItem = {
  id: string;
  order_index: number;
  reason: string;
  availability: string;
  status: string;
  locked: boolean;
  document_id: string | null;
  candidate_metadata: {
    title?: string;
    author?: string;
    key_points?: string[];
    weread?: {
      bookId: string;
      readerLink: string;
      progress?: number;
      synced_at?: string;
    };
  } | null;
  documents: { title: string; author: string } | null;
};

// 节点上的状态文案
function itemStateLabel(it: ListItem) {
  if (it.availability === "pending_supplement") return "待补充";
  if (it.status === "completed") return "已读完";
  if (it.status === "in_progress") return "在读";
  if (it.status === "skipped") return "已跳过";
  if (it.status === "shelved") return "已搁置";
  return "未开始";
}

export default function ThemesPage() {
  const supabase = createClient();

  const [themes, setThemes] = useState<Theme[]>([]);
  const [themesLoaded, setThemesLoaded] = useState(false);
  const [activeTheme, setActiveTheme] = useState<Theme | null>(null);
  const [items, setItems] = useState<ListItem[]>([]);
  const [listId, setListId] = useState<string | null>(null);
  const [listStatus, setListStatus] = useState<string>("draft");
  const [generating, setGenerating] = useState(false);
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const listSectionRef = useRef<HTMLElement | null>(null);
  const [message, setMessage] = useState("");
  // 清单里展开推荐理由的条目
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // 防误操作：换一本 / 删除在条目前原地二次确认
  const [confirmAction, setConfirmAction] = useState<{
    kind: "replace" | "delete";
    itemId: string;
  } | null>(null);
  // 清单视图：路径（默认）/ 列表
  const [view, setView] = useState<"path" | "list">("list");
  // 每本书的章节级进度，按 document_id 索引
  const [bookProgress, setBookProgress] = useState<
    Record<string, { done: number; total: number; current: number }>
  >({});
  const [genPoints, setGenPoints] = useState(false);
  const [wereadBusy, setWereadBusy] = useState(false);
  const syncGuard = useRef(false);
  // 每个清单只自动补一次知识点，避免失败后反复请求
  const autoPointsRef = useRef<Set<string>>(new Set());

  // 一句话重新生成
  const [regenHint, setRegenHint] = useState("");
  const [regenning, setRegenning] = useState(false);
  const [regenPreview, setRegenPreview] = useState<{
    list_id: string;
    removed: any[];
    proposed: { title: string; author: string; reason: string; availability: string }[];
    source: string;
  } | null>(null);
  const [regenMessage, setRegenMessage] = useState("");
  const [undoInfo, setUndoInfo] = useState<{
    restore_ids: string[];
    delete_ids: string[];
  } | null>(null);

  // 创建主题表单
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  // 当前主题的每日预算（可编辑）
  const [themeBudget, setThemeBudget] = useState("30");
  // 新建主题表单是否展开
  const [creating, setCreating] = useState(false);
  // 主题管理操作是否展开（领域 / 优先 / 搁置 / 删除）
  const [manageOpen, setManageOpen] = useState(false);
  // 移动端：主题合并入口的底部抽屉
  const [pickerOpen, setPickerOpen] = useState(false);

  async function loadThemes() {
    const { data } = await supabase
      .from("themes")
      .select("*")
      .order("created_at", { ascending: false });
    const list = sortThemes((data as Theme[]) ?? []);
    setThemes(list);
    setThemesLoaded(true);
    // 默认选中第一个主题，便于直接看到清单
    if (list.length > 0 && !activeTheme) {
      selectTheme(list[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }

  async function syncWeread(listIdValue: string, themeId: string) {
    if (syncGuard.current) return;
    syncGuard.current = true;
    try {
      const res = await fetch("/api/weread/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ list_id: listIdValue }),
      });
      if (res.ok) {
        const json = await res.json().catch(() => ({}));
        if (json.changed > 0) await loadList(themeId);
      }
    } catch {
      // 同步失败不影响清单展示，下次进入再试
    } finally {
      syncGuard.current = false;
    }
  }

  async function loadList(themeId: string) {
    setListLoading(true);
    const { data: lists } = await supabase
      .from("reading_lists")
      .select("*")
      .eq("theme_id", themeId)
      .order("created_at", { ascending: false })
      .limit(1);
    const list = lists?.[0];
    if (!list) {
      setListId(null);
      setListStatus("draft");
      setItems([]);
      setBookProgress({});
      setListLoading(false);
      return;
    }
    setListId(list.id);
    setListStatus(list.status);
    // list_items 与 documents 互不依赖，并行请求；documents 受 RLS 限制只返回本人书库。
    const [{ data: its }, { data: docs }] = await Promise.all([
      supabase
        .from("list_items")
        .select(
          "id, order_index, reason, availability, status, locked, document_id, candidate_metadata",
        )
        .eq("reading_list_id", list.id)
        .is("deleted_at", null)
        .order("order_index"),
      supabase.from("documents").select("id, title, author"),
    ]);

    const docMap = new Map((docs ?? []).map((d: any) => [d.id, d]));
    const mapped = (its ?? []).map((it: any) => {
      const d = it.document_id ? docMap.get(it.document_id) : null;
      return {
        ...it,
        documents: d ? { title: d.title, author: d.author } : null,
      };
    });
    setItems(mapped as ListItem[]);
    setListLoading(false);

    // 每本书的章节级进度：路径视图显示「第几章 / 百分比」
    const docIds = Array.from(
      new Set(
        (its ?? [])
          .map((it: any) => it.document_id)
          .filter((v: string | null): v is string => Boolean(v)),
      ),
    );
    if (docIds.length === 0) {
      setBookProgress({});
      await syncWeread(list.id, themeId);
      return;
    }
    const [{ data: chapterRows }, { data: progRows }] = await Promise.all([
      supabase
        .from("chapters")
        .select("id, document_id, order_index")
        .in("document_id", docIds)
        .order("order_index"),
      supabase
        .from("reading_progress")
        .select("chapter_id, document_id, status")
        .in("document_id", docIds)
        .eq("status", "completed"),
    ]);
    const doneSet = new Set((progRows ?? []).map((p: any) => p.chapter_id));
    const next: Record<string, { done: number; total: number; current: number }> =
      {};
    for (const docId of docIds) {
      const chapters = (chapterRows ?? [])
        .filter((c: any) => c.document_id === docId)
        .sort((a: any, b: any) => a.order_index - b.order_index);
      if (chapters.length === 0) continue;
      const done = chapters.filter((c: any) => doneSet.has(c.id)).length;
      const firstOpen = chapters.findIndex((c: any) => !doneSet.has(c.id));
      next[docId] = {
        done,
        total: chapters.length,
        current: firstOpen >= 0 ? firstOpen + 1 : chapters.length,
      };
    }
    setBookProgress(next);
    await syncWeread(list.id, themeId);
  }

  useEffect(() => {
    loadThemes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectTheme(t: Theme) {
    setActiveTheme(t);
    setThemeBudget(String(t.daily_budget_minutes ?? 30));
    setMessage("");
    loadList(t.id);
  }

  async function saveThemeBudget() {
    if (!activeTheme) return;
    const minutes = Number(themeBudget);
    if (!Number.isFinite(minutes) || minutes < 5 || minutes > 180) {
      setMessage(copy.themes.budgetInvalid);
      return;
    }
    const res = await fetch(`/api/themes/${activeTheme.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ daily_budget_minutes: Math.round(minutes) }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok) {
      setActiveTheme(json.theme);
      setThemes((prev) =>
        prev.map((t) => (t.id === json.theme.id ? json.theme : t)),
      );
      setMessage(copy.themes.budgetSaved);
    } else {
      setMessage(copy.themes.budgetSaveFailed(json.error ?? res.status));
    }
  }

  async function patchThemeDomain(t: Theme, domain: string) {
    const res = await fetch(`/api/themes/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain: domain || null }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(json.error ?? "领域保存失败");
      return;
    }
    const updated = json.theme as Theme;
    setThemes((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    setActiveTheme((prev) => (prev?.id === updated.id ? updated : prev));
    setMessage(`领域已更新为「${updated.domain ?? "未归类"}」`);
  }

  async function patchThemeStatus(t: Theme, status: string) {
    const res = await fetch(`/api/themes/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(copy.themes.itemUpdateFailed(json.error ?? res.status));
      return;
    }
    const updated = json.theme as Theme;
    setThemes((prev) =>
      sortThemes(prev.map((x) => (x.id === updated.id ? updated : x))),
    );
    setActiveTheme((prev) => (prev?.id === updated.id ? updated : prev));
    setMessage(copy.themes.statusUpdated(status));
  }

  async function deleteTheme(t: Theme) {
    if (!confirm(copy.themes.deleteConfirm(t.name))) {
      return;
    }
    const res = await fetch(`/api/themes/${t.id}`, { method: "DELETE" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(copy.themes.deleteFailed(json.error ?? res.status));
      return;
    }
    setThemes((prev) => prev.filter((x) => x.id !== t.id));
    if (activeTheme?.id === t.id) {
      setActiveTheme(null);
      setItems([]);
      setListId(null);
      setListStatus("");
    }
    setMessage(copy.themes.deleted(t.name));
  }

  async function createTheme(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    const res = await fetch("/api/themes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        description,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok) {
      setName("");
      setDescription("");
      setMessage("");
      selectTheme(json.theme);
      loadThemes();
      // 新建后直接把视线带到「生成清单」，避免以为建完就结束了
      window.setTimeout(() => {
        listSectionRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 150);
    } else {
      setMessage(copy.themes.createFailed(json.error ?? res.status));
    }
  }

  async function generateList() {
    if (!activeTheme) return;
    setGenerating(true);
    setMessage("");
    const res = await fetch("/api/lists/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme_id: activeTheme.id }),
    });
    const json = await res.json().catch(() => ({}));
    setGenerating(false);
    if (res.ok) {
      setItems(json.items ?? []);
      setListId(json.list?.id ?? null);
      setListStatus(json.list?.status ?? "draft");
      setMessage(
        copy.themes.listGenerated(
          json.source === "rule_fallback",
          json.hint,
        ),
      );
      // 路径要显示知识点，生成清单后顺手在后台提炼
      if (json.list?.id) void generateKeyPoints(json.list.id, true);
    } else {
      setMessage(copy.themes.listGenerateFailed(json.error ?? res.status));
    }
  }

  async function refreshList() {
    if (!activeTheme) return;
    setMessage("");
    const res = await fetch("/api/lists/refresh", { method: "POST" });
    const json = await res.json().catch(() => ({}));
    if (res.ok) {
      setMessage(copy.themes.refreshed(json.matched?.length ?? 0));
      loadList(activeTheme.id);
    } else {
      setMessage(copy.themes.refreshFailed(json.error ?? res.status));
    }
  }

  async function regenerate() {
    if (!activeTheme) return;
    setRegenning(true);
    setRegenMessage("");
    setRegenPreview(null);
    setUndoInfo(null);
    const res = await fetch("/api/lists/regenerate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme_id: activeTheme.id, hint: regenHint }),
    });
    const json = await res.json().catch(() => ({}));
    setRegenning(false);
    if (res.ok && json.proposed) {
      setRegenPreview({
        list_id: json.list_id,
        removed: json.removed ?? [],
        proposed: json.proposed ?? [],
        source: json.source,
      });
      if (json.message) setRegenMessage(json.message);
    } else {
      setRegenMessage(copy.themes.regenFailed(json.error ?? res.status));
    }
  }

  async function applyRegenerate() {
    if (!regenPreview) return;
    setRegenMessage("");
    const res = await fetch("/api/lists/regenerate", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        list_id: regenPreview.list_id,
        new_items: regenPreview.proposed,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok) {
      setUndoInfo({
        restore_ids: json.removed_ids ?? regenPreview.removed.map((i) => i.id),
        delete_ids: json.inserted_ids ?? [],
      });
      setRegenPreview(null);
      if (activeTheme) await loadList(activeTheme.id);
      // 新替换进来的书还没有知识点，后台补一下
      void generateKeyPoints(undefined, true);
      setRegenMessage(copy.themes.regenApplied);
    } else {
      setRegenMessage(copy.themes.regenApplyFailed(json.error ?? res.status));
    }
  }

  function cancelRegenerate() {
    setRegenPreview(null);
    setRegenMessage("");
  }

  async function undoRegenerate() {
    if (!listId || !undoInfo) return;
    setRegenMessage("");
    const res = await fetch("/api/lists/regenerate", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        list_id: listId,
        undo: true,
        restore_ids: undoInfo.restore_ids,
        delete_ids: undoInfo.delete_ids,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok) {
      setUndoInfo(null);
      if (activeTheme) await loadList(activeTheme.id);
      setRegenMessage(copy.themes.regenUndone);
    } else {
      setRegenMessage(copy.themes.regenUndoFailed(json.error ?? res.status));
    }
  }

  // 对「待补充」的书查一次微信读书，命中后写入阅读链接
  async function enrichWeread() {
    if (!listId) return;
    setWereadBusy(true);
    setMessage("正在查询微信读书…");
    const res = await fetch("/api/lists/weread-enrich", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ list_id: listId }),
    });
    const json = await res.json().catch(() => ({}));
    setWereadBusy(false);
    if (res.ok) {
      if (activeTheme) await loadList(activeTheme.id);
      if (json.updated > 0) {
        setMessage(`已在微信读书找到 ${json.updated} 本可读版本`);
      } else if (json.checked === 0) {
        setMessage("没有需要查询的书");
      } else {
        setMessage("这些书在微信读书暂未找到");
      }
    } else {
      setMessage(json.error ?? "微信读书查询失败");
    }
  }

  // 按章节标题提炼每本书的知识点标签
  async function generateKeyPoints(targetListId?: string, quiet = false) {
    const id = targetListId ?? listId;
    if (!id) return;
    setGenPoints(true);
    if (!quiet) setMessage(copy.themes.keyPointsRunning);
    const res = await fetch("/api/lists/keypoints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ list_id: id }),
    });
    const json = await res.json().catch(() => ({}));
    setGenPoints(false);
    if (res.ok) {
      if (activeTheme) await loadList(activeTheme.id);
      if (!quiet) setMessage(copy.themes.keyPointsDone(json.updated ?? 0));
    } else if (!quiet) {
      setMessage(copy.themes.keyPointsFailed(json.error ?? res.status));
    }
  }

  async function confirmList() {
    if (!listId) return;
    setMessage("");
    const { error } = await supabase
      .from("reading_lists")
      .update({ status: "active" })
      .eq("id", listId);
    if (error) {
      setMessage(copy.themes.confirmFailed(error.message));
      return;
    }
    setListStatus("active");
    setMessage(copy.themes.confirmed);
    void generateKeyPoints();
  }

  async function moveItem(itemId: string, dir: "up" | "down") {
    const idx = items.findIndex((i) => i.id === itemId);
    if (idx < 0) return;
    const swapIdx = dir === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= items.length) return;
    const a = items[idx];
    const b = items[swapIdx];
    await supabase.from("list_items").update({ order_index: b.order_index }).eq("id", a.id);
    await supabase.from("list_items").update({ order_index: a.order_index }).eq("id", b.id);
    if (activeTheme) loadList(activeTheme.id);
  }

  async function replaceItem(itemId: string) {
    if (replacingId) return;
    setReplacingId(itemId);
    setMessage("");
    const res = await fetch("/api/lists/replace-item", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_id: itemId }),
    });
    const json = await res.json().catch(() => ({}));
    setReplacingId(null);
    if (res.ok) {
      if (activeTheme) await loadList(activeTheme.id);
      setMessage(copy.themes.replaced(json.title ?? ""));
    } else {
      setMessage(copy.themes.replaceFailed(json.error ?? res.status));
    }
  }

  async function deleteItem(itemId: string) {
    await supabase
      .from("list_items")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", itemId);
    if (activeTheme) loadList(activeTheme.id);
  }

  async function toggleLock(itemId: string) {
    const it = items.find((i) => i.id === itemId);
    if (!it) return;
    await supabase
      .from("list_items")
      .update({ locked: !it.locked })
      .eq("id", itemId);
    if (activeTheme) loadList(activeTheme.id);
  }

  async function setItemStatus(itemId: string, status: string) {
    await supabase
      .from("list_items")
      .update({ status })
      .eq("id", itemId);
    if (activeTheme) loadList(activeTheme.id);
  }

  const trackedItems = items.filter(
    (it) => it.status !== "skipped" && it.status !== "shelved",
  );
  const completedCount = trackedItems.filter(
    (it) => it.status === "completed",
  ).length;
  const trackedTotal = trackedItems.length;
  const listPct =
    trackedTotal > 0 ? Math.round((completedCount / trackedTotal) * 100) : 0;
  const listFinished = trackedTotal > 0 && completedCount >= trackedTotal;

  // 路径上的「当前节点」：优先在读，其次第一本未开始
  const nowItemId =
    trackedItems.find((it) => it.status === "in_progress")?.id ??
    trackedItems.find((it) => it.status === "unread")?.id ??
    null;
  // 有书缺知识点时，给一个手动补生成的入口
  const hasMissingPoints = trackedItems.some(
    (it) => !it.candidate_metadata?.key_points?.length,
  );

  // 路径直接显示知识点：清单缺标签时自动在后台补一次
  useEffect(() => {
    if (!listId || items.length === 0) return;
    if (autoPointsRef.current.has(listId)) return;
    if (!items.some((it) => !it.candidate_metadata?.key_points?.length)) return;
    autoPointsRef.current.add(listId);
    void generateKeyPoints(listId, true);
    // 只在清单或条目变化时触发，generateKeyPoints 不参与依赖
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listId, items]);

  // 抽屉打开时按 Esc 关闭
  useEffect(() => {
    if (!pickerOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPickerOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pickerOpen]);

  // 领域 / 优先 / 搁置 / 删除：主题轨与移动端抽屉共用
  function renderThemeActions(t: Theme) {
    return (
      <div className="acts">
        <select
          className="domain-select"
          value={t.domain ?? ""}
          onChange={(e) => patchThemeDomain(t, e.target.value)}
          aria-label="阅读领域"
          title="阅读领域：统计页按领域分篮子"
        >
          <option value="">未归类</option>
          {DOMAINS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <button
          className="btn-quiet btn-xs"
          onClick={() =>
            patchThemeStatus(
              t,
              t.status === "priority" ? "active" : "priority",
            )
          }
        >
          {t.status === "priority" ? "取消优先" : "优先"}
        </button>
        <button
          className="btn-quiet btn-xs"
          onClick={() =>
            patchThemeStatus(t, t.status === "shelved" ? "active" : "shelved")
          }
        >
          {t.status === "shelved" ? "恢复" : "搁置"}
        </button>
        <button className="btn-danger btn-xs" onClick={() => deleteTheme(t)}>
          删除
        </button>
      </div>
    );
  }

  return (
    <>
      <AppNav />
      <div className="container app-main">
        <div className="page-head">
          <span className="kicker">Themes &amp; Lists</span>
          <h1>主题与阅读清单</h1>
        </div>

        {/* 新建主题：与清单等宽的扁框入口 */}
        <button
          type="button"
          className={`theme-new-bar${creating ? " open" : ""}`}
          onClick={() => setCreating((v) => !v)}
          aria-expanded={creating}
        >
          <span className="theme-new-bar-label">＋ 新建研究主题</span>
          <span className="theme-new-bar-hint">
            {creating ? "收起表单" : "用一句话描述你感兴趣的问题"}
          </span>
        </button>

        {/* 创建主题 */}
        {creating && (
          <form className="theme-create" onSubmit={createTheme}>
            <div className="theme-create-grid">
              <label className="theme-create-field">
                <span>主题名称</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例如：城市社会学"
                  required
                />
              </label>
              <label className="theme-create-field">
                <span>用自然语言描述你感兴趣的主题</span>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="例如：零基础入门，想理解城市如何运转、人们如何在其中生活"
                />
              </label>
            </div>
            <p className="theme-create-help">{copy.themes.createHelp}</p>
            <div className="theme-create-acts">
              <button type="submit" className="btn-sm">
                创建主题
              </button>
              <button
                type="button"
                className="btn-ghost btn-sm"
                onClick={() => setCreating(false)}
              >
                取消
              </button>
            </div>
          </form>
        )}

        {message && (
          <p className="muted" style={{ margin: "10px 0 0" }}>
            {message}
          </p>
        )}

        {/* 移动端：把「我的主题」收成一行入口，点开用底部抽屉选择 */}
        {themesLoaded && themes.length > 0 && (
          <>
            <button
              type="button"
              className="theme-select-bar"
              onClick={() => setPickerOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={pickerOpen}
            >
              <span className="ls">
                <span className="kicker">我的主题 · {themes.length}</span>
                <span className="name">{activeTheme?.name ?? "选择主题"}</span>
                {activeTheme && (
                  <span className="budget">
                    每天 {activeTheme.daily_budget_minutes} 分钟
                    {activeTheme.status === "priority" ? " · 优先" : ""}
                    {activeTheme.status === "shelved" ? " · 搁置" : ""}
                  </span>
                )}
              </span>
              <span className="chev" aria-hidden="true">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 10 10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M2 4 L5 7 L8 4" />
                </svg>
              </span>
            </button>
            {activeTheme && trackedTotal > 0 && (
              <span className="theme-select-track" aria-hidden="true">
                <i style={{ width: `${listPct}%` }} />
              </span>
            )}

            {pickerOpen && (
              <div
                className="theme-picker"
                role="dialog"
                aria-modal="true"
                aria-label="选择主题"
                onClick={() => setPickerOpen(false)}
              >
                <div
                  className="theme-sheet"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="theme-sheet-grab" aria-hidden="true" />
                  <div className="theme-sheet-head">
                    <b>我的主题</b>
                    {activeTheme ? (
                      <button
                        type="button"
                        className="rail-manage"
                        onClick={() => setManageOpen((v) => !v)}
                      >
                        {manageOpen ? "收起管理" : "管理"}
                      </button>
                    ) : (
                      <span>{themes.length} 个 · 点击切换</span>
                    )}
                  </div>
                  {themes.map((t) => {
                    const isActive = activeTheme?.id === t.id;
                    return (
                      <div
                        key={t.id}
                        className={`picker-item${isActive ? " on" : ""}${
                          t.status === "shelved" ? " shelved" : ""
                        }`}
                      >
                        <button
                          type="button"
                          className="picker-main"
                          onClick={() => {
                            selectTheme(t);
                            setPickerOpen(false);
                          }}
                        >
                          <span className="txt">
                            <span className="nm">
                              {t.name}
                              {t.status === "priority" && (
                                <span className="chip solid">优先</span>
                              )}
                              {t.status === "shelved" && (
                                <span className="chip">搁置</span>
                              )}
                            </span>
                            <span className="sub">
                              每天 {t.daily_budget_minutes} 分钟
                              {isActive && trackedTotal > 0
                                ? ` · 进度 ${listPct}%`
                                : ""}
                            </span>
                          </span>
                          <span className="check" aria-hidden="true">
                            {isActive ? "✓" : ""}
                          </span>
                        </button>
                        {isActive && manageOpen && renderThemeActions(t)}
                      </div>
                    );
                  })}
                  <div className="theme-sheet-foot">
                    <span>点空白处或按 Esc 关闭，不改变当前主题</span>
                    <button
                      type="button"
                      className="btn-quiet btn-xs"
                      onClick={() => setPickerOpen(false)}
                    >
                      关闭
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* 左：主题轨；右：当前清单 */}
        {!themesLoaded && <div className="page-loading">正在读取主题…</div>}
        {themesLoaded && themes.length === 0 && (
          <div className="theme-empty">
            <span className="kicker">暂无主题</span>
            <h2>先写下一句想研究的问题</h2>
            <p>
              例如「零基础入门，想理解城市如何运转」。AI 会给出 5–6
              本有序书单，之后每天按预算读一点，笔记与进度会留在这里。
            </p>
          </div>
        )}
        <div
          className="themes-grid"
          style={{
            display: !themesLoaded || themes.length === 0 ? "none" : undefined,
          }}
        >
          <aside className="theme-rail">
            <div className="rail-head">
              <span className="kicker">我的主题 · {themes.length}</span>
              {activeTheme && (
                <button
                  type="button"
                  className="rail-manage"
                  onClick={() => setManageOpen((v) => !v)}
                >
                  {manageOpen ? "收起" : "管理"}
                </button>
              )}
            </div>
            {themes.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>
                {copy.themes.emptyThemes}
              </p>
            ) : (
              themes.map((t) => {
                const isActive = activeTheme?.id === t.id;
                return (
                  <div
                    key={t.id}
                    className={`rail-item${isActive ? " active" : ""}`}
                    style={{ opacity: t.status === "shelved" ? 0.62 : 1 }}
                  >
                    <button className="pick" onClick={() => selectTheme(t)}>
                      <span className="t">
                        {t.name}
                        {t.status === "priority" && (
                          <span className="chip solid">优先</span>
                        )}
                        {t.status === "shelved" && (
                          <span className="chip">搁置</span>
                        )}
                      </span>
                      <span className="meta">
                        每天 {t.daily_budget_minutes} 分钟
                      </span>
                      {isActive && trackedTotal > 0 && (
                        <span className="rail-track">
                          <i style={{ width: `${listPct}%` }} />
                        </span>
                      )}
                    </button>
                    {isActive && manageOpen && renderThemeActions(t)}
                  </div>
                );
              })
            )}
            <p className="rail-help">
              用页面上方的扁框新建主题。{copy.themes.statusHelp}
            </p>
          </aside>

      {/* 选中主题的清单 */}
      {activeTheme && (
        <section className="theme-card" ref={listSectionRef}>
          <div className="theme-head">
            <div style={{ minWidth: 0 }}>
              <span className="kicker">当前清单</span>
              <h1 style={{ marginTop: 6 }}>{activeTheme.name}</h1>
              {activeTheme.description && (
                <p className="sub" style={{ margin: "6px 0 0" }}>
                  {activeTheme.description}
                </p>
              )}
            </div>
            <div className="acts">
              <span
                className={`chip ${listStatus === "active" ? "solid" : ""}`}
              >
                {listStatus === "active" ? "已确认" : "草稿"}
              </span>
              {listStatus !== "active" && items.length > 0 && (
                <button className="btn-sm" onClick={confirmList}>
                  确认清单
                </button>
              )}
              <button className="btn-ghost btn-sm" onClick={refreshList}>
                刷新
              </button>
            </div>
          </div>

          <div className="theme-stats">
            <div className="stat">
              <div className="k">清单</div>
              <div className="v">{items.length} 本</div>
            </div>
            <div className="stat">
              <div className="k">已读</div>
              <div className="v">{completedCount}</div>
            </div>
            <div className="stat">
              <div className="k">进度</div>
              <div className="v">{listPct}%</div>
            </div>
            <div className="stat stat-budget">
              <div className="k">每日预算</div>
              <div
                className="v"
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                <input
                  type="number"
                  value={themeBudget}
                  onChange={(e) => setThemeBudget(e.target.value)}
                  min={5}
                  max={180}
                />
                <span
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: 11,
                    fontWeight: 400,
                    color: "#6b7280",
                  }}
                >
                  分钟
                </span>
                <button className="btn-quiet btn-xs" onClick={saveThemeBudget}>
                  保存
                </button>
              </div>
            </div>
          </div>

          {!listLoading && items.length === 0 && (
            <div className="list-empty">
              <p className="muted" style={{ margin: 0 }}>
                {copy.themes.emptyList}
              </p>
              <button
                className="btn-sm"
                onClick={generateList}
                disabled={generating}
              >
                {generating ? "推荐中…" : "让 AI 推荐书单"}
              </button>
            </div>
          )}

          {!listLoading &&
            items.length > 0 &&
            !items.some(
              (it) =>
                it.availability === "readable" ||
                Boolean(it.candidate_metadata?.weread?.bookId),
            ) && (
            <div className="list-empty">
              <p className="muted" style={{ margin: 0 }}>
                {copy.themes.listNoBooks}
              </p>
              <Link href="/library" className="btn-sm">
                去书库上传
              </Link>
            </div>
          )}

          {items.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div className="progress">
                <span
                  className={`progress-fill${listFinished ? " done" : ""}`}
                  style={{ width: `${listPct}%` }}
                />
              </div>
              <div className="progress-meta">
                <span>阅读进度</span>
                <span>
                  {completedCount}/{trackedTotal} 项 · {listPct}%
                  {items.length !== trackedTotal
                    ? `（另有 ${items.length - trackedTotal} 项已跳过/搁置）`
                    : ""}
                </span>
              </div>
            </div>
          )}

          {listFinished && (
            <div className="completion-banner" style={{ marginTop: 16 }}>
              {copy.themes.completionBanner(activeTheme.name)}
              <span className="sub">
                {copy.themes.completionSub(completedCount)}
              </span>
            </div>
          )}

          <details className="plain">
            <summary>清单操作说明</summary>
            <ul>
              <li><strong>上移 / 下移</strong>：调整这本书在清单里的阅读顺序。</li>
              <li><strong>换一本</strong>：让 AI 为这个位置重新推荐一本，会参考前后书目衔接，且不与清单里已有的书重复。</li>
              <li><strong>锁定</strong>：固定这一项，AI 重新生成或重排时不会移动、替换它。</li>
              <li><strong>搁置</strong>：先放到一边，稍后再读（之后可「恢复」）。</li>
              <li><strong>待补充</strong>：这本书还不在你的书库，上传 EPUB 后点「刷新」即可转为可读。</li>
              <li><strong>删除</strong>：把这一项从清单里移除。</li>
            </ul>
          </details>

          {/* 一句话重新生成 */}
          {items.length > 0 && (
            <details className="plain">
              <summary>用一句话调整清单</summary>
              <div style={{ marginTop: 14 }}>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                    alignItems: "center",
                  }}
                >
                  <input
                    type="text"
                    value={regenHint}
                    onChange={(e) => setRegenHint(e.target.value)}
                    placeholder="一句话提示，如：更偏理论 / 降低难度 / 多推荐实践类"
                    style={{ flex: "1 1 240px", minWidth: 0, margin: 0 }}
                  />
                  <button
                    className="btn-sm"
                    onClick={regenerate}
                    disabled={regenning}
                  >
                    {regenning ? "生成中…" : "重新生成"}
                  </button>
                </div>

                {regenMessage && (
                  <p className="muted" style={{ margin: "8px 0 0" }}>
                    {regenMessage}
                  </p>
                )}

                {regenPreview && (
                  <div
                    style={{
                      marginTop: 12,
                      borderTop: "1px solid #e5e7eb",
                      paddingTop: 12,
                    }}
                  >
                    <p className="muted" style={{ margin: "0 0 6px" }}>
                      {copy.themes.regenPreview(
                        items.length - regenPreview.removed.length,
                        regenPreview.removed.length,
                      )}
                    </p>
                    <div
                      className="muted"
                      style={{ fontSize: 12, lineHeight: 1.8 }}
                    >
                      {regenPreview.proposed.map((p, i) => (
                        <div
                          key={i}
                          style={{
                            padding: "6px 0",
                            borderBottom: "1px solid #f0f0f0",
                          }}
                        >
                          《{p.title}》{p.author ? ` · ${p.author}` : ""}
                          {p.availability === "readable" ? "" : "（待补充）"}
                          —— {p.reason}
                        </div>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                      <button className="btn-sm" onClick={applyRegenerate}>
                        应用
                      </button>
                      <button
                        className="btn-ghost btn-sm"
                        onClick={cancelRegenerate}
                      >
                        放弃
                      </button>
                    </div>
                  </div>
                )}

                {undoInfo && !regenPreview && (
                  <div style={{ marginTop: 10 }}>
                    <button
                      className="btn-ghost btn-sm"
                      onClick={undoRegenerate}
                    >
                      撤销上次重新生成
                    </button>
                  </div>
                )}
              </div>
            </details>
          )}

          {items.length > 0 && (
            <div className="view-bar">
              <span className="kicker">
                {view === "path" ? "Reading Path" : "Reading List"}
              </span>
              {items.some(
                (it) =>
                  it.availability === "pending_supplement" &&
                  !it.candidate_metadata?.weread,
              ) && (
                <button
                  className="btn-ghost btn-xs"
                  onClick={() => enrichWeread()}
                  disabled={wereadBusy}
                >
                  {wereadBusy ? "查询中…" : "查微信读书"}
                </button>
              )}
              {hasMissingPoints && (
                <button
                  className="btn-ghost btn-xs"
                  onClick={() => generateKeyPoints()}
                  disabled={genPoints}
                >
                  {genPoints ? "生成中…" : "生成知识点"}
                </button>
              )}
              <div className="view-switch" role="group" aria-label="清单视图">
                <button
                  type="button"
                  className={view === "path" ? "on" : ""}
                  aria-pressed={view === "path"}
                  onClick={() => setView("path")}
                >
                  路径
                </button>
                <button
                  type="button"
                  className={view === "list" ? "on" : ""}
                  aria-pressed={view === "list"}
                  onClick={() => setView("list")}
                >
                  列表
                </button>
              </div>
            </div>
          )}

          {/* 路径视图：书脊串起清单；草稿看推荐理由，确认后看知识点 */}
          {items.length > 0 && view === "path" && (
            <div className="path">
              {items.map((it, idx) => {
                const isPending = it.availability === "pending_supplement";
                const title =
                  it.documents?.title ??
                  it.candidate_metadata?.title ??
                  "未知书名";
                const author =
                  it.documents?.author ?? it.candidate_metadata?.author ?? "";
                const weread = it.candidate_metadata?.weread;
                const keyPoints = it.candidate_metadata?.key_points ?? [];
                const progress = it.document_id
                  ? bookProgress[it.document_id]
                  : null;
                const pct = progress
                  ? Math.round((progress.done / progress.total) * 100)
                  : 0;
                const state =
                  it.status === "completed"
                    ? "done"
                    : it.status === "skipped" || it.status === "shelved"
                      ? "muted"
                      : it.id === nowItemId
                        ? "now"
                        : "";
                return (
                  <div
                    className={`path-node${state ? ` ${state}` : ""}${
                      isPending ? " pending" : ""
                    }`}
                    key={it.id}
                  >
                    <div className="path-head">
                      <span className="path-idx">
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                      <h3 className="path-title">
                        {it.document_id && !isPending ? (
                          <Link href={`/books/${it.document_id}`}>{title}</Link>
                        ) : (
                          title
                        )}
                      </h3>
                    </div>
                    <p className="path-meta">
                      {[
                        author || (isPending ? "书库中暂无此书" : ""),
                        itemStateLabel(it),
                        it.locked ? "已锁定" : "",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                      {!isPending && it.document_id && (
                        <span className="chip ok">已上传</span>
                      )}
                    </p>
                    <div className="path-chips">
                      {keyPoints.length > 0 ? (
                        keyPoints.map((p) => (
                          <span className="chip" key={p}>
                            {p}
                          </span>
                        ))
                      ) : (
                        <span className="chip dash">知识点待生成</span>
                      )}
                    </div>
                    {progress && progress.total > 0 && (
                      <div className="path-prog">
                        <span className="track">
                          <span className="bar" style={{ width: `${pct}%` }} />
                        </span>
                        <span className="label">
                          第 {progress.current}/{progress.total} 章 · {pct}%
                        </span>
                      </div>
                    )}
                    <div className="path-actions">
                      {isPending && weread ? (
                        <>
                          <a
                            className="link-btn"
                            href={weread.readerLink}
                            target="_blank"
                            rel="noreferrer"
                          >
                            去微信读书阅读 →
                          </a>
                          <Link className="link-btn" href="/library">
                            去上传 →
                          </Link>
                        </>
                      ) : isPending ? (
                        <Link className="link-btn" href="/library">
                          去上传 →
                        </Link>
                      ) : it.document_id ? (
                        <Link
                          className="link-btn"
                          href={`/books/${it.document_id}`}
                        >
                          {it.status === "completed"
                            ? "再看一遍"
                            : it.status === "in_progress"
                              ? "继续阅读"
                              : "开始阅读"}{" "}
                          →
                        </Link>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {items.length > 0 && view === "list" && (
            <div className="list">
              {items.map((it, idx) => {
                const isPending = it.availability === "pending_supplement";
                const title =
                  it.documents?.title ??
                  it.candidate_metadata?.title ??
                  "未知书名";
                const author =
                  it.documents?.author ?? it.candidate_metadata?.author ?? "";
                return (
                  <div
                    className={`list-item${
                      it.status === "skipped" || it.status === "shelved"
                        ? " muted"
                        : ""
                    }`}
                    key={it.id}
                  >
                    <div className="idx">
                      {String(idx + 1).padStart(2, "0")}
                    </div>
                    <div className="mid">
                      <p className="t">
                        {it.document_id && !isPending ? (
                          <Link href={`/books/${it.document_id}`}>{title}</Link>
                        ) : (
                          title
                        )}
                      </p>
                      {(author || isPending) && (
                        <p className="a">{author || "书库中暂无此书"}</p>
                      )}
                      {it.reason && (
                        <p
                          className={`r${expandedId === it.id ? "" : " clamp"}`}
                          onClick={() =>
                            setExpandedId(
                              expandedId === it.id ? null : it.id,
                            )
                          }
                        >
                          {it.reason}
                        </p>
                      )}
                      <div className="manage">
                        <button
                          className="btn-ghost btn-xs"
                          onClick={() => moveItem(it.id, "up")}
                          disabled={idx === 0}
                        >
                          ↑ 上移
                        </button>
                        <button
                          className="btn-ghost btn-xs"
                          onClick={() => moveItem(it.id, "down")}
                          disabled={idx === items.length - 1}
                        >
                          ↓ 下移
                        </button>
                        <button
                          className="btn-ghost btn-xs"
                          onClick={() =>
                            setConfirmAction({ kind: "replace", itemId: it.id })
                          }
                          disabled={replacingId !== null}
                          title="让 AI 为这个位置重新推荐一本，与前后书目衔接"
                        >
                          {replacingId === it.id ? "换书中…" : "换一本"}
                        </button>
                        <button
                          className="btn-ghost btn-xs"
                          onClick={() => toggleLock(it.id)}
                          title={
                            it.locked
                              ? "解除锁定"
                              : "锁定：AI 重排/替换时不动这一项"
                          }
                        >
                          {it.locked ? "解锁" : "锁定"}
                        </button>
                        {it.status === "skipped" ||
                        it.status === "shelved" ? (
                          <button
                            className="btn-ghost btn-xs"
                            onClick={() => setItemStatus(it.id, "unread")}
                          >
                            恢复
                          </button>
                        ) : (
                          <button
                            className="btn-ghost btn-xs"
                            onClick={() => setItemStatus(it.id, "shelved")}
                            title="搁置：先放一边，稍后再读（可恢复）"
                          >
                            搁置
                          </button>
                        )}
                        <button
                          className="btn-danger btn-xs"
                          onClick={() =>
                            setConfirmAction({ kind: "delete", itemId: it.id })
                          }
                        >
                          删除
                        </button>
                      </div>
                      {confirmAction?.itemId === it.id && (
                        <div className="confirm-inline" role="alertdialog">
                          <span className="confirm-inline-text">
                            {confirmAction.kind === "replace"
                              ? `换一本会把《${title}》换成 AI 重新推荐的一本。`
                              : `确定从清单中删除《${title}》吗？删除后不可在这里恢复。`}
                          </span>
                          <span className="confirm-inline-actions">
                            <button
                              className="btn-ghost btn-xs"
                              onClick={() => setConfirmAction(null)}
                            >
                              取消
                            </button>
                            <button
                              className={
                                confirmAction.kind === "delete"
                                  ? "btn-danger btn-xs"
                                  : "btn-ghost btn-xs"
                              }
                              onClick={() => {
                                const action = confirmAction;
                                setConfirmAction(null);
                                if (action.kind === "replace")
                                  replaceItem(action.itemId);
                                else deleteItem(action.itemId);
                              }}
                            >
                              {confirmAction.kind === "replace"
                                ? "确认换书"
                                : "确认删除"}
                            </button>
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="side">
                      {isPending && it.candidate_metadata?.weread ? (
                        <a
                          className="chip"
                          href={it.candidate_metadata.weread.readerLink}
                          target="_blank"
                          rel="noreferrer"
                          style={{ textDecoration: "none" }}
                        >
                          {it.candidate_metadata.weread.progress
                            ? `微信读书 ${it.candidate_metadata.weread.progress}%`
                            : "微信读书可读"}
                        </a>
                      ) : (
                        isPending && (
                          <span className="chip" title="请从书库界面上传书籍">
                            待补充
                          </span>
                        )
                      )}
                      {it.locked && <span className="chip ghost">已锁定</span>}
                      {it.status === "completed" && (
                        <span className="chip solid">已读完</span>
                      )}
                      {it.status === "skipped" && (
                        <span className="chip">已跳过</span>
                      )}
                      {it.status === "shelved" && (
                        <span className="chip">已搁置</span>
                      )}
                      {isPending ? (
                        <Link className="link-btn" href="/library">
                          去上传 →
                        </Link>
                      ) : it.document_id ? (
                        <Link
                          className="link-btn"
                          href={`/books/${it.document_id}`}
                        >
                          开始阅读 →
                        </Link>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
        </div>
      </div>
    </>
  );
}
