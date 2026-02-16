"use client";

import React, { useState, useMemo } from 'react';

// ============================================================
// Types & Mock Data
// ============================================================

type AuditCategory = 'governance' | 'security' | 'selfservice' | 'admin' | 'system';

interface AuditEntry {
    id: string;
    timestamp: string;
    category: AuditCategory;
    action: string;
    actor: string;
    target: string;
    details: string;
    tenant: string;
    result: 'success' | 'failure';
}

const CAT_CONFIG: Record<AuditCategory, { label: string; icon: string; color: string }> = {
    governance: { label: '거버넌스', icon: '🛡️', color: 'bg-blue-100 text-blue-700' },
    security: { label: '보안', icon: '🔒', color: 'bg-rose-100 text-rose-700' },
    selfservice: { label: '셀프서비스', icon: '🎫', color: 'bg-purple-100 text-purple-700' },
    admin: { label: '관리', icon: '⚙️', color: 'bg-slate-100 text-slate-700' },
    system: { label: '시스템', icon: '🤖', color: 'bg-emerald-100 text-emerald-700' },
};

const MOCK_AUDIT: AuditEntry[] = [
    { id: 'aud-001', timestamp: '2026-02-16 09:15:32', category: 'governance', action: '앱 격리', actor: 'admin@hq.com', target: '경비 청구 (Canvas App)', details: 'HTTP 커넥터 DLP 위반으로 앱 격리됨', tenant: '자회사 A', result: 'success' },
    { id: 'aud-002', timestamp: '2026-02-16 09:00:00', category: 'security', action: '보안 스캔 실행', actor: 'system', target: '자회사 A 전체', details: '8건 위험 감지 (3 High, 5 Medium)', tenant: '자회사 A', result: 'success' },
    { id: 'aud-003', timestamp: '2026-02-16 08:30:12', category: 'governance', action: '소유권 이전', actor: 'admin@hq.com', target: 'PoC 대시보드 → lee@hq.com', details: '퇴사자(choi@hq.com) 소유 앱 이전', tenant: '자회사 A', result: 'success' },
    { id: 'aud-004', timestamp: '2026-02-15 17:20:00', category: 'selfservice', action: '환경 생성 요청', actor: 'park@sub-a.com', target: 'Sandbox 환경', details: 'AI PoC 프로젝트용 Sandbox 요청 (대기 중)', tenant: '자회사 A', result: 'success' },
    { id: 'aud-005', timestamp: '2026-02-15 14:00:45', category: 'governance', action: '앱 격리', actor: 'system (자동 정책)', target: 'Legacy CRM Tool', details: '비인가 외부 커넥터 사용 감지 → 자동 격리', tenant: '자회사 B', result: 'success' },
    { id: 'aud-006', timestamp: '2026-02-15 11:30:00', category: 'admin', action: '정책 업데이트', actor: 'admin@hq.com', target: 'DLP 정책 v2', details: 'HTTP/SMTP 커넥터 차단 규칙 추가', tenant: '전체', result: 'success' },
    { id: 'aud-007', timestamp: '2026-02-14 16:00:00', category: 'selfservice', action: 'DLP 예외 신청', actor: 'choi@hq.com', target: 'HTTP 커넥터', details: 'SAP ERP 연동 목적 30일 임시 허용 신청', tenant: '자회사 A', result: 'success' },
    { id: 'aud-008', timestamp: '2026-02-14 09:00:00', category: 'selfservice', action: '프로덕션 배포 요청', actor: 'kim@hq.com', target: 'HR 휴가 신청 v2.1', details: 'Sandbox → Production 배포 요청', tenant: '자회사 A', result: 'success' },
    { id: 'aud-009', timestamp: '2026-02-13 14:30:00', category: 'security', action: '공유 제한', actor: 'admin@hq.com', target: '경비 청구 앱', details: 'Everyone 공유 → HR Team 그룹으로 제한', tenant: '자회사 A', result: 'success' },
    { id: 'aud-010', timestamp: '2026-02-12 14:30:00', category: 'selfservice', action: '환경 생성 승인', actor: 'admin@hq.com', target: 'Teams 환경', details: '유통팀 Teams 환경 생성 승인 처리', tenant: '자회사 C', result: 'success' },
    { id: 'aud-011', timestamp: '2026-02-12 10:00:00', category: 'system', action: '주간 미사용 스캔', actor: 'system', target: '전체 환경', details: '5건 비활성 리소스 감지 → 소유자 알림 발송', tenant: '전체', result: 'success' },
    { id: 'aud-012', timestamp: '2026-02-10 15:00:00', category: 'selfservice', action: '커넥터 신청 반려', actor: 'admin@hq.com', target: 'Azure OpenAI 커넥터', details: '비용 검토 미완료. 월 비용 산정 후 재신청 요망', tenant: '자회사 A', result: 'failure' },
];

