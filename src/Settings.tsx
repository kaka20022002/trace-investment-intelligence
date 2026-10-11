import { useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Braces,
  CheckCircle2,
  Database,
  ExternalLink,
  Info,
  LockKeyhole,
  RefreshCw,
  Server,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { Store } from "./model";
import { validateStore } from "./engine";
import { download } from "./storage";
import { Modal } from "./ui";

export type Health = {
  mode: "rules" | "model";
  model?: string;
  reachable: boolean;
};
export default function Settings({
  store,
  health,
  onRestore,
  onReset,
  onNotify,
  onRefresh,
}: {
  store: Store;
  health: Health;
  onRestore: (s: Store) => void;
  onReset: () => void;
  onNotify: (s: string) => void;
  onRefresh: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [reset, setReset] = useState(false);
  const [pending, setPending] = useState<Store | null>(null);
  const [error, setError] = useState("");
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">WORKSPACE SETTINGS</div>
          <h1>
            能力有边界，<span>数据要透明。</span>
          </h1>
          <p>了解信息从哪里来、由谁处理，以及你的记录保存在哪里。</p>
        </div>
        <button className="button" onClick={onRefresh}>
          <RefreshCw size={15} />
          检查连接
        </button>
      </div>
      <div className="settings-grid">
        <section className="panel settings-card">
          <div className="settings-icon">
            <Sparkles size={22} />
          </div>
          <div className="row between">
            <h2>智能提取</h2>
            <span
              className={`status-badge ${health.mode === "model" ? "green" : "gray"}`}
            >
              {health.mode === "model" ? "模型已配置" : "规则模式"}
            </span>
          </div>
          <p>
            AI
            用于提取主体、事项、陈述属性和原文引用，不负责裁定真假或给出投资建议。
          </p>
          <div className="settings-detail">
            <span>当前引擎</span>
            <strong>
              {health.mode === "model" ? health.model : "可解释本地规则"}
            </strong>
            <span>服务连接</span>
            <strong>
              {health.reachable
                ? "同源后端可访问"
                : "后端未连接 · 规则主链路可用"}
            </strong>
            <span>核验机制</span>
            <strong>字段校验 + 原文逐字匹配 + 人工确认</strong>
          </div>
          <div className="notice subtle">
            <LockKeyhole size={16} />
            <span>
              模型 API Key
              只在服务端环境变量中配置。规则模式原文不离开浏览器；模型模式会将原文发送至配置的模型服务。
            </span>
          </div>
        </section>
        <section className="panel settings-card">
          <div className="settings-icon blue-bg">
            <Database size={22} />
          </div>
          <h2>数据源连接</h2>
          <p>
            当前版本不伪装已接入真实金融服务。所有预置公司与事件均为虚构，标识
            SIM 不是证券代码。
          </p>
          {[
            {
              name: "扶摇金融数据",
              text: "行情、财务与市场数据",
              url: "https://fuyao.aicubes.cn/docs/",
            },
            {
              name: "iFinD MCP",
              text: "市场新闻与跨市场数据",
              url: "https://mcp.51ifind.com/",
            },
          ].map((s) => (
            <div className="data-source-row" key={s.name}>
              <span className="source-icon">
                <Server size={17} />
              </span>
              <div>
                <strong>{s.name}</strong>
                <small>{s.text}</small>
              </div>
              <span className="tag">未接入</span>
              <a
                aria-label={`查看${s.name}文档`}
                href={s.url}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink size={14} />
              </a>
            </div>
          ))}
          <div className="notice subtle">
            <Info size={16} />
            <span>
              支持手动导入和逐条核验。真实接口需合法授权，调用失败时不得生成正常市场结论。
            </span>
          </div>
        </section>
        <section className="panel settings-card">
          <div className="settings-icon">
            <Braces size={22} />
          </div>
          <h2>记录与备份</h2>
          <p>
            记录保存在本浏览器，不上传到云端。清除浏览器数据或更换设备会丢失记录，请及时导出。
          </p>
          <div className="backup-stats">
            <span>
              <b>{store.events.length}</b>事件
            </span>
            <span>
              <b>{store.evidence.length}</b>证据
            </span>
            <span>
              <b>{store.watchlist.length}</b>关注
            </span>
          </div>
          <div className="row gap wrap">
            <button
              className="button"
              onClick={() => {
                download(
                  `trace-backup-${new Date().toISOString().slice(0, 10)}.json`,
                  JSON.stringify(store, null, 2),
                );
                onNotify("JSON 备份已导出");
              }}
            >
              <ArrowDownToLine size={15} />
              导出完整备份
            </button>
            <button className="button" onClick={() => input.current?.click()}>
              <ArrowUpFromLine size={15} />
              恢复备份
            </button>
          </div>
          <input
            type="file"
            ref={input}
            accept=".json,application/json"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setError("");
              try {
                if (f.size > 10000000)
                  throw new Error("备份文件超过 10MB 限制。");
                setPending(validateStore(JSON.parse(await f.text())));
              } catch (err) {
                setError(
                  err instanceof Error && !err.message.startsWith("[")
                    ? err.message
                    : "备份结构或证据字段校验失败。原记录未修改。",
                );
              }
              e.target.value = "";
            }}
          />
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <button
            className="text-button danger reset-link"
            onClick={() => setReset(true)}
          >
            <RefreshCw size={13} />
            重置为初始演示数据
          </button>
        </section>
        <section className="panel settings-card">
          <div className="settings-icon gold-bg">
            <ShieldCheck size={22} />
          </div>
          <h2>使用边界</h2>
          <ul className="boundary-list">
            <li>
              <CheckCircle2 size={16} />
              结论可以回到原文与四类时间。
            </li>
            <li>
              <CheckCircle2 size={16} />
              证据权重是规则评分，不是事实概率。
            </li>
            <li>
              <CheckCircle2 size={16} />
              来源“已核验”为导入者声明，不是外部认证。
            </li>
            <li>
              <CheckCircle2 size={16} />
              不输出买卖建议、涨跌预测或收益承诺。
            </li>
            <li>
              <CheckCircle2 size={16} />
              请勿导入个人隐私、API Key 或受限材料。
            </li>
          </ul>
          <div className="notice subtle">
            <ShieldCheck size={16} />
            <span>
              产品用于信息研究，不替代独立核验。数据缺失、冲突与过期将明确显示。
            </span>
          </div>
        </section>
      </div>
      {reset && (
        <Modal title="重置演示数据？" onClose={() => setReset(false)}>
          <div className="confirm-body">
            <p>
              这会清除当前浏览器中的导入记录与关注，替换为初始虚构案例。建议先导出完整备份。
            </p>
            <button
              className="button"
              onClick={() =>
                download(
                  "trace-before-reset.json",
                  JSON.stringify(store, null, 2),
                )
              }
            >
              <ArrowDownToLine size={15} />
              先导出备份
            </button>
          </div>
          <div className="modal-footer">
            <button className="button" onClick={() => setReset(false)}>
              取消
            </button>
            <button
              className="button danger-button"
              onClick={() => {
                onReset();
                setReset(false);
              }}
            >
              确认重置
            </button>
          </div>
        </Modal>
      )}
      {pending && (
        <Modal
          title="恢复备份并替换当前记录？"
          onClose={() => setPending(null)}
        >
          <div className="confirm-body">
            <p>
              已通过结构与证据校验。将恢复 {pending.events.length} 个事件和{" "}
              {pending.evidence.length} 条证据，覆盖当前记录。
            </p>
            <button
              className="button"
              onClick={() =>
                download(
                  "trace-before-restore.json",
                  JSON.stringify(store, null, 2),
                )
              }
            >
              <ArrowDownToLine size={15} />
              先备份当前记录
            </button>
          </div>
          <div className="modal-footer">
            <button className="button" onClick={() => setPending(null)}>
              取消
            </button>
            <button
              className="button primary"
              onClick={() => {
                onRestore(pending);
                setPending(null);
              }}
            >
              确认恢复
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
