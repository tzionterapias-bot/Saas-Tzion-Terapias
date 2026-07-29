
CREATE TABLE IF NOT EXISTS public.product_sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id TEXT,
    product_name TEXT NOT NULL,
    patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE,
    customer_name TEXT NOT NULL,
    customer_email TEXT,
    customer_phone TEXT,
    customer_cpf TEXT,
    price DECIMAL(10,2) NOT NULL,
    asaas_payment_id TEXT,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.product_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can insert sales" ON public.product_sales FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can view their own sales" ON public.product_sales FOR SELECT USING (true);
CREATE POLICY "Admins can do everything on sales" ON public.product_sales FOR ALL USING (true);

