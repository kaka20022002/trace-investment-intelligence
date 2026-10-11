import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  conclude,
  duplicateOf,
  extractLocally,
  matchEvents,
  validateEvidence,
  validateStore,
  weight,
} from "../src/engine";
import {
  safeUrl,
  type Evidence,
  type Extraction,
  type InvestmentEvent,
  type Store,
} from "../src/model";
import { createSeed, importExample } from "../src/seed";
import { formatTime, loadStore, saveStore, STORAGE_KEY } from "../src/storage";

const NOW = Date.parse("2026-10-10T12:00:00.000Z");
const at = (hoursFromNow: number) =>
  new Date(NOW + hoursFromNow * 3_600_000).toISOString();

function evidence(id: string, changes: Partial<Evidence> = {}): Evidence {
  return {
    id,
    eventId: "event-a",
    source: "测试公司官网",
    sourceType: "公司公告",
    sourceUrl: `https://example.com/notices/${id}`,
    title: `测试事项披露 ${id}`,
    content: `测试公司公告：事项已通过审核，证据标识为${id}，以原文披露为准。`,
    quote: "事项已通过审核",
    kind: "事实",
    action: "支持",
    occurredAt: at(-8),
    publishedAt: at(-6),
    fetchedAt: at(-5),
    updatedAt: at(-4),
    expiresAt: at(24),
    supersedes: null,
    originId: "company-original",
    verified: true,
    demo: false,
    ...changes,
  };
}

function event(
  id = "event-a",
  changes: Partial<InvestmentEvent> = {},
): InvestmentEvent {
  return {
    id,
    title: "测试公司收购事项",
    company: "测试科技",
    ticker: "TEST",
    category: "并购重组",
    topic: "收购砺行半导体股权",
    tags: [],
    createdAt: at(-48),
    ...changes,
  };
}

function extraction(changes: Partial<Extraction> = {}): Extraction {
  return {
    company: "测试科技",
    title: "测试公司收购事项",
    category: "并购重组",
    topic: "收购砺行半导体股权",
    kind: "事实",
    action: "支持",
    quote: "事项已通过审核",
    ...changes,
  };
}

function store(evidenceRows: Evidence[] = [evidence("original")]): Store {
  return {
    version: 1,
    events: [event()],
    evidence: evidenceRows,
    watchlist: ["event-a"],
  };
}

function browserStorage(raw: string | null = null) {
  const values = new Map<string, string>(
    raw === null ? [] : [[STORAGE_KEY, raw]],
  );
  const storage = {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value);
    }),
  };
  vi.stubGlobal("localStorage", storage);
  return storage;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("演示数据与结论引用", () => {
  it.each([
    ["event-1", "证据冲突", ["ev-11", "ev-13"]],
    ["event-2", "已否认", ["ev-23"]],
    ["event-3", "已证实", ["ev-32"]],
    ["event-4", "待核实", ["ev-42"]],
    ["event-5", "已证实", ["ev-52"]],
    ["event-6", "已过期", []],
  ])("%s 的状态应为 %s，引用必须指向相应原文", (id, status, references) => {
    const seed = createSeed(NOW);
    const result = conclude(id as string, seed.evidence, NOW);
    expect(result.status).toBe(status);
    expect(result.references).toEqual(references);
    for (const reference of result.references) {
      const cited = seed.evidence.find((row) => row.id === reference);
      expect(cited?.eventId).toBe(id);
      expect(cited?.content).toContain(cited?.quote);
      expect(result.active.map((row) => row.id)).toContain(reference);
    }
  });

  it("六个演示事件及其所有引用通过完整备份校验", () => {
    const seed = createSeed(NOW);
    expect(seed.events).toHaveLength(6);
    expect(validateStore(seed, NOW)).toEqual(seed);
  });

  it("演示更正仅引用新金额，旧版本保留在历史而不参与当前结论", () => {
    const seed = createSeed(NOW);
    const result = conclude("event-5", seed.evidence, NOW);
    expect(result.superseded).toEqual(["ev-51"]);
    expect(result.active.map((row) => row.id)).toEqual(["ev-52"]);
    expect(result.summary).toContain("2,800万元");
    expect(seed.evidence.some((row) => row.id === "ev-51")).toBe(true);
  });
});

