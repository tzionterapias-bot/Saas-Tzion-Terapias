import React, { useState } from 'react';
import { Settings, Shield, Bell, Database, Globe, User, Palette, CreditCard, FileText, X, Save, Plus, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/src/lib/utils';

const configSections = [
  { 
    id: 'perfil', 
    title: 'Perfil da Clínica', 
    desc: 'Dados básicos, logo e informações de contato.', 
    icon: User,
    items: ['Nome Fantasia', 'CNPJ / CPF', 'Logotipo', 'Endereço']
  },
  { 
    id: 'seguranca', 
    title: 'Segurança & Acesso', 
    desc: 'Controle de senhas, autenticação e permissões.', 
    icon: Shield,
    items: ['Alterar Senha', 'Autenticação 2FA', 'Logs de Acesso', 'Usuários ADM']
  },
  { 
    id: 'clinico', 
    title: 'Clínico & Anamnese', 
    desc: 'Configure os modelos de perguntas e campos do prontuário.', 
    icon: FileText,
    items: ['Modelos de Anamnese', 'Tipos de Evolução', 'Termos de Consentimento']
  },
  { 
    id: 'notificacoes', 
    title: 'Notificações & Alertas', 
    desc: 'Configure o envio de lembretes via WhatsApp/E-mail.', 
    icon: Bell,
    items: ['Lembretes de Sessão', 'Confirmação de Pagamento']
  },
  { 
    id: 'integracoes', 
    title: 'API & Integrações', 
    desc: 'Conecte com Google Meet, Asaas, Stripe e outros.', 
    icon: Database,
    items: ['Status da API Asaas', 'Google Calendar Sync', 'Webhooks']
  },
];

export default function ConfigPage() {
  const [editingItem, setEditingItem] = useState<{section: string, item: string} | null>(null);
  const [anamnesisFields, setAnamnesisFields] = useState([
    { id: 1, label: 'Queixa Principal', type: 'text_area' },
    { id: 2, label: 'Histórico Familiar', type: 'text_area' },
    { id: 3, label: 'Estilo de Vida', type: 'text_area' }
  ]);

  const handleAddField = () => {
    const newId = anamnesisFields.length + 1;
    setAnamnesisFields([...anamnesisFields, { id: newId, label: 'Nova Pergunta', type: 'text_area' }]);
  };

  const removeField = (id: number) => {
    setAnamnesisFields(anamnesisFields.filter(f => f.id !== id));
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Configurações</h2>
          <p className="text-slate-500 font-medium">Gerencie as preferências globais do sistema Tzion.</p>
        </div>
        <button className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all">
          Salvar Alterações
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {configSections.map((section) => (
          <div key={section.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all group">
            <div className="flex items-start justify-between mb-6">
              <div className="p-4 bg-slate-50 rounded-2xl text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all">
                <section.icon className="w-8 h-8" />
              </div>
            </div>
            
            <h3 className="text-xl font-bold text-slate-900 mb-2">{section.title}</h3>
            <p className="text-sm text-slate-500 mb-6 font-medium leading-relaxed">{section.desc}</p>
            
            <div className="space-y-2">
              {section.items.map((item, i) => (
                <div 
                  key={i} 
                  onClick={() => setEditingItem({ section: section.title, item })}
                  className="flex items-center justify-between p-3 bg-slate-50/50 rounded-xl group/item cursor-pointer hover:bg-white border border-transparent hover:border-slate-100 transition-all"
                >
                  <span className="text-sm font-bold text-slate-700">{item}</span>
                  <button className="text-[10px] font-bold text-indigo-500 opacity-0 group-hover/item:opacity-100 uppercase tracking-widest">Ajustar</button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Editor Modal */}
      {editingItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in duration-300">
           <div className="bg-white rounded-[2.5rem] w-full max-w-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-indigo-600 text-white rounded-2xl">
                    {editingItem.item === 'Logotipo' || editingItem.section === 'Perfil da Clínica' ? <User className="w-6 h-6" /> : <Settings className="w-6 h-6" />}
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900 tracking-tight">{editingItem.item}</h3>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{editingItem.section}</p>
                  </div>
                </div>
                <button onClick={() => setEditingItem(null)} className="p-2 hover:bg-white rounded-full transition-all text-slate-400 border border-transparent hover:border-slate-200 shadow-sm">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-8 overflow-y-auto space-y-8">
                {editingItem.item === 'Modelos de Anamnese' ? (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-slate-500">Campos do Prontuário</p>
                      <button 
                        onClick={handleAddField}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-all"
                      >
                        <Plus className="w-3 h-3" /> Adicionar Pergunta
                      </button>
                    </div>
                    <div className="space-y-3">
                      {anamnesisFields.map((field) => (
                        <div key={field.id} className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 group">
                           <div className="flex-1">
                             <input 
                               defaultValue={field.label}
                               className="bg-transparent border-none focus:ring-0 font-bold text-slate-700 w-full outline-none"
                             />
                             <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Tipo: Área de Texto</p>
                           </div>
                           <button 
                             onClick={() => removeField(field.id)}
                             className="p-2 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
                           >
                             <Trash2 className="w-4 h-4" />
                           </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : editingItem.item === 'Tipos de Evolução' ? (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-slate-500">Categorias de Evolução</p>
                      <button className="text-xs font-bold text-indigo-600">+ Novo Tipo</button>
                    </div>
                    <div className="space-y-2">
                       {['Sessão Regular', 'Primeira Consulta / Triagem', 'Sessão de Alta', 'Reavaliação Semestral'].map((type, i) => (
                         <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <span className="font-bold text-slate-700">{type}</span>
                            <button className="text-slate-300 hover:text-rose-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                         </div>
                       ))}
                    </div>
                  </div>
                ) : editingItem.item === 'Termos de Consentimento' ? (
                  <div className="space-y-6">
                    <label className="text-sm font-bold text-slate-500">Contrato Padrão para Novos Pacientes</label>
                    <textarea 
                      className="w-full p-6 bg-slate-50 border border-slate-200 rounded-[2rem] text-slate-700 font-medium leading-relaxed focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                      rows={12}
                      defaultValue="Declaro estar ciente dos termos de prestação de serviço de atendimento psicológico/fisioterapêutico, concordando com as políticas de cancelamento (24h de antecedência) e sigilo profissional conforme regulamentação do conselho de classe..."
                    />
                    <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl flex gap-3 text-amber-700">
                       <AlertCircle className="w-4 h-4 mt-1" />
                       <p className="text-xs font-medium">Este texto será exibido no portal do paciente para aceite digital.</p>
                    </div>
                  </div>
                ) : editingItem.section === 'Perfil da Clínica' ? (
                  <div className="space-y-6">
                    <div className="space-y-2">
                       <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Valor do Campo</label>
                       <input 
                         className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                         placeholder={`Digite o ${editingItem.item}`}
                         defaultValue={editingItem.item === 'Nome Fantasia' ? 'Clínica Tzion' : ''}
                       />
                    </div>
                    <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex gap-3 italic">
                      <Settings className="w-4 h-4 text-blue-500 mt-1" />
                      <p className="text-xs text-blue-700 font-medium">Esta alteração será refletida em todos os documentos e no portal do paciente.</p>
                    </div>
                  </div>
                ) : editingItem.section === 'Segurança & Acesso' ? (
                  <div className="space-y-6">
                     <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-500">Nova Senha</label>
                          <input type="password" underline="none" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-500">Confirmar Senha</label>
                          <input type="password" underline="none" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none" />
                        </div>
                     </div>
                  </div>
                ) : (
                  <div className="py-20 text-center space-y-4">
                    <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto text-indigo-600">
                      <Settings className="w-8 h-8 animate-spin-slow" />
                    </div>
                    <div className="space-y-2">
                       <p className="text-xl font-bold text-slate-900">Editor de {editingItem.item}</p>
                       <p className="text-slate-500 max-w-xs mx-auto">Esta interface de ajuste está sendo carregada para permitir a alteração segura dos dados de {editingItem.section}.</p>
                    </div>
                    <div className="pt-4 flex justify-center gap-2">
                       {[1, 2, 3].map(i => <div key={i} className="w-2 h-2 rounded-full bg-indigo-200" />)}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-8 border-t border-slate-100 bg-white flex gap-4">
                 <button 
                  onClick={() => setEditingItem(null)}
                  className="flex-1 py-4 bg-slate-50 text-slate-600 rounded-2xl font-bold hover:bg-slate-100 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => {
                    alert('As configurações de ' + editingItem.item + ' foram salvas!');
                    setEditingItem(null);
                  }}
                  className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                >
                  <Save className="w-5 h-5" /> Salvar Configuração
                </button>
              </div>
           </div>
        </div>
      )}

      {/* White Label Section */}
      <div className="bg-slate-900 rounded-[2.5rem] p-10 text-white relative overflow-hidden shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="space-y-3 text-center md:text-left">
            <h3 className="text-2xl font-bold tracking-tight">Personalização de Marca (White Label)</h3>
            <p className="text-slate-400 max-w-lg">Altere as cores principais, fontes e identidade visual do Portal do Paciente para combinar com sua marca.</p>
          </div>
          <button className="px-10 py-5 bg-white text-slate-900 rounded-2xl font-bold hover:bg-slate-50 transition-all flex items-center gap-3">
            <Palette className="w-5 h-5 text-indigo-600" /> Abrir Editor Visual
          </button>
        </div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      </div>
    </div>
  );
}
