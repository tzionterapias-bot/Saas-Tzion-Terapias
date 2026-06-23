-- ==============================================================
-- SQL para estruturar prescrições de Autocuidado / Home Care
-- Execute este script no painel SQL do Supabase
-- ==============================================================

CREATE TABLE IF NOT EXISTS public.therapeutic_prescriptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  therapist_id uuid REFERENCES public.therapists(id) ON DELETE SET NULL,
  items jsonb NOT NULL,
  created_at timestamptz DEFAULT timezone('utc', now()) NOT NULL
);

-- Desabilitar RLS para evitar problemas de permissão em ambiente de desenvolvimento
ALTER TABLE public.therapeutic_prescriptions DISABLE ROW LEVEL SECURITY;

SELECT 'Estrutura para prescrições home care criada com sucesso!' AS resultado;
