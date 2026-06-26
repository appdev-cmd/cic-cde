/**
 * useLegalDocuments — Custom React hooks for fetching legal document data.
 * Built using standard React state and effects, bypassing @tanstack/react-query
 * to ensure 100% compatibility with React 19 and zero external package dependencies.
 * Implements a lightweight in-memory cache to prevent redundant fetches.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
    LegalDocumentService,
    LegalDocumentDB,
    LegalDocumentSearchParams,
    DocType,
    DocStatus,
} from '../../lib/api/LegalDocumentService';

// Simple in-memory cache to prevent duplicate fetches (simulating react-query staleTime)
const cache: Record<string, { data: any; timestamp: number }> = {};
const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes cache

function getCachedData(key: string) {
    const entry = cache[key];
    if (entry && (Date.now() - entry.timestamp) < CACHE_DURATION) {
        return entry.data;
    }
    return null;
}

function setCachedData(key: string, data: any) {
    cache[key] = { data, timestamp: Date.now() };
}

function invalidateCache() {
    // Clear all cache entries
    Object.keys(cache).forEach(key => delete cache[key]);
}

// ------------------------------------------------------------------ //
// Hook: useDocumentList — paginated search list
// ------------------------------------------------------------------ //
export interface UseDocumentListOptions {
    searchQuery?: string;
    type?: DocType | '';
    status?: DocStatus | '';
    page?: number;
    pageSize?: number;
}

export function useDocumentList(options: UseDocumentListOptions = {}) {
    const { searchQuery = '', type = '', status = '', page = 1, pageSize = 100 } = options;
    const [data, setData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const cacheKey = `list-${searchQuery}-${type}-${status}-${page}-${pageSize}`;

    useEffect(() => {
        let active = true;
        const cached = getCachedData(cacheKey);
        if (cached) {
            setData(cached);
            return;
        }

        setIsLoading(true);
        LegalDocumentService.searchDocuments({ searchQuery, type, status, page, pageSize })
            .then(res => {
                if (!active) return;
                setCachedData(cacheKey, res);
                setData(res);
                setIsLoading(false);
            })
            .catch(err => {
                if (!active) return;
                setError(err);
                setIsLoading(false);
            });

        return () => { active = false; };
    }, [searchQuery, type, status, page, pageSize, cacheKey]);

    return { data, isLoading, error };
}

// ------------------------------------------------------------------ //
// Hook: useDocumentDetail — single document with chapters + articles
// ------------------------------------------------------------------ //
export function useDocumentDetail(id: string | null) {
    const [data, setData] = useState<LegalDocumentDB | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const cacheKey = `detail-${id}`;

    useEffect(() => {
        if (!id) {
            setData(null);
            return;
        }

        let active = true;
        const cached = getCachedData(cacheKey);
        if (cached) {
            setData(cached);
            return;
        }

        setIsLoading(true);
        LegalDocumentService.getDocumentById(id)
            .then(res => {
                if (!active) return;
                setCachedData(cacheKey, res);
                setData(res);
                setIsLoading(false);
            })
            .catch(err => {
                if (!active) return;
                setError(err);
                setIsLoading(false);
            });

        return () => { active = false; };
    }, [id, cacheKey]);

    return { data, isLoading, error };
}

// ------------------------------------------------------------------ //
// Hook: useLegalStats — stats for header/sidebar
// ------------------------------------------------------------------ //
export function useLegalStats() {
    const [data, setData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const cacheKey = 'stats';

    useEffect(() => {
        let active = true;
        const cached = getCachedData(cacheKey);
        if (cached) {
            setData(cached);
            return;
        }

        setIsLoading(true);
        LegalDocumentService.getStats()
            .then(res => {
                if (!active) return;
                setCachedData(cacheKey, res);
                setData(res);
                setIsLoading(false);
            })
            .catch(err => {
                if (!active) return;
                setError(err);
                setIsLoading(false);
            });

        return () => { active = false; };
    }, [cacheKey]);

    return { data, isLoading, error };
}

// ------------------------------------------------------------------ //
// Hook: useRelatedDocuments
// ------------------------------------------------------------------ //
export function useRelatedDocuments(docId: string | null) {
    const [data, setData] = useState<LegalDocumentDB[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const cacheKey = `related-${docId}`;

    useEffect(() => {
        if (!docId) {
            setData([]);
            return;
        }

        let active = true;
        const cached = getCachedData(cacheKey);
        if (cached) {
            setData(cached);
            return;
        }

        setIsLoading(true);
        LegalDocumentService.getRelatedDocuments(docId)
            .then(res => {
                if (!active) return;
                setCachedData(cacheKey, res);
                setData(res);
                setIsLoading(false);
            })
            .catch(err => {
                if (!active) return;
                setError(err);
                setIsLoading(false);
            });

        return () => { active = false; };
    }, [docId, cacheKey]);

    return { data, isLoading, error };
}

// ------------------------------------------------------------------ //
// Hook: useDeepSearch — global article-level search
// ------------------------------------------------------------------ //
export function useDeepSearch(query: string, documentId?: string | null) {
    const debouncedQuery = useDebounce(query, 350);
    const [data, setData] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const cacheKey = `deepsearch-${debouncedQuery}-${documentId || 'all'}`;

    useEffect(() => {
        if (debouncedQuery.length < 2) {
            setData([]);
            return;
        }

        let active = true;
        const cached = getCachedData(cacheKey);
        if (cached) {
            setData(cached);
            return;
        }

        setIsLoading(true);
        LegalDocumentService.searchArticles(debouncedQuery, documentId || undefined)
            .then(res => {
                if (!active) return;
                setCachedData(cacheKey, res);
                setData(res);
                setIsLoading(false);
            })
            .catch(err => {
                if (!active) return;
                setError(err);
                setIsLoading(false);
            });

        return () => { active = false; };
    }, [debouncedQuery, documentId, cacheKey]);

    return { data, isLoading, error };
}

// ------------------------------------------------------------------ //
// Utility: useDebounce
// ------------------------------------------------------------------ //
export function useDebounce<T>(value: T, delay: number): T {
    const [debounced, setDebounced] = useState<T>(value);
    useEffect(() => {
        const timer = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(timer);
    }, [value, delay]);
    return debounced;
}

// ------------------------------------------------------------------ //
// Hook: usePrefetchDocument — prefetch on hover for instant loading
// ------------------------------------------------------------------ //
export function usePrefetchDocument() {
    return useCallback((id: string) => {
        const cacheKey = `detail-${id}`;
        // If not already cached, fetch it in the background and cache it
        if (!getCachedData(cacheKey)) {
            LegalDocumentService.getDocumentById(id)
                .then(res => {
                    setCachedData(cacheKey, res);
                })
                .catch(() => {
                    // Silently ignore prefetch errors
                });
        }
    }, []);
}

// ------------------------------------------------------------------ //
// Hook: useDeleteDocument — delete document mutation
// ------------------------------------------------------------------ //
export function useDeleteDocument() {
    const [isPending, setIsPending] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const mutateAsync = useCallback(async (id: string) => {
        setIsPending(true);
        try {
            await LegalDocumentService.deleteDocument(id);
            invalidateCache(); // Invalidate cache on deletion
            setIsPending(false);
        } catch (err: any) {
            setError(err);
            setIsPending(false);
            throw err;
        }
    }, []);

    return { mutateAsync, isPending, error };
}
