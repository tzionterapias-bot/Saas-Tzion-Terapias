-- 1. Remove os triggers antigos do chat_messages (que causavam a concorrência)
DROP TRIGGER IF EXISTS trigger_process_nps_from_chat ON chat_messages;
DROP FUNCTION IF EXISTS process_nps_from_chat();


-- 2. Cria a função e o trigger na tabela nps_feedbacks para fechar o ticket quando a nota for salva pelo n8n
CREATE OR REPLACE FUNCTION close_ticket_on_nps_feedback()
RETURNS TRIGGER AS $$
DECLARE
  v_customer_phone TEXT;
BEGIN
  -- Busca o telefone do paciente para relacionar com o ticket
  SELECT phone INTO v_customer_phone
  FROM patients
  WHERE id = NEW.patient_id
  LIMIT 1;

  IF v_customer_phone IS NOT NULL THEN
    -- Fecha o ticket que estava aguardando NPS para este cliente
    UPDATE service_tickets
    SET status = 'closed'
    WHERE status = 'awaiting_nps'
      AND (
        customer_phone = v_customer_phone
        OR 
        right(regexp_replace(customer_phone, '[^0-9]', '', 'g'), 8) = right(regexp_replace(v_customer_phone, '[^0-9]', '', 'g'), 8)
      );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_close_ticket_on_nps_feedback ON nps_feedbacks;

CREATE TRIGGER trigger_close_ticket_on_nps_feedback
AFTER INSERT ON nps_feedbacks
FOR EACH ROW
EXECUTE FUNCTION close_ticket_on_nps_feedback();


-- 3. Cria a função e o trigger na tabela service_tickets para fechar tickets antigos pendentes de NPS
-- quando um novo ticket de atendimento for aberto (caso o cliente digite texto em vez de nota)
CREATE OR REPLACE FUNCTION close_old_nps_tickets_on_new()
RETURNS TRIGGER AS $$
BEGIN
  -- Fecha qualquer ticket em 'awaiting_nps' do mesmo cliente para não acumular
  UPDATE service_tickets
  SET status = 'closed'
  WHERE customer_phone = NEW.customer_phone
    AND status = 'awaiting_nps'
    AND id != NEW.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_close_old_nps_tickets_on_new ON service_tickets;

CREATE TRIGGER trigger_close_old_nps_tickets_on_new
BEFORE INSERT ON service_tickets
FOR EACH ROW
EXECUTE FUNCTION close_old_nps_tickets_on_new();
