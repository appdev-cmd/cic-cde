import React from 'react';
import { Bookmark, Search, Clock, FileText } from 'lucide-react';
import { LegalDocumentDB } from '../../../lib/api/LegalDocumentService';
import { DocSidebarItem } from './LegalUI';
import { BookmarkItem, RecentlyViewedItem } from '../useLegalStorage';

interface LegalSidebarProps {
    readingMode: boolean;
    showBookmarks: boolean;
    setShowBookmarks: (val: boolean) => void;
    filteredDocs: LegalDocumentDB[];
    bookmarks: BookmarkItem[];
    recentlyViewed: RecentlyViewedItem[];
    selectedDocId: string;
    setSelectedDocId: (id: string) => void;
    scrollToArticle: (articleId: string, chapterId: string) => void;
    setExpandedChapters: (chapters: Set<string>) => void;
    setShowPdfViewer: (val: boolean) => void;
    setShowDeepSearch: (val: boolean) => void;
}

export const LegalSidebar: React.FC<LegalSidebarProps> = ({
    readingMode, showBookmarks, setShowBookmarks, filteredDocs, bookmarks,
    recentlyViewed, selectedDocId, setSelectedDocId, scrollToArticle,
    setExpandedChapters, setShowPdfViewer, setShowDeepSearch
}) => {
    return (
        <div className={`${readingMode ? 'hidden' : 'w-80 shrink-0'} bg-surface rounded-3xl shadow-sm border border-outline-variant/60 flex flex-col overflow-hidden`}>
            {/* Sidebar Header with tabs */}
            <div className="px-5 py-3 border-b border-outline-variant/60 bg-surface-container-low">
                <div className="flex items-center gap-2">
                    <button onClick={() => setShowBookmarks(false)}
                        className={`text-[10px] font-black uppercase tracking-[0.15em] px-3 py-1.5 rounded-lg transition-all cursor-pointer ${!showBookmarks ? 'bg-primary text-white font-black shadow-sm' : 'text-outline hover:bg-surface-container-high'}`}>
                        <FileText className="w-4 h-4 inline mr-1" /> Văn bản ({filteredDocs.length})
                    </button>
                    <button onClick={() => setShowBookmarks(true)}
                        className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.15em] px-3 py-1.5 rounded-lg transition-all cursor-pointer ${showBookmarks ? 'bg-primary text-white font-black shadow-sm' : 'text-outline hover:bg-surface-container-high'}`}>
                        <Bookmark className="w-4 h-4" /> Đánh dấu ({bookmarks.length})
                    </button>
                    {recentlyViewed.length > 0 && (
                        <span className="ml-auto flex items-center gap-1 text-[9px] font-bold text-outline">
                            <Clock className="w-3 h-3" />
                            {recentlyViewed.length}
                        </span>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar bg-surface">
                {showBookmarks ? (
                    bookmarks.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <Bookmark className="w-12 h-12 text-outline/30 mb-4" />
                            <p className="text-sm font-bold text-outline">Chưa có mục đánh dấu</p>
                            <p className="text-xs text-outline-variant mt-1">Nhấn nút <Bookmark className="w-3 h-3 inline" /> trên điều khoản để đánh dấu</p>
                        </div>
                    ) : (
                        bookmarks.map(bm => {
                            return (
                                <button key={bm.articleId}
                                    onClick={() => { setSelectedDocId(bm.docId); setShowBookmarks(false); if ((bm as any).chapterId) scrollToArticle(bm.articleId, (bm as any).chapterId); }}
                                    className="w-full text-left p-3 rounded-xl border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-all cursor-pointer">
                                    <p className="text-[9px] font-black text-primary uppercase tracking-wider">{(bm as any).docShortTitle || 'Văn bản đã lưu'}</p>
                                    <p className="text-xs font-bold text-on-surface-variant mt-0.5">
                                        <span className="text-outline font-mono text-[10px] mr-1">{(bm as any).articleCode || ''}</span>
                                        {(bm as any).articleTitle || 'Điều khoản đã lưu'}
                                    </p>
                                </button>
                            );
                        })
                    )
                ) : (
                    filteredDocs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <Search className="w-12 h-12 text-outline/30 mb-4" />
                            <p className="text-sm font-bold text-outline">Không tìm thấy văn bản</p>
                            <p className="text-xs text-outline-variant mt-1">Thử tìm với từ khóa khác</p>
                        </div>
                    ) : filteredDocs.map(doc => (
                        <DocSidebarItem key={doc.id} doc={doc} isSelected={selectedDocId === doc.id}
                            articleCount={{ chapters: 0, articles: 0 }}
                            onClick={() => { setSelectedDocId(doc.id); setShowPdfViewer(false); setExpandedChapters(new Set()); setShowDeepSearch(false); }} />
                    ))
                )}
            </div>
        </div>
    );
};
