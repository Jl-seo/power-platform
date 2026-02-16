"use client";

import React, { useState, useMemo } from 'react';
import ViewToggle, { type ViewMode } from './ViewToggle';

// ============================================================
// Types & Mock Data
// ============================================================

type LicenseType = 'per-user' | 'per-app' | 'per-flow' | 'ai-builder' | 'trial' | 'developer';
type UsageLevel = 'active' | 'low' | 'unused';

interface LicenseAssignment {
    id: string;
    user: string;
    email: string;
    department: string;
    tenant: string;
    licenseType: LicenseType;
    assignedDate: string;
    lastActive: string;
    usage: UsageLevel;
    appsUsed: number;
    flowsUsed: number;
    monthlyCost: number;
}

interface LicensePool {
    id: string;
    name: string;
    type: LicenseType;
    total: number;
    assigned: number;
    active: number;
    unitCost: number;
    currency: string;
    renewalDate: string;
    daysToRenewal: number;
    term: string; // 'annual' | 'monthly'
    vendor: string;
}

interface DepartmentAllocation {
    department: string;
    perUser: { quota: number; used: number };
    perApp: { quota: number; used: number };
    totalCost: number;
}

const USAGE_CONFIG: Record<UsageLevel, { label: string; class: string; icon: string }> = {
    active: { label: '활성', class: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: '🟢' },
    low: { label: '저조', class: 'bg-amber-100 text-amber-700 border-amber-200', icon: '🟡' },
    unused: { label: '미사용', class: 'bg-rose-100 text-rose-700 border-rose-200', icon: '🔴' },
};

const LICENSE_TYPE_LABEL: Record<LicenseType, { label: string; icon: string }> = {
    'per-user': { label: 'Power Apps Per User', icon: '👤' },
    'per-app': { label: 'Power Apps Per App', icon: '📱' },
    'per-flow': { label: 'Power Automate Per User', icon: '⚡' },
    'ai-builder': { label: 'AI Builder', icon: '🤖' },
    'trial': { label: 'Trial', icon: '🧪' },
    'developer': { label: 'Developer', icon: '🛠️' },
};

// === License Pools (Tenant-level, MS 관리 단위) ===
const MOCK_POOLS: LicensePool[] = [
    { id: 'pool-1', name: 'Power Apps Per User', type: 'per-user', total: 50, assigned: 42, active: 28, unitCost: 20, currency: 'USD', renewalDate: '2026-07-01', daysToRenewal: 135, term: '연간', vendor: 'Microsoft EA' },
    { id: 'pool-2', name: 'Power Apps Per App', type: 'per-app', total: 30, assigned: 22, active: 18, unitCost: 5, currency: 'USD', renewalDate: '2026-07-01', daysToRenewal: 135, term: '연간', vendor: 'Microsoft EA' },
    { id: 'pool-3', name: 'Power Automate Per User', type: 'per-flow', total: 40, assigned: 35, active: 25, unitCost: 15, currency: 'USD', renewalDate: '2026-07-01', daysToRenewal: 135, term: '연간', vendor: 'Microsoft EA' },
    { id: 'pool-4', name: 'AI Builder', type: 'ai-builder', total: 10, assigned: 8, active: 5, unitCost: 500, currency: 'USD', renewalDate: '2026-04-15', daysToRenewal: 58, term: '연간', vendor: 'Microsoft EA' },
    { id: 'pool-5', name: 'Power Apps Trial', type: 'trial', total: 25, assigned: 8, active: 6, unitCost: 0, currency: 'USD', renewalDate: '-', daysToRenewal: -1, term: '90일', vendor: 'Microsoft (무료)' },
];

// === Department-level Allocation (CoE가 관리: MS에는 없는 기능) ===
const MOCK_DEPT_ALLOC: DepartmentAllocation[] = [
    { department: 'IT혁신팀', perUser: { quota: 15, used: 12 }, perApp: { quota: 10, used: 8 }, totalCost: 280 },
    { department: 'HR팀', perUser: { quota: 8, used: 7 }, perApp: { quota: 5, used: 3 }, totalCost: 155 },
    { department: '재무팀', perUser: { quota: 5, used: 5 }, perApp: { quota: 3, used: 2 }, totalCost: 110 },
    { department: '유통사업부', perUser: { quota: 10, used: 8 }, perApp: { quota: 5, used: 4 }, totalCost: 180 },
    { department: '제조팀', perUser: { quota: 7, used: 5 }, perApp: { quota: 4, used: 3 }, totalCost: 115 },
    { department: '미배정', perUser: { quota: 5, used: 5 }, perApp: { quota: 3, used: 2 }, totalCost: 110 },
];

