import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Clock, User, ChevronLeft, ChevronRight, Video, MapPin, MoreHorizontal, X, Loader2, CheckCircle2, MessageCircle, Activity, DoorOpen } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { supabase } from '@/src/lib/supabase';

interface Appointment {
  id: string;
  patient_id: string;
  therapist_id: string;
  patient_name: string;
  therapist_name: string;
  start_time: string;
  end_time?: string;
  type: string;
  meet_link?: string;
  status?: string;
  google_event_id?: string;
}

export default function AgendaManager() {
  const [showModal, setShowModal] = useState(false);
  const [selectedDateAppointments, setSelectedDateAppointments] = useState<{date: Date, appts: Appointment[]} | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<{id: string, name: string}[]>([]);
  const [therapists, setTherapists] = useState<{id: string, name: string, room_id?: string}[]>([]);
  const [rooms, setRooms] = useState<{id: string, name: string, color: string}[]>([]);
  const [patientPackages, setPatientPackages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('week');
  
  // Wizard State
  const [wizardStep, setWizardStep] = useState(1);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  const [newAppt, setNewAppt] = useState({
    patient_id: '',
    therapist_id: '',
    room_id: '',
    service_id: '',
    date: new Date().toISOString().split('T')[0],
    time: '09:00',
    type: 'Presencial',
    use_package_id: '',
    batch_schedule: false,
    recurrence: 'semanal',
    batch_dates: [] as {date: string, time: string}[]
  });

  // Reschedule State
  const [reschedulingAppt, setReschedulingAppt] = useState<Appointment | null>(null);
  const [rescheduleData, setRescheduleData] = useState({ date: '', time: '' });
  const [rescheduleSlots, setRescheduleSlots] = useState<string[]>([]);
  const [cancelConfirmationAppt, setCancelConfirmationAppt] = useState<Appointment | null>(null);

  const fetchData = async (loadStatic = false) => {
    try {
      if (loadStatic) setLoading(true);
      
      const start = new Date(currentDate);
      start.setDate(start.getDate() - 35);
      const end = new Date(currentDate);
      end.setDate(end.getDate() + 35);
      
      const startStr = start.toISOString().split('T')[0] + 'T00:00:00';
      const endStr = end.toISOString().split('T')[0] + 'T23:59:59';

      const promises: Promise<any>[] = [
        Promise.resolve(supabase.from('appointments')
          .select('*, patients(name), therapists(name)')
          .gte('start_time', startStr)
          .lte('start_time', endStr)
          .order('start_time', { ascending: true }))
      ];

      if (loadStatic) {
        promises.push(Promise.resolve(supabase.from('patients').select('id, name')));
        promises.push(Promise.resolve(supabase.from('therapists').select('id, name, room_id').eq('active', true)));
        promises.push(Promise.resolve(supabase.from('patient_packages').select('*, services(name), patient_package_items(*, services(name))').eq('status', 'active')));
        promises.push(Promise.resolve(supabase.from('rooms').select('id, name, color').eq('status', 'active')));
      }

      const results = await Promise.all(promises);
      const apptsRes = results[0];
      
      let currentPatients = patients;
      let currentTherapists = therapists;

      if (loadStatic) {
        const patientsRes = results[1];
        const therapistsRes = results[2];
        const packagesRes = results[3];
        const roomsRes = results[4];

        currentPatients = patientsRes?.data || [];
        currentTherapists = therapistsRes?.data || [];
        
        setPatients(currentPatients);
        setTherapists(currentTherapists);
        if (roomsRes?.data) setRooms(roomsRes.data);
        if (packagesRes?.data) {
          const activePackages = (packagesRes.data || []).filter((p: any) => p.used_sessions < p.total_sessions);
          setPatientPackages(activePackages);
        }
      }

      const patientsMap = new Map(currentPatients.map(p => [p.id, p.name]));
      const therapistsMap = new Map(currentTherapists.map(t => [t.id, t.name]));

      const formatted: Appointment[] = (apptsRes.data || []).map(a => ({
        id: a.id,
        patient_id: a.patient_id,
        therapist_id: a.therapist_id,
        patient_name: a.patients?.name || 'Paciente Não Encontrado',
        therapist_name: a.therapists?.name || 'Terapeuta',
        start_time: a.start_time,
        end_time: a.end_time,
        type: a.type || 'Presencial',
        meet_link: a.meet_link,
        status: a.status
      }));

      setAppointments(formatted);

    } catch (error) {
      console.error('Erro ao buscar dados da agenda:', error);
    } finally {
      if (loadStatic) setLoading(false);
    }
  };

  
  const handleOpenWizard = () => {
     setWizardStep(1);
     setNewAppt({
        patient_id: '',
        therapist_id: '',
        room_id: '',
        service_id: '',
        date: new Date().toISOString().split('T')[0],
        time: '',
        type: 'Presencial',
        use_package_id: '',
        batch_schedule: false,
        recurrence: 'semanal',
        batch_dates: []
     });
     setErrorMsg(null);
     setShowModal(true);
  };

  useEffect(() => {
    if (newAppt.date && newAppt.therapist_id && wizardStep === 2) {
       const allSlots = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];
       
       const conflicts = appointments.filter(a => {
           if (a.therapist_id !== newAppt.therapist_id) return false;
           if (a.status === 'cancelled') return false;
           
           // Filtra grosseiramente pelo mesmo dia para evitar checar toda a base
           const d = new Date(a.start_time);
           const localDate = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
           return localDate === newAppt.date;
       });
       
       const freeSlots = allSlots.filter(slot => {
           // Constrói o range do slot selecionado
           const slotStart = new Date(`${newAppt.date}T${slot}:00`);
           const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000); // 1 hora de duração
           
           // Bloqueia horários passados se o dia for hoje
           const isToday = newAppt.date === new Date().toISOString().split('T')[0];
           if (isToday && slotStart < new Date()) {
               return false;
           }

           // Verifica se algum agendamento do terapeuta entra em conflito com esse range
           const hasOverlap = conflicts.some(a => {
               const aStart = new Date(a.start_time);
               const aEnd = a.end_time ? new Date(a.end_time) : new Date(aStart.getTime() + 60 * 60 * 1000);
               
               // Lógica de overlap: Começa antes do slot acabar, e termina depois do slot começar
               return aStart < slotEnd && aEnd > slotStart;
           });
           
           return !hasOverlap;
       });
       
       setAvailableSlots(freeSlots);
    }
  }, [newAppt.date, newAppt.therapist_id, appointments, wizardStep]);

  const handleAddAppointment = async () => {
    try {
      setErrorMsg(null);
      if (!newAppt.patient_id || !newAppt.therapist_id) {
        setErrorMsg('Por favor, selecione o paciente e o terapeuta.');
        return;
      }
      setLoading(true);

      // Formatar com fuso horário local para o Supabase não interpretar como UTC
      const tzo = -new Date().getTimezoneOffset();
      const dif = tzo >= 0 ? '+' : '-';
      const pad = (num: number) => (Math.floor(Math.abs(num)) < 10 ? '0' : '') + Math.floor(Math.abs(num));
      const tzOffset = dif + pad(tzo / 60) + ':' + pad(tzo % 60);

      const startTime = `${newAppt.date}T${newAppt.time}:00${tzOffset}`;
      const endTime = new Date(new Date(startTime).getTime() + 60 * 60 * 1000).toISOString();

      // Validação de conflito de horário
      const { data: conflicts, error: conflictError } = await supabase
        .from('appointments')
        .select('id')
        .eq('therapist_id', newAppt.therapist_id)
        .lt('start_time', endTime)
        .gt('end_time', startTime)
        .neq('status', 'cancelled');

      if (conflicts && conflicts.length > 0) {
        setErrorMsg('Conflito de horário! Este terapeuta já possui um agendamento neste horário. Por favor, volte e escolha outro.');
        setLoading(false);
        return;
      }

      // Validação de conflito de sala
      if (newAppt.room_id) {
        const { data: roomConflicts } = await supabase
          .from('appointments')
          .select('id')
          .eq('room_id', newAppt.room_id)
          .lt('start_time', endTime)
          .gt('end_time', startTime)
          .neq('status', 'cancelled');

        if (roomConflicts && roomConflicts.length > 0) {
          setErrorMsg('Conflito de sala! Esta sala já está ocupada por outro atendimento neste horário. Por favor, selecione outra sala ou altere o horário.');
          setLoading(false);
          return;
        }
      }

      const { data: createdAppt, error } = await supabase
        .from('appointments')
        .insert({
          patient_id: newAppt.patient_id,
          therapist_id: newAppt.therapist_id,
          room_id: newAppt.room_id || null,
          start_time: startTime,
          end_time: endTime,
          type: newAppt.type,
          service_id: newAppt.service_id || null,
          package_id: newAppt.use_package_id || null,
          status: 'scheduled'
        }).select('id').single();

      if (error) throw error;

      // Abater do pacote, se selecionado
      if (newAppt.use_package_id) {
        const pkg = patientPackages.find(p => p.id === newAppt.use_package_id);
        if (pkg) {
          if (pkg.patient_package_items && pkg.patient_package_items.length > 0) {
            const matchedItem = pkg.patient_package_items.find((i: any) => i.service_id === newAppt.service_id);
            if (matchedItem) {
              await supabase.from('patient_package_items')
                .update({ used_sessions: matchedItem.used_sessions + 1 })
                .eq('id', matchedItem.id);
            }
          }
          await supabase.from('patient_packages')
            .update({ used_sessions: pkg.used_sessions + 1 })
            .eq('id', pkg.id);
        }
      }

      // 1. Busca dados de contato
      const { data: patientData } = await supabase.from('patients').select('phone, name').eq('id', newAppt.patient_id).single();
      const { data: therapistData } = await supabase.from('therapists').select('phone, name').eq('id', newAppt.therapist_id).single();
      
      const { sendWhatsAppMessage } = await import('@/src/lib/whatsapp');
      const dataFormatada = new Date(startTime).toLocaleDateString('pt-BR');
      let meetLink = '';
      let googleEventId = '';

      // 2. Dispara o Webhook (aguardando o n8n criar o evento)
      try {
         const { data: settings } = await supabase.from('settings').select('value').eq('key', 'integrations').maybeSingle();
         const webhookUrl = settings?.value?.n8n_webhook_url;
         if (webhookUrl) {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token || '';
            const webhookRes = await fetch('/api/n8n-proxy', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                   webhookUrl,
                   payload: {
                      event: 'appointment_created',
                      patient_name: patientData?.name || 'Paciente',
                      patient_phone: patientData?.phone || '',
                      patient_id: newAppt.patient_id,
                      appointment_id: createdAppt.id,
                      therapist_name: therapistData?.name || 'Terapeuta',
                      therapist_phone: therapistData?.phone || '',
                      date_br: dataFormatada,
                      date_iso: newAppt.date,
                      time: newAppt.time,
                      type: newAppt.type
                   }
                })
             });
            
            if (webhookRes.ok) {
                const responseData = await webhookRes.json().catch(() => null);
                console.log("RESPOSTA DO N8N:", responseData);
                
                const findMeetLink = (obj: any): string => {
                    if (!obj) return '';
                    if (typeof obj === 'string' && (obj.startsWith('https://meet.google.com/') || obj.startsWith('https://meet.google.com'))) return obj;
                    if (typeof obj === 'object') {
                        const specificKeys = ['meet_link', 'meetLink', 'hangoutLink', 'meetUrl', 'meet_url'];
                        for (const key of specificKeys) {
                            if (obj[key] && typeof obj[key] === 'string') {
                                return obj[key];
                            }
                        }
                        for (const key in obj) {
                            const res = findMeetLink(obj[key]);
                            if (res) return res;
                        }
                    }
                    return '';
                };

                const findGoogleEventId = (obj: any): string => {
                    if (!obj) return '';
                    if (typeof obj === 'object') {
                        const specificKeys = ['google_event_id', 'eventId', 'event_id'];
                        for (const key of specificKeys) {
                            if (obj[key] && typeof obj[key] === 'string') {
                                return obj[key];
                            }
                        }
                        if (obj['id'] && typeof obj['id'] === 'string') {
                            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                            if (!uuidRegex.test(obj['id']) && obj['id'].length > 5) {
                                return obj['id'];
                            }
                        }
                        for (const key in obj) {
                            const res = findGoogleEventId(obj[key]);
                            if (res) return res;
                        }
                    }
                    return '';
                };

                meetLink = findMeetLink(responseData);
                googleEventId = findGoogleEventId(responseData);

                if (newAppt.type === 'Online' && !meetLink) {
                    setToastMessage('Aviso: Agendamento criado, mas o link do Meet não foi retornado pelo n8n.');
                    setTimeout(() => setToastMessage(null), 5000);
                }
            } else {
                console.warn('Webhook do n8n retornou erro:', webhookRes.status);
                setToastMessage(`Aviso: O agendamento foi salvo, mas a sincronização falhou (status n8n: ${webhookRes.status}).`);
                setTimeout(() => setToastMessage(null), 6000);
            }
         }
      } catch(e: any) {
          console.warn('Erro ao chamar webhook do n8n:', e);
          setToastMessage('Aviso: O agendamento foi salvo, mas a conexão com o n8n falhou.');
          setTimeout(() => setToastMessage(null), 5000);
      }

      // 3. Salva o link do Meet e o Event ID no banco (se devolvidos)
      const updateData: any = {};
      if (meetLink && newAppt.type === 'Online') updateData.meet_link = meetLink;
      if (googleEventId) updateData.google_event_id = googleEventId;
      
      if (Object.keys(updateData).length > 0) {
          await supabase.from('appointments').update(updateData).eq('id', createdAppt.id);
      }

      // 4. Envia as mensagens no WhatsApp formatadas
      if (patientData && patientData.phone) {
          const firstName = patientData.name.split(' ')[0];
          let mensagem = `Olá, *${firstName}*! ✨\n\n`;
          mensagem += `Seu agendamento na *Clínica Tzion Terapias* está confirmado!\n\n`;
          mensagem += `📅 *Data:* ${dataFormatada}\n`;
          mensagem += `⏰ *Horário:* ${newAppt.time}\n`;
          mensagem += `📍 *Modalidade:* ${newAppt.type}\n\n`;

          if (meetLink && newAppt.type === 'Online') {
              mensagem += `💻 *Acesso à Sessão Online:*\n🔗 ${meetLink}\n\n`;
              mensagem += `Acesse o link com uns minutinhos de antecedência. Qualquer imprevisto, é só nos avisar!\n\n`;
          } else if (newAppt.type === 'Online') {
              mensagem += `💻 *Sessão Online:*\nO link seguro do Google Meet será gerado pelo seu terapeuta e enviado logo antes da sessão. Fique de olho!\n\n`;
          } else {
              mensagem += `📍 *Local Presencial:*\nNosso consultório está de portas abertas para te receber.\n\n`;
          }
          mensagem += `Um abraço e te esperamos! 💙`;
          
          await sendWhatsAppMessage(newAppt.patient_id, patientData.phone, mensagem, 'appointment_created');
      }

      if (therapistData && therapistData.phone) {
          let msgTerapeuta = `Olá, *${therapistData.name.split(' ')[0]}*! 👋\n\n`;
          msgTerapeuta += `Você tem um novo agendamento marcado.\n\n`;
          msgTerapeuta += `👤 *Paciente:* ${patientData?.name || 'Não informado'}\n`;
          msgTerapeuta += `📅 *Quando:* ${dataFormatada} às ${newAppt.time}\n`;
          msgTerapeuta += `📍 *Tipo:* ${newAppt.type}\n`;
          
          if (meetLink && newAppt.type === 'Online') {
              msgTerapeuta += `\n🔗 *Link do Meet da Sessão:*\n${meetLink}`;
          }
          await sendWhatsAppMessage(null, therapistData.phone, msgTerapeuta, 'appointment_created_therapist');
      }

      fetchData();
      setWizardStep(5);
    } catch (error) {
      console.error('Erro ao agendar:', error);
      alert('Falha ao realizar agendamento.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddBatchAppointments = async () => {
    try {
      setErrorMsg(null);
      if (!newAppt.patient_id || !newAppt.therapist_id || !newAppt.batch_dates.length) {
        setErrorMsg('Dados incompletos para agendamento em lote.');
        return;
      }
      setLoading(true);

      const tzo = -new Date().getTimezoneOffset();
      const dif = tzo >= 0 ? '+' : '-';
      const pad = (num: number) => (Math.floor(Math.abs(num)) < 10 ? '0' : '') + Math.floor(Math.abs(num));
      const tzOffset = dif + pad(tzo / 60) + ':' + pad(tzo % 60);

      // Check conflicts for ALL dates
      for (const bd of newAppt.batch_dates) {
         const startTime = `${bd.date}T${bd.time}:00${tzOffset}`;
         const endTime = new Date(new Date(startTime).getTime() + 60 * 60 * 1000).toISOString();
         
         const { data: conflicts } = await supabase
           .from('appointments')
           .select('id')
           .eq('therapist_id', newAppt.therapist_id)
           .lt('start_time', endTime)
           .gt('end_time', startTime)
           .neq('status', 'cancelled');
           
         if (conflicts && conflicts.length > 0) {
            setErrorMsg(`Conflito de horário no dia ${new Date(bd.date).toLocaleDateString('pt-BR')} às ${bd.time}. Ajuste manualmente esta data no passo anterior.`);
            setLoading(false);
            return;
         }
      }

      // If no conflicts, insert all
      const appointmentsToInsert = newAppt.batch_dates.map(bd => {
         const startTime = `${bd.date}T${bd.time}:00${tzOffset}`;
         const endTime = new Date(new Date(startTime).getTime() + 60 * 60 * 1000).toISOString();
         return {
            patient_id: newAppt.patient_id,
            therapist_id: newAppt.therapist_id,
            start_time: startTime,
            end_time: endTime,
            type: newAppt.type,
            status: 'scheduled'
         };
      });

      const { error: insertError } = await supabase.from('appointments').insert(appointmentsToInsert);
      if (insertError) throw insertError;

      // Update package
      if (newAppt.use_package_id) {
        const pkg = patientPackages.find(p => p.id === newAppt.use_package_id);
        if (pkg) {
          await supabase.from('patient_packages')
            .update({ used_sessions: pkg.used_sessions + newAppt.batch_dates.length })
            .eq('id', pkg.id);
        }
      }

      // Send WhatsApp message
      const { data: patientData } = await supabase.from('patients').select('phone, name').eq('id', newAppt.patient_id).single();
      if (patientData && patientData.phone) {
         const firstName = patientData.name.split(' ')[0];
         let mensagem = `Olá, *${firstName}*! ✨\n\n`;
         mensagem += `As ${newAppt.batch_dates.length} sessões do seu pacote na *Clínica Tzion Terapias* foram agendadas!\n\n`;
         mensagem += `Confira as próximas datas:\n`;
         
         newAppt.batch_dates.slice(0, 4).forEach((bd, i) => {
            mensagem += `📅 ${new Date(bd.date).toLocaleDateString('pt-BR')} às ${bd.time}\n`;
         });
         
         if (newAppt.batch_dates.length > 4) {
            mensagem += `\n(+ ${newAppt.batch_dates.length - 4} sessões)\n`;
         }
         
         mensagem += `\n📍 *Modalidade:* ${newAppt.type}\n`;
         if (newAppt.type === 'Online') {
             mensagem += `💻 *Sessão Online:*\nOs links do Google Meet serão enviados antes de cada sessão.\n\n`;
         }
         mensagem += `Um abraço e te esperamos! 💙`;
         
         const { sendWhatsAppMessage } = await import('@/src/lib/whatsapp');
         await sendWhatsAppMessage(newAppt.patient_id, patientData.phone, mensagem, 'appointment_batch_created');
      }

      fetchData();
      setWizardStep(5);
    } catch (error) {
      console.error('Erro ao agendar lote:', error);
      alert('Falha ao realizar agendamento em lote.');
    } finally {
      setLoading(false);
    }
  };

  // Carga inicial dos dados estáticos e dinâmicos
  useEffect(() => {
    fetchData(true);
  }, []);

  // Monitora mudança de data visível na agenda para recarregar agendamentos do período
  const isMounted = React.useRef(false);
  useEffect(() => {
    if (isMounted.current) {
      fetchData(false);
    } else {
      isMounted.current = true;
    }
  }, [currentDate]);

  // Integração com Supabase Realtime para atualizar agendamentos
  useEffect(() => {
    const channel = supabase
      .channel('agenda_appointments_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments' },
        () => {
          fetchData(false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentDate, patients, therapists]);

  // Calcula horários disponíveis no reagendamento
  useEffect(() => {
    if (rescheduleData.date && reschedulingAppt) {
       const allSlots = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];
       
       const conflicts = appointments.filter(a => {
           if (a.therapist_id !== reschedulingAppt.therapist_id) return false;
           if (a.status === 'cancelled') return false;
           if (a.id === reschedulingAppt.id) return false; // Ignora o próprio agendamento
           
           const d = new Date(a.start_time);
           const localDate = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
           return localDate === rescheduleData.date;
       });
       
       const freeSlots = allSlots.filter(slot => {
           const slotStart = new Date(`${rescheduleData.date}T${slot}:00`);
           const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000);
           
           // Bloqueia horários passados se o dia for hoje
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
  }, [rescheduleData.date, reschedulingAppt, appointments]);

  const handleCancelAppointment = (event: Appointment) => {
     setCancelConfirmationAppt(event);
  };

  const executeCancelAppointment = async () => {
    if (!cancelConfirmationAppt) return;
    const event = cancelConfirmationAppt;
    setCancelConfirmationAppt(null);

    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('id', event.id);

      if (error) throw error;

      // Busca contatos para enviar avisos
      const { data: patientData } = await supabase.from('patients').select('phone, name').eq('id', event.patient_id).single();
      const { data: therapistData } = await supabase.from('therapists').select('phone, name').eq('id', event.therapist_id).single();
      const dataFormatada = new Date(event.start_time).toLocaleDateString('pt-BR');
      const horaFormatada = new Date(event.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

      // Dispara o Webhook do n8n para cancelar o evento no Google Calendar
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
                      google_event_id: (event as any).google_event_id || null,
                      patient_name: event.patient_name,
                      therapist_name: event.therapist_name
                   }
                })
             });
         }
      } catch (e) {
         console.warn('Erro ao notificar cancelamento ao n8n:', e);
      }

      // Envia notificações via WhatsApp
      const { sendWhatsAppMessage } = await import('@/src/lib/whatsapp');
      if (patientData && patientData.phone) {
         const firstName = patientData.name.split(' ')[0];
         let msg = `Olá, *${firstName}*! 👋\n\nConfirmamos o cancelamento da sua sessão na *Clínica Tzion Terapias*.\n\n📅 *Data original:* ${dataFormatada} às ${horaFormatada}\n👤 *Terapeuta:* ${event.therapist_name}\n\nSe precisar reagendar, entre em contato conosco! 💙`;
         await sendWhatsAppMessage(event.patient_id, patientData.phone, msg, 'appointment_cancelled');
      }

      if (therapistData && therapistData.phone) {
         const firstNameT = therapistData.name.split(' ')[0];
         let msg = `Olá, *${firstNameT}*! ⚠️\n\nA sessão com o(a) paciente *${patientData?.name || event.patient_name}* agendada para ${dataFormatada} às ${horaFormatada} foi *cancelada/desmarcada*.`;
         await sendWhatsAppMessage(null, therapistData.phone, msg, 'appointment_cancelled_therapist');
      }

      setSelectedDateAppointments(prev => prev ? {
         ...prev,
         appts: prev.appts.filter(x => x.id !== event.id)
      } : null);

      setToastMessage('Sessão desmarcada com sucesso!');
      setTimeout(() => setToastMessage(null), 3500);
      fetchData(false);
    } catch (e: any) {
      console.error(e);
      setToastMessage('Erro ao desmarcar sessão: ' + e.message);
      setTimeout(() => setToastMessage(null), 3500);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenRescheduleModal = (app: Appointment) => {
     setReschedulingAppt(app);
     const initialDate = app.start_time ? app.start_time.split('T')[0] : new Date().toISOString().split('T')[0];
     setRescheduleData({
        date: initialDate,
        time: ''
     });
  };

  const handleRescheduleAppointment = async () => {
    if (!reschedulingAppt || !rescheduleData.date || !rescheduleData.time) return;

    try {
      setLoading(true);

      const tzo = -new Date().getTimezoneOffset();
      const dif = tzo >= 0 ? '+' : '-';
      const pad = (num: number) => (Math.floor(Math.abs(num)) < 10 ? '0' : '') + Math.floor(Math.abs(num));
      const tzOffset = dif + pad(tzo / 60) + ':' + pad(tzo % 60);

      const startTime = `${rescheduleData.date}T${rescheduleData.time}:00${tzOffset}`;
      const endTime = new Date(new Date(startTime).getTime() + 60 * 60 * 1000).toISOString();

      const { error } = await supabase
        .from('appointments')
        .update({
          start_time: startTime,
          end_time: endTime
        })
        .eq('id', reschedulingAppt.id);

      if (error) throw error;

      // Busca contatos para enviar avisos
      const { data: patientData } = await supabase.from('patients').select('phone, name').eq('id', reschedulingAppt.patient_id).single();
      const { data: therapistData } = await supabase.from('therapists').select('phone, name').eq('id', reschedulingAppt.therapist_id).single();
      const dataFormatada = new Date(startTime).toLocaleDateString('pt-BR');
      const newTime = rescheduleData.time;

      // Dispara o Webhook do n8n para atualizar o evento no Google Calendar
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
                      google_event_id: (reschedulingAppt as any).google_event_id || null,
                      meet_link: reschedulingAppt.meet_link || null,
                      patient_name: reschedulingAppt.patient_name,
                      therapist_name: reschedulingAppt.therapist_name,
                      new_date_iso: rescheduleData.date,
                      new_date_br: dataFormatada,
                      new_time: rescheduleData.time,
                      type: reschedulingAppt.type
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
         let msg = `Olá, *${firstName}*! ✨\n\nSua sessão na *Clínica Tzion Terapias* foi reagendada com sucesso!\n\n📅 *Nova Data:* ${dataFormatada}\n⏰ *Novo Horário:* ${newTime}\n📍 *Modalidade:* ${reschedulingAppt.type}\n`;
         if (reschedulingAppt.type === 'Online' && reschedulingAppt.meet_link) {
            msg += `💻 *Acesso à Sessão Online:*\n🔗 ${reschedulingAppt.meet_link}\n\n`;
         }
         msg += `Qualquer dúvida, estamos à disposição! 💙`;
         await sendWhatsAppMessage(reschedulingAppt.patient_id, patientData.phone, msg, 'appointment_rescheduled');
      }

      if (therapistData && therapistData.phone) {
         const firstNameT = therapistData.name.split(' ')[0];
         let msg = `Olá, *${firstNameT}*! 🔄\n\nA sessão do paciente *${patientData?.name || reschedulingAppt.patient_name}* foi reagendada.\n\n📅 *Novo horário:* ${dataFormatada} às ${newTime}\n📍 *Modalidade:* ${reschedulingAppt.type}\n`;
         if (reschedulingAppt.type === 'Online' && reschedulingAppt.meet_link) {
            msg += `🔗 *Link do Meet da Sessão:*\n${reschedulingAppt.meet_link}`;
         }
         await sendWhatsAppMessage(null, therapistData.phone, msg, 'appointment_rescheduled_therapist');
      }

      setToastMessage('Sessão reagendada com sucesso!');
      setTimeout(() => setToastMessage(null), 3500);
      setReschedulingAppt(null);
      fetchData(false);
    } catch (e: any) {
      console.error(e);
      setToastMessage('Erro ao reagendar sessão: ' + e.message);
      setTimeout(() => setToastMessage(null), 3500);
    } finally {
      setLoading(false);
    }
  };

  const todayEvents = appointments.filter(a => new Date(a.start_time).toDateString() === new Date().toDateString() && a.status !== 'cancelled');

  const handleSendReminder = async (event: Appointment) => {
    try {
       const { data: patientData } = await supabase.from('patients').select('phone').eq('id', event.patient_id).single();
       if (!patientData?.phone) {
           alert('Paciente não possui telefone cadastrado.');
           return;
       }
       const { sendWhatsAppMessage } = await import('@/src/lib/whatsapp');
       const dataFormatada = new Date(event.start_time).toLocaleDateString('pt-BR');
       const horaFormatada = new Date(event.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

       const firstName = event.patient_name.split(' ')[0];
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
           mensagem += `📍 *Local Presencial:*\nNosso consultório está prontinho para te receber.\n\n`;
       }
       mensagem += `Um abraço e até mais tarde! 💙`;
       
       await sendWhatsAppMessage(event.patient_id, patientData.phone, mensagem, 'appointment_reminder');
       setToastMessage('Lembrete enviado com sucesso via WhatsApp!');
       setTimeout(() => setToastMessage(null), 3500);
    } catch (e: any) {
       console.error(e);
       setToastMessage('Erro ao enviar lembrete: ' + e.message);
       setTimeout(() => setToastMessage(null), 3500);
    }
  };

  const handleCheckin = async (event: Appointment) => {
     try {
         const { error } = await supabase.from('appointments').update({
             status: 'arrived'
         }).eq('id', event.id);
         
         if (error) throw error;
         
         // Notificar o terapeuta via WhatsApp
         try {
             const { data: therapistData } = await supabase
                 .from('therapists')
                 .select('name, phone')
                 .eq('id', event.therapist_id)
                 .maybeSingle();

             if (therapistData && therapistData.phone) {
                 const { sendWhatsAppMessage } = await import('@/src/lib/whatsapp');
                 const time = new Date(event.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                 const msg = `Olá, *${therapistData.name.split(' ')[0]}*! 🔔\n\nSeu paciente *${event.patient_name}* acabou de realizar o check-in na recepção para a sessão das ${time}. Ele(a) já está te aguardando!`;
                 await sendWhatsAppMessage(null, therapistData.phone, msg, 'patient_arrived_therapist');
             }
         } catch (notifyError) {
             console.error('Erro ao enviar notificação de check-in para o terapeuta:', notifyError);
         }
         
         setToastMessage('Check-in realizado! Terapeuta notificado.');
         setTimeout(() => setToastMessage(null), 3500);
         fetchData(); 
     } catch(e: any) {
         console.error(e);
         setToastMessage('Erro no check-in: ' + e.message);
         setTimeout(() => setToastMessage(null), 3500);
     }
  };

  const handleFinishSession = async (event: Appointment) => {
     if (!confirm(`Confirmar o encerramento da sessão de ${event.patient_name}? O NPS será programado.`)) return;
     
     try {
         const { error } = await supabase.from('appointments').update({
             status: 'completed',
             completed_at: new Date().toISOString(),
             nps_sent: false
         }).eq('id', event.id);
         
         if (error) throw error;
         
         setToastMessage('Sessão finalizada! Pesquisa NPS programada.');
         setTimeout(() => setToastMessage(null), 3500);
         fetchData(); 
     } catch(e: any) {
         console.error(e);
         setToastMessage('Erro ao finalizar sessão: ' + e.message);
         setTimeout(() => setToastMessage(null), 3500);
     }
  };

  const handlePrev = () => {
    const d = new Date(currentDate);
    if (viewMode === 'month') d.setMonth(d.getMonth() - 1);
    if (viewMode === 'week') d.setDate(d.getDate() - 7);
    if (viewMode === 'day') d.setDate(d.getDate() - 1);
    setCurrentDate(d);
  };

  const handleNext = () => {
    const d = new Date(currentDate);
    if (viewMode === 'month') d.setMonth(d.getMonth() + 1);
    if (viewMode === 'week') d.setDate(d.getDate() + 7);
    if (viewMode === 'day') d.setDate(d.getDate() + 1);
    setCurrentDate(d);
  };

  const handleToday = () => setCurrentDate(new Date());

  const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const headerTitle = viewMode === 'month' 
    ? `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`
    : viewMode === 'week'
    ? `Semana de ${currentDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`
    : `${currentDate.toLocaleDateString('pt-BR')}`;

  const renderCalendar = () => {
    if (viewMode === 'month') {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const firstDay = new Date(year, month, 1).getDay();
      
      const blanks = Array.from({ length: firstDay }, () => null);
      const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
      const totalSlots = [...blanks, ...days];
      while(totalSlots.length % 7 !== 0) totalSlots.push(null);

      return (
        <div className="grid grid-cols-7 gap-px rounded-[2rem] overflow-hidden border border-slate-200 shadow-sm bg-slate-200">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => (
            <div key={day} className="bg-slate-50 p-4 text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{day}</span>
            </div>
          ))}
          {totalSlots.map((dayNum, i) => {
            if (dayNum === null) return <div key={i} className="bg-slate-50/50 h-32 p-3 opacity-30" />;
            
            const cellDate = new Date(year, month, dayNum);
            const dayAppts = appointments.filter(a => {
               const d = new Date(a.start_time);
               return d.getDate() === dayNum && d.getMonth() === month && d.getFullYear() === year;
            });
            const isToday = cellDate.toDateString() === new Date().toDateString();
            
            return (
              <div 
                key={i} 
                onClick={() => dayAppts.length > 0 && setSelectedDateAppointments({ date: cellDate, appts: dayAppts })}
                className={cn("bg-white h-32 p-3 transition-all group relative", dayAppts.length > 0 ? 'hover:bg-indigo-50/30 cursor-pointer' : '')}
              >
                <span className={cn("text-sm font-bold", isToday ? 'bg-indigo-600 text-white w-7 h-7 flex items-center justify-center rounded-lg shadow-lg shadow-indigo-100' : 'text-slate-600')}>
                  {dayNum}
                </span>
                <div className="mt-2 space-y-1">
                  {dayAppts.slice(0, 2).map((appt, idx) => (
                    <div key={idx} className="px-2 py-1 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded text-[9px] font-bold truncate">
                      {new Date(appt.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} - {appt.patient_name}
                    </div>
                  ))}
                  {dayAppts.length > 2 && <div className="text-[8px] text-slate-400 font-bold px-1">+{dayAppts.length - 2} mais</div>}
                </div>
              </div>
            );
          })}
        </div>
      );
    }
    
    // Visões de Dia e Semana
    const getDaysForView = () => {
      if (viewMode === 'day') return [currentDate];
      const start = new Date(currentDate);
      start.setDate(start.getDate() - start.getDay()); // Domingo
      return Array.from({length: 7}, (_, i) => {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        return d;
      });
    };

    const daysToRender = getDaysForView();

    return (
      <div className={cn(viewMode === 'week' ? "overflow-x-auto w-full rounded-[2rem] border border-slate-200 shadow-sm bg-slate-200 custom-scrollbar" : "")}>
        <div className={cn("grid gap-px overflow-hidden", viewMode === 'week' ? "grid-cols-7 min-w-[1050px]" : "grid-cols-1 rounded-[2rem] border border-slate-200 shadow-sm bg-slate-200")}>
          {daysToRender.map((date, i) => (
            <div key={i} className="bg-slate-50 p-4 text-center border-b border-slate-200">
               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                 {date.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}
               </span>
            </div>
          ))}
          {daysToRender.map((date, i) => {
            const dayAppts = appointments.filter(a => new Date(a.start_time).toDateString() === date.toDateString());
            return (
              <div key={`content-${i}`} className="bg-white h-[380px] overflow-y-auto custom-scrollbar p-2 sm:p-4 space-y-2 sm:space-y-3">
                 {dayAppts.length === 0 && <p className="text-xs sm:text-sm text-slate-400 text-center mt-10">Livre</p>}
                 {dayAppts.map(appt => (
                   <div key={appt.id} className="p-2 sm:p-3 bg-indigo-50 rounded-xl border border-indigo-100 flex flex-col gap-1.5 hover:border-indigo-300 transition-colors cursor-pointer min-w-0">
                     <div className="flex flex-wrap items-center justify-between gap-1">
                       <span className="text-indigo-700 font-black text-[10px] sm:text-xs shrink-0">{new Date(appt.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                       <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-widest text-indigo-400 shrink-0">{appt.type}</span>
                     </div>
                     <h4 className="font-bold text-slate-900 text-xs sm:text-sm leading-tight truncate">{appt.patient_name}</h4>
                     <p className="text-[10px] sm:text-xs text-slate-500 font-medium truncate">Com {appt.therapist_name}</p>
                   </div>
                 ))}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <button onClick={handlePrev} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
              <ChevronLeft className="w-5 h-5 text-slate-400" />
            </button>
            <h2 className="text-xl font-bold text-slate-800 min-w-[200px] text-center capitalize">{headerTitle}</h2>
            <button onClick={handleNext} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
               <ChevronRight className="w-5 h-5 text-slate-400" />
            </button>
          </div>
          <button onClick={handleToday} className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-bold hover:bg-slate-50 transition-colors text-slate-600">Hoje</button>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button onClick={() => setViewMode('day')} className={cn("px-4 py-1.5 text-sm font-bold rounded-lg transition-all", viewMode === 'day' ? "bg-white shadow-sm text-indigo-600" : "text-slate-500 hover:text-slate-700")}>Dia</button>
            <button onClick={() => setViewMode('week')} className={cn("px-4 py-1.5 text-sm font-bold rounded-lg transition-all", viewMode === 'week' ? "bg-white shadow-sm text-indigo-600" : "text-slate-500 hover:text-slate-700")}>Semana</button>
            <button onClick={() => setViewMode('month')} className={cn("px-4 py-1.5 text-sm font-bold rounded-lg transition-all", viewMode === 'month' ? "bg-white shadow-sm text-indigo-600" : "text-slate-500 hover:text-slate-700")}>Mês</button>
          </div>
          <button 
            onClick={handleOpenWizard}
            className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all active:scale-95"
          >
            + Novo Agendamento
          </button>
        </div>
      </div>

      {renderCalendar()}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
          <h3 className="text-xl font-bold text-slate-900 tracking-tight">Sessões do Dia ({new Date().toLocaleDateString('pt-BR')})</h3>
          <div className="space-y-4">
            {todayEvents.map((event, i) => (
              <div key={i} className="group p-4 sm:p-6 border border-slate-100 rounded-3xl hover:border-indigo-200 hover:bg-slate-50/50 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4 sm:gap-6 min-w-0 flex-1 w-full sm:w-auto">
                  <div className="text-indigo-600 font-mono font-bold text-lg sm:text-xl shrink-0">
                    {new Date(event.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className="h-10 w-px bg-slate-200 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-base sm:text-lg text-slate-900 group-hover:text-indigo-600 transition-colors truncate">{event.patient_name}</h4>
                    <p className="text-xs sm:text-sm text-slate-500 font-medium truncate">Com {event.therapist_name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-4 flex-wrap w-full sm:w-auto justify-end border-t border-slate-100 sm:border-0 pt-3 sm:pt-0">
                  <div className={cn(
                    "flex items-center gap-1.5 px-3 py-1 sm:px-4 sm:py-1.5 rounded-full text-[9px] sm:text-[10px] font-bold uppercase tracking-widest shrink-0",
                    event.type === 'Online' ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-400'
                  )}>
                    {event.type === 'Online' ? <Video className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> : <MapPin className="w-3 h-3 sm:w-3.5 sm:h-3.5" />}
                    {event.type}
                  </div>
                  <button 
                    onClick={() => handleSendReminder(event)}
                    title="Enviar Lembrete por WhatsApp"
                    className="p-2 hover:bg-emerald-100 hover:text-emerald-600 rounded-xl transition-colors text-slate-400 shrink-0"
                  >
                    <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                  {event.status === 'completed' ? (
                     <div title="Sessão Finalizada" className="p-2 bg-emerald-50 text-emerald-500 rounded-xl flex items-center gap-1.5 font-bold text-xs shrink-0">
                        <CheckCircle2 className="w-4 h-4" /> Finalizado
                     </div>
                  ) : event.status === 'calling' ? (
                     <div title="Sala Liberada pelo Terapeuta" className="flex items-center gap-2 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold animate-pulse shadow-sm shrink-0">
                        <CheckCircle2 className="w-4 h-4" /> Sala Liberada!
                     </div>
                  ) : event.status === 'in_progress' ? (
                     <div title="Em Atendimento" className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-xl text-xs font-bold shadow-sm shrink-0">
                        <Activity className="w-4 h-4" /> Em Atendimento
                     </div>
                  ) : event.status === 'arrived' ? (
                     <div title="Aguardando na Recepção" className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-600 rounded-xl text-xs font-bold shrink-0">
                        <Clock className="w-4 h-4" /> Aguardando
                     </div>
                  ) : (
                     <button 
                        onClick={() => handleCheckin(event)}
                        title="Fazer Check-in (Paciente Chegou)"
                        className="px-3 py-1.5 sm:px-4 sm:py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm shrink-0"
                     >
                        <User className="w-4 h-4" /> Check-in
                     </button>
                  )}
                  {event.status !== 'completed' && (
                     <div className="flex gap-1 shrink-0">
                      <button 
                        onClick={() => handleOpenRescheduleModal(event)}
                        title="Reagendar Sessão"
                        className="p-2 hover:bg-slate-100 hover:text-indigo-600 rounded-xl transition-colors text-slate-300"
                      >
                        <CalendarIcon className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
                      </button>
                      <button 
                        onClick={() => handleCancelAppointment(event)}
                        title="Desmarcar Sessão"
                        className="p-2 hover:bg-slate-100 hover:text-rose-600 rounded-xl transition-colors text-slate-300"
                      >
                        <X className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
                      </button>
                      <button 
                        onClick={() => handleFinishSession(event)}
                        title="Finalizar Sessão"
                        className="p-2 hover:bg-slate-100 hover:text-emerald-600 rounded-xl transition-colors text-slate-300"
                      >
                        <CheckCircle2 className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
                      </button>
                     </div>
                  )}
                </div>
              </div>
            ))}
            {!loading && todayEvents.length === 0 && (
              <div className="py-20 text-center text-slate-400 font-medium">Nenhuma sessão marcada para hoje.</div>
            )}
            {loading && (
              <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-indigo-600 p-8 rounded-[2.5rem] text-white shadow-xl shadow-indigo-100 relative overflow-hidden">
            <div className="relative z-10">
              <h4 className="font-bold text-xl mb-6">Resumo Geral</h4>
              <div className="space-y-6">
                {[
                  { label: 'Total de Agendamentos', val: appointments.length.toString() },
                  { label: 'Pacientes Cadastrados', val: patients.length.toString() },
                  { label: 'Terapeutas Ativos', val: therapists.length.toString() },
                ].map((stat, i) => (
                  <div key={i} className="flex justify-between items-end border-b border-white/10 pb-4 last:border-0 last:pb-0">
                    <p className="text-indigo-100/70 text-xs font-bold uppercase tracking-widest w-1/2">{stat.label}</p>
                    <p className="text-4xl font-bold">{stat.val}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] w-full max-w-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh] min-h-[500px]">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                 <h3 className="text-2xl font-black text-slate-900 tracking-tight">Agendar Sessão</h3>
                 <div className="flex items-center gap-2 mt-2">
                    <span className={`w-2 h-2 rounded-full ${wizardStep >= 1 ? 'bg-indigo-600' : 'bg-slate-200'}`}></span>
                    <span className={`w-2 h-2 rounded-full ${wizardStep >= 2 ? 'bg-indigo-600' : 'bg-slate-200'}`}></span>
                    <span className={`w-2 h-2 rounded-full ${wizardStep >= 3 ? 'bg-indigo-600' : 'bg-slate-200'}`}></span>
                 </div>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-white rounded-full transition-colors text-slate-400 border border-transparent hover:border-slate-200">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-8 space-y-8 flex-1 flex flex-col overflow-y-auto">
               
               {errorMsg && (
                 <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-200 flex items-center justify-center font-bold text-sm text-center">
                   {errorMsg}
                 </div>
               )}

               {wizardStep === 1 && (
                  <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                     <div className="space-y-4">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Modalidade do Atendimento</label>
                        <div className="grid grid-cols-2 gap-4">
                           <button 
                              onClick={() => setNewAppt({...newAppt, type: 'Presencial'})}
                              className={cn(
                              "p-6 rounded-[2rem] font-bold flex flex-col items-center justify-center gap-3 border-2 transition-all",
                              newAppt.type === 'Presencial' ? "bg-indigo-50 border-indigo-500 text-indigo-700" : "bg-white border-slate-100 hover:border-slate-300 text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                              )}
                           >
                              <MapPin className="w-8 h-8" /> 
                              <span>Presencial</span>
                           </button>
                           <button 
                              onClick={() => setNewAppt({...newAppt, type: 'Online'})}
                              className={cn(
                              "p-6 rounded-[2rem] font-bold flex flex-col items-center justify-center gap-3 border-2 transition-all",
                              newAppt.type === 'Online' ? "bg-blue-50 border-blue-500 text-blue-700" : "bg-white border-slate-100 hover:border-slate-300 text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                              )}
                           >
                              <Video className="w-8 h-8" /> 
                              <span>Online (Meet)</span>
                           </button>
                        </div>
                     </div>
                     <div className="space-y-4">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Terapeuta</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                           {therapists.map(t => (
                              <button 
                                 key={t.id}
                                 onClick={() => setNewAppt({...newAppt, therapist_id: t.id, room_id: (t as any).room_id || ''})}
                                 className={cn(
                                    "p-4 rounded-2xl border-2 text-left flex items-center gap-4 transition-all",
                                    newAppt.therapist_id === t.id ? "border-indigo-500 bg-indigo-50" : "border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50"
                                 )}
                              >
                                 <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl", newAppt.therapist_id === t.id ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-400")}>{t.name.charAt(0)}</div>
                                 <div>
                                    <h4 className={cn("font-bold", newAppt.therapist_id === t.id ? "text-indigo-900" : "text-slate-700")}>{t.name}</h4>
                                    {(t as any).room_id && rooms.find(r => r.id === (t as any).room_id) && (
                                      <p className="text-xs text-indigo-500 font-bold flex items-center gap-1 mt-0.5">
                                        <DoorOpen className="w-3 h-3" />
                                        {rooms.find(r => r.id === (t as any).room_id)?.name}
                                      </p>
                                    )}
                                 </div>
                              </button>
                           ))}
                        </div>
                     </div>
                  </div>
               )}

               {wizardStep === 2 && (
                  <div className="space-y-8 animate-in slide-in-from-right-4 duration-300 h-full flex flex-col">
                     <div className="space-y-4">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Data da Sessão</label>
                        <input 
                           type="date" 
                           value={newAppt.date}
                           min={new Date().toISOString().split('T')[0]}
                           className="w-full p-5 bg-white border-2 border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-2xl outline-none font-bold text-slate-700 text-lg transition-all" 
                           onChange={(e) => {
                              setNewAppt({...newAppt, date: e.target.value, time: ''});
                           }}
                        />
                     </div>
                     
                     <div className="space-y-4 flex-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between">
                           <span>Horários Disponíveis</span>
                           <span className="text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-md">{availableSlots.length} horários livres</span>
                        </label>
                        {availableSlots.length > 0 ? (
                           <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                              {availableSlots.map(slot => (
                                 <button
                                    key={slot}
                                    onClick={() => setNewAppt({...newAppt, time: slot})}
                                    className={cn(
                                       "py-4 rounded-xl font-bold text-sm border-2 transition-all",
                                       newAppt.time === slot ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200" : "bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600"
                                    )}
                                 >
                                    {slot}
                                 </button>
                              ))}
                           </div>
                        ) : (
                           <div className="py-12 flex flex-col items-center justify-center text-center bg-slate-50 rounded-[2rem] border border-slate-100">
                              <CalendarIcon className="w-10 h-10 text-slate-300 mb-4" />
                              <h4 className="font-bold text-slate-700">Agenda Lotada</h4>
                              <p className="text-sm text-slate-500">Este profissional não possui horários livres neste dia.</p>
                           </div>
                        )}
                     </div>
                  </div>
               )}

               {wizardStep === 3 && (
                  <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                     <div className="space-y-4">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Identificação do Paciente</label>
                        <select 
                           className="w-full p-5 bg-white border-2 border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-2xl outline-none font-bold text-slate-700 text-lg transition-all appearance-none"
                           onChange={(e) => setNewAppt({...newAppt, patient_id: e.target.value})}
                           value={newAppt.patient_id}
                        >
                           <option value="">Buscar paciente...</option>
                           {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                     </div>

                     {/* Sala de Atendimento */}
                     {rooms.length > 0 && (
                       <div className="space-y-3">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                           <DoorOpen className="w-3.5 h-3.5" /> Sala de Atendimento
                         </label>
                         <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                           <button
                             onClick={() => setNewAppt({...newAppt, room_id: ''})}
                             className={cn(
                               'p-3 rounded-xl border-2 font-bold text-xs transition-all text-center',
                               !newAppt.room_id ? 'border-slate-400 bg-slate-50 text-slate-700' : 'border-slate-100 text-slate-400 hover:border-slate-200'
                             )}
                           >
                             Sem sala fixa
                           </button>
                           {rooms.map(room => (
                             <button
                               key={room.id}
                               onClick={() => setNewAppt({...newAppt, room_id: room.id})}
                               className={cn(
                                 'p-3 rounded-xl border-2 font-bold text-xs transition-all flex items-center gap-2',
                                 newAppt.room_id === room.id ? 'border-current text-white' : 'border-slate-100 text-slate-600 hover:border-slate-200'
                               )}
                               style={newAppt.room_id === room.id ? { backgroundColor: room.color, borderColor: room.color } : {}}
                             >
                               <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: newAppt.room_id === room.id ? 'white' : room.color }} />
                               {room.name}
                             </button>
                           ))}
                         </div>
                       </div>
                     )}

                     {newAppt.patient_id && patientPackages.filter(p => p.patient_id === newAppt.patient_id).length > 0 && (
                        <div className="p-6 bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 rounded-[2rem] flex flex-col gap-4 animate-in slide-in-from-bottom-4">
                           <div className="flex items-center gap-3 text-amber-700">
                              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center"><User className="w-5 h-5" /></div>
                              <div>
                                 <h4 className="font-bold">Pacote Ativo Encontrado</h4>
                                 <p className="text-xs font-medium opacity-80">Deseja descontar uma sessão deste pacote?</p>
                              </div>
                           </div>
                           <select 
                              className="w-full p-4 bg-white border border-amber-200 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 rounded-xl outline-none font-bold text-amber-900 transition-all appearance-none"
                              onChange={(e) => {
                                 const pkgId = e.target.value;
                                 const pkg = patientPackages.find(p => p.id === pkgId);
                                 const hasItems = pkg?.patient_package_items && pkg.patient_package_items.length > 0;
                                 setNewAppt({
                                    ...newAppt,
                                    use_package_id: pkgId,
                                    service_id: hasItems ? '' : (pkg?.service_id || '')
                                 });
                              }}
                              value={newAppt.use_package_id}
                           >
                              <option value="">Não descontar (Cobrança Avulsa via Asaas)</option>
                              {patientPackages.filter(p => p.patient_id === newAppt.patient_id).map(p => (
                                 <option key={p.id} value={p.id}>
                                    Usar: {p.services?.name} ({p.total_sessions - p.used_sessions} sessões restantes)
                                 </option>
                              ))}
                           </select>

                           {(() => {
                             const selectedPkg = patientPackages.find(p => p.id === newAppt.use_package_id);
                             if (selectedPkg?.patient_package_items && selectedPkg.patient_package_items.length > 0) {
                               return (
                                 <div className="space-y-2 animate-in slide-in-from-top-2">
                                   <label className="text-[10px] font-black text-amber-800 uppercase tracking-widest ml-1">Serviço do Pacote Multimodal *</label>
                                   <select
                                     className="w-full p-4 bg-white border border-amber-200 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 rounded-xl outline-none font-bold text-amber-950 transition-all"
                                     value={newAppt.service_id}
                                     onChange={(e) => setNewAppt({...newAppt, service_id: e.target.value})}
                                     required
                                   >
                                     <option value="">Selecione a modalidade da sessão...</option>
                                     {selectedPkg.patient_package_items.filter((item: any) => item.total_sessions - item.used_sessions > 0).map((item: any) => (
                                       <option key={item.id} value={item.service_id}>
                                         {item.services?.name} ({item.total_sessions - item.used_sessions} restantes)
                                       </option>
                                     ))}
                                   </select>
                                 </div>
                               );
                             }
                             return null;
                           })()}

                           {newAppt.use_package_id && (
                              <div className="pt-4 border-t border-amber-200/50 space-y-4">
                                 <label className="flex items-center gap-3 cursor-pointer">
                                    <input 
                                       type="checkbox" 
                                       checked={newAppt.batch_schedule}
                                       onChange={(e) => setNewAppt({...newAppt, batch_schedule: e.target.checked})}
                                       className="w-5 h-5 rounded text-amber-600 focus:ring-amber-500"
                                    />
                                    <span className="font-bold text-amber-900">Agendar Pacote Completo (Recorrente)</span>
                                 </label>
                                 
                                 {newAppt.batch_schedule && (
                                    <div className="space-y-2 pl-8">
                                       <label className="text-[10px] font-black text-amber-600/70 uppercase tracking-widest">Frequência</label>
                                       <select 
                                          className="w-full p-3 bg-white border border-amber-200 rounded-lg outline-none font-bold text-amber-900"
                                          value={newAppt.recurrence}
                                          onChange={(e) => setNewAppt({...newAppt, recurrence: e.target.value})}
                                       >
                                          <option value="semanal">Semanal (a cada 7 dias)</option>
                                          <option value="quinzenal">Quinzenal (a cada 14 dias)</option>
                                          <option value="mensal">Mensal (mesmo dia do mês)</option>
                                       </select>
                                    </div>
                                 )}
                              </div>
                           )}
                        </div>
                     )}

                     {newAppt.patient_id && (
                        <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-4 mt-8">
                           <h4 className="font-black text-slate-900 text-sm">Resumo do Agendamento</h4>
                           <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                 <p className="text-slate-400 font-bold uppercase tracking-widest text-[9px] mb-1">Quando</p>
                                 <p className="font-bold text-indigo-600">{new Date(newAppt.date).toLocaleDateString('pt-BR')} às {newAppt.time}</p>
                              </div>
                              <div>
                                 <p className="text-slate-400 font-bold uppercase tracking-widest text-[9px] mb-1">Onde</p>
                                 <p className="font-bold text-slate-700 flex items-center gap-1">
                                    {newAppt.type === 'Online' ? <Video className="w-3.5 h-3.5 text-blue-500" /> : <MapPin className="w-3.5 h-3.5 text-slate-500" />}
                                    {newAppt.type}
                                 </p>
                              </div>
                           </div>
                        </div>
                     )}
                  </div>
               )}

               {wizardStep === 4 && newAppt.batch_schedule && (
                  <div className="space-y-6 animate-in slide-in-from-right-4 duration-300 flex-1 flex flex-col">
                     <div className="bg-indigo-50 text-indigo-700 p-4 rounded-xl border border-indigo-100 flex items-center gap-3">
                        <CalendarIcon className="w-6 h-6 flex-shrink-0" />
                        <div>
                           <h4 className="font-bold text-sm">Revisão das Datas</h4>
                           <p className="text-xs opacity-80">Aqui estão as sessões geradas pela recorrência. Você pode alterar a data/hora individualmente se precisar.</p>
                        </div>
                     </div>
                     
                     <div className="space-y-3 flex-1 overflow-y-auto pr-2">
                        {newAppt.batch_dates.map((bd, index) => (
                           <div key={index} className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-200">
                              <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 font-bold flex items-center justify-center text-xs flex-shrink-0">
                                 {index + 1}
                              </div>
                              <input 
                                 type="date"
                                 className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 outline-none focus:border-indigo-500"
                                 value={bd.date}
                                 onChange={(e) => {
                                    const newDates = [...newAppt.batch_dates];
                                    newDates[index].date = e.target.value;
                                    setNewAppt({...newAppt, batch_dates: newDates});
                                 }}
                              />
                              <input 
                                 type="time"
                                 className="w-28 p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 outline-none focus:border-indigo-500"
                                 value={bd.time}
                                 onChange={(e) => {
                                    const newDates = [...newAppt.batch_dates];
                                    newDates[index].time = e.target.value;
                                    setNewAppt({...newAppt, batch_dates: newDates});
                                 }}
                              />
                           </div>
                        ))}
                     </div>
                  </div>
               )}

               {wizardStep === 5 && (
                  <div className="py-12 flex flex-col items-center justify-center text-center animate-in zoom-in-95 duration-300">
                     <div className="w-24 h-24 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mb-6">
                        <CheckCircle2 className="w-12 h-12" />
                     </div>
                     <h3 className="text-2xl font-black text-slate-900 mb-2">Agendamento Confirmado!</h3>
                     <p className="text-slate-500 font-medium">As sessões foram registradas e o paciente será notificado via WhatsApp.</p>
                     
                     <button 
                        onClick={() => {
                           setShowModal(false);
                           setWizardStep(1);
                           fetchData();
                        }}
                        className="mt-8 px-8 py-4 bg-slate-900 text-white rounded-2xl font-bold shadow-lg hover:bg-slate-800 transition-all active:scale-95"
                     >
                        Fechar Janela
                     </button>
                  </div>
               )}
            </div>

            {wizardStep < 5 && (
               <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between mt-auto">
                  <button 
                     onClick={() => {
                        setWizardStep(prev => Math.max(1, prev - 1));
                        setErrorMsg(null);
                     }}
                     className={`px-6 py-3 rounded-xl font-bold text-sm transition-colors ${wizardStep > 1 ? 'text-slate-600 hover:bg-slate-200' : 'text-slate-300 cursor-not-allowed'}`}
                     disabled={wizardStep === 1}
                  >
                     Voltar
                  </button>
                  
                  {wizardStep < 3 || (wizardStep === 3 && newAppt.batch_schedule) ? (
                     <button 
                        onClick={() => {
                           if (wizardStep === 3 && newAppt.batch_schedule) {
                               // Generate dates
                               const pkg = patientPackages.find(p => p.id === newAppt.use_package_id);
                               if (pkg) {
                                  const sessionsToSchedule = pkg.total_sessions - pkg.used_sessions;
                                  const dates = [];
                                  let currentDate = new Date(`${newAppt.date}T12:00:00`); // Use noon to avoid timezone shift on days
                                  for (let i = 0; i < sessionsToSchedule; i++) {
                                     dates.push({
                                        date: currentDate.toISOString().split('T')[0],
                                        time: newAppt.time
                                     });
                                     // Increment according to recurrence
                                     if (newAppt.recurrence === 'semanal') {
                                        currentDate.setDate(currentDate.getDate() + 7);
                                     } else if (newAppt.recurrence === 'quinzenal') {
                                        currentDate.setDate(currentDate.getDate() + 14);
                                     } else if (newAppt.recurrence === 'mensal') {
                                        currentDate.setMonth(currentDate.getMonth() + 1);
                                     }
                                  }
                                  setNewAppt({...newAppt, batch_dates: dates});
                               }
                               setWizardStep(4);
                           } else {
                               setWizardStep(prev => prev + 1);
                           }
                        }}
                        disabled={(wizardStep === 1 && !newAppt.therapist_id) || (wizardStep === 2 && (!newAppt.date || !newAppt.time)) || (wizardStep === 3 && !newAppt.patient_id)}
                        className="px-8 py-4 bg-indigo-600 disabled:bg-indigo-300 disabled:cursor-not-allowed text-white rounded-2xl font-bold shadow-xl shadow-indigo-100 transition-all hover:bg-indigo-700 active:scale-95 flex items-center gap-2"
                     >
                        {wizardStep === 3 && newAppt.batch_schedule ? 'Revisar Datas Lote' : 'Avançar'} <ChevronRight className="w-4 h-4" />
                     </button>
                  ) : (
                     <button 
                        onClick={newAppt.batch_schedule ? handleAddBatchAppointments : handleAddAppointment}
                        disabled={loading || !newAppt.patient_id}
                        className="px-8 py-4 bg-emerald-500 disabled:bg-emerald-300 disabled:cursor-not-allowed text-white rounded-2xl font-bold shadow-xl shadow-emerald-100 transition-all hover:bg-emerald-600 active:scale-95 flex items-center gap-2"
                     >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                        {newAppt.batch_schedule ? 'Confirmar Lote de Agendamentos' : 'Confirmar Agendamento'}
                     </button>
                  )}
               </div>
            )}
          </div>
        </div>
      )}

      {/* Daily Appointments Modal */}
      {selectedDateAppointments && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
           <div className="bg-white rounded-[3rem] w-full max-w-2xl shadow-2xl border border-slate-100 overflow-hidden">
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                 <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg"><CalendarIcon className="w-6 h-6" /></div>
                    <div>
                        <h3 className="text-2xl font-black text-slate-900 tracking-tight">Agenda do Dia</h3>
                        <p className="text-sm text-slate-400 font-medium">{selectedDateAppointments.date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</p>
                    </div>
                 </div>
                 <button onClick={() => setSelectedDateAppointments(null)} className="p-2 hover:bg-white rounded-full text-slate-400 transition-all border border-transparent hover:border-slate-200"><X className="w-6 h-6" /></button>
              </div>
              <div className="p-8 space-y-4 max-h-[60vh] overflow-y-auto">
                 {selectedDateAppointments.appts.map((app) => (
                   <div key={app.id} className="p-6 bg-slate-50 border border-slate-100 rounded-[2rem] flex items-center justify-between hover:border-indigo-200 hover:bg-white hover:shadow-md transition-all group">
                     <div className="flex items-center gap-4">
                       <div className="w-14 h-14 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center font-black text-lg">
                         {new Date(app.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                       </div>
                       <div>
                         <h4 className="font-bold text-slate-900 text-lg">{app.patient_name}</h4>
                         <p className="text-sm text-slate-500 font-medium">Com {app.therapist_name}</p>
                       </div>
                     </div>
                     <div className="flex items-center gap-4">
                        <span className={cn(
                          "px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5",
                          app.type === 'Online' ? "bg-blue-50 text-blue-600" : "bg-slate-100 text-slate-600"
                        )}>
                          {app.type === 'Online' ? <Video className="w-3.5 h-3.5" /> : <MapPin className="w-3.5 h-3.5" />}
                          {app.type}
                        </span>
                        
                        {app.status !== 'completed' && app.status !== 'cancelled' && (
                          <div className="flex gap-1">
                            <button 
                              onClick={() => {
                                 setSelectedDateAppointments(null);
                                 handleOpenRescheduleModal(app);
                              }}
                              title="Reagendar Sessão"
                              className="p-2 hover:bg-slate-100 hover:text-indigo-600 rounded-xl transition-colors text-slate-300"
                            >
                              <CalendarIcon className="w-5 h-5" />
                            </button>
                            <button 
                              onClick={() => {
                                 handleCancelAppointment(app);
                                 setSelectedDateAppointments(prev => prev ? {
                                    ...prev,
                                    appts: prev.appts.filter(x => x.id !== app.id)
                                 } : null);
                              }}
                              title="Desmarcar Sessão"
                              className="p-2 hover:bg-slate-100 hover:text-rose-600 rounded-xl transition-colors text-slate-300"
                            >
                              <X className="w-5 h-5" />
                            </button>
                          </div>
                        )}
                      </div>
                   </div>
                 ))}
              </div>
           </div>
        </div>
      )}

      {/* Reschedule Modal */}
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
                       <p className="text-sm text-slate-400 font-medium">Reagendando sessão de {reschedulingAppt.patient_name}</p>
                    </div>
                 </div>
                 <button onClick={() => setReschedulingAppt(null)} className="p-2 hover:bg-white rounded-full text-slate-400 transition-all border border-transparent hover:border-slate-200">
                    <X className="w-6 h-6" />
                 </button>
              </div>
              <div className="p-8 space-y-6 overflow-y-auto">
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
                          <p className="text-sm text-slate-500">Este terapeuta não possui horários livres neste dia.</p>
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
                    disabled={loading || !rescheduleData.date || !rescheduleData.time}
                    className="px-8 py-4 bg-emerald-500 disabled:bg-emerald-300 disabled:cursor-not-allowed text-white rounded-2xl font-bold shadow-xl shadow-emerald-100 transition-all hover:bg-emerald-600 active:scale-95 flex items-center gap-2"
                 >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                    Confirmar Reagendamento
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* Custom Cancellation Confirmation Modal */}
      {cancelConfirmationAppt && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-6 animate-in fade-in duration-300">
           <div className="bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl border border-slate-100 overflow-hidden p-8 space-y-6">
              <div className="flex items-center gap-4">
                 <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl">
                    <X className="w-6 h-6" />
                 </div>
                 <div>
                     <h3 className="text-xl font-black text-slate-900 tracking-tight">Desmarcar Sessão</h3>
                     <p className="text-xs text-slate-400 font-medium">Esta ação enviará uma notificação ao paciente</p>
                 </div>
              </div>
              
              <p className="text-sm text-slate-600 font-medium leading-relaxed">
                 Deseja realmente desmarcar a sessão de <strong className="text-slate-900 font-bold">{cancelConfirmationAppt.patient_name}</strong>?
              </p>

              <div className="flex items-center justify-end gap-3 pt-2">
                 <button 
                    onClick={() => setCancelConfirmationAppt(null)}
                    className="px-5 py-3 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-200 transition-colors"
                 >
                    Cancelar
                 </button>
                 <button 
                    onClick={executeCancelAppointment}
                    className="px-6 py-3 bg-rose-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-rose-100 hover:bg-rose-700 transition-all active:scale-95"
                 >
                    Sim, Desmarcar
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* Native Toast */}
      {toastMessage && (
         <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl font-medium text-sm flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 z-50">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            {toastMessage}
         </div>
      )}
    </div>
  );
}
