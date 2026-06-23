-- =========================================================
-- TZION TERAPIAS — Correção do RLS dos Modelos de Anamnese
-- Execute este script no painel SQL (SQL Editor) do Supabase
-- =========================================================

-- ---------------------------------------------------------
-- Opção A: Confirmar e-mail dos administradores (Recomendado)
-- Isso permite o login real via Supabase Auth, gerando o token
-- correto de 'authenticated' e resolvendo o erro 403 de vez.
-- ---------------------------------------------------------
UPDATE auth.users 
SET email_confirmed_at = NOW() 
WHERE email IN ('tzionterapias@gmail.com', 'admin@tzion.com.br');

-- ---------------------------------------------------------
-- Opção B: Ajustar Políticas de Segurança (RLS) da Tabela
-- Se você utiliza o bypass local/legacy para login (sem criar o
-- usuário na tabela auth.users), o Supabase envia a requisição como
-- usuário anônimo (anon). Precisamos liberar a tabela para isso.
-- ---------------------------------------------------------

-- Desabilitar RLS na tabela clinical_templates para acesso direto (mais simples para dev/local):
ALTER TABLE clinical_templates DISABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------
-- 3. Políticas para Anamnese Pública do Paciente
-- Precisamos habilitar a leitura e escrita pública (via token anon)
-- na tabela patient_anamnesis para que o paciente consiga
-- preencher e salvar a ficha sem precisar de login.
-- ---------------------------------------------------------

-- Habilitar RLS (caso esteja desativado)
ALTER TABLE patient_anamnesis ENABLE ROW LEVEL SECURITY;

-- Criar política de leitura pública de anamneses
DROP POLICY IF EXISTS "Permitir leitura pública de anamnese" ON patient_anamnesis;
CREATE POLICY "Permitir leitura pública de anamnese" ON patient_anamnesis 
  FOR SELECT TO anon, authenticated USING (true);

-- Criar política de inserção pública de anamneses
DROP POLICY IF EXISTS "Permitir inserção pública de anamnese" ON patient_anamnesis;
CREATE POLICY "Permitir inserção pública de anamnese" ON patient_anamnesis 
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Criar política de atualização pública de anamneses
DROP POLICY IF EXISTS "Permitir atualização pública de anamnese" ON patient_anamnesis;
CREATE POLICY "Permitir atualização pública de anamnese" ON patient_anamnesis 
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
