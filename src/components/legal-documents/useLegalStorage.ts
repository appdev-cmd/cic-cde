import { useState, useEffect, useCallback } from 'react';

// ============================================
// LEGAL STORAGE HOOK — Bookmarks & Recently Viewed
// ============================================

const STORAGE_KEYS = {
    BOOKMARKS: 'cic_cde_legal_bookmarks',
    RECENTLY_VIEWED: 'cic_cde_legal_recently_viewed',
    READING_PREFS: 'cic_cde_legal_reading_prefs',
    ARTICLE_EDITS: 'cic_cde_legal_edit_store',
};

export interface BookmarkItem {
    articleId: string;
    docId: string;
    addedAt: number;
    note?: string;
    chapterId?: string;
    docShortTitle?: string;
    articleCode?: string;
    articleTitle?: string;
}

export interface RecentlyViewedItem {
    docId: string;
    viewedAt: number;
}

export interface ReadingPrefs {
    fontSize: 'sm' | 'base' | 'lg';
    expandAll: boolean;
}

function loadFromStorage<T>(key: string, defaultValue: T): T {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : defaultValue;
    } catch {
        return defaultValue;
    }
}

function saveToStorage<T>(key: string, value: T): void {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {
        console.warn('Failed to save to localStorage:', key);
    }
}

// ── Bookmarks Hook ──
export function useBookmarks() {
    const [bookmarks, setBookmarks] = useState<BookmarkItem[]>(() =>
        loadFromStorage(STORAGE_KEYS.BOOKMARKS, [])
    );

    useEffect(() => {
        saveToStorage(STORAGE_KEYS.BOOKMARKS, bookmarks);
    }, [bookmarks]);

    const addBookmark = useCallback((
        articleId: string,
        docId: string,
        note?: string,
        extra?: { chapterId?: string; docShortTitle?: string; articleCode?: string; articleTitle?: string }
    ) => {
        setBookmarks(prev => {
            if (prev.some(b => b.articleId === articleId)) return prev;
            return [...prev, { articleId, docId, addedAt: Date.now(), note, ...extra }];
        });
    }, []);

    const removeBookmark = useCallback((articleId: string) => {
        setBookmarks(prev => prev.filter(b => b.articleId !== articleId));
    }, []);

    const toggleBookmark = useCallback((
        articleId: string,
        docId: string,
        extra?: { chapterId?: string; docShortTitle?: string; articleCode?: string; articleTitle?: string }
    ) => {
        setBookmarks(prev => {
            if (prev.some(b => b.articleId === articleId)) {
                return prev.filter(b => b.articleId !== articleId);
            }
            return [...prev, { articleId, docId, addedAt: Date.now(), ...extra }];
        });
    }, []);

    const isBookmarked = useCallback((articleId: string) => {
        return bookmarks.some(b => b.articleId === articleId);
    }, [bookmarks]);

    const getBookmarksByDoc = useCallback((docId: string) => {
        return bookmarks.filter(b => b.docId === docId);
    }, [bookmarks]);

    const clearAll = useCallback(() => setBookmarks([]), []);

    return { bookmarks, addBookmark, removeBookmark, toggleBookmark, isBookmarked, getBookmarksByDoc, clearAll };
}

// ── Recently Viewed Hook ──
export function useRecentlyViewed(maxItems = 10) {
    const [items, setItems] = useState<RecentlyViewedItem[]>(() =>
        loadFromStorage(STORAGE_KEYS.RECENTLY_VIEWED, [])
    );

    useEffect(() => {
        saveToStorage(STORAGE_KEYS.RECENTLY_VIEWED, items);
    }, [items]);

    const addView = useCallback((docId: string) => {
        setItems(prev => {
            const filtered = prev.filter(i => i.docId !== docId);
            return [{ docId, viewedAt: Date.now() }, ...filtered].slice(0, maxItems);
        });
    }, [maxItems]);

    return { recentlyViewed: items, addView };
}

// ── Reading Preferences Hook ──
export function useReadingPrefs() {
    const [prefs, setPrefs] = useState<ReadingPrefs>(() =>
        loadFromStorage(STORAGE_KEYS.READING_PREFS, { fontSize: 'base' as const, expandAll: false })
    );

    useEffect(() => {
        saveToStorage(STORAGE_KEYS.READING_PREFS, prefs);
    }, [prefs]);

    const setFontSize = useCallback((fontSize: ReadingPrefs['fontSize']) => {
        setPrefs(p => ({ ...p, fontSize }));
    }, []);

    const toggleExpandAll = useCallback(() => {
        setPrefs(p => ({ ...p, expandAll: !p.expandAll }));
    }, []);

    return { prefs, setFontSize, toggleExpandAll };
}

// ── Manual Edits Hook ──
export function useLegalEditStore() {
    const [edits, setEdits] = useState<Record<string, string>>(() =>
        loadFromStorage(STORAGE_KEYS.ARTICLE_EDITS, {})
    );

    useEffect(() => {
        saveToStorage(STORAGE_KEYS.ARTICLE_EDITS, edits);
    }, [edits]);

    const saveEdit = useCallback((articleId: string, newContent: string) => {
        setEdits(prev => ({
            ...prev,
            [articleId]: newContent
        }));
    }, []);

    const getEdit = useCallback((articleId: string) => {
        return edits[articleId];
    }, [edits]);

    const clearEdit = useCallback((articleId: string) => {
        setEdits(prev => {
            const next = { ...prev };
            delete next[articleId];
            return next;
        });
    }, []);

    return { edits, saveEdit, getEdit, clearEdit };
}
