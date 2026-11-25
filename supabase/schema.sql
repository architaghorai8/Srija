-- eDNA BioScope — Supabase PostgreSQL Schema & Row Level Security
-- Associates scientific datasets with users via their authentication UID (e.g., Firebase UID).

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Datasets table
CREATE TABLE IF NOT EXISTS public.datasets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  dataset_name TEXT NOT NULL CHECK (char_length(dataset_name) BETWEEN 2 AND 160),
  sample_id TEXT NOT NULL CHECK (char_length(sample_id) BETWEEN 1 AND 80),
  sample_type TEXT NOT NULL CHECK (sample_type IN ('water', 'soil', 'sediment', 'air', 'biofilm', 'tissue', 'other')),
  location TEXT NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  collection_date DATE NOT NULL,
  notes TEXT DEFAULT '',
  file_path TEXT NOT NULL,
  file_format TEXT NOT NULL CHECK (file_format IN ('fasta', 'fastq', 'csv', 'txt')),
  file_size BIGINT NOT NULL DEFAULT 0,
  sequence_count INTEGER NOT NULL DEFAULT 0,
  gc_content DOUBLE PRECISION DEFAULT 0,
  upload_status TEXT NOT NULL DEFAULT 'validated',
  analysis_mode TEXT NOT NULL DEFAULT 'local_reference_demo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_datasets_user_id ON public.datasets (user_id);
CREATE INDEX IF NOT EXISTS idx_datasets_collection_date ON public.datasets (collection_date);

-- 2. Analysis Jobs table
CREATE TABLE IF NOT EXISTS public.analysis_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id UUID NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  analysis_mode TEXT NOT NULL DEFAULT 'local_reference_demo',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_analysis_jobs_dataset_id ON public.analysis_jobs (dataset_id);
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_user_id ON public.analysis_jobs (user_id);

-- 3. Taxonomic Results table
CREATE TABLE IF NOT EXISTS public.taxonomic_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id UUID NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
  scientific_name TEXT NOT NULL,
  common_name TEXT,
  kingdom TEXT NOT NULL,
  phylum TEXT NOT NULL,
  class TEXT NOT NULL,
  order_name TEXT NOT NULL,
  family TEXT NOT NULL,
  genus TEXT NOT NULL,
  species TEXT NOT NULL,
  read_count INTEGER NOT NULL DEFAULT 1,
  relative_abundance DOUBLE PRECISION NOT NULL DEFAULT 0,
  similarity DOUBLE PRECISION NOT NULL CHECK (similarity BETWEEN 0 AND 100),
  confidence DOUBLE PRECISION NOT NULL CHECK (confidence BETWEEN 0 AND 100),
  uncertain_matches JSONB DEFAULT '[]'::jsonb,
  reference_database TEXT NOT NULL,
  accession_id TEXT NOT NULL,
  marker_gene TEXT DEFAULT 'COI'
);

CREATE INDEX IF NOT EXISTS idx_taxonomic_results_dataset_id ON public.taxonomic_results (dataset_id);
CREATE INDEX IF NOT EXISTS idx_taxonomic_results_kingdom_phylum ON public.taxonomic_results (kingdom, phylum);

-- 4. Biodiversity Metrics table
CREATE TABLE IF NOT EXISTS public.biodiversity_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id UUID NOT NULL UNIQUE REFERENCES public.datasets(id) ON DELETE CASCADE,
  species_richness INTEGER NOT NULL DEFAULT 0,
  shannon_index DOUBLE PRECISION NOT NULL DEFAULT 0,
  simpson_index DOUBLE PRECISION NOT NULL DEFAULT 0,
  simpson_diversity DOUBLE PRECISION NOT NULL DEFAULT 0,
  evenness_index DOUBLE PRECISION NOT NULL DEFAULT 0,
  total_reads INTEGER NOT NULL DEFAULT 0,
  abundance_supported BOOLEAN NOT NULL DEFAULT TRUE,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_biodiversity_metrics_dataset_id ON public.biodiversity_metrics (dataset_id);

-- 5. Reports table
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  dataset_id UUID NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
  report_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_user_id ON public.reports (user_id);

-- Row Level Security (RLS) Policies
ALTER TABLE public.datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taxonomic_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.biodiversity_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Users may only access their own records (auth.jwt()->>'sub' matches Firebase UID or custom JWT claim)
CREATE POLICY "datasets_owner_all" ON public.datasets
  FOR ALL USING (user_id = COALESCE(auth.jwt() ->> 'sub', current_setting('app.current_uid', true)))
  WITH CHECK (user_id = COALESCE(auth.jwt() ->> 'sub', current_setting('app.current_uid', true)));

CREATE POLICY "analysis_jobs_owner_all" ON public.analysis_jobs
  FOR ALL USING (user_id = COALESCE(auth.jwt() ->> 'sub', current_setting('app.current_uid', true)))
  WITH CHECK (user_id = COALESCE(auth.jwt() ->> 'sub', current_setting('app.current_uid', true)));

CREATE POLICY "taxonomic_results_owner_select" ON public.taxonomic_results
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.datasets d
      WHERE d.id = taxonomic_results.dataset_id
        AND d.user_id = COALESCE(auth.jwt() ->> 'sub', current_setting('app.current_uid', true))
    )
  );

CREATE POLICY "biodiversity_metrics_owner_select" ON public.biodiversity_metrics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.datasets d
      WHERE d.id = biodiversity_metrics.dataset_id
        AND d.user_id = COALESCE(auth.jwt() ->> 'sub', current_setting('app.current_uid', true))
    )
  );

CREATE POLICY "reports_owner_all" ON public.reports
  FOR ALL USING (user_id = COALESCE(auth.jwt() ->> 'sub', current_setting('app.current_uid', true)))
  WITH CHECK (user_id = COALESCE(auth.jwt() ->> 'sub', current_setting('app.current_uid', true)));
