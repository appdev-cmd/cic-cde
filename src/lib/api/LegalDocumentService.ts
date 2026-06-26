/**
 * LegalDocumentService — Service for fetching legal document data from Supabase.
 * Connects to the public schema tables: legal_documents, legal_chapters, legal_articles.
 */

import { supabase } from '../supabase';

// Bypass excessively deep type instantiation for massive schemas
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type DocType = 'luat' | 'nghi-dinh' | 'thong-tu' | 'qcvn' | 'quyet-dinh';
export type DocStatus = 'hieu-luc' | 'het-hieu-luc' | 'sap-hieu-luc';

export interface LegalArticleDB {
    id: string;
    chapter_id: string;
    document_id: string;
    code: string;
    title: string;
    summary: string | null;
    content: string | null;
    full_content: string | null;
    sort_order: number;
}

export interface LegalChapterDB {
    id: string;
    document_id: string;
    code: string;
    title: string;
    sort_order: number;
    articles?: LegalArticleDB[];
}

export interface LegalDocumentDB {
    id: string;
    code: string;
    title: string;
    short_title: string | null;
    type: DocType;
    issued_date: string | null;
    effective_date: string | null;
    issued_by: string | null;
    status: DocStatus;
    summary: string | null;
    file_name: string | null;
    file_path: string | null;
    file_size: string | null;
    tags: string[];
    related_doc_ids: string[];
    created_at: string;
    updated_at: string;
    chapters?: LegalChapterDB[];
}

export interface LegalDocumentSearchParams {
    searchQuery?: string;
    type?: DocType | '';
    status?: DocStatus | '';
    page?: number;
    pageSize?: number;
}

export interface LegalDocumentSearchResult {
    documents: LegalDocumentDB[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}

export const DOC_TYPE_LABELS: Record<DocType, string> = {
    'luat': 'Luật',
    'nghi-dinh': 'Nghị định',
    'thong-tu': 'Thông tư',
    'qcvn': 'QCVN/TCVN',
    'quyet-dinh': 'Quyết định',
};

export const DOC_STATUS_LABELS: Record<DocStatus, string> = {
    'hieu-luc': 'Còn hiệu lực',
    'het-hieu-luc': 'Hết hiệu lực',
    'sap-hieu-luc': 'Sắp có hiệu lực',
};

export const DOC_TYPE_COLORS: Record<DocType, { bg: string; text: string; border: string }> = {
    'luat': { bg: 'bg-error/10 dark:bg-error/20', text: 'text-error dark:text-error-container', border: 'border-error/20' },
    'nghi-dinh': { bg: 'bg-primary/10 dark:bg-primary/20', text: 'text-primary dark:text-primary-fixed-dim', border: 'border-primary/20' },
    'thong-tu': { bg: 'bg-success/10 dark:bg-success/20', text: 'text-success dark:text-success-container', border: 'border-success/20' },
    'qcvn': { bg: 'bg-warning/10 dark:bg-warning/20', text: 'text-warning dark:text-warning-container', border: 'border-warning/20' },
    'quyet-dinh': { bg: 'bg-secondary/10 dark:bg-secondary/20', text: 'text-secondary dark:text-secondary-fixed-dim', border: 'border-secondary/20' },
};

export const DOC_STATUS_COLORS: Record<DocStatus, { bg: string; text: string; dot: string; border?: string }> = {
    'hieu-luc': { bg: 'bg-success/10 dark:bg-success/20', text: 'text-success', dot: 'bg-success', border: 'border-success/20' },
    'het-hieu-luc': { bg: 'bg-outline-variant/20 dark:bg-outline-variant/10', text: 'text-outline', dot: 'bg-outline', border: 'border-outline-variant/30' },
    'sap-hieu-luc': { bg: 'bg-warning/10 dark:bg-warning/20', text: 'text-warning', dot: 'bg-warning', border: 'border-warning/20' },
};

export const LegalDocumentService = {
    /**
     * Search documents with pagination and filters.
     */
    async searchDocuments(params: LegalDocumentSearchParams = {}): Promise<LegalDocumentSearchResult> {
        const { searchQuery = '', type = '', status = '', page = 1, pageSize = 100 } = params;
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        let query = db
            .from('legal_documents')
            .select('*', { count: 'exact' })
            .order('issued_date', { ascending: false })
            .range(from, to);

        if (type) query = query.eq('type', type);
        if (status) query = query.eq('status', status);

        if (searchQuery.trim()) {
            // Server-side Full Text Search (FTS) using the generated 'fts' tsvector column
            query = query.textSearch('fts', searchQuery, { type: 'websearch', config: 'simple' });
        }

        const { data, error, count } = await query;

        if (error) throw new Error(`Failed to search legal documents: ${error.message}`);

        const total = count ?? 0;
        return {
            documents: (data as LegalDocumentDB[]) ?? [],
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize),
        };
    },

