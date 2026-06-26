import React from 'react';
import { Landmark, Gavel, ScrollText, ShieldCheck, FileText, ChevronRight } from 'lucide-react';
import {
    LegalDocumentDB, DocType,
    DOC_TYPE_LABELS, DOC_STATUS_LABELS, DOC_TYPE_COLORS, DOC_STATUS_COLORS
} from '../../../lib/api/LegalDocumentService';

// ============================================
// TYPE ICON MAP
// ============================================
export const TYPE_ICONS: Record<DocType, React.ElementType> = {
    'luat': Landmark, 'nghi-dinh': Gavel, 'thong-tu': ScrollText,
    'qcvn': ShieldCheck, 'quyet-dinh': FileText,
};

// ============================================
// HIGHLIGHT TEXT
// ============================================
export const HighlightText: React.FC<{ text: string | null; query: string }> = ({ text, query }) => {
    if (!text) return null;
    if (!query.trim()) return <>{text}</>;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return (
        <>
            {parts.map((part, i) =>
                regex.test(part)
                    ? <mark key={i} className="bg-warning/30 dark:bg-warning/20 text-on-surface font-bold rounded px-0.5">{part}</mark>
                    : part
            )}
        </>
    );
};

// ============================================
// DOCUMENT CARD (SIDEBAR)
// ============================================
export const DocSidebarItem: React.FC<{
    doc: LegalDocumentDB; isSelected: boolean; onClick: () => void;
    articleCount: { chapters: number; articles: number };
}> = ({ doc, isSelected, onClick, articleCount }) => {
    const typeColor = DOC_TYPE_COLORS[doc.type];
    const statusColor = DOC_STATUS_COLORS[doc.status];
    const Icon = TYPE_ICONS[doc.type];
    const tooltipTitle = `Số hiệu: ${doc.code}\nTên văn bản: ${doc.title}\nCơ quan ban hành: ${doc.issued_by || '---'}\nNgày ban hành: ${doc.issued_date || '---'}\nNgày hiệu lực: ${doc.effective_date || '---'}`;

    return (
        <button
            onClick={onClick}
            title={tooltipTitle}
            className={`w-full text-left p-3.5 rounded-2xl transition-all group border cursor-pointer ${isSelected
                ? `${typeColor.bg} ${typeColor.border} shadow-sm font-bold`
                : 'border-transparent hover:bg-surface-container-low dark:hover:bg-surface-container-high text-on-surface-variant'}`}
        >
            <div className="flex items-start gap-3">
                <div className={`mt-0.5 p-2 rounded-xl shrink-0 transition-colors ${isSelected
                    ? `${typeColor.bg} ${typeColor.text}`
                    : 'bg-surface-container-high text-outline group-hover:bg-surface-container-highest'}`}>
                    <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                        <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${typeColor.bg} ${typeColor.text}`}>
                            {DOC_TYPE_LABELS[doc.type]}
                        </span>
                        <span className={`flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded ${statusColor.bg} ${statusColor.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${statusColor.dot}`}></span>
                            {DOC_STATUS_LABELS[doc.status]}
                        </span>
                    </div>
                    <p className={`text-xs font-bold leading-snug line-clamp-2 ${isSelected ? 'text-on-surface' : 'text-on-surface-variant group-hover:text-on-surface'}`}>
                        {doc.short_title || doc.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                        <p className={`text-[10px] font-medium ${isSelected ? 'text-on-surface-variant' : 'text-outline'}`}>
                            {doc.code}
                        </p>
                        {articleCount.articles > 0 && (
                            <span className="text-[9px] font-bold text-outline bg-surface-container-high px-1.5 py-0.5 rounded">
                                {articleCount.chapters}ch · {articleCount.articles}đ
                            </span>
                        )}
                    </div>
                </div>
                {isSelected && <ChevronRight className={`w-4 h-4 mt-1 shrink-0 ${typeColor.text}`} />}
            </div>
        </button>
    );
};

// ============================================
// DEEP SEARCH RESULT
// ============================================
export interface DeepSearchItem {
    docId: string;
    docCode?: string;
    docTitle?: string;
    chapterId: string;
    articleId: string;
    articleCode: string;
    articleTitle: string;
    snippet: string;
}

export const DeepSearchResult: React.FC<{
    result: DeepSearchItem; query: string;
    onNavigate: (docId: string, chapterId: string, articleId: string) => void;
}> = ({ result, query, onNavigate }) => (
    <button
        onClick={() => onNavigate(result.docId, result.chapterId, result.articleId)}
        className="w-full text-left p-3 rounded-xl border border-outline-variant/50 hover:bg-primary-container/10 dark:hover:bg-primary-container/20 transition-all group cursor-pointer"
    >
        <div className="flex items-center gap-2 mb-1">
            <span className="text-[9px] font-black uppercase tracking-wider text-primary bg-primary-container/20 px-1.5 py-0.5 rounded flex items-center gap-1">
                <FileText className="w-3 h-3" />
                {result.docCode ? result.docCode : 'Kết quả tìm kiếm'}
            </span>
            {result.docTitle && <span className="text-[10px] font-bold text-on-surface-variant truncate">{result.docTitle}</span>}
        </div>
        <p className="text-xs font-bold text-on-surface">
            <span className="font-mono text-[10px] text-outline mr-1">{result.articleCode}</span>
            <HighlightText text={result.articleTitle} query={query} />
        </p>
        <p className="text-[11px] text-on-surface-variant mt-0.5 line-clamp-2 leading-relaxed">
            <HighlightText text={result.snippet} query={query} />
        </p>
    </button>
);
