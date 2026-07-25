-- Migration SQL: Gamificação e Metas Financeiras de Terapeutas / Profissionais

-- 1. Criar tabela de metas de terapeutas (therapist_goals)
CREATE TABLE IF NOT EXISTS public.therapist_goals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  therapist_id UUID NOT NULL REFERENCES public.therapists(id) ON DELETE CASCADE,
  month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INT NOT NULL CHECK (year >= 2024),
  target_revenue NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  target_sessions INT NOT NULL DEFAULT 0,
  current_revenue NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  current_sessions INT NOT NULL DEFAULT 0,
  bonus_pct_80 NUMERIC(5,2) DEFAULT 0.00,
  bonus_pct_100 NUMERIC(5,2) DEFAULT 0.00,
  bonus_pct_120 NUMERIC(5,2) DEFAULT 0.00,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(therapist_id, month, year)
);

-- Habilitar RLS
ALTER TABLE public.therapist_goals ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para therapist_goals
DO $$
BEGIN
    DROP POLICY IF EXISTS "Todos autenticados podem ver metas" ON public.therapist_goals;
    DROP POLICY IF EXISTS "Admins podem inserir/modificar metas" ON public.therapist_goals;
END $$;

CREATE POLICY "Todos autenticados podem ver metas"
  ON public.therapist_goals FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins podem inserir/modificar metas"
  ON public.therapist_goals FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'financeiro')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'financeiro')
    )
  );

-- 2. Função SQL para recalcular o progresso da meta do terapeuta para um mês/ano específico
CREATE OR REPLACE FUNCTION sync_therapist_goal_progress(p_therapist_id UUID, p_month INT, p_year INT)
RETURNS VOID AS $$
DECLARE
  v_revenue NUMERIC(12,2) := 0.00;
  v_sessions INT := 0;
  v_start_date DATE;
  v_end_date DATE;
BEGIN
  v_start_date := MAKE_DATE(p_year, p_month, 1);
  v_end_date := (v_start_date + INTERVAL '1 month' - INTERVAL '1 day')::DATE;

  -- Calcular receita total gerada de atendimentos/pagamentos confirmados no mês
  SELECT COALESCE(SUM(amount), 0.00)
  INTO v_revenue
  FROM public.payments
  WHERE therapist_id = p_therapist_id
    AND status = 'paid'
    AND type = 'income'
    AND created_at::DATE BETWEEN v_start_date AND v_end_date;

  -- Se não encontrou por created_at do pagamento, considerar sessões concluídas ou comissões
  SELECT COUNT(id)
  INTO v_sessions
  FROM public.appointments
  WHERE therapist_id = p_therapist_id
    AND status IN ('concluido', 'realizado', 'confirmado')
    AND start_time::DATE BETWEEN v_start_date AND v_end_date;

  -- Atualizar registro na tabela therapist_goals
  UPDATE public.therapist_goals
  SET current_revenue = v_revenue,
      current_sessions = v_sessions,
      updated_at = NOW()
  WHERE therapist_id = p_therapist_id
    AND month = p_month
    AND year = p_year;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
