-- ==============================================================
-- TZION TERAPIAS — Criação Automática de Usuário/Perfil para Pacientes (REFINADO)
-- Executar este script no painel SQL Editor do Supabase.
-- ==============================================================

-- ──────────────────────────────────────────────────────────────
-- 1. FUNÇÃO E TRIGGER DE CRIAÇÃO / ATUALIZAÇÃO (INSERT OR UPDATE)
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.trg_auto_create_user_for_patient()
RETURNS TRIGGER AS $$
DECLARE
  v_user_exists BOOLEAN;
  v_profile_exists BOOLEAN;
  v_email TEXT;
  v_phone_digits TEXT;
  v_temp_pwd TEXT;
  v_pwd_hash TEXT;
BEGIN
  -- Sanitizar e-mail de trabalho (remover espaços e colocar em caixa baixa)
  v_email := TRIM(BOTH FROM LOWER(COALESCE(NEW.email, '')));
  
  -- Fallback se o paciente for cadastrado sem e-mail
  IF v_email = '' THEN
    v_email := 'paciente_' || NEW.id || '@tzion.temp';
  END IF;

  -- Validação de Segurança: Bloquear e-mails duplicados em outras contas
  IF EXISTS (
    SELECT 1 FROM auth.users WHERE email = LOWER(v_email) AND id <> NEW.id
  ) THEN
    RAISE EXCEPTION 'O e-mail % já está cadastrado para outro usuário no sistema.', v_email;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles WHERE email = LOWER(v_email) AND id <> NEW.id
  ) THEN
    RAISE EXCEPTION 'O e-mail % já está em uso em outro perfil.', v_email;
  END IF;

  -- A. Verificar se o usuário já existe na auth.users (por ID ou e-mail)
  SELECT EXISTS (
    SELECT 1 FROM auth.users WHERE id = NEW.id OR email = LOWER(v_email)
  ) INTO v_user_exists;

  -- Se o usuário não existir no Auth, criamos
  IF NOT v_user_exists THEN
    -- Gerar senha temporária baseada no telefone do paciente
    v_phone_digits := regexp_replace(NEW.phone, '\D', '', 'g');
    IF length(v_phone_digits) >= 4 THEN
      v_temp_pwd := 'Tzion@' || right(v_phone_digits, 4);
    ELSE
      v_temp_pwd := 'Tzion@123';
    END IF;

    -- Gerar hash da senha utilizando a extensão pgcrypto
    v_pwd_hash := extensions.crypt(v_temp_pwd, extensions.gen_salt('bf'));

    -- Inserir o novo usuário no esquema auth
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      phone,
      phone_confirmed_at
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      NEW.id,
      'authenticated',
      'authenticated',
      LOWER(v_email),
      v_pwd_hash,
      NOW(),
      NOW(),
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      jsonb_build_object('name', NEW.name, 'role', 'paciente', 'phone', NEW.phone),
      NOW(),
      NOW(),
      NEW.phone,
      CASE WHEN NEW.phone IS NOT NULL AND NEW.phone <> '' THEN NOW() ELSE NULL END
    );
  ELSE
    -- Se for um UPDATE e o email/telefone mudou, sincronizamos na auth.users
    IF TG_OP = 'UPDATE' THEN
      IF (OLD.email IS DISTINCT FROM NEW.email OR OLD.phone IS DISTINCT FROM NEW.phone) THEN
        UPDATE auth.users
        SET email = LOWER(v_email),
            phone = NEW.phone,
            raw_user_meta_data = raw_user_meta_data || jsonb_build_object('name', NEW.name, 'phone', NEW.phone),
            updated_at = NOW()
        WHERE id = NEW.id;
      END IF;
    END IF;
  END IF;

  -- B. Verificar se o perfil correspondente existe na public.profiles
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = NEW.id
  ) INTO v_profile_exists;

  -- Se o perfil não existir, criamos
  IF NOT v_profile_exists THEN
    INSERT INTO public.profiles (
      id,
      name,
      email,
      role,
      phone,
      status,
      updated_at
    ) VALUES (
      NEW.id,
      NEW.name,
      LOWER(v_email),
      'paciente',
      NEW.phone,
      'temp_password',
      NOW()
    );
  ELSE
    -- Se o perfil já existe e houve atualização nos dados básicos, mantemos sincronizado
    IF TG_OP = 'UPDATE' THEN
      IF (OLD.email IS DISTINCT FROM NEW.email OR OLD.name IS DISTINCT FROM NEW.name OR OLD.phone IS DISTINCT FROM NEW.phone) THEN
        UPDATE public.profiles
        SET email = LOWER(v_email),
            name = NEW.name,
            phone = NEW.phone,
            updated_at = NOW()
        WHERE id = NEW.id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog, pg_temp;

-- Recriar o trigger de criação/atualização
DROP TRIGGER IF EXISTS trigger_auto_create_user_for_patient ON public.patients;
CREATE TRIGGER trigger_auto_create_user_for_patient
AFTER INSERT OR UPDATE ON public.patients
FOR EACH ROW
EXECUTE FUNCTION public.trg_auto_create_user_for_patient();


-- ──────────────────────────────────────────────────────────────
-- 2. FUNÇÃO E TRIGGER DE DELEÇÃO (DELETE CASCADE SEGURO)
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.trg_auto_delete_user_for_patient()
RETURNS TRIGGER AS $$
BEGIN
  -- Deleta o usuário do auth.users se a conta excluída for de paciente
  -- A exclusão no auth.users automaticamente removerá o public.profiles via constraint CASCADE
  IF EXISTS (
    SELECT 1 FROM public.profiles WHERE id = OLD.id AND role = 'paciente'
  ) THEN
    DELETE FROM auth.users WHERE id = OLD.id;
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog, pg_temp;

-- Recriar o trigger de exclusão
DROP TRIGGER IF EXISTS trigger_auto_delete_user_for_patient ON public.patients;
CREATE TRIGGER trigger_auto_delete_user_for_patient
AFTER DELETE ON public.patients
FOR EACH ROW
EXECUTE FUNCTION public.trg_auto_delete_user_for_patient();


-- ──────────────────────────────────────────────────────────────
-- 3. CRIAÇÃO DE ÍNDICES PARA ALTA PERFORMANCE E SEGURANÇA (RLS)
-- ──────────────────────────────────────────────────────────────

-- Otimizar políticas RLS e buscas por e-mail (case-insensitive)
CREATE INDEX IF NOT EXISTS idx_patients_email_lower ON public.patients (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_profiles_email_lower ON public.profiles (LOWER(email));

-- Otimizar login por WhatsApp e buscas por telefone
CREATE INDEX IF NOT EXISTS idx_patients_phone ON public.patients (phone);
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles (phone);
