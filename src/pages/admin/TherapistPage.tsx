import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Calendar, Users, DollarSign, User, ClipboardList, 
  Clock, CheckCircle2, ChevronRight, Plus, Search,
  TrendingUp, Star, Award, Settings, Bell, MessageSquare, X, Save, FileText as FileIcon,
  Image as ImageIcon, MapPin, Video, MonitorSmartphone, Filter, History, Trash2, AlertCircle,
  Receipt, Percent, Loader2
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { supabase } from '@/src/lib/supabase';
import PatientProfileModal from '@/src/components/patient/PatientProfileModal';
import { useAuth } from '@/src/contexts/AuthContext';
import { useActiveSession } from '@/src/contexts/ActiveSessionContext';
import { sendWhatsAppMessage } from '@/src/lib/whatsapp';
import { getSystemBaseUrl } from '@/src/utils/systemUrl';

export default function TherapistPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { startActiveSession } = useActiveSession();
  const [activeTab, setActiveTab] = useState('agenda');
  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  // Data States
  const [appointments, setAppointments] = useState<any[]>([]);
  const [appointmentsHistory, setAppointmentsHistory] = useState<any[]>([]);
  const [assignedPatients, setAssignedPatients] = useState<any[]>([]);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [therapistPayments, setTherapistPayments] = useState<any[]>([]);
  const [currentTherapist, setCurrentTherapist] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [defaultTherapistId, setDefaultTherapistId] = useState<string>('');
  const [allTherapists, setAllTherapists] = useState<any[]>([]);
  const [patientAnamnesis, setPatientAnamnesis] = useState<any>(null);
  const [editAnamnesis, setEditAnamnesis] = useState({ complaint: '', family_history: '', lifestyle: '' });
  const [editResponses, setEditResponses] = useState<Record<string, any>>({});
  const [activeTemplate, setActiveTemplate] = useState<any>(null);
  const [isResponsible, setIsResponsible] = useState<boolean>(false);
  
  // Filter State
  const [periodFilter, setPeriodFilter] = useState('mes'); // 'mes', 'trimestre', 'ano'
  
  // Pagination & Filter States
  const [historyPage, setHistoryPage] = useState(1);
  const [patientsPage, setPatientsPage] = useState(1);
  const [patientsSearch, setPatientsSearch] = useState('');
  const [commissionsPage, setCommissionsPage] = useState(1);
  const [payoutsPage, setPayoutsPage] = useState(1);
  const [paymentsPage, setPaymentsPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    setHistoryPage(1);
    setCommissionsPage(1);
    setPaymentsPage(1);
  }, [periodFilter]);

  useEffect(() => {
    setPatientsPage(1);
  }, [patientsSearch]);
  
  // Modals
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [patientRecords, setPatientRecords] = useState<any[]>([]);
  const [patientPackages, setPatientPackages] = useState<any[]>([]);
  const [newRecord, setNewRecord] = useState({ type: 'evolution', content: '' });
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [newApp, setNewApp] = useState({ patient_id: '', start_time: '', type: 'Presencial', room_id: '' });
  const [rooms, setRooms] = useState<any[]>([]);
  const [selectedDateAppointments, setSelectedDateAppointments] = useState<{date: Date, appts: any[]} | null>(null);

  // Reschedule State
  const [reschedulingAppt, setReschedulingAppt] = useState<any | null>(null);
  const [rescheduleData, setRescheduleData] = useState({ date: '', time: '' });
  const [rescheduleSlots, setRescheduleSlots] = useState<string[]>([]);
  const [cancelConfirmationAppt, setCancelConfirmationAppt] = useState<any | null>(null);

  // Profile Modal State
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profilePatient, setProfilePatient] = useState<any>(null);

  const fetchData = async (loadStatic = false) => {
    setLoading(true);
    try {
      let therapistId = defaultTherapistId;
      let therapistInfo = currentTherapist;

      // 1. Se for terapeuta logado, forçamos o ID a ser SEMPRE o seu próprio cadastro
      if (user?.role === 'terapeuta') {
        const { data: myTherapist } = await supabase
          .from('therapists')
          .select('id, name, user_id, commission_rate_clinic, commission_rate_self, photo_url, professional_registration, bio, specialties, attendance_modes')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!myTherapist) {
          console.error("Nenhum terapeuta ativo encontrado para o seu usuário.");
          setLoading(false);
          return;
        }

        therapistId = myTherapist.id;
        therapistInfo = myTherapist;
        if (defaultTherapistId !== myTherapist.id) {
          setDefaultTherapistId(myTherapist.id);
          setCurrentTherapist(myTherapist);
        }
      } else {
        // 2. Se for admin, carregamos a lista de todos os terapeutas ativos para o dropdown.
        if (loadStatic || allTherapists.length === 0) {
          const { data: allActive } = await supabase
            .from('therapists')
            .select('id, name, user_id, commission_rate_clinic, commission_rate_self, photo_url, professional_registration, bio, specialties, attendance_modes')
            .eq('active', true)
            .order('name');
          
          const list = allActive || [];
          setAllTherapists(list);

          if (!therapistId && list.length > 0) {
            therapistId = list[0].id;
            therapistInfo = list[0];
            setCurrentTherapist(list[0]);
            setDefaultTherapistId(list[0].id);
          }
        }
      }

      // Se temos o ID do terapeuta, mas os detalhes dele não estão carregados
      if (therapistId && (!therapistInfo || !therapistInfo.bio)) {
        const { data: tFull } = await supabase
          .from('therapists')
          .select('id, name, user_id, commission_rate_clinic, commission_rate_self, photo_url, professional_registration, bio, specialties, attendance_modes')
          .eq('id', therapistId)
          .maybeSingle();
        if (tFull) {
          therapistInfo = tFull;
          setCurrentTherapist(tFull);
        }
      }

      if (!therapistId) {
        setLoading(false);
        return;
      }

      // Restringir busca de appointments para os últimos 90 dias e próximos 90 dias
      const cutoffStart = new Date();
      cutoffStart.setDate(cutoffStart.getDate() - 90);
      const cutoffEnd = new Date();
      cutoffEnd.setDate(cutoffEnd.getDate() + 90);

      const promises: Promise<any>[] = [
        Promise.resolve(supabase.from('appointments')
          .select('*, patients(name)')
          .eq('therapist_id', therapistId)
          .gte('start_time', cutoffStart.toISOString())
          .lte('start_time', cutoffEnd.toISOString())
          .order('start_time')),
        Promise.resolve({ data: [] }), // Removed failing supabase.from('commissions') query
        Promise.resolve(supabase.from('commission_payouts')
          .select('*')
          .eq('therapist_id', therapistId)
          .order('year', { ascending: false })
          .order('month', { ascending: false })),
        Promise.resolve(supabase.from('payments')
          .select('*, patients(name)')
          .eq('therapist_id', therapistId)
          .eq('type', 'income')
          .eq('status', 'paid')
          .order('created_at', { ascending: false }))
      ];

      if (loadStatic) {
        promises.push(Promise.resolve(supabase.from('patients').select('*').order('name')));
        promises.push(Promise.resolve(supabase.from('therapists').select('*').eq('id', therapistId).maybeSingle()));
        promises.push(Promise.resolve(supabase.from('rooms').select('id, name, color').eq('status', 'active')));
      }

      const results = await Promise.all(promises);
      const appRes = results[0];
      const comRes = results[1];
      const payoutsDataRes = results[2];
      const paymentsDataRes = results[3];

      if (loadStatic) {
        const patRes = results[4];
        const profRes = results[5];
        const roomsRes = results[6];

        setAssignedPatients(patRes?.data || []);
        if (roomsRes?.data) setRooms(roomsRes.data);
        
        const pData = profRes?.data || {};
        if (therapistInfo) {
          if (!pData.id) pData.id = therapistId;
          if (!pData.name) pData.name = therapistInfo.name || '';
          if (!pData.photo_url) pData.photo_url = therapistInfo.photo_url || therapistInfo.avatar_url || '';
          if (!pData.registration_number) pData.registration_number = pData.professional_registration || therapistInfo.professional_registration || '';
          if (!pData.bio) pData.bio = pData.bio || therapistInfo.bio || '';
          if (!pData.specialties) pData.specialties = pData.specialties || therapistInfo.specialties || [];
          if (!pData.role) pData.role = (pData.specialties && pData.specialties[0]) || (therapistInfo.specialties && therapistInfo.specialties[0]) || pData.specialty || '';
          if (!pData.modality) pData.modality = (pData.attendance_modes && pData.attendance_modes[0]) || (therapistInfo.attendance_modes && therapistInfo.attendance_modes[0]) || 'ambos';
        }
        let wh = pData.working_hours;
        if (wh && typeof wh === 'object' && !Array.isArray(wh)) {
          if (wh.monday && typeof wh.monday === 'object' && !Array.isArray(wh.monday)) {
            const normalized: Record<string, string[]> = {
              "Segunda": [], "Terça": [], "Quarta": [], "Quinta": [], "Sexta": []
            };
            if (wh.monday?.active) normalized["Segunda"].push(`${wh.monday.start} às ${wh.monday.end}`);
            if (wh.tuesday?.active) normalized["Terça"].push(`${wh.tuesday.start} às ${wh.tuesday.end}`);
            if (wh.wednesday?.active) normalized["Quarta"].push(`${wh.wednesday.start} às ${wh.wednesday.end}`);
            if (wh.thursday?.active) normalized["Quinta"].push(`${wh.thursday.start} às ${wh.thursday.end}`);
            if (wh.friday?.active) normalized["Sexta"].push(`${wh.friday.start} às ${wh.friday.end}`);
            pData.working_hours = normalized;
          }
        }
        
        if (!pData.working_hours || typeof pData.working_hours !== 'object' || Array.isArray(pData.working_hours) || (!pData.working_hours['Segunda'] && !pData.working_hours['monday'])) {
          pData.working_hours = {
            "Segunda": ["08:00 às 12:00", "13:00 às 18:00"],
            "Terça": ["08:00 às 12:00", "13:00 às 18:00"],
            "Quarta": ["08:00 às 12:00", "13:00 às 18:00"],
            "Quinta": ["08:00 às 12:00", "13:00 às 18:00"],
            "Sexta": ["08:00 às 12:00", "13:00 às 18:00"]
          };
        }
        if (!pData.modality) pData.modality = 'ambos';
        setProfile(pData);
      }

      const allApps = appRes.data || [];
      const dToday = new Date();
      const localToday = `${dToday.getFullYear()}-${(dToday.getMonth() + 1).toString().padStart(2, '0')}-${dToday.getDate().toString().padStart(2, '0')}`;
      
      const todaysApps = allApps.filter(a => {
         const d = new Date(a.start_time);
         const localDate = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
         return localDate === localToday && a.status !== 'completed' && a.status !== 'cancelled';
      });
      
      const pastApps = allApps.filter(a => {
         const d = new Date(a.start_time);
         const localDate = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
         return localDate < localToday || (localDate === localToday && (a.status === 'completed' || a.status === 'cancelled'));
      });

      setAppointments(todaysApps);
      setAppointmentsHistory(pastApps);
      setCommissions(comRes.data || []);
      setPayouts(payoutsDataRes.data || []);
      setTherapistPayments(paymentsDataRes.data || []);

    } catch (error) {
      console.error('Error fetching therapist data:', error);
    }
    setLoading(false);
  };

  // Carga inicial (estática e dinâmica)
  useEffect(() => {
    fetchData(true);
  }, [user]);

  // Realtime subscription para agendamentos do terapeuta
  useEffect(() => {
    if (!defaultTherapistId) return;

    const channel = supabase
      .channel(`therapist_appointments_${defaultTherapistId}`)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'appointments', 
          filter: `therapist_id=eq.${defaultTherapistId}` 
        },
        () => {
          fetchData(false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [defaultTherapistId]);

  // Polling de backup a cada 90 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      fetchData(false);
    }, 90000);
    return () => clearInterval(interval);
  }, [defaultTherapistId]);
  useEffect(() => {
    if (selectedPatient) {
      const fetchPatientDetails = async () => {
        const currentTherapistId = defaultTherapistId || profile?.id;
        
        // Fetch responsibility status dynamically from DB
        let isResp = user?.role === 'admin';
        if (!isResp && currentTherapistId) {
          const { data: apptExists } = await supabase
            .from('appointments')
            .select('id')
            .eq('patient_id', selectedPatient.id)
            .eq('therapist_id', currentTherapistId)
            .limit(1)
            .maybeSingle();
          if (apptExists) {
            isResp = true;
          }
        }
        setIsResponsible(isResp);

        const [recordsRes, pkgsRes, anamnesisRes] = await Promise.all([
          supabase.from('medical_records').select('*').eq('patient_id', selectedPatient.id).order('created_at', { ascending: false }),
          supabase.from('patient_packages').select('*, services(name)').eq('patient_id', selectedPatient.id).eq('status', 'active'),
          supabase.from('patient_anamnesis').select('*').eq('patient_id', selectedPatient.id).maybeSingle()
        ]);
        setPatientRecords(recordsRes.data || []);
        setPatientPackages(pkgsRes.data || []);
        
        const anaData = anamnesisRes?.data;
        setPatientAnamnesis(anaData || null);
        setEditAnamnesis({
          complaint: anaData?.complaint || '',
          family_history: anaData?.family_history || '',
          lifestyle: anaData?.lifestyle || '',
        });
        setEditResponses(anaData?.responses || {});

        // Load appropriate template
        let templateToLoad = null;
        if (anaData?.template_id) {
          const { data: tmpl } = await supabase.from('clinical_templates').select('*').eq('id', anaData.template_id).maybeSingle();
          templateToLoad = tmpl;
        } else {
          const { data: activeTmpls } = await supabase
            .from('clinical_templates')
            .select('*')
            .eq('category', 'anamnesis')
            .eq('active', true)
            .order('created_at', { ascending: false });
          if (activeTmpls && activeTmpls.length > 0) {
            templateToLoad = activeTmpls[0];
          }
        }
        setActiveTemplate(templateToLoad);
      };
      fetchPatientDetails();
    }
  }, [selectedPatient, defaultTherapistId, profile, user]);

  const handleSaveAnamnesis = async () => {
    if (!selectedPatient) return;
    setLoading(true);
    
    let comp = editAnamnesis.complaint;
    let fam = editAnamnesis.family_history;
    let life = editAnamnesis.lifestyle;

    if (activeTemplate && activeTemplate.fields) {
      activeTemplate.fields.forEach((f: any) => {
        const val = editResponses[f.id];
        if (val === undefined || val === null) return;
        
        const labelLower = f.label.toLowerCase();
        if (labelLower.includes('queixa') || labelLower.includes('motivo') || labelLower.includes('busca')) {
          comp = String(val);
        } else if (labelLower.includes('familiar') || labelLower.includes('família') || labelLower.includes('genograma')) {
          fam = String(val);
        } else if (labelLower.includes('estilo') || labelLower.includes('hábito') || labelLower.includes('rotina') || labelLower.includes('lifestyle')) {
          life = String(val);
        }
      });
    }

    const { data: existing } = await supabase
      .from('patient_anamnesis')
      .select('id')
      .eq('patient_id', selectedPatient.id)
      .maybeSingle();
      
    let error;
    const payload = {
      patient_id: selectedPatient.id,
      template_id: activeTemplate?.id || null,
      responses: editResponses,
      complaint: comp,
      family_history: fam,
      lifestyle: life,
      updated_at: new Date().toISOString()
    };

    if (existing?.id) {
      const { error: err } = await supabase
        .from('patient_anamnesis')
        .update(payload)
        .eq('id', existing.id);
      error = err;
    } else {
      const { error: err } = await supabase
        .from('patient_anamnesis')
        .insert([payload]);
      error = err;
    }
    
    setLoading(false);
    if (!error) {
      setToastMessage('Anamnese salva com sucesso!');
      setTimeout(() => setToastMessage(null), 3500);
      
      const { data: ana } = await supabase.from('patient_anamnesis').select('*').eq('patient_id', selectedPatient.id).maybeSingle();
      setPatientAnamnesis(ana || null);
    } else {
      setToastMessage('Erro ao salvar anamnese.');
      setTimeout(() => setToastMessage(null), 3500);
    }
  };

  const handleSendAnamnesisLink = async () => {
    if (!selectedPatient?.phone) {
      setToastMessage('Paciente não possui telefone cadastrado.');
      setTimeout(() => setToastMessage(null), 3500);
      return;
    }
    const baseUrl = await getSystemBaseUrl();
    const link = `${baseUrl}/anamnese/${selectedPatient.anamnesis_token || selectedPatient.id}`;
    const firstName = selectedPatient.name.split(' ')[0] || 'Paciente';
    const msg = `[Ficha de Entrada - Tzion Terapias]\n\nOlá, *${firstName}*! ✨\n\nPor favor, preencha a sua Ficha de Anamnese antes da nossa próxima sessão. É bem rápido e nos ajuda a preparar o seu atendimento:\n\n🔗 ${link}\n\nQualquer dúvida, estamos à disposição! 💙`;
    
    setLoading(true);
    const sent = await sendWhatsAppMessage(selectedPatient.id, selectedPatient.phone, msg, 'anamnesis_invite');
    setLoading(false);
    if (sent) {
      setToastMessage('Link de anamnese enviado com sucesso via WhatsApp!');
    } else {
      setToastMessage('Erro ao enviar link via WhatsApp.');
    }
    setTimeout(() => setToastMessage(null), 3500);
  };
  const handleAddRecord = async () => {
    if (!selectedPatient || !newRecord.content) return;
    const { error } = await supabase.from('medical_records').insert([{
      patient_id: selectedPatient.id,
      therapist_id: profile?.id || '00000000-0000-0000-0000-000000000000',
      type: newRecord.type,
      content: { text: newRecord.content }
    }]);

    if (!error) {
      setNewRecord({ type: 'evolution', content: '' });
      // Refresh details
      const fetchPatientDetails = async () => {
        const { data } = await supabase.from('medical_records').select('*').eq('patient_id', selectedPatient.id).order('created_at', { ascending: false });
        setPatientRecords(data || []);
      };
      fetchPatientDetails();
      fetchData();
    }
  };

  // Calcula horários disponíveis no reagendamento do terapeuta
  useEffect(() => {
    if (rescheduleData.date && reschedulingAppt) {
        const allSlots = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];
        const therapistId = defaultTherapistId || profile?.id || reschedulingAppt.therapist_id;
        
        const conflicts = [...appointments, ...appointmentsHistory].filter(a => {
            if (a.therapist_id !== therapistId) return false;
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
  }, [rescheduleData.date, reschedulingAppt, appointments, appointmentsHistory]);

  const handleCancelAppointment = (event: any) => {
     setCancelConfirmationAppt(event);
  };

  const executeCancelAppointment = async () => {
    if (!cancelConfirmationAppt) return;
    const event = cancelConfirmationAppt;
    const patientName = event.patients?.name || event.patient_name || 'Paciente';
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
                     google_event_id: event.google_event_id || null,
                     patient_name: patientName,
                     therapist_name: profile?.name || currentTherapist?.name || 'Terapeuta'
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
         let msg = `Olá, *${firstName}*! 👋\n\nConfirmamos o cancelamento da sua sessão na *Clínica Tzion Terapias*.\n\n📅 *Data original:* ${dataFormatada} às ${horaFormatada}
👤 *Terapeuta:* ${therapistData?.name || 'Terapeuta'}\n\nSe precisar reagendar, entre em contato conosco! 💙`;
         await sendWhatsAppMessage(event.patient_id, patientData.phone, msg, 'appointment_cancelled');
      }

      if (therapistData && therapistData.phone) {
         const firstNameT = therapistData.name.split(' ')[0];
         let msg = `Olá, *${firstNameT}*! ⚠️\n\nA sessão com o(a) paciente *${patientName}* agendada para ${dataFormatada} às ${horaFormatada} foi *cancelada/desmarcada*.`;
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

  const handleOpenRescheduleModal = (app: any) => {
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
      const patientName = patientData?.name || reschedulingAppt.patients?.name || reschedulingAppt.patient_name || 'Paciente';

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
                      google_event_id: reschedulingAppt.google_event_id || null,
                      meet_link: reschedulingAppt.meet_link || null,
                      patient_name: patientName,
                      therapist_name: profile?.name || currentTherapist?.name || 'Terapeuta',
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
         let msg = `Olá, *${firstNameT}*! 🔄\n\nA sessão do paciente *${patientName}* foi reagendada.\n\n📅 *Novo horário:* ${dataFormatada} às ${newTime}\n📍 *Modalidade:* ${reschedulingAppt.type}\n`;
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

  const handleCreateAppointment = async () => {
    if (!newApp.patient_id || !newApp.start_time) return;

    const startTime = new Date(newApp.start_time);
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000).toISOString();
    const finalTherapistId = defaultTherapistId || profile?.id || '00000000-0000-0000-0000-000000000000';

    // Validação de conflito de terapeuta
    const { data: conflicts } = await supabase
      .from('appointments')
      .select('id')
      .eq('therapist_id', finalTherapistId)
      .lt('start_time', endTime)
      .gt('end_time', startTime.toISOString())
      .neq('status', 'cancelled');

    if (conflicts && conflicts.length > 0) {
      alert('Conflito de horário! Você já possui um agendamento neste horário. Por favor, escolha outro.');
      return;
    }

    // Validação de conflito de sala
    if (newApp.room_id) {
      const { data: roomConflicts } = await supabase
        .from('appointments')
        .select('id')
        .eq('room_id', newApp.room_id)
        .lt('start_time', endTime)
        .gt('end_time', startTime.toISOString())
        .neq('status', 'cancelled');

      if (roomConflicts && roomConflicts.length > 0) {
        alert('Conflito de sala! Esta sala já está ocupada por outro atendimento neste horário. Por favor, selecione outra sala ou altere o horário.');
        return;
      }
    }

    const { data: createdAppt, error } = await supabase.from('appointments').insert([{
      patient_id: newApp.patient_id,
      start_time: startTime.toISOString(),
      end_time: endTime,
      type: newApp.type,
      therapist_id: finalTherapistId,
      room_id: newApp.room_id || null,
      status: 'scheduled'
    }]).select('id').single();
    
    if (!error && createdAppt) {
      // Automação: Envio de WhatsApp para o Paciente
      const { data: patientData } = await supabase.from('patients').select('phone, name').eq('id', newApp.patient_id).single();
      
      // Automação: Envio de WhatsApp para o Terapeuta
      const { data: therapistData } = finalTherapistId ? await supabase.from('therapists').select('phone, name').eq('id', finalTherapistId).single() : { data: null };
      
      const dataFormatada = startTime.toLocaleDateString('pt-BR');
      const horaFormatada = startTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      let meetLink = '';
      let googleEventId = '';

      // 1. Dispara o Webhook (n8n cria o evento)
      try {
         const { data: settings } = await supabase.from('settings').select('value').eq('key', 'integrations').maybeSingle();
         const webhookUrl = settings?.value?.n8n_webhook_url;
         if (webhookUrl) {
            const webhookRes = await fetch('/api/n8n-proxy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                   webhookUrl,
                   payload: {
                      event: 'appointment_created',
                      patient_name: patientData?.name || 'Paciente',
                      patient_phone: patientData?.phone || '',
                      patient_id: newApp.patient_id,
                      appointment_id: createdAppt.id,
                      therapist_name: therapistData?.name || 'Terapeuta',
                      therapist_phone: therapistData?.phone || '',
                      date_br: dataFormatada,
                      date_iso: newApp.start_time.split('T')[0],
                      time: horaFormatada,
                      type: newApp.type
                   }
                })
             });
            
            if (webhookRes.ok) {
                const responseData = await webhookRes.json().catch(() => null);
                // RESPOSTA DO N8N
                
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

                if (newApp.type === 'Online' && !meetLink) {
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

      // 2. Salva o link do Meet e o Event ID no banco (se devolvidos)
      const updateData: any = {};
      if (meetLink && newApp.type === 'Online') updateData.meet_link = meetLink;
      if (googleEventId) updateData.google_event_id = googleEventId;
      
      if (Object.keys(updateData).length > 0) {
          await supabase.from('appointments').update(updateData).eq('id', createdAppt.id);
      }

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

      // 3. Envia WhatsApps
      const { sendWhatsAppMessage } = await import('@/src/lib/whatsapp');
      if (patientData && patientData.phone) {
         let mensagem = `Olá, *${patientData.name.split(' ')[0]}*! ✨\n\n`;
         mensagem += `Seu agendamento na *Clínica Tzion Terapias* está confirmado!\n\n`;
         mensagem += `📅 *Data:* ${dataFormatada}\n`;
         mensagem += `⏰ *Horário:* ${horaFormatada}\n`;
         mensagem += `📍 *Modalidade:* ${newApp.type}\n\n`;

         if (meetLink && newApp.type === 'Online') {
             mensagem += `💻 *Acesso à Sessão Online:*\n🔗 ${meetLink}\n\n`;
             mensagem += `Acesse o link com uns minutinhos de antecedência. Qualquer imprevisto, é só nos avisar!\n\n`;
         } else if (newApp.type === 'Online') {
             mensagem += `💻 *Sessão Online:*\nO link seguro do Google Meet será gerado pelo seu terapeuta e enviado logo antes da sessão. Fique de olho!\n\n`;
         } else {
             mensagem += `📍 *Local Presencial:*\n${localAddress}\n\n`;
         }
         mensagem += `Um abraço e te esperamos! 💙`;
         await sendWhatsAppMessage(newApp.patient_id, patientData.phone, mensagem, 'appointment_created');
      }

      if (therapistData && therapistData.phone) {
         let msgTerapeuta = `Olá, *${therapistData.name.split(' ')[0]}*! 👋\n\n`;
         msgTerapeuta += `Você tem um novo agendamento marcado.\n\n`;
         msgTerapeuta += `👤 *Paciente:* ${patientData?.name || 'Não informado'}\n`;
         msgTerapeuta += `📅 *Quando:* ${dataFormatada} às ${horaFormatada}\n`;
         msgTerapeuta += `📍 *Tipo:* ${newApp.type}\n`;
         
         if (meetLink && newApp.type === 'Online') {
             msgTerapeuta += `\n🔗 *Link do Meet da Sessão:*\n${meetLink}`;
         }
         await sendWhatsAppMessage(null, therapistData.phone, msgTerapeuta, 'appointment_created_therapist');
      }

      setShowAppointmentModal(false);
      setNewApp({ patient_id: '', start_time: '', type: 'Presencial', room_id: '' });
      fetchData();
    } else {
      alert('Erro ao realizar agendamento.');
      console.error(error);
    }
  };

  const handleSaveProfile = async () => {
    if (!profile) return;
    setLoading(true);
    
    // Convert single values back to arrays for the database
    const payload: any = { 
        bio: profile.bio,
        specialties: profile.role ? [profile.role] : profile.specialties,
        working_hours: profile.working_hours,
        professional_registration: profile.registration_number,
        photo_url: profile.photo_url,
        attendance_modes: profile.modality ? [profile.modality] : ['ambos'],
        name: profile.name
    };
    
    if (profile.id) payload.id = profile.id;

    const { error } = await supabase
      .from('therapists')
      .upsert(payload);
      
    if (!error) {
      setToastMessage('Perfil atualizado com sucesso!');
      setTimeout(() => setToastMessage(null), 3500);
    } else {
      setToastMessage('Erro ao salvar o perfil.');
      setTimeout(() => setToastMessage(null), 3500);
    }
    setLoading(false);
  };

  const handleFinishSession = async (app: any) => {
     if (!confirm(`Confirmar o encerramento da sessão com ${app.patients?.name || 'o paciente'}? O NPS será programado.`)) return;
     try {
         const { error } = await supabase.from('appointments').update({
             status: 'completed',
             completed_at: new Date().toISOString(),
             nps_sent: false
         }).eq('id', app.id);
         
         if (error) throw error;
         
         setToastMessage('Sessão finalizada! NPS programado.');
         setTimeout(() => setToastMessage(null), 3500);
         fetchData(); 
     } catch(e: any) {
         console.error(e);
         setToastMessage('Erro ao finalizar sessão: ' + e.message);
         setTimeout(() => setToastMessage(null), 3500);
     }
  };

  const handleAddHourBlock = (day: string) => {
    const currentHours = profile.working_hours?.[day] || [];
    setProfile({
      ...profile,
      working_hours: {
        ...profile.working_hours,
        [day]: [...currentHours, '00:00 às 00:00']
      }
    });
  };

  const handleUpdateHourBlock = (day: string, idx: number, val: string) => {
    const currentHours = [...(profile.working_hours?.[day] || [])];
    currentHours[idx] = val;
    setProfile({
      ...profile,
      working_hours: {
        ...profile.working_hours,
        [day]: currentHours
      }
    });
  };

  const handleRemoveHourBlock = (day: string, idx: number) => {
    const currentHours = [...(profile.working_hours?.[day] || [])];
    currentHours.splice(idx, 1);
    setProfile({
      ...profile,
      working_hours: {
        ...profile.working_hours,
        [day]: currentHours
      }
    });
  };

  const MONTHS = Array.from({ length: 12 }, (_, i) =>
    new Date(2000, i, 1).toLocaleString('pt-BR', { month: 'long' })
  );

  const pendingPayouts = payouts.filter(p => p.status === 'pending');
  const paidPayouts = payouts.filter(p => p.status === 'paid');
  const totalPendingNet = pendingPayouts.reduce((s: number, p: any) => s + (p.therapist_net || 0), 0);
  const totalPaidNet = paidPayouts.reduce((s: number, p: any) => s + (p.therapist_net || 0), 0);

  const getPatientsForPayout = (payout: any) => {
    if (!therapistPayments || therapistPayments.length === 0) return '—';
    const monthPayments = therapistPayments.filter((p: any) => {
      const d = new Date(p.created_at);
      return (d.getMonth() + 1) === payout.month && d.getFullYear() === payout.year;
    });
    const names = Array.from(new Set(monthPayments.map((p: any) => p.patients?.name).filter(Boolean)));
    return names.length > 0 ? names.join(', ') : '—';
  };

  const TABS = [
    { id: 'agenda', label: 'Minha Agenda', icon: Calendar },
    { id: 'history', label: 'Histórico', icon: History },
    { id: 'patients', label: 'Pacientes', icon: Users },
    { id: 'repasses', label: 'Meus Repasses', icon: Receipt },
    { id: 'profile', label: 'Meu Perfil', icon: User },
  ];

  // Filtering Logic
  const filterByPeriod = (items: any[], dateField: string) => {
    return items.filter(item => {
      const date = new Date(item[dateField]);
      const now = new Date();
      if (periodFilter === 'mes') {
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
      }
      if (periodFilter === 'trimestre') {
        const diffTime = Math.abs(now.getTime() - date.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        return diffDays <= 90;
      }
      if (periodFilter === 'ano') {
        return date.getFullYear() === now.getFullYear();
      }
      return true;
    });
  };

  const filteredHistory = filterByPeriod(appointmentsHistory, 'start_time');
  const filteredCommissions = filterByPeriod(commissions, 'calculated_at');

  const totalCommissions = filteredCommissions.reduce((acc, curr) => acc + curr.amount, 0);

  // Paginated History
  const totalHistoryPages = Math.ceil(filteredHistory.length / itemsPerPage);
  const paginatedHistory = filteredHistory.slice((historyPage - 1) * itemsPerPage, historyPage * itemsPerPage);

  // Active Patients with search filter and pagination
  const filteredAssignedPatients = assignedPatients.filter(p =>
    p.name?.toLowerCase().includes(patientsSearch.toLowerCase()) ||
    p.phone?.toLowerCase().includes(patientsSearch.toLowerCase())
  );
  const totalPatientsPages = Math.ceil(filteredAssignedPatients.length / itemsPerPage);
  const paginatedPatients = filteredAssignedPatients.slice((patientsPage - 1) * itemsPerPage, patientsPage * itemsPerPage);

  // Paginated Commissions
  const totalCommissionsPages = Math.ceil(filteredCommissions.length / itemsPerPage);
  const paginatedCommissions = filteredCommissions.slice((commissionsPage - 1) * itemsPerPage, commissionsPage * itemsPerPage);

  // Paginated Repasses (Complete Payouts)
  const totalPayoutsPages = Math.ceil(payouts.length / itemsPerPage);
  const paginatedPayouts = payouts.slice((payoutsPage - 1) * itemsPerPage, payoutsPage * itemsPerPage);

  // Paginated Payments List
  const totalPaymentsPages = Math.ceil(therapistPayments.length / itemsPerPage);
  const paginatedPaymentsList = therapistPayments.slice((paymentsPage - 1) * itemsPerPage, paymentsPage * itemsPerPage);

  const handleCallPatient = async (appId: string) => {
     try {
         const { error } = await supabase.from('appointments').update({
             status: 'calling'
         }).eq('id', appId);
         
         if (error) throw error;
         
         fetchData(); 
     } catch(e) {
         console.error(e);
         alert('Erro ao liberar sala.');
     }
  };

  const handleStartSession = async (app: any) => {
     try {
         const { error } = await supabase.from('appointments').update({
             status: 'in_progress'
         }).eq('id', app.id);
         
         if (error) throw error;
         
         fetchData(); 
         
         // Iniciar a sessão ativa no contexto para abrir a tela de registro de sessão (SessionLogger)
         startActiveSession({
             id: app.id,
             patientId: app.patient_id,
             patient: app.patients?.name || 'Paciente',
             time: new Date(app.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
             type: app.type || 'Presencial',
             therapy: app.service_type || 'Terapia Integrativa',
             therapistId: app.therapist_id,
             therapist: currentTherapist?.name || 'Terapeuta'
         });

         // Redireciona diretamente para o registro das sessões
         navigate('/admin/sessoes');
         
     } catch(e) {
         console.error(e);
         alert('Erro ao iniciar sessão.');
     }
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-20">
      {/* Modals */}
      {showProfileModal && profilePatient && (
          <PatientProfileModal patient={profilePatient} onClose={() => setShowProfileModal(false)} />
      )}
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6 bg-white p-6 sm:p-10 rounded-[2rem] sm:rounded-[3rem] border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4 sm:gap-6 min-w-0 flex-1">
          {profile?.photo_url ? (
            <img src={profile.photo_url} alt="Profile" className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl object-cover shadow-xl shadow-indigo-100 border-2 border-white shrink-0" />
          ) : (
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-indigo-600 rounded-3xl flex items-center justify-center text-white text-2xl sm:text-3xl font-bold shadow-xl shadow-indigo-100 shrink-0">
              {currentTherapist?.name?.charAt(0) || 'T'}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl sm:text-3xl font-black text-slate-900 tracking-tight truncate">Olá, {currentTherapist?.name?.split(' ')[0] || 'Terapeuta'}</h2>
              {user?.role === 'admin' && allTherapists.length > 0 && (
                <select
                  value={defaultTherapistId}
                  onChange={(e) => {
                    const selectedId = e.target.value;
                    const selectedT = allTherapists.find(t => t.id === selectedId);
                    if (selectedT) {
                      setDefaultTherapistId(selectedId);
                      setCurrentTherapist(selectedT);
                      // Force local reload after updating state
                      setTimeout(() => {
                        fetchData(true);
                      }, 50);
                    }
                  }}
                  className="px-3 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold rounded-xl text-xs outline-none cursor-pointer hover:bg-indigo-100 transition-all shrink-0"
                >
                  {allTherapists.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-500 font-medium leading-relaxed mt-1">
              {user?.role === 'admin' ? (
                <span>Visualizando agenda do terapeuta <strong className="text-indigo-600 font-bold">{currentTherapist?.name}</strong>.</span>
              ) : (
                <span>Você tem {appointments.length} atendimentos agendados para hoje.</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto mt-4 md:mt-0 shrink-0">
          <button className="p-3.5 sm:p-4 bg-slate-50 text-slate-400 rounded-2xl hover:text-indigo-600 transition-all border border-slate-100 w-full sm:w-auto flex justify-center"><Bell className="w-5 h-5 sm:w-6 sm:h-6" /></button>
          <button onClick={() => setShowAppointmentModal(true)} className="px-5 py-3 sm:px-6 sm:py-4 bg-indigo-600 text-white rounded-2xl text-xs sm:text-sm font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 flex items-center justify-center gap-2 w-full sm:w-auto">
            <Plus className="w-4 h-4 sm:w-5 sm:h-5" /> Novo Agendamento
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex p-1 bg-slate-100 rounded-2xl w-full md:w-fit border border-slate-200 overflow-x-auto scrollbar-thin">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-1.5 sm:gap-2 px-4 py-2.5 sm:px-8 sm:py-4 rounded-xl font-bold text-xs sm:text-sm transition-all whitespace-nowrap",
              activeTab === tab.id 
                ? "bg-white text-indigo-600 shadow-md" 
                : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
            )}
          >
            <tab.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'agenda' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 space-y-6">
            <h3 className="text-2xl font-bold text-slate-900 mb-2">Atendimentos de Hoje</h3>
            {appointments.some(a => a.status === 'arrived') && (
               <div className="mb-6 p-4 bg-amber-50 border border-amber-200 text-amber-700 rounded-2xl flex items-center justify-center font-bold animate-pulse">
                  ⚠️ Há paciente(s) aguardando na recepção!
               </div>
            )}
            <div className="space-y-4">
            {appointments.map((app) => (
              <div key={app.id} className={cn(
                 "group p-6 sm:p-8 rounded-[2.5rem] border shadow-sm hover:shadow-xl hover:scale-[1.01] transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6",
                 app.status === 'arrived' ? 'bg-amber-50 border-amber-200' : 
                 app.status === 'calling' ? 'bg-emerald-50 border-emerald-200' : 
                 app.status === 'in_progress' ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-100'
              )}>
                 <div className="flex items-center gap-4 sm:gap-6 w-full sm:w-auto">
                  <div className="text-center min-w-[60px]">
                    <p className="text-2xl font-black text-slate-900 leading-none">
                      {new Date(app.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">60 min</p>
                  </div>
                  <div className="w-px h-12 bg-slate-100" />
                  <div className="flex-1">
                    <h4 className="text-xl font-bold text-slate-900 truncate">{app.patients?.name || 'Paciente'}</h4>
                    <p className="text-sm text-slate-500 font-medium truncate">{app.service_type || 'Sessão de Terapia'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto justify-end border-t border-slate-100 sm:border-0 pt-4 sm:pt-0 mt-2 sm:mt-0">
                  {app.status === 'arrived' ? (
                     <button onClick={() => handleCallPatient(app.id)} className="flex-1 sm:flex-none px-4 py-3 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600 transition-all shadow-lg flex items-center justify-center animate-bounce">
                        Liberar Sala
                     </button>
                  ) : (app.status === 'calling' || app.status === 'scheduled') ? (
                     <button onClick={() => handleStartSession(app)} className="flex-1 sm:flex-none px-4 py-3 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 transition-all shadow-lg flex items-center justify-center group gap-2">
                        <span>Iniciar Sessão</span>
                        <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                     </button>
                  ) : app.status === 'in_progress' ? (
                     <div className="flex-1 sm:flex-none px-4 py-3 bg-blue-100 text-blue-700 rounded-xl font-bold flex items-center justify-center animate-pulse">
                        Em Atendimento...
                     </div>
                  ) : app.status === 'completed' ? (
                    <div className="flex-1 sm:flex-none p-3 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center" title="Sessão Finalizada">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                  ) : (
                    <button onClick={() => handleFinishSession(app)} className="flex-1 sm:flex-none p-3 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-600 hover:text-white transition-all shadow-sm flex items-center justify-center" title="Finalizar Sessão (NPS)">
                      <CheckCircle2 className="w-5 h-5" />
                    </button>
                  )}
                  {app.status !== 'completed' && app.status !== 'cancelled' && (
                     <div className="flex gap-1">
                      <button 
                        onClick={() => handleOpenRescheduleModal(app)}
                        title="Reagendar Sessão"
                        className="p-3 hover:bg-slate-100 hover:text-indigo-600 rounded-xl transition-colors text-slate-300"
                      >
                        <Calendar className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => handleCancelAppointment(app)}
                        title="Desmarcar Sessão"
                        className="p-3 hover:bg-slate-100 hover:text-rose-600 rounded-xl transition-colors text-slate-300"
                      >
                        <X className="w-5 h-5" />
                      </button>
                     </div>
                  )}
                  <button onClick={() => navigate('/admin/sessoes')} title="Ir para Prontuário" className="flex-1 sm:flex-none p-3 bg-slate-50 text-slate-400 rounded-xl hover:bg-indigo-600 hover:text-white transition-all border border-slate-100 shadow-sm flex items-center justify-center">
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
            </div>
            {appointments.length === 0 && (
              <div className="p-20 text-center bg-white rounded-[3rem] border border-dashed border-slate-200 text-slate-400 font-medium">
                Nenhum agendamento para hoje. Aproveite o tempo para atualizar os prontuários!
              </div>
            )}
          </div>
          <div className="space-y-6">
            <div className="bg-slate-900 rounded-[3rem] p-8 text-white shadow-xl">
              <h4 className="text-lg font-bold mb-6">Mini Calendário</h4>
              <div className="grid grid-cols-7 gap-2 text-center text-[10px] font-black uppercase text-slate-500 mb-4">
                {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => <span key={`${d}-${i}`}>{d}</span>)}
              </div>
              <div className="grid grid-cols-7 gap-2 text-center">
                {Array.from({length: 31}).map((_, i) => {
                  const dayNum = i + 1;
                  const now = new Date();
                  const dayAppointments = [...appointments, ...appointmentsHistory].filter(app => {
                    const d = new Date(app.start_time);
                    return d.getDate() === dayNum && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                  });
                  const count = dayAppointments.length;

                  return (
                    <div 
                      key={i} 
                      onClick={() => count > 0 && setSelectedDateAppointments({ date: new Date(now.getFullYear(), now.getMonth(), dayNum), appts: dayAppointments })}
                      className={cn(
                        "aspect-square rounded-xl flex flex-col items-center justify-center font-bold text-sm transition-all relative group",
                        dayNum === now.getDate() ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20" : count > 0 ? "hover:bg-slate-100 cursor-pointer" : "hover:bg-white/10"
                      )}
                    >
                      <span>{dayNum}</span>
                      {count > 0 && (
                        <div className="absolute top-1 right-1 w-3.5 h-3.5 bg-rose-500 text-white text-[8px] font-black rounded-full flex items-center justify-center border border-slate-900 group-hover:scale-110 transition-transform">
                          {count}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="bg-indigo-50 p-8 rounded-[2.5rem] border border-indigo-100">
                <h4 className="text-indigo-900 font-bold mb-2">Resumo</h4>
                <p className="text-indigo-700 text-sm leading-relaxed">Você tem {appointments.length} atendimentos presenciais hoje e 2 prontuários pendentes de assinatura.</p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="bg-white border border-slate-100 rounded-[3rem] shadow-sm overflow-hidden">
            <div className="p-10 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <h3 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                   <History className="w-6 h-6 text-indigo-600" /> Histórico de Sessões
                </h3>
                <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200 w-fit">
                    {['mes', 'trimestre', 'ano'].map(p => (
                        <button 
                            key={p} 
                            onClick={() => setPeriodFilter(p)}
                            className={cn(
                                "px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all",
                                periodFilter === p ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                            )}
                        >
                            {p === 'mes' ? 'Mensal' : p === 'trimestre' ? 'Trimestral' : 'Anual'}
                        </button>
                    ))}
                </div>
            </div>
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                        <tr>
                            <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Data / Hora</th>
                            <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Paciente</th>
                            <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Serviço</th>
                            <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {paginatedHistory.map((app) => (
                            <tr key={app.id} className="hover:bg-slate-50/50 transition-all">
                                <td className="px-10 py-6">
                                   <p className="font-bold text-slate-900">{new Date(app.start_time).toLocaleDateString()}</p>
                                   <p className="text-xs text-slate-500 font-medium">{new Date(app.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                </td>
                                <td className="px-10 py-6 font-bold text-slate-900">{app.patients?.name || 'Paciente'}</td>
                                <td className="px-10 py-6 text-slate-500 font-medium">{app.service_type || 'Terapia'}</td>
                                <td className="px-10 py-6 text-right">
                                   <span className={cn(
                                       "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                                       app.status === 'completed' ? "bg-emerald-50 text-emerald-600" :
                                       app.status === 'cancelled' ? "bg-rose-50 text-rose-600" :
                                       (app.status === 'confirmed' || app.status === 'confirmado') ? "bg-sky-50 text-sky-600" : "bg-slate-100 text-slate-500"
                                   )}>
                                       {app.status === 'completed' ? 'Concluído' : 
                                        app.status === 'cancelled' ? 'Cancelado' : 
                                        (app.status === 'confirmed' || app.status === 'confirmado') ? 'Confirmado' : 'Agendado'}
                                   </span>
                                </td>
                            </tr>
                        ))}
                        {filteredHistory.length === 0 && (
                            <tr>
                                <td colSpan={4} className="py-20 text-center text-slate-400 font-medium">Nenhum atendimento encontrado neste período.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            {totalHistoryPages > 1 && (
              <div className="p-6 border-t border-slate-100 flex items-center justify-between bg-slate-50/30">
                <button 
                  onClick={() => setHistoryPage(p => Math.max(p - 1, 1))} 
                  disabled={historyPage === 1}
                  className="px-5 py-2 bg-white border border-slate-200 rounded-xl font-bold disabled:opacity-40 text-sm hover:bg-slate-50 cursor-pointer animate-in fade-in"
                >
                  Anterior
                </button>
                <span className="text-sm font-bold text-slate-400">Pág. {historyPage} / {totalHistoryPages}</span>
                <button 
                  onClick={() => setHistoryPage(p => Math.min(p + 1, totalHistoryPages))} 
                  disabled={historyPage === totalHistoryPages}
                  className="px-5 py-2 bg-white border border-slate-200 rounded-xl font-bold disabled:opacity-40 text-sm hover:bg-slate-50 cursor-pointer animate-in fade-in"
                >
                  Próxima
                </button>
              </div>
            )}
        </div>
      )}

      {activeTab === 'patients' && (
        <div className="space-y-8">
            <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                    <h3 className="text-2xl font-bold text-slate-900">Meus Pacientes Ativos</h3>
                    <div className="relative">
                        <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                        <input 
                          value={patientsSearch}
                          onChange={(e) => setPatientsSearch(e.target.value)}
                          className="pl-12 pr-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none w-full md:w-80 font-medium" 
                          placeholder="Buscar paciente..." 
                        />
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {paginatedPatients.map((p, idx) => (
                        <div key={p.id} className="p-8 rounded-[2.5rem] border border-slate-100 bg-slate-50/30 hover:bg-white hover:shadow-xl transition-all group">
                            <div className="flex items-center justify-between mb-6">
                                <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center font-bold text-xl shadow-sm text-indigo-600">
                                    {p.name?.charAt(0)}
                                </div>
                                <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-widest">Ativo</span>
                            </div>
                            <h4 className="text-xl font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{p.name}</h4>
                            <p className="text-sm text-slate-500 mt-1 font-medium">{p.phone || 'Sem telefone'}</p>
                            <div className="mt-6 pt-6 border-t border-slate-100 flex gap-2">
                                <button 
                                    onClick={() => { setSelectedPatient(p); setShowRecordModal(true); }}
                                    className="flex-1 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all flex items-center justify-center gap-2"
                                >
                                    <ClipboardList className="w-4 h-4" /> Prontuário
                                </button>
                                <button 
                                    onClick={() => { setProfilePatient(p); setShowProfileModal(true); }}
                                    className="p-3 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-indigo-600 hover:border-indigo-600 transition-all"
                                    title="Visão 360º"
                                >
                                    <History className="w-4 h-4" />
                                </button>
                                <button className="p-3 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-indigo-600 transition-all">
                                    <MessageSquare className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                    {filteredAssignedPatients.length === 0 && (
                      <p className="col-span-full py-10 text-center text-slate-400 font-medium">Nenhum paciente ativo encontrado.</p>
                    )}
                </div>
                {totalPatientsPages > 1 && (
                  <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between">
                    <button 
                      onClick={() => setPatientsPage(p => Math.max(p - 1, 1))} 
                      disabled={patientsPage === 1}
                      className="px-5 py-2 bg-white border border-slate-200 rounded-xl font-bold disabled:opacity-40 text-sm hover:bg-slate-50 cursor-pointer animate-in fade-in"
                    >
                      Anterior
                    </button>
                    <span className="text-sm font-bold text-slate-400">Pág. {patientsPage} / {totalPatientsPages}</span>
                    <button 
                      onClick={() => setPatientsPage(p => Math.min(p + 1, totalPatientsPages))} 
                      disabled={patientsPage === totalPatientsPages}
                      className="px-5 py-2 bg-white border border-slate-200 rounded-xl font-bold disabled:opacity-40 text-sm hover:bg-slate-50 cursor-pointer animate-in fade-in"
                    >
                      Próxima
                    </button>
                  </div>
                )}
            </div>
        </div>
      )}

      {activeTab === 'commissions' && (
        <div className="space-y-10">
            {/* Filter */}
            <div className="flex items-center justify-between bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
               <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2"><Filter className="w-5 h-5 text-indigo-600" /> Período de Apuração</h3>
               <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
                    {['mes', 'trimestre', 'ano'].map(p => (
                        <button 
                            key={p} 
                            onClick={() => setPeriodFilter(p)}
                            className={cn(
                                "px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all",
                                periodFilter === p ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                            )}
                        >
                            {p === 'mes' ? 'Mensal' : p === 'trimestre' ? 'Trimestral' : 'Anual'}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm relative overflow-hidden">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Devido à Clínica</p>
                    <h3 className="text-4xl font-black text-amber-600">R$ {totalCommissions.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</h3>
                    <p className="text-xs text-amber-600 font-bold mt-2 flex items-center gap-1"><TrendingUp className="w-4 h-4" /> Atualizado</p>
                </div>
                <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Sessões Faturadas</p>
                    <h3 className="text-4xl font-black text-slate-900">{filteredCommissions.length}</h3>
                    <p className="text-xs text-slate-400 font-bold mt-2 italic">Apenas concluídas</p>
                </div>
                <div className="bg-slate-900 p-10 rounded-[3rem] text-white shadow-xl">
                    <p className="text-[10px] font-black text-white/50 uppercase tracking-widest mb-2">Acerto com a Clínica</p>
                    <h3 className="text-4xl font-black">R$ {totalCommissions.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</h3>
                    <p className="text-xs text-white/70 font-bold mt-2">Vencimento: Dia 05</p>
                </div>
            </div>

            <div className="bg-white border border-slate-100 rounded-[3rem] shadow-sm overflow-hidden">
                <div className="p-10 border-b border-slate-50 flex items-center justify-between">
                    <h3 className="text-2xl font-bold text-slate-900">Extrato de Taxas</h3>
                    <button className="text-slate-900 font-bold text-sm">Exportar PDF</button>
                </div>
                <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 sticky top-0 z-10">
                            <tr>
                                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Data</th>
                                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Paciente</th>
                                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Valor Base</th>
                                <th className="px-10 py-6 text-[10px] font-black text-amber-600 uppercase tracking-widest text-right">Taxa da Clínica</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {paginatedCommissions.map((c) => (
                                <tr key={c.id} className="hover:bg-slate-50/50 transition-all">
                                    <td className="px-10 py-6 font-medium text-slate-500">{new Date(c.calculated_at).toLocaleDateString()}</td>
                                    <td className="px-10 py-6 font-bold text-slate-900">Sessão Realizada</td>
                                    <td className="px-10 py-6 text-center text-slate-500">R$ {(c.amount * 2).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                                    <td className="px-10 py-6 text-right font-black text-amber-600 text-lg">R$ {c.amount.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                                </tr>
                            ))}
                            {filteredCommissions.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="py-20 text-center text-slate-400 font-medium">Nenhuma taxa de sala registrada neste período.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                {totalCommissionsPages > 1 && (
                  <div className="p-6 border-t border-slate-100 flex items-center justify-between bg-slate-50/30">
                    <button 
                      onClick={() => setCommissionsPage(p => Math.max(p - 1, 1))} 
                      disabled={commissionsPage === 1}
                      className="px-5 py-2 bg-white border border-slate-200 rounded-xl font-bold disabled:opacity-40 text-sm hover:bg-slate-50 cursor-pointer animate-in fade-in"
                    >
                      Anterior
                    </button>
                    <span className="text-sm font-bold text-slate-400">Pág. {commissionsPage} / {totalCommissionsPages}</span>
                    <button 
                      onClick={() => setCommissionsPage(p => Math.min(p + 1, totalCommissionsPages))} 
                      disabled={commissionsPage === totalCommissionsPages}
                      className="px-5 py-2 bg-white border border-slate-200 rounded-xl font-bold disabled:opacity-40 text-sm hover:bg-slate-50 cursor-pointer animate-in fade-in"
                    >
                      Próxima
                    </button>
                  </div>
                )}
            </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* MEUS REPASSES — Transparência total para o terapeuta            */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'repasses' && (
        <div className="space-y-8 animate-in fade-in duration-300">
          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
              <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-2">Aguardando Pagamento</p>
              <h3 className="text-3xl font-black text-slate-900">R$ {totalPendingNet.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
              <p className="text-xs text-slate-400 mt-2 font-medium">{pendingPayouts.length} repasse(s) pendente(s)</p>
            </div>
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
              <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-2">Total Recebido (Histórico)</p>
              <h3 className="text-3xl font-black text-slate-900">R$ {totalPaidNet.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
              <p className="text-xs text-slate-400 mt-2 font-medium">{paidPayouts.length} repasse(s) pago(s)</p>
            </div>
            <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-xl">
              <p className="text-[10px] font-black text-white/50 uppercase tracking-widest mb-2">Total de Repasses</p>
              <h3 className="text-3xl font-black">{payouts.length}</h3>
              <p className="text-xs text-white/60 mt-2 font-medium">Ao longo de todo o período</p>
            </div>
          </div>

          {/* Pending Payouts */}
          {pendingPayouts.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-[2.5rem] p-8">
              <h4 className="text-lg font-bold text-amber-800 flex items-center gap-2 mb-5">
                <Clock className="w-5 h-5" /> Repasses Pendentes
              </h4>
              <div className="space-y-3">
                {pendingPayouts.map((p: any) => {
                  const patientsList = getPatientsForPayout(p);
                  return (
                    <div key={p.id} className="bg-white rounded-2xl p-5 border border-amber-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <p className="font-black text-slate-900">{MONTHS[(p.month || 1) - 1]} / {p.year}</p>
                        {patientsList !== '—' && (
                          <p className="text-xs text-slate-500 font-medium mt-1">
                            Pacientes: <span className="text-slate-800 font-bold">{patientsList}</span>
                          </p>
                        )}
                        <div className="flex gap-4 mt-2 text-xs text-slate-500 font-medium">
                          <span>Bruto: R$ {(p.gross_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          <span className="text-indigo-600">Taxa clínica: R$ {(p.clinic_share || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-xs text-slate-400 font-medium">Seu repasse</p>
                          <p className="font-black text-emerald-600 text-xl">R$ {(p.therapist_net || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        </div>
                        <span className="px-3 py-1.5 bg-amber-100 text-amber-700 rounded-full text-xs font-black uppercase border border-amber-200">Aguardando</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* History Table */}
          <div className="bg-white border border-slate-100 rounded-[3rem] shadow-sm overflow-hidden">
            <div className="p-8 border-b border-slate-100">
              <h4 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-600" /> Histórico Completo de Repasses
              </h4>
              <p className="text-sm text-slate-400 mt-1">Transparência total: veja todos os repasses, como foram calculados e quando foram pagos.</p>
            </div>
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 sticky top-0 z-10">
                  <tr>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Período</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Pacientes</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Faturamento Bruto</th>
                    <th className="px-8 py-5 text-[10px] font-black text-indigo-600 uppercase tracking-widest">Taxa Clínica</th>
                    <th className="px-8 py-5 text-[10px] font-black text-emerald-600 uppercase tracking-widest">Valor Líquido</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Data Pagamento</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {paginatedPayouts.map((p: any) => (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-8 py-5 font-bold text-slate-900">{MONTHS[(p.month || 1) - 1]} / {p.year}</td>
                      <td className="px-8 py-5 text-xs text-slate-600 font-semibold max-w-[200px] truncate" title={getPatientsForPayout(p)}>{getPatientsForPayout(p)}</td>
                      <td className="px-8 py-5 font-medium text-slate-700">R$ {(p.gross_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                      <td className="px-8 py-5">
                        <div>
                          <p className="font-bold text-indigo-600">R$ {(p.clinic_share || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                          <p className="text-[10px] text-slate-400">{p.gross_total > 0 ? Math.round((p.clinic_share / p.gross_total) * 100) : 0}% do bruto</p>
                        </div>
                      </td>
                      <td className="px-8 py-5 font-black text-emerald-600 text-lg">R$ {(p.therapist_net || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                      <td className="px-8 py-5 text-slate-400 text-sm font-medium">{p.paid_at ? new Date(p.paid_at).toLocaleDateString('pt-BR') : '—'}</td>
                      <td className="px-8 py-5 text-right">
                        <span className={cn(
                          "px-3 py-1.5 rounded-full text-[10px] font-black uppercase border",
                          p.status === 'paid'
                            ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                            : "bg-amber-50 text-amber-600 border-amber-200"
                        )}>
                          {p.status === 'paid' ? '✅ Pago' : '⏳ Pendente'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {payouts.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-20 text-center text-slate-400 font-medium">
                        Nenhum repasse registrado ainda. Os repasses aparecem aqui assim que a clínica os processa.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {totalPayoutsPages > 1 && (
              <div className="p-6 border-t border-slate-100 flex items-center justify-between bg-slate-50/30">
                <button 
                  onClick={() => setPayoutsPage(p => Math.max(p - 1, 1))} 
                  disabled={payoutsPage === 1}
                  className="px-5 py-2 bg-white border border-slate-200 rounded-xl font-bold disabled:opacity-40 text-sm hover:bg-slate-50 cursor-pointer animate-in fade-in"
                >
                  Anterior
                </button>
                <span className="text-sm font-bold text-slate-400">Pág. {payoutsPage} / {totalPayoutsPages}</span>
                <button 
                  onClick={() => setPayoutsPage(p => Math.min(p + 1, totalPayoutsPages))} 
                  disabled={payoutsPage === totalPayoutsPages}
                  className="px-5 py-2 bg-white border border-slate-200 rounded-xl font-bold disabled:opacity-40 text-sm hover:bg-slate-50 cursor-pointer animate-in fade-in"
                >
                  Próxima
                </button>
              </div>
            )}
          </div>

          {/* Extrato Detalhado de Atendimentos */}
          <div className="bg-white border border-slate-100 rounded-[3rem] shadow-sm overflow-hidden">
            <div className="p-8 border-b border-slate-100">
              <h4 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600" /> Extrato Detalhado de Atendimentos
              </h4>
              <p className="text-sm text-slate-400 mt-1">Lista de atendimentos faturados e pagos no período, com a identificação de cada paciente e comissões.</p>
            </div>
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 sticky top-0 z-10">
                  <tr>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Data</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Paciente</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Serviço / Descrição</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Origem</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Valor Bruto</th>
                    <th className="px-8 py-5 text-[10px] font-black text-indigo-600 uppercase tracking-widest text-center">Taxa Clínica</th>
                    <th className="px-8 py-5 text-[10px] font-black text-emerald-600 uppercase tracking-widest text-right">Seu Repasse (Línguo)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {paginatedPaymentsList.map((p: any) => {
                    const clinicRate = (p.referral_source || 'therapist') === 'clinic'
                      ? (currentTherapist?.commission_rate_clinic ?? 50)
                      : (currentTherapist?.commission_rate_self ?? 25);
                    const grossValue = Math.abs(p.amount);
                    const clinicShare = grossValue * (clinicRate / 100);
                    const therapistNet = grossValue - clinicShare;

                    return (
                      <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-8 py-5 text-sm text-slate-500 font-medium font-mono">
                          {new Date(p.created_at).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-8 py-5 font-bold text-slate-900">
                          {p.patients?.name || 'Paciente'}
                        </td>
                        <td className="px-8 py-5 font-medium text-slate-700">
                          {p.description}
                        </td>
                        <td className="px-8 py-5">
                          <span className={cn(
                            "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider",
                            p.referral_source === 'clinic' ? "bg-indigo-50 text-indigo-600" : "bg-emerald-50 text-emerald-600"
                          )}>
                            {p.referral_source === 'clinic' ? '🏥 Clínica' : '👨‍⚕️ Terapeuta'}
                          </span>
                        </td>
                        <td className="px-8 py-5 text-center font-bold text-slate-700">
                          R$ {grossValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-8 py-5 text-center font-bold text-indigo-600">
                          R$ {clinicShare.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          <span className="text-[10px] text-slate-400 font-medium block">({clinicRate}%)</span>
                        </td>
                        <td className="px-8 py-5 text-right font-black text-emerald-600 text-lg">
                          R$ {therapistNet.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          <span className="text-[10px] text-slate-400 font-medium block">({100 - clinicRate}%)</span>
                        </td>
                      </tr>
                    );
                  })}
                  {therapistPayments.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-20 text-center text-slate-400 font-medium">
                        Nenhum atendimento faturado ou pago registrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {totalPaymentsPages > 1 && (
              <div className="p-6 border-t border-slate-100 flex items-center justify-between bg-slate-50/30">
                <button 
                  onClick={() => setPaymentsPage(p => Math.max(p - 1, 1))} 
                  disabled={paymentsPage === 1}
                  className="px-5 py-2 bg-white border border-slate-200 rounded-xl font-bold disabled:opacity-40 text-sm hover:bg-slate-50 cursor-pointer animate-in fade-in"
                >
                  Anterior
                </button>
                <span className="text-sm font-bold text-slate-400">Pág. {paymentsPage} / {totalPaymentsPages}</span>
                <button 
                  onClick={() => setPaymentsPage(p => Math.min(p + 1, totalPaymentsPages))} 
                  disabled={paymentsPage === totalPaymentsPages}
                  className="px-5 py-2 bg-white border border-slate-200 rounded-xl font-bold disabled:opacity-40 text-sm hover:bg-slate-50 cursor-pointer animate-in fade-in"
                >
                  Próxima
                </button>
              </div>
            )}
          </div>

          {/* Explanation Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-sm text-slate-600">
            <h5 className="font-black text-slate-800 mb-3 flex items-center gap-2"><Percent className="w-4 h-4 text-indigo-600" /> Como é calculado o seu repasse?</h5>
            <ul className="space-y-2 text-slate-500">
              <li className="flex items-start gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                <span><strong className="text-slate-700">Paciente indicado pela clínica</strong>: a clínica retém uma porcentagem (ex: 50%) do valor da sessão. O restante (50%) é o seu repasse.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                <span><strong className="text-slate-700">Paciente que você trouxe</strong>: a clínica retém uma porcentagem menor (ex: 25%). O restante (75%) é o seu repasse.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-2 h-2 rounded-full bg-slate-400 mt-1.5 shrink-0" />
                <span><strong className="text-slate-700">Não há taxa de sala separada.</strong> O uso do espaço já está incluído na porcentagem da clínica — nenhum valor extra é descontado.</span>
              </li>
            </ul>
            <p className="mt-3 text-xs text-slate-400 font-medium">Os percentuais exatos são configurados individualmente pela administração. Em caso de dúvidas, entre em contato.</p>
          </div>
        </div>
      )}

      {activeTab === 'profile' && (
        <div className="max-w-4xl mx-auto space-y-10">
            {/* Foto e Informações Básicas */}
            <div className="bg-white p-12 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col items-center text-center">
                <div className="w-32 h-32 rounded-[2.5rem] flex items-center justify-center text-white text-5xl font-black mb-8 shadow-2xl shadow-indigo-100 relative group bg-indigo-600 overflow-hidden">
                    {profile?.photo_url ? (
                        <img src={profile.photo_url} alt="Foto do Terapeuta" className="w-full h-full object-cover" />
                    ) : (
                        profile?.name?.charAt(0) || 'T'
                    )}
                    <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <ImageIcon className="w-8 h-8 text-white" />
                    </div>
                </div>
                
                <div className="w-full max-w-lg mx-auto space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-left block w-full">Nome Completo</label>
                        <input 
                            value={profile?.name || ''} 
                            onChange={(e) => setProfile({...profile, name: e.target.value})}
                            className="text-xl font-black text-slate-900 w-full bg-slate-50 px-6 py-4 outline-none focus:ring-2 focus:ring-indigo-500/20 rounded-2xl border border-slate-100"
                        />
                    </div>
                    
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-left block w-full">Foto de Perfil</label>
                        <div className="flex gap-4 items-center">
                            <input 
                                type="file"
                                accept="image/*"
                                onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    setLoading(true);
                                    
                                    try {
                                        // 1. Resize to 500x500
                                        const img = new Image();
                                        img.src = URL.createObjectURL(file);
                                        await new Promise((resolve) => (img.onload = resolve));
                                        
                                        const canvas = document.createElement('canvas');
                                        canvas.width = 500;
                                        canvas.height = 500;
                                        const ctx = canvas.getContext('2d');
                                        if (ctx) {
                                            // Crop to square and resize
                                            const size = Math.min(img.width, img.height);
                                            const sx = (img.width - size) / 2;
                                            const sy = (img.height - size) / 2;
                                            ctx.drawImage(img, sx, sy, size, size, 0, 0, 500, 500);
                                        }
                                        
                                        const blob = await new Promise<Blob | null>((resolve) => 
                                            canvas.toBlob(resolve, 'image/jpeg', 0.9)
                                        );
                                        
                                        if (!blob) throw new Error("Erro ao processar imagem");
                                        
                                        // 2. Upload to supabase
                                        const therapistName = profile?.name ? profile.name.replace(/\s+/g, '_').toLowerCase() : 'terapeuta';
                                        const fileName = `${therapistName}-${Date.now()}.jpg`;
                                        
                                        const { data: uploadData, error: uploadError } = await supabase.storage
                                            .from('avatars')
                                            .upload(fileName, blob, { contentType: 'image/jpeg' });
                                            
                                        if (uploadError) throw uploadError;
                                        
                                        // 3. Get URL
                                        const { data: urlData } = supabase.storage
                                            .from('avatars')
                                            .getPublicUrl(fileName);
                                            
                                        setProfile({...profile, photo_url: urlData.publicUrl});
                                        setToastMessage('Foto atualizada com sucesso!');
                                        setTimeout(() => setToastMessage(null), 3500);
                                    } catch (err: any) {
                                        console.error(err);
                                        setToastMessage('Erro ao fazer upload da foto: ' + (err.message || ''));
                                        setTimeout(() => setToastMessage(null), 3500);
                                    } finally {
                                        setLoading(false);
                                    }
                                }}
                                className="hidden"
                                id="avatar-upload"
                            />
                            <label htmlFor="avatar-upload" className="cursor-pointer bg-indigo-50 text-indigo-600 px-6 py-4 rounded-2xl border border-indigo-100 font-bold hover:bg-indigo-100 transition-colors flex items-center justify-center text-sm w-full">
                                <ImageIcon className="w-5 h-5 mr-2" /> Fazer Upload da Foto (500x500)
                            </label>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-left block w-full">Cargo / Especialidade</label>
                            <input 
                                value={profile?.role || ''} 
                                onChange={(e) => setProfile({...profile, role: e.target.value})}
                                className="text-slate-500 font-medium text-sm w-full bg-slate-50 px-6 py-4 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 border border-slate-100"
                                placeholder="Psicólogo"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-left block w-full">Registro Profissional</label>
                            <input 
                                value={profile?.registration_number || ''} 
                                onChange={(e) => setProfile({...profile, registration_number: e.target.value})}
                                className="text-slate-500 font-medium text-sm w-full bg-slate-50 px-6 py-4 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 border border-slate-100"
                                placeholder="CRP/CRM"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Modalidade de Atendimento */}
            <div className="bg-white p-12 rounded-[3rem] border border-slate-100 shadow-sm space-y-8">
                <div>
                   <h4 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                       <MapPin className="w-7 h-7 text-indigo-600" /> Modalidade de Atendimento
                   </h4>
                   <p className="text-slate-500 text-sm mt-2 font-medium">Isso será utilizado pelo robô do WhatsApp na hora de oferecer as opções aos pacientes.</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                        { id: 'presencial', label: 'Presencial', icon: User },
                        { id: 'online', label: 'Online (Telemedicina)', icon: Video },
                        { id: 'ambos', label: 'Ambos (Híbrido)', icon: MonitorSmartphone }
                    ].map(mod => (
                        <button
                            key={mod.id}
                            onClick={() => setProfile({...profile, modality: mod.id})}
                            className={cn(
                                "p-6 rounded-2xl border-2 font-bold flex flex-col items-center justify-center gap-4 transition-all hover:scale-[1.02]",
                                profile?.modality === mod.id 
                                    ? "bg-indigo-50 border-indigo-600 text-indigo-700 shadow-lg shadow-indigo-100" 
                                    : "bg-white border-slate-200 text-slate-500 hover:border-indigo-300"
                            )}
                        >
                            <mod.icon className={cn("w-8 h-8", profile?.modality === mod.id ? "text-indigo-600" : "text-slate-400")} />
                            {mod.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Configuração de Horários (Working Hours) */}
            <div className="bg-white p-12 rounded-[3rem] border border-slate-100 shadow-sm space-y-10">
                <div>
                   <h4 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                       <Clock className="w-7 h-7 text-indigo-600" /> Grade de Horários
                   </h4>
                   <p className="text-slate-500 text-sm mt-2 font-medium">Defina os blocos de horário que você está disponível para agendamentos automáticos.</p>
                </div>

                <div className="space-y-4">
                    {profile?.working_hours && Object.keys(profile.working_hours).map((day) => (
                        <div key={day} className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                            <div className="flex items-center justify-between mb-4">
                               <span className="font-bold text-slate-900 capitalize text-lg">{day}</span>
                               <button 
                                 onClick={() => handleAddHourBlock(day)}
                                 className="px-4 py-2 bg-white text-indigo-600 rounded-xl text-xs font-bold shadow-sm border border-slate-200 hover:border-indigo-600 transition-all flex items-center gap-1"
                               >
                                 <Plus className="w-3 h-3" /> Add Horário
                               </button>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {profile.working_hours[day].map((h: string, idx: number) => (
                                    <div key={idx} className="flex items-center gap-2">
                                        <input 
                                            value={h} 
                                            onChange={(e) => handleUpdateHourBlock(day, idx, e.target.value)}
                                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-sm text-center outline-none focus:ring-2 focus:ring-indigo-500"
                                            placeholder="08:00 às 12:00"
                                        />
                                        <button 
                                          onClick={() => handleRemoveHourBlock(day, idx)}
                                          className="p-3 text-rose-400 hover:text-white hover:bg-rose-500 rounded-xl transition-all"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                                {profile.working_hours[day].length === 0 && (
                                    <p className="text-slate-400 text-xs font-bold italic col-span-full py-2">Sem expediente neste dia.</p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <button 
                onClick={handleSaveProfile}
                className="w-full py-6 bg-indigo-600 text-white rounded-[2rem] font-black text-xl hover:bg-indigo-700 transition-all shadow-2xl shadow-indigo-200 flex justify-center items-center gap-3"
            >
                {loading ? <Clock className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />}
                Salvar Meu Perfil
            </button>
        </div>
      )}

      {/* Record Modal */}
      {showRecordModal && selectedPatient && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
           <div className="bg-white rounded-[3rem] w-full max-w-2xl shadow-2xl border border-slate-100 overflow-hidden">
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                 <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg"><ClipboardList className="w-6 h-6" /></div>
                    <div>
                        <h3 className="text-2xl font-black text-slate-900 tracking-tight">Prontuário Digital</h3>
                        <p className="text-sm text-slate-400 font-medium">Paciente: {selectedPatient.name}</p>
                    </div>
                 </div>
                 <button onClick={() => { setShowRecordModal(false); setSelectedPatient(null); }} className="p-2 hover:bg-white rounded-full text-slate-400 transition-all border border-transparent hover:border-slate-200"><X className="w-6 h-6" /></button>
              </div>
              <div className="p-8 space-y-6 max-h-[75vh] overflow-y-auto">
                 {/* Pacotes Ativos */}
                 {patientPackages.length > 0 && (
                    <div className="space-y-3 mb-6">
                       <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2"><Award className="w-4 h-4 text-indigo-600"/> Pacotes Ativos</h4>
                       {patientPackages.map(pkg => {
                          const progress = Math.min((pkg.used_sessions / pkg.total_sessions) * 100, 100);
                          return (
                             <div key={pkg.id} className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl">
                                <div className="flex justify-between items-center mb-2">
                                   <p className="font-bold text-indigo-900">{pkg.services?.name}</p>
                                   <p className="text-xs font-black text-indigo-600 bg-white px-2 py-1 rounded-lg">{pkg.used_sessions} de {pkg.total_sessions} sessões</p>
                                </div>
                                <div className="w-full bg-indigo-100 rounded-full h-2.5">
                                   <div className="bg-indigo-600 h-2.5 rounded-full transition-all" style={{ width: `${progress}%` }}></div>
                                </div>
                             </div>
                          );
                       })}
                    </div>
                 )}
                 
                 <div className="flex gap-4 p-1.5 bg-slate-100 rounded-2xl w-fit">
                    {['evolution', 'anamnesis'].map(type => (
                        <button 
                            key={type}
                            onClick={() => setNewRecord({...newRecord, type})}
                            className={cn(
                                "px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                                newRecord.type === type ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                            )}
                        >
                            {type === 'evolution' ? 'Evolução' : 'Anamnese'}
                        </button>
                    ))}
                 </div>
                 {newRecord.type === 'anamnesis' ? (() => {
                     if (!isResponsible) {
                       return (
                         <div className="py-12 px-6 text-center space-y-4 bg-slate-50 rounded-3xl border border-slate-200/60 animate-in zoom-in-95 duration-300">
                           <div className="mx-auto w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500 shadow-sm">
                             <AlertCircle className="w-6 h-6" />
                           </div>
                           <div className="space-y-1 max-w-sm mx-auto">
                             <h5 className="font-extrabold text-slate-900 text-lg">Acesso Restrito</h5>
                             <p className="text-xs text-slate-500 leading-relaxed font-medium">
                               Apenas o terapeuta responsável pelo acompanhamento deste paciente tem permissão para visualizar e editar a Ficha de Anamnese.
                             </p>
                           </div>
                           <div className="pt-2">
                             <button onClick={() => setNewRecord({...newRecord, type: 'evolution'})} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm">
                               Voltar para Evolução
                             </button>
                           </div>
                         </div>
                       );
                     }

                     return (
                       <div className="space-y-6 animate-in fade-in duration-300">
                         {activeTemplate && activeTemplate.fields && activeTemplate.fields.length > 0 ? (
                           // Render dynamic template fields
                           activeTemplate.fields.map((field: any, idx: number) => {
                             const val = editResponses[field.id] !== undefined ? editResponses[field.id] : '';
                             return (
                               <div key={field.id} className="space-y-2">
                                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                   {field.label} {field.required && <span className="text-rose-500">*</span>}
                                 </label>
                                 {field.type === 'textarea' ? (
                                   <textarea 
                                     value={val}
                                     onChange={(e) => setEditResponses({...editResponses, [field.id]: e.target.value})}
                                     className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none min-h-[100px] focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium text-slate-700"
                                     placeholder="Digite a resposta..."
                                   />
                                 ) : field.type === 'date' ? (
                                   <input 
                                     type="date"
                                     value={val}
                                     onChange={(e) => setEditResponses({...editResponses, [field.id]: e.target.value})}
                                     className="px-6 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-slate-700 focus:ring-4 focus:ring-indigo-500/10 transition-all"
                                   />
                                 ) : field.type === 'select' ? (
                                   <select 
                                     value={val}
                                     onChange={(e) => setEditResponses({...editResponses, [field.id]: e.target.value})}
                                     className="w-full px-6 py-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-slate-700 focus:ring-4 focus:ring-indigo-500/10 transition-all appearance-none cursor-pointer"
                                   >
                                     <option value="">Selecione...</option>
                                     {field.options && field.options.map((opt: string, i: number) => (
                                       <option key={i} value={opt}>{opt}</option>
                                     ))}
                                   </select>
                                 ) : field.type === 'yesno' ? (
                                   <div className="flex gap-2">
                                     {['Sim', 'Não'].map(opt => (
                                       <button
                                         key={opt}
                                         type="button"
                                         onClick={() => setEditResponses({...editResponses, [field.id]: opt})}
                                         className={cn(
                                           "px-5 py-2.5 rounded-xl text-xs font-bold border transition-all",
                                           val === opt 
                                             ? opt === 'Sim' ? "bg-indigo-600 text-white border-indigo-600" : "bg-slate-700 text-white border-slate-700"
                                             : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                                         )}
                                       >
                                         {opt}
                                       </button>
                                     ))}
                                   </div>
                                 ) : field.type === 'scale' ? (
                                   <div className="space-y-1">
                                     <div className="flex gap-1.5 flex-wrap">
                                       {Array.from({ length: 11 }, (_, i) => (
                                         <button
                                           key={i}
                                           type="button"
                                           onClick={() => setEditResponses({...editResponses, [field.id]: i})}
                                           className={cn(
                                             "w-9 h-9 rounded-lg text-xs font-bold border flex items-center justify-center transition-all",
                                             val === i ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200"
                                           )}
                                         >
                                           {i}
                                         </button>
                                       ))}
                                     </div>
                                   </div>
                                 ) : (
                                   <input 
                                     type="text"
                                     value={val}
                                     onChange={(e) => setEditResponses({...editResponses, [field.id]: e.target.value})}
                                     className="w-full px-6 py-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-medium text-slate-700 focus:ring-4 focus:ring-indigo-500/10 transition-all"
                                     placeholder="Digite a resposta..."
                                   />
                                 )}
                               </div>
                             );
                           })
                         ) : (
                           // Render legacy fields fallback
                           <>
                             <div className="space-y-2">
                               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Queixa Principal & Motivo da Busca</label>
                               <textarea 
                                 value={editAnamnesis.complaint}
                                 onChange={(e) => setEditAnamnesis({...editAnamnesis, complaint: e.target.value})}
                                 className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none min-h-[100px] focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium text-slate-700"
                                 placeholder="Descreva a queixa principal do paciente..."
                               />
                             </div>
                             <div className="space-y-2">
                               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Histórico Familiar</label>
                               <textarea 
                                 value={editAnamnesis.family_history}
                                 onChange={(e) => setEditAnamnesis({...editAnamnesis, family_history: e.target.value})}
                                 className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none min-h-[100px] focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium text-slate-700"
                                 placeholder="Dinâmica familiar, doenças genéticas..."
                               />
                             </div>
                             <div className="space-y-2">
                               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Estilo de Vida & Hábitos</label>
                               <textarea 
                                 value={editAnamnesis.lifestyle}
                                 onChange={(e) => setEditAnamnesis({...editAnamnesis, lifestyle: e.target.value})}
                                 className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none min-h-[100px] focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium text-slate-700"
                                 placeholder="Rotina, sono, alimentação..."
                               />
                             </div>
                           </>
                         )}
                         <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                           <button onClick={() => { setShowRecordModal(false); setSelectedPatient(null); }} className="px-8 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all">Fechar</button>
                           <button 
                             onClick={handleSendAnamnesisLink}
                             className="px-8 py-4 bg-emerald-50 text-emerald-600 rounded-2xl font-bold hover:bg-emerald-100 transition-all flex items-center gap-2 border border-emerald-200"
                           >
                             <MessageSquare className="w-5 h-5" /> Enviar Ficha (WhatsApp)
                           </button>
                           <button 
                             onClick={handleSaveAnamnesis}
                             className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-2"
                           >
                             <Save className="w-5 h-5" /> Salvar Anamnese
                           </button>
                         </div>
                       </div>
                     );
                  })() : (
                     <>
                        <div className="space-y-2">
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Relato da Sessão</label>
                           <textarea 
                             value={newRecord.content}
                             onChange={(e) => setNewRecord({...newRecord, content: e.target.value})}
                             className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none min-h-[250px] focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium text-slate-700" 
                             placeholder="Descreva detalhadamente o atendimento..." 
                           />
                        </div>
                        <div className="flex justify-end gap-3">
                           <button onClick={() => { setShowRecordModal(false); setSelectedPatient(null); }} className="px-8 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all">Fechar</button>
                           <button 
                               onClick={handleAddRecord}
                               className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-2"
                           >
                               <Save className="w-5 h-5" /> Salvar Novo
                           </button>
                        </div>
                     </>
                  )}

                 {/* Linha do Tempo (Registros Passados) */}
                 {patientRecords.length > 0 && (
                    <div className="mt-10 pt-10 border-t border-slate-100 space-y-6">
                       <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2"><History className="w-4 h-4 text-slate-500"/> Histórico Clínico (Linha do Tempo)</h4>
                       <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
                          {patientRecords.map(rec => (
                             <div key={rec.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                                <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-indigo-100 text-indigo-600 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm z-10">
                                   {rec.type === 'evolution' ? <TrendingUp className="w-4 h-4" /> : <ClipboardList className="w-4 h-4" />}
                                </div>
                                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-2xl border border-slate-100 bg-white shadow-sm hover:shadow-md transition-all">
                                   <div className="flex items-center justify-between mb-2">
                                      <span className={cn("text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg", rec.type === 'evolution' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600')}>{rec.type === 'evolution' ? 'Evolução' : 'Anamnese'}</span>
                                      <time className="text-xs font-bold text-slate-400">{new Date(rec.created_at).toLocaleDateString('pt-BR')}</time>
                                   </div>
                                   <p className="text-sm text-slate-600 font-medium whitespace-pre-wrap">{rec.content?.text}</p>
                                </div>
                             </div>
                          ))}
                       </div>
                    </div>
                 )}
              </div>
           </div>
        </div>
      )}

      {/* Appointment Modal */}
      {showAppointmentModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
           <div className="bg-white rounded-[3rem] w-full max-w-lg shadow-2xl border border-slate-100 overflow-hidden">
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                 <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg"><Calendar className="w-6 h-6" /></div>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">Novo Agendamento</h3>
                 </div>
                 <button onClick={() => setShowAppointmentModal(false)} className="p-2 hover:bg-white rounded-full text-slate-400 transition-all border border-transparent hover:border-slate-200"><X className="w-6 h-6" /></button>
              </div>
              <div className="p-8 space-y-6">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Paciente</label>
                    <select 
                      value={newApp.patient_id}
                      onChange={(e) => setNewApp({...newApp, patient_id: e.target.value})}
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none appearance-none font-bold text-slate-700"
                    >
                        <option value="">Selecione um paciente...</option>
                        {assignedPatients.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                 </div>
                 {rooms.length > 0 && (
                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Sala de Atendimento</label>
                        <select 
                          value={newApp.room_id}
                          onChange={(e) => setNewApp({...newApp, room_id: e.target.value})}
                          className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none appearance-none font-bold text-slate-700 cursor-pointer"
                        >
                            <option value="">Sem sala fixa...</option>
                            {rooms.map(r => (
                                <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                        </select>
                     </div>
                  )}
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Data e Hora</label>
                    <input 
                      type="datetime-local"
                      value={newApp.start_time}
                      min={(() => {
                         const now = new Date();
                         const offset = now.getTimezoneOffset() * 60000;
                         const localISOTime = (new Date(now.getTime() - offset)).toISOString().slice(0, 16);
                         return localISOTime;
                      })()}
                      onChange={(e) => setNewApp({...newApp, start_time: e.target.value})}
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-700" 
                    />
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Modalidade</label>
                    <div className="grid grid-cols-2 gap-4">
                       <button 
                          onClick={() => setNewApp({...newApp, type: 'Presencial'})}
                          className={cn(
                            "py-4 rounded-2xl font-bold flex items-center justify-center gap-2 border-2 transition-all",
                            newApp.type === 'Presencial' ? "bg-indigo-50 border-indigo-500 text-indigo-700" : "bg-slate-50 border-transparent text-slate-400"
                          )}
                        >
                          <MapPin className="w-5 h-5" /> Presencial
                        </button>
                        <button 
                          onClick={() => setNewApp({...newApp, type: 'Online'})}
                          className={cn(
                            "py-4 rounded-2xl font-bold flex items-center justify-center gap-2 border-2 transition-all",
                            newApp.type === 'Online' ? "bg-indigo-50 border-indigo-500 text-indigo-700" : "bg-slate-50 border-transparent text-slate-400"
                          )}
                        >
                          <Video className="w-5 h-5" /> Online
                        </button>
                    </div>
                 </div>
                 <button 
                  onClick={handleCreateAppointment}
                  className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-bold shadow-2xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                 >
                   <Save className="w-5 h-5" /> Agendar Sessão
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* Daily Appointments Modal */}
      {selectedDateAppointments && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
           <div className="bg-white rounded-[3rem] w-full max-w-2xl shadow-2xl border border-slate-100 overflow-hidden">
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                 <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg"><Calendar className="w-6 h-6" /></div>
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
                         <h4 className="font-bold text-slate-900 text-lg">{app.patients?.name || app.leads?.name || 'Paciente'}</h4>
                         <p className="text-sm text-slate-500 font-medium">{app.service_type || 'Sessão de Terapia'}</p>
                       </div>
                     </div>
                     <div className="flex items-center gap-4">
                        <span className={cn(
                          "px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest",
                          app.status === 'completed' ? "bg-emerald-50 text-emerald-600" :
                          app.status === 'cancelled' ? "bg-rose-50 text-rose-600" : 
                          (app.status === 'confirmed' || app.status === 'confirmado') ? "bg-sky-50 text-sky-600" : "bg-indigo-50 text-indigo-600"
                        )}>
                          {app.status === 'completed' ? 'Concluído' : 
                           app.status === 'cancelled' ? 'Cancelado' : 
                           (app.status === 'confirmed' || app.status === 'confirmado') ? 'Confirmado' : 'Agendado'}
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
                              <Calendar className="w-5 h-5" />
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
                        <Calendar className="w-6 h-6" />
                     </div>
                     <div>
                        <h3 className="text-2xl font-black text-slate-900 tracking-tight">Reagendar Consulta</h3>
                        <p className="text-sm text-slate-400 font-medium mt-2">Reagendando sessão de {reschedulingAppt.patients?.name || reschedulingAppt.patient_name || 'Paciente'}</p>
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
                           <Calendar className="w-10 h-10 text-slate-300 mb-4" />
                           <h4 className="font-bold text-slate-700">Sem horários livres</h4>
                           <p className="text-sm text-slate-500">Você não possui horários livres neste dia.</p>
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
                 Deseja realmente desmarcar a sessão de <strong className="text-slate-900 font-bold">{cancelConfirmationAppt.patients?.name || cancelConfirmationAppt.patient_name || 'Paciente'}</strong>?
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