describe("证据等级、冲突及独立来源", () => {
  it.each(["传闻", "观点", "推测"] as const)(
    "人工核验的公司来源也不能将%s确认为事实",
    (kind) => {
      const result = conclude("event-a", [evidence("claim", { kind })], NOW);
      expect(result.status).toBe("待核实");
      expect(result.references).toEqual(["claim"]);
    },
  );

  it.each(["支持", "否认"] as const)(
    "未核验事实的%s不能生成确定结论",
    (action) => {
      const result = conclude(
        "event-a",
        [evidence("unverified", { action, verified: false })],
        NOW,
      );
      expect(result.status).toBe("待核实");
      expect(result.warnings).toContain("部分来源身份尚未人工核验");
    },
  );

  it.each([
    "建议立即买入公司股票",
    "建议立即卖出公司股票",
    "本次投资保证收益且稳赚不赔",
  ])("高权重已核验材料中的投资建议或收益承诺不能确认为事实：%s", (quote) => {
    const row = evidence("investment-advice", {
      content: `测试公司材料：${quote}。请读者阅读完整内容。`,
      quote,
    });
    expect(row.kind).toBe("事实");
    expect(row.verified).toBe(true);
    expect(weight(row)).toBeGreaterThanOrEqual(60);
    expect(conclude("event-a", [row], NOW).status).toBe("待核实");
  });

  it("已核验社交平台事实仍达不到确认阈值", () => {
    expect(
      conclude("event-a", [evidence("social", { sourceType: "社交平台" })], NOW)
        .status,
    ).toBe("待核实");
  });

  it.each([false, true])(
    "不同来源的明确支持与否认必须冲突，不受输入顺序影响（反序=%s）",
    (reverse) => {
      const rows = [
        evidence("support"),
        evidence("denial", {
          source: "独立财经媒体",
          sourceType: "财经媒体",
          originId: "media-original",
          action: "否认",
          publishedAt: at(-3),
          fetchedAt: at(-2),
          updatedAt: at(-1),
        }),
      ];
      const result = conclude(
        "event-a",
        reverse ? [...rows].reverse() : rows,
        NOW,
      );
      expect(result.status).toBe("证据冲突");
      expect(result.references).toEqual(["support", "denial"]);
      expect(result.active).toHaveLength(2);
      expect(result.independent).toBe(2);
    },
  );

  it("较新的传闻不得覆盖已核验公告中的明确否认", () => {
    const result = conclude(
      "event-a",
      [
        evidence("denial", { action: "否认" }),
        evidence("rumor", {
          source: "匿名帖子",
          sourceType: "社交平台",
          originId: "forum-original",
          kind: "传闻",
          verified: false,
          publishedAt: at(-3),
          fetchedAt: at(-2),
          updatedAt: at(-1),
        }),
      ],
      NOW,
    );
    expect(result.status).toBe("已否认");
    expect(result.references).toEqual(["denial"]);
    expect(result.active[0].id).toBe("rumor");
  });

  it("未经明确更正关联的同源相反陈述仍需保留冲突", () => {
    const result = conclude(
      "event-a",
      [evidence("support"), evidence("denial", { action: "否认" })],
      NOW,
    );
    expect(result.status).toBe("证据冲突");
    expect(result.superseded).toEqual([]);
  });

  it("同一原始来源的多家转载只计一个独立来源，不叠加证据权重", () => {
    const original = evidence("original", {
      sourceType: "财经媒体",
      source: "原发媒体",
    });
    const reposts = [1, 2, 3].map((index) =>
      evidence(`repost-${index}`, {
        sourceType: "财经媒体",
        source: `转载媒体${index}`,
        originId: original.originId,
      }),
    );
    const base = conclude("event-a", [original], NOW);
    const result = conclude("event-a", [original, ...reposts], NOW);
    expect(result.independent).toBe(1);
    expect(result.weight).toBe(base.weight);
    expect(result.weight).toBe(weight(original));
    expect(result.status).toBe(base.status);
  });

  it("其他事件的否认不能污染当前事件", () => {
    const result = conclude(
      "event-a",
      [
        evidence("support"),
        evidence("other", { eventId: "event-b", action: "否认" }),
      ],
      NOW,
    );
    expect(result.status).toBe("已证实");
    expect(result.references).toEqual(["support"]);
  });

  it("没有证据时返回待核实，而不是确认或过期", () => {
    expect(conclude("missing", [], NOW)).toMatchObject({
      status: "待核实",
      references: [],
      active: [],
      weight: 0,
      independent: 0,
    });
  });
});

