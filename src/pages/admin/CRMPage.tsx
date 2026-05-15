import React from 'react';
import { Trophy, Gift, Star, Target, Zap, ChevronRight, MessageSquare, Heart, Users, Bell, Sparkles } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import GamificationView from '@/src/components/dashboard/GamificationView';

export default function CRMPage() {
  const [showCampaignModal, setShowCampaignModal] = React.useState(false);
  const [interactions, setInteractions] = React.useState([
    { name: 'João Oliveira', msg: 'Obrigado pelo lembrete! Consigo sim.', time: '14:20', status: 'Lida' },
    { name: 'Maria Santos', msg: 'Poderia remarcar para quarta?', time: '12:05', status: 'Pendente' },
    { name: 'Pedro Souza', msg: 'Link recebido, entrarei no horário.', time: '09:15', status: 'Lida' },
  ]);

  const handleCreateCampaign = () => {
    alert('Campanha agendada com sucesso!');
    setShowCampaignModal(false);
    // Add a fake system interaction to show it's working
    setInteractions([{ name: 'Sistema', msg: 'Nova campanha disparada para 42 pacientes.', time: 'Agora', status: 'Enviada' }, ...interactions]);
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">CRM & Marketing</h2>
          <p className="text-slate-500 font-medium">Fidelização, engajamento e relacionamento com pacientes.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setShowCampaignModal(true)}
            className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-2 active:scale-95"
          >
            <Bell className="w-5 h-5" /> Nova Campanha
          </button>
        </div>
      </div>

      {showCampaignModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl border border-slate-100 overflow-hidden">
             <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-2xl font-bold text-slate-900">Nova Campanha</h3>
              <button 
                onClick={() => setShowCampaignModal(false)}
                className="p-2 hover:bg-white rounded-full transition-all text-slate-400 border border-transparent hover:border-slate-200"
              >
                <ChevronRight className="w-6 h-6 rotate-180" />
              </button>
            </div>
            <div className="p-8 space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Nome da Campanha</label>
                  <input className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Ex: Retorno de Outono" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Público Alvo</label>
                  <select className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none">
                    <option>Todos os Pacientes</option>
                    <option>Inativos (&gt; 30 dias)</option>
                    <option>Pacientes em Alta</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Mensagem Modelo</label>
                  <textarea className="w-full p-4 bg-slate-50 border border-slate-200 rounded-[1.5rem] outline-none focus:ring-2 focus:ring-indigo-500" rows={4} placeholder="Olá [nome], estamos com saudades..." />
                </div>
              </div>
              <button 
                onClick={handleCreateCampaign}
                className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-bold shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all"
              >
                Disparar Campanha
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'NPS Global', value: '78', icon: Heart, color: 'rose' },
          { label: 'Taxa Reengaje', value: '24%', icon: Sparkles, color: 'indigo' },
          { label: 'Pacientes Ativos', value: '42', icon: Users, color: 'emerald' },
          { label: 'Mensagens Mês', value: '850', icon: MessageSquare, color: 'amber' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-4", 
              stat.color === 'rose' ? "bg-rose-50 text-rose-600" : 
              stat.color === 'indigo' ? "bg-indigo-50 text-indigo-600" : 
              stat.color === 'emerald' ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600")}>
              <stat.icon className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-none mb-2">{stat.label}</p>
            <h3 className="text-2xl font-bold text-slate-900">{stat.value}</h3>
          </div>
        ))}
      </div>

      <div className="bg-indigo-900 rounded-[2.5rem] p-10 text-white relative overflow-hidden shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full text-[10px] font-bold uppercase tracking-widest border border-white/10">
              Feature Inteligente
            </div>
            <h3 className="text-3xl font-bold tracking-tight">Campanhas de Aniversário e Retorno</h3>
            <p className="text-indigo-200/70 max-w-lg font-medium">O Tzion detecta automaticamente quando um paciente completa aniversário ou está há mais de 15 dias sem agendar e envia uma mensagem personalizada via WhatsApp.</p>
          </div>
          <button className="px-8 py-4 bg-white text-indigo-900 rounded-2xl font-bold hover:bg-slate-50 transition-all flex items-center gap-3">
             Configurar Automações
          </button>
        </div>
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <GamificationView />
        <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-8">
           <h3 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
             <MessageSquare className="w-5 h-5 text-indigo-500" /> Últimas Interações (WhatsApp)
           </h3>
           <div className="space-y-6">
             {interactions.map((msg, i) => (
               <div key={i} className="flex gap-4 group cursor-pointer hover:translate-x-2 transition-transform">
                 <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 font-bold group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all">
                   {msg.name.charAt(0)}
                 </div>
                 <div className="flex-1 space-y-1">
                   <div className="flex justify-between items-center">
                     <p className="font-bold text-slate-900 text-sm">{msg.name}</p>
                     <span className="text-[10px] text-slate-400 font-bold">{msg.time}</span>
                   </div>
                   <p className="text-sm text-slate-500 font-medium line-clamp-1">{msg.msg}</p>
                 </div>
               </div>
             ))}
           </div>
           <button className="w-full py-4 text-slate-400 font-bold text-[10px] uppercase tracking-widest border border-slate-100 rounded-2xl hover:bg-slate-50 transition-all">
              Ver Todas as Mensagens
           </button>
        </div>
      </div>
    </div>
  );
}
