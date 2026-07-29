CREATE TABLE IF NOT EXISTS product_sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_name TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    customer_email TEXT,
    customer_phone TEXT,
    customer_cpf TEXT,
    price NUMERIC(10,2) NOT NULL,
    asaas_payment_id TEXT,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE product_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public inserts" ON product_sales FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow authenticated selects" ON product_sales FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated updates" ON product_sales FOR UPDATE TO authenticated USING (true);
