-- ==============================================================================
-- TZION TERAPIAS — Permissões e Chaves Estrangeiras para Exclusão de Serviços
-- ==============================================================================
-- Execute este script no SQL Editor do Supabase para ajustar a chave estrangeira
-- e permitir a exclusão de serviços mantendo os agendamentos históricos seguros.

-- 1. Alterar a chave estrangeira em appointments para ON DELETE SET NULL
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_service_id_fkey;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_service_id_fkey
  FOREIGN KEY (service_id)
  REFERENCES public.services(id)
  ON DELETE SET NULL;

-- 2. Garantir RLS e Permissões na tabela public.services
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Equipe gerencia servicos" ON public.services;

CREATE POLICY "Equipe gerencia servicos" ON public.services
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);

-- 3. Garantir RLS e Permissões na tabela public.rooms
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Equipe gerencia salas" ON public.rooms;

CREATE POLICY "Equipe gerencia salas" ON public.rooms
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);

-- 4. Garantir RLS e Permissões na tabela public.clinical_templates
ALTER TABLE public.clinical_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Equipe gerencia modelos clinicos" ON public.clinical_templates;

CREATE POLICY "Equipe gerencia modelos clinicos" ON public.clinical_templates
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);

SELECT 'Chave estrangeira e permissões atualizadas para exclusão de serviços!' AS resultado;
