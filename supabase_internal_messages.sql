-- ==============================================================================
-- TZION TERAPIAS — Tabela do Chat Interno da Equipe (internal_messages)
-- ==============================================================================
-- Execute este script no SQL Editor do Supabase para habilitar o Chat Interno.

CREATE TABLE IF NOT EXISTS public.internal_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_name TEXT NOT NULL,
    sender_role TEXT NOT NULL,
    content TEXT NOT NULL,
    channel TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS e permitir leitura/inserção para membros autenticados da equipe
ALTER TABLE public.internal_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Equipe le mensagens internas" ON public.internal_messages;
DROP POLICY IF EXISTS "Equipe envia mensagens internas" ON public.internal_messages;

CREATE POLICY "Equipe le mensagens internas" ON public.internal_messages
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Equipe envia mensagens internas" ON public.internal_messages
    FOR INSERT TO authenticated
    WITH CHECK (true);

-- Criar índice para busca rápida por canal
CREATE INDEX IF NOT EXISTS idx_internal_messages_channel ON public.internal_messages (channel, created_at);

SELECT 'Tabela internal_messages e políticas RLS criadas com sucesso!' AS resultado;
