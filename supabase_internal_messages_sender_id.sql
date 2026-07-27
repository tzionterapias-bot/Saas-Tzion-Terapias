-- ==============================================================================
-- TZION TERAPIAS - Adicionar sender_id a tabela internal_messages
-- ==============================================================================
-- Execute este script no SQL Editor do Supabase.

-- Adicionar coluna sender_id (UUID, referencia auth.users)
ALTER TABLE public.internal_messages
  ADD COLUMN IF NOT EXISTS sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Indice para busca por sender
CREATE INDEX IF NOT EXISTS idx_internal_messages_sender ON public.internal_messages (sender_id);

-- Realtime ja esta habilitado para esta tabela (nada a fazer)

SELECT 'sender_id adicionado com sucesso!' AS resultado;
