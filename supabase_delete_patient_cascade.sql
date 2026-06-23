-- ==============================================================================
-- SQL para habilitar deleção em cascata (ON DELETE CASCADE) de pacientes
-- Execute este script no painel SQL do seu painel do Supabase.
-- ==============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT 
            tc.table_schema, 
            tc.table_name, 
            tc.constraint_name, 
            kcu.column_name, 
            ccu.table_name AS foreign_table_name, 
            ccu.column_name AS foreign_column_name 
        FROM 
            information_schema.table_constraints AS tc 
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = tc.constraint_name
              AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY' 
          AND ccu.table_name IN ('patients', 'appointments', 'patient_packages')
          AND ccu.table_schema = 'public'
    ) LOOP
        -- Remove a constraint de chave estrangeira antiga
        EXECUTE 'ALTER TABLE ' || quote_ident(r.table_schema) || '.' || quote_ident(r.table_name) || 
                ' DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name);
        
        -- Cria a nova constraint com ON DELETE CASCADE
        EXECUTE 'ALTER TABLE ' || quote_ident(r.table_schema) || '.' || quote_ident(r.table_name) || 
                ' ADD CONSTRAINT ' || quote_ident(r.constraint_name) || 
                ' FOREIGN KEY (' || quote_ident(r.column_name) || ') REFERENCES public.' || quote_ident(r.foreign_table_name) || '(' || quote_ident(r.foreign_column_name) || ') ON DELETE CASCADE';
    END LOOP;
END $$;
