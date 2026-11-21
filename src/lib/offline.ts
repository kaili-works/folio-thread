// 客户端离线缓存与离线操作队列（IndexedDB），按 user_id 命名空间隔离。

const DB_NAME = "daily-reading-offline";
const STORE = "chapters"; // key = `${userId}:${chapterId}`
const QUEUE = "mutations"; // 离线完成章节队列

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB 不可用"));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains(QUEUE)) {
        db.createObjectStore(QUEUE, { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(
  store: string,
  mode: IDBTransactionMode,
): Promise<IDBObjectStore> {
  return openDb().then((db) => {
    return db.transaction(store, mode).objectStore(store);
  });
}

// 缓存单个章节（含段落原文）。译文不缓存，离线显示原文。
export async function cacheChapter(
  userId: string,
  chapterId: string,
  chapter: unknown,
  paragraphs: unknown[],
): Promise<void> {
  const store = await tx(STORE, "readwrite");
  await new Promise<void>((resolve, reject) => {
    const req = store.put({
      key: `${userId}:${chapterId}`,
      chapter,
      paragraphs,
    });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getCachedChapter(
  userId: string,
  chapterId: string,
): Promise<{ chapter: any; paragraphs: any[] } | null> {
  const store = await tx(STORE, "readonly");
  return new Promise((resolve, reject) => {
    const req = store.get(`${userId}:${chapterId}`);
    req.onsuccess = () =>
      resolve(req.result ? (req.result as any) : null);
    req.onerror = () => reject(req.error);
  });
}

// 清空某用户的全部离线缓存（退出/删除账号时调用）
export async function clearUserCache(userId: string): Promise<void> {
  const store = await tx(STORE, "readwrite");
  const keys: string[] = [];
  await new Promise<void>((resolve) => {
    const req = store.getAllKeys();
    req.onsuccess = () => {
      for (const k of req.result as IDBValidKey[]) keys.push(String(k));
      resolve();
    };
    req.onerror = () => resolve();
  });
  const prefix = `${userId}:`;
  await Promise.all(
    keys
      .filter((k) => k.startsWith(prefix))
      .map(
        (k) =>
          new Promise<void>((resolve, reject) => {
            const r = store.delete(k);
            r.onsuccess = () => resolve();
            r.onerror = () => reject(r.error);
          }),
      ),
  );
}

// 离线队列：完成章节
export async function queueComplete(
  userId: string,
  chapterId: string,
): Promise<void> {
  const store = await tx(QUEUE, "readwrite");
  await new Promise<void>((resolve, reject) => {
    const req = store.add({ userId, chapterId, ts: Date.now() });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function getQueuedCompletes(
  userId: string,
): Promise<{ id: number; chapterId: string }[]> {
  const store = await tx(QUEUE, "readonly");
  return new Promise((resolve) => {
    const req = store.getAll();
    req.onsuccess = () => {
      const rows = (req.result as any[]).filter((r) => r.userId === userId);
      resolve(rows.map((r) => ({ id: r.id, chapterId: r.chapterId })));
    };
    req.onerror = () => resolve([]);
  });
}

async function removeQueued(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  const store = await tx(QUEUE, "readwrite");
  await Promise.all(
    ids.map(
      (id) =>
        new Promise<void>((resolve, reject) => {
          const r = store.delete(id);
          r.onsuccess = () => resolve();
          r.onerror = () => reject(r.error);
        }),
    ),
  );
}

// 联网后同步离线「完成本章」队列，返回同步条数
export async function syncQueuedCompletes(userId: string): Promise<number> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return 0;
  const queued = await getQueuedCompletes(userId);
  if (queued.length === 0) return 0;

  const okIds: number[] = [];
  for (const q of queued) {
    try {
      const res = await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapter_id: q.chapterId }),
      });
      if (res.ok) okIds.push(q.id);
    } catch {
      // 仍离线或失败，保留待下次
    }
  }
  await removeQueued(okIds);
  return okIds.length;
}