describe("版本替代、有效期及历史时点", () => {
  const correction = (changes: Partial<Evidence> = {}) =>
    evidence("correction", {
      action: "更正",
      supersedes: "original",
      publishedAt: at(-3),
      fetchedAt: at(-2),
      updatedAt: at(-1),
      ...changes,
    });

  it("同源明确更正移除旧版，结论不受输入顺序影响", () => {
    const old = evidence("original");
    const next = validateEvidence(correction(), [old], NOW);
    for (const rows of [
      [old, next],
      [next, old],
    ]) {
      const result = conclude("event-a", rows, NOW);
      expect(result.status).toBe("已证实");
      expect(result.references).toEqual(["correction"]);
      expect(result.active.map((row) => row.id)).toEqual(["correction"]);
      expect(result.superseded).toEqual(["original"]);
    }
  });

  it("同源明确否认可以替代旧支持，不应产生伪冲突", () => {
    const old = evidence("original");
    const next = validateEvidence(correction({ action: "否认" }), [old], NOW);
    expect(conclude("event-a", [old, next], NOW)).toMatchObject({
      status: "已否认",
      references: ["correction"],
      superseded: ["original"],
    });
  });

  it("更正版本过期后不恢复仍在有效期内的旧版结论", () => {
    const old = evidence("original", { expiresAt: null });
    const next = validateEvidence(
      correction({ expiresAt: at(-0.5) }),
      [old],
      NOW,
    );
    const result = conclude("event-a", [old, next], NOW);
    expect(result.status).toBe("已过期");
    expect(result.references).toEqual([]);
    expect(result.active).toEqual([]);
    expect(result.superseded).toEqual(["original"]);
    expect(result.expired).toEqual(["correction"]);
    expect(result.warnings).toContain("当前没有有效证据");
  });

  it("多次更正的末版过期也不得恢复任一历史版本", () => {
    const old = evidence("original", {
      publishedAt: at(-12),
      fetchedAt: at(-11),
      updatedAt: at(-10),
      occurredAt: at(-13),
    });
    const middle = correction({
      publishedAt: at(-8),
      fetchedAt: at(-7),
      updatedAt: at(-6),
    });
    const latest = evidence("latest", {
      action: "更新",
      supersedes: middle.id,
      publishedAt: at(-3),
      fetchedAt: at(-2),
      updatedAt: at(-1),
      expiresAt: at(-0.5),
    });
    const result = conclude("event-a", [old, middle, latest], NOW);
    expect(result.status).toBe("已过期");
    expect(result.superseded).toEqual(["original", "correction"]);
    expect(result.active).toEqual([]);
    expect(result.references).toEqual([]);
  });

  it("有效证据按披露时间而非抓取时间排序和选取引用", () => {
    const older = evidence("older", {
      publishedAt: at(-6),
      fetchedAt: at(-1),
      updatedAt: at(-1),
    });
    const newer = evidence("newer", {
      publishedAt: at(-3),
      fetchedAt: at(-2),
      updatedAt: at(-2),
    });
    const rows = [older, newer];
    const result = conclude("event-a", rows, NOW);
    expect(result.active.map((row) => row.id)).toEqual(["newer", "older"]);
    expect(result.references).toEqual(["newer"]);
    expect(rows.map((row) => row.id)).toEqual(["older", "newer"]);
  });

  it("as-of 查询不能看见当时尚未抓取的过去披露", () => {
    const row = evidence("late-fetch", {
      fetchedAt: at(-1),
      updatedAt: at(-1),
    });
    const beforeFetch = conclude("event-a", [row], Date.parse(at(-2)));
    expect(beforeFetch.status).toBe("待核实");
    expect(beforeFetch.active).toEqual([]);
    expect(beforeFetch.references).toEqual([]);
    expect(conclude("event-a", [row], Date.parse(at(-1))).status).toBe(
      "已证实",
    );
  });

  it("尚未抓取的更正不能提前替代历史时点可见的旧版", () => {
    const old = evidence("original");
    const next = correction({ fetchedAt: at(-1), updatedAt: at(-1) });
    expect(conclude("event-a", [old, next], Date.parse(at(-2)))).toMatchObject({
      status: "已证实",
      references: ["original"],
      superseded: [],
    });
    expect(conclude("event-a", [old, next], NOW).references).toEqual([
      "correction",
    ]);
  });

  it("未来披露不会进入当前结论、来源计数或引用", () => {
    const result = conclude(
      "event-a",
      [
        evidence("future", {
          publishedAt: at(1),
          fetchedAt: at(2),
          updatedAt: at(2),
        }),
      ],
      NOW,
    );
    expect(result).toMatchObject({
      status: "待核实",
      references: [],
      active: [],
      independent: 0,
      weight: 0,
    });
  });

  it("有效期截止时立即过期，历史时点仍可看到当时有效的结论", () => {
    const row = evidence("expires-now", { expiresAt: at(0) });
    expect(conclude("event-a", [row], NOW - 1).status).toBe("已证实");
    expect(conclude("event-a", [row], NOW)).toMatchObject({
      status: "已过期",
      references: [],
      expired: ["expires-now"],
    });
  });

  it("发生时间未披露时保留 null 并展示警告，不捏造发生时间", () => {
    const row = validateEvidence(
      evidence("unknown-time", { occurredAt: null }),
      [],
      NOW,
    );
    const result = conclude("event-a", [row], NOW);
    expect(row.occurredAt).toBeNull();
    expect(result.active[0].occurredAt).toBeNull();
    expect(result.warnings).toContain("部分事件发生时间未披露");
    expect(formatTime(row.occurredAt)).toBe("未披露");
  });
});

