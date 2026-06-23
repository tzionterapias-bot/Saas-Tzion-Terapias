-- Adiciona a coluna birth_date (data de nascimento) à tabela de pacientes
ALTER TABLE patients ADD COLUMN IF NOT EXISTS birth_date DATE;

-- Opcional: Adiciona um índice para otimizar a busca por aniversariantes
CREATE INDEX IF NOT EXISTS idx_patients_birth_date ON patients(birth_date);
