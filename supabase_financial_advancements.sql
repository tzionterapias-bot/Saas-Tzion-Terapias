-- ==============================================================
-- SQL para estruturar vendas multimodais e upload de comprovantes
-- Execute este script no painel SQL do Supabase
-- ==============================================================

-- 1. Tabela de Itens de Pacotes Multimodais
CREATE TABLE IF NOT EXISTS public.patient_package_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  package_id uuid NOT NULL REFERENCES public.patient_packages(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  total_sessions integer NOT NULL CHECK (total_sessions > 0),
  used_sessions integer DEFAULT 0 NOT NULL CHECK (used_sessions >= 0),
  created_at timestamptz DEFAULT timezone('utc', now()) NOT NULL,
  CONSTRAINT patient_package_items_sessions_check CHECK (used_sessions <= total_sessions)
);

-- Habilitar RLS e criar políticas para patient_package_items
ALTER TABLE public.patient_package_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins e recepcao gerenciam itens de pacotes" ON public.patient_package_items;
CREATE POLICY "Admins e recepcao gerenciam itens de pacotes" ON public.patient_package_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'atendimento', 'financeiro')
    )
  );

DROP POLICY IF EXISTS "Clientes veem seus proprios itens de pacotes" ON public.patient_package_items;
CREATE POLICY "Clientes veem seus proprios itens de pacotes" ON public.patient_package_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.patient_packages
      WHERE patient_packages.id = package_id
      AND patient_packages.patient_id = auth.uid()
    )
  );

-- 2. Adicionar coluna receipt_url na tabela de pagamentos (payments)
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS receipt_url text;

-- 3. Configurar Bucket de Comprovantes de Pagamento no Storage
INSERT INTO storage.buckets (id, name, public) 
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO NOTHING;

-- Remover políticas antigas de storage se existirem
DROP POLICY IF EXISTS "Todos podem ler comprovantes" ON storage.objects;
DROP POLICY IF EXISTS "Funcionarios gerenciam comprovantes" ON storage.objects;

-- Criar políticas de leitura pública para o bucket receipts
CREATE POLICY "Todos podem ler comprovantes" ON storage.objects
  FOR SELECT USING (bucket_id = 'receipts');

-- Criar políticas de gerenciamento de uploads para equipe interna
CREATE POLICY "Funcionarios gerenciam comprovantes" ON storage.objects
  FOR ALL USING (
    bucket_id = 'receipts' 
    AND (
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'financeiro', 'atendimento')
      )
    )
  );

SELECT 'Estrutura para pacotes multimodais e comprovantes criada com sucesso!' AS resultado;
