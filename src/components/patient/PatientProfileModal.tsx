import React, { useState, useEffect } from 'react';
import { 
  X, User, Calendar, CreditCard, ClipboardList, Activity, 
  Award, Clock, CheckCircle2, ChevronRight, DollarSign, Loader2, FileText,
  Upload, Trash2, Paperclip, Image, ExternalLink, StickyNote, Send, Sparkles
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { supabase } from '@/src/lib/supabase';
import { sendWhatsAppMessage } from '@/src/lib/whatsapp';
import { getSystemBaseUrl } from '@/src/utils/systemUrl';
import { fillContractTemplate, DEFAULT_CONTRACT_TEMPLATE } from '@/src/lib/contract';
import ErrorBoundary from '@/src/components/ErrorBoundary';
import { useAuth } from '@/src/contexts/AuthContext';

interface PatientProfileModalProps {
  patient: any;
  onClose: () => void;
}

function PatientProfileModalContent({ patient, onClose }: PatientProfileModalProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'timeline' | 'records' | 'documents' | 'notes'>('timeline');
  const [loading, setLoading] = useState(true);
  
  // Data
  const [timeline, setTimeline] = useState<any[]>([]);
  const [packages, setPackages] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [patientNotes, setPatientNotes] = useState<any[]>([]);
  const [generatingContractId, setGeneratingContractId] = useState<string | null>(null);

  // New Note State
  const [newNoteText, setNewNoteText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Geral');
  const [savingNote, setSavingNote] = useState(false);

  // Upload Form State
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [docTitle, setDocTitle] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  // Pagination
  const [timelinePage, setTimelinePage] = useState(1);
  const itemsPerPage = 10;
  
  const fetchPatientData = async () => {
    if (!patient?.id) return;
    setLoading(true);
    try {
      const [appRes, recRes, evoRes, payRes, packRes, conRes, docRes] = await Promise.all([
        supabase.from('appointments').select('*, therapists(name)').eq('patient_id', patient.id),
        supabase.from('medical_records').select('*, therapists(name)').eq('patient_id', patient.id),
        supabase.from('patient_evolutions').select('*, therapists(name)').eq('patient_id', patient.id),
        supabase.from('payments').select('*').eq('patient_id', patient.id).order('created_at', { ascending: false }),
        supabase.from('patient_packages').select('*, services(name, price, type)').eq('patient_id', patient.id),
        supabase.from('patient_contracts').select('*').eq('patient_id', patient.id).order('created_at', { ascending: false }),
        supabase.from('patient_documents').select('*').eq('patient_id', patient.id).order('created_at', { ascending: false })
      ]);

      const appointments = appRes.data || [];
      const records = recRes.data || [];
      const evolutions = evoRes.data || [];
      const payments = payRes.data || [];
      const pkgs = packRes.data || [];
      const contracts = conRes.data || [];
      const docs = docRes.data || [];

      setPackages(pkgs);
      setDocuments(docs);
      setPatientNotes(evolutions);

      // Normalize events for the timeline
      let events: any[] = [];

      // 1. Appointments
      appointments.forEach(app => {
         const date = new Date(app.start_time || new Date());
         events.push({
             id: `app-${app.id}`,
             type: 'appointment',
             date: isNaN(date.getTime()) ? new Date() : date,
             title: `Sessão ${app.status === 'completed' ? 'Realizada' : 'Agendada'}`,
             description: `Modalidade: ${app.type || 'Presencial'} | Terapeuta: ${app.therapists?.name || 'Não atribuído'}`,
             status: app.status
         });
      });

      // 2. Medical Records
      records.forEach(rec => {
          const date = new Date(rec.created_at || new Date());
          events.push({
              id: `rec-${rec.id}`,
              type: 'record',
              date: isNaN(date.getTime()) ? new Date() : date,
              title: rec.type === 'evolution' ? 'Evolução Clínica' : 'Anamnese',
              description: `Anotação feita por ${rec.therapists?.name || 'Terapeuta'}. ${rec.content?.text ? rec.content.text.substring(0, 150) + '...' : ''}`,
              rawContent: rec.content?.text
          });
      });

      // 2.5 Patient Evolutions (from session logger)
      evolutions.forEach(evo => {
          const date = new Date(evo.created_at || new Date());
          events.push({
              id: `evo-${evo.id}`,
              type: 'record',
              date: isNaN(date.getTime()) ? new Date() : date,
              title: evo.type || 'Sessão Regular',
              description: `Anotação feita por ${evo.therapists?.name || 'Terapeuta'}. ${evo.notes ? evo.notes.substring(0, 150) + '...' : ''}`,
              rawContent: evo.notes
          });
      });

      // 3. Payments / Purchases
      payments.forEach(pay => {
          const date = new Date(pay.created_at || new Date());
          events.push({
              id: `pay-${pay.id}`,
              type: 'finance',
              date: isNaN(date.getTime()) ? new Date() : date,
              title: `Pagamento: ${pay.payment_method?.toUpperCase() || 'PIX'}`,
              description: `${pay.description || ''} | R$ ${Number(pay.amount || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`,
              status: pay.status
          });
      });

      // 4. Contracts
      const baseUrlForContracts = await getSystemBaseUrl();
      contracts.forEach(contract => {
          const date = new Date(contract.created_at || new Date());
          events.push({
              id: `contract-${contract.id}`,
              type: 'contract',
              date: isNaN(date.getTime()) ? new Date() : date,
              title: `Contrato de Serviço ${contract.status === 'signed' ? '(Assinado)' : '(Pendente)'}`,
              description: `Acesse o termo no link: ${baseUrlForContracts}/contrato/${contract.id}`,
              status: contract.status
          });
      });

      // 5. Patient Documents / Attachments
      docs.forEach(doc => {
          const date = new Date(doc.created_at || new Date());
          events.push({
              id: `doc-${doc.id}`,
              type: 'document',
              date: isNaN(date.getTime()) ? new Date() : date,
              title: `Anexo no Prontuário: ${doc.title}`,
              description: `Documento/Imagem anexado. Clique na aba Documentos para abrir ou baixar.`,
              fileUrl: doc.file_url
          });
      });

      // Sort by date (newest first)
      events.sort((a, b) => b.date.getTime() - a.date.getTime());
      setTimeline(events);

    } catch (err) {
      console.error('Error fetching profile', err);
    }
    setLoading(false);
  };

  const handleUploadDocument = async () => {
    if (!selectedFile || !patient?.id) return;

    // Trava de Segurança: Limite de 5 MB (5 * 1024 * 1024 bytes)
    if (selectedFile.size > 5 * 1024 * 1024) {
      alert('⚠️ Arquivo excede o limite de 5MB para preservar o sistema. Por favor selecione uma imagem ou documento menor.');
      return;
    }

    setUploadingDoc(true);
    try {
      const cleanFileName = selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `${patient.id}/${Date.now()}_${cleanFileName}`;

      const { data: uploadData, error: uploadErr } = await supabase
        .storage
        .from('patient-documents')
        .upload(filePath, selectedFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadErr) {
        console.error('Erro no upload para o storage:', uploadErr);
        throw new Error('Falha ao enviar o arquivo para o armazenamento.');
      }

      const { data: pubUrlData } = supabase
        .storage
        .from('patient-documents')
        .getPublicUrl(filePath);

      const title = docTitle.trim() || selectedFile.name;

      const { error: dbErr } = await supabase
        .from('patient_documents')
        .insert({
          patient_id: patient.id,
          title: title,
          file_url: pubUrlData.publicUrl,
          file_type: selectedFile.type || 'application/octet-stream',
          file_path: filePath
        });

      if (dbErr) throw dbErr;

      alert('Documento/Imagem anexado com sucesso!');
      setDocTitle('');
      setSelectedFile(null);
      fetchPatientData();
    } catch (err: any) {
      console.error(err);
      alert('Erro ao salvar documento: ' + (err.message || err));
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleDeleteDocument = async (doc: any) => {
    if (!confirm(`Deseja realmente remover o documento "${doc.title}"?`)) return;

    try {
      if (doc.file_path) {
        await supabase.storage.from('patient-documents').remove([doc.file_path]);
      }
      await supabase.from('patient_documents').delete().eq('id', doc.id);
      alert('Documento removido com sucesso!');
      fetchPatientData();
    } catch (err: any) {
      console.error(err);
      alert('Erro ao excluir documento.');
    }
  };

  useEffect(() => {
    fetchPatientData();
  }, [patient]);

  const handleAddPatientNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim() || !patient?.id) return;
    try {
      setSavingNote(true);
      const authorRoleLabel = user?.role === 'terapeuta' 
        ? 'Terapeuta' 
        : user?.role === 'admin' 
          ? 'Administração' 
          : 'Recepção / Secretária';
      
      const authorName = user?.name || user?.email?.split('@')[0] || authorRoleLabel;
      const formattedNote = `[${selectedCategory}] ${newNoteText.trim()}\n— Por ${authorName} (${authorRoleLabel})`;

      const { error } = await supabase
        .from('patient_evolutions')
        .insert([{
          patient_id: patient.id,
          therapist_id: user?.role === 'terapeuta' ? (user as any)?.therapist_id || null : null,
          type: user?.role === 'terapeuta' ? 'Anotação do Terapeuta' : 'Anotação da Recepção',
          notes: formattedNote
        }]);

      if (error) throw error;
      setNewNoteText('');
      await fetchPatientData();
    } catch (err: any) {
      alert('Erro ao salvar anotação: ' + err.message);
    } finally {
      setSavingNote(false);
    }
  };

  const handleDeletePatientNote = async (noteId: string) => {
    if (!confirm('Deseja realmente remover esta anotação?')) return;
    try {
      const { error } = await supabase
        .from('patient_evolutions')
        .delete()
        .eq('id', noteId);

      if (error) throw error;
      await fetchPatientData();
    } catch (err: any) {
      alert('Erro ao excluir anotação: ' + err.message);
    }
  };

  const renderIcon = (type: string) => {
      switch(type) {
          case 'appointment': return <Calendar className="w-5 h-5 text-indigo-600" />;
          case 'record': return <ClipboardList className="w-5 h-5 text-emerald-600" />;
          case 'finance': return <DollarSign className="w-5 h-5 text-rose-600" />;
          case 'contract': return <FileText className="w-5 h-5 text-amber-600" />;
          case 'document': return <Paperclip className="w-5 h-5 text-indigo-600" />;
          default: return <Activity className="w-5 h-5 text-slate-600" />;
      }
  };

  const renderColor = (type: string) => {
    switch(type) {
        case 'appointment': return "bg-indigo-50 border-indigo-200 text-indigo-900";
        case 'record': return "bg-emerald-50 border-emerald-200 text-emerald-900";
        case 'finance': return "bg-rose-50 border-rose-200 text-rose-900";
        case 'contract': return "bg-amber-50 border-amber-200 text-amber-900";
        case 'document': return "bg-indigo-50 border-indigo-200 text-indigo-900";
        default: return "bg-slate-50 border-slate-200 text-slate-900";
    }
  };

  const handleGenerateContract = async (pkg: any) => {
    try {
      setGeneratingContractId(pkg.id);
      
      const { data: setts } = await supabase.from('settings').select('value').eq('key', 'contract_template').maybeSingle();
      let rawTemplate = setts?.value || DEFAULT_CONTRACT_TEMPLATE;
      
      const filledContent = fillContractTemplate(rawTemplate, {
        patient,
        package: pkg
      });

      const { data: contract, error } = await supabase.from('patient_contracts').insert({
        patient_id: patient.id,
        content: filledContent,
        status: 'pending',
      }).select().single();

      if (error) throw error;

      const baseUrl = await getSystemBaseUrl();
      const link = `${baseUrl}/contrato/${contract.id}`;
      const firstName = patient.name?.split(' ')[0] || 'Paciente';
      let msg = `[Contrato - Tzion Terapias]\n\n`;
      msg += `Olá, *${firstName}*! ✨\n\n`;
      msg += `O seu termo de serviço terapêutico foi gerado.\n`;
      msg += `Por favor, leia e assine digitalmente no link seguro abaixo:\n\n`;
      msg += `🔗 ${link}\n\n`;
      msg += `Qualquer dúvida, estamos à disposição! 💙`;
      
      if (patient.phone) {
          await sendWhatsAppMessage(patient.id, patient.phone, msg, 'contract_sent');
          alert('Contrato gerado e enviado via WhatsApp com sucesso!');
          fetchPatientData(); // Refresh timeline to show contract
      } else {
          alert('Contrato gerado com sucesso, mas o paciente não possui telefone cadastrado.');
      }
    } catch (err: any) {
      console.error(err);
      alert('Erro ao gerar contrato. Certifique-se de ter rodado o script SQL.');
    } finally {
      setGeneratingContractId(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
        <div className="bg-white rounded-[3rem] w-full max-w-4xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-indigo-600 text-white rounded-3xl flex items-center justify-center text-2xl font-black shadow-lg shadow-indigo-200">
                        {patient?.name?.charAt(0) || 'P'}
                    </div>
                    <div>
                        <h3 className="text-3xl font-black text-slate-900 tracking-tight">{patient?.name}</h3>
                        <p className="text-slate-500 font-medium">{patient?.phone || 'Sem telefone'}</p>
                    </div>
                </div>
                <button onClick={onClose} className="p-3 hover:bg-white rounded-full text-slate-400 transition-all border border-transparent hover:border-slate-200 shadow-sm">
                    <X className="w-6 h-6" />
                </button>
            </div>

            {/* Content Tabs */}
            <div className="flex border-b border-slate-100 px-8 overflow-x-auto no-scrollbar">
                {[
                    { id: 'timeline', label: 'Linha do Tempo 360º', icon: Activity },
                    { id: 'notes', label: 'Anotações da Recepção', icon: StickyNote },
                    { id: 'records', label: 'Pacotes & Créditos', icon: Award },
                    { id: 'documents', label: 'Documentos & Anexos', icon: FileText },
                ].map(t => (
                    <button 
                        key={t.id}
                        onClick={() => setActiveTab(t.id as any)}
                        className={cn(
                            "px-6 py-5 font-bold flex items-center gap-2 border-b-4 transition-all text-sm uppercase tracking-widest",
                            activeTab === t.id ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-400 hover:text-slate-600"
                        )}
                    >
                        <t.icon className="w-4 h-4" /> {t.label}
                    </button>
                ))}
            </div>

            {/* Scrollable Body */}
            <div className="p-8 overflow-y-auto flex-1 bg-slate-50/30">
                {loading ? (
                    <div className="py-20 flex justify-center"><Loader2 className="w-10 h-10 text-indigo-600 animate-spin" /></div>
                ) : (
                    <>
                        {activeTab === 'timeline' && (
                            <div>
                                <div className="space-y-8 relative before:absolute before:inset-0 before:ml-6 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-indigo-100 before:via-slate-200 before:to-transparent">
                                    {timeline.slice((timelinePage - 1) * itemsPerPage, timelinePage * itemsPerPage).map((evt, idx) => (
                                    <div key={evt.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                                        <div className={cn(
                                            "flex items-center justify-center w-12 h-12 rounded-full border-4 border-white shadow-md shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 relative z-10 transition-transform group-hover:scale-110",
                                            evt.type === 'appointment' ? "bg-indigo-100" : 
                                            evt.type === 'record' ? "bg-emerald-100" : "bg-rose-100"
                                        )}>
                                            {renderIcon(evt.type)}
                                        </div>
                                        
                                        <div className={cn(
                                            "w-[calc(100%-4rem)] md:w-[calc(50%-3rem)] p-6 rounded-[2rem] shadow-sm border transition-all hover:shadow-md",
                                            renderColor(evt.type)
                                        )}>
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-[10px] font-black uppercase tracking-widest opacity-70">
                                                    {evt.date.toLocaleDateString('pt-BR')} às {evt.date.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}
                                                </span>
                                            </div>
                                            <h4 className="text-lg font-black mb-1">{evt.title}</h4>
                                            <p className="text-sm font-medium opacity-80 leading-relaxed">{evt.description}</p>
                                        </div>
                                    </div>
                                ))}
                                {timeline.length === 0 && (
                                    <div className="text-center py-20 text-slate-400 font-medium">Nenhum evento registrado ainda.</div>
                                )}
                            </div>
                            
                            {timeline.length > itemsPerPage && (
                                <div className="mt-8 pt-6 border-t border-slate-200 flex items-center justify-between">
                                    <button 
                                        onClick={() => setTimelinePage(prev => Math.max(prev - 1, 1))}
                                        disabled={timelinePage === 1}
                                        className="px-6 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold disabled:opacity-50 hover:bg-slate-50 transition-all text-sm shadow-sm"
                                    >
                                        Anterior
                                    </button>
                                    <span className="text-sm font-bold text-slate-400">
                                        Página {timelinePage} de {Math.ceil(timeline.length / itemsPerPage)}
                                    </span>
                                    <button 
                                        onClick={() => setTimelinePage(prev => Math.min(prev + 1, Math.ceil(timeline.length / itemsPerPage)))}
                                        disabled={timelinePage === Math.ceil(timeline.length / itemsPerPage)}
                                        className="px-6 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold disabled:opacity-50 hover:bg-slate-50 transition-all text-sm shadow-sm"
                                    >
                                        Próxima
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                        {activeTab === 'records' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {packages.map(pkg => {
                                    const progress = Math.min((pkg.used_sessions / pkg.total_sessions) * 100, 100);
                                    return (
                                        <div key={pkg.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all">
                                            <div className="flex justify-between items-start mb-6">
                                                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center"><Award className="w-6 h-6"/></div>
                                                <span className={cn(
                                                    "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                                                    pkg.status === 'active' ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"
                                                )}>
                                                    {pkg.status === 'active' ? 'Ativo' : 'Concluído'}
                                                </span>
                                            </div>
                                            <h4 className="text-xl font-bold text-slate-900 mb-1">{pkg.services?.name || 'Pacote'}</h4>
                                            <p className="text-sm text-slate-500 font-medium mb-6">{pkg.services?.type || 'Sessão'}</p>
                                            
                                            <div className="space-y-2">
                                                <div className="flex justify-between text-xs font-bold text-slate-600">
                                                    <span>Progresso</span>
                                                    <span>{pkg.used_sessions} de {pkg.total_sessions} sessões</span>
                                                </div>
                                                <div className="w-full bg-slate-100 rounded-full h-3 mb-4">
                                                    <div className="bg-indigo-600 h-3 rounded-full transition-all" style={{ width: `${progress}%` }}></div>
                                                </div>
                                            </div>

                                            <div className="mt-6 pt-6 border-t border-slate-100 flex justify-end">
                                                <button 
                                                    onClick={() => handleGenerateContract(pkg)}
                                                    disabled={generatingContractId === pkg.id}
                                                    className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold shadow-md hover:bg-indigo-600 transition-colors disabled:opacity-50 flex items-center gap-2"
                                                >
                                                    {generatingContractId === pkg.id ? <Loader2 className="w-4 h-4 animate-spin"/> : <ClipboardList className="w-4 h-4" />}
                                                    Gerar e Enviar Contrato
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                                {packages.length === 0 && (
                                    <div className="col-span-full text-center py-20 text-slate-400 font-medium bg-white rounded-[3rem] border border-dashed border-slate-200">
                                        O paciente ainda não possui pacotes ou créditos ativos.
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'documents' && (
                          <div className="space-y-6">
                            {/* Form de Upload com limite de 5MB */}
                            <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-4">
                              <div className="flex items-center justify-between">
                                <div>
                                  <h4 className="text-base font-black text-slate-900">Anexar Novo Documento ou Imagem</h4>
                                  <p className="text-xs text-slate-500 font-medium">Suba laudos, exames ou fotos de evolução (Máx 5MB para preservar o sistema).</p>
                                </div>
                                <span className="px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-[10px] font-black uppercase">
                                  ⚡ Limite: 5MB
                                </span>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Título / Descrição do Documento</label>
                                  <input
                                    type="text"
                                    value={docTitle}
                                    onChange={e => setDocTitle(e.target.value)}
                                    placeholder="Ex: Laudo Médico / Fotos de Evolução"
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                  />
                                </div>

                                <div className="space-y-1.5">
                                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Selecione o Arquivo (PDF, Imagem, DOC)</label>
                                  <input
                                    type="file"
                                    accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.txt"
                                    onChange={e => {
                                      if (e.target.files && e.target.files[0]) {
                                        const f = e.target.files[0];
                                        if (f.size > 5 * 1024 * 1024) {
                                          alert('⚠️ Arquivo muito grande! O limite máximo é de 5MB para preservar o sistema.');
                                          e.target.value = '';
                                          return;
                                        }
                                        setSelectedFile(f);
                                      }
                                    }}
                                    className="w-full text-xs text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100 cursor-pointer"
                                  />
                                </div>
                              </div>

                              <div className="flex justify-end pt-2">
                                <button
                                  onClick={handleUploadDocument}
                                  disabled={uploadingDoc || !selectedFile}
                                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-xs shadow-lg shadow-indigo-100 transition-all flex items-center gap-2 disabled:opacity-50"
                                >
                                  {uploadingDoc ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                  Anexar ao Prontuário
                                </button>
                              </div>
                            </div>

                            {/* Lista de Documentos Anexados */}
                            <div className="space-y-3">
                              <h4 className="text-sm font-black text-slate-900 ml-1">Documentos & Imagens do Prontuário ({documents.length})</h4>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {documents.map(doc => {
                                  const isImg = doc.file_type?.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif)$/i.test(doc.file_url);
                                  return (
                                    <div key={doc.id} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-all flex items-center justify-between gap-4">
                                      <div className="flex items-center gap-3.5 overflow-hidden">
                                        <div className={cn(
                                          "w-11 h-11 rounded-2xl flex items-center justify-center shrink-0",
                                          isImg ? "bg-emerald-50 text-emerald-600" : "bg-indigo-50 text-indigo-600"
                                        )}>
                                          {isImg ? <Image className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                                        </div>
                                        <div className="truncate">
                                          <h5 className="font-bold text-sm text-slate-900 truncate" title={doc.title}>{doc.title}</h5>
                                          <p className="text-[11px] text-slate-400 font-medium">
                                            Anexado em {new Date(doc.created_at).toLocaleDateString('pt-BR')}
                                          </p>
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-2 shrink-0">
                                        <a
                                          href={doc.file_url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="p-2.5 bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 rounded-xl transition-colors"
                                          title="Visualizar / Baixar Arquivo"
                                        >
                                          <ExternalLink className="w-4 h-4" />
                                        </a>
                                        <button
                                          onClick={() => handleDeleteDocument(doc)}
                                          className="p-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition-colors"
                                          title="Excluir Documento"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}

                                {documents.length === 0 && (
                                  <div className="col-span-full text-center py-12 text-slate-400 font-medium bg-white rounded-[2.5rem] border border-dashed border-slate-200">
                                    Nenhum documento ou imagem anexado ao prontuário ainda.
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        {activeTab === 'notes' && (
                          <div className="space-y-6">
                            {/* Form Nova Anotação */}
                            <form onSubmit={handleAddPatientNote} className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm space-y-4">
                              <div className="flex items-center justify-between">
                                <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest flex items-center gap-1.5">
                                  <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Nova Anotação / Observação
                                </h4>
                                <span className="text-[10px] text-slate-400 font-bold">Visível para toda a equipe</span>
                              </div>

                              {/* Categorias */}
                              <div className="flex flex-wrap gap-1.5">
                                {[
                                  { id: 'Geral', label: '📌 Geral' },
                                  { id: 'Atendimento', label: '💙 Atendimento' },
                                  { id: 'Horários / Atraso', label: '⏰ Horários / Atraso' },
                                  { id: 'Financeiro', label: '💳 Financeiro / Recibo' },
                                  { id: 'Preferência', label: '⭐ Preferência' },
                                  { id: 'Importante', label: '⚠️ Importante' },
                                ].map(cat => (
                                  <button
                                    key={cat.id}
                                    type="button"
                                    onClick={() => setSelectedCategory(cat.id)}
                                    className={cn(
                                      "px-3 py-1 rounded-xl text-xs font-bold transition-all border",
                                      selectedCategory === cat.id
                                        ? "bg-amber-100 text-amber-900 border-amber-300 font-black shadow-sm"
                                        : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100"
                                    )}
                                  >
                                    {cat.label}
                                  </button>
                                ))}
                              </div>

                              <textarea
                                value={newNoteText}
                                onChange={(e) => setNewNoteText(e.target.value)}
                                placeholder="Escreva a anotação da secretaria, observação de atendimento, recado ou preferência..."
                                rows={3}
                                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-amber-500 font-medium text-sm text-slate-800 placeholder-slate-400 resize-none transition-all shadow-inner"
                              />

                              <div className="flex justify-end">
                                <button
                                  type="submit"
                                  disabled={savingNote || !newNoteText.trim()}
                                  className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-amber-200 flex items-center gap-2 disabled:opacity-50"
                                >
                                  {savingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                  Salvar Anotação
                                </button>
                              </div>
                            </form>

                            {/* Lista de Anotações */}
                            <div className="space-y-3">
                              <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <Clock className="w-4 h-4 text-slate-400" /> Histórico de Anotações ({patientNotes.length})
                              </h4>

                              {patientNotes.length === 0 ? (
                                <div className="text-center py-12 text-slate-400 font-medium bg-white rounded-[2.5rem] border border-dashed border-slate-200 p-8 space-y-2">
                                  <StickyNote className="w-10 h-10 text-slate-300 mx-auto" />
                                  <p className="font-bold text-slate-600 text-sm">Nenhuma anotação registrada ainda.</p>
                                  <p className="text-xs text-slate-400">Adicione recados ou observações usando o formulário acima.</p>
                                </div>
                              ) : (
                                <div className="space-y-3">
                                  {patientNotes.map((note) => {
                                    const isReception = note.type === 'Anotação da Recepção' || !note.therapist_id;
                                    const formattedDate = new Date(note.created_at).toLocaleDateString('pt-BR');
                                    const formattedTime = new Date(note.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

                                    return (
                                      <div key={note.id} className="p-5 bg-white rounded-2xl border border-slate-200 hover:border-slate-300 shadow-sm transition-all space-y-2 group">
                                        <div className="flex items-center justify-between gap-3">
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <span className={cn(
                                              "px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider",
                                              isReception 
                                                ? "bg-amber-50 text-amber-800 border border-amber-200" 
                                                : "bg-indigo-50 text-indigo-700 border border-indigo-200"
                                            )}>
                                              {isReception ? 'Recepção / Secretária' : `Terapeuta: ${note.therapists?.name || 'Clínico'}`}
                                            </span>
                                            <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                                              <Clock className="w-3 h-3" /> {formattedDate} às {formattedTime}
                                            </span>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => handleDeletePatientNote(note.id)}
                                            className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                            title="Excluir anotação"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                        <p className="text-sm font-medium text-slate-700 whitespace-pre-wrap leading-relaxed">
                                          {note.notes || '(Sem conteúdo)'}
                                        </p>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                    </>
                )}
            </div>
        </div>
    </div>
  );
}

export default function PatientProfileModal(props: PatientProfileModalProps) {
  return (
    <ErrorBoundary>
      <PatientProfileModalContent {...props} />
    </ErrorBoundary>
  );
}
