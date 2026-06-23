import React, { useState, useEffect } from 'react';
import { 
  Trophy, Gift, Star, Target, Zap, ChevronRight, MessageSquare, Heart, 
  Users, Bell, Sparkles, LayoutDashboard, Smartphone, Bot, Filter, Plus, Search, RefreshCw, Settings, Loader2, X, Save, History
} from 'lucide-react';
import { Wifi as WifiIcon } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import KanbanBoard from '@/src/components/crm/KanbanBoard';
import EvolutionManager from '@/src/components/crm/EvolutionManager';
import WifiPresence from '@/src/components/crm/WifiPresence';
import NpsDashboard from '@/src/components/crm/NpsDashboard';
import SendLogsView from '@/src/components/crm/SendLogsView';
import { supabase } from '@/src/lib/supabase';

export default function CRMPage() {
  const [activeTab, setActiveTab] = useState<'kanban' | 'whatsapp' | 'automations' | 'wifi' | 'nps' | 'logs'>('kanban');
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [showAutoModal, setShowAutoModal] = useState(false);
  const [automations, setAutomations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ totalLeads: 0, conversionRate: 0, msgSent: 0, nps: 0 });

  const [editAuto, setEditAuto] = useState<any>(null);
  const [showEditAutoModal, setShowEditAutoModal] = useState(false);

  // New Auto State
  const [newAuto, setNewAuto] = useState({ title: '', trigger_type: 'new_lead', description: '' });

  const fetchAutomations = async () => {
    setLoading(true);
    const { data } = await supabase.from('crm_automations').select('*').order('created_at', { ascending: true });
    setAutomations(data || []);
    
    // Fetch Leads Stats
    const { data: leadsData } = await supabase.from('leads').select('status');
    let total = 0; let converted = 0;
    if (leadsData) {
      total = leadsData.length;
      converted = leadsData.filter(l => l.status === 'converted').length;
    }

    // Fetch Communications Log (Mesmo mês)
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const { count: msgCount } = await supabase.from('communications_log')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', firstDay);

    // Fetch NPS
    const { data: npsData } = await supabase.from('nps_feedbacks').select('score');
    let avgNps = 0;
    if (npsData && npsData.length > 0) {
      const sum = npsData.reduce((acc, curr) => acc + (curr.score || 0), 0);
      avgNps = sum / npsData.length;
    }

    setStats({
      totalLeads: total - converted,
      conversionRate: total > 0 ? Math.round((converted / total) * 100) : 0,
      msgSent: msgCount || 0,
      nps: Number(avgNps.toFixed(1))
    });
    
    setLoading(false);
  };

  const toggleAutomation = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase.from('crm_automations').update({ status: !currentStatus }).eq('id', id);
    if (!error) fetchAutomations();
  };

  const handleCreateAuto = async () => {
    if (!newAuto.title) return;
    const { error } = await supabase.from('crm_automations').insert([{ ...newAuto, status: true, settings: { message: '' } }]);
    if (!error) {
      setShowAutoModal(false);
      setNewAuto({ title: '', trigger_type: 'new_lead', description: '' });
      fetchAutomations();
    }
  };

  const openEditModal = (auto: any) => {
    setEditAuto(auto);
    setShowEditAutoModal(true);
  };

  const handleSaveAuto = async () => {
    if (!editAuto) return;
    setLoading(true);
    const { error } = await supabase
      .from('crm_automations')
      .update({ settings: editAuto.settings })
      .eq('id', editAuto.id);
    
    if (!error) {
      setShowEditAutoModal(false);
      setEditAuto(null);
      fetchAutomations();
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAutomations();
  }, []);

  const tabs = [
    { id: 'kanban', label: 'Funil de Vendas', icon: LayoutDashboard },
    { id: 'whatsapp', label: 'Integração WhatsApp', icon: Smartphone },
    { id: 'automations', label: 'Automações & Robôs', icon: Bot },
    { id: 'nps', label: 'Pesquisas NPS', icon: Star },
    { id: 'wifi', label: 'Presença WiFi', icon: WifiIcon },
    { id: 'logs', label: 'Histórico de Disparos', icon: History },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 rounded-full text-[10px] font-bold text-indigo-600 uppercase tracking-widest mb-4 border border-indigo-100">
            <Sparkles className="w-3 h-3" /> CRM Inteligente
          </div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight">Gestão de Relacionamento</h2>
          <p className="text-slate-500 font-medium text-lg">Converta leads em pacientes e fidelize com inteligência.</p>
        </div>
        
        <div className="flex gap-3">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
            <input 
              placeholder="Buscar lead ou paciente..."
              className="pl-11 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm w-full md:w-64 shadow-sm"
            />
          </div>
          <button 
            onClick={() => setShowCampaignModal(true)}
            className="px-6 py-3.5 bg-indigo-600 text-white rounded-2xl font-bold shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-2 active:scale-95"
          >
            <Plus className="w-5 h-5" /> Novo Lead
          </button>
        </div>
      </div>

      {/* Stats Quick View */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Leads no Funil', value: stats.totalLeads.toString(), icon: Target, color: 'indigo' },
          { label: 'Taxa de Conversão', value: `${stats.conversionRate}%`, icon: Zap, color: 'amber' },
          { label: 'Msg Enviadas (Mês)', value: stats.msgSent.toString(), icon: MessageSquare, color: 'emerald' },
          { label: 'Satisfação (NPS)', value: stats.nps > 0 ? stats.nps.toString() : 'N/A', icon: Heart, color: 'rose' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4">
            <div className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center",
              stat.color === 'indigo' ? "bg-indigo-50 text-indigo-600" :
              stat.color === 'amber' ? "bg-amber-50 text-amber-600" :
              stat.color === 'emerald' ? "bg-emerald-50 text-emerald-600" :
              "bg-rose-50 text-rose-600"
            )}>
              <stat.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
              <h3 className="text-xl font-bold text-slate-900">{stat.value}</h3>
            </div>
          </div>
        ))}
      </div>

      {/* Tab Navigation */}
      <div className="flex p-1.5 bg-slate-100/50 rounded-2xl w-full md:w-fit border border-slate-200 overflow-x-auto hide-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all whitespace-nowrap",
              activeTab === tab.id 
                ? "bg-white text-indigo-600 shadow-md" 
                : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
            )}
          >
            <tab.icon className="w-4 h-4 shrink-0" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="mt-8">
        {activeTab === 'kanban' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-4">
                 <h3 className="text-xl font-bold text-slate-900">Funil de Vendas</h3>
                 {stats.totalLeads > 0 && (
                   <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-bold border border-emerald-100">
                     <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                     {stats.totalLeads} leads aguardando ação
                   </div>
                 )}
              </div>
            </div>
            <KanbanBoard />
          </div>
        )}

        {activeTab === 'whatsapp' && (
          <div className="animate-in slide-in-from-bottom-4 duration-500">
            <EvolutionManager />
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="animate-in slide-in-from-bottom-4 duration-500">
            <SendLogsView />
          </div>
        )}

        {activeTab === 'automations' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in slide-in-from-bottom-4 duration-500">
            {loading && automations.length === 0 && (
               <div className="col-span-full py-20 flex justify-center"><Loader2 className="w-10 h-10 text-indigo-600 animate-spin" /></div>
            )}
            {automations.map((auto) => {
              const Icon = auto.trigger_type === 'new_lead' ? MessageSquare : 
                           auto.trigger_type === 'appointment_reminder' ? Bell :
                           auto.trigger_type === 'inactive_patient' ? RefreshCw : 
                           auto.trigger_type === 'nps_survey' ? Star : Gift;
              return (
                <div key={auto.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-xl transition-all group border-b-4 border-b-transparent hover:border-b-indigo-500">
                  <div className="flex items-start justify-between mb-6">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Icon className="w-7 h-7" />
                    </div>
                    <button 
                      onClick={() => toggleAutomation(auto.id, auto.status)}
                      className={cn(
                        "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest transition-all",
                        auto.status ? "bg-emerald-50 text-emerald-600" : "bg-slate-50 text-slate-400"
                      )}
                    >
                      {auto.status ? 'Ativo' : 'Pausado'}
                    </button>
                  </div>
                  <h4 className="text-xl font-bold text-slate-900 mb-2">{auto.title}</h4>
                  <p className="text-slate-500 text-sm leading-relaxed mb-6">{auto.description}</p>
                  <div className="pt-6 border-t border-slate-50 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Gatilho</p>
                      <p className="text-xs font-bold text-indigo-600">{auto.trigger_type}</p>
                    </div>
                    <button onClick={() => openEditModal(auto)} className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:bg-indigo-600 hover:text-white transition-all">
                      <Settings className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
            
            <button 
              onClick={() => setShowAutoModal(true)}
              className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2.5rem] p-8 flex flex-col items-center justify-center gap-4 group hover:border-indigo-300 transition-all"
            >
              <div className="w-14 h-14 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-slate-300 group-hover:text-indigo-500 transition-colors">
                <Plus className="w-7 h-7" />
              </div>
              <p className="font-bold text-slate-400 group-hover:text-slate-600">Criar Nova Automação</p>
            </button>
          </div>
        )}

        {activeTab === 'wifi' && (
          <div className="animate-in slide-in-from-bottom-4 duration-500">
            <WifiPresence />
          </div>
        )}

        {activeTab === 'nps' && (
          <div className="animate-in slide-in-from-bottom-4 duration-500">
            <NpsDashboard />
          </div>
        )}
      </div>

      {/* New Automation Modal */}
      {showAutoModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
           <div className="bg-white rounded-[3rem] w-full max-w-lg shadow-2xl border border-slate-100 overflow-hidden">
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                 <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg"><Zap className="w-6 h-6" /></div>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">Nova Automação</h3>
                 </div>
                 <button onClick={() => setShowAutoModal(false)} className="p-2 hover:bg-white rounded-full text-slate-400 transition-all border border-transparent hover:border-slate-200"><X className="w-6 h-6" /></button>
              </div>
              <div className="p-8 space-y-6">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Título do Robô</label>
                    <input 
                      value={newAuto.title}
                      onChange={(e) => setNewAuto({...newAuto, title: e.target.value})}
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20" 
                      placeholder="Ex: Boas-vindas WhatsApp" 
                    />
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Gatilho (Trigger)</label>
                    <select 
                      value={newAuto.trigger_type}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === 'nps_survey') {
                          setNewAuto({
                            ...newAuto, 
                            trigger_type: val,
                            title: 'Pesquisa de Satisfação (NPS)',
                            description: 'Olá, {{nome}}! Aqui é da Tzion Terapias.\nEsperamos que a sua última sessão tenha sido excelente!\n\nPara nos ajudar a manter a qualidade dos nossos atendimentos, como você avalia a sua experiência de 1 a 5?\n\n1️⃣ - Muito Ruim\n2️⃣ - Ruim\n3️⃣ - Razoável\n4️⃣ - Muito Boa\n5️⃣ - Excelente\n\nResponda com apenas o número (1 a 5). Muito obrigado! 💙'
                          });
                        } else {
                          setNewAuto({...newAuto, trigger_type: val});
                        }
                      }}
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none appearance-none cursor-pointer"
                    >
                      <option value="new_lead">Novo Lead Entrou no Funil</option>
                      <option value="appointment_reminder">Lembrete de Agendamento</option>
                      <option value="birthday">Aniversário do Paciente</option>
                      <option value="inactive_patient">Recuperação de Inativos</option>
                      <option value="nps_survey">Pesquisa NPS Pós-Sessão</option>
                    </select>
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mensagem ou Descrição</label>
                    <textarea 
                      value={newAuto.description}
                      onChange={(e) => setNewAuto({...newAuto, description: e.target.value})}
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none min-h-[100px] resize-none" 
                      placeholder="Descreva o que este robô deve fazer..." 
                    />
                 </div>
                 <button 
                  onClick={handleCreateAuto}
                  className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-bold shadow-2xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                 >
                   <Save className="w-5 h-5" /> Ativar Automação
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* New Lead Modal */}
      {showCampaignModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white rounded-[3rem] w-full max-w-xl shadow-2xl border border-slate-100 overflow-hidden">
             <div className="p-10 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-3xl font-black text-slate-900 tracking-tight">Novo Lead</h3>
              <button 
                onClick={() => setShowCampaignModal(false)}
                className="p-3 hover:bg-white rounded-full transition-all text-slate-400 border border-transparent hover:border-slate-200 shadow-sm"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-10 space-y-8">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome Completo</label>
                  <input className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" placeholder="Ex: João Silva" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">WhatsApp</label>
                  <input className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" placeholder="(11) 99999-9999" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Origem do Lead</label>
                <select className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all appearance-none cursor-pointer">
                  <option>Instagram</option>
                  <option>Indicação</option>
                  <option>Site / Landing Page</option>
                  <option>Google Ads</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Observações Iniciais</label>
                <textarea className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" rows={3} placeholder="Descreva o que o lead busca..." />
              </div>
              <button 
                onClick={() => setShowCampaignModal(false)}
                className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-bold shadow-2xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-[0.98]"
              >
                Cadastrar Lead & Iniciar Atendimento
              </button>
            </div>
           </div>
        </div>
      )}

      {/* Edit Automation Modal */}
      {showEditAutoModal && editAuto && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
           <div className="bg-white rounded-[3rem] w-full max-w-lg shadow-2xl border border-slate-100 overflow-hidden">
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                  <Settings className="w-6 h-6 text-indigo-600" />
                  Configurar Automação
                </h3>
                <button onClick={() => setShowEditAutoModal(false)} className="p-2 hover:bg-slate-200 rounded-xl transition-colors">
                  <X className="w-6 h-6 text-slate-500" />
                </button>
              </div>
              <div className="p-8 space-y-6">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Mensagem da Automação</label>
                  <textarea 
                    rows={6}
                    value={editAuto.settings?.message || ''}
                    onChange={(e) => setEditAuto({ ...editAuto, settings: { ...editAuto.settings, message: e.target.value } })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-700 resize-none"
                    placeholder="Digite a mensagem que será enviada..."
                  />
                  <p className="text-xs text-slate-500 mt-2">Dica: Use formatação do WhatsApp como *negrito*, _itálico_ e ~riscado~.</p>
                </div>
                <button 
                  onClick={handleSaveAuto}
                  disabled={loading}
                  className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  Salvar Configuração
                </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
