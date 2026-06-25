-- 1. Remove o trigger antigo se existir para evitar conflitos
DROP TRIGGER IF EXISTS trigger_route_ticket_by_message ON service_tickets;
DROP FUNCTION IF EXISTS route_ticket_by_message();

-- 2. Cria a função que classifica e encaminha o ticket baseado na mensagem
CREATE OR REPLACE FUNCTION route_ticket_by_message()
RETURNS TRIGGER AS $$
DECLARE
  v_text TEXT;
  v_normalized TEXT;
BEGIN
  -- Só auto-classifica se department_id for nulo OU se for definido como o padrão 'Agendamentos / Secretaria'
  -- (pois o n8n ou o fluxo padrão está jogando tudo para esse departamento por padrão)
  IF NEW.department_id IS NULL OR NEW.department_id = 'c2fecf99-7c0b-4ef8-996d-4bb9bd380a33' THEN
    v_text := COALESCE(NEW.last_message, '');
    v_normalized := lower(v_text);
    
    -- Critérios para o departamento Financeiro
    IF v_normalized ~ '(financeir|pagament|boleto|pix|fatur|cobranc|mensalidad|dinheiro|custo|comprovante|recibo|contas|pagar|receber|taxa|maquininha|cartao|transferencia|estorno|reembolso)' THEN
      NEW.department_id := 'd63a933c-3913-4e2f-960d-880d55e242f9'; -- Financeiro
      
    -- Critérios para o departamento Comercial
    ELSIF v_normalized ~ '(comercial|venda|compra|interesse|curso|matricul|contrat|adquirir|plano|pacote|orcamento|saber mais|informac|preco|preço|valor|valores|matricula|contratar)' THEN
      NEW.department_id := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'; -- Comercial
      
    -- Caso o ID estivesse nulo e não bateu nos anteriores, define o padrão Agendamentos / Secretaria
    ELSIF NEW.department_id IS NULL THEN
      NEW.department_id := 'c2fecf99-7c0b-4ef8-996d-4bb9bd380a33'; -- Agendamentos / Secretaria
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Associa a função como trigger BEFORE INSERT na tabela service_tickets
CREATE TRIGGER trigger_route_ticket_by_message
BEFORE INSERT ON service_tickets
FOR EACH ROW
EXECUTE FUNCTION route_ticket_by_message();
