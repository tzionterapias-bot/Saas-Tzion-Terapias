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
    
    // Lista de todas as automações com o padrão exato da Clínica Tzion Terapias
    const DEFAULT_AUTOMATIONS = [
      {
        trigger_type: 'appointment_created',
        title: 'Confirmação de Agendamento (Paciente)',
        description: 'Olá, *{{nome}}*! ✨\n\nSeu agendamento na *Clínica Tzion Terapias* está confirmado!\n\n📅 *Data:* {{data}}\n⏰ *Horário:* {{horario}}\n📍 *Modalidade:* {{modalidade}}\n\n📍 *Local Presencial:*\nRua Princesa Isabel, esquina com Rua Capibaribe, R. Santa Helena\n\nUm abraço e te esperamos! 💙',
        status: true
      },
      {
        trigger_type: 'appointment_reminder',
        title: 'Lembrete de Agendamento (Paciente)',
        description: 'Olá, *{{nome}}*! ✨\n\nPassando aqui para lembrar da sua sessão na *Clínica Tzion Terapias* marcada para hoje!\n\n⏰ *Horário:* {{horario}}\n📍 *Modalidade:* {{modalidade}}\n\n📍 *Local Presencial:*\nRua Princesa Isabel, esquina com Rua Capibaribe, R. Santa Helena\n\nUm abraço e até mais tarde! 💙',
        status: true
      },
      {
        trigger_type: 'appointment_created_therapist',
        title: 'Alerta de Novo Agendamento (Terapeuta)',
        description: 'Olá, *{{terapeuta}}*! ✨\n\nNova sessão agendada na *Clínica Tzion Terapias*!\n\n👤 *Paciente:* {{nome}}\n📅 *Data:* {{data}}\n⏰ *Horário:* {{horario}}\n📍 *Modalidade:* {{modalidade}}\n\n📍 *Local Presencial:*\nRua Princesa Isabel, esquina com Rua Capibaribe, R. Santa Helena\n\nBom atendimento! 💙',
        status: true
      },
      {
        trigger_type: 'appointment_reminder_therapist',
        title: 'Lembrete de Consulta (Terapeuta)',
        description: 'Olá, *{{terapeuta}}*! ✨\n\nLembrete profissional de atendimento agendado para hoje na *Clínica Tzion Terapias*:\n\n👤 *Paciente:* {{nome}}\n⏰ *Horário:* {{horario}}\n📍 *Modalidade:* {{modalidade}}\n\n📍 *Local Presencial:*\nRua Princesa Isabel, esquina com Rua Capibaribe, R. Santa Helena\n\nTenha uma ótima sessão! 💙',
        status: true
      },
      {
        trigger_type: 'appointment_cancelled',
        title: 'Aviso de Cancelamento (Paciente)',
        description: 'Olá, *{{nome}}*! ⚠️\n\nA sessão agendada para *{{data}} às {{horario}}* na *Clínica Tzion Terapias* foi cancelada/desmarcada.\n\nQualquer dúvida ou se quiser remarcar, estamos à disposição!\n\nUm abraço! 💙',
        status: true
      },
      {
        trigger_type: 'appointment_cancelled_therapist',
        title: 'Aviso de Cancelamento (Terapeuta)',
        description: 'Olá, *{{terapeuta}}*! ⚠️\n\nAviso de cancelamento na *Clínica Tzion Terapias*:\n\nA sessão com o(a) paciente *{{nome}}* agendada para *{{data}} às {{horario}}* foi cancelada/desmarcada.\n\nQualquer dúvida, estamos à disposição! 💙',
        status: true
      },
      {
        trigger_type: 'appointment_rescheduled',
        title: 'Aviso de Reagendamento (Paciente)',
        description: 'Olá, *{{nome}}*! ✨\n\nSua sessão na *Clínica Tzion Terapias* foi reagendada com sucesso!\n\n📅 *Nova Data:* {{data}}\n⏰ *Novo Horário:* {{horario}}\n📍 *Modalidade:* {{modalidade}}\n\n📍 *Local Presencial:*\nRua Princesa Isabel, esquina com Rua Capibaribe, R. Santa Helena\n\nUm abraço e te esperamos! 💙',
        status: true
      },
      {
        trigger_type: 'commission_paid',
        title: 'Aviso de Repasse / Comissão (Terapeuta)',
        description: '✅ *Repasse Confirmado — Tzion Terapias*\n\nOlá, *{{terapeuta}}*!\n\nO seu repasse de *{{mes_ano}}* foi processado:\n\n💰 *Faturamento Bruto:* R$ {{faturamento_bruto}}\n🏥 *Taxa Clínica:* R$ {{taxa_clinica}}\n✅ *Valor Líquido:* R$ {{valor_liquido}}\n\n💳 *Método:* {{metodo}}\n📝 *Obs:* {{observacao}}\n\nQualquer dúvida, entre em contato! 💙',
        status: true
      },
      {
        trigger_type: 'nps_survey',
        title: 'Pesquisa de Satisfação (NPS)',
        description: 'Olá, *{{nome}}*! ✨\n\nGostaríamos de saber como foi sua sessão de hoje na *Clínica Tzion Terapias*.\n\nDe 0 a 10, o quanto você recomendaria nossos serviços?\n\nAcesse o link para avaliar: {{link_nps}}\n\nMuito obrigado pelo seu carinho! 💙',
        status: true
      },
      {
        trigger_type: 'new_lead',
        title: 'Boas-vindas Automática (Novo Lead)',
        description: 'Olá, *{{nome}}*! ✨ Seja bem-vindo(a) à *Clínica Tzion Terapias*.\n\nComo podemos te ajudar hoje? Ficaremos muito felizes em cuidar de você!\n\n📍 *Nosso Endereço:*\nRua Princesa Isabel, esquina com Rua Capibaribe, R. Santa Helena\n\nUm abraço! 💙',
        status: true
      },
      {
        trigger_type: 'anamnesis_invite',
        title: 'Envio de Ficha de Anamnese',
        description: 'Olá, *{{nome}}*! ✨\n\nPara tornar seu atendimento na *Clínica Tzion Terapias* ainda mais personalizado, por favor preencha sua ficha de anamnese antes da consulta:\n\n📋 *Acesse o link:* {{link_anamnese}}\n\nMuito obrigado! 💙',
        status: true
      },
      {
        trigger_type: 'contract_sent',
        title: 'Envio de Contrato',
        description: 'Olá, *{{nome}}*! ✨\n\nSeu contrato da *Clínica Tzion Terapias* está pronto para assinatura digital:\n\n📄 *Acesse para assinar:* {{link_contrato}}\n\nQualquer dúvida, estamos à disposição! 💙',
        status: true
      },
      {
        trigger_type: 'payment_link_sent',
        title: 'Envio de Cobrança / Link de Pagamento',
        description: 'Olá, *{{nome}}*! ✨\n\nSegue o link para pagamento referente ao seu atendimento na *Clínica Tzion Terapias*:\n\n💳 *Acesse para pagar:* {{link_pagamento}}\n\nAgradecemos a confiança! 💙',
        status: true
      },
      {
        trigger_type: 'birthday',
        title: 'Campanha de Aniversário',
        description: 'Parabéns, *{{nome}}*! 🎉✨\n\nA equipe da *Clínica Tzion Terapias* te deseja um feliz aniversário com muita saúde e paz! Um abraço carinhoso! 💙',
        status: true
      },
      {
        trigger_type: 'inactive_patient',
        title: 'Recuperação de Inativos',
        description: 'Olá, *{{nome}}*! ✨\n\nSentimos sua falta aqui na *Clínica Tzion Terapias*. Que tal agendar sua próxima sessão de autocuidado?\n\n📍 *Nosso Endereço:*\nRua Princesa Isabel, esquina com Rua Capibaribe, R. Santa Helena\n\nEstamos te aguardando com muito carinho! 💙',
        status: true
      }
    ];

    let currentList = data || [];

    // Mapeamento das mensagens padrão atualizadas
    const defaultMap = new Map(DEFAULT_AUTOMATIONS.map(d => [d.trigger_type, d]));

    // Sobrescrever e garantir que todas as automações tenham o formato oficial da Tzion
    currentList = DEFAULT_AUTOMATIONS.map((defaultItem) => {
      const existing = currentList.find(a => a.trigger_type === defaultItem.trigger_type);
      if (!existing) {
        return {
          id: String(Date.now() + Math.random()),
          ...defaultItem,
          settings: { message: defaultItem.description }
        };
      }
      // Se a mensagem salva no banco for a antiga/curta sem emojis ou formato da Tzion, atualizar visualmente
      const currentMsg = existing.settings?.message || existing.description || '';
      const isOldFormat = !currentMsg.includes('Clínica Tzion Terapias') && !currentMsg.includes('📍');
      
      const finalMsg = isOldFormat ? defaultItem.description : currentMsg;
      return {
        ...existing,
        title: existing.title || defaultItem.title,
        description: defaultItem.description,
        settings: { ...existing.settings, message: finalMsg }
      };
    });

    setAutomations(currentList);
    
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
      .update({ 
        title: editAuto.title,
        description: editAuto.description,
        settings: editAuto.settings 
      })
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
           <div className="bg-white rounded-[3rem] w-full max-w-xl shadow-2xl border border-slate-100 overflow-hidden">
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <h3 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                    <Settings className="w-6 h-6 text-indigo-600" />
                    Editar Automação & Mensagem
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-1">Personalize o texto que será disparado via WhatsApp</p>
                </div>
                <button onClick={() => setShowEditAutoModal(false)} className="p-2 hover:bg-slate-200 rounded-xl transition-colors">
                  <X className="w-6 h-6 text-slate-500" />
                </button>
              </div>
              <div className="p-8 space-y-5">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Título da Automação</label>
                  <input 
                    type="text"
                    value={editAuto.title || ''}
                    onChange={(e) => setEditAuto({ ...editAuto, title: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-bold text-slate-800 text-sm"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Descrição / Objetivo</label>
                  <input 
                    type="text"
                    value={editAuto.description || ''}
                    onChange={(e) => setEditAuto({ ...editAuto, description: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs font-medium text-slate-700"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Mensagem do Disparo (WhatsApp)</label>
                    <span className="text-[10px] text-indigo-600 font-bold">Tags: &#123;&#123;nome&#127976;&#127974;&#125;</span>
                  </div>
                  <textarea 
                    rows={7}
                    value={editAuto.settings?.message || editAuto.description || ''}
                    onChange={(e) => setEditAuto({ 
                      ...editAuto, 
                      description: e.target.value,
                      settings: { ...editAuto.settings, message: e.target.value } 
                    })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-700 text-sm leading-relaxed resize-none"
                    placeholder="Digite o modelo de mensagem que será disparado via WhatsApp..."
                  />
                  <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 text-[11px] text-indigo-800 mt-2 space-y-1">
                    <p className="font-bold flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" /> Variáveis dinâmicas disponíveis:</p>
                    <p className="text-slate-600"><code className="bg-white px-1.5 py-0.5 rounded font-mono font-bold text-indigo-600">&#123;&#123;nome&#125;&#125;</code> Paciente/Cliente | <code className="bg-white px-1.5 py-0.5 rounded font-mono font-bold text-indigo-600">&#123;&#123;terapeuta&#125;&#125;</code> Terapeuta | <code className="bg-white px-1.5 py-0.5 rounded font-mono font-bold text-indigo-600">&#123;&#123;data&#125;&#125;</code> Data | <code className="bg-white px-1.5 py-0.5 rounded font-mono font-bold text-indigo-600">&#123;&#123;horario&#125;&#125;</code> Horário | <code className="bg-white px-1.5 py-0.5 rounded font-mono font-bold text-indigo-600">&#123;&#123;modalidade&#125;&#125;</code> Presencial/Online</p>
                  </div>
                </div>

                <button 
                  onClick={handleSaveAuto}
                  disabled={loading}
                  className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  Salvar e Atualizar Mensagem
                </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
