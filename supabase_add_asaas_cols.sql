-- =============================================
-- TZION TERAPIAS — Colunas Asaas para Payments
-- Execute este script no painel SQL do Supabase
-- =============================================

ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS asaas_id text;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS asaas_link text;

SELECT 'Colunas do Asaas adicionadas com sucesso!' AS resultado;
