"use client";

import { useEffect, useRef } from "react";

// 阅读时长心跳：30 秒一次，只上报增量。
// 只在「页面可见 + 近 5 分钟有交互」时计时；切后台、无人操作即停表。
// 听书不能复用这里（后台播放时长不可信），需要时用 source="audio" 单独调用。

const TICK_MS = 30_000;
const IDLE_MS = 5 * 60_000;
// 断网等情况下最多积压 15 分钟，避免恢复后一次补报过多
const MAX_PENDING_SECONDS = 900;

export type ReadingSource = "read" | "audio";

function localDate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function useReadingTimer(options: {
  documentId?: string | null;
  enabled?: boolean;
  source?: ReadingSource;
}) {
  const { documentId, enabled = true, source = "read" } = options;

  const pendingRef = useRef(0); // 待上报的秒数
  const activeSinceRef = useRef(0); // 计时起点；0 表示停表中
  const lastInteractRef = useRef(0);
  const flushingRef = useRef(false);

  useEffect(() => {
    if (!enabled || !documentId) return;
    const docId = documentId;

    function collect() {
      if (!activeSinceRef.current) return;
      const elapsed = (Date.now() - activeSinceRef.current) / 1000;
      if (elapsed > 0) {
        pendingRef.current = Math.min(
          MAX_PENDING_SECONDS,
          pendingRef.current + elapsed,
        );
      }
    }

    function flush(keepalive = false) {
      if (flushingRef.current) return;
      const seconds = Math.floor(pendingRef.current);
      if (seconds < 1) return;

      flushingRef.current = true;
      pendingRef.current -= seconds;
      fetch("/api/stats/reading-time", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          document_id: docId,
          date: localDate(),
          source,
          seconds,
        }),
        keepalive,
      })
        .then((res) => {
          if (!res.ok) throw new Error(String(res.status));
        })
        .catch(() => {
          // 失败的部分退回待上报，下一次 tick 或离页时再试
          pendingRef.current = Math.min(
            MAX_PENDING_SECONDS,
            pendingRef.current + seconds,
          );
        })
        .finally(() => {
          flushingRef.current = false;
        });
    }

    function startClock() {
      lastInteractRef.current = Date.now();
      if (document.visibilityState === "visible") {
        activeSinceRef.current = Date.now();
      }
    }

    function stopClock() {
      collect();
      activeSinceRef.current = 0;
    }

    function onInteract() {
      startClock();
    }

    function onVisibilityChange() {
      if (document.visibilityState === "hidden") {
        stopClock();
        flush(true);
      } else {
        startClock();
      }
    }

    function onPageHide() {
      stopClock();
      flush(true);
    }

    function tick() {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastInteractRef.current > IDLE_MS) {
        // 无交互视为离开，停表等下一次交互
        stopClock();
        flush();
        return;
      }
      if (!activeSinceRef.current) {
        activeSinceRef.current = Date.now();
        return;
      }
      collect();
      activeSinceRef.current = Date.now();
      flush();
    }

    startClock();
    const timer = window.setInterval(tick, TICK_MS);
    window.addEventListener("pointerdown", onInteract, { passive: true });
    window.addEventListener("keydown", onInteract);
    window.addEventListener("scroll", onInteract, { passive: true });
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("pointerdown", onInteract);
      window.removeEventListener("keydown", onInteract);
      window.removeEventListener("scroll", onInteract);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
      stopClock();
      flush(true);
    };
  }, [documentId, enabled, source]);
}
