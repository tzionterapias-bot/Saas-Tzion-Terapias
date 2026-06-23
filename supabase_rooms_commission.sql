-- =============================================
-- TZION TERAPIAS — Sistema de Salas e Comissões
-- Execute este script no painel SQL do Supabase
-- =============================================

-- 1. Tabela de Salas de Atendimento
CREATE TABLE IF NOT EXISTS rooms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  capacity INTEGER DEFAULT 1,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  color TEXT DEFAULT '#6366f1',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar Row Level Security para rooms
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

-- Policy: usuários autenticados podem ler todas as salas
CREATE POLICY "Autenticados podem ler salas" ON rooms
  FOR SELECT USING (auth.role() = 'authenticated');

-- Policy: usuários autenticados podem gerenciar salas
CREATE POLICY "Autenticados podem gerenciar salas" ON rooms
  FOR ALL USING (auth.role() = 'authenticated');

-- 2. Vincular sala padrão ao terapeuta
ALTER TABLE therapists ADD COLUMN IF NOT EXISTS room_id UUID REFERENCES rooms(id) ON DELETE SET NULL;

-- 3. Origem do paciente para cálculo de comissão
-- 'clinic'    = paciente foi indicado pela clínica → clínica recebe 50%
-- 'therapist' = paciente veio pelo terapeuta       → clínica recebe 25%
ALTER TABLE patients ADD COLUMN IF NOT EXISTS referral_source TEXT DEFAULT 'therapist' 
  CHECK (referral_source IN ('clinic', 'therapist'));

-- 4. Sala por agendamento (para override da sala padrão do terapeuta)
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS room_id UUID REFERENCES rooms(id) ON DELETE SET NULL;

-- 5. Referral source nos pagamentos (para rastrear a origem por venda)
ALTER TABLE payments ADD COLUMN IF NOT EXISTS referral_source TEXT DEFAULT 'therapist'
  CHECK (referral_source IN ('clinic', 'therapist'));

-- 6. Inserir salas de exemplo (opcional — remova se preferir cadastrar pela UI)
-- INSERT INTO rooms (name, description, color) VALUES
--   ('Sala 1', 'Sala principal de atendimento', '#6366f1'),
--   ('Sala 2', 'Sala secundária', '#10b981'),
--   ('Sala 3', 'Sala de grupo', '#f59e0b');
