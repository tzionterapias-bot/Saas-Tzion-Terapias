-- TZION TERAPIAS — Colunas de Assinatura Recorrente para Payments
-- Permite vincular pagamentos a assinaturas do Asaas (plano Tzion Care, etc.)

ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS asaas_subscription_id text;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS subscription_cycle text;

-- Criar índice para agilizar buscas por assinatura no webhook de renovação
CREATE INDEX IF NOT EXISTS idx_payments_asaas_subscription_id ON public.payments(asaas_subscription_id);

SELECT 'Colunas de assinatura recorrente Asaas adicionadas com sucesso à tabela payments!' AS resultado;
