"use client";

import React, { useState, useMemo } from 'react';
import ViewToggle, { type ViewMode } from './ViewToggle';

// ============================================================
// Types & Mock Data
// ============================================================

type Severity = 'critical' | 'high' | 'medium' | 'low';

interface SecurityRisk {
    id: string;
    title: string;
    severity: Severity;
    resource: string;
    resourceType: string;
    environment: string;
    tenant: string;
    owner: string;
    detectedAt: string;
    description: string;
    action: string;
    resolved: boolean;
}

const SEV_CONFIG: Record<Severity, { label: string; class: string; icon: string; score: number }> = {
    critical: { label: '긴급', class: 'bg-rose-100 text-rose-700 border-rose-200', icon: '🔴', score: 30 },
    high: { label: '높음', class: 'bg-orange-100 text-orange-700 border-orange-200', icon: '🟠', score: 20 },
    medium: { label: '보통', class: 'bg-amber-100 text-amber-700 border-amber-200', icon: '🟡', score: 10 },
    low: { label: '낮음', class: 'bg-blue-100 text-blue-700 border-blue-200', icon: '🔵', score: 5 },
};

const MOCK_RISKS: SecurityRisk[] = [
    { id: 'risk-001', title: 'HTTP 커넥터 DLP 위반', severity: 'critical', resource: '경비 청구 앱', resourceType: 'Canvas App', environment: 'Production', tenant: '자회사 A', owner: 'kim@hq.com', detectedAt: '2026-02-16 08:00', description: 'Business 데이터 그룹에서 HTTP 커넥터 사용 감지', action: '격리', resolved: false },
    { id: 'risk-002', title: 'Everyone 공유', severity: 'high', resource: 'HR 휴가 신청', resourceType: 'Canvas App', environment: 'Production', tenant: '자회사 A', owner: 'kim@hq.com', detectedAt: '2026-02-15 14:00', description: '조직 전체(Everyone)에 공유된 민감 앱', action: '공유 제한', resolved: false },
    { id: 'risk-003', title: '비인가 커넥터', severity: 'high', resource: 'Legacy CRM', resourceType: 'Canvas App', environment: 'Production', tenant: '자회사 B', owner: 'lee@sub-b.com', detectedAt: '2026-02-15 10:00', description: '허가되지 않은 외부 커넥터(SMTP) 사용', action: '격리', resolved: false },
    { id: 'risk-004', title: '미소유 리소스', severity: 'medium', resource: 'PoC Dashboard', resourceType: 'Canvas App', environment: 'Sandbox', tenant: '자회사 A', owner: '퇴사자', detectedAt: '2026-02-14 09:00', description: '퇴사자 소유 앱 — 소유권 이전 필요', action: '이전', resolved: false },
    { id: 'risk-005', title: '과도한 권한', severity: 'medium', resource: '재고 관리 Flow', resourceType: 'Cloud Flow', environment: 'Production', tenant: '자회사 C', owner: 'na@sub-c.com', detectedAt: '2026-02-13 16:00', description: 'Environment Admin 권한으로 실행 중 — 최소 권한 원칙 위반', action: '권한 축소', resolved: false },
    { id: 'risk-006', title: 'Trial 라이선스 만료 임박', severity: 'medium', resource: '고객 분석', resourceType: 'Model-Driven App', environment: 'Default', tenant: '자회사 B', owner: 'seo@sub-b.com', detectedAt: '2026-02-12 11:00', description: 'Trial 라이선스 7일 후 만료 — 유료 전환 또는 비활성화 필요', action: '알림', resolved: false },
    { id: 'risk-007', title: '비활성 커넥터', severity: 'low', resource: 'SAP Connector v1', resourceType: 'Custom Connector', environment: 'Production', tenant: '자회사 A', owner: '퇴사자', detectedAt: '2026-02-10 09:00', description: '230일간 미사용된 커넥터 — 제거 또는 이전 검토', action: '제거', resolved: false },
    { id: 'risk-008', title: 'Dataverse 직접 접근', severity: 'low', resource: '출장 정산 Flow', resourceType: 'Cloud Flow', environment: 'Production', tenant: '자회사 B', owner: 'lee@sub-b.com', detectedAt: '2026-02-09 15:00', description: 'Service Account로 Dataverse 직접 접근 — API 경유 권장', action: '알림', resolved: false },
];

