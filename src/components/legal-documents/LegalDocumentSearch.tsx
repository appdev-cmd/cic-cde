import React, { useState, useMemo, useRef, useEffect } from 'react';
import { DocType } from '../../lib/api/LegalDocumentService';
import {
    useDocumentList,
    useDocumentDetail,
    useLegalStats,
    useDeepSearch,
    useDebounce,
    usePrefetchDocument,
    useDeleteDocument,
} from './useLegalDocuments';
import { useBookmarks, useRecentlyViewed, useReadingPrefs, useLegalEditStore } from './useLegalStorage';
import { LegalHeader } from './components/LegalHeader';
import { LegalSidebar } from './components/LegalSidebar';
import { LegalDetail } from './components/LegalDetail';
import { LegalTOC } from './components/LegalTOC';
import { Bookmark, Check, Info, AlertTriangle } from 'lucide-react';

interface LegalDocumentSearchProps {
    isEmbedded?: boolean;
    initialSearchQuery?: string;
    initialDocId?: string | null;
    initialArticleId?: string | null;
    userRole?: string;
}

interface ToastMessage {
    message: string;
    type: 'success' | 'error' | 'info';
}

const LegalDocumentSearch: React.FC<LegalDocumentSearchProps> = ({ 
    isEmbedded = false, 
    initialSearchQuery = '', 
    initialDocId = null, 
    initialArticleId = null,
    userRole = 'Architect'
}) => {
    // 1. Shared State
    const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
    const debouncedSearchQuery = useDebounce(searchQuery, 300);
    const [selectedDocId, setSelectedDocId] = useState<string>(initialDocId || '');
    const [filterType, setFilterType] = useState<'all' | DocType>('all');

    // UI State
    const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
    const [showPdfViewer, setShowPdfViewer] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [readingMode, setReadingMode] = useState(false);
    const [showTOC, setShowTOC] = useState(true);
    const [showBookmarks, setShowBookmarks] = useState(false);
    const [activeArticleId, setActiveArticleId] = useState<string | null>(initialArticleId || null);
    const [showDeepSearch, setShowDeepSearch] = useState(false);
    const [expandedArticles, setExpandedArticles] = useState<Set<string>>(new Set());
    const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
    const [pendingScroll, setPendingScroll] = useState<{articleId: string, chapterId: string} | null>(null);
    
    // Custom Toast Notification System
    const [toast, setToast] = useState<ToastMessage | null>(null);

    const showToast = (message: string, type: ToastMessage['type'] = 'success') => {
        setToast({ message, type });
    };

    useEffect(() => {
        if (!toast) return;
        const timer = setTimeout(() => setToast(null), 3000);
        return () => clearTimeout(timer);
    }, [toast]);

    // Hooks
    const { bookmarks, toggleBookmark, isBookmarked } = useBookmarks();
    const { recentlyViewed, addView } = useRecentlyViewed();
    const { prefs } = useReadingPrefs();
    const { saveEdit, edits } = useLegalEditStore();
    
    // Determine admin/delete privileges directly from userRole
    const canDelete = userRole === 'Admin' || userRole === 'Quản trị' || userRole === 'Director' || userRole === 'Giám đốc';
    const deleteMutation = useDeleteDocument();
    
    const fontSizeMap = { sm: 13, base: 14, lg: 16 } as const;
    const fontSize = fontSizeMap[prefs?.fontSize || 'base'];

    const contentRef = useRef<HTMLDivElement>(null) as React.RefObject<HTMLDivElement>;

    // Track viewed document
    useEffect(() => {
        if (selectedDocId) {
            addView(selectedDocId);
        }
    }, [selectedDocId, addView]);

    // ---- Supabase data fetching ----
    const { data: listResult, isLoading: isListLoading } = useDocumentList({
        searchQuery: debouncedSearchQuery,
        type: filterType === 'all' ? '' : filterType,
        pageSize: 100,
    });
    const { data: statsData } = useLegalStats();
    const { data: selectedDocRaw, isLoading: isDetailLoading } = useDocumentDetail(selectedDocId || null);
    const { data: deepSearchRaw } = useDeepSearch(debouncedSearchQuery);
    const prefetchDocument = usePrefetchDocument();

    // Mapping raw data
    const filteredDocs = useMemo(() => {
        const docs = listResult?.documents ?? [];
        if (selectedDocRaw && !docs.some(d => d.id === selectedDocRaw.id)) {
            return [selectedDocRaw, ...docs];
        }
        return docs;
    }, [listResult, selectedDocRaw]);
    
    const selectedDoc = useMemo(() => selectedDocRaw ?? null, [selectedDocRaw]);
    
    const stats = useMemo(() => ({
        total: statsData?.total ?? 0,
        byType: statsData?.byType ?? {},
        byStatus: statsData?.byStatus ?? {},
    }), [statsData]);
    
    const deepSearchResults = useMemo(() => {
        if (!deepSearchRaw || debouncedSearchQuery.length < 2) return [];
        return deepSearchRaw.slice(0, 10).map(art => ({
            docId: art.document_id,
            docCode: art.document?.code,
            docTitle: art.document?.short_title,
            chapterId: art.chapter_id,
            articleId: art.id,
            articleCode: art.code,
            articleTitle: art.title,
            snippet: art.summary ?? art.content?.slice(0, 200) ?? '',
        }));
    }, [deepSearchRaw, debouncedSearchQuery]);

    // Auto-select first document when list loads and nothing selected
    useEffect(() => {
        if (!selectedDocId && filteredDocs.length > 0) {
            setSelectedDocId(filteredDocs[0].id);
        }
    }, [filteredDocs, selectedDocId]);

    const isLoading = isListLoading || isDetailLoading;

    // Set default expanded content on doc change and handle initial deep link
    useEffect(() => {
        if (selectedDoc) {
            const targetArticleId = activeArticleId;
            const chapters = selectedDoc.chapters || [];
            let targetChapterId = chapters[0]?.id;
            
            if (targetArticleId) {
                const chapterWithArticle = chapters.find(c => (c.articles || []).some(a => a.id === targetArticleId));
                if (chapterWithArticle) {
                    targetChapterId = chapterWithArticle.id;
                    setTimeout(() => scrollToArticle(targetArticleId, targetChapterId), 300);
                }
            }
            if (targetChapterId) {
                setExpandedChapters(new Set([targetChapterId]));
            }
            const allArticles = chapters.flatMap(c => (c.articles || []).map(a => a.id));
            setExpandedArticles(new Set(allArticles));
        }
    }, [selectedDocId, selectedDoc]);

    // Handle deep search scrolling robustly after doc loaded
    useEffect(() => {
        if (selectedDoc && pendingScroll && selectedDoc.id === selectedDocId) {
            scrollToArticle(pendingScroll.articleId, pendingScroll.chapterId);
            setPendingScroll(null);
        }
    }, [selectedDoc, selectedDocId, pendingScroll]);

    // Handlers
    const toggleChapter = (chapterId: string) => {
        setExpandedChapters(prev => {
            const next = new Set(prev);
            if (next.has(chapterId)) next.delete(chapterId);
            else next.add(chapterId);
            return next;
        });
    };

    const toggleArticleExpansion = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setExpandedArticles(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const scrollToArticle = (articleId: string, chapterId: string) => {
        setExpandedChapters(prev => {
            const next = new Set(prev);
            next.add(chapterId);
            return next;
        });
        setExpandedArticles(prev => {
            const next = new Set(prev);
            next.add(articleId);
            return next;
        });

        setTimeout(() => {
            const element = document.getElementById(`article-${articleId}`);
            if (element && contentRef.current) {
                const containerInfo = contentRef.current.getBoundingClientRect();
                const elementInfo = element.getBoundingClientRect();

                contentRef.current.scrollTo({
                    top: contentRef.current.scrollTop + (elementInfo.top - containerInfo.top) - 100,
                    behavior: 'smooth'
                });

                setActiveArticleId(articleId);
                setTimeout(() => setActiveArticleId(null), 3000);
            }
        }, 100);
    };

    const navigateDeepSearch = (docId: string, chapterId: string, articleId: string) => {
        setSelectedDocId(docId);
        setShowDeepSearch(false);
        setShowPdfViewer(false);
        setPendingScroll({ articleId, chapterId });
    };

    const handleCopy = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        showToast("Đã sao chép nội dung điều khoản vào Clipboard", "success");
        setTimeout(() => setCopiedId(null), 2000);
    };

    const handleCopyLink = (articleId: string) => {
        // Deep link using window.location.origin
        const url = new URL(window.location.href);
        url.searchParams.set('docId', selectedDocId);
        url.searchParams.set('articleId', articleId);
        navigator.clipboard.writeText(url.toString());
        setCopiedLinkId(articleId);
        showToast("Đã sao chép liên kết chia sẻ điều khoản", "success");
        setTimeout(() => setCopiedLinkId(null), 2000);
    };

    const handlePrint = () => {
        window.print();
    };

    const handleDelete = async (id: string) => {
        if (window.confirm("Bạn có chắc chắn muốn xóa văn bản pháp luật này cùng toàn bộ các chương và điều khoản liên quan? Hành động này không thể hoàn tác.")) {
            try {
                await deleteMutation.mutateAsync(id);
                showToast("Xóa văn bản pháp luật thành công", "success");
                setSelectedDocId('');
            } catch (err: any) {
                showToast(`Lỗi khi xóa văn bản: ${err.message}`, "error");
            }
        }
    };

    const handleSaveEdit = (articleId: string, newContent: string) => {
        saveEdit(articleId, newContent);
        showToast("Đã lưu bản nháp chỉnh sửa điều khoản cục bộ", "info");
    };

    if (isLoading && filteredDocs.length === 0) {
        return (
            <div className="flex items-center justify-center h-full min-h-[300px]">
                <div className="flex flex-col items-center gap-3 text-outline">
                    <svg className="w-8 h-8 animate-spin text-primary" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    <span className="text-sm font-medium">Đang tải thư viện văn bản pháp luật...</span>
                </div>
            </div>
        );
    }

    return (
        <div className={`flex flex-col relative ${readingMode ? 'fixed inset-0 z-50 bg-surface p-4' : (isEmbedded ? 'h-full' : 'flex-1 h-full overflow-hidden p-6')} animate-in fade-in duration-300`}>
            
            {/* Custom Toast Notification Banner */}
            {toast && (
                <div className={`absolute top-6 right-6 z-[100] flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-2xl border animate-in slide-in-from-right-5 duration-200 ${
                    toast.type === 'success' ? 'bg-success/10 border-success/30 text-success' :
                    toast.type === 'error' ? 'bg-error/10 border-error/30 text-error' :
                    'bg-primary/10 border-primary/35 text-primary'
                }`}>
                    {toast.type === 'success' && <Check className="w-4 h-4" />}
                    {toast.type === 'error' && <AlertTriangle className="w-4 h-4" />}
                    {toast.type === 'info' && <Info className="w-4 h-4" />}
                    <span className="text-xs font-bold text-on-surface">{toast.message}</span>
                </div>
            )}

            {/* Header Section */}
            <LegalHeader
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                filterType={filterType}
                setFilterType={setFilterType}
                stats={stats}
                showDeepSearch={showDeepSearch}
                setShowDeepSearch={setShowDeepSearch}
                deepSearchResults={deepSearchResults}
                navigateDeepSearch={navigateDeepSearch}
                readingMode={readingMode}
            />

            {/* Main Content Area */}
            <div className="flex flex-1 gap-5 overflow-hidden min-h-0">
                <LegalSidebar
                    readingMode={readingMode}
                    showBookmarks={showBookmarks}
                    setShowBookmarks={setShowBookmarks}
                    filteredDocs={filteredDocs}
                    bookmarks={bookmarks}
                    recentlyViewed={recentlyViewed}
                    selectedDocId={selectedDocId}
                    setSelectedDocId={setSelectedDocId}
                    scrollToArticle={scrollToArticle}
                    setExpandedChapters={setExpandedChapters}
                    setShowPdfViewer={setShowPdfViewer}
                    setShowDeepSearch={setShowDeepSearch}
                />

                <div className="flex-1 bg-surface rounded-3xl shadow-sm border border-outline-variant/60 flex flex-col overflow-hidden">
                    {selectedDoc ? (
                        <LegalDetail
                            selectedDoc={selectedDoc}
                            contentRef={contentRef}
                            showPdfViewer={showPdfViewer}
                            setShowPdfViewer={setShowPdfViewer}
                            readingMode={readingMode}
                            setReadingMode={setReadingMode}
                            handlePrint={handlePrint}
                            fontSize={fontSize}
                            searchQuery={debouncedSearchQuery}
                            isBookmarked={isBookmarked}
                            toggleBookmark={toggleBookmark}
                            expandedChapters={expandedChapters}
                            toggleChapter={toggleChapter}
                            activeArticleId={activeArticleId}
                            expandedArticles={expandedArticles}
                            toggleArticleExpansion={toggleArticleExpansion}
                            copiedId={copiedId}
                            handleCopy={handleCopy}
                            copiedLinkId={copiedLinkId}
                            handleCopyLink={handleCopyLink}
                            edits={edits}
                            onSaveEdit={handleSaveEdit}
                            canDelete={canDelete}
                            onDelete={handleDelete}
                            isDeleting={deleteMutation.isPending}
                        >
                            {showTOC && (selectedDoc.chapters?.length ?? 0) > 0 && !showPdfViewer && (
                                <LegalTOC
                                    selectedDoc={selectedDoc}
                                    scrollToArticle={scrollToArticle}
                                    setExpandedChapters={setExpandedChapters}
                                    activeArticleId={activeArticleId}
                                />
                            )}
                        </LegalDetail>
                    ) : (
                        <LegalDetail
                            selectedDoc={null}
                            contentRef={contentRef}
                            showPdfViewer={false} setShowPdfViewer={() => { }}
                            readingMode={false} setReadingMode={() => { }}
                            handlePrint={() => { }} fontSize={14}
                            searchQuery="" isBookmarked={() => false} toggleBookmark={() => { }}
                            expandedChapters={new Set()} toggleChapter={() => { }}
                            activeArticleId={null} expandedArticles={new Set()}
                            toggleArticleExpansion={() => { }} copiedId={null} handleCopy={() => { }}
                            copiedLinkId={null} handleCopyLink={() => { }}
                            edits={{}} onSaveEdit={() => { }}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default LegalDocumentSearch;
