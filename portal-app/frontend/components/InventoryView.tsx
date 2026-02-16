"use client";

import React, { useState, useMemo } from 'react';

// ============================================================
// Types
// ============================================================

export interface ResourceDetail {
    name: string;
    type: string;
    properties: {
        displayName?: string;
        environmentId?: string;
        environmentName?: string;
        environmentType?: string;
        ownerId?: string;
        ownerName?: string;
        createdAt?: string;
        modifiedAt?: string;
        sharedWithOrganization?: boolean;
        status?: string;
        connectors?: Array<{ name: string; type: string; dlpViolation?: boolean }>;
        sharedWith?: Array<{ name: string; type: 'user' | 'group' | 'everyone' }>;
    };
}

interface EnvironmentNode {
    id: string;
    name: string;
    type: string;
    resources: ResourceDetail[];
}

interface TenantNode {
    id: string;
    name: string;
    environments: EnvironmentNode[];
}

interface Props {
    tenants: TenantNode[];
    onAction: (action: string, resource: ResourceDetail) => void;
}

// ============================================================
// Mock Data
// ============================================================

export const MOCK_TENANTS: TenantNode[] = [
    {
        id: 'tenant-001', name: '자회사 A (본사)',
        environments: [
            {
                id: 'env-prod-001', name: 'Production', type: 'Production',
                resources: [
                    { name: 'app-001', type: 'microsoft.powerapps/canvasapps', properties: { displayName: 'HR 휴가 신청', environmentId: 'env-prod-001', environmentName: 'Production', environmentType: 'Production', ownerId: 'user-001', ownerName: 'kim@hq.com', createdAt: '2026-01-10T10:00:00Z', modifiedAt: '2026-02-15T09:00:00Z', sharedWithOrganization: false, status: 'active', connectors: [{ name: 'SharePoint', type: 'standard' }, { name: 'Dataverse', type: 'standard' }], sharedWith: [{ name: 'HR Team', type: 'group' }] } },
                    { name: 'app-002', type: 'microsoft.powerapps/canvasapps', properties: { displayName: '경비 청구', environmentId: 'env-prod-001', environmentName: 'Production', environmentType: 'Production', ownerId: 'user-002', ownerName: 'park@hq.com', createdAt: '2026-01-15T14:30:00Z', modifiedAt: '2026-02-14T11:00:00Z', sharedWithOrganization: true, status: 'active', connectors: [{ name: 'SharePoint', type: 'standard' }, { name: 'HTTP', type: 'premium', dlpViolation: true }], sharedWith: [{ name: 'Everyone', type: 'everyone' }] } },
                    { name: 'flow-001', type: 'microsoft.powerautomate/cloudflows', properties: { displayName: '일일 동기화', environmentId: 'env-prod-001', environmentName: 'Production', environmentType: 'Production', ownerId: 'user-001', ownerName: 'kim@hq.com', createdAt: '2025-12-01T09:00:00Z', modifiedAt: '2026-02-16T09:00:00Z', status: 'active', connectors: [{ name: 'Dataverse', type: 'standard' }, { name: 'HTTP', type: 'premium', dlpViolation: true }], sharedWith: [] } },
                    { name: 'app-003', type: 'microsoft.powerapps/modeldrivenapps', properties: { displayName: 'CRM 확장', environmentId: 'env-prod-001', environmentName: 'Production', environmentType: 'Production', ownerId: 'user-003', ownerName: 'choi@hq.com', createdAt: '2025-11-20T16:00:00Z', status: 'active', connectors: [{ name: 'Dataverse', type: 'standard' }], sharedWith: [{ name: 'Sales Team', type: 'group' }] } },
                ],
            },
            {
                id: 'env-sandbox-001', name: 'Sandbox', type: 'Sandbox',
                resources: [
                    { name: 'flow-002', type: 'microsoft.powerautomate/cloudflows', properties: { displayName: '온보딩 자동화', environmentId: 'env-sandbox-001', environmentName: 'Sandbox', environmentType: 'Sandbox', ownerId: 'user-004', ownerName: 'jung@hq.com', createdAt: '2026-01-25T13:15:00Z', status: 'inactive', connectors: [{ name: 'Office 365 Outlook', type: 'standard' }], sharedWith: [] } },
                    { name: 'app-004', type: 'microsoft.powerapps/canvasapps', properties: { displayName: 'PoC 대시보드', environmentId: 'env-sandbox-001', environmentName: 'Sandbox', environmentType: 'Sandbox', ownerId: 'user-003', ownerName: 'choi@hq.com', createdAt: '2025-10-01T10:00:00Z', status: 'inactive', connectors: [], sharedWith: [] } },
                ],
            },
            {
                id: 'env-dev-001', name: 'Developer', type: 'Developer',
                resources: [
                    { name: 'bot-001', type: 'microsoft.copilotstudio/agents', properties: { displayName: 'IT 지원 봇', environmentId: 'env-dev-001', environmentName: 'Developer', environmentType: 'Developer', ownerId: 'user-002', ownerName: 'park@hq.com', createdAt: '2026-02-01T11:00:00Z', status: 'active', connectors: [{ name: 'Dataverse', type: 'standard' }, { name: 'Azure OpenAI', type: 'premium' }], sharedWith: [{ name: 'IT Team', type: 'group' }] } },
                ],
            },
        ],
    },
    {
        id: 'tenant-002', name: '자회사 B (제조)',
        environments: [
            {
                id: 'env-prod-002', name: 'Production', type: 'Production',
                resources: [
                    { name: 'app-005', type: 'microsoft.powerapps/canvasapps', properties: { displayName: '생산 관리', environmentId: 'env-prod-002', environmentName: 'Production', environmentType: 'Production', ownerId: 'user-010', ownerName: 'lee@sub-b.com', createdAt: '2025-09-15T08:00:00Z', status: 'active', connectors: [{ name: 'SQL Server', type: 'premium' }, { name: 'Dataverse', type: 'standard' }], sharedWith: [{ name: 'Factory Team', type: 'group' }] } },
                    { name: 'flow-003', type: 'microsoft.powerautomate/cloudflows', properties: { displayName: '재고 알림', environmentId: 'env-prod-002', environmentName: 'Production', environmentType: 'Production', ownerId: 'user-010', ownerName: 'lee@sub-b.com', createdAt: '2025-10-01T09:00:00Z', status: 'active', connectors: [{ name: 'SQL Server', type: 'premium' }, { name: 'Teams', type: 'standard' }], sharedWith: [] } },
                ],
            },
            {
                id: 'env-default-002', name: 'Default', type: 'Default',
                resources: [
                    { name: 'app-006', type: 'microsoft.powerapps/canvasapps', properties: { displayName: '출퇴근 체크', environmentId: 'env-default-002', environmentName: 'Default', environmentType: 'Default', ownerId: 'user-011', ownerName: 'na@sub-b.com', createdAt: '2026-02-10T07:00:00Z', status: 'active', connectors: [{ name: 'Excel Online', type: 'standard' }], sharedWith: [{ name: 'Everyone', type: 'everyone' }] } },
                ],
            },
        ],
    },
];

