-- =============================================
-- TZION TERAPIAS — Remover Triggers Antigos de Payments
-- Execute este script no painel SQL do Supabase
-- Resolve o erro "column 'appointment_id' of relation 'commission_payouts' does not exist"
-- =============================================

-- 1. Identificar e remover qualquer trigger na tabela public.payments
DO $$
DECLARE
    t RECORD;
BEGIN
    FOR t IN (
        SELECT trigger_name, event_object_table
        FROM information_schema.triggers
        WHERE event_object_schema = 'public'
          AND event_object_table = 'payments'
    ) LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(t.trigger_name) || ' ON public.payments CASCADE;';
        RAISE NOTICE 'Trigger removido: % da tabela payments', t.trigger_name;
    END LOOP;
END $$;

-- 2. Remover também possíveis triggers das tabelas appointments ou therapists que possam tentar inserir em commission_payouts
DO $$
DECLARE
    t RECORD;
BEGIN
    FOR t IN (
        SELECT trigger_name, event_object_table
        FROM information_schema.triggers
        WHERE event_object_schema = 'public'
          AND event_object_table IN ('appointments', 'therapists')
          AND (trigger_name LIKE '%commission%' OR trigger_name LIKE '%payout%')
    ) LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(t.trigger_name) || ' ON public.' || quote_ident(t.event_object_table) || ' CASCADE;';
        RAISE NOTICE 'Trigger removido: % da tabela %', t.trigger_name, t.event_object_table;
    END LOOP;
END $$;

-- 3. Remover funções antigas conhecidas que podiam estar associadas aos triggers
DROP FUNCTION IF EXISTS public.calculate_commission() CASCADE;
DROP FUNCTION IF EXISTS public.process_payment_commission() CASCADE;
DROP FUNCTION IF EXISTS public.on_payment_paid() CASCADE;
DROP FUNCTION IF EXISTS public.process_commission() CASCADE;

SELECT 'Triggers e funções antigas de comissão removidos com sucesso!' AS resultado;
