"use client";

import React, { useState, useMemo } from 'react';
import ViewToggle, { type ViewMode } from './ViewToggle';

// ============================================================
// Types & Mock Data
// ============================================================

type RequestStatus = 'pending' | 'approved' | 'rejected';
type RequestType = 'environment' | 'connector' | 'production' | 'dlp-exception';

interface ServiceRequest {
    id: string;
    type: RequestType;
    title: string;
    description: string;
    requester: string;
    requesterEmail: string;
    tenant: string;
    createdAt: string;
    status: RequestStatus;
    approver?: string;
    approvedAt?: string;
    details: Record<string, string>;
}

const TYPE_CONFIG: Record<RequestType, { label: string; icon: string; color: string }> = {
    environment: { label: '환경 생성', icon: '🌐', color: 'bg-blue-100 text-blue-700 border-blue-200' },
    connector: { label: '커넥터 신청', icon: '🔌', color: 'bg-purple-100 text-purple-700 border-purple-200' },
    production: { label: '프로덕션 배포', icon: '🚀', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    'dlp-exception': { label: 'DLP 예외', icon: '🛡️', color: 'bg-amber-100 text-amber-700 border-amber-200' },
};

const STATUS_CONFIG: Record<RequestStatus, { label: string; class: string; icon: string }> = {
    pending: { label: '대기 중', class: 'bg-amber-100 text-amber-700 border-amber-200', icon: '⏳' },
    approved: { label: '승인', class: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: '✅' },
    rejected: { label: '반려', class: 'bg-rose-100 text-rose-700 border-rose-200', icon: '❌' },
};

const MOCK_REQUESTS: ServiceRequest[] = [
    { id: 'req-001', type: 'environment', title: 'Sandbox 환경 생성 요청', description: 'AI PoC 프로젝트를 위한 Sandbox 환경이 필요합니다.', requester: '박지성', requesterEmail: 'park@sub-a.com', tenant: '자회사 A', createdAt: '2026-02-16 10:30', status: 'pending', details: { '환경 타입': 'Sandbox', '필요 서비스': 'Dataverse, AI Builder' } },
    { id: 'req-002', type: 'connector', title: 'SQL Server 커넥터 사용 신청', description: '온프레미스 SQL Server 연결 필요', requester: '이민수', requesterEmail: 'lee@sub-b.com', tenant: '자회사 B', createdAt: '2026-02-15 14:00', status: 'pending', details: { '커넥터': 'SQL Server (Premium)' } },
    { id: 'req-003', type: 'production', title: 'HR 휴가 신청 앱 프로덕션 배포', description: 'Sandbox → Production 배포 요청', requester: '김효진', requesterEmail: 'kim@hq.com', tenant: '자회사 A', createdAt: '2026-02-14 09:00', status: 'pending', details: { '앱 이름': 'HR 휴가 신청 v2.1' } },
    { id: 'req-004', type: 'dlp-exception', title: 'HTTP 커넥터 DLP 예외 신청', description: 'SAP ERP 연동 목적 30일 임시 허용', requester: '최진호', requesterEmail: 'choi@hq.com', tenant: '자회사 A', createdAt: '2026-02-13 16:00', status: 'pending', details: { '기간': '30일' } },
    { id: 'req-005', type: 'environment', title: 'Teams 환경 생성 요청', description: '유통팀 Teams 전용 환경', requester: '나호준', requesterEmail: 'na@sub-c.com', tenant: '자회사 C', createdAt: '2026-02-12 11:00', status: 'approved', approver: 'admin@hq.com', approvedAt: '2026-02-12 14:30', details: {} },
    { id: 'req-006', type: 'connector', title: 'Azure OpenAI 커넥터 신청', description: 'IT 지원 봇에 GPT 기능 추가', requester: '박재원', requesterEmail: 'park2@hq.com', tenant: '자회사 A', createdAt: '2026-02-10 09:00', status: 'rejected', approver: 'admin@hq.com', approvedAt: '2026-02-10 15:00', details: { '사유 거절': '비용 검토 미완료' } },
];

// Saved View Tabs
interface ViewTab { id: string; label: string; icon: string; filter: (r: ServiceRequest) => boolean; }
const VIEW_TABS: ViewTab[] = [
    { id: 'all', label: '전체', icon: '📋', filter: () => true },
    { id: 'pending', label: '승인 대기', icon: '⏳', filter: r => r.status === 'pending' },
    { id: 'approved', label: '승인 완료', icon: '✅', filter: r => r.status === 'approved' },
    { id: 'rejected', label: '반려', icon: '❌', filter: r => r.status === 'rejected' },
    { id: 'my-tenant', label: '자회사 A', icon: '🏢', filter: r => r.tenant === '자회사 A' },
];

// ============================================================
// Request Detail Modal
// ============================================================

const RequestModal = ({ request, onClose, onApprove, onReject }: {
    request: ServiceRequest; onClose: () => void;
    onApprove: (id: string) => void; onReject: (id: string) => void;
}) => {
    const typeConf = TYPE_CONFIG[request.type];
    const statusConf = STATUS_CONFIG[request.status];
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-[520px] max-h-[80vh] overflow-y-auto animate-scale-in" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-slate-100 flex items-center gap-3">
                    <span className="text-2xl">{typeConf.icon}</span>
                    <div className="flex-1">
                        <h3 className="text-lg font-bold text-slate-800">{request.title}</h3>
                        <div className="flex gap-2 mt-1">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${typeConf.color}`}>{typeConf.label}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusConf.class}`}>{statusConf.icon} {statusConf.label}</span>
                        </div>
                    </div>
                </div>
                <div className="p-6 space-y-4">
                    <p className="text-sm text-slate-600">{request.description}</p>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="p-3 bg-slate-50 rounded-xl"><div className="text-xs text-slate-400">신청자</div><div className="font-semibold mt-0.5">{request.requester} ({request.requesterEmail})</div></div>
                        <div className="p-3 bg-slate-50 rounded-xl"><div className="text-xs text-slate-400">자회사 · 신청일</div><div className="font-semibold mt-0.5">{request.tenant} · {request.createdAt}</div></div>
                    </div>
                    {Object.keys(request.details).length > 0 && (
                        <div className="space-y-1.5">
                            {Object.entries(request.details).map(([k, v]) => (
                                <div key={k} className="flex justify-between p-2.5 bg-slate-50 rounded-lg text-sm">
                                    <span className="text-slate-500">{k}</span><span className="font-medium">{v}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="p-6 pt-0 flex gap-3 justify-end">
                    <button onClick={onClose} className="btn-secondary px-5">닫기</button>
                    {request.status === 'pending' && (
                        <>
                            <button id="modal-reject" onClick={() => onReject(request.id)} className="btn-danger px-5">❌ 반려</button>
                            <button id="modal-approve" onClick={() => onApprove(request.id)} className="btn-primary px-5">✅ 승인</button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

// ============================================================
// Main Self-Service View
// ============================================================

export default function SelfServiceView() {
    const [viewMode, setViewMode] = useState<ViewMode>('table');
    const [requests, setRequests] = useState(MOCK_REQUESTS);
    const [activeTab, setActiveTab] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);

    const currentTab = VIEW_TABS.find(t => t.id === activeTab) || VIEW_TABS[0];
    const filtered = useMemo(() => {
        return requests.filter(r => {
            if (!currentTab.filter(r)) return false;
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                return r.title.toLowerCase().includes(q) || r.requester.toLowerCase().includes(q) || r.requesterEmail.toLowerCase().includes(q);
            }
            return true;
        });
    }, [requests, activeTab, searchQuery, currentTab]);

    const handleApprove = (id: string) => {
        setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'approved' as RequestStatus, approver: 'admin@hq.com', approvedAt: new Date().toLocaleString('ko-KR') } : r));
        setSelectedRequest(null);
    };
    const handleReject = (id: string) => {
        setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'rejected' as RequestStatus, approver: 'admin@hq.com', approvedAt: new Date().toLocaleString('ko-KR') } : r));
        setSelectedRequest(null);
    };

    return (
        <div className="p-6 space-y-4 animate-fade-in max-w-[1200px]">
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-bold text-slate-800">셀프서비스 포털</h1>
                <button id="btn-new-request" className="btn-primary">➕ 새 요청</button>
            </div>

            {/* View Tabs (Airtable-style) */}
            <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto">
                {VIEW_TABS.map(tab => {
                    const count = requests.filter(tab.filter).length;
                    return (
                        <button key={tab.id} id={`tab-${tab.id}`} onClick={() => setActiveTab(tab.id)}
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
                    <input id="ss-search" name="search" type="text" placeholder="제목, 신청자 검색..."
                        className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                </div>
                <ViewToggle mode={viewMode} onChange={setViewMode} totalCount={requests.length} filteredCount={filtered.length} />
            </div>

            {/* TABLE VIEW */}
            {viewMode === 'table' && (
                <div className="glass-card overflow-hidden animate-fade-in">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>상태</th>
                                <th>유형</th>
                                <th>제목</th>
                                <th>신청자</th>
                                <th>자회사</th>
                                <th>신청일</th>
                                <th>처리</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((req, i) => {
                                const typeConf = TYPE_CONFIG[req.type];
                                const statusConf = STATUS_CONFIG[req.status];
                                return (
                                    <tr key={req.id} onClick={() => setSelectedRequest(req)} className="cursor-pointer animate-slide-up" style={{ animationDelay: `${i * 25}ms` }}>
                                        <td>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusConf.class}`}>{statusConf.icon} {statusConf.label}</span>
                                        </td>
                                        <td>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${typeConf.color}`}>{typeConf.icon} {typeConf.label}</span>
                                        </td>
                                        <td className="font-semibold text-slate-800">{req.title}</td>
                                        <td>
                                            <div className="text-slate-700 text-xs">{req.requester}</div>
                                            <div className="text-slate-400 text-[10px]">{req.requesterEmail}</div>
                                        </td>
                                        <td className="text-slate-500 text-xs">{req.tenant}</td>
                                        <td className="text-slate-400 text-xs whitespace-nowrap">{req.createdAt}</td>
                                        <td>
                                            {req.status === 'pending' ? (
                                                <div className="flex gap-1">
                                                    <button id={`approve-${req.id}`} onClick={e => { e.stopPropagation(); handleApprove(req.id); }}
                                                        className="text-[10px] font-bold px-2 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700">✅</button>
                                                    <button id={`reject-${req.id}`} onClick={e => { e.stopPropagation(); handleReject(req.id); }}
                                                        className="text-[10px] font-bold px-2 py-1 rounded-lg bg-rose-600 text-white hover:bg-rose-700">❌</button>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-slate-400">{req.approver}</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {filtered.length === 0 && (
                        <div className="text-center py-12 text-slate-400"><div className="text-4xl mb-2">📭</div><div className="font-medium">요청 없음</div></div>
                    )}
                </div>
            )}

            {/* CARD VIEW */}
            {viewMode === 'card' && (
                <div className="space-y-3 animate-fade-in">
                    {filtered.map((req, i) => {
                        const typeConf = TYPE_CONFIG[req.type];
                        const statusConf = STATUS_CONFIG[req.status];
                        return (
                            <button key={req.id} onClick={() => setSelectedRequest(req)}
                                className="w-full glass-card p-5 text-left animate-slide-up" style={{ animationDelay: `${i * 50}ms` }}>
                                <div className="flex items-start gap-4">
                                    <div className="text-2xl">{typeConf.icon}</div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-bold text-slate-800">{req.title}</span>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusConf.class}`}>{statusConf.icon} {statusConf.label}</span>
                                        </div>
                                        <div className="flex gap-4 text-xs text-slate-400">
                                            <span>👤 {req.requester}</span><span>🏢 {req.tenant}</span><span>🕐 {req.createdAt}</span>
                                        </div>
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}

            {selectedRequest && <RequestModal request={selectedRequest} onClose={() => setSelectedRequest(null)} onApprove={handleApprove} onReject={handleReject} />}
        </div>
    );
}