// ============================================================
// Helpers
// ============================================================

const typeIcon = (type: string) => {
    if (type.includes('canvasapps')) return '📱';
    if (type.includes('modeldrivenapps')) return '🏗️';
    if (type.includes('cloudflows') || type.includes('agentflows')) return '⚡';
    if (type.includes('agents') || type.includes('copilotstudio')) return '🤖';
    return '📦';
};

const typeLabel = (type: string) => {
    const map: Record<string, string> = {
        'microsoft.powerapps/canvasapps': 'Canvas App',
        'microsoft.powerapps/modeldrivenapps': 'Model App',
        'microsoft.powerautomate/cloudflows': 'Cloud Flow',
        'microsoft.copilotstudio/agents': 'Copilot Agent',
    };
    return map[type] || type.split('/').pop() || type;
};

const envTypeColor = (type: string) => {
    const map: Record<string, string> = {
        Production: 'bg-blue-500',
        Sandbox: 'bg-amber-500',
        Developer: 'bg-emerald-500',
        Default: 'bg-purple-500',
        Teams: 'bg-indigo-500',
    };
    return map[type] || 'bg-slate-500';
};

const formatDate = (iso?: string) => {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' }); }
    catch { return iso; }
};

// ============================================================
// Tree View Component
// ============================================================

