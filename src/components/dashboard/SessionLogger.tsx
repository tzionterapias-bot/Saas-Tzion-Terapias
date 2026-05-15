import React, { useState, useEffect } from 'react';
import { PlayCircle, Clock, Save, FileText, User, Search, CheckCircle2, AlertCircle, X, ChevronRight, History, Calendar, ExternalLink, Plus } from 'lucide-react';
import { cn } from '@/src/lib/utils';

const upcomingAppointments = [
  { id: 101, patientId: 'P001', patient: 'João Oliveira', time: '14:00', type: 'Presencial', therapy: 'Terapia Individual' },
  { id: 102, patientId: 'P002', patient: 'Maria Santos', time: '15:30', type: 'Online', therapy: 'Terapia de Casal' },
  { id: 103, patientId: 'P003', patient: 'Pedro Souza', time: '17:00', type: 'Presencial', therapy: 'Terapia Individual' },
];

const mockHistory = [
  { id: 1, date: '2024-04-24', content: 'Paciente relatou melhora nos episódios de ansiedade após técnica de respiração 4-7-8. Focamos em gatilhos no ambiente de trabalho.', therapist: 'Dra. Ana Silva', type: 'Evolução' },
  { id: 2, date: '2024-04-17', content: 'Sessão focada em dinâmicas familiares. João expressou dificuldade em estabelecer limites com os pais.', therapist: 'Dra. Ana Silva', type: 'Evolução' },
  { id: 3, date: '2024-04-10', content: 'Anamnese Completa: Paciente apresenta histórico de transtorno de ansiedade generalizada desde os 22 anos. Sem uso de medicação atual.', therapist: 'Dra. Ana Silva', type: 'Anamnese' },
  { id: 4, date: '2024-04-03', content: 'Sessão de triagem realizada. Paciente busca terapia para lidar com estresse profissional e insônia.', therapist: 'Dra. Ana Silva', type: 'Triagem' },
];

const mockDocuments = [
  { id: 1, title: 'Encaminhamento Psiquiátrico', date: '2024-04-24', type: 'PDF' },
  { id: 2, title: 'Atestado de Comparecimento', date: '2024-04-17', type: 'PDF' },
  { id: 3, title: 'Termo de Consentimento', date: '2024-04-10', type: 'Assinado' },
];

