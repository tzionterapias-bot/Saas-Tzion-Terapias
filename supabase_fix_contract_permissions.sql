-- ==============================================================================
-- TZION TERAPIAS — CORREÇÃO DEFINITIVA DE PERMISSÕES PARA EMISSÃO DE CONTRATOS
-- Permite que a Secretaria / Recepção (role: 'atendimento' ou 'secretaria')
-- emita contratos de prestação de serviços de forma avulsa (manual) e via Venda Rápida.
-- ==============================================================================

BEGIN;

-- 1. GARANTIR QUE A SECRETÁRIA E QUALQUER MEMBRO DA RECEPÇÃO ESTEJAM ATIVOS
UPDATE public.profiles
SET status = 'active', updated_at = NOW()
WHERE email = 'formacaoterapia@gmail.com' OR role IN ('atendimento', 'secretaria', 'recepcao');

-- 2. ATUALIZAR FUNÇÃO CACHED is_staff() PARA INCLUIR ATENDIMENTO E SECRETARIA
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid())
    AND role IN ('admin', 'atendimento', 'secretaria', 'recepcao', 'financeiro', 'terapeuta')
    AND status != 'inactive'
  );
$$;

-- 3. REESCREVER POLÍTICAS DE RLS DA TABELA patient_contracts
ALTER TABLE public.patient_contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Equipe gerencia patient_contracts" ON public.patient_contracts;
DROP POLICY IF EXISTS "Staff gerencia contratos" ON public.patient_contracts;
DROP POLICY IF EXISTS "Permissao total equipe contratos" ON public.patient_contracts;

CREATE POLICY "Equipe gerencia patient_contracts" ON public.patient_contracts
  FOR ALL TO authenticated
  USING (
    public.is_staff() OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'atendimento', 'secretaria', 'recepcao', 'financeiro')
    )
  )
  WITH CHECK (
    public.is_staff() OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'atendimento', 'secretaria', 'recepcao', 'financeiro')
    )
  );

-- Garantir acesso de leitura pública (necessário para a página /contrato/:id onde o paciente assina)
DROP POLICY IF EXISTS "Leitura publica de contratos" ON public.patient_contracts;
CREATE POLICY "Leitura publica de contratos" ON public.patient_contracts
  FOR SELECT TO anon, authenticated
  USING (true);

-- Garantir que a assinatura digital (UPDATE de status, signed_at, signature_ip) funcione
DROP POLICY IF EXISTS "Assinatura publica de contratos" ON public.patient_contracts;
CREATE POLICY "Assinatura publica de contratos" ON public.patient_contracts
  FOR UPDATE TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 4. GARANTIR QUE A SECRETARIA CONSIGA LER O TEMPLATE DE CONTRATO EM settings
DROP POLICY IF EXISTS "Equipe le settings" ON public.settings;
CREATE POLICY "Equipe le settings" ON public.settings
  FOR SELECT TO authenticated
  USING (
    public.is_staff() OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'atendimento', 'secretaria', 'recepcao', 'financeiro', 'terapeuta')
    )
  );

COMMIT;

SELECT 'Permissões de emissão de contratos para a Secretaria atualizadas com sucesso!' AS status;
