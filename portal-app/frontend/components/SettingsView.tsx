"use client";

import React, { useState } from 'react';

// ============================================================
// Settings View
// ============================================================

interface SettingSection {
    id: string;
    title: string;
    icon: string;
    description: string;
}

const SECTIONS: SettingSection[] = [
    { id: 'general', title: '일반', icon: '⚙️', description: '테넌트, 언어, 알림 설정' },
    { id: 'security', title: '보안 정책', icon: '🔒', description: 'DLP, 공유, 커넥터 기본 정책' },
    { id: 'notifications', title: '알림', icon: '🔔', description: '이메일, Teams 알림 채널 설정' },
    { id: 'integrations', title: '연동', icon: '🔌', description: 'Agent API, Azure 인프라 연결 상태' },
];

export default function SettingsView() {
    const [activeSection, setActiveSection] = useState('general');

    // General settings state
    const [portalName, setPortalName] = useState('CoE Governance Portal');
    const [language, setLanguage] = useState('ko');
    const [autoScan, setAutoScan] = useState(true);
    const [scanInterval, setScanInterval] = useState('6h');

    // Security settings state
    const [defaultDlp, setDefaultDlp] = useState('block-http');
    const [maxSharing, setMaxSharing] = useState('team');
    const [autoQuarantine, setAutoQuarantine] = useState(true);
    const [orphanDays, setOrphanDays] = useState('30');

    // Notification settings state
    const [emailEnabled, setEmailEnabled] = useState(true);
    const [teamsEnabled, setTeamsEnabled] = useState(true);
    const [teamsWebhook, setTeamsWebhook] = useState('https://outlook.office.com/webhook/...');

    // Integration state
    const [agentUrl, setAgentUrl] = useState('https://coe-agent-func.azurewebsites.net');

    return (
        <div className="p-6 animate-fade-in max-w-[1200px]">
            <div className="mb-6">
                <h1 className="text-xl font-bold text-slate-800">설정</h1>
                <p className="text-sm text-slate-500 mt-0.5">포털 동작, 보안 정책, 알림, 연동을 관리합니다</p>
            </div>

            <div className="flex gap-6">
                {/* Section Nav */}
                <nav className="w-56 flex-shrink-0 space-y-1">
                    {SECTIONS.map(s => (
                        <button key={s.id} id={`settings-nav-${s.id}`}
                            onClick={() => setActiveSection(s.id)}
                            className={`w-full text-left px-4 py-3 rounded-xl text-sm transition-all flex items-center gap-3
                ${activeSection === s.id
                                    ? 'bg-blue-50 text-blue-700 font-semibold'
                                    : 'text-slate-600 hover:bg-slate-50'}`}>
                            <span>{s.icon}</span>
                            <div>
                                <div className="font-medium">{s.title}</div>
                                <div className="text-[10px] text-slate-400">{s.description}</div>
                            </div>
                        </button>
                    ))}
                </nav>

                {/* Section Content */}
                <div className="flex-1 glass-card p-6 animate-fade-in">
                    {/* General */}
                    {activeSection === 'general' && (
                        <div className="space-y-6">
                            <h2 className="text-lg font-bold text-slate-800 mb-4">⚙️ 일반 설정</h2>
                            <div>
                                <label htmlFor="setting-portal-name" className="text-xs font-semibold text-slate-500 uppercase">포털 이름</label>
                                <input id="setting-portal-name" name="portalName" type="text" value={portalName}
                                    onChange={e => setPortalName(e.target.value)}
                                    className="w-full mt-1 px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div>
                                <label htmlFor="setting-language" className="text-xs font-semibold text-slate-500 uppercase">언어</label>
                                <select id="setting-language" name="language" value={language} onChange={e => setLanguage(e.target.value)}
                                    className="w-full mt-1 px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white">
                                    <option value="ko">한국어 (KO)</option>
                                    <option value="en">English (EN)</option>
                                    <option value="ja">日本語 (JA)</option>
                                    <option value="zh-tw">繁體中文 (TW)</option>
                                </select>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                                <div>
                                    <div className="text-sm font-semibold text-slate-700">자동 보안 스캔</div>
                                    <div className="text-xs text-slate-400">정기적으로 보안 위협을 스캔합니다</div>
                                </div>
                                <button id="setting-auto-scan" onClick={() => setAutoScan(!autoScan)}
                                    className={`w-12 h-6 rounded-full transition-all relative ${autoScan ? 'bg-blue-600' : 'bg-slate-300'}`}>
                                    <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all
                    ${autoScan ? 'left-[26px]' : 'left-0.5'}`} />
                                </button>
                            </div>
                            {autoScan && (
                                <div>
                                    <label htmlFor="setting-scan-interval" className="text-xs font-semibold text-slate-500 uppercase">스캔 주기</label>
                                    <select id="setting-scan-interval" name="scanInterval" value={scanInterval} onChange={e => setScanInterval(e.target.value)}
                                        className="w-full mt-1 px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white">
                                        <option value="1h">1시간</option>
                                        <option value="6h">6시간</option>
                                        <option value="24h">24시간</option>
                                        <option value="7d">7일</option>
                                    </select>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Security */}
                    {activeSection === 'security' && (
                        <div className="space-y-6">
                            <h2 className="text-lg font-bold text-slate-800 mb-4">🔒 보안 정책</h2>
                            <div>
                                <label htmlFor="setting-default-dlp" className="text-xs font-semibold text-slate-500 uppercase">기본 DLP 정책</label>
                                <select id="setting-default-dlp" name="defaultDlp" value={defaultDlp} onChange={e => setDefaultDlp(e.target.value)}
                                    className="w-full mt-1 px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white">
                                    <option value="block-http">HTTP/SMTP 커넥터 차단</option>
                                    <option value="block-all-custom">모든 커스텀 커넥터 차단</option>
                                    <option value="allow-all">모든 커넥터 허용 (비권장)</option>
                                </select>
                            </div>
                            <div>
                                <label htmlFor="setting-max-sharing" className="text-xs font-semibold text-slate-500 uppercase">최대 공유 범위</label>
                                <select id="setting-max-sharing" name="maxSharing" value={maxSharing} onChange={e => setMaxSharing(e.target.value)}
                                    className="w-full mt-1 px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white">
                                    <option value="personal">본인만</option>
                                    <option value="team">팀/그룹</option>
                                    <option value="org">전사</option>
                                    <option value="everyone">전체 (Everyone)</option>
                                </select>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                                <div>
                                    <div className="text-sm font-semibold text-slate-700">DLP 위반 자동 격리</div>
                                    <div className="text-xs text-slate-400">DLP 정책 위반 시 자동으로 앱을 격리합니다</div>
                                </div>
                                <button id="setting-auto-quarantine" onClick={() => setAutoQuarantine(!autoQuarantine)}
                                    className={`w-12 h-6 rounded-full transition-all relative ${autoQuarantine ? 'bg-blue-600' : 'bg-slate-300'}`}>
                                    <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all
                    ${autoQuarantine ? 'left-[26px]' : 'left-0.5'}`} />
                                </button>
                            </div>
                            <div>
                                <label htmlFor="setting-orphan-days" className="text-xs font-semibold text-slate-500 uppercase">미소유 감지 기준 (일)</label>
                                <input id="setting-orphan-days" name="orphanDays" type="number" value={orphanDays}
                                    onChange={e => setOrphanDays(e.target.value)}
                                    className="w-full mt-1 px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                <div className="text-xs text-slate-400 mt-1">퇴사자 리소스를 미소유로 분류하는 유예 기간</div>
                            </div>
                        </div>
                    )}

                    {/* Notifications */}
                    {activeSection === 'notifications' && (
                        <div className="space-y-6">
                            <h2 className="text-lg font-bold text-slate-800 mb-4">🔔 알림 설정</h2>
                            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                                <div>
                                    <div className="text-sm font-semibold text-slate-700">📧 이메일 알림</div>
                                    <div className="text-xs text-slate-400">보안 경고, 승인 요청을 이메일로 전송</div>
                                </div>
                                <button id="setting-email-enabled" onClick={() => setEmailEnabled(!emailEnabled)}
                                    className={`w-12 h-6 rounded-full transition-all relative ${emailEnabled ? 'bg-blue-600' : 'bg-slate-300'}`}>
                                    <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all
                    ${emailEnabled ? 'left-[26px]' : 'left-0.5'}`} />
                                </button>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                                <div>
                                    <div className="text-sm font-semibold text-slate-700">💬 Teams 알림</div>
                                    <div className="text-xs text-slate-400">Teams 채널로 실시간 알림 전송</div>
                                </div>
                                <button id="setting-teams-enabled" onClick={() => setTeamsEnabled(!teamsEnabled)}
                                    className={`w-12 h-6 rounded-full transition-all relative ${teamsEnabled ? 'bg-blue-600' : 'bg-slate-300'}`}>
                                    <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all
                    ${teamsEnabled ? 'left-[26px]' : 'left-0.5'}`} />
                                </button>
                            </div>
                            {teamsEnabled && (
                                <div>
                                    <label htmlFor="setting-teams-webhook" className="text-xs font-semibold text-slate-500 uppercase">Teams Webhook URL</label>
                                    <input id="setting-teams-webhook" name="teamsWebhook" type="text" value={teamsWebhook}
                                        onChange={e => setTeamsWebhook(e.target.value)}
                                        className="w-full mt-1 px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Integrations */}
                    {activeSection === 'integrations' && (
                        <div className="space-y-6">
                            <h2 className="text-lg font-bold text-slate-800 mb-4">🔌 연동 설정</h2>
                            <div>
                                <label htmlFor="setting-agent-url" className="text-xs font-semibold text-slate-500 uppercase">Agent API URL</label>
                                <input id="setting-agent-url" name="agentUrl" type="text" value={agentUrl}
                                    onChange={e => setAgentUrl(e.target.value)}
                                    className="w-full mt-1 px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div className="space-y-3">
                                <h3 className="text-sm font-semibold text-slate-600">연결 상태</h3>
                                {[
                                    { name: 'Data Plane Agent', status: 'connected', url: agentUrl },
                                    { name: 'Azure Key Vault', status: 'connected', url: 'coe-agent-kv.vault.azure.net' },
                                    { name: 'Application Insights', status: 'connected', url: 'coe-agent-insights' },
                                    { name: 'Cosmos DB (Control Plane)', status: 'pending', url: '미연결' },
                                ].map(svc => (
                                    <div key={svc.name} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                                        <div className="flex items-center gap-3">
                                            <span className={`w-2.5 h-2.5 rounded-full ${svc.status === 'connected' ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                                            <div>
                                                <div className="text-sm font-semibold text-slate-700">{svc.name}</div>
                                                <div className="text-xs text-slate-400">{svc.url}</div>
                                            </div>
                                        </div>
                                        <span className={`text-xs font-bold px-2 py-1 rounded-full
                      ${svc.status === 'connected' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-600'}`}>
                                            {svc.status === 'connected' ? '연결됨' : '대기'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Save Button */}
                    <div className="mt-8 flex justify-end">
                        <button id="btn-save-settings" className="btn-primary">💾 설정 저장</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
