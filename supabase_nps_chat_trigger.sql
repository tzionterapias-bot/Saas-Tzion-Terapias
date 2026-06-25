-- 1. Remove o trigger antigo se existir para evitar conflitos
DROP TRIGGER IF EXISTS trigger_process_nps_from_chat_messages ON chat_messages;
DROP FUNCTION IF EXISTS process_nps_from_chat_messages();

-- 2. Cria a função que processará as respostas do NPS inseridas no chat_messages
CREATE OR REPLACE FUNCTION process_nps_from_chat_messages()
RETURNS TRIGGER AS $$
DECLARE
  v_ticket_id UUID;
  v_ticket_status TEXT;
  v_customer_phone TEXT;
  v_patient_id UUID;
  v_latest_appointment_id UUID;
  v_score INT;
BEGIN
  -- Ignorar se for mensagem enviada pelo bot/staff
  IF NEW.sender_type != 'customer' THEN
    RETURN NEW;
  END IF;

  -- 1. Localiza o ticket ativo no status 'awaiting_nps' para este cliente
  -- Comparamos tanto o número exato quanto os últimos 8 dígitos (para lidar com DDI/9 adicionais)
  SELECT id, status, customer_phone INTO v_ticket_id, v_ticket_status, v_customer_phone
  FROM service_tickets
  WHERE status = 'awaiting_nps'
    AND (
      customer_phone = NEW.customer_phone
      OR 
      right(regexp_replace(customer_phone, '[^0-9]', '', 'g'), 8) = right(regexp_replace(NEW.customer_phone, '[^0-9]', '', 'g'), 8)
    )
  ORDER BY created_at DESC
  LIMIT 1;

  -- Se encontrou um ticket aguardando NPS
  IF v_ticket_id IS NOT NULL THEN
    -- Verifica se o conteúdo da mensagem é um número de 0 a 10 (com ou sem espaços/quebras de linha)
    IF NEW.message_body ~ '^[ \t\r\n]*(10|[0-9])[ \t\r\n]*$' THEN
      v_score := CAST(regexp_replace(NEW.message_body, '[^0-9]', '', 'g') AS INTEGER);
      
      -- Localiza o paciente associado
      SELECT id INTO v_patient_id
      FROM patients
      WHERE phone = NEW.customer_phone
         OR right(regexp_replace(phone, '[^0-9]', '', 'g'), 8) = right(regexp_replace(NEW.customer_phone, '[^0-9]', '', 'g'), 8)
      LIMIT 1;

      -- Localiza o último agendamento dele
      IF v_patient_id IS NOT NULL THEN
        SELECT id INTO v_latest_appointment_id
        FROM appointments
        WHERE patient_id = v_patient_id
        ORDER BY start_time DESC
        LIMIT 1;
      END IF;

      -- Insere o NPS na tabela de feedbacks
      INSERT INTO nps_feedbacks (patient_id, appointment_id, score, comment)
      VALUES (v_patient_id, v_latest_appointment_id, v_score, NULL);

      -- Fecha o ticket no banco imediatamente
      UPDATE service_tickets
      SET status = 'closed', last_message = NEW.message_body
      WHERE id = v_ticket_id;
      
    ELSE
      -- Se o cliente enviou qualquer outro texto (não é uma nota de 0 a 10),
      -- reabre o ticket no status 'open' para o atendimento responder
      UPDATE service_tickets
      SET status = 'open', last_message = NEW.message_body
      WHERE id = v_ticket_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Associa a função como trigger BEFORE INSERT na tabela chat_messages
CREATE TRIGGER trigger_process_nps_from_chat_messages
BEFORE INSERT ON chat_messages
FOR EACH ROW
EXECUTE FUNCTION process_nps_from_chat_messages();
