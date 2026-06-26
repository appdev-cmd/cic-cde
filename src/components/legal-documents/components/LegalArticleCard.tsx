import React, { memo, useMemo, useState, useRef, useEffect } from 'react';
import { Bookmark, Link as LinkIcon, Check, Edit3, Save, X, Bold, Italic, Underline, List, ListOrdered, Undo, Redo, Eraser, AlignLeft, AlignCenter, AlignRight, AlignJustify } from 'lucide-react';
import { LegalArticleDB } from '../../../lib/api/LegalDocumentService';
import { HighlightText } from './LegalUI';

interface LegalArticleCardProps {
    article: LegalArticleDB;
    selectedDocId: string;
    isActive: boolean;
    isExpanded: boolean;
    bookmarked: boolean;
    searchQuery: string;
    copiedId: string | null;
    toggleArticleExpansion: (id: string, e: React.MouseEvent) => void;
    toggleBookmark: (articleId: string, docId: string, extra?: { chapterId?: string; docShortTitle?: string; articleCode?: string; articleTitle?: string }) => void;
    handleCopy: (text: string, id: string) => void;
    onSaveEdit?: (articleId: string, newContent: string) => void;
    docShortTitle?: string;
}

// ============================================
// RICH CONTENT RENDERER - supports HTML tables in content
// ============================================
const RichLegalContent: React.FC<{
    content: string;
    searchQuery: string;
    isEditing: boolean;
    onContentChange: (newContent: string) => void;
    editorRef?: React.RefObject<HTMLDivElement | null>;
}> = ({ content, searchQuery, isEditing, onContentChange, editorRef }) => {
    const contentRef = useRef<HTMLDivElement>(null);

    const handleBlur = () => {
        if (!isEditing || !contentRef.current) return;
        onContentChange(contentRef.current.innerHTML);
    };

    const finalHtml = useMemo(() => {
        let raw = content || '';

        // If content is pure text with \n, and contains tables, format it once to HTML
        if (!raw.includes('class="rich-legal-block"')) {
            raw = raw.replace(/\\n/g, '\n');
            
            // CLEANUP MARKDOWN ARTIFACTS
            raw = raw.replace(/(^|\n|\s)([a-zA-Z0-9]+)\\\./g, '$1$2.');
            raw = raw.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
            raw = raw.replace(/\*(.*?)\*/g, '<i>$1</i>');
            raw = raw.replace(/(^|\n)\s*\d+\s*(\n|$)/g, '\n');

            const tableRegex = /<table[\s\S]*?<\/table>/gi;
            let lastIndex = 0;
            let match;
            let newHtml = '';

            while ((match = tableRegex.exec(raw)) !== null) {
                if (match.index > lastIndex) {
                    const textPart = raw.substring(lastIndex, match.index);
                    newHtml += `<div class="rich-legal-block whitespace-pre-line mb-4">${textPart}</div>`;
                }
                newHtml += `<div class="rich-legal-block legal-table-wrapper my-4 overflow-x-auto rounded-xl border border-outline-variant/60 bg-surface-container-low">${match[0]}</div>`;
                lastIndex = match.index + match[0].length;
            }
            if (lastIndex < raw.length) {
                const textPart = raw.substring(lastIndex);
                newHtml += `<div class="rich-legal-block whitespace-pre-line">${textPart}</div>`;
            }
            raw = newHtml;
        }

        // Apply Search Highlighting via simple RegExp replacement on string outside tags
        if (searchQuery && !isEditing) {
            const escapedQuery = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`(${escapedQuery})(?![^<]*>)`, 'gi');
            raw = raw.replace(regex, '<mark class="bg-warning/30 dark:bg-warning/20 text-on-surface rounded px-0.5 font-bold">$1</mark>');
        }

        return raw;
    }, [content, searchQuery, isEditing]);

    return (
        <div
            ref={editorRef || contentRef}
            contentEditable={isEditing}
            onBlur={handleBlur}
            suppressContentEditableWarning={true}
            className={`transition-colors custom-scrollbar leading-relaxed text-sm ${isEditing ? 'bg-warning/5 p-4 rounded-xl border border-warning border-dashed outline-none min-h-[100px]' : ''}`}
            dangerouslySetInnerHTML={{ __html: finalHtml }}
        />
    );
};

