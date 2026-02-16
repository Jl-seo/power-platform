"use client";

import React, { useState } from 'react';

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

const MOCK_REQUESTS: ServiceRequest[] = [
    { id: 'req-001', type: 'environment', title: 'Sandbox 환경 생성 요청', description: 'AI PoC 프로젝트를 위한 Sandbox 환경이 필요합니다. Dataverse + AI Builder 포함.', requester: '박지성', requesterEmail: 'park@sub-a.com', tenant: '자회사 A', createdAt: '2026-02-16 10:30', status: 'pending', details: { '환경 타입': 'Sandbox', '필요 서비스': 'Dataverse, AI Builder', '예상 기간': '3개월', '사업 근거': 'AI 기반 고객 분류 PoC' } },
    { id: 'req-002', type: 'connector', title: 'SQL Server 커넥터 사용 신청', description: '생산 관리 앱에서 온프레미스 SQL Server 연결이 필요합니다.', requester: '이민수', requesterEmail: 'lee@sub-b.com', tenant: '자회사 B', createdAt: '2026-02-15 14:00', status: 'pending', details: { '커넥터': 'SQL Server (Premium)', '대상 앱': '생산 현황 대시보드', '연결 방식': 'On-premises Data Gateway', '라이선스': '보유 (Per User)' } },
    { id: 'req-003', type: 'production', title: 'HR 휴가 신청 앱 프로덕션 배포', description: 'Sandbox에서 검증 완료된 HR 휴가 신청 앱을 프로덕션 환경에 배포 요청합니다.', requester: '김효진', requesterEmail: 'kim@hq.com', tenant: '자회사 A', createdAt: '2026-02-14 09:00', status: 'pending', details: { '소스 환경': 'Sandbox', '대상 환경': 'Production', '앱 이름': 'HR 휴가 신청 v2.1', '테스트 완료': '✅ UAT 통과' } },
    { id: 'req-004', type: 'dlp-exception', title: 'HTTP 커넥터 DLP 예외 신청', description: '외부 ERP 연동을 위해 HTTP 커넥터가 필요합니다. Custom Connector 개발 전 임시 사용 신청.', requester: '최진호', requesterEmail: 'choi@hq.com', tenant: '자회사 A', createdAt: '2026-02-13 16:00', status: 'pending', details: { '커넥터': 'HTTP', '사유': '외부 ERP API 연동 (SAP)', '기간': '30일 (Custom Connector 개발 완료까지)', '위험 완화': 'IP 화이트리스트 + API Key 인증' } },
    { id: 'req-005', type: 'environment', title: 'Teams 환경 생성 요청', description: '유통팀 Teams 전용 환경 요청.', requester: '나호준', requesterEmail: 'na@sub-c.com', tenant: '자회사 C', createdAt: '2026-02-12 11:00', status: 'approved', approver: 'admin@hq.com', approvedAt: '2026-02-12 14:30', details: { '환경 타입': 'Teams', '필요 서비스': 'Dataverse for Teams' } },
    { id: 'req-006', type: 'connector', title: 'Azure OpenAI 커넥터 신청', description: 'IT 지원 봇에 GPT 기능 추가를 위한 커넥터 신청.', requester: '박재원', requesterEmail: 'park2@hq.com', tenant: '자회사 A', createdAt: '2026-02-10 09:00', status: 'rejected', approver: 'admin@hq.com', approvedAt: '2026-02-10 15:00', details: { '사유 거절': '비용 검토 미완료. 월 예상 비용 산정 후 재신청 요망.' } },
];

