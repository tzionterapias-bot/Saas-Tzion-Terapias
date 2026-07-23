-- Adicionar colunas necessárias na tabela public.patients para suporte completo ao Termo de Compromisso e cadastro estendido
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS rg VARCHAR(50);
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS rg_issuer VARCHAR(50);
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS rg_issue_date DATE;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS profession VARCHAR(100);
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS marital_status VARCHAR(50);
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS guardian_name VARCHAR(255);
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS guardian_cpf VARCHAR(20);

-- Comentários das colunas
COMMENT ON COLUMN public.patients.rg IS 'Número do documento de identidade (RG)';
COMMENT ON COLUMN public.patients.rg_issuer IS 'Órgão expedidor do RG (ex: SSP-TO)';
COMMENT ON COLUMN public.patients.rg_issue_date IS 'Data de expedição/emissão do RG';
COMMENT ON COLUMN public.patients.profession IS 'Profissão / Ocupação do paciente';
COMMENT ON COLUMN public.patients.marital_status IS 'Estado Civil do paciente (Solteiro(a), Casado(a), etc)';
COMMENT ON COLUMN public.patients.guardian_name IS 'Nome do responsável legal ou financeiro (se menor de idade ou procurador)';
COMMENT ON COLUMN public.patients.guardian_cpf IS 'CPF do responsável legal ou financeiro';