// === Individual Assignments ===
const MOCK_ASSIGNMENTS: LicenseAssignment[] = [
    { id: 'lic-001', user: '김효진', email: 'kim@hq.com', department: 'IT혁신팀', tenant: '자회사 A', licenseType: 'per-user', assignedDate: '2025-06-01', lastActive: '2026-02-16', usage: 'active', appsUsed: 5, flowsUsed: 3, monthlyCost: 20 },
    { id: 'lic-002', user: '이민수', email: 'lee@sub-b.com', department: 'IT혁신팀', tenant: '자회사 B', licenseType: 'per-user', assignedDate: '2025-08-15', lastActive: '2026-02-15', usage: 'active', appsUsed: 3, flowsUsed: 8, monthlyCost: 20 },
    { id: 'lic-003', user: '박지성', email: 'park@sub-a.com', department: 'HR팀', tenant: '자회사 A', licenseType: 'per-user', assignedDate: '2025-09-01', lastActive: '2026-02-10', usage: 'active', appsUsed: 2, flowsUsed: 1, monthlyCost: 20 },
    { id: 'lic-004', user: '최진호', email: 'choi@hq.com', department: '재무팀', tenant: '자회사 A', licenseType: 'per-user', assignedDate: '2025-03-10', lastActive: '2026-01-05', usage: 'low', appsUsed: 1, flowsUsed: 0, monthlyCost: 20 },
    { id: 'lic-005', user: '나호준', email: 'na@sub-c.com', department: '유통사업부', tenant: '자회사 C', licenseType: 'per-user', assignedDate: '2025-07-20', lastActive: '2025-11-30', usage: 'unused', appsUsed: 0, flowsUsed: 0, monthlyCost: 20 },
    { id: 'lic-006', user: '정미라', email: 'jung@sub-a.com', department: 'HR팀', tenant: '자회사 A', licenseType: 'per-app', assignedDate: '2025-10-01', lastActive: '2026-02-14', usage: 'active', appsUsed: 1, flowsUsed: 0, monthlyCost: 5 },
    { id: 'lic-007', user: '강현우', email: 'kang@hq.com', department: '미배정', tenant: '자회사 A', licenseType: 'per-user', assignedDate: '2025-04-01', lastActive: '2025-12-20', usage: 'unused', appsUsed: 0, flowsUsed: 0, monthlyCost: 20 },
    { id: 'lic-008', user: '서윤호', email: 'seo@sub-b.com', department: '제조팀', tenant: '자회사 B', licenseType: 'trial', assignedDate: '2026-01-15', lastActive: '2026-02-01', usage: 'low', appsUsed: 1, flowsUsed: 1, monthlyCost: 0 },
    { id: 'lic-009', user: '윤지현', email: 'yun@sub-c.com', department: '미배정', tenant: '자회사 C', licenseType: 'per-user', assignedDate: '2025-05-01', lastActive: '2025-10-15', usage: 'unused', appsUsed: 0, flowsUsed: 0, monthlyCost: 20 },
    { id: 'lic-010', user: '한소희', email: 'han@hq.com', department: 'IT혁신팀', tenant: '자회사 A', licenseType: 'developer', assignedDate: '2025-11-01', lastActive: '2026-02-16', usage: 'active', appsUsed: 8, flowsUsed: 12, monthlyCost: 0 },
];

// View Tabs
interface ViewTab { id: string; label: string; icon: string; }
const VIEW_TABS: ViewTab[] = [
    { id: 'pool', label: '라이선스 풀', icon: '📊' },
    { id: 'department', label: '부서별 배정', icon: '🏢' },
    { id: 'users', label: '개인별 현황', icon: '👤' },
];

// ============================================================
// Main License View
// ============================================================