const LegalArticleCard: React.FC<LegalArticleCardProps> = ({
    article, selectedDocId, isActive, isExpanded, bookmarked, searchQuery, copiedId,
    toggleArticleExpansion, toggleBookmark, handleCopy, onSaveEdit, docShortTitle
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editedContent, setEditedContent] = useState(article.content || '');
    const editorRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setEditedContent(article.content || '');
    }, [article.content]);

    const handleSaveEdit = () => {
        let finalContent = editedContent;
        if (editorRef.current) {
            finalContent = editorRef.current.innerHTML;
        }
        if (onSaveEdit) {
            onSaveEdit(article.id, finalContent);
        }
        setEditedContent(finalContent);
        setIsEditing(false);
    };

    const handleCancelEdit = () => {
        setEditedContent(article.content || '');
        setIsEditing(false);
    };

    return (
        <div
            id={`article-${article.id}`}
            className={`p-3 md:p-4 rounded-xl border transition-all duration-300 ${isActive
                ? 'bg-primary/5 border-primary/35 shadow-sm ring-1 ring-primary/20'
                : 'bg-surface border-outline-variant/60 hover:border-outline hover:shadow-md'
                } ${isEditing ? 'ring-2 ring-warning/60 ring-offset-2' : ''}`}
        >
            <div className="flex items-start justify-between gap-4">
                <div className="flex-1" onClick={(e) => !isEditing && toggleArticleExpansion(article.id, e)}>
                    <h5 className={`font-bold text-[14px] transition-colors ${isActive ? 'text-primary' : 'text-on-surface'} flex items-center gap-2 ${!isEditing ? 'cursor-pointer' : ''}`}>
                        <span className="font-black text-primary">{article.code}.</span>
                        <HighlightText text={article.title} query={searchQuery} />
                        {isEditing && (
                            <span className="ml-2 px-2 py-0.5 text-xs font-semibold bg-warning/20 text-warning rounded-full">
                                Chế độ sửa
                            </span>
                        )}
                    </h5>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    {isEditing ? (
                        <>
                            <button
                                onClick={handleCancelEdit}
                                className="p-1.5 text-outline hover:text-error hover:bg-error/10 rounded-lg transition-all cursor-pointer flex items-center gap-1"
                                title="Hủy thay đổi"
                            >
                                <X className="w-4 h-4" />
                            </button>
                            <button
                                onClick={handleSaveEdit}
                                className="p-1.5 text-success hover:text-success hover:bg-success/10 rounded-lg transition-all cursor-pointer flex items-center gap-1 font-semibold"
                                title="Lưu thay đổi"
                            >
                                <Save className="w-4 h-4" />
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsEditing(true);
                                    if (!isExpanded) {
                                        toggleArticleExpansion(article.id, e);
                                    }
                                }}
                                className="p-1.5 text-outline hover:text-primary hover:bg-primary/10 rounded-lg transition-all cursor-pointer"
                                title="Chỉnh sửa nội dung"
                            >
                                <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => handleCopy(article.content || '', article.id)}
                                className="p-1.5 text-outline hover:text-primary hover:bg-primary/10 rounded-lg transition-all cursor-pointer"
                                title="Sao chép nội dung"
                            >
                                {copiedId === article.id ? <Check className="w-4 h-4 text-success font-bold" /> : <LinkIcon className="w-4 h-4" />}
                            </button>
                            <button
                                onClick={() => toggleBookmark(article.id, selectedDocId, {
                                    chapterId: article.chapter_id,
                                    docShortTitle: docShortTitle || 'Văn bản đã lưu',
                                    articleCode: article.code,
                                    articleTitle: article.title
                                })}
                                className={`p-1.5 rounded-lg transition-all cursor-pointer ${bookmarked
                                    ? 'text-primary bg-primary/10'
                                    : 'text-outline hover:text-primary hover:bg-primary/10'
                                    }`}
                                title={bookmarked ? "Bỏ đánh dấu" : "Đánh dấu điều khoản này"}
                            >
                                <Bookmark className={`w-4 h-4 ${bookmarked ? 'fill-current' : ''}`} />
                            </button>
                        </>
                    )}
                </div>
            </div>

            {isExpanded && (
                <div className="mt-3 pt-3 border-t border-outline-variant/60">
                    {article.summary && (
                        <p className="text-on-surface-variant mb-3 pb-3 border-b border-dashed border-outline-variant/60 italic opacity-85 leading-relaxed text-xs">
                            <HighlightText text={article.summary} query={searchQuery} />
                        </p>
                    )}
                    <div className="text-on-surface leading-loose space-y-2 relative text-justify">
                        {isEditing && (
                            <div className="sticky top-0 z-20 flex flex-wrap items-center gap-1 p-1.5 bg-surface-container-high border border-outline-variant rounded-xl mb-4 text-on-surface-variant shadow-sm">
                                <button onMouseDown={(e) => { e.preventDefault(); document.execCommand('bold', false); }} className="p-1.5 hover:bg-surface-container-highest rounded-lg transition-colors cursor-pointer" title="In đậm"><Bold className="w-4 h-4" /></button>
                                <button onMouseDown={(e) => { e.preventDefault(); document.execCommand('italic', false); }} className="p-1.5 hover:bg-surface-container-highest rounded-lg transition-colors cursor-pointer" title="In nghiêng"><Italic className="w-4 h-4" /></button>
                                <button onMouseDown={(e) => { e.preventDefault(); document.execCommand('underline', false); }} className="p-1.5 hover:bg-surface-container-highest rounded-lg transition-colors cursor-pointer" title="Gạch chân"><Underline className="w-4 h-4" /></button>

                                <span className="w-px h-5 bg-outline-variant mx-1"></span>

                                <button onMouseDown={(e) => { e.preventDefault(); document.execCommand('justifyLeft', false); }} className="p-1.5 hover:bg-surface-container-highest rounded-lg transition-colors cursor-pointer" title="Căn trái"><AlignLeft className="w-4 h-4" /></button>
                                <button onMouseDown={(e) => { e.preventDefault(); document.execCommand('justifyCenter', false); }} className="p-1.5 hover:bg-surface-container-highest rounded-lg transition-colors cursor-pointer" title="Căn giữa"><AlignCenter className="w-4 h-4" /></button>
                                <button onMouseDown={(e) => { e.preventDefault(); document.execCommand('justifyRight', false); }} className="p-1.5 hover:bg-surface-container-highest rounded-lg transition-colors cursor-pointer" title="Căn phải"><AlignRight className="w-4 h-4" /></button>
                                <button onMouseDown={(e) => { e.preventDefault(); document.execCommand('justifyFull', false); }} className="p-1.5 hover:bg-surface-container-highest rounded-lg transition-colors cursor-pointer" title="Căn đều"><AlignJustify className="w-4 h-4" /></button>

                                <span className="w-px h-5 bg-outline-variant mx-1"></span>

                                <button onMouseDown={(e) => { e.preventDefault(); document.execCommand('insertUnorderedList', false); }} className="p-1.5 hover:bg-surface-container-highest rounded-lg transition-colors cursor-pointer" title="Danh sách chấm"><List className="w-4 h-4" /></button>
                                <button onMouseDown={(e) => { e.preventDefault(); document.execCommand('insertOrderedList', false); }} className="p-1.5 hover:bg-surface-container-highest rounded-lg transition-colors cursor-pointer" title="Danh sách số"><ListOrdered className="w-4 h-4" /></button>

                                <span className="w-px h-5 bg-outline-variant mx-1"></span>

                                <button onMouseDown={(e) => { e.preventDefault(); document.execCommand('undo', false); }} className="p-1.5 hover:bg-surface-container-highest rounded-lg transition-colors cursor-pointer" title="Hoàn tác"><Undo className="w-4 h-4" /></button>
                                <button onMouseDown={(e) => { e.preventDefault(); document.execCommand('redo', false); }} className="p-1.5 hover:bg-surface-container-highest rounded-lg transition-colors cursor-pointer" title="Làm lại"><Redo className="w-4 h-4" /></button>
                                <button onMouseDown={(e) => { e.preventDefault(); document.execCommand('removeFormat', false); }} className="p-1.5 hover:bg-surface-container-highest rounded-lg transition-colors text-error cursor-pointer" title="Xóa định dạng"><Eraser className="w-4 h-4" /></button>

                                <div className="ml-auto text-[10px] font-bold text-primary bg-primary-container/20 px-2 py-1 rounded-lg">
                                    SOẠN THẢO
                                </div>
                            </div>
                        )}
                        <RichLegalContent
                            content={editedContent}
                            searchQuery={searchQuery}
                            isEditing={isEditing}
                            onContentChange={setEditedContent}
                            editorRef={editorRef}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default memo(LegalArticleCard);
