-- =====================================================================
-- ATUALIZAÇÃO DO DOMÍNIO DA CLÍNICA PARA: app.tzionterapias.com.br
-- =====================================================================
-- Execute este script no SQL Editor do Supabase para atualizar a URL
-- oficial do sistema e os agendamentos automáticos de disparo.

-- 1. Atualiza a URL base da clínica na tabela settings
INSERT INTO public.settings (key, value)
VALUES (
  'clinic_profile',
  '{"system_url": "https://app.tzionterapias.com.br"}'::jsonb
)
ON CONFLICT (key) DO UPDATE
SET value = jsonb_set(
  COALESCE(public.settings.value, '{}'::jsonb),
  '{system_url}',
  '"https://app.tzionterapias.com.br"'::jsonb
);

-- 2. Atualiza os Cron Jobs do pg_cron (se habilitado) para o novo domínio
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Desagenda tarefas antigas se existirem
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname IN ('campaign-dispatch-job', 'daily-workers-job');

    -- Disparo da fila de campanhas a cada 1 minuto
    PERFORM cron.schedule(
      'campaign-dispatch-job',
      '* * * * *',
      $cron$
      SELECT net.http_get(
        'https://app.tzionterapias.com.br/api/cron/campaigns?key=Lumina2026'
      );
      $cron$
    );

    -- Disparo diário (lembretes, NPS, tickets, etc.) às 12:00 UTC (09:00 BRT)
    PERFORM cron.schedule(
      'daily-workers-job',
      '0 12 * * *',
      $cron$
      SELECT net.http_get(
        'https://app.tzionterapias.com.br/api/cron/all?key=Lumina2026'
      );
      $cron$
    );
  END IF;
END $$;

-- 3. Consulta de verificação
SELECT key, value FROM public.settings WHERE key IN ('clinic_profile', 'integrations');