describe("原文去重与事件匹配", () => {
  it("原文仅有大小写、空白和标点差异时识别为重复", () => {
    const original = evidence("original", {
      content: "测试科技 ABC：合同已经签署，金额明确。",
      quote: "合同已经签署",
    });
    expect(
      duplicateOf([original], "  测试科技 abc 合同已经签署\n金额明确！ "),
    ).toBe(original);
  });

  it("即使改来源和 originId，相同原文也不能重复导入", () => {
    const original = evidence("original");
    const repost = evidence("repost", {
      content: original.content,
      source: "转载方",
      originId: "changed-origin",
    });
    expect(() => validateEvidence(repost, [original], NOW)).toThrow(/相同原文/);
  });

  it("金额不同的原文不能误判重复，同 ID 编辑也不视为新增副本", () => {
    const original = evidence("original", {
      content: "测试公司公告：合同金额为3000万元，服务期为一年。",
      quote: "合同金额为3000万元",
    });
    expect(
      duplicateOf(
        [original],
        "测试公司公告：合同金额为2800万元，服务期为一年。",
      ),
    ).toBeUndefined();
    expect(validateEvidence(original, [original], NOW)).toEqual(original);
  });

  it.each([
    ["1.5亿元", "15亿元"],
    ["+10%", "-10%"],
  ])("去重必须保留数值语义，%s 与 %s 不得视为相同原文", (first, second) => {
    const original = evidence("original", {
      content: `测试科技公告：本期披露数值为${first}，其余说明保持不变。`,
      quote: "其余说明保持不变",
    });
    const changed = `测试科技公告：本期披露数值为${second}，其余说明保持不变。`;
    expect(duplicateOf([original], changed)).toBeUndefined();
  });

  it("同主体、同类型、同事项可匹配，其他主体不可匹配", () => {
    const rows = [event(), event("other-company", { company: "另一家公司" })];
    const result = matchEvents(extraction(), rows);
    expect(result.map((row) => row.event.id)).toEqual(["event-a"]);
    expect(result[0].score).toBe(100);
  });

  it("同主体但类型不同，即使事项文字完全相同也不合并", () => {
    expect(
      matchEvents(extraction({ category: "订单合作" }), [event()]),
    ).toEqual([]);
  });

  it("同主体、同类型但事项不同不合并", () => {
    expect(
      matchEvents(extraction({ topic: "出售海外仓储子公司全部资产" }), [
        event(),
      ]),
    ).toEqual([]);
  });

  it("相同收购句式不能把不同收购对象当作同一事项", () => {
    expect(
      matchEvents(extraction({ topic: "收购海岳新能源股权" }), [event()]),
    ).toEqual([]);
  });

  it("不同报告期的同类财务指标不是同一事项", () => {
    const prior = event("prior-quarter", {
      category: "业绩披露",
      topic: "2026年第二季度净利润",
    });
    const current = extraction({
      category: "业绩披露",
      topic: "2026年第三季度净利润",
    });
    expect(matchEvents(current, [prior])).toEqual([]);
  });

  it("本地抽取不同收购对象时不得直接复用已有事件主题", () => {
    const content =
      "测试科技公告：公司拟收购海岳新能源股权，交易方案仍在审议，尚未签署最终协议。";
    const parsed = extractLocally(content, [event()]);
    expect(parsed.company).toBe("测试科技");
    expect(parsed.category).toBe("并购重组");
    expect(parsed.topic).not.toBe(event().topic);
    expect(parsed.topic).toContain("海岳新能源");
    expect(content).toContain(parsed.quote);
    expect(matchEvents(parsed, [event()])).toEqual([]);
  });

  it("演示更新公告应提取更正，不能将旧版未签署表述当作当前否认", () => {
    const seed = createSeed(NOW);
    const parsed = extractLocally(importExample, seed.events);
    expect(parsed.company).toBe("澜芯科技");
    expect(parsed.category).toBe("并购重组");
    expect(parsed.action).toBe("更正");
    expect(importExample).toContain(parsed.quote);
    expect(parsed.quote).toContain("已与砺行半导体签署股权收购意向书");
  });

  it("同主体不同收购标的的更新原文不能复用演示收购事项", () => {
    const seed = createSeed(NOW);
    const content =
      "澜芯科技更新公告：公司已与海岳新能源签署股权收购意向书，拟收购51%股权，具体方案尚待审议。";
    const parsed = extractLocally(content, seed.events);
    const oldEvent = seed.events.find((row) => row.id === "event-2")!;
    expect(parsed.company).toBe("澜芯科技");
    expect(parsed.category).toBe("并购重组");
    expect(parsed.topic).not.toBe(oldEvent.topic);
    expect(parsed.topic).toContain("海岳新能源");
    expect(
      matchEvents(parsed, seed.events).map((row) => row.event.id),
    ).not.toContain("event-2");
  });

  it("正式公告否认传闻时不能仅因出现传闻一词降级为传闻", () => {
    const content =
      "测试科技公告：公司未签署收购砺行半导体股权的协议，相关传闻不属实，不存在应披露而未披露的交易事项。";
    const parsed = extractLocally(content, [event()]);
    expect(parsed.action).toBe("否认");
    expect(parsed.kind).toBe("事实");
    expect(content).toContain(parsed.quote);
    const row = validateEvidence(
      evidence("official-denial", {
        content,
        quote: parsed.quote,
        kind: parsed.kind,
        action: parsed.action,
      }),
      [],
      NOW,
    );
    expect(conclude("event-a", [row], NOW).status).toBe("已否认");
  });
});

