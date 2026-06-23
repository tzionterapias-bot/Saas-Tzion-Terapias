-- ==============================================================
-- TZION TERAPIAS — Ajuste de Políticas RLS para Painel do Paciente (Case-Insensitive)
-- Resolve o problema de sessões, pagamentos e dados vazios no portal do paciente.
-- Execute este script no SQL Editor do Supabase.
-- ==============================================================

BEGIN;

-- ==============================================================
-- 1. TABELA public.patients
-- ==============================================================
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Equipe gerencia patients" ON public.patients;
CREATE POLICY "Equipe gerencia patients" ON public.patients
  FOR ALL TO authenticated
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

DROP POLICY IF EXISTS "Pacientes veem seus proprios perfis" ON public.patients;
CREATE POLICY "Pacientes veem seus proprios perfis" ON public.patients
  FOR SELECT TO authenticated
  USING (
    LOWER(email) = (SELECT LOWER(email) FROM public.profiles WHERE id = auth.uid())
  );


-- ==============================================================
-- 2. TABELA public.appointments
-- ==============================================================
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Equipe gerencia appointments" ON public.appointments;
CREATE POLICY "Equipe gerencia appointments" ON public.appointments
  FOR ALL TO authenticated
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

DROP POLICY IF EXISTS "Pacientes veem seus proprios agendamentos" ON public.appointments;
CREATE POLICY "Pacientes veem seus proprios agendamentos" ON public.appointments
  FOR SELECT TO authenticated
  USING (
    patient_id IN (
      SELECT id FROM public.patients
      WHERE LOWER(email) = (SELECT LOWER(email) FROM public.profiles WHERE id = auth.uid())
    )
  );


-- ==============================================================
-- 3. TABELA public.payments
-- ==============================================================
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Equipe gerencia payments" ON public.payments;
CREATE POLICY "Equipe gerencia payments" ON public.payments
  FOR ALL TO authenticated
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

DROP POLICY IF EXISTS "Pacientes veem seus proprios pagamentos" ON public.payments;
CREATE POLICY "Pacientes veem seus proprios pagamentos" ON public.payments
  FOR SELECT TO authenticated
  USING (
    patient_id IN (
      SELECT id FROM public.patients
      WHERE LOWER(email) = (SELECT LOWER(email) FROM public.profiles WHERE id = auth.uid())
    )
  );


-- ==============================================================
-- 4. TABELA public.patient_packages
-- ==============================================================
ALTER TABLE public.patient_packages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Equipe gerencia patient_packages" ON public.patient_packages;
CREATE POLICY "Equipe gerencia patient_packages" ON public.patient_packages
  FOR ALL TO authenticated
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

DROP POLICY IF EXISTS "Pacientes veem seus proprios pacotes" ON public.patient_packages;
CREATE POLICY "Pacientes veem seus proprios pacotes" ON public.patient_packages
  FOR SELECT TO authenticated
  USING (
    patient_id IN (
      SELECT id FROM public.patients
      WHERE LOWER(email) = (SELECT LOWER(email) FROM public.profiles WHERE id = auth.uid())
    )
  );


-- ==============================================================
-- 5. TABELA public.patient_package_items
-- ==============================================================
ALTER TABLE public.patient_package_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins e recepcao gerenciam itens de pacotes" ON public.patient_package_items;
CREATE POLICY "Admins e recepcao gerenciam itens de pacotes" ON public.patient_package_items
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

DROP POLICY IF EXISTS "Clientes veem seus proprios itens de pacotes" ON public.patient_package_items;
CREATE POLICY "Clientes veem seus proprios itens de pacotes" ON public.patient_package_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.patient_packages
      WHERE patient_packages.id = package_id
      AND patient_packages.patient_id IN (
        SELECT id FROM public.patients
        WHERE LOWER(email) = (SELECT LOWER(email) FROM public.profiles WHERE id = auth.uid())
      )
    )
  );


-- ==============================================================
-- 6. TABELA public.patient_indicators (CONDICIONAL - PODE NÃO EXISTIR)
-- ==============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'patient_indicators') THEN
    EXECUTE $cmd$ ALTER TABLE public.patient_indicators ENABLE ROW LEVEL SECURITY $cmd$;

    EXECUTE $cmd$ DROP POLICY IF EXISTS "Admins e terapeutas gerenciam indicadores" ON public.patient_indicators $cmd$;
    EXECUTE $cmd$
      CREATE POLICY "Admins e terapeutas gerenciam indicadores" ON public.patient_indicators
        FOR ALL TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'terapeuta')
          )
        )
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'terapeuta')
          )
        )
    $cmd$;

    EXECUTE $cmd$ DROP POLICY IF EXISTS "Pacientes veem seus proprios indicadores" ON public.patient_indicators $cmd$;
    EXECUTE $cmd$
      CREATE POLICY "Pacientes veem seus proprios indicadores" ON public.patient_indicators
        FOR SELECT TO authenticated
        USING (
          patient_id IN (
            SELECT id FROM public.patients
            WHERE LOWER(email) = (SELECT LOWER(email) FROM public.profiles WHERE id = auth.uid())
          )
        )
    $cmd$;
  END IF;
END $$;


-- ==============================================================
-- 7. TABELA public.patient_contracts
-- ==============================================================
ALTER TABLE public.patient_contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Equipe gerencia patient_contracts" ON public.patient_contracts;
CREATE POLICY "Equipe gerencia patient_contracts" ON public.patient_contracts
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

DROP POLICY IF EXISTS "Pacientes veem seus proprios contratos" ON public.patient_contracts;
CREATE POLICY "Pacientes veem seus proprios contratos" ON public.patient_contracts
  FOR SELECT TO authenticated
  USING (
    patient_id IN (
      SELECT id FROM public.patients
      WHERE LOWER(email) = (SELECT LOWER(email) FROM public.profiles WHERE id = auth.uid())
    )
  );

COMMIT;

SELECT 'Políticas RLS do portal do paciente atualizadas com sucesso!' AS resultado;
