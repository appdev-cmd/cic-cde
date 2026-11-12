import { useId, useState, useSyncExternalStore, type MouseEvent, type ReactNode } from "react";
import { PanelLeftClose, PanelLeftOpen, type LucideIcon } from "lucide-react";
import "./projects.css";

const sidebarPreference = "ciccde.sidebar";
const narrowSidebar = window.matchMedia("(max-width: 1080px)");

function subscribeToSidebarWidth(onChange: () => void) {
  narrowSidebar.addEventListener("change", onChange);
  return () => narrowSidebar.removeEventListener("change", onChange);
}

function isNarrowSidebar() {
  return narrowSidebar.matches;
}

type SidebarLink = {
  id: string;
  label: string;
  mobileLabel?: string;
  href: string;
  icon: LucideIcon;
  pinToBottom?: boolean;
};

export default function WorkspaceLayout({ label, links, current, onSelect, children }: {
  label: string;
  links: readonly SidebarLink[];
  current: string;
  onSelect?: (event: MouseEvent<HTMLAnchorElement>) => void;
  children: ReactNode;
}) {
  const [sidebarMode, setSidebarMode] = useState(() => localStorage.getItem(sidebarPreference));
  const narrow = useSyncExternalStore(subscribeToSidebarWidth, isNarrowSidebar);
  const compact = sidebarMode === "compact" || (sidebarMode !== "expanded" && narrow);
  const sidebarId = useId();
  const toggleLabel = compact ? "Mở rộng sidebar" : "Thu gọn sidebar";

  function toggleSidebar() {
    const next = compact ? "expanded" : "compact";
    setSidebarMode(next);
    localStorage.setItem(sidebarPreference, next);
  }

  return (
    <div className="directory-layout" data-sidebar={compact ? "compact" : "expanded"}>
      <aside className="directory-sidebar">
        <div className="directory-sidebar-panel">
          <nav id={sidebarId} aria-label={label}>
            {links.map(({ id, label, mobileLabel, href, icon: Icon, pinToBottom }) => (
              <a key={id} href={href} aria-label={label}
                className={pinToBottom ? "directory-nav-bottom" : undefined}
                aria-current={current === id ? "page" : undefined} onClick={onSelect}>
                <span className="directory-nav-icon"><Icon size={19} aria-hidden="true" /></span>
                <span className="directory-nav-text" aria-hidden="true">
                  <span className={mobileLabel ? "directory-nav-desktop-label" : undefined}>{label}</span>
                  {mobileLabel && <span className="directory-nav-mobile-label">{mobileLabel}</span>}
                </span>
              </a>
            ))}
          </nav>
          <button className="directory-sidebar-toggle" type="button" aria-label={toggleLabel}
            aria-controls={sidebarId} aria-expanded={!compact} onClick={toggleSidebar}>
            <span className="directory-nav-icon">
              {compact ? <PanelLeftOpen size={19} aria-hidden="true" /> : <PanelLeftClose size={19} aria-hidden="true" />}
            </span>
            <span className="directory-nav-text" aria-hidden="true">{compact ? toggleLabel : "Thu gọn"}</span>
          </button>
        </div>
      </aside>
      {children}
    </div>
  );
}
