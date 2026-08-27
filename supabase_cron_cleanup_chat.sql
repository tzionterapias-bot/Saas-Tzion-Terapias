-- =====================================================================
-- LIMPEZA AUTOMÁTICA DO CHAT INTERNO (A CADA 24H)
-- =====================================================================
--
-- Execute este script no Painel do Supabase (SQL Editor) para 
-- agendar a exclusão de mensagens com mais de 24 horas.

-- 1. Habilitar a extensão pg_cron (caso ainda não esteja)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Limpar o agendamento anterior se existir
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'cleanup-internal-chat';

-- 3. Agendar o job para rodar a cada hora (limpando o que for mais antigo que 24h)
SELECT cron.schedule(
  'cleanup-internal-chat',  -- Nome da tarefa
  '0 * * * *',              -- Expressão cron: roda no minuto zero de toda hora
  $$
    DELETE FROM public.internal_messages 
    WHERE created_at < NOW() - INTERVAL '24 hours';
  $$
);

SELECT 'Cron job de limpeza do chat interno agendado com sucesso!' AS resultado;
