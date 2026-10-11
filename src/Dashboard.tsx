import { useState } from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  CheckCheck,
  ChevronDown,
  CircleHelp,
  Clock3,
  FileText,
  Filter,
  GitBranch,
  Layers3,
  Plus,
  Radio,
  Search,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import type { Conclusion, InvestmentEvent, Store, Status } from "./model";
import { categories } from "./model";
import { conclude } from "./engine";
import { relativeTime } from "./storage";
import { Empty, StatusBadge } from "./ui";

export type EventRow = {
  event: InvestmentEvent;
  conclusion: Conclusion;
  count: number;
  latest: string;
};
export function makeRows(store: Store, now: number): EventRow[] {
  return store.events.map((event) => {
    const ev = store.evidence.filter((e) => e.eventId === event.id);
    return {
      event,
      conclusion: conclude(event.id, store.evidence, now),
      count: ev.length,
      latest: ev.reduce(
        (last, e) =>
          Date.parse(e.publishedAt) > Date.parse(last) ? e.publishedAt : last,
        event.createdAt,
      ),
    };
  });
}
function Sparkline({
  color,
  variant,
  rows,
  store,
  now,
}: {
  color: string;
  variant: number;
  rows: EventRow[];
  store: Store;
  now: number;
}) {
  const states = ["", "待核实", "证据冲突", "已证实"];
  const series = Array.from({ length: 7 }, (_, index) => {
    const at = now - (6 - index) * 86400000;
    const known = rows.filter((r) => Date.parse(r.event.createdAt) <= at);
    return variant === 0
      ? known.length
      : known.filter(
          (r) =>
            conclude(r.event.id, store.evidence, at).status === states[variant],
        ).length;
  });
  const max = Math.max(1, ...series);
  const path = series
    .map(
      (value, i) =>
        `${i === 0 ? "M" : "L"}${i * 16} ${40 - (value / max) * 32}`,
    )
    .join(" ");
  return (
    <svg
      className="sparkline"
      viewBox="0 0 100 44"
      role="img"
      aria-label={`近七天本地记录回放：${series.join("、")}；不是市场行情`}
    >
      <title>近 7 天本地证据回放 · 非市场行情</title>
      <path d={`${path} L96 44 L0 44Z`} fill={color} opacity=".07" />
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}
export default function Dashboard({
  rows,
  store,
  query,
  watchOnly,
  now,
  onSelect,
  onWatch,
  onImport,
  onExport,
  onFilterQuery,
}: {
  rows: EventRow[];
  store: Store;
  query: string;
  watchOnly: boolean;
  now: number;
  onSelect: (id: string) => void;
  onWatch: (id: string) => void;
  onImport: () => void;
  onExport: () => void;
  onFilterQuery: (value: string) => void;
}) {
  const [status, setStatus] = useState<Status | "全部">("全部");
  const [category, setCategory] = useState("全部类型");
  const [sort, setSort] = useState("latest");
  const base = watchOnly
    ? rows.filter((r) => store.watchlist.includes(r.event.id))
    : rows;
  const filtered = base
    .filter(
      (r) =>
        (status === "全部" || r.conclusion.status === status) &&
        (category === "全部类型" || r.event.category === category) &&
        (!query ||
          `${r.event.title} ${r.event.company} ${r.event.ticker} ${r.event.tags.join(" ")}`
            .toLowerCase()
            .includes(query.toLowerCase())),
    )
    .sort((a, b) =>
      sort === "evidence"
        ? b.count - a.count
        : Date.parse(b.latest) - Date.parse(a.latest),
    );
  const conflicts = base.filter((r) => r.conclusion.status === "证据冲突");
  const pending = base.filter((r) => r.conclusion.status === "待核实");
  const confirmed = base.filter((r) => r.conclusion.status === "已证实");
  const attention = rows.filter((r) =>
    ["证据冲突", "待核实", "已否认"].includes(r.conclusion.status),
  );
  const allOrigins = new Set(store.evidence.map((e) => e.originId)).size;
  const factCount = store.evidence.filter((e) => e.kind === "事实").length;
  const watched = rows.filter((r) => store.watchlist.includes(r.event.id));
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span className="live-dot" />
            以事件为中心 · 让证据说话
          </div>
          <h1>
            {watchOnly ? (
              "重要的事，持续关注。"
            ) : (
              <>
                看清变化，<span>回到证据。</span>
              </>
            )}
          </h1>
          <p>
            {watchOnly
              ? `你正在关注 ${watched.length} 个事件，新的证据会在这里汇集。`
              : "从第一条消息到最新的事实，把碎片信息连接成完整判断。"}
          </p>
        </div>
        <div className="heading-actions">
          <button className="button" onClick={onExport}>
            <ArrowDownToLine size={15} />
            导出简报
          </button>
          <button className="button primary" onClick={onImport}>
            <Plus size={17} />
            导入情报
          </button>
        </div>
      </div>
      <div className="stats-grid">
        {[
          {
            label: "持续跟踪事件",
            value: base.length,
            caption: `${store.evidence.length} 条原始证据已归档`,
            icon: Layers3,
            color: "#507565",
          },
          {
            label: "等待进一步核实",
            value: pending.length,
            caption: "保持审慎，等待一手信源",
            icon: CircleHelp,
            color: "#7393a5",
          },
          {
            label: "需要关注的冲突",
            value: conflicts.length,
            caption: "不同证据存在相反陈述",
            icon: TriangleAlert,
            color: "#bf9252",
          },
          {
            label: "已证实事件",
            value: confirmed.length,
            caption: "仅确认原文所述事实",
            icon: CheckCheck,
            color: "#74966d",
          },
        ].map((s, i) => (
          <section className="stat-card" key={s.label}>
            <div className="row between">
              <span>{s.label}</span>
              <s.icon size={16} style={{ color: s.color }} />
            </div>
            <div className="stat-number-row">
              <strong>{String(s.value).padStart(2, "0")}</strong>
              <Sparkline
                color={s.color}
                variant={i}
                rows={base}
                store={store}
                now={now}
              />
            </div>
            <div className="stat-caption">
              <span className="mini-dot" style={{ background: s.color }} />
              {s.caption}
            </div>
          </section>
        ))}
      </div>
      <div className="workspace-grid">
        <section className="feed">
          <div className="section-heading">
            <h2>
              <span className="heading-mark" />
              {watchOnly ? "我的关注" : "事件情报"}
              <span className="count-badge">{base.length}</span>
            </h2>
            <span className="tiny muted">
              <span className="live-dot" />
              本地证据实时计算
            </span>
          </div>
          <div className="feed-controls">
            <div className="status-tabs">
              {(
                [
                  "全部",
                  "待核实",
                  "证据冲突",
                  "已证实",
                  "已否认",
                  "已过期",
                ] as const
              ).map((s) => (
                <button
                  key={s}
                  className={status === s ? "active" : ""}
                  onClick={() => setStatus(s)}
                >
                  {s}
                  {s === "证据冲突" && conflicts.length > 0 && <i />}
                </button>
              ))}
            </div>
            <div className="filter-row">
              <div className="select-wrap">
                <Filter size={13} />
                <select
                  aria-label="事件类型筛选"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option>全部类型</option>
                  {categories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
                <ChevronDown size={12} />
              </div>
              <div className="select-wrap">
                <select
                  aria-label="事件排序"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                >
                  <option value="latest">最近更新</option>
                  <option value="evidence">证据最多</option>
                </select>
                <ChevronDown size={12} />
              </div>
            </div>
          </div>
          {query && (
            <div className="query-result">
              <Search size={13} />“{query}” 的搜索结果
              <button onClick={() => onFilterQuery("")}>清除</button>
            </div>
          )}
          <div className="event-list">
            {filtered.map(({ event, conclusion: c, count, latest }) => (
              <article
                className={`event-card ${c.status === "证据冲突" ? "has-conflict" : ""}`}
                key={event.id}
              >
                <div className="row between">
                  <div className="row gap">
                    <span className={`company-avatar avatar-${event.category}`}>
                      {event.company.slice(0, 1)}
                    </span>
                    <span className="company-name">{event.company}</span>
                    <span className="ticker">{event.ticker}</span>
                    <span className="card-category">{event.category}</span>
                  </div>
                  <button
                    className={`icon-button bookmark-button ${store.watchlist.includes(event.id) ? "bookmarked" : ""}`}
                    onClick={() => onWatch(event.id)}
                    aria-label={`${store.watchlist.includes(event.id) ? "取消关注" : "关注"}${event.company}`}
                  >
                    <Bookmark
                      size={16}
                      fill={
                        store.watchlist.includes(event.id)
                          ? "currentColor"
                          : "none"
                      }
                    />
                  </button>
                </div>
                <button
                  className="event-title"
                  onClick={() => onSelect(event.id)}
                >
                  {event.title}
                  <ArrowUpRight size={17} />
                </button>
                <p className="event-summary">
                  {c.status === "证据冲突" && <TriangleAlert size={13} />}
                  {c.summary}
                </p>
                <div className="event-card-footer">
                  <div className="row gap">
                    <StatusBadge status={c.status} />
                    <span className="meta">
                      <FileText size={12} />
                      {count} 条证据
                    </span>
                    <span className="meta">
                      <GitBranch size={12} />
                      {c.independent} 个独立来源
                    </span>
                  </div>
                  <span className="update-time">
                    <Clock3 size={11} />
                    {relativeTime(latest, now)}
                  </span>
                </div>
              </article>
            ))}
          </div>
          {!filtered.length && (
            <Empty>
              <button
                className="button"
                onClick={() => {
                  setStatus("全部");
                  setCategory("全部类型");
                  onFilterQuery("");
                }}
              >
                清除筛选
              </button>
            </Empty>
          )}
          <div className="list-end">
            <span />
            已展示全部 {filtered.length} 个事件
            <span />
          </div>
        </section>
        <aside className="dashboard-aside">
          <section className="brief-card">
            <div className="brief-decoration">
              <i />
              <i />
              <i />
            </div>
            <div className="row between">
              <span className="row gap">
                <Sparkles size={16} />
                证据观察
              </span>
              <span className="brief-tag">规则摘要</span>
            </div>
            <h2>
              信息在变化，
              <br />
              判断要有依据。
            </h2>
            <p>
              当前有 <b>{attention.length}</b> 个事件需要留意。
              <br />
              先核对变化，再形成自己的判断。
            </p>
            <div className="brief-divider" />
            {attention.slice(0, 2).map((r) => (
              <button
                className="brief-item"
                key={r.event.id}
                onClick={() => onSelect(r.event.id)}
              >
                <span
                  className={`brief-dot ${r.conclusion.status === "证据冲突" ? "gold" : ""}`}
                />
                <span>
                  <strong>{r.event.company}</strong>
                  <small>
                    {r.conclusion.status === "证据冲突"
                      ? "原始公告与后续报道存在口径分歧"
                      : r.conclusion.status === "已否认"
                        ? "一手披露已对市场传闻作出回应"
                        : "缺少可核验的一手事实依据"}
                  </small>
                </span>
                <ArrowRight size={14} />
              </button>
            ))}
            <div className="brief-footnote">
              <ShieldCheck size={12} />
              基于已有证据，不构成投资建议
            </div>
          </section>
          <section className="panel health-panel">
            <div className="row between">
              <h3>
                <Activity size={16} />
                证据健康度
              </h3>
              <span className="tiny muted">当前快照</span>
            </div>
            <div className="health-main">
              <strong>
                {store.evidence.length}
                <small>条</small>
              </strong>
              <span>
                归档证据
                <br />
                <b>{allOrigins} 个原始来源链</b>
              </span>
              <div
                className="health-ring"
                style={
                  {
                    "--ratio": `${Math.round((factCount / Math.max(1, store.evidence.length)) * 100)}%`,
                  } as React.CSSProperties
                }
              >
                <ShieldCheck size={19} />
              </div>
            </div>
            <div className="health-bar">
              {["事实", "观点", "推测", "传闻"].map((kind) => (
                <span
                  key={kind}
                  className={`bar-${kind}`}
                  style={{
                    flex:
                      store.evidence.filter((e) => e.kind === kind).length ||
                      0.01,
                  }}
                />
              ))}
            </div>
            <div className="health-legend">
              {["事实", "观点", "推测", "传闻"].map((kind) => (
                <span key={kind}>
                  <i className={`bar-${kind}`} />
                  {kind}
                  <b>{store.evidence.filter((e) => e.kind === kind).length}</b>
                </span>
              ))}
            </div>
            <p className="health-note">
              事实属性不等于已核实，仍需检查来源与冲突。
            </p>
          </section>
          <section className="panel watch-panel">
            <div className="row between">
              <h3>
                <Bookmark size={15} />
                我的关注
              </h3>
              <span className="count-badge">{watched.length}</span>
            </div>
            {watched.slice(0, 4).map((r) => (
              <button
                className="watch-row"
                key={r.event.id}
                onClick={() => onSelect(r.event.id)}
              >
                <span className="company-mini">
                  {r.event.company.slice(0, 1)}
                </span>
                <span>
                  <strong>{r.event.company}</strong>
                  <small>
                    {r.event.category} · {r.count} 条证据
                  </small>
                </span>
                <span className={`status-dot dot-${r.conclusion.status}`} />
                <ArrowUpRight size={13} />
              </button>
            ))}
            {!watched.length && (
              <p className="muted tiny">点击事件卡片上的书签开始关注。</p>
            )}
          </section>
          <div className="data-caption">
            <Radio size={14} />
            <p>
              <b>透明，比完整更重要</b>
              <br />
              当前为虚构示例数据，未接入实时市场。
              <br />
              缺失、冲突与过期都会被如实呈现。
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
