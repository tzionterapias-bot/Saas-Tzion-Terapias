-- ==============================================================
-- TZION TERAPIAS — Correções de Segurança e Governança
-- Execute este script no painel SQL Editor do Supabase
-- ==============================================================

BEGIN;

-- ==============================================================
-- 1. ADICIONAR TOKEN SEGURO NA TABELA DE PACIENTES
-- ==============================================================
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS anamnesis_token UUID DEFAULT gen_random_uuid();

-- Preencher tokens para pacientes que já estão cadastrados e têm token nulo
UPDATE public.patients SET anamnesis_token = gen_random_uuid() WHERE anamnesis_token IS NULL;

-- Tornar a coluna única para garantir consistência
ALTER TABLE public.patients DROP CONSTRAINT IF EXISTS patients_anamnesis_token_key;
ALTER TABLE public.patients ADD CONSTRAINT patients_anamnesis_token_key UNIQUE (anamnesis_token);


-- ==============================================================
-- 2. RESTRINGIR ACESSO PÚBLICO À TABELA patient_anamnesis
-- ==============================================================
-- Garantir que o RLS está ativo
ALTER TABLE public.patient_anamnesis ENABLE ROW LEVEL SECURITY;

-- Remover políticas permissivas antigas (públicas)
DROP POLICY IF EXISTS "Permitir leitura pública de anamnese" ON public.patient_anamnesis;
DROP POLICY IF EXISTS "Permitir inserção pública de anamnese" ON public.patient_anamnesis;
DROP POLICY IF EXISTS "Permitir atualização pública de anamnese" ON public.patient_anamnesis;
DROP POLICY IF EXISTS "Acesso público para pacientes preencherem" ON public.patient_anamnesis;
DROP POLICY IF EXISTS "Acesso restrito para equipe clínica" ON public.patient_anamnesis;
DROP POLICY IF EXISTS "Equipe clinica gerencia anamneses" ON public.patient_anamnesis;

-- Criar política de acesso exclusivo para profissionais logados (authenticated)
CREATE POLICY "Equipe clinica gerencia anamneses" ON public.patient_anamnesis
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'terapeuta', 'atendimento')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'terapeuta', 'atendimento')
    )
  );


-- ==============================================================
-- 3. RESTRINGIR ACESSO À TABELA clinical_templates
-- ==============================================================
-- Garantir que o RLS está ativo
ALTER TABLE public.clinical_templates ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas
DROP POLICY IF EXISTS "Leitura publica de templates" ON public.clinical_templates;
DROP POLICY IF EXISTS "Escrita apenas para admin" ON public.clinical_templates;
DROP POLICY IF EXISTS "Leitura de templates para equipe" ON public.clinical_templates;
DROP POLICY IF EXISTS "Admins gerenciam templates" ON public.clinical_templates;

-- Permitir leitura para toda a equipe clínica
CREATE POLICY "Leitura de templates para equipe" ON public.clinical_templates
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'terapeuta', 'atendimento')
    )
  );

-- Permitir escrita (gerenciamento) apenas para administradores
CREATE POLICY "Admins gerenciam templates" ON public.clinical_templates
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );


-- ==============================================================
-- 4. AJUSTAR POLÍTICAS DE SALAS (rooms) E EVITAR CONFLITOS
-- ==============================================================
-- Garantir que o RLS está ativo
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

-- Remover políticas conflitantes/permissivas que vieram de scripts anteriores
DROP POLICY IF EXISTS "Autenticados podem gerenciar salas" ON public.rooms;
DROP POLICY IF EXISTS "Autenticados podem ler salas" ON public.rooms;
DROP POLICY IF EXISTS "Admins e recepcao gerenciam salas" ON public.rooms;
DROP POLICY IF EXISTS "Terapeutas veem salas" ON public.rooms;

-- Permitir gerenciamento total apenas para Admins, Atendimento e Financeiro
CREATE POLICY "Admins e recepcao gerenciam salas" ON public.rooms
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'atendimento', 'financeiro')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'atendimento', 'financeiro')
    )
  );

-- Permitir apenas leitura das salas para Terapeutas
CREATE POLICY "Terapeutas veem salas" ON public.rooms
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'terapeuta'
    )
  );

COMMIT;

SELECT 'Migração de segurança e governança executada com sucesso!' AS resultado;
