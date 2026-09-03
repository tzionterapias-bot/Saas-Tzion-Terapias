-- ============================================================
-- Agenda Pessoal do Terapeuta — Bloqueios de Horário
-- Criado em: 2026-09-03
-- Propósito: Permite que terapeutas bloqueiem horários na
--   agenda oficial (férias, consultas, folgas, etc.)
-- ============================================================

-- Tabela de bloqueios pessoais
CREATE TABLE IF NOT EXISTS therapist_schedule_blocks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id UUID NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  start_time   TIMESTAMPTZ NOT NULL,
  end_time     TIMESTAMPTZ NOT NULL,
  reason       TEXT NOT NULL DEFAULT 'Indisponível',
  notes        TEXT,
  all_day      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT valid_range CHECK (end_time > start_time)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_schedule_blocks_therapist ON therapist_schedule_blocks(therapist_id);
CREATE INDEX IF NOT EXISTS idx_schedule_blocks_time ON therapist_schedule_blocks(start_time, end_time);

-- Habilitar RLS
ALTER TABLE therapist_schedule_blocks ENABLE ROW LEVEL SECURITY;

-- O próprio terapeuta pode gerenciar seus bloqueios
DROP POLICY IF EXISTS "therapist_manage_own_blocks" ON therapist_schedule_blocks;
CREATE POLICY "therapist_manage_own_blocks"
  ON therapist_schedule_blocks
  FOR ALL
  USING (
    therapist_id IN (
      SELECT id FROM therapists WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    therapist_id IN (
      SELECT id FROM therapists WHERE user_id = auth.uid()
    )
  );

-- Admins e secretaria (role='admin' ou 'secretaria') podem ler todos os bloqueios
DROP POLICY IF EXISTS "admin_read_all_blocks" ON therapist_schedule_blocks;
CREATE POLICY "admin_read_all_blocks"
  ON therapist_schedule_blocks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'secretaria')
    )
  );

-- Habilitar realtime para sincronização em tempo real (idempotente)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE therapist_schedule_blocks;
EXCEPTION WHEN duplicate_object THEN
  NULL; -- já estava na publication, ignorar
END $$;
