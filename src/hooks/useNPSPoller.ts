import { useEffect } from 'react';
import { supabase } from '@/src/lib/supabase';

export function useNPSPoller() {
  useEffect(() => {
    // Roda a cada 1 minuto (60000 ms)
    const intervalId = setInterval(async () => {
      try {
        // Busca as configurações de NPS
        const { data: setts } = await supabase.from('settings').select('value').eq('key', 'nps_settings').maybeSingle();
        const npsSettings = setts?.value;
        if (!npsSettings) return;

        const delayMinutes = npsSettings.delay_minutes || 30;
        const messageTemplate = npsSettings.message;

        // Calcula a data limite. Se a sessão foi finalizada ANTES desse horário, já pode mandar.
        const cutoffTime = new Date(Date.now() - delayMinutes * 60 * 1000).toISOString();

        // Busca sessões completadas que AINDA NÃO tiveram NPS enviado e já passaram do tempo de delay
        const { data: pendingAppointments } = await supabase
          .from('appointments')
          .select('id, patient_id, therapist_id, completed_at, patients(name, phone)')
          .eq('status', 'completed')
          .eq('nps_sent', false)
          .lte('completed_at', cutoffTime);

        if (pendingAppointments && pendingAppointments.length > 0) {
          const { sendWhatsAppMessage } = await import('@/src/lib/whatsapp');

          for (const app of pendingAppointments) {
            const patientData = app.patients as any;
            if (patientData && patientData.phone) {
              const firstName = patientData.name.split(' ')[0];
              
              // Opcionalmente substituir variáveis no template
              const baseUrl = window.location.origin;
              const npsLink = `${baseUrl}/avaliacao/${app.id}`;
              let finalMessage = messageTemplate.replace('{{nome}}', firstName);
              finalMessage += `\n\nAcesse o link para avaliar: ${npsLink}`;

              try {
                await sendWhatsAppMessage(app.patient_id, patientData.phone, finalMessage, 'nps_survey');
                // Marca como enviado
                await supabase.from('appointments').update({ nps_sent: true }).eq('id', app.id);
                console.log(`NPS enviado com sucesso para ${patientData.name}`);
              } catch (e) {
                console.error(`Erro ao enviar NPS para ${patientData.name}:`, e);
              }
            } else {
              // Se não tem telefone, marca como enviado para não travar na fila
              await supabase.from('appointments').update({ nps_sent: true }).eq('id', app.id);
            }
          }
        }
      } catch (e) {
        console.error('Erro no polling do NPS:', e);
      }
    }, 60000); // 1 minuto

    return () => clearInterval(intervalId);
  }, []);
}
