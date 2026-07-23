-- Create patient documents table
CREATE TABLE IF NOT EXISTS public.patient_documents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_type TEXT,
    file_path TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.patient_documents ENABLE ROW LEVEL SECURITY;

-- Policies for patient_documents table
CREATE POLICY "Enable read access for all users" ON public.patient_documents
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON public.patient_documents
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON public.patient_documents
    FOR DELETE USING (auth.role() = 'authenticated');

-- Create storage bucket if not exists (using raw SQL)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('patient-documents', 'patient-documents', true)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'patient-documents' );

CREATE POLICY "Authenticated users can upload documents"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'patient-documents' AND auth.role() = 'authenticated' );

CREATE POLICY "Authenticated users can delete documents"
ON storage.objects FOR DELETE
USING ( bucket_id = 'patient-documents' AND auth.role() = 'authenticated' );
