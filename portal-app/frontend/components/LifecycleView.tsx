"use client";

import React, { useState, useMemo } from 'react';

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
    active: { label: '활성', icon: '🟢', class: 'bg-emerald-100 text-emerald-700' },
    inactive: { label: '비활성', icon: '🟡', class: 'bg-amber-100 text-amber-700' },
    orphaned: { label: '미소유', icon: '🔴', class: 'bg-rose-100 text-rose-700' },
    archived: { label: '보관', icon: '📦', class: 'bg-slate-100 text-slate-600' },
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

// ============================================================
// Main Lifecycle View
// ============================================================

export default function LifecycleView() {
    const [stageFilter, setStageFilter] = useState<string>('all');
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [resources, setResources] = useState(MOCK_RESOURCES);

    const filtered = useMemo(() =>
        resources.filter(r => stageFilter === 'all' || r.stage === stageFilter),
        [stageFilter, resources]
    );

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
        <div className="p-6 space-y-6 animate-fade-in max-w-[1200px]">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-slate-800">라이프사이클 관리</h1>
                    <p className="text-sm text-slate-500 mt-0.5">비활성 · 미소유 리소스를 감지하고 정리합니다</p>
                </div>
                {selected.size > 0 && (
                    <button id="btn-archive-selected" onClick={handleArchive} className="btn-primary">
                        📦 선택 아카이브 ({selected.size})
                    </button>
                )}
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-4 gap-4">
                {(['active', 'inactive', 'orphaned', 'archived'] as const).map(stage => {
                    const conf = STAGE_CONFIG[stage];
                    return (
                        <button key={stage} id={`lc-filter-${stage}`}
                            onClick={() => setStageFilter(s => s === stage ? 'all' : stage)}
                            className={`glass-card p-4 text-center transition-all ${stageFilter === stage ? 'ring-2 ring-blue-400' : ''}`}>
                            <div className="text-2xl mb-1">{conf.icon}</div>
                            <div className="text-2xl font-bold text-slate-700">{stageCounts[stage] || 0}</div>
                            <div className="text-xs text-slate-500 font-semibold">{conf.label}</div>
                        </button>
                    );
                })}
            </div>

            {/* Risk Score */}
            <div className="glass-card p-5 flex items-center gap-6">
                <div>
                    <div className="text-xs text-slate-400 uppercase font-semibold">정리 필요도</div>
                    <div className={`text-3xl font-bold mt-1 ${riskScore > 80 ? 'text-rose-600' : riskScore > 40 ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {riskScore}점
                    </div>
                </div>
                <div className="flex-1">
                    <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700"
                            style={{
                                width: `${Math.min(riskScore, 100)}%`,
                                background: riskScore > 80 ? '#ef4444' : riskScore > 40 ? '#f59e0b' : '#10b981',
                            }} />
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                        미소유 {stageCounts['orphaned'] || 0}건 × 30점 + 비활성 {stageCounts['inactive'] || 0}건 × 15점
                    </div>
                </div>
            </div>

            {/* Resource List */}
            <div className="space-y-3">
                {filtered.map((res, i) => {
                    const stageConf = STAGE_CONFIG[res.stage];
                    return (
                        <div key={res.id}
                            className={`glass-card p-5 animate-slide-up flex items-start gap-4 ${selected.has(res.id) ? 'ring-2 ring-blue-400' : ''}`}
                            style={{ animationDelay: `${i * 40}ms` }}>
                            {/* Checkbox */}
                            {res.stage !== 'active' && res.stage !== 'archived' && (
                                <input id={`lc-cb-${res.id}`} type="checkbox" className="rounded mt-1"
                                    checked={selected.has(res.id)} onChange={() => toggleSelect(res.id)} />
                            )}

                            {/* Icon */}
                            <div className="text-2xl">{TYPE_ICON[res.type]}</div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="font-bold text-slate-800">{res.name}</span>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${stageConf.class}`}>
                                        {stageConf.icon} {stageConf.label}
                                    </span>
                                    <span className="badge badge-neutral">{res.type}</span>
                                </div>
                                <div className="flex gap-4 text-xs text-slate-400 mb-2">
                                    <span>👤 {res.owner} ({res.ownerEmail})</span>
                                    <span>🏢 {res.tenant}</span>
                                    <span>🌐 {res.environment}</span>
                                </div>
                                <div className="flex gap-4 text-xs text-slate-500">
                                    <span>📅 마지막 사용: {res.lastUsed} ({res.daysSinceUse}일 전)</span>
                                    <span>👥 사용자: {res.users}명</span>
                                    <span>🔗 의존성: {res.dependencies}</span>
                                </div>
                                {res.recommendation && (
                                    <div className="mt-2 text-xs px-3 py-1.5 bg-slate-50 rounded-lg text-slate-500 inline-block">
                                        💡 {res.recommendation}
                                    </div>
                                )}
                            </div>

                            {/* Days badge */}
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
                {filtered.length === 0 && (
                    <div className="text-center py-16 text-slate-400">
                        <div className="text-5xl mb-4">✨</div>
                        <div className="text-lg font-medium">해당 단계의 리소스가 없습니다</div>
                    </div>
                )}
            </div>
        </div>
    );
}
