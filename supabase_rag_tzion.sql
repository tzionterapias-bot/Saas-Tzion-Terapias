-- ==============================================================================
-- ESTRUTURA RAG (RETRIEVAL-AUGMENTED GENERATION) PARA TZION TERAPIAS
-- Compatível com Supabase pgvector, LangChain e nós de Vector Store do n8n (Google Gemini 768 dims)
-- ==============================================================================

-- 1. Habilitar a extensão vetorial no Postgres do Supabase
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Tabela oficial da Base de Conhecimento RAG da Tzion
CREATE TABLE IF NOT EXISTS tzion_knowledge_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id TEXT NOT NULL DEFAULT 'tzion',
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'geral', -- 'care_180', 'especialidades', 'regras', 'institucional', 'faq'
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  embedding VECTOR(768), -- Dimensão padrão para Google Gemini Embeddings
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Se a tabela já existia com outra dimensão, ajusta para 768:
ALTER TABLE tzion_knowledge_documents 
  ALTER COLUMN embedding TYPE vector(768);

-- 3. Habilitar RLS (Row Level Security) e permitir leitura anônima/autenticada
ALTER TABLE tzion_knowledge_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura pública da base de conhecimento" ON tzion_knowledge_documents;
CREATE POLICY "Permitir leitura pública da base de conhecimento"
  ON tzion_knowledge_documents FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Permitir gerenciamento por administradores/service_role" ON tzion_knowledge_documents;
CREATE POLICY "Permitir gerenciamento por administradores/service_role"
  ON tzion_knowledge_documents FOR ALL
  USING (auth.role() = 'service_role' OR auth.role() = 'authenticated');

-- 4. Índice HNSW de alta performance para busca semântica por similaridade de cosseno
DROP INDEX IF EXISTS tzion_knowledge_embedding_idx;
CREATE INDEX IF NOT EXISTS tzion_knowledge_embedding_idx
  ON tzion_knowledge_documents
  USING hnsw (embedding vector_cosine_ops);

-- 5. Função RPC (Remote Procedure Call) consumida pelo n8n / LangChain
CREATE OR REPLACE FUNCTION match_tzion_documents (
  query_embedding VECTOR(768),
  match_count INT DEFAULT 4,
  filter JSONB DEFAULT '{}'::jsonb
) RETURNS TABLE (
  id UUID,
  title TEXT,
  category TEXT,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.title,
    d.category,
    d.content,
    d.metadata,
    1 - (d.embedding <=> query_embedding) AS similarity
  FROM tzion_knowledge_documents d
  WHERE d.embedding IS NOT NULL
    AND (
      filter = '{}'::jsonb 
      OR d.metadata @> filter 
      OR d.instance_id = COALESCE(filter->>'instance_id', d.instance_id)
    )
  ORDER BY d.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
