"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import AppNav from "@/components/AppNav";
import { useT } from "@/i18n";
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

// 书籍操作图标：16px 线性图标，文字说明交给下方「清单操作说明」
function ActIcon({
  name,
}: {
  name: "up" | "down" | "swap" | "lock" | "unlock" | "shelve" | "restore" | "delete";
}) {
  const common = {
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.4,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (name === "up")
    return (
      <svg {...common}>
        <path d="M8 13V3.5M4.5 7L8 3.5 11.5 7" />
      </svg>
    );
  if (name === "down")
    return (
      <svg {...common}>
        <path d="M8 3v9.5M4.5 9 8 12.5 11.5 9" />
      </svg>
    );
  if (name === "swap")
    return (
      <svg {...common}>
        <path d="M3 5.5h8.5M9 3l2.5 2.5L9 8" />
        <path d="M13 10.5H4.5M7 8l-2.5 2.5L7 13" />
      </svg>
    );
  if (name === "lock")
    return (
      <svg {...common}>
        <rect x="3.5" y="7" width="9" height="6" rx="1.2" />
        <path d="M5.5 7V5.5a2.5 2.5 0 0 1 5 0V7" />
      </svg>
    );
  if (name === "unlock")
    return (
      <svg {...common}>
        <rect x="3.5" y="7" width="9" height="6" rx="1.2" />
        <path d="M5.5 7V5.5a2.5 2.5 0 0 1 4.8-1" />
      </svg>
    );
  if (name === "shelve")
    return (
      <svg {...common}>
        <path d="M2.5 3.5h11v3h-11z" />
        <path d="M3.5 6.5v6h9v-6M6.5 9h3" />
      </svg>
    );
  if (name === "restore")
    return (
      <svg {...common}>
        <path d="M4 6.5H2.5v-1.5" />
        <path d="M2.8 6.3A5 5 0 1 1 3 10" />
      </svg>
    );
  return (
    <svg {...common}>
      <path d="M3 4.5h10M6 4.5V3h4v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5" />
    </svg>
  );
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

// 节点上的状态文案由页面内按语言生成
export default function ThemesPage() {
  const supabase = createClient();
  const router = useRouter();
  const t = useT();

  const [themes, setThemes] = useState<Theme[]>([]);
  // 每个主题最新清单的项数与已读数，用于左轨摘要
  const [themeStats, setThemeStats] = useState<
    Record<string, { total: number; done: number }>
  >({});
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
  const [view, setView] = useState<"path" | "list">("path");
  // 一句话调整面板
  const [adjustOpen, setAdjustOpen] = useState(false);
  // 生成今日包
  const [packBusy, setPackBusy] = useState(false);
  // 每本书的章节级进度，按 document_id 索引
  const [bookProgress, setBookProgress] = useState<
    Record<string, { done: number; total: number; current: number }>
  >({});
  const [genPoints, setGenPoints] = useState(false);
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
    const [{ data }, { data: lists }] = await Promise.all([
      supabase.from("themes").select("*").order("created_at", { ascending: false }),
      supabase
        .from("reading_lists")
        .select("id, theme_id, created_at")
        .order("created_at", { ascending: false }),
    ]);
    const list = sortThemes((data as Theme[]) ?? []);
    setThemes(list);
    setThemesLoaded(true);
    // 默认选中第一个主题，便于直接看到清单
    if (list.length > 0 && !activeTheme) {
      selectTheme(list[0]);
    }

    // 左轨摘要：每个主题取最新一份清单，统计可推进项与已读数
    const latestList = new Map<string, string>();
    for (const l of lists ?? []) {
      if (!latestList.has(l.theme_id)) latestList.set(l.theme_id, l.id);
    }
    const listTheme = new Map((lists ?? []).map((l) => [l.id, l.theme_id]));
    const stats: Record<string, { total: number; done: number }> = {};
    for (const id of latestList.values()) {
      const themeId = listTheme.get(id);
      if (themeId) stats[themeId] = { total: 0, done: 0 };
    }
    const listIds = Array.from(latestList.values());
    if (listIds.length > 0) {
      const { data: its } = await supabase
        .from("list_items")
        .select("reading_list_id, status")
        .in("reading_list_id", listIds)
        .is("deleted_at", null);
      for (const it of its ?? []) {
        const themeId = listTheme.get(it.reading_list_id);
        if (!themeId || !stats[themeId]) continue;
        stats[themeId].total += 1;
        if (it.status === "completed") stats[themeId].done += 1;
      }
    }
    setThemeStats(stats);
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

  function selectTheme(next: Theme) {
    setActiveTheme(next);
    setThemeBudget(String(next.daily_budget_minutes ?? 30));
    setMessage("");
    loadList(next.id);
  }

  function itemStateLabel(it: ListItem) {
    if (it.availability === "pending_supplement") return t.themes.statePending;
    if (it.status === "completed") return t.themes.stateDone;
    if (it.status === "in_progress") return t.themes.stateReading;
    if (it.status === "skipped") return t.themes.stateSkipped;
    if (it.status === "shelved") return t.themes.stateShelved;
    return t.themes.stateUnread;
  }

  // 按当前清单生成今日包，生成后直接去今日页
  async function generateTodayPack() {
    if (packBusy) return;
    setPackBusy(true);
    try {
      const res = await fetch("/api/daily-pack", { method: "POST" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setMessage(t.themes.packFailed(json.error ?? res.status));
        return;
      }
      router.push("/today");
    } catch (e) {
      setMessage(t.themes.packFailed(e instanceof Error ? e.message : "network"));
    } finally {
      setPackBusy(false);
    }
  }

  async function saveThemeBudget() {
    if (!activeTheme) return;
    const minutes = Number(themeBudget);
    if (!Number.isFinite(minutes) || minutes < 5 || minutes > 180) {
      setMessage(t.themes.budgetInvalid);
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
      setMessage(t.themes.budgetSaved);
    } else {
      setMessage(t.themes.budgetSaveFailed(json.error ?? res.status));
    }
  }

  async function patchThemeDomain(theme: Theme, domain: string) {
    const res = await fetch(`/api/themes/${theme.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain: domain || null }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(t.themes.domainSaveFailed(json.error ?? res.status));
      return;
    }
    const updated = json.theme as Theme;
    setThemes((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    setActiveTheme((prev) => (prev?.id === updated.id ? updated : prev));
    setMessage(t.themes.domainUpdated(updated.domain ?? t.themes.uncategorized));
  }

  async function patchThemeStatus(theme: Theme, status: string) {
    const res = await fetch(`/api/themes/${theme.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(t.themes.itemUpdateFailed(json.error ?? res.status));
      return;
    }
    const updated = json.theme as Theme;
    setThemes((prev) =>
      sortThemes(prev.map((x) => (x.id === updated.id ? updated : x))),
    );
    setActiveTheme((prev) => (prev?.id === updated.id ? updated : prev));
    setMessage(t.themes.statusUpdated(status));
  }

  async function deleteTheme(theme: Theme) {
    if (!confirm(t.themes.deleteConfirm(theme.name))) {
      return;
    }
    const res = await fetch(`/api/themes/${theme.id}`, { method: "DELETE" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(t.themes.deleteFailed(json.error ?? res.status));
      return;
    }
    setThemes((prev) => prev.filter((x) => x.id !== theme.id));
    if (activeTheme?.id === theme.id) {
      setActiveTheme(null);
      setItems([]);
      setListId(null);
      setListStatus("");
    }
    setMessage(t.themes.deleted(theme.name));
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
      setMessage(t.themes.createFailed(json.error ?? res.status));
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
      setMessage(t.themes.listGenerated(json.hint));
      // 路径要显示知识点，生成清单后顺手在后台提炼
      if (json.list?.id) void generateKeyPoints(json.list.id, true);
    } else {
      setMessage(t.themes.listGenerateFailed(json.error ?? res.status));
    }
  }

  async function refreshList() {
    if (!activeTheme) return;
    setMessage("");
    const res = await fetch("/api/lists/refresh", { method: "POST" });
    const json = await res.json().catch(() => ({}));
    if (res.ok) {
      setMessage(t.themes.refreshed(json.matched?.length ?? 0));
      loadList(activeTheme.id);
    } else {
      setMessage(t.themes.refreshFailed(json.error ?? res.status));
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
      setRegenMessage(t.themes.regenFailed(json.error ?? res.status));
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
      setRegenMessage(t.themes.regenApplied);
    } else {
      setRegenMessage(t.themes.regenApplyFailed(json.error ?? res.status));
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
      setRegenMessage(t.themes.regenUndone);
    } else {
      setRegenMessage(t.themes.regenUndoFailed(json.error ?? res.status));
    }
  }

  // 按章节标题提炼每本书的知识点标签
  async function generateKeyPoints(targetListId?: string, quiet = false) {
    const id = targetListId ?? listId;
    if (!id) return;
    setGenPoints(true);
    if (!quiet) setMessage(t.themes.keyPointsRunning);
    const res = await fetch("/api/lists/keypoints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ list_id: id }),
    });
    const json = await res.json().catch(() => ({}));
    setGenPoints(false);
    if (res.ok) {
      if (activeTheme) await loadList(activeTheme.id);
      if (!quiet) setMessage(t.themes.keyPointsDone(json.updated ?? 0));
    } else if (!quiet) {
      setMessage(t.themes.keyPointsFailed(json.error ?? res.status));
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
      setMessage(t.themes.confirmFailed(error.message));
      return;
    }
    setListStatus("active");
    setMessage(t.themes.confirmedMsg);
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
      setMessage(t.themes.replaced(json.title ?? ""));
    } else {
      setMessage(t.themes.replaceFailed(json.error ?? res.status));
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
  const pendingCount = items.filter(
    (it) => it.availability === "pending_supplement",
  ).length;
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

  // 提示 6 秒后自动消失，避免浮动提示长期遮挡
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(""), 6000);
    return () => window.clearTimeout(timer);
  }, [message]);

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
  function renderThemeActions(theme: Theme) {
    return (
      <div className="acts">
        <select
          className="domain-select"
          value={theme.domain ?? ""}
          onChange={(e) => patchThemeDomain(theme, e.target.value)}
          aria-label={t.themes.domainLabel}
          title={t.themes.domainHint}
        >
          <option value="">{t.themes.uncategorized}</option>
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
              theme,
              theme.status === "priority" ? "active" : "priority",
            )
          }
        >
          {theme.status === "priority"
            ? t.themes.unpriority
            : t.themes.priority}
        </button>
        <button
          className="btn-quiet btn-xs"
          onClick={() =>
            patchThemeStatus(
              theme,
              theme.status === "shelved" ? "active" : "shelved",
            )
          }
        >
          {theme.status === "shelved" ? t.themes.restore : t.themes.shelved}
        </button>
        <button className="btn-danger btn-xs" onClick={() => deleteTheme(theme)}>
          {t.themes.remove}
        </button>
      </div>
    );
  }

  return (
    <>
      <AppNav />
      <div className="container app-main themes-page">
        <div className="page-head page-head-row">
          <div>
            <span className="kicker">{t.themes.kicker}</span>
            <h1>{t.themes.title}</h1>
          </div>
          <div className="page-head-acts">
            {themesLoaded && themes.length > 0 && (
              <button
                type="button"
                className="btn-line btn-sm"
                onClick={generateTodayPack}
                disabled={packBusy}
              >
                {packBusy
                  ? t.themes.generatingToday
                  : t.themes.generateToday}
              </button>
            )}
            <button
              type="button"
              className="btn-sm theme-new-btn"
              onClick={() => setCreating((v) => !v)}
              aria-expanded={creating}
            >
              {creating ? t.themes.newThemeClose : `＋ ${t.themes.newTheme}`}
            </button>
          </div>
        </div>

        {/* 创建主题：页面唯一主按钮展开后的表单 */}
        {creating && (
          <form className="theme-create" onSubmit={createTheme}>
            <div className="theme-create-grid">
              <label className="theme-create-field">
                <span>{t.themes.nameLabel}</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t.themes.namePlaceholder}
                  required
                />
              </label>
              <label className="theme-create-field">
                <span>{t.themes.descLabel}</span>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t.themes.descPlaceholder}
                />
              </label>
            </div>
            <p className="theme-create-help">{t.themes.createHelp}</p>
            <div className="theme-create-acts">
              <button type="submit" className="btn-sm">
                {t.themes.create}
              </button>
              <button
                type="button"
                className="btn-ghost btn-sm"
                onClick={() => setCreating(false)}
              >
                {t.themes.cancel}
              </button>
            </div>
          </form>
        )}

        {message && (
          <div className="toast" role="status">
            {message}
          </div>
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
                <span className="kicker">
                  {t.themes.myThemes(themes.length)}
                </span>
                <span className="name">
                  {activeTheme?.name ?? t.themes.myThemes(themes.length)}
                </span>
                {activeTheme && (
                  <span className="budget">
                    {t.themes.railMetaShort(
                      activeTheme.daily_budget_minutes,
                    )}
                    {activeTheme.status === "priority"
                      ? ` · ${t.themes.priority}`
                      : ""}
                    {activeTheme.status === "shelved"
                      ? ` · ${t.themes.shelved}`
                      : ""}
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
                aria-label={t.themes.myThemes(themes.length)}
                onClick={() => setPickerOpen(false)}
              >
                <div
                  className="theme-sheet"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="theme-sheet-grab" aria-hidden="true" />
                  <div className="theme-sheet-head">
                    <b>{t.themes.myThemes(themes.length)}</b>
                    {activeTheme && (
                      <button
                        type="button"
                        className="rail-manage"
                        onClick={() => setManageOpen((v) => !v)}
                      >
                        {manageOpen
                          ? t.themes.manageClose
                          : t.themes.manage}
                      </button>
                    )}
                  </div>
                  {themes.map((theme) => {
                    const isActive = activeTheme?.id === theme.id;
                    return (
                      <div
                        key={theme.id}
                        className={`picker-item${isActive ? " on" : ""}${
                          theme.status === "shelved" ? " shelved" : ""
                        }`}
                      >
                        <button
                          type="button"
                          className="picker-main"
                          onClick={() => {
                            selectTheme(theme);
                            setPickerOpen(false);
                          }}
                        >
                          <span className="txt">
                            <span className="nm">
                              {theme.name}
                              {theme.status === "priority" && (
                                <span className="chip solid">
                                  {t.themes.priority}
                                </span>
                              )}
                              {theme.status === "shelved" && (
                                <span className="chip">
                                  {t.themes.shelved}
                                </span>
                              )}
                            </span>
                            <span className="sub">
                              {t.themes.railMetaShort(
                                theme.daily_budget_minutes,
                              )}
                              {isActive && trackedTotal > 0
                                ? ` · ${listPct}%`
                                : ""}
                            </span>
                          </span>
                          <span className="check" aria-hidden="true">
                            {isActive ? "✓" : ""}
                          </span>
                        </button>
                        {isActive && manageOpen && renderThemeActions(theme)}
                      </div>
                    );
                  })}
                  <div className="theme-sheet-foot">
                    <span>{t.themes.railNewHint}</span>
                    <button
                      type="button"
                      className="btn-quiet btn-xs"
                      onClick={() => setPickerOpen(false)}
                    >
                      {t.themes.manageClose}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {!themesLoaded && (
          <div className="page-loading">{t.themes.loadingThemes}</div>
        )}
        {themesLoaded && themes.length === 0 && (
          <div className="theme-empty">
            <span className="kicker">{t.themes.emptyKicker}</span>
            <h2>{t.themes.emptyTitle}</h2>
            <p>{t.themes.emptyBody}</p>
          </div>
        )}

        <div
          className="themes"
          style={{
            display: !themesLoaded || themes.length === 0 ? "none" : undefined,
          }}
        >
          {/* 左：主题轨 */}
          <aside className="rail">
            <div className="rail-head">
              <span className="kicker">
                {t.themes.myThemes(themes.length)}
              </span>
              {activeTheme && (
                <button
                  type="button"
                  className="rail-manage"
                  onClick={() => setManageOpen((v) => !v)}
                >
                  {manageOpen ? t.themes.manageClose : t.themes.manage}
                </button>
              )}
            </div>
            {themes.map((theme) => {
              const isActive = activeTheme?.id === theme.id;
              const stat = isActive
                ? { total: items.length, done: completedCount }
                : themeStats[theme.id];
              const railPct =
                stat && stat.total > 0
                  ? Math.round((stat.done / stat.total) * 100)
                  : 0;
              return (
                <div
                  key={theme.id}
                  className={`rail-item${isActive ? " active" : ""}${
                    theme.status === "shelved" ? " shelved" : ""
                  }`}
                >
                  <button
                    type="button"
                    className="pick"
                    onClick={() => selectTheme(theme)}
                  >
                    <span className="t">
                      {theme.name}
                      {theme.status === "priority" && (
                        <span className="chip solid">{t.themes.priority}</span>
                      )}
                      {theme.status === "shelved" && (
                        <span className="chip">{t.themes.shelved}</span>
                      )}
                    </span>
                    <span className="meta">
                      {stat && stat.total > 0
                        ? t.themes.railMeta(
                            stat.total,
                            stat.done,
                            theme.daily_budget_minutes,
                          )
                        : t.themes.railMetaShort(
                            theme.daily_budget_minutes,
                          )}
                      {theme.status === "shelved"
                        ? ` · ${t.themes.shelved}`
                        : ""}
                    </span>
                    {stat && stat.total > 0 && (
                      <span className="rail-track">
                        <i style={{ width: `${railPct}%` }} />
                      </span>
                    )}
                  </button>
                  {isActive && manageOpen && renderThemeActions(theme)}
                </div>
              );
            })}
            <div className="rail-new">
              <button type="button" onClick={() => setCreating(true)}>
                ＋ {t.themes.railNew}
              </button>
              <span>· {t.themes.railNewHint}</span>
            </div>
          </aside>

          {/* 右：当前清单 */}
          {activeTheme && (
            <section className="sheet" ref={listSectionRef}>
              <div className="sheet-head">
                <div style={{ minWidth: 0 }}>
                  <span className="kicker">{t.themes.currentList}</span>
                  <h2>{activeTheme.name}</h2>
                  {activeTheme.description && (
                    <p className="sub">{activeTheme.description}</p>
                  )}
                </div>
                <div className="sheet-acts">
                  <span
                    className={`chip ${
                      listStatus === "active" ? "solid" : ""
                    }`}
                  >
                    {listStatus === "active"
                      ? t.themes.confirmed
                      : t.themes.draft}
                  </span>
                  {listStatus !== "active" && items.length > 0 && (
                    <button className="btn-sm" onClick={confirmList}>
                      {t.themes.confirmList}
                    </button>
                  )}
                  {items.length > 0 && (
                    <button
                      className="btn-line btn-sm"
                      onClick={() => setAdjustOpen((v) => !v)}
                      aria-expanded={adjustOpen}
                    >
                      {t.themes.adjust}
                    </button>
                  )}
                </div>
              </div>

              {/* 一句话调整清单 */}
              {adjustOpen && items.length > 0 && (
                <div className="sheet-adjust">
                  <div className="sheet-adjust-row">
                    <input
                      type="text"
                      value={regenHint}
                      onChange={(e) => setRegenHint(e.target.value)}
                      placeholder={t.themes.adjustPlaceholder}
                    />
                    <button
                      className="btn-sm"
                      onClick={regenerate}
                      disabled={regenning}
                    >
                      {regenning
                        ? t.themes.regenerating
                        : t.themes.regenerate}
                    </button>
                  </div>

                  {regenMessage && (
                    <p className="muted sheet-adjust-msg">{regenMessage}</p>
                  )}

                  {regenPreview && (
                    <div className="sheet-adjust-preview">
                      <p className="muted">
                        {t.themes.regenPreview(
                          items.length - regenPreview.removed.length,
                          regenPreview.removed.length,
                        )}
                      </p>
                      <div className="preview-list">
                        {regenPreview.proposed.map((p, i) => (
                          <div key={i}>
                            《{p.title}》{p.author ? ` · ${p.author}` : ""}
                            {p.availability === "readable"
                              ? ""
                              : `（${t.themes.statePending}）`}
                            —— {p.reason}
                          </div>
                        ))}
                      </div>
                      <div className="sheet-adjust-acts">
                        <button className="btn-sm" onClick={applyRegenerate}>
                          {t.themes.apply}
                        </button>
                        <button
                          className="btn-ghost btn-sm"
                          onClick={cancelRegenerate}
                        >
                          {t.themes.discard}
                        </button>
                      </div>
                    </div>
                  )}

                  {undoInfo && !regenPreview && (
                    <button
                      className="btn-ghost btn-sm sheet-adjust-undo"
                      onClick={undoRegenerate}
                    >
                      {t.themes.undoRegen}
                    </button>
                  )}
                </div>
              )}

              <div className="sheet-stats">
                <div className="cell">
                  <div className="k">{t.themes.statList}</div>
                  <div className="v">
                    {t.themes.bookCount(items.length)}
                  </div>
                </div>
                <div className="cell">
                  <div className="k">{t.themes.statRead}</div>
                  <div className="v">
                    {t.themes.bookCount(completedCount)}
                  </div>
                </div>
                <div className="cell">
                  <div className="k">{t.themes.statPending}</div>
                  <div className="v">
                    {t.themes.bookCount(pendingCount)}
                  </div>
                </div>
                <div className="cell">
                  <div className="k">{t.themes.statBudget}</div>
                  <div className="v budget">
                    <input
                      type="number"
                      value={themeBudget}
                      onChange={(e) => setThemeBudget(e.target.value)}
                      min={5}
                      max={180}
                      aria-label={t.themes.statBudget}
                    />
                    <small>{t.themes.unitMinutes}</small>
                    <button
                      className="btn-quiet btn-xs"
                      onClick={saveThemeBudget}
                    >
                      {t.themes.save}
                    </button>
                  </div>
                </div>
              </div>

              {items.length > 0 && (
                <div className="sheet-progress">
                  <div className="progress">
                    <span
                      className={`progress-fill${listFinished ? " done" : ""}`}
                      style={{ width: `${listPct}%` }}
                    />
                  </div>
                  <div className="progress-meta">
                    <span>{t.themes.readingProgress}</span>
                    <span>
                      {t.themes.progressMeta(
                        completedCount,
                        trackedTotal,
                        listPct,
                      )}
                      {items.length !== trackedTotal
                        ? ` · ${t.themes.progressExtra(
                            items.length - trackedTotal,
                          )}`
                        : ""}
                    </span>
                  </div>
                </div>
              )}

              {listFinished && (
                <div className="completion-banner">
                  {t.themes.completionBanner(activeTheme.name)}
                  <span className="sub">
                    {t.themes.completionSub(completedCount)}
                  </span>
                </div>
              )}

              {!listLoading && items.length === 0 && (
                <div className="list-empty">
                  <p className="muted">{t.themes.emptyList}</p>
                  <button
                    className="btn-sm"
                    onClick={generateList}
                    disabled={generating}
                  >
                    {generating ? t.themes.recommending : t.themes.recommend}
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
                    <p className="muted">{t.themes.listNoBooks}</p>
                    <div className="list-empty-acts">
                      <Link href="/library" className="btn-sm">
                        {t.themes.goUpload}
                      </Link>
                      <button className="btn-ghost btn-sm" onClick={refreshList}>
                        {t.themes.refresh}
                      </button>
                    </div>
                  </div>
                )}

              {items.length > 0 && (
                <div className="toolbar">
                  <span className="hint">
                    {view === "path"
                      ? t.themes.readingPath
                      : t.themes.readingList}
                  </span>
                  <button
                    className="btn-quiet btn-sm"
                    onClick={refreshList}
                  >
                    {t.themes.refresh}
                  </button>
                  {hasMissingPoints && (
                    <button
                      className="btn-quiet btn-sm"
                      onClick={() => generateKeyPoints()}
                      disabled={genPoints}
                    >
                      {genPoints
                        ? t.themes.genPointsBusy
                        : t.themes.genPoints}
                    </button>
                  )}
                  <span className="grow" />
                  <div className="seg" role="group" aria-label={t.themes.viewLabel}>
                    <button
                      type="button"
                      className={view === "path" ? "on" : ""}
                      aria-pressed={view === "path"}
                      onClick={() => setView("path")}
                    >
                      {t.themes.path}
                    </button>
                    <button
                      type="button"
                      className={view === "list" ? "on" : ""}
                      aria-pressed={view === "list"}
                      onClick={() => setView("list")}
                    >
                      {t.themes.list}
                    </button>
                  </div>
                </div>
              )}

              {/* 路径视图：编号、节点、知识点、进度在一列里读完 */}
              {items.length > 0 && view === "path" && (
                <div className="path">
                  {items.map((it, idx) => {
                    const isPending =
                      it.availability === "pending_supplement";
                    const title =
                      it.documents?.title ??
                      it.candidate_metadata?.title ??
                      t.themes.unknownBook;
                    const author =
                      it.documents?.author ??
                      it.candidate_metadata?.author ??
                      "";
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
                    const stateChip =
                      it.status === "completed"
                        ? t.themes.stateDone
                        : it.status === "skipped"
                          ? t.themes.stateSkipped
                          : it.status === "shelved"
                            ? t.themes.stateShelved
                            : isPending
                              ? t.themes.statePending
                              : it.id === nowItemId
                                ? t.themes.stateReading
                                : "";
                    return (
                      <div
                        className={`node${state ? ` ${state}` : ""}${
                          isPending ? " pending" : ""
                        }`}
                        key={it.id}
                      >
                        <span className="dot" aria-hidden="true" />
                        <div className="node-head">
                          <span className="node-idx">
                            {String(idx + 1).padStart(2, "0")}
                          </span>
                          <h3 className="node-title">
                            {it.document_id && !isPending ? (
                              <Link href={`/books/${it.document_id}`}>
                                {title}
                              </Link>
                            ) : (
                              title
                            )}
                          </h3>
                          {stateChip && (
                            <span
                              className={`chip${
                                it.id === nowItemId ? " solid" : ""
                              }`}
                              style={{ marginLeft: "auto" }}
                            >
                              {stateChip}
                            </span>
                          )}
                        </div>
                        <p className="node-meta">
                          {[
                            author ||
                              (isPending ? t.themes.notInLibrary : ""),
                            stateChip ? "" : itemStateLabel(it),
                            it.locked ? t.themes.locked : "",
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                          {!isPending && it.document_id && (
                            <span className="chip ok">{t.themes.uploaded}</span>
                          )}
                        </p>
                        <div className="node-chips">
                          {keyPoints.length > 0 ? (
                            keyPoints.map((p) => (
                              <span className="chip" key={p}>
                                {p}
                              </span>
                            ))
                          ) : (
                            <span className="chip dash">
                              {t.themes.pointsPending}
                            </span>
                          )}
                        </div>
                        {progress && progress.total > 0 && (
                          <div className="node-prog">
                            <span className="track">
                              <span
                                className="bar"
                                style={{ width: `${pct}%` }}
                              />
                            </span>
                            <span className="label">
                              {t.themes.chapterProgress(
                                progress.current,
                                progress.total,
                                pct,
                              )}
                            </span>
                          </div>
                        )}
                        <div className="node-foot">
                          {isPending && weread ? (
                            <a
                              className="link"
                              href={weread.readerLink}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {t.themes.readOnWeread}
                            </a>
                          ) : isPending ? (
                            <Link className="link quiet" href="/library">
                              {t.themes.goUpload}
                            </Link>
                          ) : it.document_id ? (
                            <Link
                              className={
                                it.status === "in_progress" ? "link" : "link quiet"
                              }
                              href={`/books/${it.document_id}`}
                            >
                              {it.status === "completed"
                                ? t.themes.reread
                                : it.status === "in_progress"
                                  ? t.themes.continueReading
                                  : t.themes.startReading}{" "}
                              →
                            </Link>
                          ) : null}
                        </div>

                        <div className="manage-row">
                          <button
                            className="item-act"
                            title={t.themes.moveUp}
                            aria-label={t.themes.moveUp}
                            onClick={() => moveItem(it.id, "up")}
                            disabled={idx === 0}
                          >
                            <ActIcon name="up" />
                          </button>
                          <button
                            className="item-act"
                            title={t.themes.moveDown}
                            aria-label={t.themes.moveDown}
                            onClick={() => moveItem(it.id, "down")}
                            disabled={idx === items.length - 1}
                          >
                            <ActIcon name="down" />
                          </button>
                          <button
                            className="item-act"
                            title={
                              replacingId === it.id
                                ? t.themes.replacing
                                : t.themes.replace
                            }
                            aria-label={t.themes.replace}
                            onClick={() =>
                              setConfirmAction({
                                kind: "replace",
                                itemId: it.id,
                              })
                            }
                            disabled={replacingId !== null}
                          >
                            <ActIcon name="swap" />
                          </button>
                          <button
                            className="item-act"
                            title={it.locked ? t.themes.unlock : t.themes.lock}
                            aria-label={it.locked ? t.themes.unlock : t.themes.lock}
                            onClick={() => toggleLock(it.id)}
                          >
                            <ActIcon name={it.locked ? "unlock" : "lock"} />
                          </button>
                          {it.status === "skipped" ||
                          it.status === "shelved" ? (
                            <button
                              className="item-act"
                              title={t.themes.restore}
                              aria-label={t.themes.restore}
                              onClick={() => setItemStatus(it.id, "unread")}
                            >
                              <ActIcon name="restore" />
                            </button>
                          ) : (
                            <button
                              className="item-act"
                              title={t.themes.shelve}
                              aria-label={t.themes.shelve}
                              onClick={() => setItemStatus(it.id, "shelved")}
                            >
                              <ActIcon name="shelve" />
                            </button>
                          )}
                          <button
                            className="item-act danger"
                            title={t.themes.remove}
                            aria-label={t.themes.remove}
                            onClick={() =>
                              setConfirmAction({
                                kind: "delete",
                                itemId: it.id,
                              })
                            }
                          >
                            <ActIcon name="delete" />
                          </button>
                        </div>

                        {confirmAction?.itemId === it.id && (
                          <div className="confirm-inline" role="alertdialog">
                            <span className="confirm-inline-text">
                              {confirmAction.kind === "replace"
                                ? t.themes.confirmReplace(title)
                                : t.themes.confirmDelete(title)}
                            </span>
                            <span className="confirm-inline-actions">
                              <button
                                className="btn-ghost btn-xs"
                                onClick={() => setConfirmAction(null)}
                              >
                                {t.themes.cancel}
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
                                  ? t.themes.confirmReplaceOk
                                  : t.themes.confirmDeleteOk}
                              </button>
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {items.length > 0 && view === "list" && (
                <div className="list">
                  {items.map((it, idx) => {
                    const isPending =
                      it.availability === "pending_supplement";
                    const title =
                      it.documents?.title ??
                      it.candidate_metadata?.title ??
                      t.themes.unknownBook;
                    const author =
                      it.documents?.author ??
                      it.candidate_metadata?.author ??
                      "";
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
                              <Link href={`/books/${it.document_id}`}>
                                {title}
                              </Link>
                            ) : (
                              title
                            )}
                          </p>
                          {(author || isPending) && (
                            <p className="a">
                              {author || t.themes.notInLibrary}
                            </p>
                          )}
                          {it.reason && (
                            <p
                              className={`r${
                                expandedId === it.id ? "" : " clamp"
                              }`}
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
                              className="item-act"
                              title={t.themes.moveUp}
                              aria-label={t.themes.moveUp}
                              onClick={() => moveItem(it.id, "up")}
                              disabled={idx === 0}
                            >
                              <ActIcon name="up" />
                            </button>
                            <button
                              className="item-act"
                              title={t.themes.moveDown}
                              aria-label={t.themes.moveDown}
                              onClick={() => moveItem(it.id, "down")}
                              disabled={idx === items.length - 1}
                            >
                              <ActIcon name="down" />
                            </button>
                            <button
                              className="item-act"
                              title={
                                replacingId === it.id
                                  ? t.themes.replacing
                                  : t.themes.replace
                              }
                              aria-label={t.themes.replace}
                              onClick={() =>
                                setConfirmAction({
                                  kind: "replace",
                                  itemId: it.id,
                                })
                              }
                              disabled={replacingId !== null}
                            >
                              <ActIcon name="swap" />
                            </button>
                            <button
                              className="item-act"
                              title={it.locked ? t.themes.unlock : t.themes.lock}
                              aria-label={
                                it.locked ? t.themes.unlock : t.themes.lock
                              }
                              onClick={() => toggleLock(it.id)}
                            >
                              <ActIcon name={it.locked ? "unlock" : "lock"} />
                            </button>
                            {it.status === "skipped" ||
                            it.status === "shelved" ? (
                              <button
                                className="item-act"
                                title={t.themes.restore}
                                aria-label={t.themes.restore}
                                onClick={() => setItemStatus(it.id, "unread")}
                              >
                                <ActIcon name="restore" />
                              </button>
                            ) : (
                              <button
                                className="item-act"
                                title={t.themes.shelve}
                                aria-label={t.themes.shelve}
                                onClick={() => setItemStatus(it.id, "shelved")}
                              >
                                <ActIcon name="shelve" />
                              </button>
                            )}
                            <button
                              className="item-act danger"
                              title={t.themes.remove}
                              aria-label={t.themes.remove}
                              onClick={() =>
                                setConfirmAction({
                                  kind: "delete",
                                  itemId: it.id,
                                })
                              }
                            >
                              <ActIcon name="delete" />
                            </button>
                          </div>
                          {confirmAction?.itemId === it.id && (
                            <div className="confirm-inline" role="alertdialog">
                              <span className="confirm-inline-text">
                                {confirmAction.kind === "replace"
                                  ? t.themes.confirmReplace(title)
                                  : t.themes.confirmDelete(title)}
                              </span>
                              <span className="confirm-inline-actions">
                                <button
                                  className="btn-ghost btn-xs"
                                  onClick={() => setConfirmAction(null)}
                                >
                                  {t.themes.cancel}
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
                                    ? t.themes.confirmReplaceOk
                                    : t.themes.confirmDeleteOk}
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
                                ? `${t.themes.wereadChip} ${it.candidate_metadata.weread.progress}%`
                                : t.themes.wereadChip}
                            </a>
                          ) : (
                            isPending && (
                              <span className="chip">
                                {t.themes.statePending}
                              </span>
                            )
                          )}
                          {it.locked && (
                            <span className="chip ghost">{t.themes.locked}</span>
                          )}
                          {it.status === "completed" && (
                            <span className="chip solid">
                              {t.themes.stateDone}
                            </span>
                          )}
                          {it.status === "skipped" && (
                            <span className="chip">{t.themes.stateSkipped}</span>
                          )}
                          {it.status === "shelved" && (
                            <span className="chip">
                              {t.themes.stateShelved}
                            </span>
                          )}
                          {isPending && it.candidate_metadata?.weread ? (
                            <a
                              className="link-btn"
                              href={it.candidate_metadata.weread.readerLink}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {t.themes.readOnWeread}
                            </a>
                          ) : isPending ? (
                            <Link className="link-btn" href="/library">
                              {t.themes.goUpload}
                            </Link>
                          ) : it.document_id ? (
                            <Link
                              className="link-btn"
                              href={`/books/${it.document_id}`}
                            >
                              {it.status === "completed"
                                ? t.themes.reread
                                : it.status === "in_progress"
                                  ? t.themes.continueReading
                                  : t.themes.startReading}{" "}
                              →
                            </Link>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {items.length > 0 && (
                <details className="plain list-help">
                  <summary>{t.themes.helpSummary}</summary>
                  <ul>
                    <li>{t.themes.helpMove}</li>
                    <li>{t.themes.helpReplace}</li>
                    <li>{t.themes.helpLock}</li>
                    <li>{t.themes.helpShelve}</li>
                    <li>{t.themes.helpPending}</li>
                    <li>{t.themes.helpDelete}</li>
                  </ul>
                </details>
              )}
            </section>
          )}
        </div>
      </div>
    </>
  );
}
