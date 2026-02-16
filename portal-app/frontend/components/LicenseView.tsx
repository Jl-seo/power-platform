"use client";

import React, { useState, useMemo } from 'react';

// ============================================================
// Types & Mock Data
// ============================================================

type LicenseType = 'per-user' | 'per-app' | 'trial' | 'developer';
type UsageLevel = 'active' | 'low' | 'unused';

interface LicenseAssignment {
    id: string;
    user: string;
    email: string;
    tenant: string;
    licenseType: LicenseType;
    assignedDate: string;
    lastActive: string;
    usage: UsageLevel;
    appsUsed: number;
    flowsUsed: number;
    monthlyCost: number;
}

interface LicenseSummary {
    type: string;
    total: number;
    assigned: number;
    active: number;
    unitCost: number;
}

const LICENSE_SUMMARIES: LicenseSummary[] = [
    { type: 'Power Apps Per User', total: 50, assigned: 42, active: 28, unitCost: 20 },
    { type: 'Power Apps Per App', total: 30, assigned: 22, active: 18, unitCost: 5 },
    { type: 'Power Automate Per User', total: 40, assigned: 35, active: 25, unitCost: 15 },
    { type: 'AI Builder', total: 10, assigned: 8, active: 5, unitCost: 500 },
];

const USAGE_CONFIG: Record<UsageLevel, { label: string; class: string; icon: string }> = {
    active: { label: '활성', class: 'bg-emerald-100 text-emerald-700', icon: '🟢' },
    low: { label: '저조', class: 'bg-amber-100 text-amber-700', icon: '🟡' },
    unused: { label: '미사용', class: 'bg-rose-100 text-rose-700', icon: '🔴' },
};

const LICENSE_TYPE_LABEL: Record<LicenseType, string> = {
    'per-user': 'Per User',
    'per-app': 'Per App',
    'trial': 'Trial',
    'developer': 'Developer',
};

const MOCK_ASSIGNMENTS: LicenseAssignment[] = [
    { id: 'lic-001', user: '김효진', email: 'kim@hq.com', tenant: '자회사 A', licenseType: 'per-user', assignedDate: '2025-06-01', lastActive: '2026-02-16', usage: 'active', appsUsed: 5, flowsUsed: 3, monthlyCost: 20 },
    { id: 'lic-002', user: '이민수', email: 'lee@sub-b.com', tenant: '자회사 B', licenseType: 'per-user', assignedDate: '2025-08-15', lastActive: '2026-02-15', usage: 'active', appsUsed: 3, flowsUsed: 8, monthlyCost: 20 },
    { id: 'lic-003', user: '박지성', email: 'park@sub-a.com', tenant: '자회사 A', licenseType: 'per-user', assignedDate: '2025-09-01', lastActive: '2026-02-10', usage: 'active', appsUsed: 2, flowsUsed: 1, monthlyCost: 20 },
    { id: 'lic-004', user: '최진호', email: 'choi@hq.com', tenant: '자회사 A', licenseType: 'per-user', assignedDate: '2025-03-10', lastActive: '2026-01-05', usage: 'low', appsUsed: 1, flowsUsed: 0, monthlyCost: 20 },
    { id: 'lic-005', user: '나호준', email: 'na@sub-c.com', tenant: '자회사 C', licenseType: 'per-user', assignedDate: '2025-07-20', lastActive: '2025-11-30', usage: 'unused', appsUsed: 0, flowsUsed: 0, monthlyCost: 20 },
    { id: 'lic-006', user: '정미라', email: 'jung@sub-a.com', tenant: '자회사 A', licenseType: 'per-app', assignedDate: '2025-10-01', lastActive: '2026-02-14', usage: 'active', appsUsed: 1, flowsUsed: 0, monthlyCost: 5 },
    { id: 'lic-007', user: '강현우', email: 'kang@hq.com', tenant: '자회사 A', licenseType: 'per-user', assignedDate: '2025-04-01', lastActive: '2025-12-20', usage: 'unused', appsUsed: 0, flowsUsed: 0, monthlyCost: 20 },
    { id: 'lic-008', user: '서윤호', email: 'seo@sub-b.com', tenant: '자회사 B', licenseType: 'trial', assignedDate: '2026-01-15', lastActive: '2026-02-01', usage: 'low', appsUsed: 1, flowsUsed: 1, monthlyCost: 0 },
    { id: 'lic-009', user: '윤지현', email: 'yun@sub-c.com', tenant: '자회사 C', licenseType: 'per-user', assignedDate: '2025-05-01', lastActive: '2025-10-15', usage: 'unused', appsUsed: 0, flowsUsed: 0, monthlyCost: 20 },
    { id: 'lic-010', user: '한소희', email: 'han@hq.com', tenant: '자회사 A', licenseType: 'developer', assignedDate: '2025-11-01', lastActive: '2026-02-16', usage: 'active', appsUsed: 8, flowsUsed: 12, monthlyCost: 0 },
];

// ============================================================
// Main License View
// ============================================================

