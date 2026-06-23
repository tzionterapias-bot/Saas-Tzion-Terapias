-- Adicionar a coluna gender na tabela patients, se não existir
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS gender varchar(20);

-- Criar tabela campaigns
CREATE TABLE IF NOT EXISTS public.campaigns (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    message text NOT NULL,
    delay_seconds integer DEFAULT 10,
    target_gender varchar(20),
    attachment_url text,
    status varchar(20) DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'completed', 'paused', 'failed')),
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by uuid REFERENCES auth.users(id),
    total_contacts integer DEFAULT 0,
    sent_contacts integer DEFAULT 0
);

-- Habilitar RLS para campaigns
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

-- Políticas para campaigns (Apenas administradores e atendimento podem acessar)
CREATE POLICY "Acesso total as campanhas para admins e atendimento"
    ON public.campaigns FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND (profiles.role = 'admin' OR profiles.role = 'atendimento')
        )
    );

-- Criar tabela campaign_logs
CREATE TABLE IF NOT EXISTS public.campaign_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE,
    patient_id uuid REFERENCES public.patients(id) ON DELETE CASCADE,
    patient_phone varchar(20) NOT NULL,
    status varchar(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    error_message text,
    sent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS para campaign_logs
ALTER TABLE public.campaign_logs ENABLE ROW LEVEL SECURITY;

-- Políticas para campaign_logs
CREATE POLICY "Acesso total aos logs de campanhas para admins e atendimento"
    ON public.campaign_logs FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND (profiles.role = 'admin' OR profiles.role = 'atendimento')
        )
    );

-- Criar o bucket de storage para os anexos das campanhas (Necessita rodar como superuser ou via painel do Supabase se o SQL falhar)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('campaign_attachments', 'campaign_attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de Storage para campaign_attachments
CREATE POLICY "Acesso de leitura publico para attachments" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'campaign_attachments');

CREATE POLICY "Acesso de escrita para admin e atendimento" 
ON storage.objects FOR INSERT 
WITH CHECK (
    bucket_id = 'campaign_attachments' AND 
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND (profiles.role = 'admin' OR profiles.role = 'atendimento')
    )
);
