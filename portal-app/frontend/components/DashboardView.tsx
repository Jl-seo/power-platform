"use client";

import React from 'react';
import {
    PieChart, Pie, Cell, ResponsiveContainer,
    LineChart, Line, XAxis, YAxis, Tooltip,
    BarChart, Bar,
} from 'recharts';

// ============================================================
// Types
// ============================================================

interface KPI {
    label: string;
    value: string | number;
    sub?: string;
    icon: string;
    color: string;
    trend?: { direction: 'up' | 'down'; value: string };
}

// ============================================================
// Mock Data
// ============================================================

const KPI_DATA: KPI[] = [
    { label: '전체 리소스', value: '1,247', icon: '📦', color: 'blue', trend: { direction: 'up', value: '+23 (7일)' } },
    { label: '보안 점수', value: 'B (78)', icon: '🛡️', color: 'emerald', sub: '/ 100' },
    { label: '거버넌스 준수율', value: '92%', icon: '✅', color: 'indigo', trend: { direction: 'up', value: '+3%' } },
    { label: '월간 절감 기회', value: '₩4.5M', icon: '💰', color: 'amber', sub: '라이선스 최적화' },
];

const RESOURCE_DIST = [
    { name: 'Canvas App', value: 482, fill: '#3b82f6' },
    { name: 'Cloud Flow', value: 391, fill: '#8b5cf6' },
    { name: 'Model App', value: 215, fill: '#06b6d4' },
    { name: 'Copilot Agent', value: 89, fill: '#f59e0b' },
    { name: 'Environment', value: 70, fill: '#10b981' },
];

const SCORE_TREND = [
    { month: '9월', score: 65 }, { month: '10월', score: 68 },
    { month: '11월', score: 72 }, { month: '12월', score: 74 },
    { month: '1월', score: 76 }, { month: '2월', score: 78 },
];

const SUBSIDIARY_DATA = [
    { name: '자회사 A (본사)', score: 78, grade: 'B', resources: 580, risks: 8, color: '#3b82f6' },
    { name: '자회사 B (제조)', score: 92, grade: 'A', resources: 340, risks: 2, color: '#10b981' },
    { name: '자회사 C (유통)', score: 55, grade: 'C', resources: 327, risks: 15, color: '#f59e0b' },
];

const RECENT_ACTIVITIES = [
    { time: '09:00', action: '앱 격리', actor: 'admin@hq.com', target: 'Expense App', type: 'danger' },
    { time: '08:45', action: '보안 스캔 완료', actor: 'system', target: '자회사 A 전체', type: 'info' },
    { time: '08:30', action: '소유권 이전', actor: 'admin@hq.com', target: '12개 앱 → lee@hq.com', type: 'warning' },
    { time: '어제 17:00', action: '환경 생성 요청', actor: 'park@sub-a.com', target: 'Sandbox 환경', type: 'info' },
    { time: '어제 14:30', action: '정책 업데이트', actor: 'admin@hq.com', target: 'DLP 정책 v2', type: 'neutral' },
];

// ============================================================
// Sub-components
// ============================================================

const KPICard = ({ kpi, index }: { kpi: KPI; index: number }) => {
    const colorMap: Record<string, string> = {
        blue: 'from-blue-500 to-blue-600',
        emerald: 'from-emerald-500 to-emerald-600',
        indigo: 'from-indigo-500 to-indigo-600',
        amber: 'from-amber-500 to-amber-600',
    };

    return (
        <div className="kpi-card animate-slide-up" style={{ animationDelay: `${index * 80}ms` }}>
            <div className="flex items-start justify-between mb-3">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colorMap[kpi.color]} flex items-center justify-center text-lg shadow-lg`}>
                    {kpi.icon}
                </div>
                {kpi.trend && (
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full
            ${kpi.trend.direction === 'up' ? 'text-emerald-700 bg-emerald-100' : 'text-rose-700 bg-rose-100'}`}>
                        {kpi.trend.direction === 'up' ? '↑' : '↓'} {kpi.trend.value}
                    </span>
                )}
            </div>
            <div className="kpi-value text-slate-800">{kpi.value}</div>
            <div className="kpi-label">{kpi.sub || kpi.label}</div>
        </div>
    );
};

const ScoreGauge = ({ score }: { score: number }) => {
    const grade = score >= 90 ? 'A' : score >= 70 ? 'B' : score >= 50 ? 'C' : 'D';
    const gradeColor = grade === 'A' ? 'text-emerald-600' : grade === 'B' ? 'text-blue-600' : grade === 'C' ? 'text-amber-600' : 'text-rose-600';
    const barColor = grade === 'A' ? 'bg-emerald-500' : grade === 'B' ? 'bg-blue-500' : grade === 'C' ? 'bg-amber-500' : 'bg-rose-500';

    return (
        <div className="text-center">
            <div className="relative inline-flex items-center justify-center w-28 h-28">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                    <circle cx="50" cy="50" r="40" fill="none" stroke="#e2e8f0" strokeWidth="8" />
                    <circle cx="50" cy="50" r="40" fill="none" stroke={grade === 'A' ? '#10b981' : grade === 'B' ? '#3b82f6' : grade === 'C' ? '#f59e0b' : '#ef4444'}
                        strokeWidth="8" strokeDasharray={`${score * 2.51} 251`} strokeLinecap="round"
                        className="transition-all duration-1000" />
                </svg>
                <div className="absolute text-center">
                    <span className={`text-2xl font-bold ${gradeColor}`}>{grade}</span>
                    <div className="text-xs text-slate-400 font-semibold">{score}</div>
                </div>
            </div>
        </div>
    );
};