// ============================================================
// Main Audit Log View
// ============================================================

export default function AuditLogView() {
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [dateRange, setDateRange] = useState<string>('7d');

    const filtered = useMemo(() => {
        return MOCK_AUDIT.filter(entry => {
            const matchSearch = !searchQuery ||
                entry.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
                entry.actor.toLowerCase().includes(searchQuery.toLowerCase()) ||
                entry.target.toLowerCase().includes(searchQuery.toLowerCase()) ||
                entry.details.toLowerCase().includes(searchQuery.toLowerCase());
            const matchCategory = categoryFilter === 'all' || entry.category === categoryFilter;
            return matchSearch && matchCategory;
        });
    }, [searchQuery, categoryFilter]);

    const categoryCounts: Record<string, number> = {};
    MOCK_AUDIT.forEach(e => { categoryCounts[e.category] = (categoryCounts[e.category] || 0) + 1; });

    return (
        <div className="p-6 space-y-6 animate-fade-in max-w-[1200px]">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-slate-800">감사 로그</h1>
                    <p className="text-sm text-slate-500 mt-0.5">모든 관리 작업과 시스템 이벤트를 추적합니다</p>
                </div>
                <button id="btn-export" className="btn-secondary">📥 CSV 내보내기</button>
            </div>

            {/* Filters */}
            <div className="glass-card p-4 flex items-center gap-4 flex-wrap">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px]">
                    <svg className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input id="audit-search" name="search" type="text" placeholder="액션, 대상, 실행자 검색..."
                        className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                </div>

                {/* Category Filter */}
                <div className="flex gap-1.5">
                    <button id="audit-cat-all" onClick={() => setCategoryFilter('all')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
              ${categoryFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                        전체
                    </button>
                    {Object.entries(CAT_CONFIG).map(([key, conf]) => (
                        <button key={key} id={`audit-cat-${key}`}
                            onClick={() => setCategoryFilter(key === categoryFilter ? 'all' : key)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
                ${categoryFilter === key ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                            {conf.icon} {conf.label} ({categoryCounts[key] || 0})
                        </button>
                    ))}
                </div>

                {/* Date Range */}
                <select id="audit-date-range" name="dateRange" value={dateRange} onChange={e => setDateRange(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white">
                    <option value="1d">오늘</option>
                    <option value="7d">최근 7일</option>
                    <option value="30d">최근 30일</option>
                    <option value="90d">최근 90일</option>
                </select>
            </div>

            {/* Results count */}
            <div className="text-xs text-slate-400">{filtered.length}건 표시</div>

            {/* Timeline */}
            <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-[22px] top-0 bottom-0 w-0.5 bg-slate-200" />

                <div className="space-y-4">
                    {filtered.map((entry, i) => {
                        const catConf = CAT_CONFIG[entry.category];
                        return (
                            <div key={entry.id}
                                className="relative flex gap-4 animate-slide-up"
                                style={{ animationDelay: `${i * 40}ms` }}>
                                {/* Timeline dot */}
                                <div className={`relative z-10 w-11 h-11 rounded-xl flex items-center justify-center text-base flex-shrink-0
                  ${entry.result === 'failure' ? 'bg-rose-100' : catConf.color}`}>
                                    {entry.result === 'failure' ? '❌' : catConf.icon}
                                </div>

                                {/* Content */}
                                <div className={`flex-1 glass-card p-4 ${entry.result === 'failure' ? 'border-rose-200' : ''}`}>
                                    <div className="flex items-start justify-between mb-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-sm text-slate-800">{entry.action}</span>
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${catConf.color}`}>{catConf.label}</span>
                                            {entry.result === 'failure' && (
                                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-600">실패</span>
                                            )}
                                        </div>
                                        <span className="text-xs text-slate-400 whitespace-nowrap">{entry.timestamp}</span>
                                    </div>
                                    <div className="text-sm text-slate-600 mb-1.5">📎 {entry.target}</div>
                                    <div className="text-xs text-slate-500">{entry.details}</div>
                                    <div className="flex gap-4 text-[11px] text-slate-400 mt-2">
                                        <span>👤 {entry.actor}</span>
                                        <span>🏢 {entry.tenant}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    {filtered.length === 0 && (
                        <div className="text-center py-16 text-slate-400 ml-16">
                            <div className="text-5xl mb-4">📋</div>
                            <div className="text-lg font-medium">감사 로그가 없습니다</div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
