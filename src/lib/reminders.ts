import { supabase } from './supabase';
import { sendWhatsAppMessage } from './whatsapp';

export async function processDailyReminders() {
  // Verifica se os lembretes já foram processados hoje para não repetir o envio
  const lastRun = localStorage.getItem('last_reminder_run');
  const today = new Date().toDateString();
  
  if (lastRun === today) {
    return; // Já rodou hoje
  }

  try {
    // Buscar agendamentos para o dia seguinte
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const startOfTomorrow = tomorrow.toISOString();

    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 1);
    const startOfDayAfter = dayAfter.toISOString();

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

    if (appointments && appointments.length > 0) {
      for (const app of appointments) {
        const time = new Date(app.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        // Lembrete para o Paciente
        if (app.patients?.phone) {
          const msgPatient = `Olá, ${app.patients.name}! 🌟 Passando para lembrar do seu agendamento AMANHÃ às ${time} com ${app.therapists?.name || 'seu terapeuta'}. Modalidade: ${app.type || 'Presencial'}. Confirma sua presença? Responda com SIM ou NÃO.`;
          await sendWhatsAppMessage(app.patient_id, app.patients.phone, msgPatient, 'appointment_reminder');
        }

        // Lembrete para o Terapeuta
        if (app.therapists?.phone) {
          const msgTherapist = `Olá, ${app.therapists.name}! 📅 Lembrete de Agenda: Você tem uma sessão AMANHÃ às ${time} com o paciente ${app.patients?.name}. Modalidade: ${app.type || 'Presencial'}. Prepare-se!`;
          await sendWhatsAppMessage(null, app.therapists.phone, msgTherapist, 'appointment_reminder_therapist');
        }
      }
    }

    // Marca que os lembretes de hoje já foram disparados com sucesso
    localStorage.setItem('last_reminder_run', today);
    console.log(`Lembretes processados com sucesso. ${appointments?.length || 0} agendamentos encontrados.`);
  } catch (err) {
    console.error('Erro no processamento dos lembretes diários:', err);
  }
}

export async function processDailyBirthdays() {
  const lastBdayRun = localStorage.getItem('last_birthday_run');
  const today = new Date().toDateString();
  
  if (lastBdayRun === today) {
    return; // Já rodou hoje
  }

  try {
    const { data: setts } = await supabase.from('settings').select('value').eq('key', 'notifications').maybeSingle();
    const config = setts?.value || { 
      birthdayReminder: true, 
      birthdayMessage: 'Olá, {{nome}}! 🎂✨\nA equipe da Tzion Terapias deseja um feliz aniversário! Que este novo ano seja repleto de evolução, paz e conquistas. Parabéns!' 
    };

    if (config.birthdayReminder === false) {
      localStorage.setItem('last_birthday_run', today);
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
    const [, currentMonth, currentDay] = todayBRT.split('-').map(Number);

    if (patients && patients.length > 0) {
      for (const p of patients) {
        if (!p.birth_date) continue;
        const [, birthMonth, birthDay] = p.birth_date.split('-').map(Number);
        
        if (birthMonth === currentMonth && birthDay === currentDay) {
          if (p.phone) {
            const msg = (config.birthdayMessage || 'Olá, {{nome}}! 🎂✨\nA equipe da Tzion Terapias deseja um feliz aniversário! Que este novo ano seja repleto de evolução, paz e conquistas. Parabéns!').replace(/\{\{nome\}\}/g, p.name || 'Paciente');
            await sendWhatsAppMessage(p.id, p.phone, msg, 'birthday_wishes');
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

