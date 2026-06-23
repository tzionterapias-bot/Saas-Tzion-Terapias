-- ==============================================================
-- SQL para atualizar a restrição de status da tabela patient_packages
-- Execute este script no painel SQL do Supabase
-- ==============================================================

-- 1. Remover a restrição de status antiga
ALTER TABLE public.patient_packages DROP CONSTRAINT IF EXISTS patient_packages_status_check;

-- 2. Adicionar a nova restrição permitindo 'pending', 'active' e 'completed'
ALTER TABLE public.patient_packages ADD CONSTRAINT patient_packages_status_check CHECK (status IN ('pending', 'active', 'completed'));

SELECT 'Status do pacote atualizado para permitir pending com sucesso!' AS resultado;
