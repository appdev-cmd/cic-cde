import React from 'react';
import { Building2, LayoutDashboard, Folder, Map, Settings, Sun, Moon } from 'lucide-react';

interface SidebarProps {
  activeModule: 'overview' | 'projects' | 'gis' | 'settings';
  setActiveModule: (module: 'overview' | 'projects' | 'gis' | 'settings') => void;
  isCollapsed: boolean;
  darkMode: boolean;
  toggleTheme: () => void;
}

export function Sidebar({ activeModule, setActiveModule, isCollapsed, darkMode, toggleTheme }: SidebarProps) {
  const itemClasses = (active: boolean) => 
    `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors font-medium text-[15px] cursor-pointer ${
      active 
        ? 'bg-primary-container/20 text-primary border-l-2 border-primary font-bold' 
        : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface border-l-2 border-transparent'
    }`;

  const iconClasses = (active: boolean) => 
    `${active ? 'text-primary' : 'text-outline group-hover:text-on-surface transition-colors'}`;

  return (
    <aside 
      className={`${
        isCollapsed ? 'w-16 items-center' : 'w-[260px]'
      } bg-surface-container-lowest border-r border-outline-variant flex flex-col shrink-0 transition-all duration-300 z-50`}
    >
      <div className={`h-14 flex items-center ${isCollapsed ? 'justify-center w-full' : 'px-4'} border-b border-outline-variant shrink-0`}>
        <div className="p-1.5 rounded-md text-primary">
          <Building2 size={24} strokeWidth={2.5} />
        </div>
        {!isCollapsed && <span className="ml-2 font-bold text-primary text-xl tracking-tight leading-none pt-1">CDE CIC</span>}
      </div>

      <nav className={`flex-1 py-4 flex flex-col gap-1 overflow-hidden ${isCollapsed ? 'px-2' : 'px-3'}`}>
        <div 
          onClick={() => setActiveModule('overview')}
          className={`group ${itemClasses(activeModule === 'overview')} ${isCollapsed ? 'justify-center !px-2' : ''}`} 
          title="Tổng quan"
        >
          <LayoutDashboard size={20} className={iconClasses(activeModule === 'overview')} />
          {!isCollapsed && <span>Tổng quan</span>}
        </div>
        <div 
          onClick={() => setActiveModule('projects')}
          className={`group ${itemClasses(activeModule === 'projects')} ${isCollapsed ? 'justify-center !px-2' : ''}`} 
          title="Dự án"
        >
          <Folder size={20} className={iconClasses(activeModule === 'projects')} fill={activeModule === 'projects' ? 'currentColor' : 'none'} fillOpacity={0.2} />
          {!isCollapsed && <span>Dự án</span>}
        </div>
        <div 
          onClick={() => setActiveModule('gis')}
          className={`group ${itemClasses(activeModule === 'gis')} ${isCollapsed ? 'justify-center !px-2' : ''}`} 
          title="GIS/GeoBIM"
        >
          <Map size={20} className={iconClasses(activeModule === 'gis')} />
          {!isCollapsed && <span>GIS/GeoBIM</span>}
        </div>
      </nav>

      <div className="p-3 border-t border-outline-variant flex flex-col gap-1">
        {/* Light/Dark theme toggle control */}
        {isCollapsed ? (
          <div 
            onClick={toggleTheme}
            className="group flex items-center justify-center py-2.5 rounded-lg hover:bg-surface-container-low text-outline hover:text-on-surface cursor-pointer transition-colors" 
            title={darkMode ? "Chế độ Sáng" : "Chế độ Tối"}
          >
            {darkMode ? <Sun size={20} className="text-amber-500 animate-in spin duration-300" /> : <Moon size={20} />}
          </div>
        ) : (
          <div 
            onClick={toggleTheme}
            className="flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer hover:bg-surface-container-low text-on-surface-variant hover:text-on-surface transition-colors"
            title={darkMode ? "Chuyển sang giao diện Sáng" : "Chuyển sang giao diện Tối"}
          >
            <div className="flex items-center gap-3">
              {darkMode ? <Sun size={20} className="text-amber-500" /> : <Moon size={20} className="text-outline" />}
              <span className="text-[14px] font-semibold">Giao diện tối</span>
            </div>
            <div className={`w-8 h-[18px] rounded-full p-0.5 transition-colors duration-200 ${darkMode ? 'bg-primary' : 'bg-outline-variant/60'}`}>
              <div className={`w-3.5 h-3.5 rounded-full bg-white transition-transform duration-200 ${darkMode ? 'translate-x-3.5' : 'translate-x-0'}`} />
            </div>
          </div>
        )}

        <div 
          onClick={() => setActiveModule('settings')}
          className={`group ${itemClasses(activeModule === 'settings')} ${isCollapsed ? 'justify-center !px-2' : ''}`} 
          title="Cài đặt"
        >
          <Settings size={20} className={iconClasses(activeModule === 'settings')} />
          {!isCollapsed && <span>Cài đặt</span>}
        </div>
        {!isCollapsed && (
          <div className="mt-2 flex items-center gap-3 px-2 py-2 hover:bg-surface-container rounded-lg cursor-pointer transition-colors">
             <div className="w-8 h-8 shrink-0 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-xs">
                AD
             </div>
             <div className="min-w-0">
                <div className="font-semibold text-sm truncate text-on-surface">Admin User</div>
                <div className="font-mono text-[10px] text-on-surface-variant truncate">BIM Manager</div>
             </div>
          </div>
        )}
      </div>
    </aside>
  );
}

