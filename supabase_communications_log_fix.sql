-- Migration: Adiciona colunas para armazenar dados de destinatário diretamente na tabela communications_log
ALTER TABLE public.communications_log
ADD COLUMN IF NOT EXISTS recipient_name TEXT,
ADD COLUMN IF NOT EXISTS recipient_phone TEXT;

COMMENT ON COLUMN public.communications_log.recipient_name IS 'Nome do destinatário (Paciente ou Terapeuta)';
COMMENT ON COLUMN public.communications_log.recipient_phone IS 'Telefone utilizado para o envio da mensagem';
