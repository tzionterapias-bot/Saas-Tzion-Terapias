-- =============================================
-- TZION TERAPIAS — Módulo Financeiro v2
-- Execute este script no painel SQL do Supabase
-- =============================================

-- 1. Data de vencimento e terapeuta nos lançamentos financeiros
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS due_date date;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS therapist_id uuid REFERENCES public.therapists(id) ON DELETE SET NULL;

-- 2. Percentuais de comissão configuráveis por terapeuta
ALTER TABLE public.therapists ADD COLUMN IF NOT EXISTS commission_rate_clinic numeric(5,2) DEFAULT 50.00;
ALTER TABLE public.therapists ADD COLUMN IF NOT EXISTS commission_rate_self   numeric(5,2) DEFAULT 25.00;
ALTER TABLE public.therapists ADD COLUMN IF NOT EXISTS phone    varchar(20);
ALTER TABLE public.therapists ADD COLUMN IF NOT EXISTS pix_key  varchar(100);

-- 3. Tabela de histórico de repasses (DROP + CREATE para garantir estrutura correta)
DROP TABLE IF EXISTS public.commission_payouts CASCADE;

CREATE TABLE public.commission_payouts (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  therapist_id    uuid NOT NULL REFERENCES public.therapists(id) ON DELETE CASCADE,
  month           integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  year            integer NOT NULL,
  gross_total     numeric(12,2) NOT NULL DEFAULT 0,
  clinic_share    numeric(12,2) NOT NULL DEFAULT 0,
  therapist_net   numeric(12,2) NOT NULL DEFAULT 0,
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  paid_at         timestamptz,
  payment_method  text,
  notes           text,
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz DEFAULT timezone('utc', now()) NOT NULL
);

ALTER TABLE public.commission_payouts ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para commission_payouts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'commission_payouts' AND policyname = 'Admins veem todos os repasses'
  ) THEN
    CREATE POLICY "Admins veem todos os repasses"
      ON public.commission_payouts FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role IN ('admin', 'financeiro')
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'commission_payouts' AND policyname = 'Terapeuta ve seus repasses'
  ) THEN
    CREATE POLICY "Terapeuta ve seus repasses"
      ON public.commission_payouts FOR SELECT
      USING (
        therapist_id IN (
          SELECT id FROM public.therapists WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- 4. Tabela de fechamentos de caixa
DROP TABLE IF EXISTS public.daily_closings CASCADE;

CREATE TABLE public.daily_closings (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  closing_date     date NOT NULL DEFAULT CURRENT_DATE,
  expected_balance numeric(12,2),
  physical_balance numeric(12,2),
  difference       numeric(12,2) GENERATED ALWAYS AS (physical_balance - expected_balance) STORED,
  status           text DEFAULT 'open' CHECK (status IN ('open', 'closed', 'divergent')),
  notes            text,
  created_by       uuid REFERENCES auth.users(id),
  created_at       timestamptz DEFAULT timezone('utc', now()) NOT NULL
);

ALTER TABLE public.daily_closings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'daily_closings' AND policyname = 'Admins gerenciam fechamentos'
  ) THEN
    CREATE POLICY "Admins gerenciam fechamentos"
      ON public.daily_closings FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role IN ('admin', 'financeiro', 'atendimento')
        )
      );
  END IF;
END $$;

-- 5. Índices para performance (criados DEPOIS das tabelas)
CREATE INDEX IF NOT EXISTS idx_payments_therapist             ON public.payments(therapist_id);
CREATE INDEX IF NOT EXISTS idx_payments_status               ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created              ON public.payments(created_at);
CREATE INDEX IF NOT EXISTS idx_commission_payouts_therapist  ON public.commission_payouts(therapist_id);
CREATE INDEX IF NOT EXISTS idx_commission_payouts_year_month ON public.commission_payouts(year, month);
CREATE INDEX IF NOT EXISTS idx_daily_closings_date           ON public.daily_closings(closing_date);

-- Confirmação
SELECT 'Migração Financeiro v2 aplicada com sucesso!' AS resultado;
