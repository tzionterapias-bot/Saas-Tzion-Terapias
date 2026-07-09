-- =============================================
-- TZION TERAPIAS — Staff Bonus v1
-- Execute no painel SQL do Supabase → SQL Editor
-- =============================================

-- Tabela de bônus mensais da equipe administrativa
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

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_staff_bonuses_staff   ON public.staff_bonuses(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_bonuses_period  ON public.staff_bonuses(year, month);

SELECT 'Staff Bonus v1 aplicado com sucesso!' AS resultado;
