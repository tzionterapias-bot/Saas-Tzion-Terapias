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
    const n8nWebhookUrl = import.meta.env.VITE_N8N_WEBHOOK_URL;
    const isProduction = !!n8nWebhookUrl || !!import.meta.env.VITE_EVOLUTION_API_URL;
    let status = 'failed';

    if (isProduction && phone) {
      const phoneStr = String(phone);
      const cleanPhone = phoneStr.replace(/\D/g, '');
      const waNumber = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;

      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token || '';

        // Se tiver anexo ou não tiver n8n, envia direto pela Evolution API via Proxy
        if (mediaAttachment || !n8nWebhookUrl) {
          console.log('[WHATSAPP] Enviando direto pela Evolution API via Proxy...');
          let endpoint = `${EVOLUTION_API_URL}/sendText/${EVOLUTION_INSTANCE}`;
          let body: any = {
            number: waNumber,
            text: message,
            options: { delay: 1200, presence: 'composing' }
          };

          if (mediaAttachment) {
            endpoint = `${EVOLUTION_API_URL}/sendMedia/${EVOLUTION_INSTANCE}`;
            let mediaType = 'document';
            if (mediaAttachment.mimeType.startsWith('image/')) mediaType = 'image';
            if (mediaAttachment.mimeType.startsWith('video/')) mediaType = 'video';
            if (mediaAttachment.mimeType.startsWith('audio/')) mediaType = 'audio';

            body = {
              number: waNumber,
              options: { delay: 1200, presence: 'composing' },
              mediatype: mediaType,
              mimetype: mediaAttachment.mimeType,
              caption: message,
              media: mediaAttachment.base64.split(',')[1] || mediaAttachment.base64,
              fileName: mediaAttachment.fileName || 'arquivo'
            };
          }

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
            console.error('Falha no envio via Proxy de WhatsApp:', await response.text());
          }
        } else {
          // --- FLUXO N8N WEBHOOK Apenas para texto ---
          console.log('[WHATSAPP] Enviando via Proxy Webhook n8n...');
          const response = await fetch('/api/n8n-proxy', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              webhookUrl: n8nWebhookUrl,
              payload: {
                phone: waNumber,
                message: message
              }
            })
          });

          if (response.ok) {
            status = 'sent';
          } else {
            console.error('Falha no envio via Proxy de Webhook n8n:', await response.text());
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
      content: mediaAttachment ? `[Anexo Enviado] ${message}` : message
    }]);

    return status === 'sent' || status === 'test_sent';
  } catch (error) {
    console.error('Erro geral no disparador:', error);
    return false;
  }
}
