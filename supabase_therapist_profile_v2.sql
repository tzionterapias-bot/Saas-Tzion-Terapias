-- ===================================================
-- Migration: Campos completos para terapeutas
-- Execute no painel do Supabase (SQL Editor)
-- ===================================================

-- 1. Adicionar colunas faltantes na tabela therapists
ALTER TABLE therapists
  ADD COLUMN IF NOT EXISTS cpf TEXT,
  ADD COLUMN IF NOT EXISTS specialties TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS photo_url TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp TEXT;

-- 2. Migrar coluna specialty (string) -> specialties (array), se houver dados
UPDATE therapists
SET specialties = ARRAY[specialty]
WHERE specialty IS NOT NULL
  AND specialty <> ''
  AND (specialties IS NULL OR array_length(specialties, 1) IS NULL);

-- 3. Criar tabela de especialidades customizáveis da clínica
CREATE TABLE IF NOT EXISTS therapy_specialties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  is_system BOOLEAN DEFAULT false,  -- true = pré-definidas pelo sistema
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Inserir especialidades pré-definidas do sistema
INSERT INTO therapy_specialties (name, is_system) VALUES
  ('Psicanálise Clínica', true),
  ('Terapia Cognitivo-Comportamental (TCC)', true),
  ('EMDR', true),
  ('Terapia de Casal', true),
  ('Terapia Familiar', true),
  ('Psicologia Infantil', true),
  ('Neuropsicologia', true),
  ('Hipnoterapia', true),
  ('Constelação Familiar', true),
  ('Terapia Integrativa', true),
  ('Reiki', true),
  ('Mindfulness e Meditação', true),
  ('Florais de Bach', true),
  ('Acupuntura', true),
  ('Aromaterapia', true),
  ('Terapia Holística', true),
  ('Coaching de Vida', true),
  ('Psicoterapia Breve', true)
ON CONFLICT (name) DO NOTHING;

-- 5. Storage bucket para fotos de terapeutas (se não existir)
-- Executar via Dashboard do Supabase > Storage > New Bucket
-- Nome: therapist-photos | Public: true

-- 6. RLS Policy para therapist-photos (se usar Storage)
-- (Opcional, configurar no painel Storage do Supabase)

-- Verificar resultado
SELECT id, name, cpf, specialties, photo_url, whatsapp, active
FROM therapists
ORDER BY name;
