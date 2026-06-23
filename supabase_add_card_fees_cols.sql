-- =============================================
-- TZION TERAPIAS — Colunas de Taxa de Maquininha
-- Execute este script no painel SQL do Supabase
-- =============================================

ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS card_fee_rate numeric(5,2) DEFAULT 0.00;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS card_fee_val numeric(12,2) DEFAULT 0.00;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS net_amount numeric(12,2);

-- Inicializar net_amount para registros existentes
UPDATE public.payments SET net_amount = amount WHERE net_amount IS NULL;

SELECT 'Colunas de taxa de maquininha adicionadas com sucesso!' AS resultado;
