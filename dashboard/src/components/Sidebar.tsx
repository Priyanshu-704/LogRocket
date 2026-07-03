"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, AlertCircle, Settings, LogOut, Code2, ShieldAlert } from 'lucide-react';

interface SidebarProps {
  projectId?: string;
  projectName?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ projectId, projectName }) => {
  const pathname = usePathname();
  const { user, logout, isDemoMode } = useAuth();

  const isLinkActive = (path: string) => {
    return pathname === path;
  };

  const navItems = projectId ? [
    {
      name: 'Overview',
      path: `/projects/${projectId}`,
      icon: LayoutDashboard
    },
    {
      name: 'Issues log',
      path: `/projects/${projectId}/issues`,
      icon: AlertCircle
    },
    {
      name: 'Settings',
      path: `/projects/${projectId}/settings`,
      icon: Settings
    }
  ] : [];

  return (
    <aside className="w-64 bg-dark-900 border-r border-dark-800 flex flex-col h-screen shrink-0">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 border-b border-dark-800">
        <Link href="/projects" className="flex items-center gap-2 font-bold text-lg text-emerald-400">
          <Code2 className="w-6 h-6 text-emerald-400" />
          <span>Antigravity JS</span>
        </Link>
      </div>

      {/* Selected Project Info */}
      {projectName && (
        <div className="px-6 py-4 border-b border-dark-800 bg-dark-950/40">
          <p className="text-xs text-dark-400 uppercase tracking-wider">Workspace</p>
          <p className="font-semibold text-dark-100 truncate mt-1">{projectName}</p>
        </div>
      )}

      {/* Navigation Links */}
      <nav className="flex-1 px-4 py-6 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isLinkActive(item.path);
          return (
            <Link
              key={item.path}
              href={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                active
                  ? 'bg-emerald-500/10 text-emerald-400 border-l-2 border-emerald-400 pl-3.5'
                  : 'text-dark-300 hover:bg-dark-800 hover:text-dark-100'
              }`}
            >
              <Icon className={`w-5 h-5 ${active ? 'text-emerald-400' : 'text-dark-400'}`} />
              <span>{item.name}</span>
            </Link>
          );
        })}

        {/* Global Projects Back Link if inside details */}
        {projectId && (
          <Link
            href="/projects"
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-dark-400 hover:bg-dark-800 hover:text-dark-100 mt-8"
          >
            <Code2 className="w-5 h-5 text-dark-500" />
            <span>Switch project</span>
          </Link>
        )}
      </nav>

      {/* User Session Footer */}
      <div className="p-4 border-t border-dark-800 bg-dark-950/20">
        {isDemoMode && (
          <div className="mb-3 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-md flex items-center gap-1.5 text-xs text-amber-400">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Demo Sandbox Mode</span>
          </div>
        )}
        
        <div className="flex items-center justify-between">
          <div className="truncate pr-2">
            <p className="text-sm font-semibold text-dark-200 truncate">{user?.name}</p>
            <p className="text-xs text-dark-400 truncate">{user?.email}</p>
          </div>
          <button
            onClick={logout}
            title="Sign Out"
            className="p-2 hover:bg-dark-800 rounded-lg text-dark-400 hover:text-rose-400 transition-colors"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