export default function SessionLogger() {
  const [sessionActive, setSessionActive] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<typeof upcomingAppointments[0] | null>(null);
  const [timer, setTimer] = useState(0);
  const [notes, setNotes] = useState('');
  const [showFullRecord, setShowFullRecord] = useState(false);
  const [showLastGuidance, setShowLastGuidance] = useState(false);
  const [activeTab, setActiveTab] = useState<'evolution' | 'documents' | 'history' | 'anamnesis'>('evolution');

  useEffect(() => {
    let interval: any;
    if (sessionActive) {
      interval = setInterval(() => {
        setTimer((t) => t + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [sessionActive]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartSession = (patient: typeof upcomingAppointments[0]) => {
    setSelectedPatient(patient);
    setSessionActive(true);
    setTimer(0);
    setNotes('');
  };

  const handleFinishSession = () => {
    setSessionActive(false);
    alert(`Sessão finalizada com sucesso. Registro salvo no histórico de ${selectedPatient?.patient}.`);
    setSelectedPatient(null);
  };

  if (!sessionActive) {
    return (
      <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Próximos Atendimentos</h2>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Buscar paciente ou ID..." className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {upcomingAppointments.map((apt) => (
            <div key={apt.id} className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-xl hover:border-indigo-200 transition-all group flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-6 w-full sm:w-auto">
                <div className="text-center min-w-[60px]">
                  <p className="text-2xl font-bold text-slate-900 leading-none">{apt.time}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-widest">Início</p>
                </div>
                <div className="h-12 w-px bg-slate-100 hidden sm:block" />
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 font-bold text-xl group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all">
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
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-slate-800 flex items-center gap-2 uppercase tracking-widest">
                <FileText className="w-4 h-4 text-indigo-600" /> Registro de Atendimento
              </label>
              <button 
                onClick={() => setShowLastGuidance(true)}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors group/link"
              >
                Ver última sessão <ChevronRight className="w-3 h-3 group-hover/link:translate-x-1 transition-transform" />
              </button>
            </div>
            
            <textarea 
              rows={16}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Descreva a evolução do paciente, principais dores e intervenções realizadas..."
              className="w-full p-8 text-slate-700 bg-slate-50/50 border border-slate-100 rounded-[2rem] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-xl leading-relaxed placeholder:text-slate-300 shadow-inner"
            ></textarea>
            
            <div className="flex flex-col sm:flex-row items-center gap-4 pt-6 border-t border-slate-50">
              <button 
                onClick={() => alert('Alterações salvas temporariamente no rascunho.')}
                className="w-full sm:flex-1 py-5 bg-indigo-600 text-white rounded-[1.5rem] font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 active:scale-95"
              >
                <Save className="w-5 h-5" /> Salvar Evolução
              </button>
              <button 
                onClick={handleFinishSession}
                className="w-full sm:w-auto px-12 py-5 bg-rose-50 text-rose-600 border border-rose-100 rounded-[1.5rem] font-bold hover:bg-rose-100 transition-all active:scale-95"
              >
                Finalizar e Encerrar
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
                <span className="font-bold text-slate-700">#{selectedPatient?.patientId}</span>
              </div>
              <div className="flex justify-between text-sm py-1">
                <span className="text-slate-400 font-medium tracking-wide">Duração</span>
                <span className="font-bold text-slate-700">60 Min</span>
              </div>
              <div className="flex justify-between text-sm py-1">
                <span className="text-slate-400 font-medium tracking-wide">Financeiro</span>
                <span className="flex items-center gap-1.5 font-bold text-emerald-600">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Pago
                </span>
              </div>
            </div>
          </div>

          <div className="bg-indigo-50/50 p-8 rounded-[2.5rem] border border-indigo-100 space-y-6 flex flex-col h-full lg:min-h-[400px]">
            <h4 className="font-bold text-indigo-900 text-xs flex items-center gap-2 uppercase tracking-widest">
              <History className="w-4 h-4" /> Histórico Operacional
            </h4>
            <div className="space-y-6 flex-1">
              {mockHistory.slice(0, 3).map((item) => (
                <div key={item.id} className="relative pl-6 border-l-2 border-indigo-200">
                  <div className="absolute top-0 left-[-9px] w-4 h-4 rounded-full bg-white border-2 border-indigo-600 shadow-sm" />
                  <p className="font-bold text-indigo-600 text-[10px] uppercase mb-1 tracking-wider">{new Date(item.date).toLocaleDateString('pt-BR')}</p>
                  <p className="text-xs leading-relaxed text-slate-600 font-medium italic line-clamp-3">
                    "{item.content}"
                  </p>
                </div>
              ))}
            </div>
            <button 
              onClick={() => setShowFullRecord(true)}
              className="w-full py-4 bg-white text-indigo-600 rounded-2xl text-xs font-bold border border-indigo-100 hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
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
            <div className="p-10 overflow-y-auto space-y-8 bg-slate-50/30 flex-1">
              <div className="flex gap-4 mb-6 border-b border-slate-200">
                {[
                  { id: 'evolution', label: 'Evoluções', icon: History },
                  { id: 'anamnesis', label: 'Anamnese Completa', icon: FileText },
                  { id: 'documents', label: 'Documentos', icon: Plus },
                  { id: 'history', label: 'Ficha Cadastral', icon: User },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={cn(
                      "px-6 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all",
                      activeTab === tab.id ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-400 hover:text-slate-600"
                    )}
                  >
                    <tab.icon className="w-4 h-4" /> {tab.label}
                  </button>
                ))}
              </div>

              {activeTab === 'anamnesis' && (
                <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 space-y-10 animate-in slide-in-from-right-4 duration-300">
                  <div className="space-y-8">
                    <section className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                          <AlertCircle className="w-4 h-4" />
                        </div>
                        <h4 className="text-sm font-bold text-slate-800 uppercase tracking-widest">Queixa Principal</h4>
                      </div>
                      <p className="text-slate-600 leading-relaxed bg-slate-50 p-6 rounded-2xl border border-slate-100">
                        Paciente relata crises de ansiedade recorrentes associadas ao ambiente de trabalho. Sente falta de ar, taquicardia e pensamentos catastróficos sobre seu desempenho. Início há aproximadamente 6 meses após promoção.
                      </p>
                    </section>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <section className="space-y-4">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                           Histórico Familiar
                        </h4>
                        <div className="space-y-3">
                          {[
                            { label: 'Pai', value: 'Histórico de alcoolismo e depressão' },
                            { label: 'Mãe', value: 'Saudável, traços de ansiedade leve' },
                            { label: 'Irmãos', value: '1 irmão (28 anos) - Sem queixas' },
                          ].map((item, i) => (
                            <div key={i} className="flex flex-col border-b border-slate-50 pb-2">
                              <span className="text-xs text-slate-400 font-medium">{item.label}</span>
                              <span className="text-sm font-bold text-slate-700">{item.value}</span>
                            </div>
                          ))}
                        </div>
                      </section>

                      <section className="space-y-4">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                           Estilo de Vida
                        </h4>
                        <div className="space-y-3">
                          {[
                            { label: 'Sono', value: 'Insônia inicial, média de 5h/noite' },
                            { label: 'Exercícios', value: 'Sedentário no momento' },
                            { label: 'Alimentação', value: 'Irregular, excesso de cafeína' },
                          ].map((item, i) => (
                            <div key={i} className="flex flex-col border-b border-slate-50 pb-2">
                              <span className="text-xs text-slate-400 font-medium">{item.label}</span>
                              <span className="text-sm font-bold text-slate-700">{item.value}</span>
                            </div>
                          ))}
                        </div>
                      </section>
                    </div>

                    <section className="space-y-4">
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Antecedentes Clínicos</h4>
                      <div className="grid grid-cols-3 gap-2">
                        {['Sem alergias', 'Sem cirurgias', 'Usa Óculos', 'Gastrite Nervosa', 'Sem Medicação'].map((tag, i) => (
                          <div key={i} className="px-4 py-2 bg-indigo-50/50 text-indigo-600 rounded-xl text-xs font-bold text-center border border-indigo-100/50">
                            {tag}
                          </div>
                        ))}
                      </div>
                    </section>
                  </div>
                </div>
              )}

              {activeTab === 'evolution' && (
                <div className="space-y-6">
                  {mockHistory.map((item) => (
                    <div key={item.id} className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm space-y-4 hover:border-indigo-200 transition-all group">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-2 text-indigo-600 font-bold text-xs bg-indigo-50 px-3 py-1 rounded-lg">
                            <Calendar className="w-3.5 h-3.5" /> {new Date(item.date).toLocaleDateString('pt-BR')}
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-2 py-1 bg-slate-100 rounded-md">
                            {item.type}
                          </span>
                        </div>
                        <span className="text-xs font-medium text-slate-400">Terapeuta: <strong className="text-slate-600">{item.therapist}</strong></span>
                      </div>
                      <p className="text-slate-700 text-lg leading-relaxed">{item.content}</p>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'documents' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {mockDocuments.map((doc) => (
                    <div key={doc.id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 hover:border-indigo-200 transition-all cursor-pointer group">
                      <div className="w-12 h-12 bg-rose-50 rounded-xl flex items-center justify-center text-rose-500 group-hover:bg-rose-500 group-hover:text-white transition-all">
                        <FileText className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{doc.title}</p>
                        <p className="text-xs text-slate-400">{doc.date} • {doc.type}</p>
                      </div>
                      <ExternalLink className="w-4 h-4 text-slate-300 ml-auto" />
                    </div>
                  ))}
                  <button className="border-2 border-dashed border-slate-200 p-6 rounded-2xl text-slate-400 font-bold text-sm flex flex-col items-center justify-center gap-2 hover:border-indigo-400 hover:text-indigo-600 transition-all bg-slate-50/50">
                    <Plus className="w-6 h-6" /> Novo Documento
                  </button>
                </div>
              )}

              {activeTab === 'history' && (
                <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 space-y-10">
                  <div className="grid grid-cols-2 gap-10">
                    <div className="space-y-4">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Informações Pessoais</p>
                      <div className="space-y-3">
                        <div className="flex justify-between border-b border-slate-50 pb-2"><span className="text-sm text-slate-500">Nome Completo</span><span className="text-sm font-bold">João Oliveira da Silva</span></div>
                        <div className="flex justify-between border-b border-slate-50 pb-2"><span className="text-sm text-slate-500">CPF</span><span className="text-sm font-bold">123.456.789-00</span></div>
                        <div className="flex justify-between border-b border-slate-50 pb-2"><span className="text-sm text-slate-500">Nascimento</span><span className="text-sm font-bold">15/05/1990 (33 anos)</span></div>
                        <div className="flex justify-between border-b border-slate-50 pb-2"><span className="text-sm text-slate-500">Gênero</span><span className="text-sm font-bold">Masculino</span></div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Contatos</p>
                      <div className="space-y-3">
                        <div className="flex justify-between border-b border-slate-50 pb-2"><span className="text-sm text-slate-500">WhatsApp</span><span className="text-sm font-bold text-indigo-600">(11) 98765-4321</span></div>
                        <div className="flex justify-between border-b border-slate-50 pb-2"><span className="text-sm text-slate-500">E-mail</span><span className="text-sm font-bold">joao.silva@email.com</span></div>
                        <div className="flex justify-between border-b border-slate-50 pb-2"><span className="text-sm text-slate-500">Emergência</span><span className="text-sm font-bold">Maria (Mãe)</span></div>
                      </div>
                    </div>
                  </div>
                  <div className="p-6 bg-amber-50 rounded-2xl border border-amber-100 flex items-start gap-4">
                    <AlertCircle className="w-5 h-5 text-amber-600 mt-1" />
                    <div>
                      <p className="text-sm font-bold text-amber-900">Observações Clínicas Críticas</p>
                      <p className="text-xs text-amber-700 mt-1">Nenhum alergia reportada. Histórico familiar de depressão leve.</p>
                    </div>
                  </div>
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
              <h4 className="text-xl font-bold tracking-tight">Última Orientação (24 Abr)</h4>
            </div>
            <div className="bg-indigo-50/50 p-6 rounded-2xl border border-indigo-100">
              <p className="text-indigo-950 font-medium leading-relaxed italic text-lg">
                "Continuar o exercício de respiração sempre que sentir o aperto no peito antes de reuniões. Discutir progressos na próxima sessão."
              </p>
            </div>
            <button 
              onClick={() => {
                setNotes(prev => prev + (prev ? '\n\n' : '') + 'Referente à orientação anterior: ');
                setShowLastGuidance(false);
              }}
              className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" /> Importar para sessão atual
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

