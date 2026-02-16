"use client";

import React, { useState } from 'react';

// ============================================================
// Types & Mock Data
// ============================================================

interface QuarantinedApp {
    id: string;
    name: string;
    type: string;
    environment: string;
    tenant: string;
    reason: string;
    quarantinedBy: string;
    quarantinedAt: string;
}

interface TransferCandidate {
    id: string;
    name: string;
    type: string;
    environment: string;
    owner: string;
    ownerStatus: 'active' | 'inactive' | 'departed';
}

const QUARANTINED: QuarantinedApp[] = [
    { id: 'q-001', name: '경비 청구', type: 'Canvas App', environment: 'Production', tenant: '자회사 A', reason: 'HTTP 커넥터 DLP 위반', quarantinedBy: 'admin@hq.com', quarantinedAt: '2026-02-16 09:15' },
    { id: 'q-002', name: 'Legacy CRM Tool', type: 'Canvas App', environment: 'Default', tenant: '자회사 B', reason: '비인가 외부 커넥터', quarantinedBy: 'system (자동 정책)', quarantinedAt: '2026-02-15 14:00' },
];

const TRANSFER_CANDIDATES: TransferCandidate[] = [
    { id: 'tc-001', name: 'PoC 대시보드', type: 'Canvas App', environment: 'Sandbox', owner: 'choi@hq.com (퇴사)', ownerStatus: 'departed' },
    { id: 'tc-002', name: '온보딩 자동화', type: 'Cloud Flow', environment: 'Sandbox', owner: 'jung@hq.com (비활성)', ownerStatus: 'inactive' },
    { id: 'tc-003', name: 'Test Connector App', type: 'Canvas App', environment: 'Developer', owner: 'kim-temp@hq.com (계약 종료)', ownerStatus: 'departed' },
];

const POLICY_TEMPLATES = [
    { id: 'pol-001', name: '외부 커넥터 앱 격리', trigger: 'HTTP/SMTP 커넥터 + Production 환경', action: '자동 격리 → Teams 알림', status: 'active', appliedTo: ['자회사 A', '자회사 B'], lastTriggered: '2026-02-16 09:00' },
    { id: 'pol-002', name: '미사용 앱 경고', trigger: '90일 미사용 (매주 월요일 스캔)', action: '소유자 이메일 → 30일 후 아카이브', status: 'active', appliedTo: ['전체'], lastTriggered: '2026-02-10 09:00' },
    { id: 'pol-003', name: '전체 공유 차단', trigger: 'Everyone 공유 감지', action: '알림 → 7일 후 자동 제한', status: 'draft', appliedTo: [], lastTriggered: undefined },
];

// ============================================================
// Sub-tabs
// ============================================================

type GovernanceTab = 'quarantine' | 'transfer' | 'policies';

// ============================================================
// Quarantine Tab
// ============================================================

