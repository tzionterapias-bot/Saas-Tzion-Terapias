-- TZION TERAPIAS — Tipo/Categoria da Sessão para Appointments
-- Permite marcar se é uma Consulta Inicial, Sessão Avulsa, Sessão de Pacote ou Retorno

ALTER TABLE public.appointments 
  ADD COLUMN IF NOT EXISTS session_category text 
  DEFAULT 'sessao_avulsa'
  CHECK (session_category IN ('consulta_inicial', 'sessao_avulsa', 'sessao_pacote', 'retorno'));

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS session_number integer;

-- Índice para facilitar filtros por tipo de sessão
CREATE INDEX IF NOT EXISTS idx_appointments_session_category 
  ON public.appointments(session_category);

SELECT 'Colunas session_category e session_number adicionadas com sucesso à tabela appointments!' AS resultado;
