-- ==============================================================
-- SQL para estruturar salas e prontuário emocional
-- Execute este script no painel SQL do Supabase
-- ==============================================================

-- 1. Tabela de Salas (Rooms)
CREATE TABLE IF NOT EXISTS public.rooms (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT timezone('utc', now()) NOT NULL
);

-- Habilitar RLS e criar políticas para rooms
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins e recepcao gerenciam salas" ON public.rooms;
CREATE POLICY "Admins e recepcao gerenciam salas" ON public.rooms
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'atendimento', 'financeiro')
    )
  );

DROP POLICY IF EXISTS "Terapeutas veem salas" ON public.rooms;
CREATE POLICY "Terapeutas veem salas" ON public.rooms
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'terapeuta'
    )
  );

-- 2. Adicionar referência de Sala nos Agendamentos
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS room_id uuid REFERENCES public.rooms(id) ON DELETE SET NULL;

-- 3. Tabela de Indicadores Clínicos/Emocionais
CREATE TABLE IF NOT EXISTS public.patient_indicators (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  anxiety integer NOT NULL CHECK (anxiety BETWEEN 0 AND 10),
  vitality integer NOT NULL CHECK (vitality BETWEEN 0 AND 10),
  physical_pain integer NOT NULL CHECK (physical_pain BETWEEN 0 AND 10),
  sleep_quality integer NOT NULL CHECK (sleep_quality BETWEEN 0 AND 10),
  notes text,
  created_at timestamptz DEFAULT timezone('utc', now()) NOT NULL
);

-- Habilitar RLS e criar políticas para patient_indicators
ALTER TABLE public.patient_indicators ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins e terapeutas gerenciam indicadores" ON public.patient_indicators;
CREATE POLICY "Admins e terapeutas gerenciam indicadores" ON public.patient_indicators
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'terapeuta')
    )
  );

DROP POLICY IF EXISTS "Pacientes veem seus proprios indicadores" ON public.patient_indicators;
CREATE POLICY "Pacientes veem seus proprios indicadores" ON public.patient_indicators
  FOR SELECT USING (
    patient_id = auth.uid()
  );

-- 4. Inserir salas padrão
INSERT INTO public.rooms (name) VALUES 
  ('Sala de Reiki'),
  ('Sala de Acupuntura'),
  ('Sala de Aromaterapia'),
  ('Sala de Constelação')
ON CONFLICT (name) DO NOTHING;

SELECT 'Tabelas de salas e indicadores criadas com sucesso!' AS resultado;
