-- =============================================
-- TZION TERAPIAS — Tabela e Políticas RLS de Insumos (supplies)
-- Execute no painel SQL do Supabase → SQL Editor
-- =============================================

-- 1. Criar a tabela de insumos se ainda não existir
CREATE TABLE IF NOT EXISTS public.supplies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category TEXT DEFAULT 'Outros',
    stock NUMERIC DEFAULT 0,
    min_stock NUMERIC DEFAULT 0,
    price NUMERIC(10,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Habilitar Row Level Security (RLS)
ALTER TABLE public.supplies ENABLE ROW LEVEL SECURITY;

-- 3. Remover políticas antigas para evitar conflito/duplicidade
DROP POLICY IF EXISTS "Permitir leitura de insumos para todos" ON public.supplies;
DROP POLICY IF EXISTS "Permitir alteracao de insumos para todos" ON public.supplies;
DROP POLICY IF EXISTS "Permitir insercao de insumos para todos" ON public.supplies;
DROP POLICY IF EXISTS "Permitir exclusao de insumos para todos" ON public.supplies;
DROP POLICY IF EXISTS "Equipe gerencia insumos" ON public.supplies;
DROP POLICY IF EXISTS "Permitir tudo em insumos" ON public.supplies;

-- 4. Criar política RLS completa para leitura, inserção, atualização e exclusão
CREATE POLICY "Equipe gerencia insumos" ON public.supplies
    FOR ALL TO public
    USING (true)
    WITH CHECK (true);

SELECT 'Tabela e políticas RLS de insumos configuradas com sucesso!' AS resultado;
