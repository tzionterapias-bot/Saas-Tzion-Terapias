-- =====================================================================
-- TZION TERAPIAS — Suporte a Modelos Dinâmicos e Segurança de Anamnese
-- Execute este script no painel SQL (SQL Editor) do Supabase
-- =====================================================================

-- 1. Estrutura de Banco de Dados: Adicionar suporte a templates
ALTER TABLE patient_anamnesis ADD COLUMN IF NOT EXISTS responses JSONB DEFAULT '{}'::jsonb;
ALTER TABLE patient_anamnesis ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES clinical_templates(id) ON DELETE SET NULL;

-- 2. Habilitar Row Level Security na tabela patient_anamnesis
ALTER TABLE patient_anamnesis ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas para evitar conflitos
DROP POLICY IF EXISTS "Permitir leitura pública de anamnese" ON patient_anamnesis;
DROP POLICY IF EXISTS "Permitir inserção pública de anamnese" ON patient_anamnesis;
DROP POLICY IF EXISTS "Permitir atualização pública de anamnese" ON patient_anamnesis;
DROP POLICY IF EXISTS "Permitir acesso apenas se terapeuta responsável ou admin" ON patient_anamnesis;
DROP POLICY IF EXISTS "Acesso público para pacientes preencherem" ON patient_anamnesis;
DROP POLICY IF EXISTS "Acesso restrito para equipe clínica" ON patient_anamnesis;

-- 3. Criar nova política de acesso para Anon (Pacientes via link público)
-- Pacientes precisam ler e escrever sem autenticação usando o token anon
CREATE POLICY "Acesso público para pacientes preencherem" ON patient_anamnesis
  FOR ALL TO anon
  USING (true)
  WITH CHECK (true);

-- 4. Criar nova política de acesso para Authenticated (Terapeutas e Admins)
CREATE POLICY "Acesso restrito para equipe clínica" ON patient_anamnesis
  FOR ALL TO authenticated
  USING (
    -- Admins têm acesso total
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    OR
    -- Terapeutas têm acesso se forem responsáveis (tiverem pelo menos uma consulta com o paciente)
    (
      (SELECT role FROM profiles WHERE id = auth.uid()) = 'terapeuta'
      AND EXISTS (
        SELECT 1 FROM appointments a
        JOIN therapists t ON a.therapist_id = t.id
        WHERE a.patient_id = patient_anamnesis.patient_id
          AND t.user_id = auth.uid()
      )
    )
    OR
    -- Atendentes/Recepção podem ler os metadados (para saber se foi preenchido)
    -- mas a ocultação de campos confidenciais ocorre no frontend
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'atendimento'
  )
  WITH CHECK (
    -- Permissão de escrita restrita a Admin e Terapeuta Responsável
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    OR
    (
      (SELECT role FROM profiles WHERE id = auth.uid()) = 'terapeuta'
      AND EXISTS (
        SELECT 1 FROM appointments a
        JOIN therapists t ON a.therapist_id = t.id
        WHERE a.patient_id = patient_anamnesis.patient_id
          AND t.user_id = auth.uid()
      )
    )
  );
