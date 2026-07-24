-- ==============================================================================
-- TZION TERAPIAS — Sincronização Automática de Usuários do Auth para public.profiles
-- ==============================================================================
-- Execute este script no SQL Editor do Supabase para:
-- 1. Liberar permissão de leitura na tabela public.profiles para a equipe autenticada
-- 2. Sincronizar todas as contas criadas no Auth para a Gestão de Usuários com status 'pending'
-- 3. Criar a Trigger que adiciona novos cadastros do Auth automaticamente como 'pending'

-- 0. Garantir colunas essenciais na tabela public.profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- 1. Garantir RLS e Política de Leitura/Escrita para usuários autenticados
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Perfis visiveis para usuarios autenticados" ON public.profiles;

CREATE POLICY "Perfis visiveis para usuarios autenticados" ON public.profiles
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);

-- 2. Sincronizar usuários existentes de auth.users para public.profiles
INSERT INTO public.profiles (id, name, email, role, status, created_at, updated_at)
SELECT 
    u.id,
    COALESCE(NULLIF(u.raw_user_meta_data->>'name', ''), split_part(u.email, '@', 1)),
    LOWER(u.email),
    COALESCE(NULLIF(u.raw_user_meta_data->>'role', ''), 'terapeuta'),
    'pending',
    COALESCE(u.created_at, NOW()),
    NOW()
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = NOW();

-- 3. Criar função para inserção automática ao cadastrar novo usuário no Auth
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.profiles (id, name, email, role, status, created_at, updated_at)
    VALUES (
        NEW.id,
        COALESCE(NULLIF(NEW.raw_user_meta_data->>'name', ''), split_part(NEW.email, '@', 1)),
        LOWER(NEW.email),
        COALESCE(NULLIF(NEW.raw_user_meta_data->>'role', ''), 'terapeuta'),
        'pending',
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Criar a Trigger na tabela auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

SELECT 'Usuários do Auth sincronizados como PENDENTES e Trigger ativada com sucesso!' AS resultado;
