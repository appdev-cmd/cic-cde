import React, { useState } from 'react';
import { AlignLeft, Hash, ChevronDown, ChevronRight, BookOpen } from 'lucide-react';
import { LegalDocumentDB } from '../../../lib/api/LegalDocumentService';

interface LegalTOCProps {
    selectedDoc: LegalDocumentDB;
    scrollToArticle: (articleId: string, chapterId: string) => void;
    setExpandedChapters: React.Dispatch<React.SetStateAction<Set<string>>>;
    activeArticleId?: string | null;
}

export const LegalTOC: React.FC<LegalTOCProps> = ({ selectedDoc, scrollToArticle, setExpandedChapters, activeArticleId }) => {
    const chapters = selectedDoc.chapters || [];
    const [expandedTocChapters, setExpandedTocChapters] = useState<Set<string>>(
        new Set(chapters.map(c => c.id))
    );

    const toggleTocChapter = (chapterId: string) => {
        setExpandedTocChapters(prev => {
            const next = new Set(prev);
            if (next.has(chapterId)) next.delete(chapterId);
            else next.add(chapterId);
            return next;
        });
    };

    return (
        <div className="w-72 border-r border-outline-variant/60 bg-surface-container-low overflow-y-auto custom-scrollbar shrink-0 flex flex-col">
            {/* Header */}
            <div className="sticky top-0 bg-surface-container-low/95 backdrop-blur-sm px-4 py-3 border-b border-outline-variant/60 z-10">
                <span className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                    <BookOpen className="w-4 h-4" />
                    Mục lục văn bản
                </span>
                <p className="text-[10px] text-outline mt-0.5 font-medium">
                    {chapters.length} chương · {chapters.reduce((s, c) => s + (c.articles?.length || 0), 0)} điều
                </p>
            </div>

            {/* Chapters & Articles */}
            <div className="flex-1 p-3 space-y-1 bg-surface-container-lowest">
                {chapters.map(ch => {
                    const isChExpanded = expandedTocChapters.has(ch.id);
                    return (
                        <div key={`toc-${ch.id}`} className="mb-1">
                            {/* Chapter header */}
                            <button
                                onClick={() => toggleTocChapter(ch.id)}
                                className="w-full text-left flex items-start gap-2 px-2.5 py-2 rounded-xl hover:bg-surface-container-low transition-colors group cursor-pointer"
                            >
                                <div className="mt-0.5 shrink-0">
                                    {isChExpanded
                                        ? <ChevronDown className="w-3.5 h-3.5 text-primary" />
                                        : <ChevronRight className="w-3.5 h-3.5 text-outline group-hover:text-primary" />
                                    }
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-black text-primary uppercase tracking-wider">{ch.code}</p>
                                    <p className="text-[11px] font-bold text-on-surface-variant leading-snug mt-0.5 line-clamp-2">{ch.title}</p>
                                </div>
                            </button>

                            {/* Articles list */}
                            {isChExpanded && (
                                <div className="ml-4 pl-3 border-l-2 border-primary/20 space-y-0.5 mt-1 mb-2">
                                    {(ch.articles || []).map(art => {
                                        const isActive = activeArticleId === art.id;
                                        return (
                                            <button
                                                key={`toc-${art.id}`}
                                                onClick={() => {
                                                    setExpandedChapters(prev => {
                                                        const next = new Set(prev);
                                                        next.add(ch.id);
                                                        return next;
                                                    });
                                                    scrollToArticle(art.id, ch.id);
                                                }}
                                                className={`w-full text-left text-[11px] py-1.5 px-2.5 rounded-lg transition-all flex items-start gap-2 group cursor-pointer ${isActive
                                                    ? 'bg-primary/10 text-primary font-bold ring-1 ring-primary/20'
                                                    : 'text-on-surface-variant hover:bg-surface-container-low hover:text-primary'
                                                    }`}
                                                title={`${art.code}: ${art.title}`}
                                            >
                                                <Hash className={`w-3 h-3 mt-0.5 shrink-0 ${isActive ? 'text-primary' : 'opacity-40 group-hover:opacity-100'}`} />
                                                <span className="leading-snug">
                                                    <span className="font-bold">{art.code}.</span>{' '}
                                                    <span className="line-clamp-2">{art.title}</span>
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
