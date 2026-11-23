import { supabase } from './supabase';
import { sendWhatsAppMessage } from './whatsapp';

export async function processDailyReminders() {
  const today = new Date().toDateString();

  try {
    const { data: setts } = await supabase.from('settings').select('value').eq('key', 'notifications').maybeSingle();
    const config = setts?.value || {};
    
    // Se estiver desativado nas configurações globais, aborta imediatamente
    if (config.sessionReminders === false) {
      return;
    }

    // Buscar agendamentos para o dia seguinte considerando o fuso horário de Brasília (America/Sao_Paulo)
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    // Obtém a data de amanhã em Brasília
    const tomorrowDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const tomorrowStr = formatter.format(tomorrowDate);

    // Obtém o dia seguinte a amanhã em Brasília
    const dayAfterDate = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
    const dayAfterStr = formatter.format(dayAfterDate);

    // Meia-noite de amanhã e do dia seguinte em Brasília (UTC-3 -> 03:00 UTC)
    const startOfTomorrow = `${tomorrowStr}T03:00:00.000Z`;
    const startOfDayAfter = `${dayAfterStr}T03:00:00.000Z`;

    // Início de hoje em Brasília (para deduplicação estrita de envios)
    const todayBRT = formatter.format(now);
    const startOfTodayUTC = `${todayBRT}T03:00:00.000Z`;

    const { data: appointments, error } = await supabase
      .from('appointments')
      .select('*, patients(phone, name), therapists(name, phone)')
      .gte('start_time', startOfTomorrow)
      .lt('start_time', startOfDayAfter)
      .eq('status', 'scheduled');

    if (error) {
      console.error('Erro ao buscar agendamentos para lembrete:', error);
      return;
    }

    const reminderTpl = config.sessionReminderMessage || 'Olá, {{nome}}! 🌟 Passando para lembrar do seu agendamento AMANHÃ às {{horario}} com {{terapeuta}}. Modalidade: {{modalidade}}. Confirma sua presença?';

    if (appointments && appointments.length > 0) {
      for (const app of appointments) {
        const time = new Date(app.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });

        // Lembrete para o Paciente (com verificação de deduplicação no banco)
        if (app.patients?.phone && app.patient_id) {
          const { data: existingPatientLog } = await supabase
            .from('communications_log')
            .select('id')
            .eq('patient_id', app.patient_id)
            .eq('trigger_event', 'appointment_reminder')
            .gte('created_at', startOfTodayUTC)
            .limit(1);

          if (!existingPatientLog || existingPatientLog.length === 0) {
            const msgPatient = reminderTpl
              .replace(/\{\{nome\}\}/g, app.patients.name || 'Paciente')
              .replace(/\{\{horario\}\}/g, time)
              .replace(/\{\{terapeuta\}\}/g, app.therapists?.name || 'seu terapeuta')
              .replace(/\{\{modalidade\}\}/g, app.type || 'Presencial');
              
            await sendWhatsAppMessage(app.patient_id, app.patients.phone, msgPatient, 'appointment_reminder');
          } else {
            console.log(`[LEMBRETE] Paciente ${app.patients.name} já recebeu lembrete hoje. Pulando.`);
          }
        }

        // Lembrete para o Terapeuta (com verificação de deduplicação no banco)
        if (app.therapists?.phone && app.patients?.name) {
          const { data: existingTherapistLog } = await supabase
            .from('communications_log')
            .select('id')
            .eq('trigger_event', 'appointment_reminder_therapist')
            .ilike('content', `%${app.patients.name}%`)
            .gte('created_at', startOfTodayUTC)
            .limit(1);

          if (!existingTherapistLog || existingTherapistLog.length === 0) {
            const msgTherapist = `Olá, ${app.therapists.name}! 📅 Lembrete de Agenda: Você tem uma sessão AMANHÃ às ${time} com o paciente ${app.patients.name}. Modalidade: ${app.type || 'Presencial'}. Prepare-se!`;
            await sendWhatsAppMessage(null, app.therapists.phone, msgTherapist, 'appointment_reminder_therapist');
          } else {
            console.log(`[LEMBRETE] Terapeuta ${app.therapists.name} já recebeu lembrete sobre o paciente ${app.patients.name} hoje. Pulando.`);
          }
        }
      }
    }

    localStorage.setItem('last_reminder_run', today);
    console.log(`Lembretes processados com sucesso. ${appointments?.length || 0} agendamentos verificados.`);
  } catch (err) {
    console.error('Erro no processamento dos lembretes diários:', err);
  }
}

export async function processDailyBirthdays() {
  const today = new Date().toDateString();

  try {
    const { data: setts } = await supabase.from('settings').select('value').eq('key', 'notifications').maybeSingle();
    const config = setts?.value || { 
      birthdayReminder: true, 
      birthdayMessage: 'Olá, {{nome}}! 🎂✨\nA equipe da Tzion Terapias deseja um feliz aniversário! Que este novo ano seja repleto de evolução, paz e conquistas. Parabéns!' 
    };

    if (config.birthdayReminder === false) {
      return;
    }

    const { data: patients, error } = await supabase
      .from('patients')
      .select('id, name, phone, birth_date')
      .eq('status', 'Ativo')
      .not('birth_date', 'is', null);

    if (error) {
      console.error('Erro ao buscar aniversariantes:', error);
      return;
    }

    const todayBRT = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(new Date());
    const startOfTodayUTC = `${todayBRT}T03:00:00.000Z`;
    const [, currentMonth, currentDay] = todayBRT.split('-').map(Number);

    if (patients && patients.length > 0) {
      for (const p of patients) {
        if (!p.birth_date) continue;
        const [, birthMonth, birthDay] = p.birth_date.split('-').map(Number);
        
        if (birthMonth === currentMonth && birthDay === currentDay) {
          if (p.phone) {
            // Deduplicação no banco: verifica se já enviou hoje
            const { data: existingBday } = await supabase
              .from('communications_log')
              .select('id')
              .eq('patient_id', p.id)
              .eq('trigger_event', 'birthday_wishes')
              .gte('created_at', startOfTodayUTC)
              .limit(1);

            if (!existingBday || existingBday.length === 0) {
              const msg = (config.birthdayMessage || 'Olá, {{nome}}! 🎂✨\nA equipe da Tzion Terapias deseja um feliz aniversário! Que este novo ano seja repleto de evolução, paz e conquistas. Parabéns!').replace(/\{\{nome\}\}/g, p.name || 'Paciente');
              await sendWhatsAppMessage(p.id, p.phone, msg, 'birthday_wishes');
            }
          }
        }
      }
    }

    localStorage.setItem('last_birthday_run', today);
    console.log('Felicitações de aniversário processadas.');
  } catch (err) {
    console.error('Erro ao processar aniversariantes:', err);
  }
}
