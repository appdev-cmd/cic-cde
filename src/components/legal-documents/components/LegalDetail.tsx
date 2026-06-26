import React from 'react';
import { Share2, Printer, Download, Maximize2, Minimize2, FileText, FileDown, Bookmark, Link as LinkIcon, Check, ChevronDown, ChevronRight, Scale, Info, Calendar, Shield, Building2, Trash2 } from 'lucide-react';
import { LegalDocumentDB, DOC_TYPE_LABELS, DOC_STATUS_LABELS, DOC_TYPE_COLORS, DOC_STATUS_COLORS } from '../../../lib/api/LegalDocumentService';
import { HighlightText, TYPE_ICONS } from './LegalUI';
import LegalArticleCard from './LegalArticleCard';

interface LegalDetailProps {
    selectedDoc: LegalDocumentDB | null;
    contentRef: React.RefObject<HTMLDivElement>;
    showPdfViewer: boolean;
    setShowPdfViewer: (val: boolean) => void;
    readingMode: boolean;
    setReadingMode: (val: boolean) => void;
    handlePrint: () => void;
    fontSize: number;
    searchQuery: string;
    isBookmarked: (articleId: string) => boolean;
    toggleBookmark: (articleId: string, docId: string, extra?: { chapterId?: string; docShortTitle?: string; articleCode?: string; articleTitle?: string }) => void;
    expandedChapters: Set<string>;
    toggleChapter: (chapterId: string) => void;
    activeArticleId: string | null;
    expandedArticles: Set<string>;
    toggleArticleExpansion: (id: string, e: React.MouseEvent) => void;
    copiedId: string | null;
    handleCopy: (text: string, id: string) => void;
    copiedLinkId?: string | null;
    handleCopyLink?: (articleId: string) => void;
    children?: React.ReactNode;
    edits: Record<string, string>;
    onSaveEdit: (articleId: string, newContent: string) => void;
    canDelete?: boolean;
    onDelete?: (id: string) => void;
    isDeleting?: boolean;
}

