-- Remove o trigger antigo se existir
DROP TRIGGER IF EXISTS sync_ticket_to_lead_trigger ON service_tickets;

-- Cria ou substitui a função do trigger
CREATE OR REPLACE FUNCTION trg_sync_ticket_to_lead()
RETURNS TRIGGER AS $$
DECLARE
  v_lead_id UUID;
  v_phone TEXT;
BEGIN
  -- Extrair apenas os números do telefone (ignorando @s.whatsapp.net ou espaços) para comparar
  v_phone := regexp_replace(NEW.customer_phone, '\D', '', 'g');
  
  -- Verificar se já existe um lead com esse telefone
  SELECT id INTO v_lead_id 
  FROM leads 
  WHERE regexp_replace(phone, '\D', '', 'g') = v_phone 
  LIMIT 1;
  
  IF TG_OP = 'INSERT' THEN
    -- Toda vez que um ticket é criado, se o lead não existir, ele é criado automaticamente
    IF v_lead_id IS NULL THEN
      INSERT INTO leads (name, phone, status, tags, created_at, updated_at)
      VALUES (
        COALESCE(NEW.customer_name, 'Lead Automático'), 
        NEW.customer_phone, 
        'new', 
        ARRAY['WhatsApp'], 
        NOW(), 
        NOW()
      );
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Se o ticket for atualizado e a IA (ou humano) inserir uma Tag no last_message
    IF v_lead_id IS NOT NULL THEN
      -- Se a mensagem da IA contiver [LEAD_QUENTE], atualiza o Lead
      IF NEW.last_message ILIKE '%[LEAD_QUENTE]%' THEN
        UPDATE leads 
        SET status = 'contacted', 
            tags = ARRAY(SELECT DISTINCT unnest(array_append(tags, 'Quente'))),
            updated_at = NOW()
        WHERE id = v_lead_id;
      END IF;
      
      -- Se a IA decidiu transferir pro departamento de agendamento
      IF NEW.last_message ILIKE '%[DEPARTAMENTO:AGENDAMENTO]%' THEN
        UPDATE leads 
        SET status = 'contacted', 
            updated_at = NOW()
        WHERE id = v_lead_id AND status = 'new';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Cria o novo trigger para rodar sempre que um ticket for criado ou atualizado
CREATE TRIGGER sync_ticket_to_lead_trigger
AFTER INSERT OR UPDATE ON service_tickets
FOR EACH ROW
EXECUTE FUNCTION trg_sync_ticket_to_lead();
