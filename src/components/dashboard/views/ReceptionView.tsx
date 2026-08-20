import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, Calendar, Clock, Target, Loader2, Phone, MessageSquare, Plus, ArrowRight, CheckCircle2, User, X,
  Calendar as CalendarIcon, Video, MapPin, Activity, Trash2, StickyNote
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/contexts/AuthContext';
import { playRoomReleasedChime, playCheckinChime } from '@/src/lib/soundAlerts';
import PatientNotesModal from '@/src/components/patient/PatientNotesModal';

export default function ReceptionView() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    todaySessions: 0,
    pendingLeads: 0,
    newMessages: 0
  });
  const [upcomingSessions, setUpcomingSessions] = useState<any[]>([]);
  const [recentLeads, setRecentLeads] = useState<any[]>([]);

  // Feedback State
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Reschedule State
  const [reschedulingAppt, setReschedulingAppt] = useState<any | null>(null);
  const [rescheduleData, setRescheduleData] = useState({ date: '', time: '' });
  const [rescheduleSlots, setRescheduleSlots] = useState<string[]>([]);
  const [rescheduleLoading, setRescheduleLoading] = useState(false);

  // Cancel / Delete State
  const [cancelConfirmationAppt, setCancelConfirmationAppt] = useState<any | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  // Notes Modal State
  const [notesPatient, setNotesPatient] = useState<{ id: string; name: string; phone?: string } | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchStats = async () => {
    try {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];

      // Execute queries in parallel for high performance
      const [todayApptsRes, leadsRes] = await Promise.all([
        supabase.from('appointments')
          .select('*, patients(name), therapists(name)')
          .gte('start_time', `${today}T00:00:00`)
          .lte('start_time', `${today}T23:59:59`)
          .neq('status', 'cancelled')
          .order('start_time', { ascending: true }),
        supabase.from('leads')
          .select('*')
          .neq('status', 'converted')
          .order('created_at', { ascending: false })
          .limit(5)
      ]);

      const todayAppts = todayApptsRes.data;
      const leads = leadsRes.data;

      setStats({
        todaySessions: todayAppts?.length || 0,
        pendingLeads: leads?.length || 0,
        newMessages: 14
      });

      setUpcomingSessions(todayAppts || []);
      setRecentLeads(leads || []);

    } catch (error) {
      console.error('Erro ao buscar estatísticas da recepção:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();

    const channel = supabase
      .channel('reception_view_appointments')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments' },
        (payload: any) => {
          if (payload.eventType === 'UPDATE' && payload.new?.status === 'calling' && payload.old?.status !== 'calling') {
            playRoomReleasedChime();
            showToast('🚪 Sala Liberada! O terapeuta chamou o próximo paciente.');
          }
          fetchStats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Calcula horários disponíveis no reagendamento
  useEffect(() => {
    const calculateSlots = async () => {
      if (rescheduleData.date && reschedulingAppt) {
         const allSlots = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];
         
         const { data: existingAppts } = await supabase.from('appointments')
           .select('id, start_time, end_time, therapist_id, status')
           .eq('therapist_id', reschedulingAppt.therapist_id)
           .gte('start_time', `${rescheduleData.date}T00:00:00`)
           .lte('start_time', `${rescheduleData.date}T23:59:59`)
           .neq('status', 'cancelled');

         const conflicts = (existingAppts || []).filter(a => a.id !== reschedulingAppt.id);
         
         const freeSlots = allSlots.filter(slot => {
             const slotStart = new Date(`${rescheduleData.date}T${slot}:00`);
             const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000);
             
             const isToday = rescheduleData.date === new Date().toISOString().split('T')[0];
             if (isToday && slotStart < new Date()) {
                 return false;
             }
             
             const hasOverlap = conflicts.some(a => {
                 const aStart = new Date(a.start_time);
                 const aEnd = a.end_time ? new Date(a.end_time) : new Date(aStart.getTime() + 60 * 60 * 1000);
                 return aStart < slotEnd && aEnd > slotStart;
             });
             
             return !hasOverlap;
         });
         
         setRescheduleSlots(freeSlots);
      }
    };
    calculateSlots();
  }, [rescheduleData.date, reschedulingAppt]);

  // Check-in (Confirmar Presença)
  const handleCheckin = async (event: any) => {
    try {
        const { error } = await supabase.from('appointments').update({
            status: 'arrived'
        }).eq('id', event.id);
        
        if (error) throw error;
        
        try {
            const { data: therapistData } = await supabase
                .from('therapists')
                .select('name, phone')
                .eq('id', event.therapist_id)
                .maybeSingle();

            if (therapistData && therapistData.phone) {
                const { sendWhatsAppMessage } = await import('@/src/lib/whatsapp');
                const time = new Date(event.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
                const patientName = event.patients?.name || event.patient_name || 'Paciente';
                const msg = `Olá, *${therapistData.name.split(' ')[0]}*! 🔔\n\nSeu paciente *${patientName}* acabou de realizar o check-in na recepção para a sessão das ${time}. Ele(a) já está te aguardando!`;
                await sendWhatsAppMessage(null, therapistData.phone, msg, 'patient_arrived_therapist');
            }
        } catch (notifyError) {
            console.error('Erro ao enviar notificação de check-in:', notifyError);
        }
        
        playCheckinChime();
        showToast('Check-in realizado com sucesso! Terapeuta notificado.');
        fetchStats(); 
    } catch(e: any) {
        console.error(e);
        showToast('Erro no check-in: ' + e.message);
    }
  };

  // Enviar Lembrete por WhatsApp
  const handleSendReminder = async (event: any) => {
    try {
       const patientName = event.patients?.name || event.patient_name || 'Paciente';
       const { data: patientData } = await supabase.from('patients').select('phone').eq('id', event.patient_id).single();
       if (!patientData?.phone) {
           alert('Paciente não possui telefone cadastrado.');
           return;
       }

       let localAddress = 'Nosso consultório está prontinho para te receber.';
       try {
           const { data: clinicProfileSett } = await supabase
               .from('settings')
               .select('value')
               .eq('key', 'clinic_profile')
               .maybeSingle();
           if (clinicProfileSett?.value?.address && clinicProfileSett.value.address.trim() !== '') {
               localAddress = clinicProfileSett.value.address.trim();
           }
       } catch (err) {
           console.error("Erro ao buscar endereço da clínica:", err);
       }

       const { sendWhatsAppMessage } = await import('@/src/lib/whatsapp');
       const horaFormatada = new Date(event.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });

       const firstName = patientName.split(' ')[0];
       let mensagem = `Olá, *${firstName}*! ✨\n\nPassando aqui para lembrar da sua sessão na *Clínica Tzion Terapias* marcada para hoje!\n\n`;
       mensagem += `⏰ *Horário:* ${horaFormatada}\n`;
       mensagem += `📍 *Modalidade:* ${event.type}\n\n`;

       if (event.type === 'Online') {
           if (event.meet_link) {
               mensagem += `💻 *Link de Acesso à Sessão:*\n🔗 ${event.meet_link}\n\n`;
           } else {
               mensagem += `💻 *Sessão Online:*\nO link do Google Meet será gerado e enviado logo antes da sessão iniciar. Fique de olho!\n\n`;
           }
       } else {
           mensagem += `📍 *Local Presencial:*\n${localAddress}\n\n`;
       }
       mensagem += `Um abraço e até mais tarde! 💙`;
       
       await sendWhatsAppMessage(event.patient_id, patientData.phone, mensagem, 'appointment_reminder');
       showToast('Lembrete enviado com sucesso via WhatsApp!');
    } catch (e: any) {
       console.error(e);
       showToast('Erro ao enviar lembrete: ' + e.message);
    }
  };

  // Modal Reagendar
  const handleOpenRescheduleModal = (app: any) => {
     setReschedulingAppt(app);
     const initialDate = app.start_time ? app.start_time.split('T')[0] : new Date().toISOString().split('T')[0];
     setRescheduleData({
        date: initialDate,
        time: '',
        type: app.type || 'Presencial'
     } as any);
  };

  const handleRescheduleAppointment = async () => {
    if (!reschedulingAppt || !rescheduleData.date || !rescheduleData.time) return;

    try {
      setRescheduleLoading(true);

      const tzo = -new Date().getTimezoneOffset();
      const dif = tzo >= 0 ? '+' : '-';
      const pad = (num: number) => (Math.floor(Math.abs(num)) < 10 ? '0' : '') + Math.floor(Math.abs(num));
      const tzOffset = dif + pad(tzo / 60) + ':' + pad(tzo % 60);

      const startTime = `${rescheduleData.date}T${rescheduleData.time}:00${tzOffset}`;
      const endTime = new Date(new Date(startTime).getTime() + 60 * 60 * 1000).toISOString();
      const finalType = (rescheduleData as any).type || reschedulingAppt.type || 'Presencial';

      const { error } = await supabase
        .from('appointments')
        .update({
          start_time: startTime,
          end_time: endTime,
          type: finalType,
          status: 'scheduled'
        })
        .eq('id', reschedulingAppt.id);

      if (error) throw error;

      // Buscar endereço no perfil da clínica para agendamento presencial
      let localAddress = 'Nosso consultório está de portas abertas para te receber.';
      try {
          const { data: clinicProfileSett } = await supabase
              .from('settings')
              .select('value')
              .eq('key', 'clinic_profile')
              .maybeSingle();
          if (clinicProfileSett?.value?.address && clinicProfileSett.value.address.trim() !== '') {
              localAddress = clinicProfileSett.value.address.trim();
          }
      } catch (err) {
          console.error("Erro ao buscar endereço da clínica:", err);
      }

      const patientName = reschedulingAppt.patients?.name || reschedulingAppt.patient_name || 'Paciente';
      const therapistName = reschedulingAppt.therapists?.name || reschedulingAppt.therapist_name || 'Terapeuta';

      const { data: patientData } = await supabase.from('patients').select('phone, name').eq('id', reschedulingAppt.patient_id).single();
      const { data: therapistData } = await supabase.from('therapists').select('phone, name').eq('id', reschedulingAppt.therapist_id).single();
      const dataFormatada = new Date(startTime).toLocaleDateString('pt-BR');
      const newTime = rescheduleData.time;

      // Dispara Webhook n8n
      try {
         const { data: settings } = await supabase.from('settings').select('value').eq('key', 'integrations').maybeSingle();
         const webhookUrl = settings?.value?.n8n_webhook_url;
         if (webhookUrl) {
            await fetch('/api/n8n-proxy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                   webhookUrl,
                   payload: {
                      event: 'appointment_rescheduled',
                      appointment_id: reschedulingAppt.id,
                      google_event_id: reschedulingAppt.google_event_id || null,
                      meet_link: reschedulingAppt.meet_link || null,
                      patient_name: patientName,
                      therapist_name: therapistName,
                      new_date_iso: rescheduleData.date,
                      new_date_br: dataFormatada,
                      new_time: rescheduleData.time,
                      type: finalType
                   }
                })
             });
         }
      } catch (e) {
         console.warn('Erro ao notificar reagendamento ao n8n:', e);
      }

      // Envia notificações via WhatsApp
      const { sendWhatsAppMessage } = await import('@/src/lib/whatsapp');
      if (patientData && patientData.phone) {
         const firstName = patientData.name.split(' ')[0];
         let msg = `Olá, *${firstName}*! ✨\n\nSua sessão na *Clínica Tzion Terapias* foi reagendada com sucesso!\n\n📅 *Nova Data:* ${dataFormatada}\n⏰ *Novo Horário:* ${newTime}\n📍 *Modalidade:* ${finalType}\n\n`;
         if (finalType === 'Online') {
            if (reschedulingAppt.meet_link) {
               msg += `💻 *Acesso à Sessão Online:*\n🔗 ${reschedulingAppt.meet_link}\n\n`;
            } else {
               msg += `💻 *Sessão Online:*\nO link seguro do Google Meet será gerado pelo seu terapeuta e enviado logo antes da sessão. Fique de olho!\n\n`;
            }
         } else {
            msg += `📍 *Local Presencial:*\n${localAddress}\n\n`;
         }
         msg += `Qualquer dúvida, estamos à disposição! 💙`;
         await sendWhatsAppMessage(reschedulingAppt.patient_id, patientData.phone, msg, 'appointment_rescheduled');
      }

      if (therapistData && therapistData.phone) {
         const firstNameT = therapistData.name.split(' ')[0];
         let msg = `Olá, *${firstNameT}*! 🔄\n\nA sessão do paciente *${patientData?.name || patientName}* foi reagendada.\n\n📅 *Novo horário:* ${dataFormatada} às ${newTime}\n📍 *Modalidade:* ${finalType}\n`;
         if (finalType === 'Online' && reschedulingAppt.meet_link) {
            msg += `\n🔗 *Link do Meet da Sessão:*\n${reschedulingAppt.meet_link}`;
         }
         await sendWhatsAppMessage(null, therapistData.phone, msg, 'appointment_rescheduled_therapist');
      }

      showToast('Sessão reagendada com sucesso!');
      setReschedulingAppt(null);
      fetchStats();
    } catch (e: any) {
      console.error(e);
      showToast('Erro ao reagendar sessão: ' + e.message);
    } finally {
      setRescheduleLoading(false);
    }
  };

  // Cancelar / Desmarcar / Remover Consulta
  const executeCancelAppointment = async (deletePermanently = false) => {
    if (!cancelConfirmationAppt) return;
    const event = cancelConfirmationAppt;

    try {
      setCancelLoading(true);
      const patientName = event.patients?.name || event.patient_name || 'Paciente';
      const therapistName = event.therapists?.name || event.therapist_name || 'Terapeuta';

      if (deletePermanently) {
        const { error } = await supabase
          .from('appointments')
          .delete()
          .eq('id', event.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('appointments')
          .update({ status: 'cancelled' })
          .eq('id', event.id);
        if (error) throw error;
      }

      // Notifica n8n
      try {
         const { data: settings } = await supabase.from('settings').select('value').eq('key', 'integrations').maybeSingle();
         const webhookUrl = settings?.value?.n8n_webhook_url;
         if (webhookUrl) {
            await fetch('/api/n8n-proxy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                   webhookUrl,
                   payload: {
                      event: 'appointment_cancelled',
                      appointment_id: event.id,
                      google_event_id: event.google_event_id || null,
                      patient_name: patientName,
                      therapist_name: therapistName
                   }
                })
             });
         }
      } catch (e) {
         console.warn('Erro ao notificar cancelamento ao n8n:', e);
      }

      // WhatsApp avisos
      const { data: patientData } = await supabase.from('patients').select('phone, name').eq('id', event.patient_id).single();
      const { data: therapistData } = await supabase.from('therapists').select('phone, name').eq('id', event.therapist_id).single();
      const dataFormatada = new Date(event.start_time).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
      const horaFormatada = new Date(event.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });

      const { sendWhatsAppMessage } = await import('@/src/lib/whatsapp');
      if (patientData && patientData.phone) {
         const firstName = patientData.name.split(' ')[0];
         let msg = `Olá, *${firstName}*! 👋\n\nConfirmamos o desmarquamento/cancelamento da sua sessão na *Clínica Tzion Terapias*.\n\n📅 *Data original:* ${dataFormatada} às ${horaFormatada}\n👤 *Terapeuta:* ${therapistName}\n\nSe precisar reagendar, estamos à disposição! 💙`;
         await sendWhatsAppMessage(event.patient_id, patientData.phone, msg, 'appointment_cancelled');
      }

      if (therapistData && therapistData.phone) {
         const firstNameT = therapistData.name.split(' ')[0];
         let msg = `Olá, *${firstNameT}*! ⚠️\n\nA sessão com o(a) paciente *${patientData?.name || patientName}* agendada para ${dataFormatada} às ${horaFormatada} foi *desmarcada/cancelada*.`;
         await sendWhatsAppMessage(null, therapistData.phone, msg, 'appointment_cancelled_therapist');
      }

      showToast(deletePermanently ? 'Consulta removida permanentemente!' : 'Sessão desmarcada com sucesso!');
      setCancelConfirmationAppt(null);
      fetchStats();
    } catch (e: any) {
      console.error(e);
      showToast('Erro ao desmarcar sessão: ' + e.message);
    } finally {
      setCancelLoading(false);
    }
  };

  if (loading) {
    return <div className="flex h-[80vh] items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-indigo-600" /></div>;
  }

  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight">Painel da Recepção</h2>
          <p className="text-slate-500 font-medium text-lg">Gerencie os agendamentos de hoje e novos contatos.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/admin/agenda?new=true')}
            className="px-5 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 flex items-center gap-2"
          >
            <Plus className="w-5 h-5" /> Novo Agendamento
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Sessões Hoje', value: stats.todaySessions, icon: Calendar, color: 'indigo', trend: 'Agenda' },
          { label: 'Leads Pendentes', value: stats.pendingLeads, icon: Target, color: 'rose', trend: 'CRM' },
          { label: 'Mensagens WhatsApp', value: stats.newMessages, icon: MessageSquare, color: 'emerald', trend: 'Ações Necessárias' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all group">
            <div className="flex justify-between items-start mb-6">
              <div className={cn(
                "w-14 h-14 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110",
                stat.color === 'indigo' ? "bg-indigo-50 text-indigo-600" :
                stat.color === 'emerald' ? "bg-emerald-50 text-emerald-600" :
                "bg-rose-50 text-rose-600"
              )}>
                <stat.icon className="w-7 h-7" />
              </div>
              <span className={cn(
                "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-slate-50 text-slate-500"
              )}>
                {stat.trend}
              </span>
            </div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
            <h3 className="text-3xl font-black text-slate-900">{stat.value}</h3>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Agenda do Dia */}
        <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-bold flex items-center gap-2">
                <Clock className="w-6 h-6 text-indigo-600" /> Próximas Sessões
            </h3>
            <button onClick={() => navigate('/admin/agenda')} className="text-xs font-bold text-indigo-600 hover:underline">Ver Agenda Completa</button>
          </div>
          <div className="space-y-4 flex-1">
            {upcomingSessions.map((session, i) => {
              const patientName = session.patients?.name || session.patient_name || 'Paciente';
              const therapistName = session.therapists?.name || session.therapist_name || 'Terapeuta';

              return (
                <div key={session.id || i} className="flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-slate-50/50 rounded-3xl border border-transparent hover:border-indigo-100 hover:bg-white transition-all group gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-white border border-slate-100 flex items-center justify-center font-bold text-slate-600 group-hover:text-indigo-600 transition-colors shadow-sm text-sm shrink-0">
                      {new Date(session.start_time).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{patientName}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">{session.type} • Com {therapistName}</p>
                      {session.status === 'arrived' && (
                        <span className="inline-block mt-1 text-[9px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">
                          Aguardando no Consultório
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 justify-end">
                    {/* Checkin / Status */}
                    {session.status === 'calling' ? (
                      <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl font-bold text-xs flex items-center gap-1.5 animate-pulse shadow-sm" title="Sala Liberada pelo Terapeuta!">
                        <CheckCircle2 className="w-4 h-4" /> Sala Liberada!
                      </div>
                    ) : session.status === 'arrived' ? (
                      <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl font-bold text-xs flex items-center gap-1">
                        <Clock className="w-4 h-4" /> Chegou
                      </div>
                    ) : session.status === 'completed' ? (
                      <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl font-bold text-xs flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> Atendido
                      </div>
                    ) : (
                      <button 
                        onClick={() => handleCheckin(session)} 
                        className="p-2.5 bg-white text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-xl shadow-sm border border-slate-100 transition-all" 
                        title="Fazer Check-in (Confirmar Presença)"
                      >
                        <User className="w-4.5 h-4.5" />
                      </button>
                    )}

                    {/* Anotações / Recados da Secretaria */}
                    <button 
                      onClick={() => setNotesPatient({ id: session.patient_id, name: patientName, phone: session.patients?.phone })} 
                      className="p-2.5 bg-white text-slate-400 hover:text-amber-600 rounded-xl shadow-sm border border-slate-100 transition-all" 
                      title="Anotações / Recados do Paciente"
                    >
                      <StickyNote className="w-4.5 h-4.5" />
                    </button>

                    {/* Lembrete WhatsApp */}
                    <button 
                      onClick={() => handleSendReminder(session)} 
                      className="p-2.5 bg-white text-slate-400 hover:text-indigo-600 rounded-xl shadow-sm border border-slate-100 transition-all" 
                      title="Enviar Lembrete por WhatsApp"
                    >
                      <MessageSquare className="w-4.5 h-4.5" />
                    </button>

                    {/* Reagendar */}
                    <button 
                      onClick={() => handleOpenRescheduleModal(session)} 
                      className="p-2.5 bg-white text-slate-400 hover:text-indigo-600 rounded-xl shadow-sm border border-slate-100 transition-all" 
                      title="Reagendar Consulta"
                    >
                      <CalendarIcon className="w-4.5 h-4.5" />
                    </button>

                    {/* Desmarcar / Remover */}
                    <button 
                      onClick={() => setCancelConfirmationAppt(session)} 
                      className="p-2.5 bg-white text-slate-400 hover:text-rose-600 rounded-xl shadow-sm border border-slate-100 transition-all" 
                      title="Desmarcar / Remover Consulta"
                    >
                      <X className="w-4.5 h-4.5" />
                    </button>
                  </div>
                </div>
              );
            })}

            {upcomingSessions.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2 mt-10">
                <Calendar className="w-10 h-10 text-slate-300" />
                <p className="font-medium">Nenhum agendamento para hoje.</p>
              </div>
            )}
          </div>
        </div>

        {/* Novos Leads */}
        <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-bold flex items-center gap-2">
                <Target className="w-6 h-6 text-rose-500" /> Leads Recentes
            </h3>
            <button onClick={() => navigate('/admin/crm')} className="text-xs font-bold text-indigo-600 hover:underline">Abrir CRM</button>
          </div>
          <div className="space-y-4 flex-1">
            {recentLeads.map((lead, i) => (
              <div key={i} className="flex items-center justify-between p-5 bg-slate-50/50 rounded-3xl border border-transparent hover:border-indigo-100 hover:bg-white transition-all group">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-white border border-slate-100 flex items-center justify-center font-bold text-slate-400 shadow-sm text-sm">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">{lead.name}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">{lead.source || 'Site/WhatsApp'}</p>
                  </div>
                </div>
                <button 
                  onClick={() => navigate('/admin/atendimento')}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl font-bold hover:bg-indigo-600 hover:text-white transition-all text-xs"
                >
                  Atender <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            ))}
            {recentLeads.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2 mt-10">
                <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                <p className="font-medium">Todos os leads foram atendidos!</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Reagendamento */}
      {reschedulingAppt && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-6 animate-in fade-in duration-300">
           <div className="bg-white rounded-[3rem] w-full max-w-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                 <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg">
                       <CalendarIcon className="w-6 h-6" />
                    </div>
                    <div>
                       <h3 className="text-2xl font-black text-slate-900 tracking-tight">Reagendar Consulta</h3>
                       <p className="text-sm text-slate-400 font-medium">Reagendando sessão de {reschedulingAppt.patients?.name || reschedulingAppt.patient_name || 'Paciente'}</p>
                    </div>
                 </div>
                 <button onClick={() => setReschedulingAppt(null)} className="p-2 hover:bg-white rounded-full text-slate-400 transition-all border border-transparent hover:border-slate-200">
                    <X className="w-6 h-6" />
                 </button>
              </div>
              <div className="p-8 space-y-6 overflow-y-auto">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Modalidade</label>
                    <div className="grid grid-cols-2 gap-4">
                       <button 
                          type="button"
                          onClick={() => setRescheduleData({...rescheduleData, type: 'Presencial'} as any)}
                          className={cn(
                            "py-4 rounded-2xl font-bold flex items-center justify-center gap-2 border-2 transition-all",
                            (rescheduleData as any).type === 'Presencial' ? "bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm" : "bg-white border-slate-200 text-slate-400 hover:border-slate-300"
                          )}
                        >
                          <MapPin className="w-5 h-5" /> Presencial
                        </button>
                        <button 
                          type="button"
                          onClick={() => setRescheduleData({...rescheduleData, type: 'Online'} as any)}
                          className={cn(
                            "py-4 rounded-2xl font-bold flex items-center justify-center gap-2 border-2 transition-all",
                            (rescheduleData as any).type === 'Online' ? "bg-blue-50 border-blue-500 text-blue-700 shadow-sm" : "bg-white border-slate-200 text-slate-400 hover:border-slate-300"
                          )}
                        >
                          <Video className="w-5 h-5" /> Online
                        </button>
                    </div>
                 </div>

                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nova Data</label>
                    <input 
                       type="date" 
                       value={rescheduleData.date}
                       min={new Date().toISOString().split('T')[0]}
                       className="w-full p-5 bg-white border-2 border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-2xl outline-none font-bold text-slate-700 text-lg transition-all" 
                       onChange={(e) => {
                          setRescheduleData({...rescheduleData, date: e.target.value, time: ''});
                       }}
                    />
                 </div>
                 
                 <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between">
                       <span>Novos Horários Disponíveis</span>
                       <span className="text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-md">{rescheduleSlots.length} livres</span>
                    </label>
                    {rescheduleSlots.length > 0 ? (
                       <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                          {rescheduleSlots.map(slot => (
                             <button
                                key={slot}
                                onClick={() => setRescheduleData({...rescheduleData, time: slot})}
                                className={cn(
                                   "py-4 rounded-xl font-bold text-sm border-2 transition-all",
                                   rescheduleData.time === slot 
                                     ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200" 
                                     : "bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600"
                                )}
                             >
                                {slot}
                             </button>
                          ))}
                       </div>
                    ) : (
                       <div className="py-12 flex flex-col items-center justify-center text-center bg-slate-50 rounded-[2rem] border border-slate-100">
                          <CalendarIcon className="w-10 h-10 text-slate-300 mb-4" />
                          <h4 className="font-bold text-slate-700">Sem horários livres</h4>
                          <p className="text-sm text-slate-500">Este profissional não possui horários livres neste dia.</p>
                       </div>
                    )}
                 </div>
              </div>
              <div className="p-8 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-3">
                 <button 
                    onClick={() => setReschedulingAppt(null)}
                    className="px-6 py-3 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-200 transition-colors"
                 >
                    Cancelar
                 </button>
                 <button 
                    onClick={handleRescheduleAppointment}
                    disabled={rescheduleLoading || !rescheduleData.date || !rescheduleData.time}
                    className="px-8 py-4 bg-emerald-500 disabled:bg-emerald-300 disabled:cursor-not-allowed text-white rounded-2xl font-bold shadow-xl shadow-emerald-100 transition-all hover:bg-emerald-600 active:scale-95 flex items-center gap-2"
                 >
                    {rescheduleLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                    Confirmar Reagendamento
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* Modal de Confirmação de Cancelamento / Exclusão */}
      {cancelConfirmationAppt && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-6 animate-in fade-in duration-300">
           <div className="bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl border border-slate-100 overflow-hidden p-8 space-y-6">
              <div className="flex items-center gap-4">
                 <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl">
                    <X className="w-6 h-6" />
                 </div>
                 <div>
                     <h3 className="text-xl font-black text-slate-900 tracking-tight">Desmarcar ou Remover Consulta</h3>
                     <p className="text-xs text-slate-400 font-medium">Escolha como deseja alterar esta consulta</p>
                 </div>
              </div>
              
              <p className="text-sm text-slate-600 font-medium leading-relaxed">
                 Deseja alterar a consulta de <strong className="text-slate-900 font-bold">{cancelConfirmationAppt.patients?.name || cancelConfirmationAppt.patient_name || 'Paciente'}</strong>?
              </p>

              <div className="flex flex-col gap-3 pt-2">
                 <button 
                    onClick={() => executeCancelAppointment(false)}
                    disabled={cancelLoading}
                    className="w-full py-3.5 bg-amber-500 text-white rounded-xl font-bold text-sm shadow-md hover:bg-amber-600 transition-all active:scale-95 flex items-center justify-center gap-2"
                 >
                    {cancelLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
                    Desmarcar (Marcar como Cancelada)
                 </button>
                 <button 
                    onClick={() => executeCancelAppointment(true)}
                    disabled={cancelLoading}
                    className="w-full py-3.5 bg-rose-600 text-white rounded-xl font-bold text-sm shadow-md hover:bg-rose-700 transition-all active:scale-95 flex items-center justify-center gap-2"
                 >
                    {cancelLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    Excluir Permanentemente
                 </button>
                 <button 
                    onClick={() => setCancelConfirmationAppt(null)}
                    className="w-full py-2.5 rounded-xl font-bold text-sm text-slate-500 hover:bg-slate-100 transition-colors"
                 >
                    Voltar / Cancelar
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* Modal de Anotações da Secretaria / Recepção */}
      <PatientNotesModal
        patient={notesPatient}
        isOpen={!!notesPatient}
        onClose={() => setNotesPatient(null)}
        onNoteAdded={() => fetchStats()}
      />

      {/* Toast Notification */}
      {toastMessage && (
         <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl font-medium text-sm flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 z-50">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            {toastMessage}
         </div>
      )}
    </div>
  );
}
