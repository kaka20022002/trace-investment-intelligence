import { useEffect, useRef, type ReactNode } from "react";
import {
  X,
  Check,
  AlertTriangle,
  Clock3,
  CircleHelp,
  CircleOff,
} from "lucide-react";
import type { Status, Evidence } from "./model";

export const statusClass: Record<Status, string> = {
  已证实: "green",
  证据冲突: "orange",
  已否认: "red",
  待核实: "blue",
  已过期: "gray",
};
export function StatusBadge({ status }: { status: Status }) {
  const Icon = {
    已证实: Check,
    证据冲突: AlertTriangle,
    已否认: CircleOff,
    待核实: CircleHelp,
    已过期: Clock3,
  }[status];
  return (
    <span className={`status-badge ${statusClass[status]}`}>
      <Icon size={12} />
      {status}
    </span>
  );
}
export function KindBadge({ kind }: { kind: Evidence["kind"] }) {
  return <span className={`kind-badge kind-${kind}`}>{kind}</span>;
}
export function Empty({
  title = "还没有符合条件的事件",
  text = "试试调整筛选条件，或导入一条新的情报。",
  children,
}: {
  title?: string;
  text?: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <CircleHelp size={28} />
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
      {children}
    </div>
  );
}
export function Modal({
  title,
  subtitle,
  onClose,
  children,
  wide = false,
  drawer = false,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  drawer?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "modal-wide" : ""} ${drawer ? "drawer" : ""}`}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="modal-inner">
        <header className="modal-header">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="icon-button" onClick={onClose} aria-label="关闭">
            <X size={20} />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
