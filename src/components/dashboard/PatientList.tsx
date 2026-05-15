import React, { useState } from 'react';
import { Search, Plus, Filter, MoreVertical, Phone, Mail, Calendar, X, Save, User, MapPin, FileText, History, AlertCircle, Heart, Clock, Download } from 'lucide-react';
import { cn } from '@/src/lib/utils';

// Reuse mock data from session logger or centralized state
const mockAnamnesis = {
  complaint: "Paciente relata crises de ansiedade recorrentes associadas ao ambiente de trabalho. Sente falta de ar, taquicardia e pensamentos catastróficos.",
  family: "Histórico de ansiedade por parte materna.",
  lifestyle: "Sedentário, sono irregular (insônia inicial)."
};

const initialPatients = [
  { id: 1, name: 'João Oliveira', email: 'joao@email.com', phone: '(11) 98765-4321', status: 'Ativo', lastSession: '2024-05-02', address: 'Rua das Flores, 123' },
  { id: 2, name: 'Maria Santos', email: 'maria@email.com', phone: '(11) 91234-5678', status: 'Ativo', lastSession: '2024-04-28', address: 'Av. Paulista, 1500' },
  { id: 3, name: 'Pedro Souza', email: 'pedro@email.com', phone: '(11) 99887-7665', status: 'Inativo', lastSession: '2023-12-15', address: 'Rua Amazonas, 45' },
  { id: 4, name: 'Ana Costa', email: 'ana@email.com', phone: '(11) 97766-5544', status: 'Ativo', lastSession: '2024-05-04', address: 'Praça da Sé, 10' },
];

