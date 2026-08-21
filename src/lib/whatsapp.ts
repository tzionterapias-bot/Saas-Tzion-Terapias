import { supabase } from './supabase';

// Função para disparar mensagem real usando Evolution API
// Se estiver no modo dev/teste, podemos apenas simular no console.
const EVOLUTION_API_URL = '/api/whatsapp';
const EVOLUTION_INSTANCE = import.meta.env.VITE_EVOLUTION_INSTANCE_NAME;

export async function sendWhatsAppMessage(
  patientId: string | null, 
  phone: string, 
  message: string, 
  triggerEvent: string,
  mediaAttachment?: { base64: string, mimeType: string, fileName: string }
) {
  try {
    let instanceName = import.meta.env.VITE_EVOLUTION_INSTANCE_NAME || 'tzion';
    let dashboardWebhookUrl = import.meta.env.VITE_N8N_DASHBOARD_WEBHOOK_URL || 'https://n8n2.agenciahigher.com.br/webhook/34ca7f6a-4bf7-4d37-9ea7-059eb36267d8';

    try {
      const { data: setts } = await supabase.from('settings').select('key, value').in('key', [
        'evolution_instance_name',
        'n8n_dashboard_webhook_url'
      ]);
      setts?.forEach(s => {
        if (s.key === 'evolution_instance_name' && s.value) instanceName = String(s.value);
        if (s.key === 'n8n_dashboard_webhook_url' && s.value) dashboardWebhookUrl = String(s.value);
      });
    } catch (_) {}

    const isProduction = true;
    let status = 'failed';

    if (isProduction && phone) {
      const phoneStr = String(phone);
      let cleanPhone = phoneStr.replace(/\D/g, '');
      if (cleanPhone.startsWith('0')) {
        cleanPhone = cleanPhone.replace(/^0+/, '');
      }
      const waNumber = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;

      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token || '';

        // Mídia: envia direto pela Evolution API via Proxy
        if (mediaAttachment) {
          console.log('[WHATSAPP] Enviando mídia direto pela Evolution API via Proxy...');
          const endpoint = `${EVOLUTION_API_URL}/sendMedia/${instanceName}`;
          let mediaType = 'document';
          if (mediaAttachment.mimeType.startsWith('image/')) mediaType = 'image';
          if (mediaAttachment.mimeType.startsWith('video/')) mediaType = 'video';
          if (mediaAttachment.mimeType.startsWith('audio/')) mediaType = 'audio';

          const body = {
            number: waNumber,
            options: { delay: 1200, presence: 'composing' },
            mediatype: mediaType,
            mimetype: mediaAttachment.mimeType,
            caption: message,
            media: mediaAttachment.base64.split(',')[1] || mediaAttachment.base64,
            fileName: mediaAttachment.fileName || 'arquivo'
          };

          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(body)
          });

          if (response.ok) {
            status = 'sent';
          } else {
            console.error('Falha no envio de mídia via Proxy:', await response.text());
          }
        } else {
          // Texto: 1ª tentativa via Webhook do n8n
          let sentOk = false;
          if (dashboardWebhookUrl) {
            try {
              let response = await fetch('/api/n8n-proxy', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                  webhookUrl: dashboardWebhookUrl,
                  payload: {
                    phone: waNumber,
                    message: message
                  }
                })
              });

              if (!response.ok) {
                response = await fetch(dashboardWebhookUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    phone: waNumber,
                    message: message
                  })
                });
              }

              if (response.ok) {
                sentOk = true;
                status = 'sent';
              }
            } catch (n8nErr) {
              console.warn('[WHATSAPP] n8n falhou, acionando fallback direto Evolution API...', n8nErr);
            }
          }

          // Fallback DIRETO: Envia direto pela Evolution API via Proxy (/api/whatsapp/sendText/:instanceName)
          if (!sentOk) {
            console.log('[WHATSAPP] Enviando texto direto pela Evolution API via Proxy...');
            try {
              let directRes = await fetch(`${EVOLUTION_API_URL}/sendText/${instanceName}`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                  number: waNumber,
                  text: message,
                  options: { delay: 1200, presence: 'composing', linkPreview: false }
                })
              });

              // Se a instância principal falhar e houver outra conectada (ex: lumina_igrejalumina), tenta fallback de instância
              if (!directRes.ok && instanceName === 'tzion') {
                directRes = await fetch(`${EVOLUTION_API_URL}/sendText/lumina_igrejalumina`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                  },
                  body: JSON.stringify({
                    number: waNumber,
                    text: message,
                    options: { delay: 1200, presence: 'composing', linkPreview: false }
                  })
                });
              }

              if (directRes.ok) {
                status = 'sent';
              } else {
                console.error('Falha no envio direto via Evolution API:', await directRes.text());
              }
            } catch (directErr) {
              console.error('Erro no envio direto Evolution API:', directErr);
            }
          }
        }
      } catch (err) {
        console.error('Erro de rede ao chamar a API de WhatsApp:', err);
      }
    } else {
      console.log(`[TESTE SEGURO] Para: ${phone} | Msg: ${message} | Anexo: ${mediaAttachment ? 'Sim' : 'Não'}`);
      status = 'test_sent';
    }

    await supabase.from('communications_log').insert([{
      patient_id: patientId,
      type: 'whatsapp',
      trigger_event: triggerEvent,
      status: status,
      recipient_phone: phone,
      content: mediaAttachment ? `[Anexo Enviado] ${message}` : message
    }]);

    return status === 'sent' || status === 'test_sent';
  } catch (error) {
    console.error('Erro geral no disparador:', error);
    return false;
  }
}
