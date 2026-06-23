import React, { useState, useEffect } from 'react';
import { 
  Users, Calendar, Clock, Target, Loader2, Phone, MessageSquare, Plus, ArrowRight, CheckCircle2, User
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/contexts/AuthContext';

export default function ReceptionView() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    todaySessions: 0,
    pendingLeads: 0,
    newMessages: 0
  });
  const [upcomingSessions, setUpcomingSessions] = useState<any[]>([]);
  const [recentLeads, setRecentLeads] = useState<any[]>([]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];

      // Execute queries in parallel for high performance
      const [todayApptsRes, leadsRes] = await Promise.all([
        supabase.from('appointments')
          .select('*, patients(name)')
          .gte('start_time', `${today}T00:00:00`)
          .lte('start_time', `${today}T23:59:59`)
          .order('start_time', { ascending: true }),
        supabase.from('leads')
          .select('*')
          .neq('status', 'converted')
          .order('created_at', { ascending: false })
          .limit(5)
      ]);

      const todayAppts = todayApptsRes.data;
      const leads = leadsRes.data;

      setStats({
        todaySessions: todayAppts?.length || 0,
        pendingLeads: leads?.length || 0, // Should use count logic ideally
        newMessages: 14 // Mocked for CRM integration
      });

      setUpcomingSessions(todayAppts?.slice(0, 4) || []);
      setRecentLeads(leads || []);

    } catch (error) {
      console.error('Erro ao buscar estatísticas da recepção:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return <div className="flex h-[80vh] items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-indigo-600" /></div>;
  }

  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight">Painel da Recepção</h2>
          <p className="text-slate-500 font-medium text-lg">Gerencie os agendamentos de hoje e novos contatos.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-5 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 flex items-center gap-2">
            <Plus className="w-5 h-5" /> Novo Agendamento
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Sessões Hoje', value: stats.todaySessions, icon: Calendar, color: 'indigo', trend: 'Agenda' },
          { label: 'Leads Pendentes', value: stats.pendingLeads, icon: Target, color: 'rose', trend: 'CRM' },
          { label: 'Mensagens WhatsApp', value: stats.newMessages, icon: MessageSquare, color: 'emerald', trend: 'Ações Necessárias' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all group">
            <div className="flex justify-between items-start mb-6">
              <div className={cn(
                "w-14 h-14 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110",
                stat.color === 'indigo' ? "bg-indigo-50 text-indigo-600" :
                stat.color === 'emerald' ? "bg-emerald-50 text-emerald-600" :
                "bg-rose-50 text-rose-600"
              )}>
                <stat.icon className="w-7 h-7" />
              </div>
              <span className={cn(
                "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-slate-50 text-slate-500"
              )}>
                {stat.trend}
              </span>
            </div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
            <h3 className="text-3xl font-black text-slate-900">{stat.value}</h3>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Agenda do Dia */}
        <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-bold flex items-center gap-2">
                <Clock className="w-6 h-6 text-indigo-600" /> Próximas Sessões
            </h3>
            <button className="text-xs font-bold text-indigo-600 hover:underline">Ver Agenda Completa</button>
          </div>
          <div className="space-y-4 flex-1">
            {upcomingSessions.map((session, i) => (
              <div key={i} className="flex items-center justify-between p-5 bg-slate-50/50 rounded-3xl border border-transparent hover:border-indigo-100 hover:bg-white transition-all group">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-white border border-slate-100 flex items-center justify-center font-bold text-slate-400 group-hover:text-indigo-600 transition-colors shadow-sm text-sm">
                    {new Date(session.start_time).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">{session.patients?.name || 'Paciente'}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">{session.type}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                    <button className="p-3 bg-white text-emerald-500 rounded-xl hover:bg-emerald-50 shadow-sm border border-slate-100" title="Confirmar Presença">
                    <CheckCircle2 className="w-5 h-5" />
                    </button>
                    <button className="p-3 bg-white text-slate-400 rounded-xl hover:text-indigo-600 shadow-sm border border-slate-100" title="Enviar Mensagem">
                    <MessageSquare className="w-5 h-5" />
                    </button>
                </div>
              </div>
            ))}
            {upcomingSessions.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2 mt-10">
                <Calendar className="w-10 h-10 text-slate-300" />
                <p className="font-medium">Nenhum agendamento para hoje.</p>
              </div>
            )}
          </div>
        </div>

        {/* Novos Leads */}
        <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-bold flex items-center gap-2">
                <Target className="w-6 h-6 text-rose-500" /> Leads Recentes
            </h3>
            <button className="text-xs font-bold text-indigo-600 hover:underline">Abrir CRM</button>
          </div>
          <div className="space-y-4 flex-1">
            {recentLeads.map((lead, i) => (
              <div key={i} className="flex items-center justify-between p-5 bg-slate-50/50 rounded-3xl border border-transparent hover:border-indigo-100 hover:bg-white transition-all group">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-white border border-slate-100 flex items-center justify-center font-bold text-slate-400 shadow-sm text-sm">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">{lead.name}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">{lead.source || 'Site/WhatsApp'}</p>
                  </div>
                </div>
                <button className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl font-bold hover:bg-indigo-600 hover:text-white transition-all text-xs">
                  Atender <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            ))}
            {recentLeads.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2 mt-10">
                <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                <p className="font-medium">Todos os leads foram atendidos!</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
