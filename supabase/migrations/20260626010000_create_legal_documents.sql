-- ============================================================
-- Migration: Create legal_documents schema with Full-Text Search
-- Date: 2026-06-26
-- Description: Creates tables for legal documents, chapters, and articles.
--              Includes tsvector generated columns for Vietnamese FTS
--              and RLS policies matching the cic-cde project style.
-- ============================================================

-- ---- Enums ----
DO $$ BEGIN
  CREATE TYPE doc_type AS ENUM ('luat','nghi-dinh','thong-tu','qcvn','quyet-dinh');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE doc_status AS ENUM ('hieu-luc','het-hieu-luc','sap-hieu-luc');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---- Table: legal_documents ----
CREATE TABLE IF NOT EXISTS public.legal_documents (
  id              TEXT PRIMARY KEY,
  code            TEXT NOT NULL,
  title           TEXT NOT NULL,
  short_title     TEXT,
  type            doc_type NOT NULL,
  issued_date     TEXT,
  effective_date  TEXT,
  issued_by       TEXT,
  status          doc_status NOT NULL DEFAULT 'hieu-luc',
  summary         TEXT,
  file_name       TEXT,
  file_path       TEXT,
  file_size       TEXT,
  tags            TEXT[]      DEFAULT '{}',
  related_doc_ids TEXT[]    DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---- Table: legal_chapters ----
CREATE TABLE IF NOT EXISTS public.legal_chapters (
  id          TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES public.legal_documents(id) ON DELETE CASCADE,
  code        TEXT NOT NULL,
  title       TEXT NOT NULL,
  sort_order  INT  NOT NULL DEFAULT 0
);

-- ---- Table: legal_articles ----
CREATE TABLE IF NOT EXISTS public.legal_articles (
  id          TEXT PRIMARY KEY,
  chapter_id  TEXT NOT NULL REFERENCES public.legal_chapters(id) ON DELETE CASCADE,
  document_id TEXT NOT NULL REFERENCES public.legal_documents(id) ON DELETE CASCADE,
  code        TEXT NOT NULL,
  title       TEXT NOT NULL,
  summary     TEXT,
  content     TEXT,
  full_content TEXT,
  sort_order  INT  NOT NULL DEFAULT 0
);

-- ---- Generated FTS Columns for Supabase JS .textSearch() ----
ALTER TABLE public.legal_documents ADD COLUMN IF NOT EXISTS fts tsvector 
  GENERATED ALWAYS AS (to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(summary,'') || ' ' || coalesce(code,''))) STORED;

ALTER TABLE public.legal_articles ADD COLUMN IF NOT EXISTS fts tsvector 
  GENERATED ALWAYS AS (to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(summary,'') || ' ' || coalesce(substring(content from 1 for 100000),''))) STORED;

-- ---- Indexes ----
CREATE INDEX IF NOT EXISTS idx_legal_docs_type ON public.legal_documents(type);
CREATE INDEX IF NOT EXISTS idx_legal_docs_status ON public.legal_documents(status);
CREATE INDEX IF NOT EXISTS idx_legal_docs_tags ON public.legal_documents USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_legal_chapters_doc ON public.legal_chapters(document_id);
CREATE INDEX IF NOT EXISTS idx_legal_articles_chapter ON public.legal_articles(chapter_id);
CREATE INDEX IF NOT EXISTS idx_legal_articles_doc ON public.legal_articles(document_id);
CREATE INDEX IF NOT EXISTS idx_legal_docs_fts ON public.legal_documents USING GIN(fts);
CREATE INDEX IF NOT EXISTS idx_legal_articles_fts ON public.legal_articles USING GIN(fts);

-- ---- Row Level Security (RLS) ----
ALTER TABLE public.legal_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_chapters  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_articles  ENABLE ROW LEVEL SECURITY;

-- Policies: public read (select), authenticated write (all)
DROP POLICY IF EXISTS "read_all_legal_documents" ON public.legal_documents;
CREATE POLICY "read_all_legal_documents" ON public.legal_documents FOR SELECT USING (true);

DROP POLICY IF EXISTS "write_auth_legal_documents" ON public.legal_documents;
CREATE POLICY "write_auth_legal_documents" ON public.legal_documents FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "read_all_legal_chapters" ON public.legal_chapters;
CREATE POLICY "read_all_legal_chapters" ON public.legal_chapters FOR SELECT USING (true);

DROP POLICY IF EXISTS "write_auth_legal_chapters" ON public.legal_chapters;
CREATE POLICY "write_auth_legal_chapters" ON public.legal_chapters FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "read_all_legal_articles" ON public.legal_articles;
CREATE POLICY "read_all_legal_articles" ON public.legal_articles FOR SELECT USING (true);

DROP POLICY IF EXISTS "write_auth_legal_articles" ON public.legal_articles;
CREATE POLICY "write_auth_legal_articles" ON public.legal_articles FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ---- Trigger: updated_at ----
CREATE OR REPLACE FUNCTION update_legal_doc_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_legal_docs_updated ON public.legal_documents;
CREATE TRIGGER trg_legal_docs_updated
  BEFORE UPDATE ON public.legal_documents
  FOR EACH ROW EXECUTE FUNCTION update_legal_doc_timestamp();
