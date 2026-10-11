import { createSeed } from "./seed";
import { validateStore } from "./engine";
import { StoreSchema, type Store } from "./model";

export const STORAGE_KEY = "trace-investment-v1";
export function loadStore(): { store: Store; error: string | null } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return {
      store: raw ? validateStore(JSON.parse(raw)) : createSeed(),
      error: null,
    };
  } catch {
    return {
      store: createSeed(),
      error:
        "本地记录损坏或浏览器存储不可用，已加载演示数据。原始记录未自动覆盖，请先导出备份或重置。",
    };
  }
}
export class StorageConflictError extends Error {
  constructor() {
    super(
      "其他标签页已更新记录，已暂停保存以避免覆盖。请先导出当前草稿，再刷新加载最新记录。",
    );
  }
}
export function saveStore(store: Store, expectedRaw?: string | null) {
  StoreSchema.parse(store);
  if (
    expectedRaw !== undefined &&
    localStorage.getItem(STORAGE_KEY) !== expectedRaw
  )
    throw new StorageConflictError();
  const raw = JSON.stringify(store);
  localStorage.setItem(STORAGE_KEY, raw);
  return raw;
}
export function download(
  name: string,
  content: string,
  type = "application/json",
) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function formatTime(value: string | null, short = false) {
  if (!value) return "未披露";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    ...(short ? {} : { year: "numeric" }),
    hour12: false,
  }).format(new Date(value));
}
export function relativeTime(value: string, now = Date.now()) {
  const minutes = Math.max(0, Math.floor((now - Date.parse(value)) / 60000));
  return minutes < 1
    ? "刚刚"
    : minutes < 60
      ? `${minutes} 分钟前`
      : minutes < 1440
        ? `${Math.floor(minutes / 60)} 小时前`
        : `${Math.floor(minutes / 1440)} 天前`;
}
