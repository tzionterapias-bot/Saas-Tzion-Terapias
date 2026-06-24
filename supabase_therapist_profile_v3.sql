-- ===================================================
-- Migration v3 COMPLETA: Terapeutas + Especialidades
-- Execute no painel do Supabase → SQL Editor → Run
-- ===================================================

-- ─── 1. Colunas na tabela therapists ──────────────────────────────────────────
ALTER TABLE therapists
  ADD COLUMN IF NOT EXISTS cpf TEXT,
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS photo_url TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp TEXT,
  ADD COLUMN IF NOT EXISTS specialties TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS professional_registration TEXT,
  ADD COLUMN IF NOT EXISTS attendance_modes TEXT[] DEFAULT '{}';

-- ─── 2. Tabela therapy_specialties ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS therapy_specialties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  is_system BOOLEAN DEFAULT false,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 3. RLS na tabela therapy_specialties ─────────────────────────────────────
ALTER TABLE therapy_specialties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "therapy_specialties_read"   ON therapy_specialties;
DROP POLICY IF EXISTS "therapy_specialties_insert" ON therapy_specialties;
DROP POLICY IF EXISTS "therapy_specialties_update" ON therapy_specialties;
DROP POLICY IF EXISTS "therapy_specialties_delete" ON therapy_specialties;

-- Qualquer usuário autenticado pode ler
CREATE POLICY "therapy_specialties_read"
  ON therapy_specialties FOR SELECT
  USING (true);

-- Apenas usuários autenticados podem criar/editar/excluir especialidades
CREATE POLICY "therapy_specialties_insert"
  ON therapy_specialties FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "therapy_specialties_update"
  ON therapy_specialties FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "therapy_specialties_delete"
  ON therapy_specialties FOR DELETE
  USING (auth.role() = 'authenticated');

-- ─── 4. Especialidades pré-definidas ──────────────────────────────────────────
INSERT INTO therapy_specialties (name, is_system) VALUES
  ('Psicanálise Clínica',                    true),
  ('Terapia Cognitivo-Comportamental (TCC)', true),
  ('EMDR',                                   true),
  ('Terapia de Casal',                       true),
  ('Terapia Familiar',                       true),
  ('Psicologia Infantil',                    true),
  ('Neuropsicologia',                        true),
  ('Hipnoterapia',                           true),
  ('Constelação Familiar',                   true),
  ('Terapia Integrativa',                    true),
  ('Reiki',                                  true),
  ('Mindfulness e Meditação',                true),
  ('Florais de Bach',                        true),
  ('Acupuntura',                             true),
  ('Aromaterapia',                           true),
  ('Terapia Holística',                      true),
  ('Coaching de Vida',                       true),
  ('Psicoterapia Breve',                     true)
ON CONFLICT (name) DO NOTHING;

-- ─── 5. Verificação do resultado ──────────────────────────────────────────────
SELECT 'therapists columns' AS check_item,
       column_name
FROM information_schema.columns
WHERE table_name = 'therapists'
  AND column_name IN (
    'professional_registration','attendance_modes','specialties','bio','cpf','whatsapp'
  )
ORDER BY column_name;

SELECT 'specialty count' AS check_item,
       count(*)::text AS result
FROM therapy_specialties;