describe("证据时间、来源与引用校验", () => {
  it("正常的非演示证据可通过校验", () => {
    const row = evidence("valid");
    expect(validateEvidence(row, [], NOW)).toEqual(row);
  });

  it.each([
    [
      "未来披露",
      { publishedAt: at(1), fetchedAt: at(2), updatedAt: at(2) },
      /披露时间不能位于未来/,
    ],
    ["先抓取后披露", { fetchedAt: at(-7) }, /抓取时间不能早于披露时间/],
    [
      "未来抓取",
      { fetchedAt: at(1), updatedAt: at(1) },
      /抓取或更新时间不能位于未来/,
    ],
    ["未来更新", { updatedAt: at(1) }, /抓取或更新时间不能位于未来/],
    ["更新早于抓取", { updatedAt: at(-6) }, /更新时间不能早于抓取时间/],
    ["发生晚于披露", { occurredAt: at(-3) }, /发生时间不能晚于披露时间/],
    ["有效期早于披露", { expiresAt: at(-7) }, /有效期截止时间必须晚于披露时间/],
    ["有效期等于披露", { expiresAt: at(-6) }, /有效期截止时间必须晚于披露时间/],
  ] as const)("拒绝%s", (_name, changes, message) => {
    expect(() =>
      validateEvidence(evidence("invalid-time", changes), [], NOW),
    ).toThrow(message);
  });

  it.each(["not-a-date", "2026-99-99T10:00:00Z", "2026-10-10"])(
    "拒绝非法时间格式 %s",
    (publishedAt) => {
      expect(() =>
        validateEvidence(evidence("invalid-date", { publishedAt }), [], NOW),
      ).toThrow();
    },
  );

  it("有时区偏移的同一时刻按实际时间比较", () => {
    const row = evidence("offset", {
      occurredAt: "2026-10-10T10:00:00+08:00",
      publishedAt: "2026-10-10T12:00:00+08:00",
      fetchedAt: "2026-10-10T05:00:00Z",
      updatedAt: "2026-10-10T06:00:00Z",
    });
    expect(validateEvidence(row, [], NOW)).toEqual(row);
  });

  it.each([
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "file:///etc/passwd",
    "ftp://example.com/file",
    "vbscript:msgbox(1)",
    "//example.com/source",
    "/source",
  ])("拒绝危险或非 HTTP(S) 链接 %s", (sourceUrl) => {
    expect(safeUrl(sourceUrl)).toBe(false);
    expect(() =>
      validateEvidence(evidence("unsafe-url", { sourceUrl }), [], NOW),
    ).toThrow();
  });

  it.each(["http://example.com/notice", "https://example.com/notice?id=1"])(
    "允许合法来源链接 %s",
    (sourceUrl) => {
      expect(safeUrl(sourceUrl)).toBe(true);
      expect(
        validateEvidence(evidence("safe-url", { sourceUrl }), [], NOW)
          .sourceUrl,
      ).toBe(sourceUrl);
    },
  );

  it("非演示人工核验必须附来源链接，未核验材料明确保留缺链警告", () => {
    expect(() =>
      validateEvidence(evidence("no-link", { sourceUrl: "" }), [], NOW),
    ).toThrow(/原文链接/);
    const row = validateEvidence(
      evidence("unverified-no-link", { sourceUrl: "", verified: false }),
      [],
      NOW,
    );
    expect(conclude("event-a", [row], NOW).warnings).toContain(
      "部分证据缺少原文链接",
    );
  });

  it("演示证据明确标记 demo 后可不提供虚构原文链接", () => {
    expect(
      validateEvidence(evidence("demo", { demo: true, sourceUrl: "" }), [], NOW)
        .demo,
    ).toBe(true);
  });

  it.each([
    "事项已经正式完成",
    "事项 已通过审核",
    "事项已通过审核，且保证盈利",
  ])("拒绝原文中不存在的引用：%s", (quote) => {
    expect(() =>
      validateEvidence(evidence("hallucination", { quote }), [], NOW),
    ).toThrow(/引用必须逐字包含在原文中/);
  });

  it("拒绝对不存在证据、自身或另一事件执行替代", () => {
    const old = evidence("original");
    const base = evidence("next", {
      action: "更正",
      supersedes: old.id,
      publishedAt: at(-3),
      fetchedAt: at(-2),
      updatedAt: at(-1),
    });
    expect(() =>
      validateEvidence({ ...base, supersedes: "missing" }, [old], NOW),
    ).toThrow(/同一事件/);
    expect(() =>
      validateEvidence({ ...base, supersedes: base.id }, [old, base], NOW),
    ).toThrow(/自身/);
    expect(() =>
      validateEvidence({ ...base, eventId: "event-b" }, [old], NOW),
    ).toThrow(/同一事件/);
  });

  it.each([
    ["来源名不同", { source: "另一家媒体" }],
    ["原始来源链不同", { originId: "unrelated-origin" }],
  ] as const)("拒绝跨来源替代：%s", (_name, changes) => {
    const old = evidence("original");
    const next = evidence("next", {
      action: "更正",
      supersedes: old.id,
      publishedAt: at(-3),
      fetchedAt: at(-2),
      updatedAt: at(-1),
      ...changes,
    });
    expect(() => validateEvidence(next, [old], NOW)).toThrow(/同一来源/);
  });

  it.each([-7, -6])(
    "替代版本必须严格晚于旧版披露（时间偏移 %s 小时）",
    (offset) => {
      const old = evidence("original");
      const next = evidence("next", {
        action: "更正",
        supersedes: old.id,
        publishedAt: at(offset),
      });
      expect(() => validateEvidence(next, [old], NOW)).toThrow(
        /披露时间必须晚于前版本/,
      );
    },
  );

  it.each(["更正", "更新", "否认"] as const)(
    "同源未核验传闻不能以%s替代已核验事实",
    (action) => {
      const old = evidence("original");
      const next = evidence("unverified-replacement", {
        action,
        supersedes: old.id,
        verified: false,
        kind: "传闻",
        publishedAt: at(-3),
        fetchedAt: at(-2),
        updatedAt: at(-1),
      });
      expect(() => validateEvidence(next, [old], NOW)).toThrow();
      expect(() => validateStore(store([old, next]), NOW)).toThrow();
    },
  );

  it("普通支持不得通过 supersedes 静默删除旧证据", () => {
    const old = evidence("original");
    const next = evidence("next", {
      supersedes: old.id,
      publishedAt: at(-3),
      fetchedAt: at(-2),
      updatedAt: at(-1),
    });
    expect(() => validateEvidence(next, [old], NOW)).toThrow(
      /更正、更新或否认/,
    );
  });
});