// ============================================================
// Main Dashboard View
// ============================================================

export default function DashboardView() {
    return (
        <div className="p-6 space-y-6 animate-fade-in max-w-[1400px]">
            {/* KPI Cards */}
            <div className="grid grid-cols-4 gap-4">
                {KPI_DATA.map((kpi, i) => <KPICard key={kpi.label} kpi={kpi} index={i} />)}
            </div>

            {/* Row 2: Security Score + Score Trend */}
            <div className="grid grid-cols-2 gap-4">
                {/* Security Score */}
                <div className="glass-card p-6">
                    <h3 className="text-sm font-semibold text-slate-700 mb-4">보안 등급</h3>
                    <div className="flex items-center gap-8">
                        <ScoreGauge score={78} />
                        <div className="flex-1 space-y-3">
                            {[
                                { label: 'Critical', count: 0, color: 'bg-slate-200' },
                                { label: 'High', count: 3, color: 'bg-rose-500' },
                                { label: 'Medium', count: 5, color: 'bg-amber-500' },
                                { label: 'Low', count: 12, color: 'bg-blue-500' },
                            ].map(r => (
                                <div key={r.label} className="flex items-center gap-3 text-sm">
                                    <span className={`w-2.5 h-2.5 rounded-full ${r.color}`} />
                                    <span className="text-slate-500 w-16">{r.label}</span>
                                    <div className="flex-1 bg-slate-100 rounded-full h-2">
                                        <div className={`h-2 rounded-full ${r.color} transition-all duration-700`} style={{ width: `${(r.count / 20) * 100}%` }} />
                                    </div>
                                    <span className="text-slate-700 font-semibold w-6 text-right">{r.count}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Score Trend */}
                <div className="glass-card p-6">
                    <h3 className="text-sm font-semibold text-slate-700 mb-4">보안 점수 추이 (6개월)</h3>
                    <ResponsiveContainer width="100%" height={180}>
                        <LineChart data={SCORE_TREND}>
                            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                            <YAxis domain={[50, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                            <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                            <Line type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={3} dot={{ r: 5, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Row 3: Subsidiary + Resource Distribution */}
            <div className="grid grid-cols-5 gap-4">
                {/* Subsidiary Status */}
                <div className="col-span-3 glass-card p-6">
                    <h3 className="text-sm font-semibold text-slate-700 mb-4">자회사별 현황</h3>
                    <div className="space-y-3">
                        {SUBSIDIARY_DATA.map(sub => (
                            <div key={sub.name} className="flex items-center gap-4 p-3 rounded-xl bg-white/60 hover:bg-white transition-all">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-lg">🏢</div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-sm text-slate-800 truncate">{sub.name}</span>
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border
                      ${sub.grade === 'A' ? 'grade-a' : sub.grade === 'B' ? 'grade-b' : sub.grade === 'C' ? 'grade-c' : 'grade-d'}`}>
                                            {sub.grade} ({sub.score})
                                        </span>
                                    </div>
                                    <div className="text-xs text-slate-400 mt-0.5">{sub.resources} 리소스 · {sub.risks} 위험</div>
                                </div>
                                <div className="w-32">
                                    <div className="bg-slate-100 rounded-full h-2">
                                        <div className="h-2 rounded-full transition-all duration-700" style={{ width: `${sub.score}%`, backgroundColor: sub.color }} />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Resource Distribution Donut */}
                <div className="col-span-2 glass-card p-6">
                    <h3 className="text-sm font-semibold text-slate-700 mb-2">리소스 타입 분포</h3>
                    <ResponsiveContainer width="100%" height={170}>
                        <PieChart>
                            <Pie data={RESOURCE_DIST} cx="50%" cy="50%" innerRadius={45} outerRadius={70}
                                dataKey="value" paddingAngle={3} strokeWidth={0}>
                                {RESOURCE_DIST.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                            </Pie>
                            <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }} />
                        </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-1.5 mt-1">
                        {RESOURCE_DIST.map(d => (
                            <div key={d.name} className="flex items-center gap-2 text-xs">
                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.fill }} />
                                <span className="text-slate-500 flex-1">{d.name}</span>
                                <span className="font-semibold text-slate-700">{d.value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Row 4: Recent Activity */}
            <div className="glass-card p-6">
                <h3 className="text-sm font-semibold text-slate-700 mb-4">최근 활동</h3>
                <div className="space-y-2">
                    {RECENT_ACTIVITIES.map((a, i) => {
                        const iconMap: Record<string, string> = { danger: '🔒', info: '🔍', warning: '🔄', neutral: '📋' };
                        const bgMap: Record<string, string> = { danger: 'bg-rose-50 border-rose-100', info: 'bg-blue-50 border-blue-100', warning: 'bg-amber-50 border-amber-100', neutral: 'bg-slate-50 border-slate-100' };
                        return (
                            <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border ${bgMap[a.type]} transition-all hover:shadow-sm`}>
                                <span className="text-lg">{iconMap[a.type]}</span>
                                <div className="flex-1 min-w-0">
                                    <span className="font-semibold text-sm text-slate-700">{a.action}</span>
                                    <span className="text-sm text-slate-500 ml-2">{a.target}</span>
                                </div>
                                <span className="text-xs text-slate-400 whitespace-nowrap">{a.actor}</span>
                                <span className="text-xs text-slate-400 whitespace-nowrap">{a.time}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