export default function LicenseView() {
    const [usageFilter, setUsageFilter] = useState<string>('all');
    const [selected, setSelected] = useState<Set<string>>(new Set());

    const filtered = useMemo(() =>
        MOCK_ASSIGNMENTS.filter(a => usageFilter === 'all' || a.usage === usageFilter),
        [usageFilter]
    );

    const totalMonthlyCost = MOCK_ASSIGNMENTS.reduce((s, a) => s + a.monthlyCost, 0);
    const wastedCost = MOCK_ASSIGNMENTS.filter(a => a.usage === 'unused').reduce((s, a) => s + a.monthlyCost, 0);
    const lowUsageCost = MOCK_ASSIGNMENTS.filter(a => a.usage === 'low').reduce((s, a) => s + a.monthlyCost, 0);

    const toggleSelect = (id: string) => {
        setSelected(prev => {
            const next = new Set(Array.from(prev));
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    return (
        <div className="p-6 space-y-6 animate-fade-in max-w-[1200px]">
            {/* Header */}
            <div>
                <h1 className="text-xl font-bold text-slate-800">라이선스 최적화</h1>
                <p className="text-sm text-slate-500 mt-0.5">라이선스 사용량을 분석하고 비용을 절감합니다</p>
            </div>

            {/* Cost Overview */}
            <div className="grid grid-cols-4 gap-4">
                <div className="kpi-card">
                    <div className="text-xs text-slate-400 uppercase font-semibold">월 총 비용</div>
                    <div className="kpi-value text-slate-800">${totalMonthlyCost}</div>
                    <div className="kpi-label">모든 라이선스</div>
                </div>
                <div className="kpi-card">
                    <div className="text-xs text-slate-400 uppercase font-semibold">절감 가능</div>
                    <div className="kpi-value text-rose-600">${wastedCost}</div>
                    <div className="kpi-label">미사용 라이선스 회수 시</div>
                </div>
                <div className="kpi-card">
                    <div className="text-xs text-slate-400 uppercase font-semibold">저사용 비용</div>
                    <div className="kpi-value text-amber-600">${lowUsageCost}</div>
                    <div className="kpi-label">다운그레이드 검토 대상</div>
                </div>
                <div className="kpi-card">
                    <div className="text-xs text-slate-400 uppercase font-semibold">최적화율</div>
                    <div className="kpi-value text-emerald-600">{Math.round((1 - (wastedCost + lowUsageCost) / totalMonthlyCost) * 100)}%</div>
                    <div className="kpi-label">실사용 / 전체</div>
                </div>
            </div>

            {/* License Pool Summary */}
            <div className="glass-card p-5">
                <h2 className="text-sm font-bold text-slate-700 mb-3">라이선스 풀 현황</h2>
                <div className="grid grid-cols-4 gap-3">
                    {LICENSE_SUMMARIES.map(ls => {
                        const utilization = Math.round((ls.active / ls.total) * 100);
                        return (
                            <div key={ls.type} className="p-3 bg-slate-50 rounded-xl">
                                <div className="text-xs font-semibold text-slate-600 mb-2">{ls.type}</div>
                                <div className="flex justify-between text-xs text-slate-400 mb-1">
                                    <span>{ls.active} 활성 / {ls.assigned} 할당 / {ls.total} 보유</span>
                                    <span className="font-bold">{utilization}%</span>
                                </div>
                                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full transition-all duration-500"
                                        style={{
                                            width: `${utilization}%`,
                                            background: utilization > 70 ? '#10b981' : utilization > 40 ? '#f59e0b' : '#ef4444',
                                        }} />
                                </div>
                                <div className="text-xs text-slate-400 mt-1">${ls.unitCost}/user/월</div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Usage Filter */}
            <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-slate-600">필터:</span>
                {['all', 'active', 'low', 'unused'].map(f => (
                    <button key={f} id={`lic-filter-${f}`} onClick={() => setUsageFilter(f)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
              ${usageFilter === f ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                        {f === 'all' ? '전체' : USAGE_CONFIG[f as UsageLevel].icon + ' ' + USAGE_CONFIG[f as UsageLevel].label}
                    </button>
                ))}
                {selected.size > 0 && (
                    <button id="btn-reclaim" className="btn-danger ml-auto text-xs px-4 py-1.5">
                        🔄 선택 라이선스 회수 ({selected.size})
                    </button>
                )}
            </div>

            {/* Assignment Table */}
            <div className="glass-card overflow-hidden">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th className="w-10">
                                <input id="lic-select-all" type="checkbox" className="rounded"
                                    onChange={e => {
                                        if (e.target.checked) {
                                            const ids = new Set(filtered.filter(a => a.usage === 'unused').map(a => a.id));
                                            setSelected(ids);
                                        } else setSelected(new Set());
                                    }} />
                            </th>
                            <th>사용자</th>
                            <th>자회사</th>
                            <th>라이선스</th>
                            <th>마지막 활동</th>
                            <th>사용량</th>
                            <th>월 비용</th>
                            <th>상태</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map((a, i) => {
                            const usg = USAGE_CONFIG[a.usage];
                            return (
                                <tr key={a.id} className="animate-slide-up" style={{ animationDelay: `${i * 30}ms` }}>
                                    <td>
                                        <input id={`lic-cb-${a.id}`} type="checkbox" className="rounded"
                                            checked={selected.has(a.id)} onChange={() => toggleSelect(a.id)}
                                            disabled={a.usage === 'active'} />
                                    </td>
                                    <td>
                                        <div className="font-semibold text-slate-800">{a.user}</div>
                                        <div className="text-xs text-slate-400">{a.email}</div>
                                    </td>
                                    <td className="text-slate-600">{a.tenant}</td>
                                    <td>
                                        <span className="badge badge-info">{LICENSE_TYPE_LABEL[a.licenseType]}</span>
                                    </td>
                                    <td className="text-slate-500 text-xs">{a.lastActive}</td>
                                    <td>
                                        <div className="text-xs text-slate-500">Apps: {a.appsUsed} · Flows: {a.flowsUsed}</div>
                                    </td>
                                    <td className="font-semibold text-slate-700">{a.monthlyCost > 0 ? `$${a.monthlyCost}` : 'Free'}</td>
                                    <td>
                                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${usg.class}`}>{usg.icon} {usg.label}</span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
