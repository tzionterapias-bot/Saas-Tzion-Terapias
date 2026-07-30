ALTER TABLE public.product_sales ADD COLUMN IF NOT EXISTS product_id TEXT;
ALTER TABLE public.product_sales ADD COLUMN IF NOT EXISTS product_url TEXT;
NOTIFY pgrst, 'reload schema';