const ResourceTreeItem = ({ resource, isSelected, onClick }: {
    resource: ResourceDetail; isSelected: boolean; onClick: () => void;
}) => {
    const hasDlpViolation = resource.properties.connectors?.some(c => c.dlpViolation);
    const isSharedAll = resource.properties.sharedWithOrganization;

    return (
        <button
            onClick={onClick}
            className={`w-full flex items-center gap-2 px-3 py-2 text-left rounded-lg text-sm transition-all duration-150
        ${isSelected
                    ? 'bg-blue-100 text-blue-700 font-medium ring-1 ring-blue-300'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
        >
            <span className="text-base">{typeIcon(resource.type)}</span>
            <span className="flex-1 truncate">{resource.properties.displayName || resource.name}</span>
            {hasDlpViolation && <span className="text-rose-500 text-xs" title="DLP 위반">⚠️</span>}
            {isSharedAll && <span className="text-amber-500 text-xs" title="전체 공유">🔓</span>}
        </button>
    );
};

const EnvironmentTreeItem = ({ env, selectedId, onSelect }: {
    env: EnvironmentNode; selectedId: string | null; onSelect: (r: ResourceDetail) => void;
}) => {
    const [expanded, setExpanded] = useState(true);

    return (
        <div className="mb-1">
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center gap-2 px-2 py-2 text-left rounded-lg hover:bg-slate-50 transition-all text-sm font-medium text-slate-700"
            >
                <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform ${expanded ? 'rotate-90' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
                <span className={`w-2 h-2 rounded-full ${envTypeColor(env.type)}`} />
                <span>🌐 {env.name}</span>
                <span className="ml-auto text-xs text-slate-400 font-normal">{env.resources.length}</span>
            </button>
            {expanded && (
                <div className="ml-6 pl-2 border-l border-slate-200 space-y-0.5">
                    {env.resources.map(r => (
                        <ResourceTreeItem
                            key={r.name}
                            resource={r}
                            isSelected={selectedId === r.name}
                            onClick={() => onSelect(r)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

const TenantTreeItem = ({ tenant, selectedId, onSelect }: {
    tenant: TenantNode; selectedId: string | null; onSelect: (r: ResourceDetail) => void;
}) => {
    const [expanded, setExpanded] = useState(true);
    const totalResources = tenant.environments.reduce((sum, e) => sum + e.resources.length, 0);

    return (
        <div className="mb-2">
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center gap-2 px-2 py-2.5 text-left rounded-xl hover:bg-slate-50 transition-all font-semibold text-slate-800"
            >
                <svg className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? 'rotate-90' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
                <span className="text-lg">🏢</span>
                <span>{tenant.name}</span>
                <span className="ml-auto text-xs text-slate-400 font-normal bg-slate-100 px-2 py-0.5 rounded-full">
                    {tenant.environments.length}환경 · {totalResources}리소스
                </span>
            </button>
            {expanded && (
                <div className="ml-4 space-y-0.5">
                    {tenant.environments.map(env => (
                        <EnvironmentTreeItem
                            key={env.id}
                            env={env}
                            selectedId={selectedId}
                            onSelect={onSelect}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

// ============================================================
// Detail Panel
// ============================================================

const DetailPanel = ({ resource, onAction }: { resource: ResourceDetail; onAction: (action: string) => void }) => (
    <div className="animate-fade-in space-y-5">
        {/* Header */}
        <div>
            <div className="flex items-center gap-3 mb-2">
                <span className="text-3xl">{typeIcon(resource.type)}</span>
                <div>
                    <h2 className="text-xl font-bold text-slate-800">{resource.properties.displayName || resource.name}</h2>
                    <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">{typeLabel(resource.type)}</span>
                </div>
            </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="p-3 bg-slate-50 rounded-xl">
                <div className="text-xs text-slate-400 font-medium">소유자</div>
                <div className="font-semibold text-slate-700 mt-0.5">{resource.properties.ownerName || '—'}</div>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl">
                <div className="text-xs text-slate-400 font-medium">환경</div>
                <div className="font-semibold text-slate-700 mt-0.5">{resource.properties.environmentName || '—'}</div>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl">
                <div className="text-xs text-slate-400 font-medium">생성일</div>
                <div className="font-semibold text-slate-700 mt-0.5">{formatDate(resource.properties.createdAt)}</div>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl">
                <div className="text-xs text-slate-400 font-medium">상태</div>
                <div className="mt-0.5">
                    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full
            ${resource.properties.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${resource.properties.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        {resource.properties.status || 'unknown'}
                    </span>
                </div>
            </div>
        </div>

        {/* Connectors */}
        {resource.properties.connectors && resource.properties.connectors.length > 0 && (
            <div>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">커넥터 ({resource.properties.connectors.length})</h3>
                <div className="space-y-1.5">
                    {resource.properties.connectors.map((c, i) => (
                        <div key={i} className={`flex items-center justify-between p-2.5 rounded-lg border text-sm
              ${c.dlpViolation ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-100'}`}>
                            <div className="flex items-center gap-2">
                                <span>{c.dlpViolation ? '⚠️' : '✅'}</span>
                                <span className="font-medium text-slate-700">{c.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${c.type === 'premium' ? 'bg-purple-100 text-purple-600' : 'bg-slate-100 text-slate-500'}`}>
                                    {c.type}
                                </span>
                                {c.dlpViolation && <span className="text-[10px] font-bold text-rose-600 bg-rose-100 px-1.5 py-0.5 rounded">DLP 위반</span>}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* Sharing */}
        {resource.properties.sharedWith && resource.properties.sharedWith.length > 0 && (
            <div>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">공유 대상 ({resource.properties.sharedWith.length})</h3>
                <div className="space-y-1.5">
                    {resource.properties.sharedWith.map((s, i) => (
                        <div key={i} className={`flex items-center justify-between p-2.5 rounded-lg border text-sm
              ${s.type === 'everyone' ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-100'}`}>
                            <div className="flex items-center gap-2">
                                <span>{s.type === 'everyone' ? '🔴' : s.type === 'group' ? '👥' : '👤'}</span>
                                <span className="font-medium text-slate-700">{s.name}</span>
                            </div>
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded
                ${s.type === 'everyone' ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-500'}`}>
                                {s.type === 'everyone' ? '전체 조직' : s.type === 'group' ? '그룹' : '개인'}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* Actions */}
        <div className="pt-3 border-t border-slate-100">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">거버넌스 액션</h3>
            <div className="flex gap-2 flex-wrap">
                <button id="action-quarantine" onClick={() => onAction('quarantine')}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-50 text-rose-700 text-xs font-semibold rounded-lg border border-rose-200 hover:bg-rose-100 transition-all">
                    🔒 격리
                </button>
                <button id="action-transfer" onClick={() => onAction('transfer')}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-700 text-xs font-semibold rounded-lg border border-blue-200 hover:bg-blue-100 transition-all">
                    🔄 소유권 이전
                </button>
                <button id="action-archive" onClick={() => onAction('archive')}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 hover:bg-slate-100 transition-all">
                    📦 아카이브
                </button>
            </div>
        </div>
    </div>
);

// ============================================================
// Main Inventory View
// ============================================================

export default function InventoryView({ tenants, onAction }: Props) {
    const [selectedResource, setSelectedResource] = useState<ResourceDetail | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState<string>('all');

    // Filter tenants/environments/resources by search and type
    const filteredTenants = useMemo(() => {
        if (!searchQuery && typeFilter === 'all') return tenants;

        return tenants.map(tenant => ({
            ...tenant,
            environments: tenant.environments.map(env => ({
                ...env,
                resources: env.resources.filter(r => {
                    const matchSearch = !searchQuery ||
                        (r.properties.displayName || r.name).toLowerCase().includes(searchQuery.toLowerCase()) ||
                        (r.properties.ownerName || '').toLowerCase().includes(searchQuery.toLowerCase());
                    const matchType = typeFilter === 'all' || r.type.includes(typeFilter);
                    return matchSearch && matchType;
                }),
            })).filter(env => env.resources.length > 0),
        })).filter(tenant => tenant.environments.length > 0);
    }, [tenants, searchQuery, typeFilter]);

    const totalResources = tenants.reduce((sum, t) => t.environments.reduce((s, e) => s + e.resources.length, sum), 0);
    const filteredCount = filteredTenants.reduce((sum, t) => t.environments.reduce((s, e) => s + e.resources.length, sum), 0);

    return (
        <div className="flex gap-0 h-[calc(100vh-75px)] animate-fade-in">
            {/* Left: Tree Panel */}
            <div className="w-[340px] flex-shrink-0 flex flex-col border-r border-slate-200 bg-white/50">
                {/* Search */}
                <div className="p-4 border-b border-slate-100 space-y-3">
                    <div className="relative">
                        <svg className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            id="inventory-search"
                            name="search"
                            type="text"
                            placeholder="이름, 소유자로 검색..."
                            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                        {['all', 'canvasapps', 'modeldrivenapps', 'cloudflows', 'agents'].map(f => (
                            <button key={f} id={`filter-${f}`} onClick={() => setTypeFilter(f)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all
                  ${typeFilter === f ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                                {f === 'all' ? '전체' : f === 'canvasapps' ? '📱 App' : f === 'modeldrivenapps' ? '🏗️ Model' : f === 'cloudflows' ? '⚡ Flow' : '🤖 Bot'}
                            </button>
                        ))}
                    </div>
                    <div className="text-[11px] text-slate-400">{filteredCount} / {totalResources} 리소스</div>
                </div>

                {/* Tree */}
                <div className="flex-1 overflow-y-auto p-3 space-y-1">
                    {filteredTenants.map(tenant => (
                        <TenantTreeItem
                            key={tenant.id}
                            tenant={tenant}
                            selectedId={selectedResource?.name || null}
                            onSelect={setSelectedResource}
                        />
                    ))}
                    {filteredTenants.length === 0 && (
                        <div className="text-center text-slate-400 text-sm py-12">검색 결과가 없습니다</div>
                    )}
                </div>
            </div>

            {/* Right: Detail Panel */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
                {selectedResource ? (
                    <DetailPanel
                        resource={selectedResource}
                        onAction={(action) => onAction(action, selectedResource)}
                    />
                ) : (
                    <div className="flex items-center justify-center h-full text-slate-400">
                        <div className="text-center">
                            <div className="text-5xl mb-4">📦</div>
                            <div className="text-lg font-medium">리소스를 선택하세요</div>
                            <div className="text-sm mt-1">왼쪽 트리에서 리소스를 클릭하면 상세 정보가 표시됩니다</div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
