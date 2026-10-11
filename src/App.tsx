import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  Bell,
  Bookmark,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Command,
  Database,
  LayoutDashboard,
  Menu,
  Search,
  Settings2,
  ShieldCheck,
  X,
} from "lucide-react";
import type { Evidence, InvestmentEvent } from "./model";
import { conclude, validateStore } from "./engine";
import { createSeed } from "./seed";
import {
  download,
  formatTime,
  loadStore,
  saveStore,
  StorageConflictError,
  STORAGE_KEY,
} from "./storage";
import Dashboard, { makeRows } from "./Dashboard";
import Detail, { EvidenceDrawer } from "./Detail";
import ImportModal from "./ImportModal";
import Library from "./Library";
import Settings, { type Health } from "./Settings";
import { Modal, StatusBadge } from "./ui";

type Page = "dashboard" | "watchlist" | "library" | "settings";
const nav = [
  { id: "dashboard", label: "情报工作台", icon: LayoutDashboard },
  { id: "watchlist", label: "我的关注", icon: Bookmark },
  { id: "library", label: "证据资料库", icon: Database },
  { id: "settings", label: "数据与设置", icon: Settings2 },
] as const;
function readStoredData() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}
export default function App() {
  const [initial] = useState(() => ({ ...loadStore(), raw: readStoredData() }));
  const persisted = useRef(initial.raw);
  const [store, setStore] = useState(initial.store);
  const [storageError, setStorageError] = useState(initial.error);
  const [blockedSave, setBlockedSave] = useState(!!initial.error);
  const [page, setPage] = useState<Page>("dashboard");
  const [eventId, setEventId] = useState<string | null>(() =>
    window.location.hash.startsWith("#event/")
      ? decodeURIComponent(window.location.hash.slice(7))
      : null,
  );
  const [query, setQuery] = useState("");
  const [now, setNow] = useState(Date.now());
  const [health, setHealth] = useState<Health>({
    mode: "rules",
    reachable: false,
  });
  const [showImport, setShowImport] = useState(false);
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [help, setHelp] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [toast, setToast] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const refreshHealth = useCallback(async () => {
    try {
      const res = await fetch("/api/health", {
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) throw new Error("unreachable");
      const json = await res.json();
      setHealth({
        mode: json.mode === "model" ? "model" : "rules",
        model: typeof json.model === "string" ? json.model : undefined,
        reachable: true,
      });
    } catch {
      setHealth({ mode: "rules", reachable: false });
    }
  }, []);
  useEffect(() => {
    void refreshHealth();
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, [refreshHealth]);
  useEffect(() => {
    if (blockedSave || (store === initial.store && initial.raw !== null))
      return;
    let cancelled = false;
    const write = () => {
      if (cancelled) return;
      try {
        persisted.current = saveStore(store, persisted.current);
        setStorageError(null);
      } catch (error) {
        if (error instanceof StorageConflictError) {
          setBlockedSave(true);
          setStorageError(error.message);
        } else
          setStorageError(
            "保存失败：浏览器存储不可用或空间已满。当前更改仅在内存中，请到「数据与设置」导出备份。",
          );
      }
    };
    if (navigator.locks)
      void navigator.locks.request(STORAGE_KEY, write).catch(() => {
        if (!cancelled)
          setStorageError("无法获得安全写入锁，当前草稿未保存，请导出备份。");
      });
    else write();
    return () => {
      cancelled = true;
    };
  }, [store, blockedSave]);
  useEffect(() => {
    const changed = (event: StorageEvent) => {
      if (
        (event.key === STORAGE_KEY || event.key === null) &&
        readStoredData() !== persisted.current
      ) {
        setBlockedSave(true);
        setStorageError(new StorageConflictError().message);
      }
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const onHash = () => {
      setEventId(
        window.location.hash.startsWith("#event/")
          ? decodeURIComponent(window.location.hash.slice(7))
          : null,
      );
      window.scrollTo(0, 0);
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("hashchange", onHash);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("hashchange", onHash);
      window.removeEventListener("keydown", onKey);
    };
  }, []);
  const rows = useMemo(() => makeRows(store, now), [store, now]);
  const selectedEvent = store.events.find((e) => e.id === eventId);
  const attention = rows.filter((r) =>
    ["证据冲突", "已否认", "已过期"].includes(r.conclusion.status),
  );
  function selectEvent(id: string) {
    window.location.hash = `event/${id}`;
    setEventId(id);
    window.scrollTo(0, 0);
  }
  function navigate(next: Page) {
    setPage(next);
    setEventId(null);
    setQuery("");
    setMobileNav(false);
    window.history.replaceState(null, "", window.location.pathname);
    window.scrollTo(0, 0);
  }
  function toggleWatch(id: string) {
    const watching = store.watchlist.includes(id);
    setStore((prev) => ({
      ...prev,
      watchlist: watching
        ? prev.watchlist.filter((x) => x !== id)
        : [...prev.watchlist, id],
    }));
    setToast(watching ? "已取消关注" : "已加入关注，后续证据将在关注页汇集");
  }
  function unlockStorage() {
    persisted.current = readStoredData();
    setBlockedSave(false);
  }
  function importEvidence(event: InvestmentEvent | null, item: Evidence) {
    if (store.evidence.length >= 5000 || (event && store.events.length >= 500))
      throw new Error(
        "已达到本地记录容量上限（500 个事件 / 5000 条证据），请先导出备份并归档后再导入。",
      );
    const oldStatus = conclude(item.eventId, store.evidence, Date.now()).status;
    const next = validateStore({
      ...store,
      events: event ? [...store.events, event] : store.events,
      evidence: [...store.evidence, item],
    });
    setStore(next);
    setNow(Date.now());
    setShowImport(false);
    selectEvent(item.eventId);
    const nextStatus = conclude(item.eventId, next.evidence, Date.now()).status;
    setToast(
      `证据已入库${oldStatus !== nextStatus ? ` · ${oldStatus} → ${nextStatus}` : " · 当前判断已重新计算"}`,
    );
  }
  function exportBrief() {
    const text =
      `# 溯知 Trace｜事件证据简报\n\n生成时间：${formatTime(new Date().toISOString())}\n\n> 数据含虚构演示案例。非实时金融资讯，不构成投资建议。证据权重不是概率。\n\n` +
      rows
        .map(
          (r) =>
            `## ${r.event.title}\n\n- 主体：${r.event.company}（${r.event.ticker || "未提供代码"}）\n- 当前状态：${r.conclusion.status}\n- 判断：${r.conclusion.summary}\n- 有效独立来源：${r.conclusion.independent}\n- 风险提示：${r.conclusion.warnings.join("；") || "无额外提示"}\n\n### 证据引用\n\n` +
            store.evidence
              .filter((e) => r.conclusion.references.includes(e.id))
              .map(
                (e) =>
                  `- [${e.id}] ${e.source}；属性 ${e.kind}；${e.demo ? "虚构示例" : "手动导入"}\n  - 原文：“${e.quote}”\n  - 来源链接：${e.sourceUrl || "未提供"}\n  - 发生：${formatTime(e.occurredAt)}；披露：${formatTime(e.publishedAt)}；抓取：${formatTime(e.fetchedAt)}；更新：${formatTime(e.updatedAt)}\n`,
              )
              .join("\n"),
        )
        .join("\n---\n\n");
    download(
      `trace-brief-${new Date().toISOString().slice(0, 10)}.md`,
      text,
      "text/markdown;charset=utf-8",
    );
    setToast("含原文引用与时间的简报已导出");
  }
  return (
    <div className="app-shell">
      {mobileNav && (
        <div className="nav-scrim" onClick={() => setMobileNav(false)} />
      )}
      <aside className={`sidebar ${mobileNav ? "mobile-open" : ""}`}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("dashboard");
          }}
        >
          <span className="brand-symbol">
            <svg viewBox="0 0 36 36" fill="none">
              <path
                d="M9 8h19L10 27h17M9 17h12"
                stroke="currentColor"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="28" cy="27" r="2" fill="#d8c78b" />
            </svg>
          </span>
          <span>
            溯知<span className="brand-en">TRACE</span>
          </span>
        </a>
        <div className="workspace-label">
          <span className="workspace-avatar">研</span>
          <div>
            <strong>个人研究空间</strong>
            <span>PERSONAL WORKSPACE</span>
          </div>
          <ChevronDown size={13} />
        </div>
        <div className="nav-section-label">工作空间</div>
        <nav>
          {nav.map((item) => (
            <button
              key={item.id}
              className={page === item.id ? "nav-item active" : "nav-item"}
              onClick={() => navigate(item.id)}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
              {item.id === "watchlist" ? (
                <span className="nav-count">{store.watchlist.length}</span>
              ) : (
                item.id === "dashboard" && <span className="nav-active-dot" />
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <section className="sidebar-note">
            <div className="note-mark">
              <GitBranchIcon />
            </div>
            <span className="eyebrow">STAY CURIOUS. VERIFY.</span>
            <h3>
              研究有据，
              <br />
              决策有界。
            </h3>
            <p>
              在噪声中找到线索，
              <br />
              在证据中建立判断。
            </p>
            <button onClick={() => setHelp(true)}>
              了解溯知的方法
              <ArrowUpRight size={14} />
            </button>
          </section>
          <button className="nav-item help-link" onClick={() => setHelp(true)}>
            <CircleHelp size={17} />
            <span>使用指南</span>
            <ArrowUpRight size={13} />
          </button>
          <div className="profile">
            <span className="profile-avatar">K</span>
            <div>
              <strong>研究员</strong>
              <small>本地演示空间</small>
            </div>
            <span className="local-dot" />
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="row gap">
            <button
              className="icon-button mobile-menu"
              aria-label="打开导航"
              onClick={() => setMobileNav(true)}
            >
              <Menu size={21} />
            </button>
            <span className="breadcrumb-root">工作空间</span>
            <ChevronRight size={13} />
            <span className="breadcrumb-current">
              {selectedEvent
                ? "事件详情"
                : nav.find((n) => n.id === page)?.label}
            </span>
          </div>
          <div className="topbar-right">
            <div className="global-search">
              <Search size={15} />
              <input
                ref={searchRef}
                aria-label="搜索事件或标的"
                placeholder={
                  page === "library"
                    ? "搜索原文、来源…"
                    : "搜索事件、公司或标的…"
                }
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  if (selectedEvent) {
                    setEventId(null);
                    setPage("dashboard");
                    window.history.replaceState(
                      null,
                      "",
                      window.location.pathname,
                    );
                  }
                }}
              />
              <kbd>
                <Command size={10} /> K
              </kbd>
              {query && (
                <button
                  className="icon-button"
                  aria-label="清除搜索"
                  onClick={() => setQuery("")}
                >
                  <X size={12} />
                </button>
              )}
            </div>
            <span className="workspace-pill">
              <span />
              演示工作区
            </span>
            <button
              className="notification-button icon-button"
              aria-label="查看事件提醒"
              onClick={() => setNotifications(true)}
            >
              <Bell size={18} />
              {attention.length > 0 && <i />}
            </button>
            <div className="topbar-avatar">K</div>
          </div>
        </header>
        <main className="main-content">
          {storageError && (
            <div className="storage-error" role="alert">
              {storageError}
              <button onClick={() => navigate("settings")}>备份草稿</button>
              <button onClick={() => window.location.reload()}>
                加载最新记录
              </button>
            </div>
          )}
          {eventId && !selectedEvent && (
            <div className="notice warning">
              指定事件不存在，请从工作台重新选择。
            </div>
          )}
          {selectedEvent ? (
            <Detail
              key={selectedEvent.id}
              event={selectedEvent}
              store={store}
              now={now}
              onBack={() => navigate("dashboard")}
              onWatch={toggleWatch}
              onImport={() => setShowImport(true)}
              onEvidence={setEvidence}
            />
          ) : page === "dashboard" || page === "watchlist" ? (
            <Dashboard
              key={page}
              rows={rows}
              store={store}
              now={now}
              query={query}
              watchOnly={page === "watchlist"}
              onSelect={selectEvent}
              onWatch={toggleWatch}
              onImport={() => setShowImport(true)}
              onExport={exportBrief}
              onFilterQuery={setQuery}
            />
          ) : page === "library" ? (
            <Library store={store} query={query} onEvidence={setEvidence} />
          ) : (
            <Settings
              store={store}
              health={health}
              onNotify={setToast}
              onRefresh={() => {
                void refreshHealth();
                setToast("正在检查同源模型服务");
              }}
              onRestore={(s) => {
                setStore(s);
                unlockStorage();
                setToast("备份已恢复");
              }}
              onReset={() => {
                setStore(createSeed());
                unlockStorage();
                setNow(Date.now());
                setToast("已恢复初始演示数据");
              }}
            />
          )}
          <footer className="page-footer">
            <span>
              <ShieldCheck size={12} />
              仅用于信息研究，不构成投资建议
            </span>
            <span>TRACE · 让每一个判断都有迹可循</span>
            <span className="engine-label">
              <span />
              {health.mode === "model" ? "AI 辅助提取" : "本地规则引擎"}
              <span className="footer-divider">/</span>虚构示例 + 手动导入
            </span>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
        </div>
      )}
      {showImport && (
        <ImportModal
          store={store}
          mode={health.mode}
          initialEventId={selectedEvent?.id}
          onClose={() => setShowImport(false)}
          onSave={importEvidence}
        />
      )}
      {evidence && (
        <EvidenceDrawer
          evidence={evidence}
          all={store.evidence}
          onClose={() => setEvidence(null)}
        />
      )}
      {help && (
        <Modal
          title="从信息，到有依据的判断"
          subtitle="溯知 Trace · 使用指南"
          onClose={() => setHelp(false)}
        >
          <div className="help-body">
            <div className="help-intro">
              <BookOpen size={28} />
              <p>
                不是让 AI 替你下结论，
                <br />
                <strong>而是让你看见结论背后的每一步。</strong>
              </p>
            </div>
            {[
              {
                n: "01",
                title: "先看事件，而不是孤立的新闻",
                text: "工作台按同一主体、同一类型、同一事项组织信息。搜索或筛选感兴趣的事件，点击标题查看详情。",
              },
              {
                n: "02",
                title: "沿时间线回到最初来源",
                text: "时间线按披露时间排列。点击任意证据，可查看原文、四类时间、来源链与权重计算依据。",
              },
              {
                n: "03",
                title: "导入新信息，让判断随证据变化",
                text: "点击导入情报，可直接填入虚构案例。确认提取字段与事件归属，选择需要更正的前版本后保存。",
              },
              {
                n: "04",
                title: "区分“说了什么”与“证明了什么”",
                text: "事实、观点、推测、传闻分别标记。未核验来源不能证实事件，冲突保持可见，过期撤回结论。",
              },
            ].map((s) => (
              <div className="help-step" key={s.n}>
                <span>{s.n}</span>
                <div>
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                </div>
              </div>
            ))}
            <div className="notice subtle">
              <ShieldCheck size={16} />
              <span>
                所有预置数据均为虚构。图表只反映本地记录，不包含真实行情。模型未配置时不会伪装
                AI 结果。
              </span>
            </div>
          </div>
        </Modal>
      )}
      {notifications && (
        <Modal
          title="事件提醒"
          subtitle="来自当前证据快照，非后台推送"
          onClose={() => setNotifications(false)}
        >
          <div className="notifications-body">
            {attention.map((r) => (
              <button
                className="notification-row"
                key={r.event.id}
                onClick={() => {
                  setNotifications(false);
                  selectEvent(r.event.id);
                }}
              >
                <div className="row between">
                  <strong>{r.event.company}</strong>
                  <StatusBadge status={r.conclusion.status} />
                </div>
                <p>{r.conclusion.summary}</p>
                <span>
                  查看证据变化
                  <ArrowUpRight size={12} />
                </span>
              </button>
            ))}
            {!attention.length && (
              <p className="muted">暂时没有冲突、否认或过期提醒。</p>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
function GitBranchIcon() {
  return (
    <svg
      width="68"
      height="58"
      viewBox="0 0 68 58"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M15 10v25c0 9 7 13 18 13h20M15 30c0-13 33 0 33-17"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="15" cy="9" r="5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="49" cy="8" r="5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="57" cy="48" r="5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