export default function PatientList() {
  const [patients, setPatients] = useState(initialPatients);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'anamnesis' | 'history' | 'docs'>('info');
  const [newPatient, setNewPatient] = useState({ name: '', email: '', phone: '', address: '' });
  const [newEvolution, setNewEvolution] = useState('');
  const [evolutions, setEvolutions] = useState([
    { id: 1, date: '22 Abr 2024', text: 'Paciente apresentou progresso significativo no controle da respiração.', type: 'Sessão Regular' },
    { id: 2, date: '15 Abr 2024', text: 'Discussão sobre gatilhos de ansiedade no ambiente corporativo.', type: 'Sessão Regular' }
  ]);

  const handleAddEvolution = () => {
    if (!newEvolution.trim()) return;
    const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
    setEvolutions([{ id: Date.now(), date: today, text: newEvolution, type: 'Sessão Regular' }, ...evolutions]);
    setNewEvolution('');
    alert('Evolução registrada com sucesso!');
  };

  const filteredPatients = patients.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddPatient = (e: React.FormEvent) => {
    e.preventDefault();
    const id = patients.length + 1;
    const patientToAdd = {
      ...newPatient,
      id,
      status: 'Ativo',
      lastSession: new Date().toISOString().split('T')[0]
    };
    setPatients([patientToAdd, ...patients]);
    setShowModal(false);
    setNewPatient({ name: '', email: '', phone: '', address: '' });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header and Search */}
      {!selectedPatient && (
        <>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar pacientes por nome, e-mail..."
                className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-2 px-5 py-3 border border-slate-200 bg-white rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors">
                <Filter className="w-4 h-4" />
                Filtrar
              </button>
              <button 
                onClick={() => setShowModal(true)}
                className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95"
              >
                <Plus className="w-4 h-4" />
                Novo Paciente
              </button>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-[2rem] overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50/50 border-b border-slate-100">
                  <tr>
                    <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Paciente</th>
                    <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Contato</th>
                    <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Última Sessão</th>
                    <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                    <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredPatients.map((patient) => (
                    <tr 
                      key={patient.id} 
                      onClick={() => setSelectedPatient(patient)}
                      className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
                    >
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-lg group-hover:bg-indigo-600 group-hover:text-white transition-all">
                            {patient.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{patient.name}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase">ID: #{patient.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm text-slate-600 font-medium">
                            <Mail className="w-3.5 h-3.5 text-indigo-400" />
                            {patient.email}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-slate-600 font-medium">
                            <Phone className="w-3.5 h-3.5 text-indigo-400" />
                            {patient.phone}
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-2 text-sm text-slate-700 font-bold">
                          <Calendar className="w-4 h-4 text-slate-300" />
                          {new Date(patient.lastSession).toLocaleDateString('pt-BR')}
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <span className={cn(
                          "inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                          patient.status === 'Ativo' ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"
                        )}>
                          {patient.status}
                        </span>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <button className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 hover:text-indigo-600">
                          <MoreVertical className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredPatients.length === 0 && (
              <div className="p-20 text-center space-y-4">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
                  <Search className="w-8 h-8 text-slate-200" />
                </div>
                <p className="text-slate-500 font-medium">Nenhum paciente encontrado com esse critério.</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Patient Detail View */}
      {selectedPatient && (
        <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
          <button 
            onClick={() => setSelectedPatient(null)}
            className="flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-indigo-600 transition-colors"
          >
            <X className="w-4 h-4" /> Voltar para lista
          </button>

          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden min-h-[600px] flex flex-col">
            {/* Detail Header */}
            <div className="p-10 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 rounded-3xl bg-indigo-600 text-white flex items-center justify-center text-3xl font-bold shadow-xl shadow-indigo-100">
                  {selectedPatient.name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-3xl font-bold text-slate-900 tracking-tight">{selectedPatient.name}</h3>
                  <div className="flex items-center gap-4 mt-1">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">ID: #{selectedPatient.id}</span>
                    <span className="w-1 h-1 rounded-full bg-slate-300" />
                    <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest">{selectedPatient.status}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <button className="px-6 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition-all">Imprimir Ficha</button>
                <button className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all">Salvar Alterações</button>
              </div>
            </div>

            {/* Tabs Navigation */}
            <div className="flex px-10 border-b border-slate-100 bg-white">
              {[
                { id: 'info', label: 'Dados Cadastrais', icon: User },
                { id: 'anamnesis', label: 'Anamnese Completa', icon: FileText },
                { id: 'history', label: 'Linha do Tempo / Prontuário', icon: History },
                { id: 'docs', label: 'Documentos', icon: Save }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={cn(
                    "py-6 px-4 mr-8 text-sm font-bold flex items-center gap-2 border-b-2 transition-all",
                    activeTab === tab.id ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-400 hover:text-slate-600"
                  )}
                >
                  <tab.icon className="w-4 h-4" /> {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="p-10 flex-1 bg-white">
              {activeTab === 'info' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-8">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 block">Informações Pessoais</label>
                      <div className="space-y-4">
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                          <p className="text-xs text-slate-400 font-medium">Nome Completo</p>
                          <p className="font-bold text-slate-700">{selectedPatient.name}</p>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                          <p className="text-xs text-slate-400 font-medium">E-mail</p>
                          <p className="font-bold text-slate-700">{selectedPatient.email}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-8">
                     <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 block">Localização & Contato</label>
                      <div className="space-y-4">
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                          <p className="text-xs text-slate-400 font-medium">Endereço</p>
                          <p className="font-bold text-slate-700">{selectedPatient.address}</p>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                          <p className="text-xs text-slate-400 font-medium">WhatsApp</p>
                          <p className="font-bold text-slate-700">{selectedPatient.phone}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'anamnesis' && (
                <div className="max-w-4xl space-y-10">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h4 className="text-xl font-bold text-slate-900 tracking-tight">Formulário de Anamnese</h4>
                      <p className="text-sm text-slate-500">Preenchido em 04 de Março de 2024</p>
                    </div>
                    <button className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-all">Editar Modelo</button>
                  </div>

                  <div className="space-y-8">
                    <section className="space-y-3">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <AlertCircle className="w-3 h-3" /> Queixa Principal & Motivo da Busca
                      </label>
                      <textarea 
                        className="w-full p-6 bg-slate-50 border border-slate-200 rounded-[2rem] text-slate-700 font-medium leading-relaxed focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                        rows={5}
                        defaultValue={mockAnamnesis.complaint}
                      />
                    </section>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                       <section className="space-y-3">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                          <Heart className="w-3 h-3" /> Histórico Familiar
                        </label>
                        <textarea 
                          className="w-full p-6 bg-slate-50 border border-slate-200 rounded-[2rem] text-slate-700 font-medium leading-relaxed focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                          rows={4}
                          defaultValue={mockAnamnesis.family}
                        />
                      </section>
                      <section className="space-y-3">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                          <MapPin className="w-3 h-3" /> Estilo de Vida & Hábitos
                        </label>
                        <textarea 
                          className="w-full p-6 bg-slate-50 border border-slate-200 rounded-[2rem] text-slate-700 font-medium leading-relaxed focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                          rows={4}
                          defaultValue={mockAnamnesis.lifestyle}
                        />
                      </section>
                    </div>
                    
                    <div className="pt-6">
                      <button className="w-full py-5 bg-indigo-600 text-white rounded-[1.5rem] font-bold shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all">Salvar Anamnese do Paciente</button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'history' && (
                <div className="space-y-8 animate-in fade-in duration-500">
                  <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100 space-y-4">
                    <h4 className="text-sm font-bold text-slate-700 uppercase tracking-widest flex items-center gap-2">
                      <Clock className="w-4 h-4" /> Registrar Nova Evolução
                    </h4>
                    <textarea 
                      value={newEvolution}
                      onChange={(e) => setNewEvolution(e.target.value)}
                      className="w-full p-6 bg-white border border-slate-200 rounded-[1.5rem] outline-none focus:ring-2 focus:ring-indigo-500 min-h-[120px] font-medium" 
                      placeholder="Descreva o que ocorreu na sessão de hoje..."
                    />
                    <div className="flex justify-end">
                      <button 
                        onClick={handleAddEvolution}
                        className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95"
                      >
                        Salvar Evolução
                      </button>
                    </div>
                  </div>
                  
                  <div className="space-y-6">
                    {evolutions.map((evol) => (
                      <div key={evol.id} className="group relative pl-10 border-l-2 border-slate-100 pb-10 last:pb-0">
                        <div className="absolute top-0 left-[-9px] w-4 h-4 rounded-full bg-white border-2 border-indigo-600 shadow-sm" />
                        <div className="bg-white p-6 rounded-3xl border border-slate-100 group-hover:border-indigo-100 group-hover:shadow-md transition-all shadow-sm">
                          <div className="flex justify-between mb-2">
                             <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest">{evol.type} • {evol.date}</p>
                             <span className="text-[10px] text-slate-400 font-bold uppercase">Assinado Digitalmente</span>
                          </div>
                          <p className="text-slate-600 leading-relaxed font-medium">{evol.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'docs' && (
                <div className="space-y-8 animate-in fade-in duration-500">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {[
                      { name: 'Contrato de Prestação de Serviços', date: '05/01/2026', type: 'PDF' },
                      { name: 'Termo de Consentimento Livre', date: '05/01/2026', type: 'PDF' },
                      { name: 'Laudo Preliminar - Encaminhamento', date: '12/03/2026', type: 'DOCX' },
                    ].map((doc, i) => (
                      <div key={i} className="p-6 border border-slate-100 rounded-3xl flex items-center justify-between group hover:bg-slate-50 transition-all cursor-pointer">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                            <FileText className="w-6 h-6" />
                          </div>
                          <div>
                            <p className="font-bold text-slate-700">{doc.name}</p>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">{doc.date} • {doc.type}</p>
                          </div>
                        </div>
                        <button className="p-3 text-slate-300 hover:text-indigo-600 transition-colors">
                          <Download className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
                    <button className="col-span-full py-12 border-2 border-dashed border-slate-200 rounded-[2.5rem] text-slate-400 font-bold hover:border-indigo-300 hover:text-indigo-500 hover:bg-indigo-50/50 transition-all flex flex-col items-center justify-center gap-3">
                       <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center">
                          <Plus className="w-8 h-8" />
                       </div>
                       Anexar Novo Documento (Contrato, Laudo ou Exame)
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* New Patient Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] w-full max-w-xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600">
                  <User className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 tracking-tight">Novo Paciente</h3>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-50 rounded-full transition-colors text-slate-400">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleAddPatient} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Nome Completo</label>
                <input 
                  required
                  value={newPatient.name}
                  onChange={e => setNewPatient({...newPatient, name: e.target.value})}
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium" 
                  placeholder="Nome do paciente"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">E-mail</label>
                  <input 
                    type="email"
                    required
                    value={newPatient.email}
                    onChange={e => setNewPatient({...newPatient, email: e.target.value})}
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium" 
                    placeholder="email@exemplo.com"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Telefone / WhatsApp</label>
                  <input 
                    required
                    value={newPatient.phone}
                    onChange={e => setNewPatient({...newPatient, phone: e.target.value})}
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium" 
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> Endereço Completo
                </label>
                <input 
                  value={newPatient.address}
                  onChange={e => setNewPatient({...newPatient, address: e.target.value})}
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium" 
                  placeholder="Rua, Número, Bairro, Cidade..."
                />
              </div>

              <div className="pt-6 flex gap-4">
                <button 
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-4 bg-slate-50 text-slate-600 rounded-2xl font-bold hover:bg-slate-100 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                >
                  <Save className="w-5 h-5" /> Cadastrar Paciente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
