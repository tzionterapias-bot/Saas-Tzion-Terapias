-- Script de Limpeza Automática de Logs (Políticas de 15 dias)
-- Apaga registros antigos de disparos, mensagens de chat e campanhas com mais de 15 dias

CREATE OR REPLACE FUNCTION public.auto_cleanup_old_logs_15days()
RETURNS void AS $$
BEGIN
  -- 1. Limpa histórico de disparos de WhatsApp com mais de 15 dias
  DELETE FROM public.communications_log
  WHERE created_at < NOW() - INTERVAL '15 days';

  -- 2. Limpa mensagens do chat do WhatsApp com mais de 15 dias
  DELETE FROM public.chat_messages
  WHERE created_at < NOW() - INTERVAL '15 days';

  -- 3. Limpa logs de disparo de campanhas de marketing com mais de 15 dias
  DELETE FROM public.campaign_logs
  WHERE created_at < NOW() - INTERVAL '15 days';

END;
$$ LANGUAGE plpgsql;

-- Opcional: Se a extensão pg_cron estiver ativada no Supabase, agenda para rodar diariamente às 03:00 da manhã
-- SELECT cron.schedule('daily_cleanup_15days', '0 3 * * *', 'SELECT public.auto_cleanup_old_logs_15days()');
