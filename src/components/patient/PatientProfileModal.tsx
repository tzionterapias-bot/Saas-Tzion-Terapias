import React, { useState, useEffect } from 'react';
import { 
  X, User, Calendar, CreditCard, ClipboardList, Activity, 
  Award, Clock, CheckCircle2, ChevronRight, DollarSign, Loader2, FileText
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { supabase } from '@/src/lib/supabase';
import { sendWhatsAppMessage } from '@/src/lib/whatsapp';
import { getSystemBaseUrl } from '@/src/utils/systemUrl';

interface PatientProfileModalProps {
  patient: any;
  onClose: () => void;
}

export default function PatientProfileModal({ patient, onClose }: PatientProfileModalProps) {
  const [activeTab, setActiveTab] = useState<'timeline' | 'records' | 'finance'>('timeline');
  const [loading, setLoading] = useState(true);
  
  // Data
  const [timeline, setTimeline] = useState<any[]>([]);
  const [packages, setPackages] = useState<any[]>([]);
  const [generatingContractId, setGeneratingContractId] = useState<string | null>(null);
  
  // Pagination
  const [timelinePage, setTimelinePage] = useState(1);
  const itemsPerPage = 10;
  
  const fetchPatientData = async () => {
    if (!patient?.id) return;
    setLoading(true);
    try {
      const [appRes, recRes, payRes, packRes, conRes] = await Promise.all([
        supabase.from('appointments').select('*, therapists(name)').eq('patient_id', patient.id),
        supabase.from('medical_records').select('*, therapists(name)').eq('patient_id', patient.id),
        supabase.from('payments').select('*').eq('patient_id', patient.id).order('created_at', { ascending: false }),
        supabase.from('patient_packages').select('*, services(name, price, type)').eq('patient_id', patient.id),
        supabase.from('patient_contracts').select('*').eq('patient_id', patient.id).order('created_at', { ascending: false })
      ]);

      const appointments = appRes.data || [];
      const records = recRes.data || [];
      const payments = payRes.data || [];
      const pkgs = packRes.data || [];
      const contracts = conRes.data || [];

      setPackages(pkgs);

      // Normalize events for the timeline
      let events: any[] = [];

      // 1. Appointments
      appointments.forEach(app => {
         events.push({
             id: `app-${app.id}`,
             type: 'appointment',
             date: new Date(app.start_time),
             title: `Sessão ${app.status === 'completed' ? 'Realizada' : 'Agendada'}`,
             description: `Modalidade: ${app.type || 'Presencial'} | Terapeuta: ${app.therapists?.name || 'Não atribuído'}`,
             status: app.status
         });
      });

      // 2. Medical Records
      records.forEach(rec => {
          events.push({
              id: `rec-${rec.id}`,
              type: 'record',
              date: new Date(rec.created_at),
              title: rec.type === 'evolution' ? 'Evolução Clínica' : 'Anamnese',
              description: `Anotação feita por ${rec.therapists?.name || 'Terapeuta'}. ${rec.content?.text ? rec.content.text.substring(0, 50) + '...' : ''}`,
              rawContent: rec.content?.text
          });
      });

      // 3. Payments / Purchases
      payments.forEach(pay => {
          events.push({
              id: `pay-${pay.id}`,
              type: 'finance',
              date: new Date(pay.created_at),
              title: `Pagamento: ${pay.payment_method?.toUpperCase() || 'PIX'}`,
              description: `${pay.description} | R$ ${pay.amount.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`,
              status: pay.status
          });
      });

      // 4. Contracts
      const baseUrlForContracts = await getSystemBaseUrl();
      contracts.forEach(contract => {
          events.push({
              id: `contract-${contract.id}`,
              type: 'contract',
              date: new Date(contract.created_at),
              title: `Contrato de Serviço ${contract.status === 'signed' ? '(Assinado)' : '(Pendente)'}`,
              description: `Acesse o termo no link: ${baseUrlForContracts}/contrato/${contract.id}`,
              status: contract.status
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

  useEffect(() => {
    fetchPatientData();
  }, [patient]);

  const renderIcon = (type: string) => {
      switch(type) {
          case 'appointment': return <Calendar className="w-5 h-5 text-indigo-600" />;
          case 'record': return <ClipboardList className="w-5 h-5 text-emerald-600" />;
          case 'finance': return <DollarSign className="w-5 h-5 text-rose-600" />;
          case 'contract': return <FileText className="w-5 h-5 text-amber-600" />;
          default: return <Activity className="w-5 h-5 text-slate-600" />;
      }
  };

  const renderColor = (type: string) => {
    switch(type) {
        case 'appointment': return "bg-indigo-50 border-indigo-200 text-indigo-900";
        case 'record': return "bg-emerald-50 border-emerald-200 text-emerald-900";
        case 'finance': return "bg-rose-50 border-rose-200 text-rose-900";
        case 'contract': return "bg-amber-50 border-amber-200 text-amber-900";
        default: return "bg-slate-50 border-slate-200 text-slate-900";
    }
  };

  const handleGenerateContract = async (pkg: any) => {
    try {
      setGeneratingContractId(pkg.id);
      
      const { data: setts } = await supabase.from('settings').select('value').eq('key', 'contract_template').single();
      let template = setts?.value || 'Este é o contrato padrão. Paciente: {{nome_paciente}}, CPF: {{cpf_paciente}}, Data: {{data_atual}}.';
      
      template = template.replace(/\{\{nome_paciente\}\}/g, patient.name || '');
      template = template.replace(/\{\{cpf_paciente\}\}/g, patient.cpf || '');
      template = template.replace(/\{\{data_atual\}\}/g, new Date().toLocaleDateString('pt-BR'));

      const { data: contract, error } = await supabase.from('patient_contracts').insert({
        patient_id: patient.id,
        content: template,
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
            <div className="flex border-b border-slate-100 px-8">
                {[
                    { id: 'timeline', label: 'Linha do Tempo 360º', icon: Activity },
                    { id: 'records', label: 'Pacotes & Créditos', icon: Award },
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
                    </>
                )}
            </div>
        </div>
    </div>
  );
}
