import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export default function AccessDialog({
  title,
  className,
  onClose,
  closeDisabled = false,
  children,
}: {
  title: string;
  className: string;
  onClose: () => void;
  closeDisabled?: boolean;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const close = () => {
    dialog.current?.close();
    onClose();
  };

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    element.showModal();
    return () => element.close();
  }, []);

  return (
    <dialog
      ref={dialog}
      className={`cde-card access-dialog ${className}`}
      aria-labelledby={titleId}
      onKeyDown={(event) => {
        event.stopPropagation();
      }}
      onCancel={(event) => {
        event.preventDefault();
        if (!closeDisabled) close();
      }}
    >
      <div className="access-dialog-heading">
        <h2 id={titleId}>{title}</h2>
        <button className="icon-button" aria-label="Đóng" disabled={closeDisabled} onClick={close}>
          <X size={18} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
