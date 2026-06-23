import React, { useState, useEffect } from 'react';
import { PlayCircle, Clock, Save, FileText, User, Search, CheckCircle2, AlertCircle, X, ChevronRight, History, Calendar, ExternalLink, Plus, Loader2, MessageSquare, Heart } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { supabase } from '@/src/lib/supabase';
import { useActiveSession } from '@/src/contexts/ActiveSessionContext';

export default function SessionLogger() {
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
  const [indicators, setIndicators] = useState({ anxiety: 5, vitality: 5, physical_pain: 0, sleep_quality: 5 });
  const [prescriptionItems, setPrescriptionItems] = useState<{ type: string; name: string; usage: string }[]>([
    { type: 'floral', name: '', usage: '' }
  ]);

  // Persist notes and guidance in sessionStorage to survive page refresh
  const [notes, setNotes] = useState(() => sessionStorage.getItem('@tzion:session-logger:notes') || '');
  const [guidance, setGuidance] = useState(() => sessionStorage.getItem('@tzion:session-logger:guidance') || '');

  useEffect(() => {
    sessionStorage.setItem('@tzion:session-logger:notes', notes);
  }, [notes]);

  useEffect(() => {
    sessionStorage.setItem('@tzion:session-logger:guidance', guidance);
  }, [guidance]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];
      
      const [apptsRes, patientsRes, therapistsRes] = await Promise.all([
        supabase
          .from('appointments')
          .select('*')
          .gte('start_time', `${today}T00:00:00`)
          .lte('start_time', `${today}T23:59:59`)
          .order('start_time', { ascending: true }),
        supabase.from('patients').select('id, name'),
        supabase.from('therapists').select('id, name')
      ]);

      const patientsMap = new Map((patientsRes.data || []).map(p => [p.id, p.name]));
      const therapistsMap = new Map((therapistsRes.data || []).map(t => [t.id, t.name]));

      const formatted = (apptsRes.data || []).filter(a => a.status !== 'completed').map(a => ({
        id: a.id,
        patientId: a.patient_id,
        patient: patientsMap.get(a.patient_id) || 'Paciente Não Encontrado',
        time: new Date(a.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
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
    const { data } = await supabase
      .from('patient_evolutions')
      .select(`
        id,
        notes,
        type,
        created_at,
        therapists (name)
      `)
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });

    const formatted = (data || []).map((r: any) => ({
      id: r.id,
      date: r.created_at,
      content: r.notes,
      therapist: Array.isArray(r.therapists) ? (r.therapists[0]?.name || 'Terapeuta') : (r.therapists?.name || 'Terapeuta'),
      type: r.type || 'Evolução'
    }));

    setHistory(formatted);
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
    fetchData();
  }, []);

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

      if (guidance.trim()) {
         await supabase.from('patient_evolutions').insert({
            patient_id: selectedPatient.patientId,
            therapist_id: selectedPatient.therapistId,
            notes: guidance,
            type: 'Orientação'
         });
         
         const { data: patientData } = await supabase.from('patients').select('phone').eq('id', selectedPatient.patientId).single();
         if (patientData?.phone) {
             const { sendWhatsAppMessage } = await import('@/src/lib/whatsapp');
             const msg = `*Orientação do seu terapeuta:*\n\n${guidance}`;
             await sendWhatsAppMessage(selectedPatient.patientId, patientData.phone, msg, 'patient_guidance');
         }
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
            nps_sent: false
        })
        .eq('id', selectedPatient.id);

      clearActiveSession();
      setNotes('');
      setGuidance('');
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

  if (!sessionActive) {
    return (
      <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Próximos Atendimentos</h2>
          <button onClick={fetchData} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            {loading ? <Loader2 className="w-5 h-5 animate-spin text-indigo-600" /> : <History className="w-5 h-5 text-slate-400" />}
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {appointments.map((apt) => (
            <div key={apt.id} className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-xl hover:border-indigo-200 transition-all group flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-6 w-full sm:w-auto">
                <div className="text-center min-w-[60px]">
                  <p className="text-2xl font-bold text-slate-900 leading-none">{apt.time}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-widest">Início</p>
                </div>
                <div className="h-12 w-px bg-slate-100 hidden sm:block" />
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 font-bold text-xl group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all shadow-sm">
                    {apt.patient.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-slate-900 group-hover:text-indigo-600 transition-colors">{apt.patient}</h3>
                    <p className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
                      <FileText className="w-3 h-3" /> {apt.therapy} • <span className={cn(apt.type === 'Online' ? "text-blue-500" : "text-slate-500")}>{apt.type}</span>
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button 
                  onClick={() => handleStartSession(apt)}
                  className="flex-1 sm:flex-none px-8 py-3.5 bg-indigo-600 text-white rounded-2xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 shadow-lg shadow-indigo-100 active:scale-95 transition-all"
                >
                  <PlayCircle className="w-4 h-4" /> Iniciar Atendimento
                </button>
              </div>
            </div>
          ))}
          {!loading && appointments.length === 0 && (
            <div className="py-20 text-center text-slate-400 font-medium border-2 border-dashed border-slate-200 rounded-[2rem]">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-4" />
              Nenhum atendimento agendado para hoje.
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
                  rows={12}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Descreva a evolução do paciente, principais dores e intervenções realizadas na sessão de hoje (Apenas uso interno)..."
                  className="w-full p-8 text-slate-700 bg-slate-50/50 border border-slate-100 rounded-[2rem] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-xl leading-relaxed placeholder:text-slate-300 shadow-inner"
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
                <div className="bg-emerald-50 text-emerald-700 p-4 rounded-2xl text-sm font-medium flex items-center gap-3">
                   <div className="p-2 bg-emerald-100 rounded-lg"><CheckCircle2 className="w-5 h-5" /></div>
                   O texto abaixo será enviado automaticamente para o WhatsApp do paciente ao finalizar a sessão.
                </div>
                <textarea 
                  rows={13}
                  value={guidance}
                  onChange={(e) => setGuidance(e.target.value)}
                  placeholder="Ex: Olá! Como combinado hoje na sessão, lembre-se de fazer o exercício de respiração sempre que sentir ansiedade..."
                  className="w-full p-8 text-slate-700 bg-emerald-50/30 border border-emerald-100 rounded-[2rem] focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all text-xl leading-relaxed placeholder:text-slate-300 shadow-inner"
                ></textarea>
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
                className="w-full sm:flex-1 py-5 bg-indigo-600 text-white rounded-[1.5rem] font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 active:scale-95"
              >
                <Save className="w-5 h-5" /> Salvar Evolução
              </button>
              <button 
                onClick={handleFinishSession}
                className="w-full sm:w-auto px-12 py-5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-[1.5rem] font-bold hover:bg-emerald-100 transition-all active:scale-95 flex gap-2 items-center"
              >
                <CheckCircle2 className="w-5 h-5" /> Finalizar e Encerrar
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
                  {history.map((item) => (
                    <div key={item.id} className="bg-white p-6 sm:p-8 rounded-[2rem] border border-slate-200 shadow-sm space-y-4 hover:border-indigo-200 transition-all group">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-0">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="flex items-center gap-2 text-indigo-600 font-bold text-xs bg-indigo-50 px-3 py-1 rounded-lg">
                            <Calendar className="w-3.5 h-3.5" /> {new Date(item.date).toLocaleDateString('pt-BR')} às {new Date(item.date).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-2 py-1 bg-slate-100 rounded-md">
                            {item.type}
                          </span>
                        </div>
                        <span className="text-xs font-medium text-slate-400">Terapeuta: <strong className="text-slate-600">{item.therapist}</strong></span>
                      </div>
                      <p className="text-slate-700 text-lg leading-relaxed whitespace-pre-wrap">{item.content}</p>
                    </div>
                  ))}
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
