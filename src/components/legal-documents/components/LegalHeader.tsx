import React from 'react';
import { Search, Scale, Filter, X, FileText, Layers, ShieldCheck } from 'lucide-react';
import { DocType, DOC_TYPE_LABELS } from '../../../lib/api/LegalDocumentService';
import { DeepSearchResult, DeepSearchItem } from './LegalUI';

interface LegalHeaderProps {
    searchQuery: string;
    setSearchQuery: (val: string) => void;
    filterType: DocType | 'all';
    setFilterType: (type: DocType | 'all') => void;
    stats: {
        total: number;
        byType: Record<string, number>;
        byStatus: Record<string, number>;
        totalArticles?: number;
    };
    showDeepSearch: boolean;
    setShowDeepSearch: (val: boolean) => void;
    deepSearchResults: DeepSearchItem[];
    navigateDeepSearch: (docId: string, chapterId: string, articleId: string) => void;
    readingMode: boolean;
}

export const LegalHeader: React.FC<LegalHeaderProps> = ({
    searchQuery, setSearchQuery, filterType, setFilterType, stats,
    showDeepSearch, setShowDeepSearch, deepSearchResults, navigateDeepSearch,
    readingMode
}) => {
    if (readingMode) return null;

    const activeCount = stats.byStatus?.['hieu-luc'] ?? 0;
    // Estimate or fallback for article count if not loaded yet
    const articleCount = stats.totalArticles ?? (stats.total * 25); 

    return (
        <div className="flex flex-col gap-3 mb-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                    <h2 className="text-xl font-black text-on-surface tracking-tight uppercase flex items-center gap-2">
                        <Scale className="w-5 h-5 text-primary" />
                        Văn bản Pháp luật Xây dựng
                    </h2>
                    <p className="text-[11px] text-on-surface-variant mt-0.5 font-medium ml-7 hidden sm:block">
                        Tra cứu thông minh Luật, Nghị định, Thông tư, Quy chuẩn về xây dựng và đầu tư công
                    </p>
                </div>
                <div className="flex items-center gap-2 text-[11px] font-bold self-start md:self-auto">
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-surface-container border border-outline-variant/60 rounded-lg text-on-surface-variant">
                        <FileText className="w-3.5 h-3.5 text-outline" />
                        Tổng: <span className="text-on-surface font-black">{stats.total}</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-secondary-container/30 border border-secondary-container/60 rounded-lg text-secondary-container">
                        <Layers className="w-3.5 h-3.5 text-secondary" />
                        Điều khoản: <span className="text-on-surface font-black">{articleCount}</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-success/10 border border-success/30 rounded-lg text-success">
                        <ShieldCheck className="w-3.5 h-3.5 text-success" />
                        Hiệu lực: <span className="text-on-surface font-black">{activeCount}</span>
                    </div>
                </div>
            </div>

            {/* Search + Filters */}
            <div className="flex flex-col lg:flex-row gap-3">
                <div className="relative flex-1">
                    <div className="bg-surface rounded-xl shadow-sm border border-outline-variant/60 flex items-center px-3 h-10 transition-all focus-within:border-primary">
                        <Search className="w-4 h-4 text-outline mr-2" />
                        <input
                            type="text"
                            placeholder="Tìm theo số hiệu, tên văn bản, nội dung điều khoản..."
                            className="flex-1 h-full outline-none text-[13px] font-medium text-on-surface placeholder-outline bg-transparent"
                            value={searchQuery}
                            onChange={(e) => { setSearchQuery(e.target.value); setShowDeepSearch(e.target.value.length >= 2); }}
                            onFocus={() => { if (searchQuery.length >= 2) setShowDeepSearch(true); }}
                        />
                        {searchQuery && (
                            <button onClick={() => { setSearchQuery(''); setShowDeepSearch(false); }} className="p-1 text-outline hover:text-error transition-colors cursor-pointer">
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                    
                    {/* Deep Search Dropdown */}
                    {showDeepSearch && deepSearchResults.length > 0 && (
                        <div className="absolute top-12 left-0 right-0 z-50 bg-surface rounded-2xl shadow-2xl border border-outline-variant p-3 space-y-2 max-h-96 overflow-y-auto custom-scrollbar animate-in slide-in-from-top-2 duration-200">
                            <div className="flex items-center justify-between px-2 pb-2 border-b border-outline-variant/30">
                                <span className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-1">
                                    <Search className="w-3.5 h-3.5" /> Tìm thấy {deepSearchResults.length} điều khoản phù hợp
                                </span>
                                <button onClick={() => setShowDeepSearch(false)} className="text-outline hover:text-on-surface cursor-pointer">
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                            {deepSearchResults.map(r => (
                                <DeepSearchResult key={r.articleId} result={r} query={searchQuery} onNavigate={navigateDeepSearch} />
                            ))}
                        </div>
                    )}
                </div>
                
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none shrink-0">
                    <Filter className="w-3.5 h-3.5 text-outline mr-1 shrink-0" />
                    {(['all', 'luat', 'nghi-dinh', 'thong-tu', 'qcvn', 'quyet-dinh'] as const).map(type => {
                        const isActive = filterType === type;
                        const label = type === 'all' ? 'Tất cả' : DOC_TYPE_LABELS[type];
                        const count = type === 'all' ? stats.total : (stats.byType[type] ?? 0);
                        return (
                            <button key={type} onClick={() => setFilterType(type)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all border shrink-0 cursor-pointer ${isActive
                                    ? 'bg-primary text-white border-primary shadow-sm'
                                    : 'bg-surface text-on-surface-variant border-outline-variant/60 hover:bg-surface-container-low'}`}>
                                {label}
                                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-black ${isActive ? 'bg-white/20 text-white' : 'bg-surface-container-high text-on-surface-variant'}`}>{count}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
