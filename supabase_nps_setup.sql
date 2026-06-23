-- 1. Adicionar colunas para controle do NPS na tabela de agendamentos
ALTER TABLE appointments 
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS nps_sent BOOLEAN DEFAULT false;

-- 2. Adicionar coluna para horários de atendimento dos terapeutas
ALTER TABLE therapists
ADD COLUMN IF NOT EXISTS working_hours JSONB DEFAULT '{"monday": {"active": true, "start": "08:00", "end": "18:00"}, "tuesday": {"active": true, "start": "08:00", "end": "18:00"}, "wednesday": {"active": true, "start": "08:00", "end": "18:00"}, "thursday": {"active": true, "start": "08:00", "end": "18:00"}, "friday": {"active": true, "start": "08:00", "end": "18:00"}, "saturday": {"active": false, "start": "08:00", "end": "12:00"}, "sunday": {"active": false, "start": "08:00", "end": "12:00"}}'::jsonb;
