-- ==============================================================================
-- FUNÇÃO RPC: consultar_agendamentos_cpf
-- Permite que o AI Agent do n8n ou a API consulte agendamentos e sessões
-- de um paciente com base nos 3 últimos dígitos do CPF (ou CPF completo)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.consultar_agendamentos_cpf(
  p_cpf_digitos TEXT,
  p_telefone TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_digitos_limpos TEXT;
  v_telefone_limpo TEXT;
  v_paciente_id UUID;
  v_paciente_nome TEXT;
  v_paciente_cpf TEXT;
  v_agendamentos JSONB;
  v_total_agendamentos INT := 0;
BEGIN
  -- 1. Limpa os dígitos recebidos (deixa somente números)
  v_digitos_limpos := regexp_replace(COALESCE(p_cpf_digitos, ''), '\D', '', 'g');
  
  IF v_digitos_limpos IS NULL OR length(v_digitos_limpos) < 3 THEN
    RETURN jsonb_build_object(
      'sucesso', false,
      'encontrado', false,
      'mensagem', 'Informe pelo menos os 3 últimos dígitos do seu CPF para consulta.'
    );
  END IF;

  -- 2. Limpa o telefone se informado (pega os últimos 8 dígitos para comparação robusta)
  IF p_telefone IS NOT NULL AND trim(p_telefone) <> '' THEN
    v_telefone_limpo := RIGHT(regexp_replace(p_telefone, '\D', '', 'g'), 8);
  ELSE
    v_telefone_limpo := NULL;
  END IF;

  -- 3. Localiza o paciente compatível
  -- Prioridade 1: Dígitos de CPF compatíveis E telefone coincide
  IF v_telefone_limpo IS NOT NULL AND length(v_telefone_limpo) >= 8 THEN
    SELECT p.id, p.name, p.cpf
    INTO v_paciente_id, v_paciente_nome, v_paciente_cpf
    FROM public.patients p
    WHERE p.cpf IS NOT NULL
      AND (
        RIGHT(regexp_replace(p.cpf, '\D', '', 'g'), length(v_digitos_limpos)) = v_digitos_limpos
        OR (length(v_digitos_limpos) = 3 AND length(regexp_replace(p.cpf, '\D', '', 'g')) >= 9 
            AND substring(regexp_replace(p.cpf, '\D', '', 'g') from 7 for 3) = v_digitos_limpos)
        OR regexp_replace(p.cpf, '\D', '', 'g') LIKE '%' || v_digitos_limpos
      )
      AND RIGHT(regexp_replace(COALESCE(p.phone, ''), '\D', '', 'g'), 8) = v_telefone_limpo
    ORDER BY p.created_at DESC
    LIMIT 1;
  END IF;

  -- Prioridade 2: Se não localizou com o telefone, busca apenas pelos dígitos do CPF
  IF v_paciente_id IS NULL THEN
    SELECT p.id, p.name, p.cpf
    INTO v_paciente_id, v_paciente_nome, v_paciente_cpf
    FROM public.patients p
    WHERE p.cpf IS NOT NULL
      AND (
        RIGHT(regexp_replace(p.cpf, '\D', '', 'g'), length(v_digitos_limpos)) = v_digitos_limpos
        OR (length(v_digitos_limpos) = 3 AND length(regexp_replace(p.cpf, '\D', '', 'g')) >= 9 
            AND substring(regexp_replace(p.cpf, '\D', '', 'g') from 7 for 3) = v_digitos_limpos)
        OR regexp_replace(p.cpf, '\D', '', 'g') LIKE '%' || v_digitos_limpos
      )
    ORDER BY p.created_at DESC
    LIMIT 1;
  END IF;

  -- Se nenhum paciente foi encontrado
  IF v_paciente_id IS NULL THEN
    RETURN jsonb_build_object(
      'sucesso', false,
      'encontrado', false,
      'mensagem', 'Não localizei nenhum paciente com os dígitos de CPF informados (' || v_digitos_limpos || '). Por favor, confirme se os dígitos estão corretos.'
    );
  END IF;

  -- 4. Busca as sessões/agendamentos do paciente
  -- Traz agendamentos futuros (ou de hoje em diante) e com status válido
  SELECT 
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', a.id,
          'data_hora_inicio', a.start_time,
          'data_formatada', to_char(a.start_time AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY às HH24:MI'),
          'dia_semana', CASE EXTRACT(DOW FROM a.start_time AT TIME ZONE 'America/Sao_Paulo')
            WHEN 0 THEN 'Domingo'
            WHEN 1 THEN 'Segunda-feira'
            WHEN 2 THEN 'Terça-feira'
            WHEN 3 THEN 'Quarta-feira'
            WHEN 4 THEN 'Quinta-feira'
            WHEN 5 THEN 'Sexta-feira'
            WHEN 6 THEN 'Sábado'
          END,
          'status', CASE 
            WHEN a.status = 'scheduled' THEN 'Agendado'
            WHEN a.status = 'confirmed' THEN 'Confirmado'
            WHEN a.status = 'completed' THEN 'Concluído'
            WHEN a.status = 'cancelled' THEN 'Cancelado'
            ELSE a.status
          END,
          'modalidade', COALESCE(a.type, 'Presencial'),
          'local', CASE 
            WHEN LOWER(COALESCE(a.type, '')) LIKE '%online%' THEN 'Online (Videochamada privativa)'
            ELSE 'Presencial (Clínica Tzion em Araguaína - TO)'
          END,
          'terapeuta', COALESCE(t.name, 'Equipe Tzion Terapias'),
          'servico', COALESCE(s.name, 'Sessão de Terapia'),
          'meet_link', a.meet_link
        ) ORDER BY a.start_time ASC
      ),
      '[]'::jsonb
    ),
    COUNT(a.id)
  INTO v_agendamentos, v_total_agendamentos
  FROM public.appointments a
  LEFT JOIN public.therapists t ON t.id = a.therapist_id
  LEFT JOIN public.services s ON s.id = a.service_id
  WHERE a.patient_id = v_paciente_id
    AND a.status IN ('scheduled', 'confirmed')
    AND a.start_time >= (NOW() - INTERVAL '4 hours')
  ORDER BY a.start_time ASC
  LIMIT 5;

  -- Se não tiver agendamentos futuros
  IF v_total_agendamentos = 0 THEN
    RETURN jsonb_build_object(
      'sucesso', true,
      'encontrado', true,
      'paciente_nome', v_paciente_nome,
      'total_agendamentos', 0,
      'agendamentos', '[]'::jsonb,
      'mensagem', 'Cadastro de ' || v_paciente_nome || ' localizado com sucesso, porém no momento não constam sessões futuras agendadas no sistema.'
    );
  END IF;

  RETURN jsonb_build_object(
    'sucesso', true,
    'encontrado', true,
    'paciente_nome', v_paciente_nome,
    'total_agendamentos', v_total_agendamentos,
    'agendamentos', v_agendamentos,
    'mensagem', 'Agendamento(s) localizado(s) com sucesso para ' || v_paciente_nome || '.'
  );
END;
$$;

-- Permissões de acesso público/anon para a API do Supabase
GRANT EXECUTE ON FUNCTION public.consultar_agendamentos_cpf(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.consultar_agendamentos_cpf(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consultar_agendamentos_cpf(TEXT, TEXT) TO service_role;