export default function LicenseView() {
    const [activeTab, setActiveTab] = useState('pool');
    const [viewMode, setViewMode] = useState<ViewMode>('table');
    const [usageFilter, setUsageFilter] = useState<string>('all');
    const [deptFilter, setDeptFilter] = useState<string>('all');
    const [selected, setSelected] = useState<Set<string>>(new Set());

    const filteredAssignments = useMemo(() =>
        MOCK_ASSIGNMENTS.filter(a => {
            if (usageFilter !== 'all' && a.usage !== usageFilter) return false;
            if (deptFilter !== 'all' && a.department !== deptFilter) return false;
            return true;
        }),
        [usageFilter, deptFilter]
    );

    const totalMonthlyCost = MOCK_ASSIGNMENTS.reduce((s, a) => s + a.monthlyCost, 0);
    const wastedCost = MOCK_ASSIGNMENTS.filter(a => a.usage === 'unused').reduce((s, a) => s + a.monthlyCost, 0);
    const departments = Array.from(new Set(MOCK_ASSIGNMENTS.map(a => a.department)));

    const toggleSelect = (id: string) => {
        setSelected(prev => {
            const next = new Set(Array.from(prev));
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const nearestRenewal = MOCK_POOLS.filter(p => p.daysToRenewal > 0).sort((a, b) => a.daysToRenewal - b.daysToRenewal)[0];

    return (
        <div className="p-6 space-y-4 animate-fade-in max-w-[1200px]">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-slate-800">라이선스 관리</h1>
                    <p className="text-sm text-slate-500 mt-0.5">테넌트 라이선스를 부서 단위로 배정하고, 갱신 주기와 사용량을 추적합니다</p>
                </div>
                {selected.size > 0 && (
                    <button id="btn-reclaim" className="btn-danger text-xs px-4 py-2">🔄 선택 회수 ({selected.size})</button>
                )}
            </div>

            {/* KPI Row */}
            <div className="grid grid-cols-4 gap-3">
                <div className="kpi-card">
                    <div className="text-xs text-slate-400 uppercase font-semibold">월 총 비용</div>
                    <div className="kpi-value text-slate-800">${totalMonthlyCost}</div>
                    <div className="kpi-label">연간 ${totalMonthlyCost * 12}</div>
                </div>
                <div className="kpi-card">
                    <div className="text-xs text-slate-400 uppercase font-semibold">절감 가능</div>
                    <div className="kpi-value text-rose-600">${wastedCost}/월</div>
                    <div className="kpi-label">미사용 {MOCK_ASSIGNMENTS.filter(a => a.usage === 'unused').length}건 회수 시</div>
                </div>
                <div className="kpi-card">
                    <div className="text-xs text-slate-400 uppercase font-semibold">다음 갱신</div>
                    <div className="kpi-value text-blue-600">{nearestRenewal?.daysToRenewal || '-'}일</div>
                    <div className="kpi-label">{nearestRenewal?.name} ({nearestRenewal?.renewalDate})</div>
                </div>
                <div className="kpi-card">
                    <div className="text-xs text-slate-400 uppercase font-semibold">전체 활용률</div>
                    <div className="kpi-value text-emerald-600">{Math.round(MOCK_POOLS.reduce((s, p) => s + p.active, 0) / MOCK_POOLS.reduce((s, p) => s + p.total, 0) * 100)}%</div>
                    <div className="kpi-label">실사용 / 보유</div>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex items-center gap-1 border-b border-slate-200">
                {VIEW_TABS.map(tab => (
                    <button key={tab.id} id={`lic-tab-${tab.id}`} onClick={() => setActiveTab(tab.id)}
                        className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-all flex items-center gap-1.5
              ${activeTab === tab.id
                                ? 'border-blue-600 text-blue-700 bg-blue-50/50'
                                : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>
                        <span>{tab.icon}</span> {tab.label}
                    </button>
                ))}
            </div>

            {/* ====== TAB: License Pool (Tenant-Level) ====== */}
            {activeTab === 'pool' && (
                <div className="space-y-4 animate-fade-in">
                    <div className="glass-card overflow-hidden">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>라이선스</th>
                                    <th>계약</th>
                                    <th>보유</th>
                                    <th>할당</th>
                                    <th>실사용</th>
                                    <th>활용률</th>
                                    <th>단가</th>
                                    <th>월 비용</th>
                                    <th>갱신일</th>
                                    <th>갱신까지</th>
                                </tr>
                            </thead>
                            <tbody>
                                {MOCK_POOLS.map((pool, i) => {
                                    const utilization = Math.round((pool.active / pool.total) * 100);
                                    const urgentRenewal = pool.daysToRenewal > 0 && pool.daysToRenewal <= 60;
                                    return (
                                        <tr key={pool.id} className="animate-slide-up" style={{ animationDelay: `${i * 30}ms` }}>
                                            <td>
                                                <div className="font-semibold text-slate-800">{LICENSE_TYPE_LABEL[pool.type]?.icon} {pool.name}</div>
                                            </td>
                                            <td><span className="badge badge-neutral">{pool.term} · {pool.vendor}</span></td>
                                            <td className="text-center font-semibold">{pool.total}</td>
                                            <td className="text-center">{pool.assigned}</td>
                                            <td className="text-center font-semibold text-emerald-600">{pool.active}</td>
                                            <td>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                                                        <div className="h-full rounded-full transition-all" style={{
                                                            width: `${utilization}%`,
                                                            background: utilization > 70 ? '#10b981' : utilization > 40 ? '#f59e0b' : '#ef4444',
                                                        }} />
                                                    </div>
                                                    <span className="text-xs font-bold text-slate-600">{utilization}%</span>
                                                </div>
                                            </td>
                                            <td className="text-slate-500 text-xs">${pool.unitCost}/{pool.unitCost > 0 ? 'user' : '-'}</td>
                                            <td className="font-semibold">${pool.unitCost * pool.assigned}</td>
                                            <td className="text-xs text-slate-400">{pool.renewalDate}</td>
                                            <td>
                                                {pool.daysToRenewal < 0 ? (
                                                    <span className="text-xs text-slate-400">-</span>
                                                ) : (
                                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${urgentRenewal ? 'bg-rose-100 text-rose-700 border-rose-200' : 'bg-blue-100 text-blue-700 border-blue-200'}`}>
                                                        {urgentRenewal ? '⚠️' : '📅'} {pool.daysToRenewal}일
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {/* Total Row */}
                                <tr className="bg-slate-50 font-bold">
                                    <td>합계</td>
                                    <td></td>
                                    <td className="text-center">{MOCK_POOLS.reduce((s, p) => s + p.total, 0)}</td>
                                    <td className="text-center">{MOCK_POOLS.reduce((s, p) => s + p.assigned, 0)}</td>
                                    <td className="text-center text-emerald-600">{MOCK_POOLS.reduce((s, p) => s + p.active, 0)}</td>
                                    <td></td>
                                    <td></td>
                                    <td>${MOCK_POOLS.reduce((s, p) => s + p.unitCost * p.assigned, 0)}</td>
                                    <td></td>
                                    <td></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* Renewal Timeline */}
                    <div className="glass-card p-5">
                        <h3 className="text-sm font-bold text-slate-700 mb-3">📅 갱신 타임라인</h3>
                        <div className="relative">
                            <div className="absolute top-4 left-0 right-0 h-1 bg-slate-200 rounded-full" />
                            <div className="flex justify-between relative">
                                {MOCK_POOLS.filter(p => p.daysToRenewal > 0).sort((a, b) => a.daysToRenewal - b.daysToRenewal).map(pool => {
                                    const pos = Math.min((pool.daysToRenewal / 365) * 100, 100);
                                    const urgent = pool.daysToRenewal <= 60;
                                    return (
                                        <div key={pool.id} className="text-center" style={{ position: 'absolute', left: `${pos}%`, transform: 'translateX(-50%)' }}>
                                            <div className={`w-3 h-3 rounded-full mx-auto ${urgent ? 'bg-rose-500' : 'bg-blue-500'}`} />
                                            <div className="mt-2 text-[10px] font-semibold text-slate-600 whitespace-nowrap">{pool.name}</div>
                                            <div className={`text-[10px] ${urgent ? 'text-rose-600 font-bold' : 'text-slate-400'}`}>{pool.renewalDate}</div>
                                            <div className={`text-[10px] ${urgent ? 'text-rose-600' : 'text-slate-400'}`}>{pool.daysToRenewal}일</div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="h-16" /> {/* spacer for timeline content */}
                        </div>
                    </div>
                </div>
            )}

            {/* ====== TAB: Department Allocation (CoE 자체 관리) ====== */}
            {activeTab === 'department' && (
                <div className="space-y-4 animate-fade-in">
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                        ⚠️ <strong>MS 제한사항:</strong> Microsoft 365 Admin Center에서는 라이선스를 테넌트 단위로만 관리합니다.
                        아래 부서별 배정은 CoE Portal이 자체 관리하는 논리적 할당으로, 동적 그룹과 연동하여 실제 라이선스 이동을 추적합니다.
                    </div>
                    <div className="glass-card overflow-hidden">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>부서</th>
                                    <th colSpan={3} className="text-center border-l border-slate-100">Per User 라이선스</th>
                                    <th colSpan={3} className="text-center border-l border-slate-100">Per App 라이선스</th>
                                    <th className="border-l border-slate-100">월 비용</th>
                                    <th>조치</th>
                                </tr>
                                <tr className="text-[10px] text-slate-400">
                                    <th></th>
                                    <th className="border-l border-slate-100">배정</th>
                                    <th>사용</th>
                                    <th>활용률</th>
                                    <th className="border-l border-slate-100">배정</th>
                                    <th>사용</th>
                                    <th>활용률</th>
                                    <th className="border-l border-slate-100"></th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {MOCK_DEPT_ALLOC.map((dept, i) => {
                                    const puUtil = dept.perUser.quota > 0 ? Math.round((dept.perUser.used / dept.perUser.quota) * 100) : 0;
                                    const paUtil = dept.perApp.quota > 0 ? Math.round((dept.perApp.used / dept.perApp.quota) * 100) : 0;
                                    return (
                                        <tr key={dept.department} className="animate-slide-up" style={{ animationDelay: `${i * 30}ms` }}>
                                            <td className="font-semibold text-slate-800">
                                                {dept.department === '미배정' ? <span className="text-rose-600">⚠️ {dept.department}</span> : `🏢 ${dept.department}`}
                                            </td>
                                            <td className="text-center border-l border-slate-50">{dept.perUser.quota}</td>
                                            <td className="text-center">{dept.perUser.used}</td>
                                            <td className="border-r border-slate-50">
                                                <div className="flex items-center gap-1">
                                                    <div className="w-12 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                                        <div className="h-full rounded-full" style={{
                                                            width: `${puUtil}%`,
                                                            background: puUtil > 90 ? '#ef4444' : puUtil > 70 ? '#f59e0b' : '#10b981',
                                                        }} />
                                                    </div>
                                                    <span className="text-[10px] text-slate-500">{puUtil}%</span>
                                                </div>
                                            </td>
                                            <td className="text-center border-l border-slate-50">{dept.perApp.quota}</td>
                                            <td className="text-center">{dept.perApp.used}</td>
                                            <td>
                                                <div className="flex items-center gap-1">
                                                    <div className="w-12 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                                        <div className="h-full rounded-full" style={{
                                                            width: `${paUtil}%`,
                                                            background: paUtil > 90 ? '#ef4444' : paUtil > 70 ? '#f59e0b' : '#10b981',
                                                        }} />
                                                    </div>
                                                    <span className="text-[10px] text-slate-500">{paUtil}%</span>
                                                </div>
                                            </td>
                                            <td className="font-semibold text-slate-700 border-l border-slate-50">${dept.totalCost}</td>
                                            <td>
                                                <button id={`edit-dept-${dept.department}`}
                                                    className="text-[10px] font-bold px-2 py-1 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200">
                                                    ✏️ 조정
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                                <tr className="bg-slate-50 font-bold">
                                    <td>합계</td>
                                    <td className="text-center border-l border-slate-100">{MOCK_DEPT_ALLOC.reduce((s, d) => s + d.perUser.quota, 0)}</td>
                                    <td className="text-center">{MOCK_DEPT_ALLOC.reduce((s, d) => s + d.perUser.used, 0)}</td>
                                    <td></td>
                                    <td className="text-center border-l border-slate-100">{MOCK_DEPT_ALLOC.reduce((s, d) => s + d.perApp.quota, 0)}</td>
                                    <td className="text-center">{MOCK_DEPT_ALLOC.reduce((s, d) => s + d.perApp.used, 0)}</td>
                                    <td></td>
                                    <td className="border-l border-slate-100">${MOCK_DEPT_ALLOC.reduce((s, d) => s + d.totalCost, 0)}</td>
                                    <td></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ====== TAB: Individual User Assignments ====== */}
            {activeTab === 'users' && (
                <div className="space-y-4 animate-fade-in">
                    {/* Filters */}
                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex gap-1.5">
                            {['all', 'active', 'low', 'unused'].map(f => (
                                <button key={f} id={`lic-filter-${f}`} onClick={() => setUsageFilter(f)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
                    ${usageFilter === f ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                                    {f === 'all' ? '전체' : USAGE_CONFIG[f as UsageLevel].icon + ' ' + USAGE_CONFIG[f as UsageLevel].label}
                                </button>
                            ))}
                        </div>
                        <select id="lic-dept-filter" name="deptFilter" value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
                            className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs bg-white">
                            <option value="all">전체 부서</option>
                            {departments.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                        <ViewToggle mode={viewMode} onChange={setViewMode} totalCount={MOCK_ASSIGNMENTS.length} filteredCount={filteredAssignments.length} />
                    </div>

                    {viewMode === 'table' && (
                        <div className="glass-card overflow-hidden">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th className="w-10">
                                            <input id="lic-select-all" type="checkbox" className="rounded"
                                                onChange={e => {
                                                    if (e.target.checked) {
                                                        const ids = new Set(filteredAssignments.filter(a => a.usage === 'unused').map(a => a.id));
                                                        setSelected(ids);
                                                    } else setSelected(new Set());
                                                }} />
                                        </th>
                                        <th>사용자</th>
                                        <th>부서</th>
                                        <th>자회사</th>
                                        <th>라이선스</th>
                                        <th>마지막 활동</th>
                                        <th>Apps</th>
                                        <th>Flows</th>
                                        <th>월 비용</th>
                                        <th>상태</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredAssignments.map((a, i) => {
                                        const usg = USAGE_CONFIG[a.usage];
                                        return (
                                            <tr key={a.id} className="animate-slide-up" style={{ animationDelay: `${i * 25}ms` }}>
                                                <td>
                                                    <input id={`lic-cb-${a.id}`} type="checkbox" className="rounded"
                                                        checked={selected.has(a.id)} onChange={() => toggleSelect(a.id)}
                                                        disabled={a.usage === 'active'} />
                                                </td>
                                                <td>
                                                    <div className="font-semibold text-slate-800">{a.user}</div>
                                                    <div className="text-[10px] text-slate-400">{a.email}</div>
                                                </td>
                                                <td className="text-xs text-slate-600">{a.department}</td>
                                                <td className="text-xs text-slate-500">{a.tenant}</td>
                                                <td><span className="badge badge-info">{LICENSE_TYPE_LABEL[a.licenseType]?.icon} {LICENSE_TYPE_LABEL[a.licenseType]?.label}</span></td>
                                                <td className="text-xs text-slate-400">{a.lastActive}</td>
                                                <td className="text-center text-slate-500">{a.appsUsed}</td>
                                                <td className="text-center text-slate-500">{a.flowsUsed}</td>
                                                <td className="font-semibold text-slate-700">{a.monthlyCost > 0 ? `$${a.monthlyCost}` : 'Free'}</td>
                                                <td>
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${usg.class}`}>{usg.icon} {usg.label}</span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {viewMode === 'card' && (
                        <div className="grid grid-cols-2 gap-3 animate-fade-in">
                            {filteredAssignments.map((a, i) => {
                                const usg = USAGE_CONFIG[a.usage];
                                return (
                                    <div key={a.id} className="glass-card p-4 animate-slide-up" style={{ animationDelay: `${i * 30}ms` }}>
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-500">
                                                {a.user.charAt(0)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-sm text-slate-800">{a.user}</span>
                                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${usg.class}`}>{usg.icon}</span>
                                                </div>
                                                <div className="text-[10px] text-slate-400">{a.email} · {a.department}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-sm font-bold text-slate-700">{a.monthlyCost > 0 ? `$${a.monthlyCost}` : 'Free'}</div>
                                                <div className="text-[10px] text-slate-400">Apps:{a.appsUsed} Flow:{a.flowsUsed}</div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
