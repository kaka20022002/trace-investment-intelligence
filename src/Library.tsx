import { useState } from "react";
import { ArrowUpRight, Database, FileText, Filter, Link2 } from "lucide-react";
import type { Evidence, Store } from "./model";
import { sourceTypes } from "./model";
import { weight } from "./engine";
import { formatTime } from "./storage";
import { Empty, KindBadge } from "./ui";

export default function Library({
  store,
  query,
  onEvidence,
}: {
  store: Store;
  query: string;
  onEvidence: (e: Evidence) => void;
}) {
  const [source, setSource] = useState("全部来源");
  const [kind, setKind] = useState("全部属性");
  const evidence = store.evidence
    .filter(
      (e) =>
        (source === "全部来源" || e.sourceType === source) &&
        (kind === "全部属性" || e.kind === kind) &&
        `${e.title}${e.content}${e.source}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">EVIDENCE LIBRARY</div>
          <h1>
            每一份证据，<span>有源可溯。</span>
          </h1>
          <p>保留完整原文、来源与版本。事实、观点和不确定信息分别呈现。</p>
        </div>
        <div className="library-count">
          <Database size={22} />
          <strong>{store.evidence.length}</strong>
          <span>条归档证据</span>
        </div>
      </div>
      <section className="panel">
        <div className="panel-toolbar">
          <h3>
            <FileText size={16} />
            原始证据库<span className="count-badge">{evidence.length}</span>
          </h3>
          <div className="row gap">
            <Filter size={14} />
            <select
              aria-label="证据来源筛选"
              value={source}
              onChange={(e) => setSource(e.target.value)}
            >
              <option>全部来源</option>
              {sourceTypes.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <select
              aria-label="证据属性筛选"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              {["全部属性", "事实", "观点", "推测", "传闻"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="table-scroll">
          <table className="library-table">
            <thead>
              <tr>
                <th>证据原文 / 关联事件</th>
                <th>来源</th>
                <th>属性</th>
                <th>权重</th>
                <th>披露时间</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {evidence.map((e) => (
                <tr key={e.id}>
                  <td>
                    <button
                      className="library-title"
                      onClick={() => onEvidence(e)}
                    >
                      {e.title}
                    </button>
                    <small>
                      <Link2 size={11} />
                      {
                        store.events.find((event) => event.id === e.eventId)
                          ?.company
                      }{" "}
                      · {e.demo ? "虚构示例" : "手动导入"}
                    </small>
                  </td>
                  <td>
                    {e.source}
                    <small>{e.sourceType}</small>
                  </td>
                  <td>
                    <KindBadge kind={e.kind} />
                  </td>
                  <td>
                    <span className="table-weight">{weight(e)}</span>
                  </td>
                  <td className="nowrap muted">
                    {formatTime(e.publishedAt, true)}
                  </td>
                  <td>
                    <button
                      className="icon-button"
                      aria-label={`查看${e.title}`}
                      onClick={() => onEvidence(e)}
                    >
                      <ArrowUpRight size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!evidence.length && (
          <Empty
            title="没有匹配的证据"
            text="请调整来源、属性筛选或搜索关键词。"
          />
        )}
      </section>
    </>
  );
}
