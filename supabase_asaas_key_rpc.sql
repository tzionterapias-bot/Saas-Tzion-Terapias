-- ==============================================================================
-- TZION TERAPIAS — Funções de Segurança para Armazenamento da Chave Asaas
-- ==============================================================================
-- Execute este script no SQL Editor do Supabase para criar as funções RPC.

-- 1. Criar tabela de segredos protegida (se ainda não existir)
CREATE TABLE IF NOT EXISTS public.app_secrets (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Habilitar RLS e proibir acesso direto via API pública
ALTER TABLE public.app_secrets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No direct access to app_secrets" ON public.app_secrets;

CREATE POLICY "No direct access to app_secrets" ON public.app_secrets
    FOR ALL USING (false);

-- 3. Remover versões anteriores das funções para evitar conflito de nome de parâmetros
DROP FUNCTION IF EXISTS public.set_asaas_key(text);
DROP FUNCTION IF EXISTS public.get_asaas_key();
DROP FUNCTION IF EXISTS public.has_asaas_key();

-- 4. Função para salvar a chave Asaas (set_asaas_key)
CREATE OR REPLACE FUNCTION public.set_asaas_key(secret_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.app_secrets (key, value, updated_at)
    VALUES ('asaas_token', secret_key, NOW())
    ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value, updated_at = NOW();
END;
$$;

-- 5. Função para recuperar a chave Asaas (get_asaas_key - usada pelo backend)
CREATE OR REPLACE FUNCTION public.get_asaas_key()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    secret text;
BEGIN
    SELECT value INTO secret FROM public.app_secrets WHERE key = 'asaas_token';
    RETURN secret;
END;
$$;

-- 6. Função para verificar se a chave existe (has_asaas_key - usada pelo frontend)
CREATE OR REPLACE FUNCTION public.has_asaas_key()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    has_key boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM public.app_secrets WHERE key = 'asaas_token' AND value IS NOT NULL AND value != ''
    ) INTO has_key;
    RETURN has_key;
END;
$$;

-- 7. Conceder permissões para executá-las via RPC
GRANT EXECUTE ON FUNCTION public.set_asaas_key(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_asaas_key() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_asaas_key() TO authenticated, service_role;

SELECT 'Funções set_asaas_key, get_asaas_key e has_asaas_key recriadas com sucesso!' AS resultado;
