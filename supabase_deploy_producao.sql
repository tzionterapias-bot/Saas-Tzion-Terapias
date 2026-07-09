-- =============================================
-- TZION TERAPIAS — DEPLOY DE PRODUÇÃO (Financeiro & RH)
-- Execute este script completo no painel SQL do Supabase → SQL Editor
-- Este script consolida todas as atualizações de V3 e V4 do financeiro.
-- =============================================

-- 1. UNIQUE constraint para evitar repasses duplicados do mesmo mês
ALTER TABLE public.commission_payouts
  DROP CONSTRAINT IF EXISTS uq_commission_payout_period;

ALTER TABLE public.commission_payouts
  ADD CONSTRAINT uq_commission_payout_period
  UNIQUE (therapist_id, month, year);

-- 2. Coluna installments e is_fixed em payments
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS installments integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_fixed boolean DEFAULT false;

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


-- 5. Tabela de bônus mensais da equipe administrativa
CREATE TABLE IF NOT EXISTS public.staff_bonuses (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id        uuid NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  month           integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  year            integer NOT NULL,
  clinic_net_base numeric(12,2) NOT NULL DEFAULT 0,
  commission_rate numeric(5,2)  NOT NULL DEFAULT 0,
  bonus_amount    numeric(12,2) NOT NULL DEFAULT 0,
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  paid_at         timestamptz,
  payment_method  text,
  notes           text,
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz DEFAULT timezone('utc', now()) NOT NULL,
  CONSTRAINT uq_staff_bonus_period UNIQUE (staff_id, month, year)
);

ALTER TABLE public.staff_bonuses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_bonuses_admin" ON public.staff_bonuses;
CREATE POLICY "staff_bonuses_admin"
  ON public.staff_bonuses FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'financeiro')
    )
  );

-- 6. Índices para performance de bônus
CREATE INDEX IF NOT EXISTS idx_staff_bonuses_staff   ON public.staff_bonuses(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_bonuses_period  ON public.staff_bonuses(year, month);


-- 7. Novos campos para Fornecedores (suppliers)
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS products_provided text;


-- Confirmação final
SELECT 'DEPLOY DE PRODUÇÃO APLICADO COM SUCESSO! Todas as tabelas, colunas e constraints foram atualizadas.' AS resultado;
