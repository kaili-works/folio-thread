"use client";

import { useEffect, useState } from "react";

type Hint = { id: string; text: string };

// 引导助手：非阻塞提示气泡，按 user_id 记录已关闭，不重复弹出。
export default function Guide({
  userId,
  hints,
}: {
  userId: string | null;
  hints: Hint[];
}) {
  const [hint, setHint] = useState<Hint | null>(null);

  useEffect(() => {
    if (!userId) {
      setHint(null);
      return;
    }
    const key = `guide:${userId}:dismissed`;
    let dismissed: string[] = [];
    try {
      dismissed = JSON.parse(localStorage.getItem(key) ?? "[]");
    } catch {
      dismissed = [];
    }
    const next = hints.find((h) => !dismissed.includes(h.id)) ?? null;
    // 仅当 id 变化时更新，避免因 hints 数组每次渲染新建引用导致重复渲染
    setHint((prev) => (prev?.id === next?.id ? prev : next));
  }, [userId, hints]);

  function dismiss() {
    if (!userId || !hint) return;
    const key = `guide:${userId}:dismissed`;
    let dismissed: string[] = [];
    try {
      dismissed = JSON.parse(localStorage.getItem(key) ?? "[]");
    } catch {
      dismissed = [];
    }
    if (!dismissed.includes(hint.id)) dismissed.push(hint.id);
    localStorage.setItem(key, JSON.stringify(dismissed));
    setHint(null);
  }

  if (!hint) return null;

  return (
    <div className="guide-bubble">
      <span style={{ flex: 1, minWidth: 0 }}>💡 {hint.text}</span>
      <button onClick={dismiss} aria-label="关闭提示">
        ×
      </button>
    </div>
  );
}