    /**
     * Get a single document with its chapters and articles.
     */
    async getDocumentById(id: string): Promise<LegalDocumentDB | null> {
        const { data: doc, error: docErr } = await db
            .from('legal_documents')
            .select('*')
            .eq('id', id)
            .single();

        if (docErr || !doc) return null;

        const { data: chapters, error: chapErr } = await db
            .from('legal_chapters')
            .select('*')
            .eq('document_id', id)
            .order('sort_order', { ascending: true });

        if (chapErr) throw new Error(`Failed to fetch chapters: ${chapErr.message}`);

        const { data: articles, error: artErr } = await db
            .from('legal_articles')
            .select('*')
            .eq('document_id', id)
            .order('sort_order', { ascending: true });

        if (artErr) throw new Error(`Failed to fetch articles: ${artErr.message}`);

        const chaptersWithArticles = (chapters ?? []).map((ch: any) => ({
            ...ch,
            articles: (articles ?? []).filter((a: any) => a.chapter_id === ch.id),
        }));

        return {
            ...(doc as LegalDocumentDB),
            chapters: chaptersWithArticles,
        };
    },

    /**
     * Get documents related to a given document ID.
     */
    async getRelatedDocuments(docId: string): Promise<LegalDocumentDB[]> {
        const { data: doc } = await db
            .from('legal_documents')
            .select('related_doc_ids')
            .eq('id', docId)
            .single();

        if (!doc || !doc.related_doc_ids?.length) return [];

        const { data, error } = await db
            .from('legal_documents')
            .select('id, code, title, short_title, type, status, issued_date')
            .in('id', doc.related_doc_ids);

        if (error) throw new Error(`Failed to fetch related docs: ${error.message}`);
        return (data as LegalDocumentDB[]) ?? [];
    },

    /**
     * Search within articles (Global or Document-specific Deep Search).
     */
    async searchArticles(query: string, documentId?: string): Promise<any[]> {
        let queryBuilder = db
            .from('legal_articles')
            .select('*, document:legal_documents(code, short_title)')
            .textSearch('fts', query, { type: 'websearch', config: 'simple' })
            .limit(50);

        if (documentId) {
            queryBuilder = queryBuilder.eq('document_id', documentId);
        }

        const { data, error } = await queryBuilder;
        if (error) throw new Error(`Failed to search articles: ${error.message}`);
        return data ?? [];
    },

    /**
     * Get document stats (count by type/status).
     */
    async getStats(): Promise<{ byType: Record<DocType, number>; byStatus: Record<DocStatus, number>; total: number }> {
        const { data, error } = await db
            .from('legal_documents')
            .select('type, status');

        if (error) throw new Error(`Failed to get stats: ${error.message}`);

        const docs = data ?? [];
        const total = docs.length;

        const byType = docs.reduce((acc: Record<DocType, number>, d: any) => {
            acc[d.type as DocType] = (acc[d.type as DocType] ?? 0) + 1;
            return acc;
        }, {} as Record<DocType, number>);

        const byStatus = docs.reduce((acc: Record<DocStatus, number>, d: any) => {
            acc[d.status as DocStatus] = (acc[d.status as DocStatus] ?? 0) + 1;
            return acc;
        }, {} as Record<DocStatus, number>);

        return { byType, byStatus, total };
    },

    /**
     * Delete a legal document by its ID.
     */
    async deleteDocument(id: string): Promise<void> {
        const { error } = await db
            .from('legal_documents')
            .delete()
            .eq('id', id);

        if (error) throw new Error(`Failed to delete legal document: ${error.message}`);
    },
};
