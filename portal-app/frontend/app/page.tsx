"use client";

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import InventoryView, { MOCK_TENANTS } from '../components/InventoryView';
import SecurityView from '../components/SecurityView';
import GovernanceView from '../components/GovernanceView';

// recharts uses window — must be loaded client-side only
const DashboardView = dynamic(() => import('../components/DashboardView'), { ssr: false });

// ============================================================
// Types
// ============================================================

type Page = 'dashboard' | 'inventory' | 'security' | 'governance' | 'selfservice' | 'audit' | 'license' | 'lifecycle' | 'settings';

interface NavItem {
    id: Page;
    label: string;
    icon: string;
    badge?: number;
    disabled?: boolean;
}

// ============================================================
// Navigation Config
// ============================================================

const NAV_ITEMS: NavItem[] = [
    { id: 'dashboard', label: '대시보드', icon: '📊' },
    { id: 'inventory', label: '인벤토리', icon: '📦' },
    { id: 'security', label: '보안 센터', icon: '🔒', badge: 8 },
    { id: 'governance', label: '거버넌스', icon: '🛡️', badge: 2 },
    { id: 'selfservice', label: '셀프서비스', icon: '🎫', disabled: true },
    { id: 'audit', label: '감사 로그', icon: '📋', disabled: true },
    { id: 'license', label: '라이선스', icon: '💰', disabled: true },
    { id: 'lifecycle', label: '라이프사이클', icon: '🔄', disabled: true },
];

const SETTINGS_NAV: NavItem = { id: 'settings', label: '설정', icon: '⚙️', disabled: true };

// ============================================================
// Toast Notification
// ============================================================

interface Toast {
    id: number;
    message: string;
    type: 'success' | 'error' | 'info';
}

const ToastContainer = ({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: number) => void }) => (
    <div className="fixed bottom-6 right-6 z-50 space-y-2">
        {toasts.map(t => (
            <div key={t.id}
                className={`flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg animate-slide-up text-sm font-medium
          ${t.type === 'success' ? 'bg-emerald-600 text-white' :
                        t.type === 'error' ? 'bg-rose-600 text-white' :
                            'bg-blue-600 text-white'}`}>
                <span>{t.type === 'success' ? '✅' : t.type === 'error' ? '❌' : 'ℹ️'}</span>
                <span>{t.message}</span>
                <button onClick={() => onRemove(t.id)} className="ml-2 text-white/70 hover:text-white">✕</button>
            </div>
        ))}
    </div>
);

// ============================================================
// Main App
// ============================================================

export default function Portal() {
    const [currentPage, setCurrentPage] = useState<Page>('dashboard');
    const [toasts, setToasts] = useState<Toast[]>([]);
    let toastIdRef = 0;

    const addToast = (message: string, type: Toast['type'] = 'success') => {
        const id = ++toastIdRef;
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
    };

    const handleAction = (action: string, resource: { name: string; properties: { displayName?: string } }) => {
        const name = resource.properties.displayName || resource.name;
        const labels: Record<string, string> = {
            quarantine: `🔒 "${name}" 격리 완료`,
            transfer: `🔄 "${name}" 소유권 이전 요청됨`,
            archive: `📦 "${name}" 아카이브 완료`,
        };
        addToast(labels[action] || `${action} 완료`);
    };

    return (
        <div className="flex h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
            {/* Sidebar */}
            <aside className="w-[260px] flex-shrink-0 flex flex-col bg-white/80 backdrop-blur-xl border-r border-slate-200/80">
                {/* Logo */}
                <div className="px-5 py-5 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-blue-200">
                            G
                        </div>
                        <div>
                            <div className="font-bold text-slate-800 text-sm leading-tight">CoE Governance</div>
                            <div className="text-[11px] text-slate-400">Power Platform</div>
                        </div>
                    </div>
                </div>

                {/* Tenant Selector */}
                <div className="px-4 py-3 border-b border-slate-100">
                    <label htmlFor="tenant-selector" className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">테넌트</label>
                    <select id="tenant-selector" name="tenant"
                        className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 bg-white
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                        <option value="all">전체 (그룹사)</option>
                        <option value="tenant-001">자회사 A (본사)</option>
                        <option value="tenant-002">자회사 B (제조)</option>
                        <option value="tenant-003">자회사 C (유통)</option>
                    </select>
                </div>

                {/* Nav Items */}
                <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
                    {NAV_ITEMS.map(item => (
                        <button
                            key={item.id}
                            id={`nav-${item.id}`}
                            onClick={() => !item.disabled && setCurrentPage(item.id)}
                            disabled={item.disabled}
                            className={`sidebar-item w-full group
                ${currentPage === item.id ? 'active' : ''}
                ${item.disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                        >
                            <span className="text-lg">{item.icon}</span>
                            <span className="flex-1">{item.label}</span>
                            {item.badge && (
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center
                  ${currentPage === item.id ? 'bg-blue-200 text-blue-700' : 'bg-rose-100 text-rose-600'}`}>
                                    {item.badge}
                                </span>
                            )}
                            {item.disabled && (
                                <span className="text-[9px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">Phase 2</span>
                            )}
                        </button>
                    ))}
                </nav>

                {/* Bottom */}
                <div className="p-3 border-t border-slate-100 space-y-1">
                    <button id={`nav-${SETTINGS_NAV.id}`}
                        className="sidebar-item w-full opacity-40 cursor-not-allowed">
                        <span className="text-lg">{SETTINGS_NAV.icon}</span>
                        <span className="flex-1">{SETTINGS_NAV.label}</span>
                        <span className="text-[9px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">Phase 2</span>
                    </button>
                    <div className="flex items-center gap-2 px-3 py-2 text-[11px] text-slate-400">
                        <span className="w-2 h-2 rounded-full bg-amber-400" />
                        <span>Mock 데이터</span>
                    </div>
                    <div className="px-3 text-[10px] text-slate-300">v1.0.0</div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Top Bar */}
                <header className="h-[56px] flex-shrink-0 flex items-center justify-between px-6 border-b border-slate-200/80 bg-white/60 backdrop-blur-xl">
                    <h1 className="text-lg font-bold text-slate-800">
                        {NAV_ITEMS.find(n => n.id === currentPage)?.label || SETTINGS_NAV.label}
                    </h1>
                    <div className="flex items-center gap-3">
                        <button id="btn-refresh" className="btn-secondary text-xs px-3 py-1.5"
                            onClick={() => addToast('데이터 새로고침 완료', 'info')}>
                            🔄 새로고침
                        </button>
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                            A
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <div className="flex-1 overflow-auto">
                    {currentPage === 'dashboard' && <DashboardView />}
                    {currentPage === 'inventory' && <InventoryView tenants={MOCK_TENANTS} onAction={handleAction} />}
                    {currentPage === 'security' && <SecurityView />}
                    {currentPage === 'governance' && <GovernanceView />}
                    {['selfservice', 'audit', 'license', 'lifecycle', 'settings'].includes(currentPage) && (
                        <div className="flex items-center justify-center h-full text-slate-400">
                            <div className="text-center">
                                <div className="text-6xl mb-4">🚧</div>
                                <div className="text-xl font-bold">Phase 2에서 구현 예정</div>
                                <div className="text-sm mt-2">셀프서비스, 감사 로그, 라이선스, 라이프사이클, 설정</div>
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* Toasts */}
            <ToastContainer toasts={toasts} onRemove={id => setToasts(prev => prev.filter(t => t.id !== id))} />
        </div>
    );
}