const STATUS_CONFIG: Record<RequestStatus, { label: string; class: string; icon: string }> = {
    pending: { label: '대기 중', class: 'bg-amber-100 text-amber-700 border-amber-200', icon: '⏳' },
    approved: { label: '승인', class: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: '✅' },
    rejected: { label: '반려', class: 'bg-rose-100 text-rose-700 border-rose-200', icon: '❌' },
};

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
            <div className="bg-white rounded-2xl shadow-2xl w-[560px] max-h-[80vh] overflow-y-auto animate-scale-in" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="p-6 border-b border-slate-100">
                    <div className="flex items-center gap-3 mb-2">
                        <span className="text-2xl">{typeConf.icon}</span>
                        <div className="flex-1">
                            <h3 className="text-lg font-bold text-slate-800">{request.title}</h3>
                            <div className="flex items-center gap-2 mt-1">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${typeConf.color}`}>{typeConf.label}</span>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusConf.class}`}>{statusConf.icon} {statusConf.label}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="p-6 space-y-5">
                    {/* Description */}
                    <div>
                        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">설명</h4>
                        <p className="text-sm text-slate-600">{request.description}</p>
                    </div>

                    {/* Requester Info */}
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="p-3 bg-slate-50 rounded-xl">
                            <div className="text-xs text-slate-400">신청자</div>
                            <div className="font-semibold text-slate-700 mt-0.5">{request.requester}</div>
                            <div className="text-xs text-slate-400">{request.requesterEmail}</div>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-xl">
                            <div className="text-xs text-slate-400">자회사</div>
                            <div className="font-semibold text-slate-700 mt-0.5">{request.tenant}</div>
                            <div className="text-xs text-slate-400">{request.createdAt}</div>
                        </div>
                    </div>

                    {/* Details */}
                    <div>
                        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">상세 정보</h4>
                        <div className="space-y-2">
                            {Object.entries(request.details).map(([key, value]) => (
                                <div key={key} className="flex justify-between p-2.5 bg-slate-50 rounded-lg text-sm">
                                    <span className="text-slate-500">{key}</span>
                                    <span className="font-medium text-slate-700">{value}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Approval Info */}
                    {request.approver && (
                        <div className="bg-slate-50 rounded-xl p-3 text-sm">
                            <div className="text-xs text-slate-400">처리자: {request.approver} · {request.approvedAt}</div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 pt-0 flex gap-3 justify-end">
                    <button id="modal-close" onClick={onClose} className="btn-secondary px-5">닫기</button>
                    {request.status === 'pending' && (
                        <>
                            <button id="modal-reject" onClick={() => onReject(request.id)}
                                className="btn-danger px-5">❌ 반려</button>
                            <button id="modal-approve" onClick={() => onApprove(request.id)}
                                className="btn-primary px-5">✅ 승인</button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

// ============================================================
// New Request Form Modal
// ============================================================

const NewRequestModal = ({ onClose, onSubmit }: {
    onClose: () => void; onSubmit: (req: ServiceRequest) => void;
}) => {
    const [formType, setFormType] = useState<RequestType>('environment');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');

    const handleSubmit = () => {
        if (!title) return;
        onSubmit({
            id: `req-new-${Date.now()}`,
            type: formType,
            title,
            description,
            requester: '현재 사용자',
            requesterEmail: 'me@company.com',
            tenant: '자회사 A',
            createdAt: new Date().toLocaleString('ko-KR'),
            status: 'pending',
            details: {},
        });
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-[500px] animate-scale-in" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-slate-100">
                    <h3 className="text-lg font-bold text-slate-800">새 요청 만들기</h3>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label htmlFor="req-type" className="text-xs font-semibold text-slate-500 uppercase">요청 유형</label>
                        <select id="req-type" name="type" value={formType} onChange={e => setFormType(e.target.value as RequestType)}
                            className="w-full mt-1 px-3 py-2.5 rounded-xl border border-slate-200 text-sm">
                            {Object.entries(TYPE_CONFIG).map(([k, v]) => (
                                <option key={k} value={k}>{v.icon} {v.label}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="req-title" className="text-xs font-semibold text-slate-500 uppercase">제목</label>
                        <input id="req-title" name="title" type="text" value={title} onChange={e => setTitle(e.target.value)}
                            placeholder="요청 제목을 입력하세요"
                            className="w-full mt-1 px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                        <label htmlFor="req-desc" className="text-xs font-semibold text-slate-500 uppercase">설명</label>
                        <textarea id="req-desc" name="description" value={description} onChange={e => setDescription(e.target.value)}
                            placeholder="상세 사유를 입력하세요" rows={3}
                            className="w-full mt-1 px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                    </div>
                </div>
                <div className="p-6 pt-0 flex gap-3 justify-end">
                    <button onClick={onClose} className="btn-secondary px-5">취소</button>
                    <button id="btn-submit-request" onClick={handleSubmit} disabled={!title} className="btn-primary px-5 disabled:opacity-50">📨 제출</button>
                </div>
            </div>
        </div>
    );
};

// ============================================================
// Main Self-Service View
// ============================================================

export default function SelfServiceView() {
    const [requests, setRequests] = useState(MOCK_REQUESTS);
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);
    const [showNewForm, setShowNewForm] = useState(false);

    const filtered = requests.filter(r => statusFilter === 'all' || r.status === statusFilter);
    const counts = { pending: 0, approved: 0, rejected: 0 };
    requests.forEach(r => counts[r.status]++);

    const handleApprove = (id: string) => {
        setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'approved' as RequestStatus, approver: 'admin@hq.com', approvedAt: new Date().toLocaleString('ko-KR') } : r));
        setSelectedRequest(null);
    };

    const handleReject = (id: string) => {
        setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'rejected' as RequestStatus, approver: 'admin@hq.com', approvedAt: new Date().toLocaleString('ko-KR') } : r));
        setSelectedRequest(null);
    };

    const handleNewSubmit = (req: ServiceRequest) => {
        setRequests(prev => [req, ...prev]);
    };

    return (
        <div className="p-6 space-y-6 animate-fade-in max-w-[1200px]">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-slate-800">셀프서비스 포털</h1>
                    <p className="text-sm text-slate-500 mt-0.5">환경, 커넥터, 배포 요청을 신청하고 관리합니다</p>
                </div>
                <button id="btn-new-request" onClick={() => setShowNewForm(true)} className="btn-primary">
                    ➕ 새 요청
                </button>
            </div>

            {/* Status Summary */}
            <div className="grid grid-cols-3 gap-4">
                {(['pending', 'approved', 'rejected'] as const).map(s => {
                    const conf = STATUS_CONFIG[s];
                    return (
                        <button key={s} id={`filter-${s}`}
                            onClick={() => setStatusFilter(s === statusFilter ? 'all' : s)}
                            className={`glass-card p-4 text-center transition-all ${statusFilter === s ? 'ring-2 ring-blue-400' : ''}`}>
                            <div className="text-2xl mb-1">{conf.icon}</div>
                            <div className="text-2xl font-bold text-slate-700">{counts[s]}</div>
                            <div className="text-xs text-slate-500 font-semibold">{conf.label}</div>
                        </button>
                    );
                })}
            </div>

            {/* Request List */}
            <div className="space-y-3">
                {filtered.map((req, i) => {
                    const typeConf = TYPE_CONFIG[req.type];
                    const statusConf = STATUS_CONFIG[req.status];
                    return (
                        <button key={req.id} id={`request-${req.id}`}
                            onClick={() => setSelectedRequest(req)}
                            className="w-full glass-card p-5 text-left animate-slide-up"
                            style={{ animationDelay: `${i * 50}ms` }}>
                            <div className="flex items-start gap-4">
                                <div className="text-2xl">{typeConf.icon}</div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-bold text-slate-800">{req.title}</span>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusConf.class}`}>
                                            {statusConf.icon} {statusConf.label}
                                        </span>
                                    </div>
                                    <p className="text-sm text-slate-500 line-clamp-1">{req.description}</p>
                                    <div className="flex gap-4 text-xs text-slate-400 mt-2">
                                        <span>👤 {req.requester}</span>
                                        <span>🏢 {req.tenant}</span>
                                        <span>🕐 {req.createdAt}</span>
                                    </div>
                                </div>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${typeConf.color} flex-shrink-0`}>{typeConf.label}</span>
                            </div>
                        </button>
                    );
                })}
                {filtered.length === 0 && (
                    <div className="text-center py-16 text-slate-400">
                        <div className="text-5xl mb-4">📭</div>
                        <div className="text-lg font-medium">해당 상태의 요청이 없습니다</div>
                    </div>
                )}
            </div>

            {/* Modals */}
            {selectedRequest && (
                <RequestModal request={selectedRequest} onClose={() => setSelectedRequest(null)}
                    onApprove={handleApprove} onReject={handleReject} />
            )}
            {showNewForm && <NewRequestModal onClose={() => setShowNewForm(false)} onSubmit={handleNewSubmit} />}
        </div>
    );
}
