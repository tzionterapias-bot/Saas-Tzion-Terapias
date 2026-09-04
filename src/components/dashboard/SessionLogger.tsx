import React, { useState, useEffect } from 'react';
import { PlayCircle, Clock, Save, FileText, User, Search, CheckCircle2, AlertCircle, X, ChevronRight, History, Calendar, ExternalLink, Plus, Loader2, MessageSquare, Heart, Edit, Send, Image as ImageIcon, Mic, Paperclip, Trash2, UploadCloud, Music, FileCheck } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { supabase } from '@/src/lib/supabase';
import { useActiveSession } from '@/src/contexts/ActiveSessionContext';
import { useAuth } from '@/src/contexts/AuthContext';

export default function SessionLogger() {
  const { user } = useAuth();
  const { activeSession, startActiveSession, clearActiveSession } = useActiveSession();

  const [sessionActive, setSessionActive] = useState(false);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<any | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [timer, setTimer] = useState(0);
  const [workspaceTab, setWorkspaceTab] = useState<'evolution' | 'guidance' | 'homecare'>('evolution');
  const [showFullRecord, setShowFullRecord] = useState(false);
  const [showLastGuidance, setShowLastGuidance] = useState(false);
  const [activeTab, setActiveTab] = useState<'evolution' | 'documents' | 'history' | 'anamnesis'>('evolution');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [editingEvolution, setEditingEvolution] = useState<{ id: string; notes: string } | null>(null);
  const [resendingEvolutionId, setResendingEvolutionId] = useState<string | null>(null);
  const [indicators, setIndicators] = useState({ anxiety: 5, vitality: 5, physical_pain: 0, sleep_quality: 5 });
  const [prescriptionItems, setPrescriptionItems] = useState<{ type: string; name: string; usage: string }[]>([
    { type: 'floral', name: '', usage: '' }
  ]);

  // Persist notes and guidance in sessionStorage to survive page refresh
  const [notes, setNotes] = useState(() => sessionStorage.getItem('@tzion:session-logger:notes') || '');
  const [guidance, setGuidance] = useState(() => sessionStorage.getItem('@tzion:session-logger:guidance') || '');
  const [secretaryNote, setSecretaryNote] = useState(() => sessionStorage.getItem('@tzion:session-logger:secretary-note') || '');

  useEffect(() => {
    sessionStorage.setItem('@tzion:session-logger:notes', notes);
  }, [notes]);

  useEffect(() => {
    sessionStorage.setItem('@tzion:session-logger:guidance', guidance);
  }, [guidance]);

  useEffect(() => {
    sessionStorage.setItem('@tzion:session-logger:secretary-note', secretaryNote);
  }, [secretaryNote]);

  // Upload de Anexo (Imagem, Áudio, PDF) para Orientação
  interface GuidanceAttachment {
    file: File;
    base64: string;
    mimeType: string;
    fileName: string;
    size: number;
    type: 'image' | 'audio' | 'pdf';
  }

  const [guidanceAttachment, setGuidanceAttachment] = useState<GuidanceAttachment | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [fileFilterType, setFileFilterType] = useState<string>('image/*,audio/*,application/pdf');

  const handleTriggerUpload = (filter: string) => {
    setFileFilterType(filter);
    setTimeout(() => {
      fileInputRef.current?.click();
    }, 50);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      alert('Arquivo muito grande! O limite para envio via WhatsApp é 15MB.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    let detectedType: 'image' | 'audio' | 'pdf' = 'pdf';
    if (file.type.startsWith('image/')) detectedType = 'image';
    else if (file.type.startsWith('audio/')) detectedType = 'audio';
    else if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) detectedType = 'pdf';

    const reader = new FileReader();
    reader.onload = () => {
      setGuidanceAttachment({
        file,
        base64: reader.result as string,
        mimeType: file.type || (detectedType === 'pdf' ? 'application/pdf' : detectedType === 'audio' ? 'audio/mpeg' : 'image/jpeg'),
        fileName: file.name,
        size: file.size,
        type: detectedType
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsDataURL(file);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const [therapistsList, setTherapistsList] = useState<any[]>([]);
  const [selectedTherapistId, setSelectedTherapistId] = useState<string>(() => sessionStorage.getItem('@tzion:session-logger:therapistId') || '');
  const [currentTherapistName, setCurrentTherapistName] = useState<string>('');

  const fetchData = async (forcedTherapistId?: string) => {
    try {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];
      
      // 1. Busca todos os terapeutas disponíveis
      const { data: allTherapists } = await supabase.from('therapists').select('id, name, email, user_id').order('name');
      const therapistsMap = new Map((allTherapists || []).map(t => [t.id, t.name]));
      setTherapistsList(allTherapists || []);

      // 2. Identifica o terapeuta do usuário logado (se houver)
      let myTherapistId = '';
      if (user?.id) {
        const matched = (allTherapists || []).find(t => 
          t.user_id === user.id || 
          (user.email && t.email && t.email.toLowerCase().trim() === user.email.toLowerCase().trim())
        );
        if (matched) {
          myTherapistId = matched.id;
          setCurrentTherapistName(matched.name);
        }
      }

      // 3. Define qual ID de terapeuta será consultado
      const targetTherapistId = forcedTherapistId !== undefined 
        ? forcedTherapistId 
        : (user?.role === 'terapeuta' ? myTherapistId : (selectedTherapistId || myTherapistId));

      if (user?.role === 'admin' && !selectedTherapistId && myTherapistId) {
        setSelectedTherapistId(myTherapistId);
      }

      // Se nenhum terapeuta estiver selecionado ou vinculado, não exibe nenhuma sessão por segurança
      if (!targetTherapistId) {
        setAppointments([]);
        setLoading(false);
        return;
      }

      // 4. Consulta ESTRITAMENTE as sessões do terapeuta selecionado
      const apptQuery = supabase
        .from('appointments')
        .select('*')
        .eq('therapist_id', targetTherapistId)
        .gte('start_time', `${today}T00:00:00`)
        .lte('start_time', `${today}T23:59:59`)
        .order('start_time', { ascending: true });

      const [apptsRes, patientsRes] = await Promise.all([
        apptQuery,
        supabase.from('patients').select('id, name')
      ]);

      const patientsMap = new Map((patientsRes.data || []).map(p => [p.id, p.name]));

      const formatted = (apptsRes.data || []).filter(a => a.status !== 'completed').map(a => ({
        id: a.id,
        patientId: a.patient_id,
        patient: patientsMap.get(a.patient_id) || 'Paciente Não Encontrado',
        time: new Date(a.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }),
        type: a.type || 'Presencial',
        therapy: 'Terapia Integrativa',
        therapistId: a.therapist_id,
        therapist: therapistsMap.get(a.therapist_id) || 'Terapeuta'
      }));

      setAppointments(formatted);
    } catch (error) {
      console.error('Erro ao buscar atendimentos:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPatientHistory = async (patientId: string) => {
    const [evolutionsRes, recordsRes] = await Promise.all([
      supabase
        .from('patient_evolutions')
        .select(`id, notes, type, created_at, therapists (name)`)
        .eq('patient_id', patientId),
      supabase
        .from('medical_records')
        .select(`id, content, type, created_at, therapists (name)`)
        .eq('patient_id', patientId)
    ]);

    const evolutions = (evolutionsRes.data || []).map((r: any) => ({
      id: `evo-${r.id}`,
      date: r.created_at,
      content: r.notes || '(Sem anotações)',
      therapist: Array.isArray(r.therapists) ? (r.therapists[0]?.name || 'Terapeuta') : (r.therapists?.name || 'Terapeuta'),
      type: r.type || 'Evolução'
    }));

    const records = (recordsRes.data || []).map((r: any) => ({
      id: `rec-${r.id}`,
      date: r.created_at,
      content: r.content?.text || '(Sem anotações)',
      therapist: Array.isArray(r.therapists) ? (r.therapists[0]?.name || 'Terapeuta') : (r.therapists?.name || 'Terapeuta'),
      type: r.type === 'evolution' ? 'Evolução Clínica' : 'Anamnese'
    }));

    const combined = [...evolutions, ...records].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setHistory(combined);
  };

  // Sync state with activeSession global context (resilience to page refresh)
  useEffect(() => {
    if (activeSession) {
      setSessionActive(true);
      setSelectedPatient(activeSession);
      fetchPatientHistory(activeSession.patientId);
    } else {
      setSessionActive(false);
      setSelectedPatient(null);
    }
  }, [activeSession]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, selectedTherapistId]);

  // Update timer relative to session startTime (survives page refresh perfectly)
  useEffect(() => {
    let interval: any;
    if (sessionActive && activeSession?.startTime) {
      const updateTimer = () => {
        const elapsed = Math.floor((Date.now() - activeSession.startTime) / 1000);
        setTimer(elapsed >= 0 ? elapsed : 0);
      };
      
      updateTimer();
      interval = setInterval(updateTimer, 1000);
    }
    return () => clearInterval(interval);
  }, [sessionActive, activeSession]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartSession = (patient: any) => {
    startActiveSession({
      id: patient.id,
      patientId: patient.patientId,
      patient: patient.patient,
      time: patient.time,
      type: patient.type,
      therapy: patient.therapy,
      therapistId: patient.therapistId,
      therapist: patient.therapist,
    });
    setNotes('');
    setGuidance('');
    setSecretaryNote('');
    setWorkspaceTab('evolution');
  };

  const handleFinishSession = async () => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('patient_evolutions')
        .insert({
          patient_id: selectedPatient.patientId,
          therapist_id: selectedPatient.therapistId,
          notes: notes,
          type: 'Sessão Regular'
        });

      if (error) throw error;

      await supabase.from('patient_indicators').insert({
        patient_id: selectedPatient.patientId,
        appointment_id: selectedPatient.id,
        anxiety: indicators.anxiety,
        vitality: indicators.vitality,
        physical_pain: indicators.physical_pain,
        sleep_quality: indicators.sleep_quality,
        notes: notes
      });

      setIndicators({ anxiety: 5, vitality: 5, physical_pain: 0, sleep_quality: 5 });

      if (guidance.trim() || guidanceAttachment) {
         let finalNotes = guidance.trim();
         if (guidanceAttachment) {
           finalNotes += (finalNotes ? '\n\n' : '') + `📎 [Anexo: ${guidanceAttachment.fileName}]`;
         }

         const { data: evoInsert } = await supabase.from('patient_evolutions').insert({
            patient_id: selectedPatient.patientId,
            therapist_id: selectedPatient.therapistId,
            notes: finalNotes || 'Orientação enviada com anexo de mídia',
            type: 'Orientação'
         }).select().maybeSingle();
         
         const { data: patientData } = await supabase.from('patients').select('phone, name').eq('id', selectedPatient.patientId).single();
         if (patientData?.phone) {
             const { sendWhatsAppMessage } = await import('@/src/lib/whatsapp');
             const msg = guidance.trim() ? `*Orientação do seu terapeuta:*\n\n${guidance}` : '*Orientação do seu terapeuta*';

             if (guidanceAttachment) {
               if (guidanceAttachment.type === 'audio') {
                 // Envia áudio como nota de voz no WhatsApp
                 await sendWhatsAppMessage(
                   selectedPatient.patientId,
                   patientData.phone,
                   '',
                   'patient_guidance',
                   {
                     base64: guidanceAttachment.base64,
                     mimeType: guidanceAttachment.mimeType,
                     fileName: guidanceAttachment.fileName
                   }
                 );
                 if (guidance.trim()) {
                   await sendWhatsAppMessage(selectedPatient.patientId, patientData.phone, msg, 'patient_guidance');
                 }
               } else {
                 // Imagem ou PDF com legenda
                 await sendWhatsAppMessage(
                   selectedPatient.patientId,
                   patientData.phone,
                   msg,
                   'patient_guidance',
                   {
                     base64: guidanceAttachment.base64,
                     mimeType: guidanceAttachment.mimeType,
                     fileName: guidanceAttachment.fileName
                   }
                 );
               }
             } else {
               await sendWhatsAppMessage(selectedPatient.patientId, patientData.phone, msg, 'patient_guidance');
             }
         }

         // Arquiva em patient_documents
         if (guidanceAttachment && user?.id) {
           try {
             const uniquePath = `orientacoes/${selectedPatient.patientId}/${Date.now()}_${guidanceAttachment.fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
             const base64Content = guidanceAttachment.base64.split(',')[1];
             if (base64Content) {
               const binaryStr = window.atob(base64Content);
               const bytes = new Uint8Array(binaryStr.length);
               for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
               const { error: upErr } = await supabase.storage.from('patient-documents').upload(uniquePath, bytes.buffer, {
                 contentType: guidanceAttachment.mimeType,
                 upsert: true
               });
               if (!upErr) {
                 const { data: pubData } = supabase.storage.from('patient-documents').getPublicUrl(uniquePath);
                 await supabase.from('patient_documents').insert({
                   patient_id: selectedPatient.patientId,
                   title: `Orientação: ${guidanceAttachment.fileName}`,
                   file_url: pubData?.publicUrl || uniquePath,
                   file_type: guidanceAttachment.type,
                   file_path: uniquePath,
                   created_by: user.id
                 });

                 // Se a evolução foi criada e as colunas de anexo existirem, vincula a URL
                 if (evoInsert?.id && pubData?.publicUrl) {
                   try {
                     await supabase.from('patient_evolutions').update({
                       attachment_url: pubData.publicUrl,
                       attachment_type: guidanceAttachment.type,
                       attachment_name: guidanceAttachment.fileName
                     }).eq('id', evoInsert.id);
                   } catch (_) {}
                 }
               }
             }
           } catch (attachErr) {
             console.warn('Erro ao salvar em patient_documents:', attachErr);
           }
         }

         setGuidanceAttachment(null);
      }

      // 3. Salvar Autocuidado / Home Care se houver itens preenchidos
      const filledHomeCare = prescriptionItems.filter(item => item.name.trim() && item.usage.trim());
      if (filledHomeCare.length > 0) {
        await supabase
          .from('therapeutic_prescriptions')
          .insert([{
            patient_id: selectedPatient.patientId,
            therapist_id: selectedPatient.therapistId,
            items: filledHomeCare,
            created_at: new Date().toISOString()
          }]);
        
        // Enviar via WhatsApp estruturado
        const { data: patientData } = await supabase.from('patients').select('name, phone').eq('id', selectedPatient.patientId).single();
        if (patientData?.phone) {
          const { sendWhatsAppMessage } = await import('@/src/lib/whatsapp');
          const firstName = patientData.name ? patientData.name.split(' ')[0] : 'Paciente';
          let msg = `Olá, *${firstName}*! ✨\n\nAqui estão as suas orientações de *Autocuidado / Home Care* da sua sessão de hoje:\n\n`;
          filledHomeCare.forEach((item, idx) => {
            const emoji = item.type === 'floral' ? '🌸' : item.type === 'ervas' ? '🌿' : item.type === 'exercicio' ? '🧘' : '📝';
            msg += `${idx + 1}. ${emoji} *${item.name}* (${item.type.toUpperCase()})\n   └ 📌 _Uso/Instruções:_ ${item.usage}\n\n`;
          });
          msg += `Qualquer dúvida ou desconforto, entre em contato conosco. Cuide-se bem! 💙`;
          await sendWhatsAppMessage(selectedPatient.patientId, patientData.phone, msg, 'prescription_sent');
        }
      }

      // Atualizar status do agendamento para completed e acionar o NPS
      await supabase
        .from('appointments')
        .update({ 
            status: 'completed',
            completed_at: new Date().toISOString(),
            nps_sent: false,
            notes: secretaryNote
        })
        .eq('id', selectedPatient.id);

      clearActiveSession();
      setNotes('');
      setGuidance('');
      setSecretaryNote('');
      setPrescriptionItems([{ type: 'floral', name: '', usage: '' }]);
      setWorkspaceTab('evolution');
      setToastMessage(`Sessão finalizada! Registro salvo no prontuário de ${selectedPatient?.patient}.`);
      setTimeout(() => setToastMessage(null), 3500);
      fetchData();
    } catch (error) {
      console.error('Erro ao salvar prontuário:', error);
      setToastMessage('Falha ao salvar prontuário.');
      setTimeout(() => setToastMessage(null), 3500);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateEvolution = async (id: string, newNotes: string, sendWhatsApp: boolean) => {
    try {
      const { error } = await supabase
        .from('patient_evolutions')
        .update({ notes: newNotes })
        .eq('id', id);

      if (error) throw error;

      setHistory(prev => prev.map(e => e.id === id ? { ...e, content: newNotes } : e));
      setEditingEvolution(null);

      if (sendWhatsApp && selectedPatient?.patientId) {
        setResendingEvolutionId(id);
        const { data: patientData } = await supabase.from('patients').select('phone').eq('id', selectedPatient.patientId).maybeSingle();
        if (patientData?.phone) {
          const { sendWhatsAppMessage } = await import('@/src/lib/whatsapp');
          const msg = `*Orientação do seu terapeuta:*\n\n${newNotes}`;
          const sent = await sendWhatsAppMessage(selectedPatient.patientId, patientData.phone, msg, 'patient_guidance_updated');
          if (sent) {
            setToastMessage('Orientação atualizada e reenviada com sucesso via WhatsApp!');
          } else {
            setToastMessage('Orientação atualizada no prontuário. Houve falha ao enviar WhatsApp.');
          }
        } else {
          setToastMessage('Paciente não possui telefone cadastrado.');
        }
      } else {
        setToastMessage('Orientação/Evolução atualizada com sucesso!');
      }
    } catch (err: any) {
      console.error(err);
      alert('Erro ao atualizar orientação: ' + (err.message || err));
    } finally {
      setResendingEvolutionId(null);
    }
  };

  if (!sessionActive) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Registros de Sessão</h2>
            <p className="text-xs text-slate-500">Atendimentos e evolução clínica exclusivos por terapeuta</p>
          </div>
          <button onClick={() => fetchData()} className="p-2 hover:bg-slate-100 rounded-lg transition-colors self-end sm:self-auto" title="Recarregar">
            {loading ? <Loader2 className="w-5 h-5 animate-spin text-indigo-600" /> : <History className="w-5 h-5 text-slate-400" />}
          </button>
        </div>

        {/* Barra de Seleção / Identificação do Terapeuta */}
        {user?.role === 'admin' ? (
          <div className="bg-white p-5 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Selecionar Terapeuta</h3>
                <p className="text-xs text-slate-400">Exibindo apenas os agendamentos do profissional escolhido</p>
              </div>
            </div>
            <select
              value={selectedTherapistId}
              onChange={(e) => {
                const newId = e.target.value;
                setSelectedTherapistId(newId);
                sessionStorage.setItem('@tzion:session-logger:therapistId', newId);
                fetchData(newId);
              }}
              className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none w-full sm:w-72"
            >
              <option value="">-- Escolha um Terapeuta --</option>
              {therapistsList.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        ) : (
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl font-bold">
                <User className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs text-slate-400 font-medium block">Atendimentos de Hoje para</span>
                <strong className="text-slate-800 text-sm">{currentTherapistName || user?.name}</strong>
              </div>
            </div>
            <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-xs font-bold">Terapeuta Ativo</span>
          </div>
        )}

        {/* Lista de Sessões */}
        <div className="grid grid-cols-1 gap-4">
          {appointments.map((apt) => (
            <div key={apt.id} className="bg-white p-4 sm:p-6 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-xl hover:border-indigo-200 transition-all group flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4 sm:gap-6 w-full sm:w-auto min-w-0 flex-1">
                <div className="text-center min-w-[60px] shrink-0">
                  <p className="text-xl sm:text-2xl font-bold text-slate-900 leading-none">{apt.time}</p>
                  <p className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-widest">Início</p>
                </div>
                <div className="h-12 w-px bg-slate-100 hidden sm:block shrink-0" />
                <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 font-bold text-lg sm:text-xl group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all shadow-sm shrink-0">
                    {apt.patient.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-base sm:text-lg text-slate-900 group-hover:text-indigo-600 transition-colors truncate">{apt.patient}</h3>
                    <p className="text-xs text-slate-500 font-medium flex flex-wrap items-center gap-1.5 mt-0.5">
                      <FileText className="w-3 h-3 shrink-0" />
                      <span className="truncate max-w-[120px] sm:max-w-none">{apt.therapy}</span>
                      <span className="text-slate-300">•</span>
                      <span className={cn(apt.type === 'Online' ? "text-blue-500 font-semibold" : "text-slate-500", "shrink-0")}>{apt.type}</span>
                      <span className="text-slate-300">•</span>
                      <span className="text-indigo-600 font-medium bg-indigo-50 px-2 py-0.5 rounded-md text-[11px]">Terapeuta: {apt.therapist}</span>
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto border-t border-slate-100 sm:border-0 pt-3 sm:pt-0 mt-1 sm:mt-0 shrink-0">
                <button 
                  onClick={() => handleStartSession(apt)}
                  className="flex-1 sm:flex-none px-6 py-3 bg-indigo-600 text-white rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 shadow-lg shadow-indigo-100 active:scale-95 transition-all w-full"
                >
                  <PlayCircle className="w-4 h-4" /> Iniciar Atendimento
                </button>
              </div>
            </div>
          ))}

          {!loading && user?.role === 'admin' && !selectedTherapistId && (
            <div className="py-16 text-center text-slate-400 font-medium border-2 border-dashed border-slate-200 rounded-[2rem] bg-white">
              <User className="w-10 h-10 text-indigo-400 mx-auto mb-3 opacity-60" />
              <p className="text-slate-700 font-bold text-base">Nenhum terapeuta selecionado</p>
              <p className="text-slate-400 text-xs mt-1">Por favor, selecione um terapeuta no campo acima para carregar os atendimentos pertinentes.</p>
            </div>
          )}

          {!loading && selectedTherapistId && appointments.length === 0 && (
            <div className="py-16 text-center text-slate-400 font-medium border-2 border-dashed border-slate-200 rounded-[2rem] bg-white">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
              <p className="text-slate-700 font-bold text-base">Nenhum atendimento agendado para hoje</p>
              <p className="text-slate-400 text-xs mt-1">O terapeuta selecionado não possui sessões pendentes para a data de hoje.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Active Session Header */}
      <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 p-8 rounded-[2.5rem] text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <div className="relative">
            <div className="w-20 h-20 rounded-[1.5rem] bg-white/20 backdrop-blur-md flex items-center justify-center text-3xl font-bold border border-white/20">
              {selectedPatient?.patient.charAt(0)}
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-400 border-4 border-indigo-600 animate-pulse" />
          </div>
          <div className="space-y-1">
            <h2 className="text-3xl font-bold tracking-tight">{selectedPatient?.patient}</h2>
            <div className="flex flex-wrap items-center gap-3">
              <span className="px-3 py-1 bg-white/10 rounded-full text-[10px] font-bold uppercase tracking-widest border border-white/10">{selectedPatient?.therapy}</span>
              <span className="px-3 py-1 bg-emerald-400/20 text-emerald-100 rounded-full text-[10px] font-bold uppercase tracking-widest border border-emerald-400/20">{selectedPatient?.type}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-6 bg-slate-900/40 p-6 rounded-3xl backdrop-blur-xl border border-white/10 shadow-inner">
          <Clock className="w-8 h-8 text-indigo-200" />
          <div className="text-center">
            <span className="text-4xl font-mono font-bold tracking-[0.2em]">{formatTime(timer)}</span>
            <p className="text-[10px] text-indigo-300 font-bold uppercase mt-1 opacity-70">Tempo de Sessão</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Workspace */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6 relative group ring-1 ring-slate-100 hover:ring-indigo-100 transition-all">
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-4 gap-4 md:gap-0">
              <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
                <button 
                  onClick={() => setWorkspaceTab('evolution')} 
                  className={cn("text-sm font-bold flex items-center gap-2 uppercase tracking-widest px-4 py-2 rounded-xl transition-all", workspaceTab === 'evolution' ? "bg-indigo-50 text-indigo-600" : "text-slate-400 hover:text-slate-600 hover:bg-slate-50")}
                >
                  <FileText className="w-4 h-4" /> Evolução Clínica
                </button>
                <button 
                  onClick={() => setWorkspaceTab('guidance')} 
                  className={cn("text-sm font-bold flex items-center justify-center gap-2 uppercase tracking-widest px-4 py-3 sm:py-2 rounded-xl transition-all w-full sm:w-auto", workspaceTab === 'guidance' ? "bg-emerald-50 text-emerald-600" : "text-slate-400 hover:text-slate-600 hover:bg-slate-50")}
                >
                  <MessageSquare className="w-4 h-4" /> Orientação p/ Paciente
                </button>
                <button 
                  onClick={() => setWorkspaceTab('homecare')} 
                  className={cn("text-sm font-bold flex items-center justify-center gap-2 uppercase tracking-widest px-4 py-3 sm:py-2 rounded-xl transition-all w-full sm:w-auto", workspaceTab === 'homecare' ? "bg-rose-50 text-rose-600" : "text-slate-400 hover:text-slate-600 hover:bg-slate-50")}
                >
                  <Heart className="w-4 h-4 text-rose-500" /> Autocuidado / Home Care
                </button>
              </div>
              <button 
                onClick={() => setShowLastGuidance(true)}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors group/link hidden sm:flex"
              >
                Ver última sessão <ChevronRight className="w-3 h-3 group-hover/link:translate-x-1 transition-transform" />
              </button>
            </div>
            
            {workspaceTab === 'evolution' ? (
              <div className="space-y-6">
                <textarea 
                  rows={8}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Descreva a evolução do paciente, principais dores e intervenções realizadas na sessão de hoje (Apenas uso interno)..."
                  className="w-full p-8 text-slate-700 bg-slate-50/50 border border-slate-100 rounded-[2rem] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-xl leading-relaxed placeholder:text-slate-300 shadow-inner"
                ></textarea>

                <textarea 
                  rows={3}
                  value={secretaryNote}
                  onChange={(e) => setSecretaryNote(e.target.value)}
                  placeholder="Observação para a secretária (Ex: Agendar retorno em 15 dias, paciente solicitou remarcação...)"
                  className="w-full p-6 text-slate-700 bg-amber-50/50 border border-amber-100 rounded-[1.5rem] focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all text-base leading-relaxed placeholder:text-amber-300 shadow-inner"
                ></textarea>

                {/* Indicadores Clínicos / Emocionais */}
                <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-6">
                  <h5 className="font-bold text-slate-800 text-sm flex items-center gap-2">📊 Indicadores de Evolução Terapêutica</h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {/* Anxiety */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-bold text-slate-600">
                        <span>Ansiedade</span>
                        <span className="text-indigo-600 font-extrabold">{indicators.anxiety} / 10</span>
                      </div>
                      <input 
                        type="range" min="0" max="10" step="1"
                        value={indicators.anxiety}
                        onChange={(e) => setIndicators({...indicators, anxiety: parseInt(e.target.value)})}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                      />
                      <div className="flex justify-between text-[9px] text-slate-400 font-medium">
                        <span>Calmo</span>
                        <span>Crise/Extremo</span>
                      </div>
                    </div>

                    {/* Vitality */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-bold text-slate-600">
                        <span>Vitalidade / Energia</span>
                        <span className="text-emerald-600 font-extrabold">{indicators.vitality} / 10</span>
                      </div>
                      <input 
                        type="range" min="0" max="10" step="1"
                        value={indicators.vitality}
                        onChange={(e) => setIndicators({...indicators, vitality: parseInt(e.target.value)})}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                      />
                      <div className="flex justify-between text-[9px] text-slate-400 font-medium">
                        <span>Sem Energia</span>
                        <span>Plena/Vigoroso</span>
                      </div>
                    </div>

                    {/* Physical Pain */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-bold text-slate-600">
                        <span>Dor Física</span>
                        <span className="text-rose-600 font-extrabold">{indicators.physical_pain} / 10</span>
                      </div>
                      <input 
                        type="range" min="0" max="10" step="1"
                        value={indicators.physical_pain}
                        onChange={(e) => setIndicators({...indicators, physical_pain: parseInt(e.target.value)})}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-rose-600"
                      />
                      <div className="flex justify-between text-[9px] text-slate-400 font-medium">
                        <span>Sem Dor</span>
                        <span>Dor Extrema</span>
                      </div>
                    </div>

                    {/* Sleep Quality */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-bold text-slate-600">
                        <span>Qualidade do Sono</span>
                        <span className="text-amber-500 font-bold">{indicators.sleep_quality} / 10</span>
                      </div>
                      <input 
                        type="range" min="0" max="10" step="1"
                        value={indicators.sleep_quality}
                        onChange={(e) => setIndicators({...indicators, sleep_quality: parseInt(e.target.value)})}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
                      />
                      <div className="flex justify-between text-[9px] text-slate-400 font-medium">
                        <span>Insônia/Péssimo</span>
                        <span>Sono Reparador</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : workspaceTab === 'guidance' ? (
              <div className="space-y-4">
                <div className="bg-emerald-50 text-emerald-700 p-4 rounded-2xl text-sm font-medium flex items-center justify-between gap-3">
                   <div className="flex items-center gap-3">
                     <div className="p-2 bg-emerald-100 rounded-lg"><CheckCircle2 className="w-5 h-5" /></div>
                     <span>O texto e os anexos abaixo serão enviados automaticamente para o WhatsApp do paciente ao finalizar a sessão.</span>
                   </div>
                </div>

                <textarea 
                  rows={8}
                  value={guidance}
                  onChange={(e) => setGuidance(e.target.value)}
                  placeholder="Ex: Olá! Como combinado hoje na sessão, lembre-se de fazer o exercício de respiração sempre que sentir ansiedade..."
                  className="w-full p-8 text-slate-700 bg-emerald-50/30 border border-emerald-100 rounded-[2rem] focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all text-xl leading-relaxed placeholder:text-slate-300 shadow-inner"
                ></textarea>

                {/* Área de Anexos: Imagem, Áudio e PDF */}
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-slate-700 font-bold text-sm">
                      <Paperclip className="w-4 h-4 text-emerald-600" />
                      <span>Anexar Material p/ Envio no WhatsApp</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleTriggerUpload('image/*')}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:border-emerald-500 hover:text-emerald-600 rounded-xl text-xs font-bold text-slate-600 shadow-sm transition-all active:scale-95"
                      >
                        <ImageIcon className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Foto / Imagem</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleTriggerUpload('audio/*')}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:border-emerald-500 hover:text-emerald-600 rounded-xl text-xs font-bold text-slate-600 shadow-sm transition-all active:scale-95"
                      >
                        <Mic className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Áudio / Voz</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleTriggerUpload('application/pdf')}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:border-emerald-500 hover:text-emerald-600 rounded-xl text-xs font-bold text-slate-600 shadow-sm transition-all active:scale-95"
                      >
                        <FileText className="w-3.5 h-3.5 text-rose-500" />
                        <span>PDF / Doc</span>
                      </button>
                    </div>
                  </div>

                  {/* Input oculto de arquivo */}
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    accept={fileFilterType} 
                    onChange={handleFileChange} 
                    className="hidden" 
                  />

                  {/* Pré-visualização do Anexo */}
                  {guidanceAttachment ? (
                    <div className="p-4 bg-white border-2 border-emerald-200 rounded-2xl shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="flex items-center gap-4 w-full sm:w-auto">
                        {guidanceAttachment.type === 'image' && (
                          <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-200 flex-shrink-0 bg-slate-100">
                            <img 
                              src={guidanceAttachment.base64} 
                              alt="Preview" 
                              className="w-full h-full object-cover" 
                            />
                          </div>
                        )}

                        {guidanceAttachment.type === 'audio' && (
                          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center flex-shrink-0 text-emerald-600">
                            <Music className="w-6 h-6 animate-pulse" />
                          </div>
                        )}

                        {guidanceAttachment.type === 'pdf' && (
                          <div className="w-12 h-12 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center flex-shrink-0 text-rose-600">
                            <FileText className="w-6 h-6" />
                          </div>
                        )}

                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md",
                              guidanceAttachment.type === 'image' ? "bg-indigo-100 text-indigo-700" :
                              guidanceAttachment.type === 'audio' ? "bg-emerald-100 text-emerald-700" :
                              "bg-rose-100 text-rose-700"
                            )}>
                              {guidanceAttachment.type === 'image' ? 'Imagem' : guidanceAttachment.type === 'audio' ? 'Áudio' : 'Documento PDF'}
                            </span>
                            <span className="text-xs text-slate-400 font-semibold">{formatFileSize(guidanceAttachment.size)}</span>
                          </div>
                          <p className="text-sm font-bold text-slate-800 truncate max-w-xs">{guidanceAttachment.fileName}</p>

                          {guidanceAttachment.type === 'audio' && (
                            <audio controls src={guidanceAttachment.base64} className="h-8 mt-2 w-full max-w-xs" />
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setGuidanceAttachment(null)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-bold transition-all self-end sm:self-center"
                        title="Remover anexo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remover</span>
                      </button>
                    </div>
                  ) : (
                    <div 
                      onClick={() => handleTriggerUpload('image/*,audio/*,application/pdf')}
                      className="border-2 border-dashed border-slate-200 hover:border-emerald-400 rounded-2xl p-6 text-center cursor-pointer bg-white/60 hover:bg-emerald-50/20 transition-all group"
                    >
                      <UploadCloud className="w-8 h-8 text-slate-300 group-hover:text-emerald-500 mx-auto mb-2 transition-colors" />
                      <p className="text-xs font-bold text-slate-600 group-hover:text-emerald-700">Clique aqui para anexar uma imagem, áudio gravado ou documento PDF</p>
                      <p className="text-[10px] text-slate-400 mt-1">Formatos suportados: PNG, JPG, MP3, WAV, OGG, PDF (máx. 15MB)</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="bg-rose-50/50 text-rose-700 p-4 rounded-2xl text-sm font-medium flex items-center gap-3">
                   <div className="p-2 bg-rose-100 rounded-lg"><Heart className="w-5 h-5" /></div>
                   Estes itens de autocuidado serão salvos no prontuário e enviados automaticamente via WhatsApp ao finalizar o atendimento.
                </div>
                
                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {prescriptionItems.map((item, idx) => (
                    <div key={idx} className="bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 relative">
                      {prescriptionItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setPrescriptionItems(prescriptionItems.filter((_, i) => i !== idx))}
                          className="absolute top-4 right-4 p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tipo de Orientação</label>
                          <select
                            value={item.type}
                            onChange={(e) => {
                              const newItems = [...prescriptionItems];
                              newItems[idx].type = e.target.value;
                              setPrescriptionItems(newItems);
                            }}
                            className="w-full p-4 bg-white border border-slate-200 rounded-xl outline-none font-bold text-slate-700 cursor-pointer"
                          >
                            <option value="floral">🌸 Floral de Bach / Frequencial</option>
                            <option value="ervas">🌿 Fitoterapia / Ervas / Chá</option>
                            <option value="exercicio">🧘 Prática / Exercício / Meditação</option>
                            <option value="outro">📝 Outros Autocuidados</option>
                          </select>
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nome do Recomendado / Prática</label>
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => {
                              const newItems = [...prescriptionItems];
                              newItems[idx].name = e.target.value;
                              setPrescriptionItems(newItems);
                            }}
                            className="w-full p-4 bg-white border border-slate-200 rounded-xl outline-none font-bold text-slate-700"
                            placeholder="Ex: Floral Rescue Remedy, Meditação..."
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Instruções de Uso / Posologia</label>
                        <textarea
                          value={item.usage}
                          onChange={(e) => {
                            const newItems = [...prescriptionItems];
                            newItems[idx].usage = e.target.value;
                            setPrescriptionItems(newItems);
                          }}
                          className="w-full p-4 bg-white border border-slate-200 rounded-xl outline-none font-medium text-slate-700 min-h-[60px]"
                          placeholder="Ex: Tomar 4 gotas sublinguais 4x ao dia. Praticar pela manhã..."
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-start">
                  <button
                    type="button"
                    onClick={() => setPrescriptionItems([...prescriptionItems, { type: 'floral', name: '', usage: '' }])}
                    className="px-5 py-3 border border-indigo-200 hover:border-indigo-500 text-indigo-600 bg-white rounded-xl text-xs font-bold transition-all flex items-center gap-2"
                  >
                    + Adicionar Item de Autocuidado
                  </button>
                </div>
              </div>
            )}
            
            <div className="flex flex-col sm:flex-row items-center gap-4 pt-6 border-t border-slate-50">
              <button 
                onClick={() => {
                   setToastMessage('Alterações salvas temporariamente no rascunho.');
                   setTimeout(() => setToastMessage(null), 3500);
                }}
                disabled={loading}
                className="w-full sm:flex-1 py-5 bg-indigo-600 text-white rounded-[1.5rem] font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-5 h-5" /> Salvar Evolução
              </button>
              <button 
                onClick={handleFinishSession}
                disabled={loading}
                className="w-full sm:w-auto px-12 py-5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-[1.5rem] font-bold hover:bg-emerald-100 transition-all active:scale-95 flex gap-2 items-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />} Finalizar e Encerrar
              </button>
            </div>
          </div>
        </div>

        {/* Info & History Sidebar */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
            <h4 className="font-bold text-slate-800 text-xs uppercase tracking-widest flex items-center gap-2 border-b border-slate-100 pb-4">
              <User className="w-4 h-4 text-indigo-600" /> Ficha Resumo
            </h4>
            <div className="space-y-4">
              <div className="flex justify-between text-sm py-1">
                <span className="text-slate-400 font-medium tracking-wide">ID Paciente</span>
                <span className="font-bold text-slate-700">#{selectedPatient?.patientId?.split('-')[0]}</span>
              </div>
              <div className="flex justify-between text-sm py-1">
                <span className="text-slate-400 font-medium tracking-wide">Terapeuta Atual</span>
                <span className="font-bold text-slate-700">{selectedPatient?.therapist}</span>
              </div>
            </div>
          </div>

          <div className="bg-indigo-50/50 p-8 rounded-[2.5rem] border border-indigo-100 space-y-6 flex flex-col h-full lg:min-h-[400px]">
            <h4 className="font-bold text-indigo-900 text-xs flex items-center gap-2 uppercase tracking-widest">
              <History className="w-4 h-4" /> Histórico Operacional
            </h4>
            <div className="space-y-6 flex-1 overflow-y-auto max-h-[300px]">
              {history.slice(0, 3).map((item) => (
                <div key={item.id} className="relative pl-6 border-l-2 border-indigo-200">
                  <div className="absolute top-0 left-[-9px] w-4 h-4 rounded-full bg-white border-2 border-indigo-600 shadow-sm" />
                  <p className="font-bold text-indigo-600 text-[10px] uppercase mb-1 tracking-wider">{new Date(item.date).toLocaleDateString('pt-BR')}</p>
                  <p className="text-xs leading-relaxed text-slate-600 font-medium italic line-clamp-3">
                    "{item.content}"
                  </p>
                </div>
              ))}
              {history.length === 0 && <p className="text-xs text-slate-400 italic">Sem registros anteriores.</p>}
            </div>
            <button 
              onClick={() => setShowFullRecord(true)}
              className="w-full py-4 bg-white text-indigo-600 rounded-2xl text-xs font-bold border border-indigo-100 hover:bg-slate-50 transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              Ver Prontuário Completo <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Full Record Modal */}
      {showFullRecord && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white rounded-[3rem] w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col shadow-2xl relative border border-slate-100">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600">
                  <History className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-slate-900 tracking-tight">Prontuário Completo</h3>
                  <p className="text-sm text-slate-500 font-medium">Histórico de sessões de {selectedPatient?.patient}</p>
                </div>
              </div>
              <button onClick={() => setShowFullRecord(false)} className="p-3 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>
            <div className="p-6 sm:p-10 overflow-y-auto space-y-8 bg-slate-50/30 flex-1">
              <div className="flex gap-4 mb-6 border-b border-slate-200 overflow-x-auto hide-scrollbar">
                {[
                  { id: 'evolution', label: 'Evoluções', icon: History }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={cn(
                      "px-6 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap",
                      activeTab === tab.id ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-400 hover:text-slate-600"
                    )}
                  >
                    <tab.icon className="w-4 h-4" /> {tab.label}
                  </button>
                ))}
              </div>

              {activeTab === 'evolution' && (
                <div className="space-y-6">
                  {history.map((item) => {
                    const isEditing = editingEvolution?.id === item.id;
                    const isResending = resendingEvolutionId === item.id;

                    return (
                      <div key={item.id} className="bg-white p-6 sm:p-8 rounded-[2rem] border border-slate-200 shadow-sm space-y-4 hover:border-indigo-200 transition-all group">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-0">
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="flex items-center gap-2 text-indigo-600 font-bold text-xs bg-indigo-50 px-3 py-1 rounded-lg">
                              <Calendar className="w-3.5 h-3.5" /> {new Date(item.date).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })} às {new Date(item.date).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo'})}
                            </span>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-2 py-1 bg-slate-100 rounded-md">
                              {item.type}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-medium text-slate-400">Terapeuta: <strong className="text-slate-600">{item.therapist}</strong></span>
                            {!isEditing && (
                              <button
                                type="button"
                                onClick={() => setEditingEvolution({ id: item.id, notes: item.content || '' })}
                                className="px-3 py-1 bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-600 rounded-lg text-xs font-bold transition-all flex items-center gap-1 shadow-sm"
                              >
                                <Edit className="w-3.5 h-3.5" /> Editar / Reenviar
                              </button>
                            )}
                          </div>
                        </div>

                        {isEditing ? (
                          <div className="space-y-4 bg-slate-50 p-4 rounded-2xl border border-indigo-100 animate-in fade-in duration-200">
                            <label className="text-xs font-bold text-slate-700 block">Editar Orientação / Anotações:</label>
                            <textarea
                              value={editingEvolution.notes}
                              onChange={(e) => setEditingEvolution({ ...editingEvolution, notes: e.target.value })}
                              rows={4}
                              className="w-full p-4 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                              placeholder="Digite o texto corrigido da orientação..."
                            />
                            <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                              <button
                                type="button"
                                onClick={() => setEditingEvolution(null)}
                                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-all"
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUpdateEvolution(item.id, editingEvolution.notes, false)}
                                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                              >
                                <Save className="w-3.5 h-3.5" />
                                Salvar Alteração
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUpdateEvolution(item.id, editingEvolution.notes, true)}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-emerald-100"
                              >
                                {isResending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                                Salvar e Reenviar via WhatsApp
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-slate-700 text-lg leading-relaxed whitespace-pre-wrap">{item.content}</p>
                        )}
                      </div>
                    );
                  })}
                  {history.length === 0 && (
                    <div className="py-10 text-center text-slate-400 font-medium">Nenhum registro anterior encontrado.</div>
                  )}
                </div>
              )}
            </div>
            <div className="p-8 border-t border-slate-100 bg-white flex justify-end">
              <button 
                onClick={() => setShowFullRecord(false)}
                className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-bold text-sm tracking-wide"
              >
                Fechar Prontuário
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Last Guidance Tooltip/Modal */}
      {showLastGuidance && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] flex items-center justify-center p-6 animate-in zoom-in-95 duration-300">
          <div className="bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl p-10 space-y-6 relative border border-slate-100">
            <div className="absolute top-6 right-6">
              <button onClick={() => setShowLastGuidance(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex items-center gap-3 text-indigo-600">
              <AlertCircle className="w-6 h-6" />
              <h4 className="text-xl font-bold tracking-tight">Última Orientação ({history.length > 0 ? new Date(history[0].date).toLocaleDateString('pt-BR') : 'N/A'})</h4>
            </div>
            <div className="bg-indigo-50/50 p-6 rounded-2xl border border-indigo-100">
              <p className="text-indigo-950 font-medium leading-relaxed italic text-lg">
                "{history.length > 0 ? history[0].content : 'Nenhuma anotação anterior encontrada.'}"
              </p>
            </div>
            <button 
              onClick={() => {
                if (history.length > 0) {
                  setNotes(prev => prev + (prev ? '\n\n' : '') + 'Referente à orientação anterior: ');
                }
                setShowLastGuidance(false);
              }}
              className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors"
            >
              <Save className="w-4 h-4" /> Importar para sessão atual
            </button>
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
