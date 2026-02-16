"use client";

import React, { useState } from 'react';

// ============================================================
// Types & Mock Data
// ============================================================

interface Risk {
    id: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    title: string;
    description: string;
    resource: string;
    resourceType: string;
    environment: string;
    tenant: string;
    detectedAt: string;
    action: { label: string; type: string };
    recommendation: string;
}

const MOCK_RISKS: Risk[] = [
    { id: 'risk-001', severity: 'high', title: 'HTTP 커넥터 사용 (DLP 위반)', description: '프로덕션 환경에서 HTTP 커넥터를 사용하는 캔버스 앱이 감지되었습니다. DLP 정책에 의해 차단 대상입니다.', resource: '경비 청구', resourceType: 'Canvas App', environment: 'Production', tenant: '자회사 A', detectedAt: '2026-02-16 09:00', action: { label: '격리하기', type: 'quarantine' }, recommendation: 'Custom Connector로 전환하거나 앱을 격리하세요.' },
    { id: 'risk-002', severity: 'high', title: '전체 조직 공유', description: '경비 청구 앱이 Everyone (전체 조직)에 공유되어 있습니다. 민감한 데이터 접근 위험이 있습니다.', resource: '경비 청구', resourceType: 'Canvas App', environment: 'Production', tenant: '자회사 A', detectedAt: '2026-02-16 09:00', action: { label: '공유 제한', type: 'restrict' }, recommendation: '특정 보안 그룹으로 공유 범위를 제한하세요.' },
    { id: 'risk-003', severity: 'high', title: 'HTTP 커넥터 사용 (DLP 위반)', description: '일일 동기화 Flow에서 HTTP 커넥터를 사용하고 있습니다.', resource: '일일 동기화', resourceType: 'Cloud Flow', environment: 'Production', tenant: '자회사 A', detectedAt: '2026-02-16 09:00', action: { label: '격리하기', type: 'quarantine' }, recommendation: 'Custom Connector 또는 Premium 커넥터로 전환하세요.' },
    { id: 'risk-004', severity: 'medium', title: '미사용 리소스 (90일+)', description: '온보딩 자동화 Flow가 30일 이상 실행되지 않았습니다.', resource: '온보딩 자동화', resourceType: 'Cloud Flow', environment: 'Sandbox', tenant: '자회사 A', detectedAt: '2026-02-15 09:00', action: { label: '소유자 알림', type: 'notify' }, recommendation: '소유자에게 연락하여 필요 여부를 확인하세요.' },
    { id: 'risk-005', severity: 'medium', title: '미사용 리소스 (90일+)', description: 'PoC 대시보드가 120일간 비활성 상태입니다.', resource: 'PoC 대시보드', resourceType: 'Canvas App', environment: 'Sandbox', tenant: '자회사 A', detectedAt: '2026-02-15 09:00', action: { label: '아카이브', type: 'archive' }, recommendation: '더 이상 필요 없다면 아카이브 처리하세요.' },
    { id: 'risk-006', severity: 'low', title: '프리미엄 커넥터 (비용)', description: 'IT 지원 봇에서 Azure OpenAI 커넥터를 사용합니다. 비용을 모니터링하세요.', resource: 'IT 지원 봇', resourceType: 'Copilot Agent', environment: 'Developer', tenant: '자회사 A', detectedAt: '2026-02-14 09:00', action: { label: '비용 확인', type: 'license' }, recommendation: '월 사용량 및 API 호출 비용을 리뷰하세요.' },
    { id: 'risk-007', severity: 'medium', title: '전체 조직 공유', description: '출퇴근 체크 앱이 Everyone에 공유되어 있습니다.', resource: '출퇴근 체크', resourceType: 'Canvas App', environment: 'Default', tenant: '자회사 B', detectedAt: '2026-02-16 09:00', action: { label: '공유 제한', type: 'restrict' }, recommendation: '보안 그룹별 공유로 전환하세요.' },
    { id: 'risk-008', severity: 'low', title: '프리미엄 커넥터 (비용)', description: 'SQL Server 커넥터를 사용하고 있어 프리미엄 라이선스가 필요합니다.', resource: '생산 관리', resourceType: 'Canvas App', environment: 'Production', tenant: '자회사 B', detectedAt: '2026-02-14 09:00', action: { label: '비용 확인', type: 'license' }, recommendation: '라이선스 비용 대비 사용 빈도를 확인하세요.' },
];