export const LegalDetail: React.FC<LegalDetailProps> = ({
    selectedDoc, contentRef, showPdfViewer, setShowPdfViewer,
    readingMode, setReadingMode, handlePrint, fontSize, searchQuery,
    isBookmarked, toggleBookmark, expandedChapters, toggleChapter,
    activeArticleId, expandedArticles, toggleArticleExpansion,
    copiedId, handleCopy, copiedLinkId, handleCopyLink, children,
    edits, onSaveEdit, canDelete, onDelete, isDeleting
}) => {
    if (!selectedDoc) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-4 bg-surface rounded-3xl shadow-sm border border-outline-variant/60">
                <Scale className="w-16 h-16 text-outline/30 mb-4 animate-pulse" />
                <h3 className="text-sm font-bold text-outline">Chọn văn bản để xem chi tiết</h3>
                <p className="text-xs text-outline-variant mt-1">Sử dụng thanh tìm kiếm hoặc bộ lọc bên trên</p>
            </div>
        );
    }

    const typeColor = DOC_TYPE_COLORS[selectedDoc.type];
    const statusColor = DOC_STATUS_COLORS[selectedDoc.status];
    const TypeIcon = TYPE_ICONS[selectedDoc.type];

    return (
        <div className="flex-1 flex flex-col h-full bg-surface">
            {/* Document Header */}
            <div className={`border-b border-outline-variant/60 bg-gradient-to-r from-surface-container-lowest to-surface-container-low shrink-0 transition-all ${readingMode ? 'px-4 py-2' : 'px-6 py-3.5'}`}>
                <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2.5">
                            <span className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider border ${typeColor.bg} ${typeColor.text} ${typeColor.border}`}>
                                <TypeIcon className="w-3 h-3" />
                                {DOC_TYPE_LABELS[selectedDoc.type]}
                            </span>
                            <span className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[9px] font-bold border ${statusColor.bg} ${statusColor.text} ${statusColor.border}`}>
                                <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${statusColor.dot}`}></span>
                                {DOC_STATUS_LABELS[selectedDoc.status]}
                            </span>
                            <span className="px-2.5 py-0.5 rounded-lg text-[9px] font-bold bg-surface-container-high text-on-surface-variant border border-outline-variant/60 flex items-center gap-1.5">
                                <FileText className="w-3 h-3 text-outline" />
                                {selectedDoc.code}
                            </span>
                        </div>
                        <h1 className={`font-black text-on-surface leading-tight tracking-tight transition-all ${readingMode ? 'text-[15px] mb-1' : 'text-base md:text-lg mb-1.5'}`}>
                            {selectedDoc.title}
                        </h1>
                        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-[10px] font-semibold text-on-surface-variant/80">
                            <p className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-outline" /> Ban hành: <span className="font-bold text-on-surface">{selectedDoc.issued_date || '---'}</span></p>
                            <p className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5 text-success" /> Hiệu lực: <span className="font-bold text-on-surface">{selectedDoc.effective_date || '---'}</span></p>
                            <p className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5 text-primary" /> Cơ quan: <span className="font-bold text-on-surface">{selectedDoc.issued_by || '---'}</span></p>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                        {canDelete && (
                            <button onClick={() => onDelete?.(selectedDoc.id)}
                                disabled={isDeleting}
                                className="p-2 bg-error/10 text-error rounded-xl hover:bg-error/25 transition-colors disabled:opacity-50 cursor-pointer"
                                title="Xóa văn bản pháp luật">
                                <Trash2 className="w-4.5 h-4.5" />
                            </button>
                        )}
                        <button onClick={() => setShowPdfViewer(!showPdfViewer)}
                            className={`p-2 rounded-xl transition-all cursor-pointer ${showPdfViewer ? 'bg-primary-container/20 text-primary border border-primary/20' : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'}`}
                            title={showPdfViewer ? "Đóng PDF" : "Xem PDF bản gốc"}>
                            <FileDown className="w-4.5 h-4.5" />
                        </button>
                        <button onClick={handlePrint} className="p-2 bg-surface-container-high text-on-surface-variant rounded-xl hover:bg-surface-container-highest transition-colors cursor-pointer" title="In tài liệu">
                            <Printer className="w-4.5 h-4.5" />
                        </button>
                        <button onClick={() => setReadingMode(!readingMode)}
                            className={`p-2 rounded-xl transition-all cursor-pointer ${readingMode ? 'bg-primary text-white shadow-md' : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'}`}
                            title={readingMode ? "Mặc định" : "Chế độ đọc tập trung"}>
                            {readingMode ? <Minimize2 className="w-4.5 h-4.5" /> : <Maximize2 className="w-4.5 h-4.5" />}
                        </button>
                    </div>
                </div>

                {!showPdfViewer && selectedDoc.summary && !readingMode && (
                    <div className="mt-3 p-3 bg-primary/5 border border-primary/10 rounded-2xl flex items-start gap-2.5">
                        <Info className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                        <p className="text-[11px] leading-relaxed text-on-surface-variant font-semibold">
                            {selectedDoc.summary}
                        </p>
                    </div>
                )}
            </div>

            {/* Content Area with TOC on the left */}
            <div className="flex-1 flex overflow-hidden bg-surface-container-lowest">
                {children}
                <div className="flex-1 overflow-hidden relative">
                    <div ref={contentRef} className="absolute inset-0 overflow-y-auto custom-scrollbar bg-surface-container-lowest">
                        {showPdfViewer ? (
                            <div className="h-full w-full bg-surface-container-low p-4">
                                <div className="w-full h-full bg-surface rounded-2xl shadow-sm border border-outline-variant/60 overflow-hidden flex flex-col">
                                    <div className="bg-surface-container-high px-4 py-2 border-b border-outline-variant/60 flex justify-between items-center">
                                        <span className="text-xs font-bold text-on-surface-variant flex items-center gap-2">
                                            <FileDown className="w-4 h-4" /> Bản gốc PDF văn bản
                                        </span>
                                        <span className="text-[10px] bg-surface px-2 py-1 rounded font-mono text-outline border border-outline-variant/60">{selectedDoc.file_size}</span>
                                    </div>
                                    <iframe src={`${selectedDoc.file_path}#toolbar=0&navpanes=0`} className="w-full flex-1" title="PDF Viewer" />
                                </div>
                            </div>
                        ) : (
                            <div className="p-4 lg:px-12 xl:px-16 max-w-3xl mx-auto" style={{ fontSize: `${fontSize}px` }}>
                                {(selectedDoc.chapters || []).map(chapter => (
                                    <div key={chapter.id} className="mb-8 last:mb-0">
                                        <div
                                            onClick={() => toggleChapter(chapter.id)}
                                            className="sticky top-0 z-10 bg-surface/95 backdrop-blur-md py-3 -mx-4 px-4 mb-4 border-b-2 border-outline-variant/60 flex items-center justify-between cursor-pointer group"
                                        >
                                            <div>
                                                <h3 className="text-[10px] font-black text-primary uppercase tracking-widest mb-0.5">{chapter.code}</h3>
                                                <h4 className="text-sm font-black text-on-surface group-hover:text-primary transition-colors">{chapter.title}</h4>
                                            </div>
                                            <div className="p-2 bg-surface-container-low rounded-xl group-hover:bg-primary/10 transition-colors">
                                                {expandedChapters.has(chapter.id) ? (
                                                    <ChevronDown className="w-4.5 h-4.5 text-outline group-hover:text-primary" />
                                                ) : (
                                                    <ChevronRight className="w-4.5 h-4.5 text-outline group-hover:text-primary" />
                                                )}
                                            </div>
                                        </div>

                                        {expandedChapters.has(chapter.id) && (
                                            <div className="space-y-4">
                                                {(chapter.articles || []).map(article => {
                                                    const isActive = activeArticleId === article.id;
                                                    const bookmarked = isBookmarked(article.id);
                                                    const isExpanded = expandedArticles.has(article.id);

                                                    return (
                                                        <LegalArticleCard
                                                            key={article.id}
                                                            article={{
                                                                ...article,
                                                                content: edits[article.id] || article.content,
                                                            }}
                                                            selectedDocId={selectedDoc.id}
                                                            isActive={isActive}
                                                            isExpanded={isExpanded}
                                                            bookmarked={bookmarked}
                                                            searchQuery={searchQuery}
                                                            copiedId={copiedId}
                                                            toggleArticleExpansion={toggleArticleExpansion}
                                                            toggleBookmark={toggleBookmark}
                                                            handleCopy={handleCopy}
                                                            onSaveEdit={onSaveEdit}
                                                            docShortTitle={selectedDoc.short_title || selectedDoc.title}
                                                        />
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
