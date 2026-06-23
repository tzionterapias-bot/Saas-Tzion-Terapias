-- =============================================
-- TZION TERAPIAS — Fix RLS: Tabela payments
-- Execute ESTE ARQUIVO PRIMEIRO no Supabase SQL Editor
-- Resolve o erro 400 ao confirmar pagamentos
-- =============================================

-- Habilitar RLS se ainda não estiver ativo
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Remover policies antigas que podem estar conflitando
DROP POLICY IF EXISTS "Equipe gerencia payments" ON public.payments;
DROP POLICY IF EXISTS "Usuarios autenticados veem payments" ON public.payments;
DROP POLICY IF EXISTS "Autenticados podem ler payments" ON public.payments;
DROP POLICY IF EXISTS "Autenticados podem gerenciar payments" ON public.payments;

-- Policy principal: equipe administrativa pode fazer tudo
CREATE POLICY "Equipe gerencia payments"
  ON public.payments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'atendimento', 'financeiro', 'terapeuta')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'atendimento', 'financeiro', 'terapeuta')
    )
  );

-- Também habilitar RLS e políticas para patient_packages
-- (usada na ativação ao confirmar pagamento)
ALTER TABLE public.patient_packages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Equipe gerencia patient_packages" ON public.patient_packages;

CREATE POLICY "Equipe gerencia patient_packages"
  ON public.patient_packages FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'atendimento', 'financeiro', 'terapeuta')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'atendimento', 'financeiro', 'terapeuta')
    )
  );

SELECT 'Políticas RLS de payments e patient_packages aplicadas!' AS resultado;