// ============================================================
// Components
// ============================================================

const SeverityBadge = ({ severity }: { severity: string }) => {
    const config: Record<string, { bg: string; text: string; dot: string }> = {
        critical: { bg: 'bg-rose-100 border-rose-200', text: 'text-rose-700', dot: 'bg-rose-500' },
        high: { bg: 'bg-rose-50 border-rose-200', text: 'text-rose-600', dot: 'bg-rose-500' },
        medium: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-600', dot: 'bg-amber-500' },
        low: { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-600', dot: 'bg-blue-500' },
    };
    const c = config[severity] || config.low;
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${c.bg} ${c.text}`}>
            <span className={`w-2 h-2 rounded-full ${c.dot}`} />
            {severity.toUpperCase()}
        </span>
    );
};

const ActionModal = ({ risk, onClose, onConfirm }: { risk: Risk; onClose: () => void; onConfirm: () => void }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm animate-fade-in" onClick={onClose}>
        <div className="bg-white rounded-2xl shadow-2xl w-[480px] p-6 animate-scale-in" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-800 mb-2">{risk.action.label} 확인</h3>
            <div className="bg-slate-50 rounded-xl p-4 mb-4 text-sm space-y-2">
                <div className="flex justify-between"><span className="text-slate-500">리소스</span><span className="font-semibold">{risk.resource}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">환경</span><span className="font-semibold">{risk.environment}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">위험</span><span className="font-semibold">{risk.title}</span></div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-5 text-sm text-amber-700">
                ⚠️ 이 작업은 즉시 적용됩니다. 격리된 앱은 사용자가 접근할 수 없습니다.
            </div>
            <div className="flex gap-3 justify-end">
                <button id="modal-cancel" onClick={onClose} className="btn-secondary px-5">취소</button>
                <button id="modal-confirm" onClick={onConfirm} className="btn-danger px-5">
                    {risk.action.label}
                </button>
            </div>
        </div>
    </div>
);

// ============================================================
// Main Security Center View
// ============================================================

export default function SecurityView() {
    const [severityFilter, setSeverityFilter] = useState<string>('all');
    const [actionModal, setActionModal] = useState<Risk | null>(null);
    const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());

    const filtered = MOCK_RISKS.filter(r => {
        if (resolvedIds.has(r.id)) return false;
        return severityFilter === 'all' || r.severity === severityFilter;
    });

    const counts = { critical: 0, high: 0, medium: 0, low: 0 };
    MOCK_RISKS.filter(r => !resolvedIds.has(r.id)).forEach(r => counts[r.severity]++);
    const totalRisks = Object.values(counts).reduce((a, b) => a + b, 0);

    const score = Math.max(0, 100 - counts.critical * 10 - counts.high * 10 - counts.medium * 5 - counts.low * 2);
    const grade = score >= 90 ? 'A' : score >= 70 ? 'B' : score >= 50 ? 'C' : 'D';
    const gradeColor = grade === 'A' ? 'text-emerald-600 bg-emerald-50' : grade === 'B' ? 'text-blue-600 bg-blue-50' : grade === 'C' ? 'text-amber-600 bg-amber-50' : 'text-rose-600 bg-rose-50';

    const handleAction = (risk: Risk) => setActionModal(risk);
    const confirmAction = () => {
        if (actionModal) {
            setResolvedIds(prev => new Set(prev).add(actionModal.id));
            setActionModal(null);
        }
    };

    return (
        <div className="p-6 space-y-6 animate-fade-in max-w-[1200px]">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-slate-800">보안 센터</h1>
                    <p className="text-sm text-slate-500 mt-0.5">위험 요소를 탐지하고 즉시 조치합니다</p>
                </div>
                <button id="btn-scan" className="btn-primary">
                    🔍 스캔 실행
                </button>
            </div>

            {/* Score + Counts */}
            <div className="grid grid-cols-5 gap-4">
                <div className="glass-card p-5 text-center">
                    <div className={`text-4xl font-black ${gradeColor.split(' ')[0]}`}>{grade}</div>
                    <div className="text-2xl font-bold text-slate-700">{score}<span className="text-sm text-slate-400 font-normal"> / 100</span></div>
                    <div className="text-xs text-slate-400 mt-1">보안 점수</div>
                </div>
                {(['critical', 'high', 'medium', 'low'] as const).map(sev => {
                    const colors: Record<string, string> = { critical: 'text-rose-600', high: 'text-rose-500', medium: 'text-amber-500', low: 'text-blue-500' };
                    return (
                        <button key={sev} id={`severity-${sev}`}
                            onClick={() => setSeverityFilter(sev === severityFilter ? 'all' : sev)}
                            className={`glass-card p-5 text-center transition-all ${severityFilter === sev ? 'ring-2 ring-blue-400' : ''}`}>
                            <div className={`text-2xl font-bold ${colors[sev]}`}>{counts[sev]}</div>
                            <div className="text-xs text-slate-500 font-semibold uppercase mt-1">{sev}</div>
                        </button>
                    );
                })}
            </div>

            {/* Filter bar */}
            <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500">{filtered.length} / {totalRisks} 위험</span>
                {severityFilter !== 'all' && (
                    <button onClick={() => setSeverityFilter('all')} className="text-xs text-blue-600 hover:underline">필터 해제</button>
                )}
            </div>

            {/* Risk List */}
            <div className="space-y-3">
                {filtered.map((risk, i) => (
                    <div key={risk.id}
                        className="glass-card p-5 animate-slide-up"
                        style={{ animationDelay: `${i * 60}ms` }}>
                        <div className="flex items-start gap-4">
                            <div className="pt-0.5"><SeverityBadge severity={risk.severity} /></div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="font-bold text-slate-800">{risk.title}</span>
                                </div>
                                <p className="text-sm text-slate-500 mb-2">{risk.description}</p>
                                <div className="flex flex-wrap gap-3 text-xs text-slate-400">
                                    <span>📦 {risk.resource}</span>
                                    <span>🌐 {risk.environment}</span>
                                    <span>🏢 {risk.tenant}</span>
                                    <span>🕐 {risk.detectedAt}</span>
                                </div>
                                <div className="mt-2 flex items-center gap-2 text-xs">
                                    <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">💡 {risk.recommendation}</span>
                                </div>
                            </div>
                            <button
                                id={`action-${risk.id}`}
                                onClick={() => handleAction(risk)}
                                className={`flex-shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all
                  ${risk.action.type === 'quarantine' ? 'bg-rose-600 text-white hover:bg-rose-700 shadow-lg shadow-rose-200' :
                                        risk.action.type === 'restrict' ? 'bg-amber-500 text-white hover:bg-amber-600 shadow-lg shadow-amber-200' :
                                            risk.action.type === 'notify' ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200' :
                                                'bg-slate-600 text-white hover:bg-slate-700 shadow-lg shadow-slate-200'}`}>
                                {risk.action.label}
                            </button>
                        </div>
                    </div>
                ))}
                {filtered.length === 0 && (
                    <div className="text-center py-16 text-slate-400">
                        <div className="text-5xl mb-4">🎉</div>
                        <div className="text-lg font-medium">모든 위험이 해결되었습니다!</div>
                    </div>
                )}
            </div>

            {/* Modal */}
            {actionModal && <ActionModal risk={actionModal} onClose={() => setActionModal(null)} onConfirm={confirmAction} />}
        </div>
    );
}
