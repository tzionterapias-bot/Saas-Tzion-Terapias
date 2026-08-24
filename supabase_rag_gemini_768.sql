-- ==============================================================================
-- AJUSTE DE DIMENSÃO PARA GOOGLE GEMINI EMBEDDINGS (768 DIMENSÕES)
-- Execute este script no SQL Editor do Supabase para suportar o Gemini!
-- ==============================================================================

-- 1. Alterar a coluna embedding para 768 dimensões (padrão Google Gemini)
ALTER TABLE tzion_knowledge_documents 
  ALTER COLUMN embedding TYPE vector(768);

-- 2. Recriar o índice HNSW para 768 dimensões
DROP INDEX IF EXISTS tzion_knowledge_embedding_idx;

CREATE INDEX tzion_knowledge_embedding_idx
  ON tzion_knowledge_documents
  USING hnsw (embedding vector_cosine_ops);

-- 3. Atualizar a função RPC para receber vetor de 768 dimensões do Gemini
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
