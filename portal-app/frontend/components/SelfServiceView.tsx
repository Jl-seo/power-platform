"use client";

import React, { useState, useMemo } from 'react';
import ViewToggle, { type ViewMode } from './ViewToggle';

// ============================================================
// Types & Mock Data
// ============================================================

type RequestStatus = 'pending' | 'approved' | 'rejected';
type RequestType = 'environment' | 'connector' | 'production' | 'dlp-exception';
type Priority = 'urgent' | 'high' | 'normal' | 'low';

interface ServiceRequest {
    id: string;
    type: RequestType;
    priority: Priority;
    title: string;
    description: string;
    businessJustification: string;
    requester: string;
    requesterEmail: string;
    requesterDept: string;
    tenant: string;
    createdAt: string;
    status: RequestStatus;
    approver?: string;
    approvedAt?: string;
    // Type-specific detail fields
    details: Record<string, string>;
    // Cost & Risk
    estimatedCost?: string;
    riskLevel?: string;
    // Attachments/references
    references?: string[];
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

const PRIORITY_CONFIG: Record<Priority, { label: string; class: string }> = {
    urgent: { label: '긴급', class: 'bg-rose-100 text-rose-700 border-rose-200' },
    high: { label: '높음', class: 'bg-orange-100 text-orange-700 border-orange-200' },
    normal: { label: '보통', class: 'bg-blue-100 text-blue-700 border-blue-200' },
    low: { label: '낮음', class: 'bg-slate-100 text-slate-600 border-slate-200' },
};

const MOCK_REQUESTS: ServiceRequest[] = [
    {
        id: 'req-001', type: 'environment', priority: 'high',
        title: 'AI PoC Sandbox 환경 생성 요청',
        description: 'AI Builder와 커스텀 커넥터 테스트를 위한 Sandbox 환경이 필요합니다.',
        businessJustification: 'CTO 직속 AI 혁신 과제(과제번호 AI-2026-03)의 PoC를 진행하기 위해 격리된 Sandbox 환경이 필요합니다. 현재 Default 환경에서 테스트 시 프로덕션 데이터와 혼재되는 문제가 발생하고 있어, 전용 환경 생성이 필수적입니다.',
        requester: '박지성', requesterEmail: 'park@sub-a.com', requesterDept: 'IT혁신팀',
        tenant: '자회사 A', createdAt: '2026-02-16 10:30', status: 'pending',
        details: {
            '환경 타입': 'Sandbox',
            '리전': 'Korea Central',
            '필요 서비스': 'Dataverse, AI Builder, Custom Connector',
            'Dataverse 용량': '2 GB',
            '보안 그룹': 'SG-AI-Innovation',
            '예상 사용 기간': '6개월 (PoC 종료 후 재평가)',
            '예상 사용자 수': '5명',
        },
        estimatedCost: '$150/월 (Dataverse 2GB + AI Builder)',
        riskLevel: '낮음 (Sandbox, 외부 연결 없음)',
        references: ['AI-2026-03 과제 기획서', 'CTO 승인 메일 (2026-02-14)'],
    },
    {
        id: 'req-002', type: 'connector', priority: 'normal',
        title: 'SQL Server 프리미엄 커넥터 사용 신청',
        description: '온프레미스 SQL Server 연결을 위해 프리미엄 커넥터 사용을 신청합니다.',
        businessJustification: '생산관리 시스템(MES)의 실시간 데이터를 Power BI 대시보드에 연동해야 합니다. 현재수동 Excel 추출 방식으로 인해 일 1시간 이상 지연이 발생하며, SQL 커넥터를 통한 자동 연동으로 실시간 모니터링이 가능해집니다.',
        requester: '이민수', requesterEmail: 'lee@sub-b.com', requesterDept: '제조팀',
        tenant: '자회사 B', createdAt: '2026-02-15 14:00', status: 'pending',
        details: {
            '커넥터 종류': 'SQL Server (Premium)',
            '연결 대상': 'on-prem MES DB (10.10.5.20)',
            '게이트웨이': 'On-premises Data Gateway (SubB-GW-01)',
            'DLP 그룹': 'Business Data',
            '접근 계정': 'svc-powerbi@sub-b.com (읽기 전용)',
            '접근 테이블': 'production_log, inventory_status (3개)',
            '데이터 분류': '사내 기밀 (Level 2)',
        },
        estimatedCost: 'Per-User 라이선스 포함 (추가 비용 없음)',
        riskLevel: '보통 (On-premises 연결, 읽기 전용)',
        references: ['네트워크팀 VPN 허용 확인서', 'DBA 접근 권한 승인'],
    },
    {
        id: 'req-003', type: 'production', priority: 'high',
        title: 'HR 휴가 신청 앱 v2.1 프로덕션 배포',
        description: 'Sandbox 테스트 완료된 HR 휴가 신청 앱의 프로덕션 배포를 요청합니다.',
        businessJustification: '기존 v2.0 대비 대리 승인 기능(부재 시 자동 위임)과 연차 자동 계산 로직이 추가되었습니다. HR팀 15명 파일럿 테스트 완료(2주간 이슈 0건). 3/1 연차 정산 전 배포 필요.',
        requester: '김효진', requesterEmail: 'kim@hq.com', requesterDept: 'HR팀',
        tenant: '자회사 A', createdAt: '2026-02-14 09:00', status: 'pending',
        details: {
            '앱 이름': 'HR 휴가 신청',
            '현재 버전': 'v2.0.3',
            '배포 버전': 'v2.1.0',
            '소스 환경': 'HR-Sandbox',
            '대상 환경': 'HR-Production',
            '영향 사용자': '전사 320명',
            '테스트 결과': 'pass (15명 × 2주, 이슈 0건)',
            '롤백 계획': 'v2.0.3 솔루션 백업 완료 (2026-02-13)',
            '배포 희망일': '2026-02-20 (업무 외 시간)',
            '변경 사항': '대리 승인 위임, 연차 자동 계산, UI 개선',
        },
        estimatedCost: '추가 비용 없음 (기존 라이선스)',
        riskLevel: '낮음 (롤백 가능, 파일럿 완료)',
        references: ['v2.1 릴리즈 노트', 'QA 테스트 리포트', '롤백 절차서'],
    },
    {
        id: 'req-004', type: 'dlp-exception', priority: 'urgent',
        title: 'HTTP 커넥터 임시 DLP 예외 (SAP ERP 연동)',
        description: 'SAP ERP API 연동을 위해 HTTP 커넥터 DLP 예외를 신청합니다.',
        businessJustification: '4월 SAP 시스템 전환 완료 전, Power Automate를 통한 구매 승인 워크플로우 통합이 필요합니다. SAP 전용 커넥터 도입 전 임시 방편으로 HTTP 커넥터를 통한 REST API 호출이 유일한 방법입니다. 월 500건의 구매 승인이 수동 처리 중이며, 건당 15분 소요됩니다.',
        requester: '최진호', requesterEmail: 'choi@hq.com', requesterDept: '재무팀',
        tenant: '자회사 A', createdAt: '2026-02-13 16:00', status: 'pending',
        details: {
            '대상 커넥터': 'HTTP (Custom)',
            '호출 대상': 'https://sap-erp.company.com/api/procurement/*',
            '예외 범위': '재무팀 전용 환경 (Finance-Prod)',
            '예외 기간': '30일 (2026-02-20 ~ 2026-03-22)',
            '예외 사유': 'SAP 전용 커넥터 도입 전 임시 조치',
            '보안 조치': 'IP 화이트리스트 + Bearer Token + TLS 1.2',
            '데이터 분류': '민감 (구매 금액, 승인자 정보)',
            '감사 로그': '모든 API 호출 Application Insights에 기록',
            '종료 조건': 'SAP 커넥터 도입 또는 기간 만료 시 자동 차단',
        },
        estimatedCost: '추가 비용 없음',
        riskLevel: '높음 (HTTP 커넥터 + 민감 데이터)',
        references: ['SAP 전환 프로젝트 계획서', '보안팀 사전 검토 의견', '네트워크 방화벽 규칙 요청서'],
    },
    {
        id: 'req-005', type: 'environment', priority: 'normal',
        title: 'Teams 환경 생성 요청 (유통사업부)',
        description: '유통팀 Teams 전용 Power Platform 환경 필요',
        businessJustification: '유통사업부 현장 직원(80명)이 Teams에서 직접 사용할 재고 확인 앱을 배포하기 위한 전용 환경이 필요합니다.',
        requester: '나호준', requesterEmail: 'na@sub-c.com', requesterDept: '유통사업부',
        tenant: '자회사 C', createdAt: '2026-02-12 11:00', status: 'approved',
        approver: 'admin@hq.com', approvedAt: '2026-02-12 14:30',
        details: { '환경 타입': 'Production (Teams)', '예상 사용자 수': '80명' },
        estimatedCost: '$200/월',
        riskLevel: '낮음',
    },
    {
        id: 'req-006', type: 'connector', priority: 'low',
        title: 'Azure OpenAI 커넥터 신청',
        description: 'IT 지원 봇에 GPT 기능 추가를 위한 커넥터 신청',
        businessJustification: '사내 IT 헬프데스크 문의의 60%가 반복 질문(비밀번호 초기화, VPN 설정 등). GPT 기반 자동 응답으로 티켓 처리 시간을 50% 단축 목표.',
        requester: '박재원', requesterEmail: 'park2@hq.com', requesterDept: 'IT혁신팀',
        tenant: '자회사 A', createdAt: '2026-02-10 09:00', status: 'rejected',
        approver: 'admin@hq.com', approvedAt: '2026-02-10 15:00',
        details: {
            '커넥터': 'Azure OpenAI Service',
            '모델': 'GPT-4o',
            '예상 토큰': '월 500K tokens',
            '반려 사유': '월 비용 산정 미완료 (예상 $200~$500/월). 비용 계획서 첨부 후 재신청 요망.',
        },
        estimatedCost: '미산출 (재신청 시 필수)',
        riskLevel: '보통 (Azure 내부, 데이터 유출 방지 필요)',
    },
];

// Saved View Tabs
interface ViewTab { id: string; label: string; icon: string; filter: (r: ServiceRequest) => boolean; }
const VIEW_TABS: ViewTab[] = [
    { id: 'all', label: '전체', icon: '📋', filter: () => true },
    { id: 'pending', label: '승인 대기', icon: '⏳', filter: r => r.status === 'pending' },
    { id: 'approved', label: '승인 완료', icon: '✅', filter: r => r.status === 'approved' },
    { id: 'rejected', label: '반려', icon: '❌', filter: r => r.status === 'rejected' },
    { id: 'urgent', label: '긴급/높음', icon: '🔴', filter: r => r.priority === 'urgent' || r.priority === 'high' },
];

// ============================================================
// Request Detail Modal (Rich)
// ============================================================

const RequestModal = ({ request, onClose, onApprove, onReject }: {
    request: ServiceRequest; onClose: () => void;
    onApprove: (id: string) => void; onReject: (id: string) => void;
}) => {
    const typeConf = TYPE_CONFIG[request.type];
    const statusConf = STATUS_CONFIG[request.status];
    const prioConf = PRIORITY_CONFIG[request.priority];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-[680px] max-h-[85vh] overflow-y-auto animate-scale-in" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="p-6 border-b border-slate-100">
                    <div className="flex items-center gap-3 mb-2">
                        <span className="text-2xl">{typeConf.icon}</span>
                        <h3 className="text-lg font-bold text-slate-800 flex-1">{request.title}</h3>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${typeConf.color}`}>{typeConf.label}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusConf.class}`}>{statusConf.icon} {statusConf.label}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${prioConf.class}`}>{prioConf.label}</span>
                        <span className="text-[10px] text-slate-400 ml-auto">{request.id}</span>
                    </div>
                </div>

                <div className="p-6 space-y-5">
                    {/* Requester Info */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="p-3 bg-slate-50 rounded-xl">
                            <div className="text-[10px] text-slate-400 uppercase font-semibold">신청자</div>
                            <div className="text-sm font-semibold mt-0.5">{request.requester}</div>
                            <div className="text-[10px] text-slate-400">{request.requesterEmail}</div>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-xl">
                            <div className="text-[10px] text-slate-400 uppercase font-semibold">부서 · 자회사</div>
                            <div className="text-sm font-semibold mt-0.5">{request.requesterDept}</div>
                            <div className="text-[10px] text-slate-400">{request.tenant}</div>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-xl">
                            <div className="text-[10px] text-slate-400 uppercase font-semibold">신청일</div>
                            <div className="text-sm font-semibold mt-0.5">{request.createdAt}</div>
                            {request.approvedAt && <div className="text-[10px] text-slate-400">처리: {request.approvedAt}</div>}
                        </div>
                    </div>

                    {/* Business Justification */}
                    <div>
                        <h4 className="text-xs font-bold text-slate-600 uppercase mb-2">📝 비즈니스 사유</h4>
                        <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl text-sm text-slate-700 leading-relaxed">
                            {request.businessJustification}
                        </div>
                    </div>

                    {/* Detail Fields */}
                    <div>
                        <h4 className="text-xs font-bold text-slate-600 uppercase mb-2">📋 신청 상세</h4>
                        <div className="border border-slate-100 rounded-xl overflow-hidden">
                            {Object.entries(request.details).map(([key, value], i) => (
                                <div key={key} className={`flex text-sm ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                                    <div className="w-40 flex-shrink-0 px-4 py-2.5 text-slate-500 font-medium border-r border-slate-100">{key}</div>
                                    <div className="flex-1 px-4 py-2.5 text-slate-800">{value}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Cost & Risk */}
                    <div className="grid grid-cols-2 gap-3">
                        {request.estimatedCost && (
                            <div className="p-3 bg-slate-50 rounded-xl">
                                <div className="text-[10px] text-slate-400 uppercase font-semibold">💰 예상 비용</div>
                                <div className="text-sm font-semibold mt-0.5 text-slate-700">{request.estimatedCost}</div>
                            </div>
                        )}
                        {request.riskLevel && (
                            <div className="p-3 bg-slate-50 rounded-xl">
                                <div className="text-[10px] text-slate-400 uppercase font-semibold">⚠️ 위험 수준</div>
                                <div className={`text-sm font-semibold mt-0.5 ${request.riskLevel.includes('높음') ? 'text-rose-600' :
                                        request.riskLevel.includes('보통') ? 'text-amber-600' : 'text-emerald-600'}`}>
                                    {request.riskLevel}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* References */}
                    {request.references && request.references.length > 0 && (
                        <div>
                            <h4 className="text-xs font-bold text-slate-600 uppercase mb-2">📎 첨부/참조 문서</h4>
                            <div className="flex flex-wrap gap-2">
                                {request.references.map((ref, i) => (
                                    <span key={i} className="text-xs px-3 py-1.5 bg-slate-100 rounded-lg text-slate-600 hover:bg-slate-200 cursor-pointer">
                                        📄 {ref}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="p-6 pt-0 flex gap-3 justify-end border-t border-slate-100 mt-2 pt-4">
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
                return r.title.toLowerCase().includes(q) || r.requester.toLowerCase().includes(q) ||
                    r.requesterEmail.toLowerCase().includes(q) || r.requesterDept.toLowerCase().includes(q);
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
                <div>
                    <h1 className="text-xl font-bold text-slate-800">셀프서비스 포털</h1>
                    <p className="text-sm text-slate-500 mt-0.5">환경, 커넥터, 배포, DLP 예외를 신청하고 승인합니다</p>
                </div>
                <button id="btn-new-request" className="btn-primary">➕ 새 요청</button>
            </div>

            {/* View Tabs */}
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
                    <input id="ss-search" name="search" type="text" placeholder="제목, 신청자, 부서 검색..."
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
                                <th>우선순위</th>
                                <th>상태</th>
                                <th>유형</th>
                                <th>제목</th>
                                <th>신청자</th>
                                <th>부서</th>
                                <th>자회사</th>
                                <th>비용</th>
                                <th>위험</th>
                                <th>신청일</th>
                                <th>처리</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((req, i) => {
                                const typeConf = TYPE_CONFIG[req.type];
                                const statusConf = STATUS_CONFIG[req.status];
                                const prioConf = PRIORITY_CONFIG[req.priority];
                                return (
                                    <tr key={req.id} onClick={() => setSelectedRequest(req)} className="cursor-pointer animate-slide-up" style={{ animationDelay: `${i * 25}ms` }}>
                                        <td>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${prioConf.class}`}>{prioConf.label}</span>
                                        </td>
                                        <td>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusConf.class}`}>{statusConf.icon} {statusConf.label}</span>
                                        </td>
                                        <td>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${typeConf.color}`}>{typeConf.icon} {typeConf.label}</span>
                                        </td>
                                        <td className="font-semibold text-slate-800 max-w-[200px] truncate" title={req.title}>{req.title}</td>
                                        <td>
                                            <div className="text-slate-700 text-xs">{req.requester}</div>
                                            <div className="text-slate-400 text-[10px]">{req.requesterEmail}</div>
                                        </td>
                                        <td className="text-xs text-slate-500">{req.requesterDept}</td>
                                        <td className="text-xs text-slate-500">{req.tenant}</td>
                                        <td className="text-xs text-slate-500">{req.estimatedCost || '-'}</td>
                                        <td>
                                            {req.riskLevel && (
                                                <span className={`text-[10px] font-bold ${req.riskLevel.includes('높음') ? 'text-rose-600' :
                                                        req.riskLevel.includes('보통') ? 'text-amber-600' : 'text-emerald-600'}`}>
                                                    {req.riskLevel.split(' ')[0]}
                                                </span>
                                            )}
                                        </td>
                                        <td className="text-xs text-slate-400 whitespace-nowrap">{req.createdAt}</td>
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
                        const prioConf = PRIORITY_CONFIG[req.priority];
                        return (
                            <button key={req.id} onClick={() => setSelectedRequest(req)}
                                className="w-full glass-card p-5 text-left animate-slide-up" style={{ animationDelay: `${i * 50}ms` }}>
                                <div className="flex items-start gap-4">
                                    <div className="text-2xl">{typeConf.icon}</div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                            <span className="font-bold text-slate-800">{req.title}</span>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusConf.class}`}>{statusConf.icon} {statusConf.label}</span>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${prioConf.class}`}>{prioConf.label}</span>
                                        </div>
                                        <p className="text-xs text-slate-500 mb-2 line-clamp-1">{req.businessJustification}</p>
                                        <div className="flex gap-4 text-xs text-slate-400">
                                            <span>👤 {req.requester} ({req.requesterDept})</span>
                                            <span>🏢 {req.tenant}</span>
                                            <span>💰 {req.estimatedCost || '-'}</span>
                                            <span>🕐 {req.createdAt}</span>
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
