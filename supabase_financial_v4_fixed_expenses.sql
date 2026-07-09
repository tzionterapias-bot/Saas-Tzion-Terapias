-- =============================================
-- TZION TERAPIAS — Fixed Expenses (is_fixed)
-- Execute no painel SQL do Supabase → SQL Editor
-- =============================================

-- Adicionar coluna is_fixed para marcar despesas fixas / recorrentes
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS is_fixed boolean DEFAULT false;

SELECT 'Fixed Expenses column added successfully!' AS resultado;
