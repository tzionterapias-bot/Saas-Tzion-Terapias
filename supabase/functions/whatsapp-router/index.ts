import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json();
    const { event, data } = body;

    // Ignorar eventos que não sejam de mensagens recebidas
    if (event !== "messages.upsert") {
      return new Response(JSON.stringify({ status: "ignored event" }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // Ignorar mensagens enviadas por nós mesmos
    if (data.key.fromMe) {
      return new Response(JSON.stringify({ status: "ignored self message" }));
    }

    const remoteJid = data.key.remoteJid;
    const customerPhone = remoteJid.split("@")[0];
    const customerName = data.pushName || "Cliente";
    
    // Extrair texto da mensagem (suporta texto direto ou legenda de mídia)
    const message = data.message;
    const text = message?.conversation || 
                 message?.extendedTextMessage?.text || 
                 message?.imageMessage?.caption || 
                 message?.videoMessage?.caption || "";

    console.log(`Mensagem recebida de ${customerPhone}: ${text}`);

    // --- APPOINTMENT CONFIRMATION/CANCELLATION DETECTOR ---
    const normalizedText = text.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const isConfirm = ['sim', 'confirmar', 'confirmo', 'confirmado', 'ok', 'vou', 'vou sim', 'quero', 'positivo'].some(
      kw => normalizedText === kw || normalizedText.startsWith(kw + ' ') || normalizedText.endsWith(' ' + kw)
    );
    const isCancel = ['nao', 'cancelar', 'cancela', 'desmarcar', 'nao vou', 'nao posso', 'reagendar', 'negativo'].some(
      kw => normalizedText === kw || normalizedText.startsWith(kw + ' ') || normalizedText.endsWith(' ' + kw)
    );

    if (isConfirm || isCancel) {
      console.log(`[CONFIRM/CANCEL] Incoming word "${text}" from ${customerPhone}. Checking active appointments...`);
      
      const cleanIncoming = customerPhone.replace(/\D/g, '');
      const searchPhone = cleanIncoming.startsWith('55') && (cleanIncoming.length === 12 || cleanIncoming.length === 13)
        ? cleanIncoming.substring(2)
        : cleanIncoming;

      const { data: matchingPatients } = await supabase
        .from('patients')
        .select('id, name, phone')
        .eq('status', 'Ativo');

      const patient = matchingPatients?.find((p: any) => {
        const cleanDb = (p.phone || '').replace(/\D/g, '');
        const dbPhoneNoCountry = cleanDb.startsWith('55') ? cleanDb.substring(2) : cleanDb;
        return dbPhoneNoCountry === searchPhone;
      });

      if (patient) {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        const endOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2).toISOString();

        const { data: appointments } = await supabase
          .from('appointments')
          .select('*, therapists(name, phone)')
          .eq('patient_id', patient.id)
          .eq('status', 'scheduled')
          .gte('start_time', startOfToday)
          .lte('start_time', endOfTomorrow)
          .order('start_time', { ascending: true });

        if (appointments && appointments.length > 0) {
          const appointment = appointments[0];
          const time = new Date(appointment.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
          const dateStr = new Date(appointment.start_time).toLocaleDateString('pt-BR');
          
          if (isConfirm) {
            await supabase
              .from('appointments')
              .update({ status: 'confirmed' })
              .eq('id', appointment.id);

            console.log(`[CONFIRM] Appointment ${appointment.id} marked as confirmed.`);

            const msgPatient = `Que ótimo, ${patient.name}! 🌟 Seu agendamento para o dia ${dateStr} às ${time} com o(a) terapeuta ${appointment.therapists?.name || 'seu terapeuta'} está *confirmado*! Te aguardamos. 💚`;
            await sendMessage(remoteJid, msgPatient);

            if (appointment.therapists?.phone) {
              const therapistJid = formatToRemoteJid(appointment.therapists.phone);
              const msgTherapist = `Olá, ${appointment.therapists.name}! 📅 O(A) paciente *${patient.name}* confirmou presença para a sessão de ${dateStr} às ${time}.`;
              await sendMessage(therapistJid, msgTherapist);
            }

            return new Response(JSON.stringify({ status: "appointment_confirmed" }), { headers: corsHeaders });
          } else {
            await supabase
              .from('appointments')
              .update({ status: 'cancelled' })
              .eq('id', appointment.id);

            console.log(`[CANCEL] Appointment ${appointment.id} marked as cancelled.`);

            const msgPatient = `Entendido, ${patient.name}. 🗓️ Seu agendamento para o dia ${dateStr} às ${time} foi *cancelado* no sistema. Se precisar reagendar, entre em contato com a nossa recepção.`;
            await sendMessage(remoteJid, msgPatient);

            if (appointment.therapists?.phone) {
              const therapistJid = formatToRemoteJid(appointment.therapists.phone);
              const msgTherapist = `Atenção, ${appointment.therapists.name}: ⚠️ O(A) paciente *${patient.name}* cancelou a presença para a sessão de ${dateStr} às ${time}. A vaga foi liberada no sistema.`;
              await sendMessage(therapistJid, msgTherapist);
            }

            return new Response(JSON.stringify({ status: "appointment_cancelled" }), { headers: corsHeaders });
          }
        }
      }
    }

    // 1. Buscar ticket aberto para este cliente
    const { data: ticket, error: ticketError } = await supabase
      .from("service_tickets")
      .select("*")
      .eq("customer_phone", customerPhone)
      .neq("status", "closed")
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // 2. Se não houver ticket, iniciar triagem
    if (!ticket) {
      const { data: newTicket } = await supabase
        .from("service_tickets")
        .insert({
          customer_phone: customerPhone,
          customer_name: customerName,
          status: "open",
          metadata: { waiting_triagem: true }
        })
        .select()
        .single();

      // Buscar departamentos ativos para montar o menu dinamicamente
      const { data: depts } = await supabase.from("departments").select("name").order('created_at', { ascending: true });
      let menuText = `Olá ${customerName}! Bem-vindo à Tzion Terapias. 🌿\n\nComo podemos te ajudar hoje? Digite o número da opção:\n`;
      if (depts && depts.length > 0) {
        depts.forEach((d, i) => {
          menuText += `\n${i + 1}. *${d.name}*`;
        });
      } else {
        menuText += `\n1. *Atendimento Geral*`; // Fallback caso não haja
      }

      await sendMessage(remoteJid, menuText);
      return new Response(JSON.stringify({ status: "menu_sent" }));
    }

    // 3. Se estiver aguardando escolha de departamento (Triagem)
    if (ticket.metadata?.waiting_triagem) {
      const optionIndex = parseInt(text.trim()) - 1;
      
      const { data: depts } = await supabase.from("departments").select("id, name").order('created_at', { ascending: true });
      
      if (depts && depts.length > 0 && optionIndex >= 0 && optionIndex < depts.length) {
        const selectedDept = depts[optionIndex];
        
        await supabase
          .from("service_tickets")
          .update({ 
            department_id: selectedDept.id,
            metadata: { waiting_triagem: false }
          })
          .eq("id", ticket.id);

        await sendMessage(remoteJid, `Ótimo! Encaminhei você para a equipe de *${selectedDept.name}*. Por favor, aguarde um momento que já vamos te atender.`);
        return new Response(JSON.stringify({ status: "routed" }));
      } else {
        // Se a opção for inválida, repetir o menu dinâmico
        let retryMenu = "Opção inválida. Por favor, digite apenas o número:\n";
        if (depts && depts.length > 0) {
          depts.forEach((d, i) => {
            retryMenu += `\n${i + 1}. *${d.name}*`;
          });
        }
        await sendMessage(remoteJid, retryMenu);
        return new Response(JSON.stringify({ status: "invalid_option" }));
      }
    }

    // 4. Se já tiver departamento atribuído, salvar a mensagem no histórico
    await supabase.from("chat_messages").insert({
      ticket_id: ticket.id,
      sender_type: "customer",
      sender_id: customerPhone,
      content: text,
      evolution_msg_id: data.key.id
    });

    return new Response(JSON.stringify({ status: "message_saved" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err) {
    console.error("Erro na Edge Function:", err);
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});

// Helper para enviar mensagens via Evolution API
async function sendMessage(remoteJid: string, text: string) {
  const apiUrl = Deno.env.get("EVOLUTION_API_URL");
  const instance = Deno.env.get("EVOLUTION_INSTANCE_NAME");
  const apiKey = Deno.env.get("EVOLUTION_API_KEY");

  if (!apiUrl || !instance || !apiKey) {
    console.error("Configurações da Evolution API faltando!");
    return;
  }

  const url = `${apiUrl}/message/sendText/${instance}`;
  
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": apiKey
      },
      body: JSON.stringify({
        number: remoteJid,
        text: text,
        linkPreview: false
      })
    });
    return await res.json();
  } catch (e) {
    console.error("Erro ao enviar mensagem:", e);
  }
}

function formatToRemoteJid(phone: string) {
  const clean = phone.replace(/\D/g, '');
  const number = clean.startsWith('55') ? clean : `55${clean}`;
  return `${number}@s.whatsapp.net`;
}

