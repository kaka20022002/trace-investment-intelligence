import { afterEach, describe, expect, it, vi } from "vitest";
import { conclude, extractLocally, validateEvidence } from "../src/engine";
import { createSeed, importExample } from "../src/seed";
import { saveStore, STORAGE_KEY, StorageConflictError } from "../src/storage";

const now = Date.parse("2026-10-11T00:00:00Z");
afterEach(() => vi.unstubAllGlobals());

describe("独立审查完整性回归", () => {
  it("否定性的更正声明不能确认为已签约", () => {
    const seed = createSeed(now);
    const content =
      "泊云软件更正公告：公司未签署年度服务协议，此前关于已签约的公告表述不属实。";
    const extracted = extractLocally(content, seed.events);
    expect(extracted.kind).toBe("事实");
    expect(extracted.action).toBe("否认");
    const old = seed.evidence.find((e) => e.id === "ev-52")!;
    for (const action of ["更正", "否认", "更新"] as const) {
      const next = validateEvidence(
        {
          ...old,
          id: "negative-correction",
          content,
          quote: content,
          action,
          supersedes: old.id,
          publishedAt: new Date(now - 60000).toISOString(),
          fetchedAt: new Date(now).toISOString(),
          updatedAt: new Date(now).toISOString(),
        },
        seed.evidence,
        now,
      );
      expect(conclude("event-5", [...seed.evidence, next], now).status).toBe(
        "已否认",
      );
    }
  });
  it("正向更正的后续历史否认不改变当前句方向", () => {
    expect(extractLocally(importExample, createSeed(now).events).action).toBe(
      "更正",
    );
  });
  it("超出500事件的记录在写盘之前被拒绝", () => {
    const seed = createSeed(now);
    const setItem = vi.fn();
    vi.stubGlobal("localStorage", { setItem, getItem: () => null });
    seed.events = Array.from({ length: 501 }, (_, i) => ({
      ...seed.events[0],
      id: `capacity-${i}`,
    }));
    expect(() => saveStore(seed)).toThrow();
    expect(setItem).not.toHaveBeenCalled();
  });
  it("超出5000证据的记录在写盘之前被拒绝", () => {
    const seed = createSeed(now);
    const setItem = vi.fn();
    vi.stubGlobal("localStorage", { setItem, getItem: () => null });
    seed.evidence = Array.from({ length: 5001 }, (_, i) => ({
      ...seed.evidence[0],
      id: `capacity-${i}`,
    }));
    expect(() => saveStore(seed)).toThrow();
    expect(setItem).not.toHaveBeenCalled();
  });
  it("其他标签页已写入时阻止旧快照覆盖", () => {
    const seed = createSeed(now);
    const current = JSON.stringify({ ...seed, watchlist: ["event-1"] });
    const setItem = vi.fn();
    vi.stubGlobal("localStorage", { setItem, getItem: () => current });
    expect(() => saveStore(seed, JSON.stringify(seed))).toThrow(
      StorageConflictError,
    );
    expect(setItem).not.toHaveBeenCalled();
  });
  it("版本基线相同可以保存并返回新的基线", () => {
    const seed = createSeed(now),
      before = JSON.stringify(seed);
    const setItem = vi.fn();
    vi.stubGlobal("localStorage", { setItem, getItem: () => before });
    const next = { ...seed, watchlist: ["event-4"] };
    expect(saveStore(next, before)).toBe(JSON.stringify(next));
    expect(setItem).toHaveBeenCalledWith(STORAGE_KEY, JSON.stringify(next));
  });
});
