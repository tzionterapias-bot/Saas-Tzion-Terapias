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
          const endpoint = `${EVOLUTION_API_URL}/sendMedia/${EVOLUTION_INSTANCE}`;
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
          // Texto: envia via nó ATENDIMENTO DASHBOARD do n8n (que chama a Evolution API internamente)
          const dashboardWebhookUrl = import.meta.env.VITE_N8N_DASHBOARD_WEBHOOK_URL || n8nWebhookUrl;
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

          if (!response.ok && dashboardWebhookUrl) {
            console.warn('[WHATSAPP] Proxy retornou erro, tentando envio direto ao webhook n8n...');
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
            status = 'sent';
          } else {
            console.error('Falha no envio via Webhook n8n Dashboard:', await response.text());
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