describe("备份引用完整性和存储恢复", () => {
  it("完整备份通过校验，且不修改传入对象", () => {
    const input = store();
    const before = JSON.stringify(input);
    expect(validateStore(input, NOW)).toEqual(input);
    expect(JSON.stringify(input)).toBe(before);
  });

  it.each(["events", "evidence"] as const)(
    "拒绝 %s 中的重复 ID",
    (collection) => {
      const input = store();
      if (collection === "events") input.events.push({ ...input.events[0] });
      else input.evidence.push({ ...input.evidence[0] });
      expect(() => validateStore(input, NOW)).toThrow(/重复 ID/);
    },
  );

  it("证据 eventId 不得指向不存在的事件", () => {
    expect(() =>
      validateStore(
        store([evidence("orphan", { eventId: "missing-event" })]),
        NOW,
      ),
    ).toThrow(/无法关联的事件/);
  });

  it("关注列表不得引用不存在的事件", () => {
    expect(() =>
      validateStore({ ...store(), watchlist: ["missing-event"] }, NOW),
    ).toThrow(/无法关联的事件/);
  });

  it("备份中的 supersedes 不得悬空或跨事件", () => {
    const old = evidence("original");
    const next = evidence("next", {
      action: "更正",
      supersedes: "missing",
      publishedAt: at(-3),
      fetchedAt: at(-2),
      updatedAt: at(-1),
    });
    expect(() => validateStore(store([old, next]), NOW)).toThrow(/同一事件/);
    const input = store([
      old,
      { ...next, eventId: "event-b", supersedes: old.id },
    ]);
    input.events.push(event("event-b"));
    expect(() => validateStore(input, NOW)).toThrow(/同一事件/);
  });

  it("备份中的替代关系即使指向数组后方也能正确校验", () => {
    const old = evidence("original");
    const next = evidence("next", {
      action: "更正",
      supersedes: old.id,
      publishedAt: at(-3),
      fetchedAt: at(-2),
      updatedAt: at(-1),
    });
    const input = store([next, old]);
    expect(validateStore(input, NOW)).toEqual(input);
  });

  it("拒绝形成环的替代关系", () => {
    const old = evidence("original", { action: "更正", supersedes: "next" });
    const next = evidence("next", {
      action: "更正",
      supersedes: old.id,
      publishedAt: at(-3),
      fetchedAt: at(-2),
      updatedAt: at(-1),
    });
    expect(() => validateStore(store([old, next]), NOW)).toThrow(
      /披露时间必须晚于前版本/,
    );
  });

  it("备份不能绕过来源链接、原文引用和内容去重校验", () => {
    const old = evidence("original");
    expect(() =>
      validateStore(
        store([evidence("unsafe", { sourceUrl: "javascript:alert(1)" })]),
        NOW,
      ),
    ).toThrow();
    expect(() =>
      validateStore(
        store([
          evidence("fabricated", { quote: "原文不存在的已完成交易结论" }),
        ]),
        NOW,
      ),
    ).toThrow(/逐字包含/);
    expect(() =>
      validateStore(
        store([old, evidence("copy", { content: old.content })]),
        NOW,
      ),
    ).toThrow(/相同原文/);
  });

  it("拒绝不支持的备份版本", () => {
    expect(() => validateStore({ ...store(), version: 2 }, NOW)).toThrow();
  });

  it("首次打开加载演示数据，但不自动写入浏览器存储", () => {
    const storage = browserStorage();
    expect(loadStore()).toEqual({ store: createSeed(NOW), error: null });
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it("保存后重新加载保持证据引用、关注列表和历史版本一致", () => {
    const storage = browserStorage();
    const input = createSeed(NOW);
    saveStore(input);
    expect(storage.setItem).toHaveBeenCalledWith(
      STORAGE_KEY,
      JSON.stringify(input),
    );
    expect(loadStore()).toEqual({ store: input, error: null });
  });

  it.each([
    "{broken json",
    JSON.stringify({ ...store(), watchlist: ["missing-event"] }),
  ])("损坏备份降级但保留原始存储，不静默覆盖：%s", (raw) => {
    const storage = browserStorage(raw);
    const result = loadStore();
    expect(result.store).toEqual(createSeed(NOW));
    expect(result.error).toContain("原始记录未自动覆盖");
    expect(storage.getItem(STORAGE_KEY)).toBe(raw);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it("浏览器存储不可用时显式提示并加载演示数据", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("storage unavailable");
      },
    });
    const result = loadStore();
    expect(result.store.events).toHaveLength(6);
    expect(result.error).toContain("浏览器存储不可用");
  });

  it("写入失败应抛错，不能假装保存成功", () => {
    const storage = browserStorage();
    storage.setItem.mockImplementation(() => {
      throw new Error("quota exceeded");
    });
    expect(() => saveStore(store())).toThrow("quota exceeded");
  });
});
