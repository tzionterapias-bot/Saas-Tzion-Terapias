-- =============================================
-- TZION TERAPIAS — Fornecedores (Novos Campos)
-- Execute no painel SQL do Supabase → SQL Editor
-- =============================================

ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS products_provided text;

SELECT 'Suppliers table updated successfully!' AS resultado;
