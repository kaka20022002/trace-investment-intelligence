import { useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Bookmark,
  CheckCheck,
  Clock3,
  FileText,
  GitBranch,
  Link2,
  Plus,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { conclude, weight } from "./engine";
import { formatTime } from "./storage";
import type { Evidence, InvestmentEvent, Store } from "./model";
import { Empty, KindBadge, Modal, StatusBadge, statusClass } from "./ui";

export function EvidenceDrawer({
  evidence: e,
  all,
  onClose,
}: {
  evidence: Evidence;
  all: Evidence[];
  onClose: () => void;
}) {
  const old = all.find((x) => x.id === e.supersedes);
  const newer = all.find((x) => x.supersedes === e.id);
  return (
    <Modal
      drawer
      title="原始证据"
      subtitle={`证据编号 ${e.id}`}
      onClose={onClose}
    >
      <div className="drawer-body">
        <div className="row gap">
          <KindBadge kind={e.kind} />
          <span className="chip">{e.action}</span>
          {e.demo && <span className="demo-tag">虚构示例</span>}
        </div>
        <h3 className="evidence-title">{e.title}</h3>
        <div className="source-line">
          <FileText size={15} />
          {e.source}
          <span>·</span>
          {e.sourceType}
        </div>
        <section className="quote-box">
          <span className="eyebrow">结论所引用的原文</span>
          <blockquote>“{e.quote}”</blockquote>
        </section>
        <h4>完整原文</h4>
        <p className="original-text">{e.content}</p>
        <div className="evidence-meta">
          <h4>
            四类时间 <span>浏览器本地时区</span>
          </h4>
          {[
            ["事件发生", e.occurredAt],
            ["信息披露", e.publishedAt],
            ["系统抓取", e.fetchedAt],
            ["最后更新", e.updatedAt],
            ["有效期至", e.expiresAt],
          ].map(([label, time]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{formatTime(time)}</strong>
            </div>
          ))}
        </div>
        <section className="weight-explain">
          <div className="row between">
            <h4>证据权重</h4>
            <strong>
              {weight(e)}
              <small> / 100</small>
            </strong>
          </div>
          <div className="progress">
            <i style={{ width: `${weight(e)}%` }} />
          </div>
          <p>
            来源等级 × 陈述属性 × 核验系数。不是事实概率，也不是投资置信度。
          </p>
          <div className="row gap">
            <ShieldCheck size={15} />
            {e.verified
              ? e.demo
                ? "模拟来源已核验（仅供演示）"
                : "导入者声明已人工核验"
              : "来源身份未核验"}
          </div>
        </section>
        <div className="origin-info">
          <Link2 size={16} />
          <div>
            <strong>原始来源链</strong>
            <code>{e.originId}</code>
            <p>相同来源链的转载只计为一个独立来源。</p>
          </div>
        </div>
        {(old || newer) && (
          <div className="notice">
            <GitBranch size={17} />
            <span>
              {old
                ? `本证据更正或替代「${old.title}」。旧原文完整保留。`
                : `本版本已由「${newer?.title}」替代，不再参与当前判断。`}
            </span>
          </div>
        )}
        {e.sourceUrl ? (
          <a
            className="button primary full"
            href={e.sourceUrl}
            target="_blank"
            rel="noreferrer"
          >
            访问原始来源
            <ArrowUpRight size={16} />
          </a>
        ) : (
          <div className="notice subtle">
            <FileText size={17} />
            <span>
              {e.demo
                ? "这是一条虚构示例，没有真实外部链接。展示内容仅用于验证产品逻辑。"
                : "未提供原文链接。请补充可核验来源，当前仅可追溯到导入文本。"}
            </span>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default function Detail({
  event,
  store,
  now,
  onBack,
  onWatch,
  onImport,
  onEvidence,
}: {
  event: InvestmentEvent;
  store: Store;
  now: number;
  onBack: () => void;
  onWatch: (id: string) => void;
  onImport: () => void;
  onEvidence: (e: Evidence) => void;
}) {
  const [tab, setTab] = useState<"时间线" | "证据对照">("时间线");
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  const c = conclude(event.id, store.evidence, now);
  const evidence = store.evidence
    .filter((e) => e.eventId === event.id)
    .sort(
      (a, b) =>
        (Date.parse(a.publishedAt) - Date.parse(b.publishedAt)) *
        (order === "asc" ? 1 : -1),
    );
  const isWatched = store.watchlist.includes(event.id);
  return (
    <>
      <button className="text-button back" onClick={onBack}>
        <ArrowLeft size={16} />
        返回情报工作台
      </button>
      <div className="detail-heading">
        <div>
          <div className="row gap">
            <span className="eyebrow">EVENT INTELLIGENCE</span>
            <span className="chip">{event.category}</span>
          </div>
          <h1>{event.title}</h1>
          <div className="row gap muted">
            <span className="company-mini">{event.company.slice(0, 1)}</span>
            {event.company}
            <span className="mono">{event.ticker}</span>
            {event.tags.map((t) => (
              <span className="tag" key={t}>
                {t}
              </span>
            ))}
          </div>
        </div>
        <button
          className={`button ${isWatched ? "watch-active" : ""}`}
          onClick={() => onWatch(event.id)}
        >
          <Bookmark size={16} fill={isWatched ? "currentColor" : "none"} />
          {isWatched ? "已关注" : "关注事件"}
        </button>
      </div>
      <section
        className={`conclusion-card conclusion-${statusClass[c.status]}`}
      >
        <div className="row between">
          <div className="row gap">
            <ShieldCheck size={20} />
            <h3>当前判断</h3>
            <StatusBadge status={c.status} />
          </div>
          <span className="tiny muted">随有效证据重新计算</span>
        </div>
        <p>{c.summary}</p>
        <div className="row between wrap">
          <div className="row gap">
            <span className="tiny muted">依据</span>
            {c.references.map((id, i) => (
              <button
                className="reference"
                key={id}
                onClick={() =>
                  onEvidence(store.evidence.find((e) => e.id === id)!)
                }
              >
                <FileText size={12} />
                证据 {i + 1}
              </button>
            ))}
          </div>
          <span className="tiny muted">
            {c.independent} 个独立来源 · {c.active.length} 条有效证据
          </span>
        </div>
        {c.warnings.length > 0 && (
          <div className="conclusion-warnings">
            <TriangleAlert size={13} />
            {c.warnings.join(" · ")}
          </div>
        )}
      </section>
      <div className="detail-grid">
        <section className="panel timeline-panel">
          <div className="panel-toolbar">
            <div className="tabs">
              {(["时间线", "证据对照"] as const).map((t) => (
                <button
                  className={tab === t ? "active" : ""}
                  onClick={() => setTab(t)}
                  key={t}
                >
                  {t === "时间线" ? (
                    <GitBranch size={16} />
                  ) : (
                    <CheckCheck size={16} />
                  )}
                  {t}
                </button>
              ))}
            </div>
            <select
              aria-label="时间线排序"
              value={order}
              onChange={(e) => setOrder(e.target.value as "asc" | "desc")}
            >
              <option value="asc">最早披露优先</option>
              <option value="desc">最新披露优先</option>
            </select>
          </div>
          {tab === "时间线" ? (
            <div className="timeline">
              <div className="timeline-caption">
                <Clock3 size={13} />
                按披露时间还原演化，抓取顺序不改变判断
              </div>
              {!evidence.length && <Empty title="尚无证据" />}
              {evidence.map((e, index) => {
                const expired = c.expired.includes(e.id),
                  superseded = c.superseded.includes(e.id);
                return (
                  <article
                    className={`timeline-item ${expired || superseded ? "inactive-evidence" : ""}`}
                    key={e.id}
                  >
                    <div
                      className={`timeline-dot ${e.action === "否认" ? "red" : e.kind === "事实" ? "green" : "gray"}`}
                    >
                      <FileText size={13} />
                    </div>
                    <div className="timeline-time">
                      {formatTime(e.publishedAt)}
                      {(order === "asc"
                        ? index === 0
                        : index === evidence.length - 1) && (
                        <span>最初来源</span>
                      )}
                    </div>
                    <div className="timeline-card">
                      <div className="row between">
                        <div className="row gap">
                          <KindBadge kind={e.kind} />
                          <span
                            className={`action-label ${e.action === "否认" ? "red-text" : ""}`}
                          >
                            {e.action}
                          </span>
                          {superseded && <span className="tag">已被替代</span>}
                          {expired && <span className="tag">已过期</span>}
                        </div>
                        <span className="weight-mini">
                          权重 <b>{weight(e)}</b>
                        </span>
                      </div>
                      <button
                        className="evidence-title-button"
                        onClick={() => onEvidence(e)}
                      >
                        {e.title}
                      </button>
                      <p>{e.quote}</p>
                      <div className="row between">
                        <span className="source-line">
                          <FileText size={12} />
                          {e.source}
                        </span>
                        <button
                          className="text-button tiny"
                          onClick={() => onEvidence(e)}
                        >
                          查看原文与时间
                          <ArrowUpRight size={13} />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="comparison">
              <div className="notice">
                <TriangleAlert size={16} />
                <span>
                  先比较事实范围、时点和口径。不同来源不因“更新”而自动覆盖，需有明确更正关系。
                </span>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>来源 / 披露</th>
                      <th>属性与作用</th>
                      <th>原文陈述</th>
                      <th>有效性</th>
                    </tr>
                  </thead>
                  <tbody>
                    {evidence.map((e) => (
                      <tr key={e.id}>
                        <td>
                          <button
                            className="text-button"
                            onClick={() => onEvidence(e)}
                          >
                            {e.source}
                          </button>
                          <small>{formatTime(e.publishedAt)}</small>
                        </td>
                        <td>
                          <KindBadge kind={e.kind} />
                          <small>
                            {e.action} · 权重 {weight(e)}
                          </small>
                        </td>
                        <td>{e.quote}</td>
                        <td>
                          <span className="tag">
                            {c.superseded.includes(e.id)
                              ? "已替代"
                              : c.expired.includes(e.id)
                                ? "已过期"
                                : "有效"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
        <aside className="detail-aside">
          <section className="panel info-panel">
            <h3>事件档案</h3>
            <dl>
              <dt>关联主体</dt>
              <dd>{event.company}</dd>
              <dt>标的标识</dt>
              <dd className="mono">
                {event.ticker || "未提供"}
                {event.ticker.startsWith("SIM") && (
                  <small>虚构标识，非证券代码</small>
                )}
              </dd>
              <dt>事项键</dt>
              <dd>{event.topic}</dd>
              <dt>首次追踪</dt>
              <dd>{formatTime(event.createdAt)}</dd>
              <dt>证据总量</dt>
              <dd>
                {evidence.length} 条 / {c.independent} 个有效独立来源
              </dd>
            </dl>
            <button className="button primary full" onClick={onImport}>
              <Plus size={16} />
              添加新证据
            </button>
          </section>
          <section className="panel info-panel">
            <h3>
              <GitBranch size={16} />
              如何理解这条时间线
            </h3>
            <ul className="guide-list">
              <li>
                <i />
                原文永远保留，更新不抹去历史。
              </li>
              <li>
                <i />
                观点与传闻不升级为事实。
              </li>
              <li>
                <i />
                同源转载不重复增加权重。
              </li>
              <li>
                <i />
                过期、更正会改变当前结论。
              </li>
            </ul>
          </section>
          <div className="compliance-note">
            <ShieldCheck size={17} />
            <p>这里呈现信息证据，不提供买卖建议、价格预测或收益承诺。</p>
          </div>
        </aside>
      </div>
    </>
  );
}
