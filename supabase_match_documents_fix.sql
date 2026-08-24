-- ==============================================================================
-- CORREÇÃO DA FUNÇÃO MATCH_DOCUMENTS NO SUPABASE PARA O N8N
-- Execute este script no SQL Editor do Supabase!
-- ==============================================================================

-- 1. Garante a coluna com 768 dimensões para o Google Gemini
ALTER TABLE tzion_knowledge_documents 
  ALTER COLUMN embedding TYPE vector(768);

-- 2. Recria o índice HNSW
DROP INDEX IF EXISTS tzion_knowledge_embedding_idx;
CREATE INDEX tzion_knowledge_embedding_idx
  ON tzion_knowledge_documents
  USING hnsw (embedding vector_cosine_ops);

-- 3. Cria a função exata que o n8n procura: public.match_documents
CREATE OR REPLACE FUNCTION match_documents (
  query_embedding VECTOR(768),
  match_count INT DEFAULT 4,
  filter JSONB DEFAULT '{}'::jsonb
) RETURNS TABLE (
  id UUID,
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
    d.content,
    COALESCE(d.metadata, '{}'::jsonb) || jsonb_build_object('title', d.title, 'category', d.category) AS metadata,
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