// ============================================================
// Confirmation Modal
// ============================================================

const ConfirmModal = ({ risk, onConfirm, onClose }: {
    risk: SecurityRisk; onConfirm: () => void; onClose: () => void;
}) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm animate-fade-in" onClick={onClose}>
        <div className="bg-white rounded-2xl shadow-2xl w-[420px] p-6 animate-scale-in" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-800 mb-2">⚠️ 조치 확인</h3>
            <p className="text-sm text-slate-600 mb-4">
                <strong>{risk.resource}</strong>에 대해 <strong>{risk.action}</strong> 조치를 실행하시겠습니까?
            </p>
            <div className="flex justify-end gap-3">
                <button onClick={onClose} className="btn-secondary px-5">취소</button>
                <button id="confirm-action" onClick={onConfirm} className="btn-primary px-5">✅ 실행</button>
            </div>
        </div>
    </div>
);

// ============================================================
// Main Security View
// ============================================================

export default function SecurityView() {
    const [viewMode, setViewMode] = useState<ViewMode>('table');
    const [risks, setRisks] = useState(MOCK_RISKS);
    const [sevFilter, setSevFilter] = useState<string>('all');
    const [tenantFilter, setTenantFilter] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [confirmRisk, setConfirmRisk] = useState<SecurityRisk | null>(null);

    const filtered = useMemo(() => {
        return risks.filter(r => {
            if (r.resolved) return false;
            if (sevFilter !== 'all' && r.severity !== sevFilter) return false;
            if (tenantFilter !== 'all' && r.tenant !== tenantFilter) return false;
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                return r.title.toLowerCase().includes(q) || r.resource.toLowerCase().includes(q) || r.owner.toLowerCase().includes(q);
            }
            return true;
        });
    }, [risks, sevFilter, tenantFilter, searchQuery]);

    const activeRisks = risks.filter(r => !r.resolved);
    const score = Math.max(0, 100 - activeRisks.reduce((s, r) => s + SEV_CONFIG[r.severity].score, 0));
    const tenants = Array.from(new Set(MOCK_RISKS.map(r => r.tenant)));

    const handleConfirm = () => {
        if (!confirmRisk) return;
        setRisks(prev => prev.map(r => r.id === confirmRisk.id ? { ...r, resolved: true } : r));
        setConfirmRisk(null);
    };

    return (
        <div className="p-6 space-y-5 animate-fade-in max-w-[1200px]">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-slate-800">보안 센터</h1>
                    <p className="text-sm text-slate-500 mt-0.5">보안 위험을 탐지하고 즉시 조치합니다</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className={`text-center px-5 py-2 rounded-xl border font-bold
            ${score >= 80 ? 'grade-a' : score >= 60 ? 'grade-b' : score >= 40 ? 'grade-c' : 'grade-d'}`}>
                        <div className="text-2xl">{score}</div>
                        <div className="text-[10px] uppercase">보안 점수</div>
                    </div>
                </div>
            </div>

            {/* Severity Summary */}
            <div className="grid grid-cols-4 gap-3">
                {(['critical', 'high', 'medium', 'low'] as const).map(sev => {
                    const conf = SEV_CONFIG[sev];
                    const count = activeRisks.filter(r => r.severity === sev).length;
                    return (
                        <button key={sev} id={`sev-${sev}`}
                            onClick={() => setSevFilter(s => s === sev ? 'all' : sev)}
                            className={`p-3 rounded-xl border text-center transition-all cursor-pointer
                ${sevFilter === sev ? 'ring-2 ring-blue-400 ' + conf.class : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                            <div className="text-lg">{conf.icon}</div>
                            <div className="text-xl font-bold">{count}</div>
                            <div className="text-[10px] font-semibold text-slate-500">{conf.label}</div>
                        </button>
                    );
                })}
            </div>

            {/* Filter Bar */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                    <svg className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input id="sec-search" name="search" type="text" placeholder="위험, 리소스, 소유자 검색..."
                        className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                </div>
                <select id="sec-tenant-filter" name="tenantFilter" value={tenantFilter} onChange={e => setTenantFilter(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white">
                    <option value="all">전체 자회사</option>
                    {tenants.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <ViewToggle mode={viewMode} onChange={setViewMode} totalCount={activeRisks.length} filteredCount={filtered.length} />
            </div>

            {/* TABLE VIEW */}
            {viewMode === 'table' && (
                <div className="glass-card overflow-hidden animate-fade-in">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>심각도</th>
                                <th>위험</th>
                                <th>리소스</th>
                                <th>유형</th>
                                <th>환경</th>
                                <th>자회사</th>
                                <th>소유자</th>
                                <th>감지 일시</th>
                                <th>조치</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((risk, i) => {
                                const sev = SEV_CONFIG[risk.severity];
                                return (
                                    <tr key={risk.id} className="animate-slide-up" style={{ animationDelay: `${i * 25}ms` }}>
                                        <td>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${sev.class}`}>
                                                {sev.icon} {sev.label}
                                            </span>
                                        </td>
                                        <td className="font-semibold text-slate-800">{risk.title}</td>
                                        <td className="text-slate-600">{risk.resource}</td>
                                        <td><span className="badge badge-neutral">{risk.resourceType}</span></td>
                                        <td className="text-slate-500 text-xs">{risk.environment}</td>
                                        <td className="text-slate-500 text-xs">{risk.tenant}</td>
                                        <td className="text-slate-500 text-xs">{risk.owner}</td>
                                        <td className="text-slate-400 text-xs whitespace-nowrap">{risk.detectedAt}</td>
                                        <td>
                                            <button id={`action-${risk.id}`} onClick={() => setConfirmRisk(risk)}
                                                className="text-xs font-bold px-3 py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-all whitespace-nowrap">
                                                ⚡ {risk.action}
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {filtered.length === 0 && (
                        <div className="text-center py-12 text-slate-400">
                            <div className="text-4xl mb-2">✅</div>
                            <div className="font-medium">감지된 위험 없음</div>
                        </div>
                    )}
                </div>
            )}

            {/* CARD VIEW */}
            {viewMode === 'card' && (
                <div className="space-y-3 animate-fade-in">
                    {filtered.map((risk, i) => {
                        const sev = SEV_CONFIG[risk.severity];
                        return (
                            <div key={risk.id} className="glass-card p-5 animate-slide-up" style={{ animationDelay: `${i * 50}ms` }}>
                                <div className="flex items-start gap-4">
                                    <div className="text-2xl">{sev.icon}</div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-bold text-slate-800">{risk.title}</span>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${sev.class}`}>{sev.label}</span>
                                        </div>
                                        <p className="text-sm text-slate-500 mb-2">{risk.description}</p>
                                        <div className="flex gap-4 text-xs text-slate-400">
                                            <span>📎 {risk.resource}</span>
                                            <span>👤 {risk.owner}</span>
                                            <span>🏢 {risk.tenant}</span>
                                            <span>🕐 {risk.detectedAt}</span>
                                        </div>
                                    </div>
                                    <button onClick={() => setConfirmRisk(risk)}
                                        className="btn-primary text-xs px-4 py-1.5 flex-shrink-0">
                                        ⚡ {risk.action}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                    {filtered.length === 0 && (
                        <div className="text-center py-16 text-slate-400">
                            <div className="text-5xl mb-4">✅</div>
                            <div className="text-lg font-medium">감지된 위험 없음</div>
                        </div>
                    )}
                </div>
            )}

            {confirmRisk && <ConfirmModal risk={confirmRisk} onConfirm={handleConfirm} onClose={() => setConfirmRisk(null)} />}
        </div>
    );
}
