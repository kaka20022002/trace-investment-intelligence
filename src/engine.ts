import {
  EvidenceSchema,
  StoreSchema,
  type Evidence,
  type InvestmentEvent,
  type Conclusion,
  type Extraction,
  type Store,
} from "./model";

const sourceWeight = { 公司公告: 90, 机构研报: 65, 财经媒体: 60, 社交平台: 25 };
const kindFactor = { 事实: 1, 观点: 0.55, 推测: 0.4, 传闻: 0.25 };
export function weight(e: Evidence): number {
  return Math.round(
    sourceWeight[e.sourceType] * kindFactor[e.kind] * (e.verified ? 1 : 0.65),
  );
}
const normalized = (s: string) =>
  s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[。，,；;：:！？!?、"“”'‘’()[\]{}《》]/g, "")
    .replace(/(?<!\d)\.|\.(?!\d)/g, "");
const investmentAdvice =
  /买入|卖出|稳赚|保本|收益保证|保证收益|必涨|必跌|保证.*翻倍/;
export function duplicateOf(
  evidence: Evidence[],
  content: string,
): Evidence | undefined {
  return evidence.find((e) => normalized(e.content) === normalized(content));
}

export function conclude(
  eventId: string,
  all: Evidence[],
  now = Date.now(),
): Conclusion {
  const known = all.filter(
    (e) =>
      e.eventId === eventId &&
      Date.parse(e.publishedAt) <= now &&
      Date.parse(e.fetchedAt) <= now,
  );
  const superseded = known
    .filter((old) =>
      known.some(
        (next) =>
          next.supersedes === old.id &&
          Date.parse(next.publishedAt) >= Date.parse(old.publishedAt),
      ),
    )
    .map((e) => e.id);
  const expired = known
    .filter((e) => e.expiresAt && Date.parse(e.expiresAt) <= now)
    .map((e) => e.id);
  const active = known
    .filter((e) => !superseded.includes(e.id) && !expired.includes(e.id))
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
  const strong = active.filter(
    (e) =>
      e.kind === "事实" &&
      e.verified &&
      weight(e) >= 60 &&
      !investmentAdvice.test(e.quote),
  );
  const isDenial = (e: Evidence) =>
    e.action === "否认" ||
    (["更正", "更新"].includes(e.action) &&
      /不属实|予以否认|未签署|不存在|已终止/.test(e.quote));
  const supports = strong.filter((e) => !isDenial(e));
  const denials = strong.filter(isDenial);
  const conflict = supports.some((a) =>
    denials.some((b) => a.originId !== b.originId),
  );
  const inconsistent = supports.length > 0 && denials.length > 0;
  let status: Conclusion["status"] = "待核实";
  let refs: Evidence[] = [];
  let summary = "现有材料不足以确认事件事实，需等待可核验的一手披露。";
  if (conflict || inconsistent) {
    status = "证据冲突";
    refs = [supports[0], denials[0]];
    summary =
      "有效证据对同一事项存在相反陈述，暂不采信单一方向。请对照原文、披露时点及统计口径。";
  } else if (denials.length) {
    status = "已否认";
    refs = [denials[0]];
    summary = `据${denials[0].source}披露：${denials[0].quote} 此前不同说法不再作为当前事实依据。`;
  } else if (supports.length) {
    status = "已证实";
    refs = [supports[0]];
    summary = `据${supports[0].source}披露：${supports[0].quote} 仅确认该原文陈述，不代表事项最终完成。`;
  } else if (!active.length && expired.length) {
    status = "已过期";
    summary =
      "所有可用于判断的证据均已过期或被替代；历史结论已撤回，等待新的有效披露。";
  } else if (active.length) {
    refs = [active[0]];
  }
  const warnings: string[] = [];
  if (active.some((e) => !e.occurredAt))
    warnings.push("部分事件发生时间未披露");
  if (active.some((e) => !e.verified))
    warnings.push("部分来源身份尚未人工核验");
  if (active.some((e) => !e.sourceUrl && !e.demo))
    warnings.push("部分证据缺少原文链接");
  if (known.length && !active.length) warnings.push("当前没有有效证据");
  if (active.some((e) => investmentAdvice.test(e.quote)))
    warnings.push("含投资建议或收益承诺的引用已排除，不作为事实确认依据");
  return {
    status,
    summary,
    references: refs.map((e) => e.id),
    active,
    expired,
    superseded,
    weight: Math.max(0, ...active.map(weight)),
    independent: new Set(active.map((e) => e.originId)).size,
    warnings,
  };
}

function similarity(a: string, b: string) {
  const x = normalized(a),
    y = normalized(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const grams = (s: string) =>
    new Set(
      Array.from({ length: Math.max(0, s.length - 1) }, (_, i) =>
        s.slice(i, i + 2),
      ),
    );
  const ag = grams(x),
    bg = grams(y);
  return (
    (2 * [...ag].filter((x) => bg.has(x)).length) /
    Math.max(1, ag.size + bg.size)
  );
}
export function matchEvents(extraction: Extraction, events: InvestmentEvent[]) {
  return events
    .map((event) => {
      const entity =
        normalized(extraction.company) === normalized(event.company);
      const category = extraction.category === event.category;
      const topic = similarity(extraction.topic, event.topic);
      const period = (s: string) => ({
        year: s.match(/20\d{2}/)?.[0],
        term: s
          .match(
            /前三季度|第?[一二三四1-4]季度|Q[1-4]|上半年|下半年|半年报|全年|年度|年报/i,
          )?.[0]
          ?.replace(/^第/, "")
          .replace(/[一二三四]/g, (c) => String("一二三四".indexOf(c) + 1))
          .replace(/^q([1-4])$/i, "$1季度"),
      });
      const left = period(extraction.topic),
        right = period(event.topic);
      const periodConflict = !!(
        (left.year && right.year && left.year !== right.year) ||
        (left.term && right.term && left.term !== right.term)
      );
      const score =
        entity && category && !periodConflict ? Math.round(45 + topic * 55) : 0;
      return {
        event,
        score,
        reason: !entity
          ? "主体不同，不建议归并"
          : !category
            ? "事项类型不同，不建议归并"
            : periodConflict
              ? "报告期不同，不建议归并"
              : `主体与类型一致，事项相似度 ${Math.round(topic * 100)}%`,
      };
    })
    .filter((x) => x.score >= 65)
    .sort((a, b) => b.score - a.score);
}

export function extractLocally(
  content: string,
  events: InvestmentEvent[],
): Extraction {
  const company =
    events.find((e) => content.includes(e.company))?.company ??
    content.match(
      /[\u4e00-\u9fa5]{2,10}(?:科技|能源|集团|股份|智造|医药|软件)/,
    )?.[0] ??
    "待补充主体";
  const category = /收购|并购|股权/.test(content)
    ? "并购重组"
    : /产线|投建|扩产|项目/.test(content)
      ? "扩产投建"
      : /业绩|净利润|营收/.test(content)
        ? "业绩披露"
        : /订单|签约|合作|服务协议/.test(content)
          ? "订单合作"
          : /回购|增持/.test(content)
            ? "回购增持"
            : "产品进展";
  const sentence =
    content
      .split(/[。\n]/)
      .find((s) => s.length >= 10)
      ?.trim() ?? content.slice(0, 150);
  const action = /不属实|否认|未签署|不存在|终止/.test(sentence)
    ? "否认"
    : /更正|修正/.test(content)
      ? "更正"
      : /进展|更新/.test(sentence)
        ? "更新"
        : "支持";
  const explicitDenial =
    action === "否认" &&
    /公告[：:]|澄清[：:]|公司(?:公告|声明|回应)/.test(sentence) &&
    !/^(网传|据传|听说)/.test(sentence);
  const kind =
    /认为|观点|研报/.test(sentence) || investmentAdvice.test(sentence)
      ? "观点"
      : explicitDenial
        ? "事实"
        : /传闻|网传|听说|据传/.test(sentence)
          ? "传闻"
          : /预计|或将|可能|推测/.test(sentence)
            ? "推测"
            : "事实";
  const existing = events.find(
    (e) =>
      e.company === company &&
      e.category === category &&
      (content.includes(e.topic) ||
        (category === "并购重组" &&
          e.topic.startsWith("收购") &&
          content.includes(e.topic.replace(/^收购/, "").replace(/股权$/, "")))),
  );
  return {
    company,
    category,
    kind,
    action,
    topic: existing?.topic ?? sentence.slice(0, 32),
    title: sentence.slice(0, 100),
    quote: sentence.slice(0, 1000),
  };
}

export function validateEvidence(
  input: unknown,
  all: Evidence[],
  now = Date.now(),
): Evidence {
  const e = EvidenceSchema.parse(input);
  if (!e.content.includes(e.quote))
    throw new Error("引用必须逐字包含在原文中，不能使用模型编造的内容。");
  if (Date.parse(e.publishedAt) > now + 60_000)
    throw new Error("披露时间不能位于未来。");
  if (Date.parse(e.fetchedAt) < Date.parse(e.publishedAt))
    throw new Error("抓取时间不能早于披露时间。");
  if (
    Date.parse(e.fetchedAt) > now + 60_000 ||
    Date.parse(e.updatedAt) > now + 60_000
  )
    throw new Error("抓取或更新时间不能位于未来。");
  if (Date.parse(e.updatedAt) < Date.parse(e.fetchedAt))
    throw new Error("更新时间不能早于抓取时间。");
  if (e.occurredAt && Date.parse(e.occurredAt) > Date.parse(e.publishedAt))
    throw new Error("发生时间不能晚于披露时间；计划日期请写在原文中。");
  if (e.expiresAt && Date.parse(e.expiresAt) <= Date.parse(e.publishedAt))
    throw new Error("有效期截止时间必须晚于披露时间。");
  if (e.verified && !e.demo && !e.sourceUrl)
    throw new Error("人工核验来源需提供原文链接。");
  if (
    duplicateOf(
      all.filter((x) => x.id !== e.id),
      e.content,
    )
  )
    throw new Error("已存在相同原文，请勿重复导入；转载不增加证据权重。");
  if (e.supersedes) {
    const old = all.find((x) => x.id === e.supersedes);
    if (!old || old.id === e.id || old.eventId !== e.eventId)
      throw new Error("被替代证据必须属于同一事件，且不能指向自身。");
    if (Date.parse(e.publishedAt) <= Date.parse(old.publishedAt))
      throw new Error("更正或更新的披露时间必须晚于前版本。");
    if (e.source !== old.source || e.originId !== old.originId)
      throw new Error(
        "仅允许同一来源、相同原始来源链的更正；跨来源证据须保留供冲突核验。",
      );
    if (!["更正", "更新", "否认"].includes(e.action))
      throw new Error("替代版本必须标记为更正、更新或否认。");
    if (
      old.verified &&
      old.kind === "事实" &&
      weight(old) >= 60 &&
      (!e.verified ||
        e.kind !== "事实" ||
        weight(e) < 60 ||
        investmentAdvice.test(e.quote))
    )
      throw new Error(
        "已核验事实只能由同源已核验、达到确认阈值的事实版本替代；未核验信息请作为独立证据保留。",
      );
  }
  return e;
}

export function validateStore(input: unknown, now = Date.now()): Store {
  const store = StoreSchema.parse(input);
  if (
    new Set(store.events.map((e) => e.id)).size !== store.events.length ||
    new Set(store.evidence.map((e) => e.id)).size !== store.evidence.length
  )
    throw new Error("备份含重复 ID。");
  const ids = new Set(store.events.map((e) => e.id));
  if (
    store.evidence.some((e) => !ids.has(e.eventId)) ||
    store.watchlist.some((id) => !ids.has(id))
  )
    throw new Error("备份中存在无法关联的事件。");
  store.evidence.forEach((e) => validateEvidence(e, store.evidence, now));
  return store;
}
