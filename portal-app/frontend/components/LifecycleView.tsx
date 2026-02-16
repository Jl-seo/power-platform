"use client";

import React, { useState, useMemo } from 'react';
import ViewToggle, { type ViewMode } from './ViewToggle';

// ============================================================
// Types & Mock Data
// ============================================================

type LifecycleStage = 'active' | 'inactive' | 'orphaned' | 'archived';
type ResourceType = 'Canvas App' | 'Cloud Flow' | 'Model-Driven App' | 'Custom Connector';

interface LifecycleResource {
    id: string;
    name: string;
    type: ResourceType;
    owner: string;
    ownerEmail: string;
    tenant: string;
    environment: string;
    stage: LifecycleStage;
    lastUsed: string;
    daysSinceUse: number;
    users: number;
    dependencies: number;
    recommendation: string;
}

const STAGE_CONFIG: Record<LifecycleStage, { label: string; icon: string; class: string }> = {
    active: { label: '활성', icon: '🟢', class: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    inactive: { label: '비활성', icon: '🟡', class: 'bg-amber-100 text-amber-700 border-amber-200' },
    orphaned: { label: '미소유', icon: '🔴', class: 'bg-rose-100 text-rose-700 border-rose-200' },
    archived: { label: '보관', icon: '📦', class: 'bg-slate-100 text-slate-600 border-slate-200' },
};

const TYPE_ICON: Record<ResourceType, string> = {
    'Canvas App': '📱',
    'Cloud Flow': '⚡',
    'Model-Driven App': '🗃️',
    'Custom Connector': '🔌',
};

const MOCK_RESOURCES: LifecycleResource[] = [
    { id: 'lc-001', name: 'Legacy CRM Dashboard', type: 'Canvas App', owner: '퇴사자', ownerEmail: 'exuser1@hq.com', tenant: '자회사 A', environment: 'Production', stage: 'orphaned', lastUsed: '2025-08-15', daysSinceUse: 185, users: 0, dependencies: 2, recommendation: '소유권 이전 또는 아카이브' },
    { id: 'lc-002', name: 'Weekly Report Generator', type: 'Cloud Flow', owner: '퇴사자', ownerEmail: 'exuser2@sub-b.com', tenant: '자회사 B', environment: 'Production', stage: 'orphaned', lastUsed: '2025-09-01', daysSinceUse: 168, users: 0, dependencies: 1, recommendation: '삭제 검토' },
    { id: 'lc-003', name: '재고 확인 앱 v1', type: 'Canvas App', owner: '나호준', ownerEmail: 'na@sub-c.com', tenant: '자회사 C', environment: 'Default', stage: 'inactive', lastUsed: '2025-11-20', daysSinceUse: 88, users: 0, dependencies: 0, recommendation: 'v2로 대체 완료 — 아카이브 권장' },
    { id: 'lc-004', name: 'Email Notification Flow', type: 'Cloud Flow', owner: '김효진', ownerEmail: 'kim@hq.com', tenant: '자회사 A', environment: 'Sandbox', stage: 'inactive', lastUsed: '2025-12-10', daysSinceUse: 68, users: 1, dependencies: 0, recommendation: '소유자 확인 필요' },
    { id: 'lc-005', name: 'Test App - PoC Alpha', type: 'Canvas App', owner: '박지성', ownerEmail: 'park@sub-a.com', tenant: '자회사 A', environment: 'Sandbox', stage: 'inactive', lastUsed: '2025-10-05', daysSinceUse: 134, users: 0, dependencies: 0, recommendation: 'PoC 완료 — 삭제 권장' },
    { id: 'lc-006', name: 'SAP Connector v1', type: 'Custom Connector', owner: '퇴사자', ownerEmail: 'exuser3@hq.com', tenant: '자회사 A', environment: 'Production', stage: 'orphaned', lastUsed: '2025-07-01', daysSinceUse: 230, users: 0, dependencies: 3, recommendation: '의존성 확인 후 이전' },
    { id: 'lc-007', name: '퇴직 처리 앱', type: 'Model-Driven App', owner: '강현우', ownerEmail: 'kang@hq.com', tenant: '자회사 A', environment: 'Production', stage: 'active', lastUsed: '2026-02-14', daysSinceUse: 2, users: 8, dependencies: 4, recommendation: '정상 운영 중' },
    { id: 'lc-008', name: '출장 정산 Flow', type: 'Cloud Flow', owner: '이민수', ownerEmail: 'lee@sub-b.com', tenant: '자회사 B', environment: 'Production', stage: 'active', lastUsed: '2026-02-16', daysSinceUse: 0, users: 15, dependencies: 2, recommendation: '정상 운영 중' },
    { id: 'lc-009', name: 'Demo App 2024', type: 'Canvas App', owner: '서윤호', ownerEmail: 'seo@sub-b.com', tenant: '자회사 B', environment: 'Sandbox', stage: 'archived', lastUsed: '2025-06-01', daysSinceUse: 260, users: 0, dependencies: 0, recommendation: '보관 완료' },
];

// Saved View Tabs
interface ViewTab { id: string; label: string; icon: string; filter: (r: LifecycleResource) => boolean; }
const VIEW_TABS: ViewTab[] = [
    { id: 'all', label: '전체', icon: '📋', filter: () => true },
    { id: 'needs-action', label: '조치 필요', icon: '⚠️', filter: r => r.stage === 'orphaned' || r.stage === 'inactive' },
    { id: 'orphaned', label: '미소유', icon: '🔴', filter: r => r.stage === 'orphaned' },
    { id: 'inactive', label: '비활성', icon: '🟡', filter: r => r.stage === 'inactive' },
    { id: 'active', label: '활성', icon: '🟢', filter: r => r.stage === 'active' },
    { id: 'archived', label: '보관', icon: '📦', filter: r => r.stage === 'archived' },
];

// ============================================================
// Main Lifecycle View
// ============================================================

export default function LifecycleView() {
    const [viewMode, setViewMode] = useState<ViewMode>('table');
    const [resources, setResources] = useState(MOCK_RESOURCES);
    const [activeTab, setActiveTab] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [selected, setSelected] = useState<Set<string>>(new Set());

    const currentTab = VIEW_TABS.find(t => t.id === activeTab) || VIEW_TABS[0];
    const filtered = useMemo(() => {
        return resources.filter(r => {
            if (!currentTab.filter(r)) return false;
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                return r.name.toLowerCase().includes(q) || r.owner.toLowerCase().includes(q) || r.ownerEmail.toLowerCase().includes(q);
            }
            return true;
        });
    }, [resources, activeTab, searchQuery, currentTab]);

    const stageCounts: Record<string, number> = {};
    resources.forEach(r => { stageCounts[r.stage] = (stageCounts[r.stage] || 0) + 1; });

    const toggleSelect = (id: string) => {
        setSelected(prev => {
            const next = new Set(Array.from(prev));
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const handleArchive = () => {
        setResources(prev => prev.map(r =>
            selected.has(r.id) ? { ...r, stage: 'archived' as LifecycleStage } : r
        ));
        setSelected(new Set());
    };

    const riskScore = Math.round(
        (stageCounts['orphaned'] || 0) * 30 + (stageCounts['inactive'] || 0) * 15
    );

    return (
        <div className="p-6 space-y-4 animate-fade-in max-w-[1200px]">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-slate-800">라이프사이클 관리</h1>
                    <p className="text-sm text-slate-500 mt-0.5">비활성 · 미소유 리소스를 감지하고 정리합니다</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className={`text-center px-4 py-2 rounded-xl border font-bold
            ${riskScore > 80 ? 'bg-rose-50 border-rose-200 text-rose-700' : riskScore > 40 ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
                        <div className="text-xl">{riskScore}</div>
                        <div className="text-[10px] uppercase">정리 점수</div>
                    </div>
                    {selected.size > 0 && (
                        <button id="btn-archive-selected" onClick={handleArchive} className="btn-primary">
                            📦 아카이브 ({selected.size})
                        </button>
                    )}
                </div>
            </div>

            {/* View Tabs */}
            <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto">
                {VIEW_TABS.map(tab => {
                    const count = resources.filter(tab.filter).length;
                    return (
                        <button key={tab.id} id={`lc-tab-${tab.id}`} onClick={() => setActiveTab(tab.id)}
                            className={`px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-all flex items-center gap-1.5
                ${activeTab === tab.id
                                    ? 'border-blue-600 text-blue-700 bg-blue-50/50'
                                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>
                            <span>{tab.icon}</span> {tab.label}
                            <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full ml-1">{count}</span>
                        </button>
                    );
                })}
            </div>

            {/* Search + View Toggle */}
            <div className="flex items-center gap-3">
                <div className="relative flex-1">
                    <svg className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input id="lc-search" name="search" type="text" placeholder="리소스명, 소유자 검색..."
                        className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                </div>
                <ViewToggle mode={viewMode} onChange={setViewMode} totalCount={resources.length} filteredCount={filtered.length} />
            </div>

            {/* TABLE VIEW */}
            {viewMode === 'table' && (
                <div className="glass-card overflow-hidden animate-fade-in">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th className="w-10">
                                    <input id="lc-select-all" type="checkbox" className="rounded"
                                        onChange={e => {
                                            if (e.target.checked) {
                                                const ids = new Set(filtered.filter(r => r.stage !== 'active' && r.stage !== 'archived').map(r => r.id));
                                                setSelected(ids);
                                            } else setSelected(new Set());
                                        }} />
                                </th>
                                <th>상태</th>
                                <th>리소스</th>
                                <th>유형</th>
                                <th>소유자</th>
                                <th>자회사</th>
                                <th>환경</th>
                                <th>마지막 사용</th>
                                <th>미사용 일수</th>
                                <th>사용자</th>
                                <th>의존성</th>
                                <th>권장 조치</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((res, i) => {
                                const stageConf = STAGE_CONFIG[res.stage];
                                return (
                                    <tr key={res.id} className="animate-slide-up" style={{ animationDelay: `${i * 25}ms` }}>
                                        <td>
                                            {res.stage !== 'active' && res.stage !== 'archived' && (
                                                <input id={`lc-cb-${res.id}`} type="checkbox" className="rounded"
                                                    checked={selected.has(res.id)} onChange={() => toggleSelect(res.id)} />
                                            )}
                                        </td>
                                        <td>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${stageConf.class}`}>
                                                {stageConf.icon} {stageConf.label}
                                            </span>
                                        </td>
                                        <td className="font-semibold text-slate-800">{res.name}</td>
                                        <td><span className="badge badge-neutral">{TYPE_ICON[res.type]} {res.type}</span></td>
                                        <td>
                                            <div className="text-slate-700 text-xs">{res.owner}</div>
                                            <div className="text-slate-400 text-[10px]">{res.ownerEmail}</div>
                                        </td>
                                        <td className="text-slate-500 text-xs">{res.tenant}</td>
                                        <td className="text-slate-500 text-xs">{res.environment}</td>
                                        <td className="text-slate-400 text-xs whitespace-nowrap">{res.lastUsed}</td>
                                        <td>
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${res.daysSinceUse > 150 ? 'bg-rose-100 text-rose-700' :
                                                    res.daysSinceUse > 60 ? 'bg-amber-100 text-amber-700' :
                                                        'text-slate-500'}`}>
                                                {res.daysSinceUse}일
                                            </span>
                                        </td>
                                        <td className="text-center text-slate-500">{res.users}</td>
                                        <td className="text-center text-slate-500">{res.dependencies}</td>
                                        <td className="text-xs text-slate-500 max-w-[150px] truncate" title={res.recommendation}>{res.recommendation}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {filtered.length === 0 && (
                        <div className="text-center py-12 text-slate-400"><div className="text-4xl mb-2">✨</div><div className="font-medium">리소스 없음</div></div>
                    )}
                </div>
            )}

            {/* CARD VIEW */}
            {viewMode === 'card' && (
                <div className="space-y-3 animate-fade-in">
                    {filtered.map((res, i) => {
                        const stageConf = STAGE_CONFIG[res.stage];
                        return (
                            <div key={res.id}
                                className={`glass-card p-5 animate-slide-up flex items-start gap-4 ${selected.has(res.id) ? 'ring-2 ring-blue-400' : ''}`}
                                style={{ animationDelay: `${i * 40}ms` }}>
                                {res.stage !== 'active' && res.stage !== 'archived' && (
                                    <input id={`lc-card-cb-${res.id}`} type="checkbox" className="rounded mt-1"
                                        checked={selected.has(res.id)} onChange={() => toggleSelect(res.id)} />
                                )}
                                <div className="text-2xl">{TYPE_ICON[res.type]}</div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-bold text-slate-800">{res.name}</span>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${stageConf.class}`}>{stageConf.icon} {stageConf.label}</span>
                                    </div>
                                    <div className="flex gap-4 text-xs text-slate-400 mb-2">
                                        <span>👤 {res.owner} ({res.ownerEmail})</span>
                                        <span>🏢 {res.tenant}</span>
                                        <span>🌐 {res.environment}</span>
                                    </div>
                                    <div className="flex gap-4 text-xs text-slate-500">
                                        <span>📅 마지막 사용: {res.lastUsed} ({res.daysSinceUse}일 전)</span>
                                        <span>👥 {res.users}명</span>
                                        <span>🔗 의존성: {res.dependencies}</span>
                                    </div>
                                    {res.recommendation && (
                                        <div className="mt-2 text-xs px-3 py-1.5 bg-slate-50 rounded-lg text-slate-500 inline-block">💡 {res.recommendation}</div>
                                    )}
                                </div>
                                {res.daysSinceUse > 60 && (
                                    <div className={`text-xs font-bold px-2.5 py-1 rounded-lg flex-shrink-0 ${res.daysSinceUse > 150 ? 'bg-rose-100 text-rose-700' :
                                            res.daysSinceUse > 90 ? 'bg-amber-100 text-amber-700' :
                                                'bg-slate-100 text-slate-600'}`}>
                                        {res.daysSinceUse}일
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
