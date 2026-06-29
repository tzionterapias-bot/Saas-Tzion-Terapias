-- =====================================================================
-- CONFIGURAÇÃO DE CRON JOBS DIRETAMENTE NO SUPABASE (pg_cron + pg_net)
-- =====================================================================
--
-- Execute este script no Painel do Supabase (SQL Editor) para que o próprio
-- banco de dados chame os endpoints do Vercel de forma automática e segura.
--

-- 1. Habilitar as extensões necessárias na database
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Limpar agendamentos anteriores de forma segura (evita erros se os jobs ainda não existirem)
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'campaign-dispatch-job';
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'daily-workers-job';

-- 3. Agendar o processamento da fila de campanhas a cada 1 minuto
SELECT cron.schedule(
  'campaign-dispatch-job',  -- Nome único da tarefa
  '* * * * *',              -- Expressão cron (todo minuto)
  $$
  SELECT net.http_get(
    'https://saas-tzion-terapias-six.vercel.app/api/cron/campaigns?key=Lumina2026'
  );
  $$
);

-- 4. Agendar a sincronização diária de lembretes, NPS, tickets e financeiro às 12:00 UTC (09:00 AM Horário de Brasília)
SELECT cron.schedule(
  'daily-workers-job',      -- Nome único da tarefa
  '0 12 * * *',             -- Expressão cron (todo dia às 12:00 UTC)
  $$
  SELECT net.http_get(
    'https://saas-tzion-terapias-six.vercel.app/api/cron/all?key=Lumina2026'
  );
  $$
);

-- 5. Listar tarefas agendadas para confirmação
SELECT * FROM cron.job;
