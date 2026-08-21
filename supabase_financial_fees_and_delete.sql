-- ==============================================================
-- TZION TERAPIAS — Ajustes Financeiros: Taxas, Custos e Exclusão
-- Execute este script no Supabase SQL Editor
-- ==============================================================

-- 1. Assegurar a existência das colunas de taxa e valor líquido na tabela payments
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS card_fee_rate numeric(5,2) DEFAULT 0.00;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS card_fee_val numeric(12,2) DEFAULT 0.00;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS net_amount numeric(12,2);

-- 2. Atualizar net_amount e card_fee_val para lançamentos antigos que estejam nulos
UPDATE public.payments 
SET net_amount = amount 
WHERE net_amount IS NULL;

UPDATE public.payments 
SET card_fee_val = 0.00 
WHERE card_fee_val IS NULL;

UPDATE public.payments 
SET card_fee_rate = 0.00 
WHERE card_fee_rate IS NULL;

-- 3. Assegurar política RLS para que a equipe possa gerenciar e deletar lançamentos
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Equipe gerencia payments" ON public.payments;
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

SELECT 'Estrutura financeira de taxas, custos e exclusão atualizada com sucesso!' AS resultado;
