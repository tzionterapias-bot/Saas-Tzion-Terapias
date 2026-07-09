-- =============================================
-- TZION TERAPIAS — Financial v3 Fixes
-- Execute no painel SQL do Supabase → SQL Editor
-- =============================================

-- 1. UNIQUE constraint para evitar repasses duplicados do mesmo mês
ALTER TABLE public.commission_payouts
  DROP CONSTRAINT IF EXISTS uq_commission_payout_period;

ALTER TABLE public.commission_payouts
  ADD CONSTRAINT uq_commission_payout_period
  UNIQUE (therapist_id, month, year);

-- 2. Coluna installments em payments (parcelamento do cartão)
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS installments integer DEFAULT 1;

-- 3. Garantir que a tabela settings existe (para salvar taxas configuráveis)
CREATE TABLE IF NOT EXISTS public.settings (
  key        text PRIMARY KEY,
  value      text,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "settings_admin" ON public.settings;
CREATE POLICY "settings_admin"
  ON public.settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'financeiro')
    )
  );

-- 4. Índice na categoria de payments (filtra repasses rapidamente)
CREATE INDEX IF NOT EXISTS idx_payments_category ON public.payments(category);

-- Confirmação
SELECT 'Financial v3 Fixes aplicado com sucesso!' AS resultado;
