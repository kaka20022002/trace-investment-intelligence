import { useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileUp,
  GitMerge,
  Info,
  LoaderCircle,
  Plus,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import {
  actions,
  categories,
  ExtractionSchema,
  kinds,
  sourceTypes,
  type Evidence,
  type Extraction,
  type InvestmentEvent,
  type Store,
} from "./model";
import {
  duplicateOf,
  extractLocally,
  matchEvents,
  validateEvidence,
} from "./engine";
import { importExample } from "./seed";
import { Modal } from "./ui";

function localDate(value: number) {
  const d = new Date(value);
  return new Date(value - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
export default function ImportModal({
  store,
  mode,
  initialEventId,
  onClose,
  onSave,
}: {
  store: Store;
  mode: "rules" | "model";
  initialEventId?: string;
  onClose: () => void;
  onSave: (event: InvestmentEvent | null, evidence: Evidence) => void;
}) {
  const [step, setStep] = useState(1);
  const [content, setContent] = useState("");
  const [source, setSource] = useState("");
  const [sourceType, setSourceType] =
    useState<Evidence["sourceType"]>("财经媒体");
  const [sourceUrl, setSourceUrl] = useState("");
  const [published, setPublished] = useState(localDate(Date.now() - 300000));
  const [occurred, setOccurred] = useState("");
  const [expires, setExpires] = useState(localDate(Date.now() + 7 * 86400000));
  const [verified, setVerified] = useState(false);
  const [demo, setDemo] = useState(false);
  const [origin, setOrigin] = useState("");
  const [supersedes, setSupersedes] = useState("");
  const [target, setTarget] = useState(initialEventId ?? "new");
  const [extraction, setExtraction] = useState<Extraction | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [method, setMethod] = useState("本地规则提取");
  const [notice, setNotice] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const candidates = useMemo(
    () => (extraction ? matchEvents(extraction, store.events) : []),
    [extraction, store.events],
  );
  const versions = store.evidence.filter(
    (e) => e.eventId === target && e.source === source.trim(),
  );
  function sample() {
    setContent(importExample);
    setSource("澜芯科技公告（模拟）");
    setSourceType("公司公告");
    setDemo(true);
    setVerified(true);
    setSourceUrl("");
    setOrigin("event-2-澜芯科技公告");
    setOccurred("");
    setError("");
  }
  async function analyze() {
    setError("");
    setNotice("");
    if (content.trim().length < 10)
      return setError("请至少输入 10 个字符的原文。");
    if (!source.trim() || !published)
      return setError("请补充来源名称与披露时间。");
    if (Date.parse(published) > Date.now())
      return setError("披露时间不能位于未来。");
    const duplicate = duplicateOf(store.evidence, content);
    if (duplicate)
      return setError(
        `这条原文已在证据库中（${duplicate.id}），不会重复计入。`,
      );
    setLoading(true);
    let result = extractLocally(content, store.events);
    setMethod("本地规则提取");
    if (mode === "model") {
      try {
        const response = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content,
            events: store.events
              .slice(0, 100)
              .map(({ company, category, topic, title }) => ({
                company,
                category,
                topic,
                title,
              })),
          }),
          signal: AbortSignal.timeout(25000),
        });
        if (!response.ok) throw new Error("模型请求失败");
        const json = await response.json();
        const parsed = ExtractionSchema.parse(json.extraction);
        if (!content.includes(parsed.quote))
          throw new Error("引用未通过原文校验");
        result = parsed;
        setMethod("AI 辅助提取 · 原文引用已校验");
      } catch {
        setNotice(
          "模型接口不可用或结果未通过校验，已明确回退到本地规则。请逐项人工确认，未生成任何已核实结论。",
        );
      }
    }
    const matches = matchEvents(result, store.events);
    setTarget(
      matches.some((m) => m.event.id === initialEventId)
        ? initialEventId!
        : (matches[0]?.event.id ?? "new"),
    );
    setExtraction(result);
    setStep(2);
    setLoading(false);
  }
  function save() {
    if (!extraction) return;
    setError("");
    try {
      const fields = ExtractionSchema.parse(extraction);
      if (fields.company === "待补充主体")
        throw new Error("请填写实际事件主体。");
      if (target !== "new" && !candidates.some((c) => c.event.id === target))
        throw new Error("主体或事项已改变，请重新选择匹配事件或新建事件。");
      const now = new Date().toISOString();
      const eventId =
        target === "new" ? `event-${crypto.randomUUID()}` : target;
      const event: InvestmentEvent | null =
        target === "new"
          ? {
              id: eventId,
              title: fields.title,
              company: fields.company,
              ticker: "",
              category: fields.category,
              topic: fields.topic,
              tags: ["手动导入"],
              createdAt: now,
            }
          : null;
      const old = store.evidence.find((e) => e.id === supersedes);
      const evidence = validateEvidence(
        {
          id: `ev-${crypto.randomUUID()}`,
          eventId,
          source: source.trim(),
          sourceType,
          sourceUrl: sourceUrl.trim(),
          content: content.trim(),
          title: fields.title,
          quote: fields.quote,
          kind: fields.kind,
          action: fields.action,
          occurredAt: occurred ? new Date(occurred).toISOString() : null,
          publishedAt: new Date(published).toISOString(),
          fetchedAt: now,
          updatedAt: now,
          expiresAt: expires ? new Date(expires).toISOString() : null,
          supersedes: supersedes || null,
          originId: origin.trim() || old?.originId || `source:${source.trim()}`,
          verified,
          demo,
        },
        store.evidence,
      );
      onSave(event, evidence);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message.startsWith("[")
            ? "字段格式不完整，请检查标题、主体、事项键与引用。"
            : e.message
          : "导入失败，请检查字段。",
      );
    }
  }
  function update<K extends keyof Extraction>(key: K, value: Extraction[K]) {
    setExtraction((prev) => (prev ? { ...prev, [key]: value } : prev));
  }
  return (
    <Modal
      wide
      title="导入一条情报"
      subtitle="保留原文，让每一条新信息都能找到自己的位置。"
      onClose={onClose}
    >
      <div className="import-steps">
        <span className={step >= 1 ? "active" : ""}>
          <i>{step > 1 ? <Check size={12} /> : "1"}</i>提供原始信息
        </span>
        <div />
        <span className={step >= 2 ? "active" : ""}>
          <i>2</i>确认提取与归并
        </span>
        <div />
        <span>
          <i>3</i>更新事件判断
        </span>
      </div>
      <div className="import-body">
        {step === 1 ? (
          <>
            <div className="row between">
              <label htmlFor="import-content" className="field-label">
                情报原文 <b>*</b>
              </label>
              <button className="text-button tiny" onClick={sample}>
                <Sparkles size={13} />
                填入演示案例
              </button>
            </div>
            <textarea
              id="import-content"
              className="content-input"
              value={content}
              maxLength={20000}
              onChange={(e) => {
                setContent(e.target.value);
              }}
              placeholder="粘贴公司公告、财经报道、研究观点或待核实传闻……&#10;&#10;请保留原始措辞、金额单位与统计口径，不要只填写一句结论。"
            />
            <div className="row between import-text-footer">
              <button
                className="text-button tiny"
                onClick={() => fileRef.current?.click()}
              >
                <FileUp size={14} />从 TXT / Markdown 导入
              </button>
              <span className="tiny muted">
                {content.length.toLocaleString()} / 20,000
              </span>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".txt,.md,text/plain,text/markdown"
              hidden
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 100000) {
                  setError("文件过大，请选择 100KB 以内的文本。");
                  return;
                }
                try {
                  setContent((await file.text()).slice(0, 20000));
                  setDemo(false);
                  setVerified(false);
                } catch {
                  setError("无法读取文件，请尝试粘贴原文。");
                }
              }}
            />
            {demo && (
              <div className="notice subtle">
                <Info size={15} />
                <span>当前为虚构演示素材，保存后仍会标记为“虚构示例”。</span>
              </div>
            )}
            <div className="form-grid">
              <label>
                来源名称 <b>*</b>
                <input
                  value={source}
                  maxLength={100}
                  onChange={(e) => setSource(e.target.value)}
                  placeholder="如：公司官网公告 / 某财经媒体"
                />
              </label>
              <label>
                来源类型
                <select
                  value={sourceType}
                  onChange={(e) =>
                    setSourceType(e.target.value as Evidence["sourceType"])
                  }
                >
                  {sourceTypes.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label className="span-2">
                原文链接
                <input
                  type="url"
                  value={sourceUrl}
                  maxLength={2000}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  placeholder="https://…（缺失时会明确提醒，不会伪造链接）"
                />
              </label>
              <label>
                披露时间 <b>*</b>
                <input
                  type="datetime-local"
                  value={published}
                  onChange={(e) => setPublished(e.target.value)}
                />
              </label>
              <label>
                事件发生时间
                <input
                  type="datetime-local"
                  value={occurred}
                  onChange={(e) => setOccurred(e.target.value)}
                />
              </label>
              <label>
                证据有效期至
                <input
                  type="datetime-local"
                  value={expires}
                  onChange={(e) => setExpires(e.target.value)}
                />
              </label>
              <label>
                原始来源链标识
                <input
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  placeholder="转载请填与原文相同的标识"
                  maxLength={200}
                />
              </label>
            </div>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={verified}
                onChange={(e) => setVerified(e.target.checked)}
              />
              我已人工核验来源身份与原文一致性<span>仅为导入者声明</span>
            </label>
            <div className="notice subtle">
              <Info size={15} />
              <span>
                发生时间未知可以留空；披露、抓取与更新时间分别记录。所有时间按本地时区输入。不抓取任意
                URL，也不因来源名称自动判定可信。
              </span>
            </div>
          </>
        ) : (
          extraction && (
            <>
              <div className="extraction-mode">
                <Sparkles size={16} />
                <strong>{method}</strong>
                <span>提取结果需要你确认</span>
              </div>
              {notice && (
                <div className="notice warning">
                  <TriangleAlert size={16} />
                  <span>{notice}</span>
                </div>
              )}
              <div className="form-grid">
                <label>
                  事件主体
                  <input
                    value={extraction.company}
                    maxLength={60}
                    onChange={(e) => update("company", e.target.value)}
                  />
                </label>
                <label>
                  事件类型
                  <select
                    value={extraction.category}
                    onChange={(e) =>
                      update(
                        "category",
                        e.target.value as Extraction["category"],
                      )
                    }
                  >
                    {categories.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <label className="span-2">
                  事件 / 证据标题
                  <input
                    value={extraction.title}
                    maxLength={160}
                    onChange={(e) => update("title", e.target.value)}
                  />
                </label>
                <label className="span-2">
                  事项键 <small>区分同一公司不同事项，归并前请核对</small>
                  <input
                    value={extraction.topic}
                    maxLength={80}
                    onChange={(e) => update("topic", e.target.value)}
                  />
                </label>
                <label>
                  陈述属性
                  <select
                    value={extraction.kind}
                    onChange={(e) =>
                      update("kind", e.target.value as Extraction["kind"])
                    }
                  >
                    {kinds.map((k) => (
                      <option key={k}>{k}</option>
                    ))}
                  </select>
                </label>
                <label>
                  证据作用
                  <select
                    value={extraction.action}
                    onChange={(e) =>
                      update("action", e.target.value as Extraction["action"])
                    }
                  >
                    {actions.map((a) => (
                      <option key={a}>{a}</option>
                    ))}
                  </select>
                </label>
                <label className="span-2">
                  可追溯引用 <small>必须逐字存在于原文</small>
                  <textarea
                    rows={3}
                    value={extraction.quote}
                    maxLength={2000}
                    onChange={(e) => update("quote", e.target.value)}
                  />
                </label>
              </div>
              <h4 className="merge-heading">
                <GitMerge size={16} />
                选择事件归属<span>匹配分是规则相似度，不是概率</span>
              </h4>
              <div className="merge-candidates">
                {candidates.map(({ event, score, reason }) => (
                  <label
                    className={`merge-option ${target === event.id ? "selected" : ""}`}
                    key={event.id}
                  >
                    <input
                      type="radio"
                      name="merge-target"
                      checked={target === event.id}
                      onChange={() => {
                        setTarget(event.id);
                        setSupersedes("");
                      }}
                    />
                    <div>
                      <strong>{event.title}</strong>
                      <small>{reason}</small>
                    </div>
                    <span>{score} 分</span>
                  </label>
                ))}
                <label
                  className={`merge-option ${target === "new" ? "selected" : ""}`}
                >
                  <input
                    type="radio"
                    name="merge-target"
                    checked={target === "new"}
                    onChange={() => {
                      setTarget("new");
                      setSupersedes("");
                    }}
                  />
                  <Plus size={16} />
                  <div>
                    <strong>作为新事件创建</strong>
                    <small>主体相同也不一定是同一个事件，避免错误归并。</small>
                  </div>
                </label>
              </div>
              {target !== "new" && (
                <label className="version-field">
                  明确替代的前版本（可选）
                  <select
                    value={supersedes}
                    onChange={(e) => setSupersedes(e.target.value)}
                  >
                    <option value="">不替代 · 作为独立证据加入对照</option>
                    {versions.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.title}
                      </option>
                    ))}
                  </select>
                  <small>
                    仅允许同一来源的更正、更新或否认替代旧版本；其他来源的冲突材料保持独立。
                  </small>
                </label>
              )}
              <div className="notice subtle">
                <Info size={15} />
                <span>
                  保存后会重新计算结论。标记“事实”不等于证实，低权重、未核验与已过期材料不会自动升级为结论。
                </span>
              </div>
            </>
          )
        )}
        {error && (
          <div className="form-error" role="alert">
            <TriangleAlert size={16} />
            {error}
          </div>
        )}
      </div>
      <footer className="modal-footer">
        <span className="tiny muted">
          {step === 1
            ? "你的原文仅保存在本机；启用模型后会发送至配置的模型服务。"
            : "人工确认后入库 · 原文与版本记录完整保留"}
        </span>
        <div className="row gap">
          {step === 2 && (
            <button
              className="button"
              onClick={() => {
                setStep(1);
                setError("");
              }}
            >
              <ArrowLeft size={15} />
              上一步
            </button>
          )}
          <button
            className="button primary"
            disabled={loading}
            onClick={step === 1 ? analyze : save}
          >
            {loading ? (
              <LoaderCircle size={16} className="spin" />
            ) : step === 1 ? (
              <Sparkles size={16} />
            ) : (
              <Check size={16} />
            )}
            {loading
              ? "正在提取…"
              : step === 1
                ? "提取并匹配事件"
                : "确认归并并更新"}
            {!loading && <ArrowRight size={15} />}
          </button>
        </div>
      </footer>
    </Modal>
  );
}
