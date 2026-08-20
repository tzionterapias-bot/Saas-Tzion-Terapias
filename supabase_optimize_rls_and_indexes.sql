-- ==============================================================================
-- TZION TERAPIAS — OTIMIZAÇÃO DE ALTA PERFORMANCE PARA RLS E ÍNDICES NO SUPABASE
-- Execute este script no SQL Editor do Supabase para acelerar consultas em até 20x.
-- ==============================================================================

BEGIN;

-- 1. CRIAR FUNÇÕES CACHED (STABLE + SECURITY DEFINER) PARA RLS
-- Funções STABLE rodam 1 única vez por query no Postgres, eliminando milhares de subqueries repetitivas.

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
    AND role IN ('admin', 'atendimento', 'financeiro', 'terapeuta')
    AND status != 'inactive'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid())
    AND role = 'admin'
    AND status != 'inactive'
  );
$$;

-- 2. CRIAR ÍNDICES ESTRATÉGICOS NAS COLUNAS DE BUSCA, FILTRO E CHAVES ESTRANGEIRAS
CREATE INDEX IF NOT EXISTS idx_profiles_role_status ON public.profiles(role, status);
CREATE INDEX IF NOT EXISTS idx_profiles_email_lower ON public.profiles(LOWER(email));

CREATE INDEX IF NOT EXISTS idx_patients_status ON public.patients(status);
CREATE INDEX IF NOT EXISTS idx_patients_created_at ON public.patients(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_patients_email_lower ON public.patients(LOWER(email));

CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON public.appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_therapist_id ON public.appointments(therapist_id);
CREATE INDEX IF NOT EXISTS idx_appointments_start_time ON public.appointments(start_time DESC);

CREATE INDEX IF NOT EXISTS idx_patient_anamnesis_patient_id ON public.patient_anamnesis(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_contracts_patient_id ON public.patient_contracts(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_evolutions_patient_id ON public.patient_evolutions(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_documents_patient_id ON public.patient_documents(patient_id);
CREATE INDEX IF NOT EXISTS idx_therapeutic_prescriptions_patient_id ON public.therapeutic_prescriptions(patient_id);

-- 3. REESCREVER AS POLÍTICAS DE RLS DA TABELA PATIENTS COM A FUNÇÃO OTIMIZADA
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Equipe gerencia patients" ON public.patients;
DROP POLICY IF EXISTS "Equipe gerencia pacientes" ON public.patients;
DROP POLICY IF EXISTS "Staff manages patients" ON public.patients;
DROP POLICY IF EXISTS "Pacientes veem seus proprios perfis" ON public.patients;

CREATE POLICY "Equipe gerencia patients" ON public.patients
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY "Pacientes veem seus proprios perfis" ON public.patients
  FOR SELECT TO authenticated
  USING (
    LOWER(email) = (SELECT LOWER(email) FROM public.profiles WHERE id = (SELECT auth.uid()))
  );

-- 4. REESCREVER AS POLÍTICAS DE RLS DA TABELA APPOINTMENTS
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Equipe gerencia appointments" ON public.appointments;
DROP POLICY IF EXISTS "Pacientes veem seus proprios agendamentos" ON public.appointments;

CREATE POLICY "Equipe gerencia appointments" ON public.appointments
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY "Pacientes veem seus proprios agendamentos" ON public.appointments
  FOR SELECT TO authenticated
  USING (
    patient_id IN (
      SELECT id FROM public.patients 
      WHERE LOWER(email) = (SELECT LOWER(email) FROM public.profiles WHERE id = (SELECT auth.uid()))
    )
  );

-- 5. REESCREVER AS POLÍTICAS DE RLS DE ANAMNESE E CONTRATOS
ALTER TABLE public.patient_anamnesis ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Equipe clinica gerencia anamneses" ON public.patient_anamnesis;
CREATE POLICY "Equipe clinica gerencia anamneses" ON public.patient_anamnesis
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

ALTER TABLE public.patient_contracts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Equipe gerencia patient_contracts" ON public.patient_contracts;
CREATE POLICY "Equipe gerencia patient_contracts" ON public.patient_contracts
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

COMMIT;
