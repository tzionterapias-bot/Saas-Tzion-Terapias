import React, { useState, useEffect } from 'react';
import { 
  Users, Calendar, Clock, CheckCircle2, MessageSquare, Loader2, Activity, ClipboardList
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/contexts/AuthContext';

export default function TherapistView() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    activePatients: 0,
    monthlySessions: 0,
    pendingEvolutions: 0
  });
  const [upcomingSessions, setUpcomingSessions] = useState<any[]>([]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
      const today = now.toISOString().split('T')[0];

      // Busca o ID do terapeuta associado ao usuário logado
      const { data: therapist } = await supabase
        .from('therapists')
        .select('id')
        .eq('user_id', user?.id)
        .maybeSingle();

      let monthlyQuery = supabase.from('appointments')
        .select('id, patient_id')
        .gte('start_time', firstDay)
        .lte('start_time', lastDay);

      let todayQuery = supabase.from('appointments')
        .select('*, patients(name)')
        .gte('start_time', `${today}T00:00:00`)
        .lte('start_time', `${today}T23:59:59`)
        .order('start_time', { ascending: true })
        .limit(6);

      if (therapist?.id) {
        monthlyQuery = monthlyQuery.eq('therapist_id', therapist.id);
        todayQuery = todayQuery.eq('therapist_id', therapist.id);
      }

      // Execute queries in parallel for high performance
      const [monthlyApptsRes, todayApptsRes] = await Promise.all([
        monthlyQuery,
        todayQuery
      ]);

      const monthlyAppts = monthlyApptsRes.data || [];
      const todayAppts = todayApptsRes.data || [];

      // Contagem real de pacientes ativos no mês
      const uniquePatients = new Set(monthlyAppts.map(a => a.patient_id).filter(Boolean));
      
      // Contagem de evoluções pendentes: sessões de hoje não completadas/canceladas
      const pendingEvolutions = todayAppts.filter(a => a.status !== 'completed' && a.status !== 'cancelled').length;

      setStats({
        activePatients: uniquePatients.size,
        monthlySessions: monthlyAppts.length,
        pendingEvolutions: pendingEvolutions
      });

      setUpcomingSessions(todayAppts);

    } catch (error) {
      console.error('Erro ao buscar estatísticas do terapeuta:', error);
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
          <h2 className="text-4xl font-black text-slate-900 tracking-tight">Olá, {user?.name}</h2>
          <p className="text-slate-500 font-medium text-lg">Aqui está o resumo da sua rotina clínica.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchStats} className="px-5 py-3 bg-white border border-slate-200 rounded-2xl font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm">
            Atualizar Dados
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Meus Pacientes', value: stats.activePatients, icon: Users, color: 'indigo', trend: 'Ativos' },
          { label: 'Sessões Realizadas', value: stats.monthlySessions, icon: Calendar, color: 'emerald', trend: 'Este Mês' },
          { label: 'Evoluções Pendentes', value: stats.pendingEvolutions, icon: ClipboardList, color: 'rose', trend: 'Ação Necessária' },
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

      {/* Agenda do Dia */}
      <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-bold flex items-center gap-2">
                <Clock className="w-6 h-6 text-indigo-600" /> Minha Agenda de Hoje
            </h3>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {upcomingSessions.map((session, i) => (
            <div key={i} className="flex items-center justify-between p-5 bg-slate-50/50 rounded-3xl border border-transparent hover:border-indigo-100 hover:bg-white transition-all group">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-white border border-slate-100 flex items-center justify-center font-bold text-slate-400 group-hover:text-indigo-600 transition-colors shadow-sm text-lg">
                  {new Date(session.start_time).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}
                </div>
                <div>
                  <p className="font-bold text-slate-900 text-lg">{session.patients?.name || 'Paciente'}</p>
                  <p className="text-xs text-slate-500 font-medium flex items-center gap-1 mt-1">
                    <Activity className="w-3 h-3" /> {session.type || 'Sessão'}
                  </p>
                </div>
              </div>
              <button className="px-5 py-3 bg-indigo-50 text-indigo-600 font-bold rounded-xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm border border-indigo-100">
                Iniciar Sessão
              </button>
            </div>
          ))}
          {upcomingSessions.length === 0 && (
            <div className="col-span-full h-[200px] flex flex-col items-center justify-center text-slate-400 space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-400" />
              <p className="font-medium">Sua agenda está livre hoje!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
