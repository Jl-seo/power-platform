"use client";

import React from 'react';

type ViewMode = 'table' | 'card';

interface ViewToggleProps {
    mode: ViewMode;
    onChange: (mode: ViewMode) => void;
    totalCount: number;
    filteredCount: number;
}

export default function ViewToggle({ mode, onChange, totalCount, filteredCount }: ViewToggleProps) {
    return (
        <div className="flex items-center gap-3">
            <div className="flex bg-slate-100 rounded-lg p-0.5">
                <button id="view-table" onClick={() => onChange('table')}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5
            ${mode === 'table' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M0 2a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H2a2 2 0 01-2-2V2zm15 2H1v10a1 1 0 001 1h12a1 1 0 001-1V4zm-3 1v2H4V5h8z" /><rect x="1" y="7" width="14" height="1" opacity="0.3" /><rect x="1" y="10" width="14" height="1" opacity="0.3" /><rect x="1" y="13" width="14" height="1" opacity="0.3" /></svg>
                    테이블
                </button>
                <button id="view-card" onClick={() => onChange('card')}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5
            ${mode === 'card' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><rect x="0" y="0" width="7" height="7" rx="1.5" /><rect x="9" y="0" width="7" height="7" rx="1.5" /><rect x="0" y="9" width="7" height="7" rx="1.5" /><rect x="9" y="9" width="7" height="7" rx="1.5" /></svg>
                    카드
                </button>
            </div>
            <span className="text-xs text-slate-400">
                {filteredCount === totalCount ? `${totalCount}건` : `${filteredCount} / ${totalCount}건`}
            </span>
        </div>
    );
}

export type { ViewMode };
