-- Adiciona coluna scheduled_at na tabela campaigns para habilitar o agendamento
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS scheduled_at timestamp with time zone;

-- Adiciona coluna is_locked para evitar duplo disparo (race condition no worker)
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS is_locked boolean DEFAULT false;

-- Atualiza o CHECK de status para incluir 'scheduled'
ALTER TABLE public.campaigns DROP CONSTRAINT IF EXISTS campaigns_status_check;
ALTER TABLE public.campaigns ADD CONSTRAINT campaigns_status_check 
  CHECK (status IN ('draft', 'scheduled', 'running', 'completed', 'paused', 'failed'));

-- Garante status único por (campaign_id, patient_id) para evitar duplicatas em campaign_logs
CREATE UNIQUE INDEX IF NOT EXISTS campaign_logs_unique_patient
  ON public.campaign_logs(campaign_id, patient_id);
