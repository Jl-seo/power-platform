/**
 * Agent API Client
 * 
 * Connects the frontend portal to the Data Plane Agent (Azure Functions).
 * All data stays within the customer's Azure — the frontend just calls the Agent API.
 */

const AGENT_BASE_URL = process.env.NEXT_PUBLIC_AGENT_URL || 'http://localhost:7071';

interface ApiOptions {
    tenantId?: string;
}

async function apiCall<T>(path: string, options?: RequestInit & ApiOptions): Promise<T> {
    const url = new URL(`/api${path}`, AGENT_BASE_URL);
    if (options?.tenantId) {
        url.searchParams.set('tenant_id', options.tenantId);
    }

    const res = await fetch(url.toString(), {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options?.headers,
        },
    });

    if (!res.ok) {
        const error = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(error.error || `API Error: ${res.status}`);
    }

    return res.json();
}

// ============================================================
// Health
// ============================================================

export interface HealthResponse {
    status: string;
    service: string;
    version: string;
    tenant_configured: boolean;
    keyvault_configured: boolean;
    timestamp: string;
}

export const agentApi = {
    health: () => apiCall<HealthResponse>('/health'),

    // ============================================================
    // Inventory
    // ============================================================

    inventorySummary: (tenantId?: string) =>
        apiCall<{
            total_count: number;
            by_type: Array<{ type: string; resourceCount: number }>;
        }>('/inventory/summary', { tenantId }),

    inventoryResources: (top = 100, skip = 0, tenantId?: string) =>
        apiCall<{
            total_records: number;
            count: number;
            has_more: boolean;
            resources: any[];
        }>(`/inventory/resources?top=${top}&skip=${skip}`, { tenantId }),

    inventoryEnvironments: (tenantId?: string) =>
        apiCall<{
            environments: any[];
        }>('/inventory/environments', { tenantId }),

    inventoryRecent: (days = 7, tenantId?: string) =>
        apiCall<{
            period_days: number;
            count: number;
            resources: any[];
        }>(`/inventory/recent?days=${days}`, { tenantId }),

    // ============================================================
    // Security
    // ============================================================

    securityScan: (tenantId?: string) =>
        apiCall<{
            score: number;
            grade: string;
            total_resources_scanned: number;
            risk_summary: { critical: number; high: number; medium: number; low: number };
            risks: any[];
        }>('/security/scan', { method: 'POST', tenantId }),

    securityScore: (tenantId?: string) =>
        apiCall<{
            score: number;
            grade: string;
            total_resources_scanned: number;
            risk_summary: { critical: number; high: number; medium: number; low: number };
        }>('/security/score', { tenantId }),

    // ============================================================
    // Governance
    // ============================================================

    quarantineApp: (data: {
        environment_id: string;
        app_id: string;
        quarantine: boolean;
        reason?: string;
        tenant_id?: string;
    }) => apiCall<{ success: boolean; action: string }>('/governance/quarantine', {
        method: 'POST',
        body: JSON.stringify(data),
    }),

    transferOwnership: (data: {
        environment_id?: string;
        app_id?: string;
        old_owner_id?: string;
        new_owner_id: string;
        tenant_id?: string;
    }) => apiCall<{ success?: boolean; transferred?: number }>('/governance/transfer', {
        method: 'POST',
        body: JSON.stringify(data),
    }),
};
