import React, { useState, useRef, useEffect } from 'react';
import { Search, Bell, Minus, Plus, ArrowLeft, Upload, MessageSquare, Settings as SettingsIcon, X } from 'lucide-react';
import { TabContext } from '../../App';
import { ProjectItem } from '../project/ProjectList';
import { ActivityItem } from '../../types';

interface AppHeaderProps {
  activeModule: 'overview' | 'projects' | 'gis' | 'settings';
  selectedProject: ProjectItem | null;
  activeTab: TabContext;
  setActiveTab: (t: TabContext) => void;
  onBackToProjectList: () => void;
  activities: ActivityItem[];
  globalSearch: string;
  setGlobalSearch: (s: string) => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
}

const activityIcon = (type: ActivityItem['type']) => {
  switch (type) {
    case 'upload': return <Upload size={13} className="text-primary" />;
    case 'comment': return <MessageSquare size={13} className="text-tertiary" />;
    case 'approve': return <Bell size={13} className="text-success" />;
    case 'clash': return <Bell size={13} className="text-error" />;
    default: return <SettingsIcon size={13} className="text-outline" />;
  }
};

export function AppHeader({
  activeModule,
  selectedProject,
  activeTab,
  setActiveTab,
  onBackToProjectList,
  activities,
  globalSearch,
  setGlobalSearch,
  onZoomIn,
  onZoomOut,
}: AppHeaderProps) {
  const isViewer = activeModule === 'projects' && selectedProject !== null && activeTab === 'viewer';
  const showTabs = activeModule === 'projects' && selectedProject !== null;

  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  // Close notification dropdown on outside click
  useEffect(() => {
    if (!notifOpen) return;
    const onClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [notifOpen]);

  const getHeaderTitle = () => {
    switch (activeModule) {
      case 'overview':
        return 'Cổng Thông tin Tổng quan CDE';
      case 'gis':
        return 'Bản đồ số Quy hoạch GeoBIM / GIS';
      case 'settings':
        return 'Cấu hình Hệ thống';
      case 'projects':
        return selectedProject ? selectedProject.name : 'Danh sách Dự án CDE';
      default:
        return 'CDE CIC';
    }
  };

  // Header search is meaningful for the documents context inside a project
  const searchEnabled = showTabs;

  return (
    <header className="bg-surface-container-lowest border-b border-outline-variant shrink-0 z-40 relative shadow-sm">
      {/* Top Application Context Row */}
      <div className="flex justify-between items-center px-6 h-14">
        {/* Context Identity */}
        <div className="flex items-center gap-3 min-w-0">
          {activeModule === 'projects' && selectedProject !== null && (
            <button
              onClick={onBackToProjectList}
              className="flex items-center gap-1 px-2.5 py-1.5 hover:bg-surface-container rounded-lg text-on-surface-variant hover:text-primary transition-colors font-bold text-xs shrink-0 cursor-pointer border border-outline-variant/60 bg-surface"
              title="Quay lại danh sách dự án"
            >
              <ArrowLeft size={14} />
              Quay lại
            </button>
          )}
          <h1 className="text-[20px] md:text-[22px] font-bold tracking-tight text-on-surface truncate">
            {getHeaderTitle()}
          </h1>

          {isViewer && (
            <div className="flex items-center gap-2 mt-0.5 shrink-0">
              <span className="text-on-surface-variant font-mono text-[13px] hidden sm:inline">FPT-ARCH-v12.ifc</span>
              <span className="bg-surface-variant text-on-surface-variant px-2 py-0.5 rounded-full font-mono text-[11px] border border-outline-variant">v1.2.4</span>
            </div>
          )}
        </div>

        {/* Global/Contextual Actions */}
        <div className="flex items-center gap-4">
          {isViewer ? (
            <div className="flex items-center bg-surface-container-low rounded-lg border border-outline-variant p-0.5 shadow-sm">
              <button
                onClick={onZoomOut}
                className="p-1 text-on-surface-variant hover:bg-surface-variant hover:text-on-surface rounded transition-colors cursor-pointer"
                title="Thu nhỏ mô hình"
              >
                <Minus size={16} />
              </button>
              <span className="w-12 text-center font-mono text-xs text-on-surface-variant border-x border-outline-variant">Zoom</span>
              <button
                onClick={onZoomIn}
                className="p-1 text-on-surface-variant hover:bg-surface-variant hover:text-on-surface rounded transition-colors cursor-pointer"
                title="Phóng to mô hình"
              >
                <Plus size={16} />
              </button>
            </div>
          ) : (
            <div className="relative w-64 hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-outline" size={16} />
              <input
                type="text"
                value={globalSearch}
                onChange={(e) => {
                  setGlobalSearch(e.target.value);
                  if (e.target.value && showTabs && activeTab !== 'documents') setActiveTab('documents');
                }}
                disabled={!searchEnabled}
                placeholder={searchEnabled ? 'Tìm kiếm mã, tài liệu...' : 'Mở một dự án để tìm kiếm'}
                className="w-full pl-9 pr-8 py-1.5 bg-surface-container border border-outline-variant/60 rounded-md text-[13px] focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-outline disabled:opacity-60 disabled:cursor-not-allowed"
              />
              {globalSearch ? (
                <button
                  onClick={() => setGlobalSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface"
                  title="Xóa tìm kiếm"
                >
                  <X size={14} />
                </button>
              ) : (
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                  <span className="px-1 py-0.5 bg-surface border border-outline-variant/60 rounded text-[9px] font-mono text-outline">Ctrl K</span>
                </div>
              )}
            </div>
          )}

          {/* Notification Bell + dropdown */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setNotifOpen(o => !o)}
              className="relative p-2 text-on-surface-variant hover:bg-surface-container-high rounded-full transition-colors active:scale-95 focus:outline-none cursor-pointer"
              title="Thông báo"
            >
              <Bell size={20} />
              {activities.length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-error rounded-full border border-surface-container-lowest"></span>
              )}
            </button>
            {notifOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-2xl z-50 animate-in fade-in slide-in-from-top-1 duration-150 overflow-hidden">
                <div className="px-4 py-3 border-b border-outline-variant flex items-center justify-between">
                  <span className="font-bold text-[13px] text-on-surface">Thông báo & Hoạt động</span>
                  <span className="text-[10px] font-bold text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full">{activities.length}</span>
                </div>
                <div className="max-h-80 overflow-y-auto custom-scrollbar">
                  {activities.length === 0 ? (
                    <div className="px-4 py-8 text-center text-on-surface-variant text-xs">Chưa có hoạt động nào.</div>
                  ) : (
                    activities.slice(0, 12).map(act => (
                      <div key={act.id} className="px-4 py-2.5 flex gap-2.5 hover:bg-surface-container/50 border-b border-outline-variant/20 last:border-0">
                        <div className="w-6 h-6 rounded-full bg-surface-container flex items-center justify-center shrink-0 mt-0.5">
                          {activityIcon(act.type)}
                        </div>
                        <div className="min-w-0">
                          <div className="text-[12px] text-on-surface leading-snug">
                            <span className="font-semibold">{act.user}</span> {act.action} <span className="font-semibold text-primary">{act.target}</span>
                          </div>
                          <div className="text-[10px] text-outline font-mono mt-0.5">{act.time}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {isViewer && (
            <div className="h-6 w-px bg-outline-variant mx-1 hidden md:block"></div>
          )}

          {isViewer && (
             <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-[13px] border border-primary-fixed-dim cursor-pointer shadow-sm">
                 AD
             </div>
          )}
        </div>
      </div>

      {/* Embedded Horizontal Tab Navigation */}
      {showTabs && (
        <div className="flex px-6 gap-6 xl:gap-8 pt-1">
          {([
            { id: 'dashboard', label: 'Bảng điều khiển' },
            { id: 'documents', label: 'Tài liệu' },
            { id: 'viewer', label: 'Mô hình 3D' },
            { id: 'schedule', label: 'Tiến độ & Chi phí' },
            { id: 'fm', label: 'Vận hành (FM)' }
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabContext)}
              className={`pb-2.5 font-semibold text-[14px] transition-colors relative whitespace-nowrap focus:outline-none cursor-pointer ${
                activeTab === tab.id
                  ? 'text-primary'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                 <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-sm" />
              )}
              {activeTab !== tab.id && (
                 <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-transparent" />
              )}
            </button>
          ))}
        </div>
      )}
    </header>
  );
}