const QuarantineTab = () => {
    const [items, setItems] = useState(QUARANTINED);
    const [releaseModal, setReleaseModal] = useState<QuarantinedApp | null>(null);

    const handleRelease = (id: string) => {
        setItems(prev => prev.filter(i => i.id !== id));
        setReleaseModal(null);
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="text-sm text-slate-500">현재 격리 중: <span className="font-bold text-rose-600">{items.length}건</span></div>
            </div>
            {items.map(app => (
                <div key={app.id} className="glass-card p-5">
                    <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center text-lg">🔒</div>
                        <div className="flex-1">
                            <div className="font-bold text-slate-800">{app.name} <span className="text-xs font-normal text-slate-400">({app.type})</span></div>
                            <div className="text-sm text-slate-500 mt-1">{app.reason}</div>
                            <div className="flex gap-4 text-xs text-slate-400 mt-2">
                                <span>🌐 {app.environment}</span>
                                <span>🏢 {app.tenant}</span>
                                <span>👤 {app.quarantinedBy}</span>
                                <span>🕐 {app.quarantinedAt}</span>
                            </div>
                        </div>
                        <button id={`release-${app.id}`} onClick={() => setReleaseModal(app)}
                            className="px-4 py-2 bg-emerald-50 text-emerald-700 text-sm font-semibold rounded-xl border border-emerald-200 hover:bg-emerald-100 transition-all">
                            🔓 격리 해제
                        </button>
                    </div>
                </div>
            ))}
            {items.length === 0 && (
                <div className="text-center py-16 text-slate-400">
                    <div className="text-5xl mb-4">✅</div>
                    <div className="text-lg font-medium">격리된 앱이 없습니다</div>
                </div>
            )}

            {releaseModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm animate-fade-in" onClick={() => setReleaseModal(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-[450px] p-6 animate-scale-in" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-slate-800 mb-3">격리 해제 확인</h3>
                        <p className="text-sm text-slate-500 mb-4">
                            <span className="font-semibold text-slate-700">{releaseModal.name}</span>의 격리를 해제하시겠습니까?<br />
                            사용자가 다시 앱에 접근할 수 있게 됩니다.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button onClick={() => setReleaseModal(null)} className="btn-secondary px-5">취소</button>
                            <button id="confirm-release" onClick={() => handleRelease(releaseModal.id)}
                                className="px-5 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 transition-all">
                                격리 해제
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ============================================================
// Transfer Tab
// ============================================================

const TransferTab = () => {
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [newOwner, setNewOwner] = useState('');
    const [transferred, setTransferred] = useState<Set<string>>(new Set());

    const toggleSelect = (id: string) => {
        setSelected(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const handleTransfer = () => {
        if (!newOwner || selected.size === 0) return;
        setTransferred(prev => { const next = new Set(Array.from(prev)); selected.forEach(id => next.add(id)); return next; });
        setSelected(new Set());
        setNewOwner('');
    };

    const candidates = TRANSFER_CANDIDATES.filter(c => !transferred.has(c.id));

    return (
        <div className="space-y-5">
            {/* Departed Users Alert */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                <span className="text-2xl">⚠️</span>
                <div>
                    <div className="font-semibold text-amber-800 text-sm">퇴사/비활성 사용자 감지</div>
                    <div className="text-xs text-amber-600 mt-0.5">아래 리소스의 소유자가 퇴사하거나 비활성 상태입니다. 소유권 이전이 필요합니다.</div>
                </div>
            </div>

            {/* Candidate List */}
            <div className="space-y-2">
                {candidates.map(c => (
                    <div key={c.id} className={`glass-card p-4 flex items-center gap-4 cursor-pointer transition-all
            ${selected.has(c.id) ? 'ring-2 ring-blue-400 bg-blue-50/50' : ''}`}
                        onClick={() => toggleSelect(c.id)}>
                        <input type="checkbox" id={`transfer-${c.id}`} checked={selected.has(c.id)} onChange={() => toggleSelect(c.id)}
                            className="w-4 h-4 rounded text-blue-600" />
                        <div className="flex-1">
                            <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm text-slate-800">{c.name}</span>
                                <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded">{c.type}</span>
                            </div>
                            <div className="flex gap-4 text-xs text-slate-400 mt-1">
                                <span>🌐 {c.environment}</span>
                                <span className={c.ownerStatus === 'departed' ? 'text-rose-500' : 'text-amber-500'}>👤 {c.owner}</span>
                            </div>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-lg border
              ${c.ownerStatus === 'departed' ? 'bg-rose-50 text-rose-600 border-rose-200' : 'bg-amber-50 text-amber-600 border-amber-200'}`}>
                            {c.ownerStatus === 'departed' ? '퇴사' : '비활성'}
                        </span>
                    </div>
                ))}
                {candidates.length === 0 && (
                    <div className="text-center py-16 text-slate-400">
                        <div className="text-5xl mb-4">🎉</div>
                        <div className="text-lg font-medium">이전 대상이 없습니다</div>
                    </div>
                )}
            </div>

            {/* Transfer Action */}
            {selected.size > 0 && (
                <div className="sticky bottom-4 bg-white/90 backdrop-blur-xl border border-slate-200 rounded-2xl p-4 shadow-lg animate-slide-up">
                    <div className="flex items-center gap-4">
                        <span className="text-sm font-semibold text-slate-700">{selected.size}개 선택</span>
                        <div className="flex-1">
                            <label htmlFor="new-owner" className="sr-only">새 소유자</label>
                            <input id="new-owner" name="newOwner" type="email" placeholder="새 소유자 이메일 입력..."
                                className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={newOwner} onChange={e => setNewOwner(e.target.value)} />
                        </div>
                        <button id="btn-transfer" onClick={handleTransfer} disabled={!newOwner}
                            className="btn-primary px-6 disabled:opacity-50 disabled:cursor-not-allowed">
                            🔄 일괄 이전
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

// ============================================================
// Policies Tab
// ============================================================

const PoliciesTab = () => (
    <div className="space-y-4">
        <div className="flex items-center justify-between">
            <div className="text-sm text-slate-500">등록된 정책: <span className="font-bold text-blue-600">{POLICY_TEMPLATES.length}건</span></div>
            <button id="btn-new-policy" className="btn-primary text-sm">+ 새 정책 만들기</button>
        </div>
        {POLICY_TEMPLATES.map(p => (
            <div key={p.id} className="glass-card p-5">
                <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg
            ${p.status === 'active' ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                        {p.status === 'active' ? '🛡️' : '📝'}
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-slate-800">{p.name}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border
                ${p.status === 'active' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                                {p.status === 'active' ? '활성' : '초안'}
                            </span>
                        </div>
                        <div className="text-sm text-slate-500 space-y-1">
                            <div>트리거: <span className="font-medium text-slate-600">{p.trigger}</span></div>
                            <div>액션: <span className="font-medium text-slate-600">{p.action}</span></div>
                        </div>
                        <div className="flex gap-4 text-xs text-slate-400 mt-2">
                            <span>대상: {p.appliedTo.length > 0 ? p.appliedTo.join(', ') : '미적용'}</span>
                            {p.lastTriggered && <span>마지막 실행: {p.lastTriggered}</span>}
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">편집</button>
                        <button className="px-3 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 rounded-lg hover:bg-rose-100">
                            {p.status === 'active' ? '비활성화' : '삭제'}
                        </button>
                    </div>
                </div>
            </div>
        ))}
    </div>
);

// ============================================================
// Main Governance View
// ============================================================

export default function GovernanceView() {
    const [activeTab, setActiveTab] = useState<GovernanceTab>('quarantine');

    const tabs: { key: GovernanceTab; label: string; icon: string; count?: number }[] = [
        { key: 'quarantine', label: '격리 관리', icon: '🔒', count: QUARANTINED.length },
        { key: 'transfer', label: '소유권 이전', icon: '🔄', count: TRANSFER_CANDIDATES.length },
        { key: 'policies', label: '정책 관리', icon: '🛡️', count: POLICY_TEMPLATES.length },
    ];

    return (
        <div className="p-6 space-y-6 animate-fade-in max-w-[1200px]">
            {/* Header */}
            <div>
                <h1 className="text-xl font-bold text-slate-800">거버넌스 센터</h1>
                <p className="text-sm text-slate-500 mt-0.5">앱 격리, 소유권 이전, 정책을 관리합니다</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-slate-200 pb-1">
                {tabs.map(tab => (
                    <button key={tab.key} id={`gov-tab-${tab.key}`}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-xl transition-all
              ${activeTab === tab.key
                                ? 'text-blue-600 bg-blue-50 border-b-2 border-blue-600'
                                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>
                        <span>{tab.icon}</span>
                        <span>{tab.label}</span>
                        {tab.count !== undefined && (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full
                ${activeTab === tab.key ? 'bg-blue-200 text-blue-700' : 'bg-slate-200 text-slate-600'}`}>
                                {tab.count}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'quarantine' && <QuarantineTab />}
            {activeTab === 'transfer' && <TransferTab />}
            {activeTab === 'policies' && <PoliciesTab />}
        </div>
    );
}
