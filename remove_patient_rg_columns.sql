-- ==============================================================
-- TZION TERAPIAS — Remoção das Colunas de RG da Tabela patients
-- ==============================================================

ALTER TABLE public.patients DROP COLUMN IF EXISTS rg CASCADE;
ALTER TABLE public.patients DROP COLUMN IF EXISTS rg_issuer CASCADE;
ALTER TABLE public.patients DROP COLUMN IF EXISTS rg_issue_date CASCADE;
