-- Adiciona a coluna google_event_id na tabela de appointments para permitir o sincronismo bidirecional
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS google_event_id TEXT;
