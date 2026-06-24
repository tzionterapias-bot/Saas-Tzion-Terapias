import React, { useState, useEffect } from 'react';
import {
  Calendar, Users, Clock, CheckCircle2, DollarSign,
  MessageSquare, Loader2, ChevronRight, Heart,
  AlertCircle, TrendingUp, Bell, Activity
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/contexts/AuthContext';
import { Link } from 'react-router-dom';

function StatCard({ icon: Icon, label, value, color, trend }: any) {
  const colors: Record<string, string> = {
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    rose: 'bg-rose-50 text-rose-600 border-rose-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    violet: 'bg-violet-50 text-violet-600 border-violet-100',
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center gap-4 shadow-sm">
      <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border', colors[color] || colors.indigo)}>
        <Icon className="w-6 h-6" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">{label}</p>
        <p className="text-2xl font-black text-slate-900 leading-tight">{value}</p>
        {trend && <p className="text-[10px] text-slate-400 font-medium mt-0.5">{trend}</p>}
      </div>
    </div>
  );
}

function SessionItem({ session }: { session: any; [key: string]: any }) {
  const time = new Date(session.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const statusMap: Record<string, { label: string; cls: string }> = {
    scheduled: { label: 'Agendada', cls: 'bg-blue-100 text-blue-700' },
    completed: { label: 'Concluída', cls: 'bg-emerald-100 text-emerald-700' },
    cancelled: { label: 'Cancelada', cls: 'bg-rose-100 text-rose-700' },
    no_show: { label: 'Faltou', cls: 'bg-amber-100 text-amber-700' },
  };
  const st = statusMap[session.status] || { label: session.status, cls: 'bg-slate-100 text-slate-600' };

  return (
    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl">
      <div className="w-12 h-12 bg-white border border-slate-200 rounded-xl flex items-center justify-center shrink-0">
        <span className="text-xs font-black text-indigo-600">{time}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-slate-900 text-sm truncate">{session.patients?.name || 'Paciente'}</p>
        <p className="text-xs text-slate-400 font-medium">{session.type || 'Sessão'}</p>
      </div>
      <span className={cn('text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full shrink-0', st.cls)}>
        {st.label}
      </span>
    </div>
  );
}

function QuickLinkCard({ to, icon: Icon, label, color }: any) {
  const colors: Record<string, string> = {
    indigo: 'from-indigo-500 to-indigo-700',
    emerald: 'from-emerald-500 to-emerald-700',
    violet: 'from-violet-500 to-violet-700',
    amber: 'from-amber-500 to-amber-600',
  };
  return (
    <Link
      to={to}
      className={cn('flex flex-col items-center justify-center gap-2 p-4 rounded-2xl text-white bg-gradient-to-br shadow-lg active:scale-95 transition-transform', colors[color] || colors.indigo)}
    >
      <Icon className="w-6 h-6" />
      <span className="text-[10px] font-black uppercase tracking-widest text-center">{label}</span>
    </Link>
  );
}

export default function MobileDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [todaySessions, setTodaySessions] = useState<any[]>([]);
  const [stats, setStats] = useState({
    todayCount: 0,
    pendingCount: 0,
    monthlyRevenue: 0,
    activePatients: 0,
    pendingLeads: 0,
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const todayBRT = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(now);
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

      // Sessions today
      const { data: sessions } = await supabase
        .from('appointments')
        .select('*, patients(name)')
        .gte('start_time', `${todayBRT}T00:00:00`)
        .lte('start_time', `${todayBRT}T23:59:59`)
        .order('start_time', { ascending: true })
        .limit(8);

      setTodaySessions(sessions || []);

      const todayCount = sessions?.length || 0;
      const pendingCount = sessions?.filter(s => s.status !== 'completed' && s.status !== 'cancelled').length || 0;

      // Active patients
      const { count: activePatients } = await supabase
        .from('patients')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'Ativo');

      // Monthly revenue
      const { data: payments } = await supabase
        .from('payments')
        .select('amount')
        .gte('created_at', firstDay)
        .lte('created_at', lastDay)
        .eq('status', 'paid');

      const monthlyRevenue = (payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);

      // Pending leads (admin/atendimento)
      let pendingLeads = 0;
      if (user?.role === 'admin' || user?.role === 'atendimento') {
        const { count } = await supabase
          .from('leads')
          .select('*', { count: 'exact', head: true })
          .neq('status', 'converted');
        pendingLeads = count || 0;
      }

      setStats({ todayCount, pendingCount, monthlyRevenue, activePatients: activePatients || 0, pendingLeads });
    } catch (err) {
      console.error('Erro ao carregar dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const today = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long'
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          <p className="text-sm text-slate-400 font-medium">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8 animate-in fade-in duration-300">
      {/* Greeting */}
      <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-3xl p-5 text-white shadow-xl shadow-indigo-200">
        <div className="flex items-center gap-2 mb-1">
          <Heart className="w-4 h-4 fill-white/40" />
          <span className="text-xs font-bold text-white/70 capitalize">{today}</span>
        </div>
        <h2 className="text-2xl font-black leading-tight">
          Olá, {user?.name?.split(' ')[0]}! 👋
        </h2>
        <p className="text-sm text-white/80 font-medium mt-1">
          {stats.todayCount > 0
            ? `${stats.todayCount} ${stats.todayCount === 1 ? 'sessão' : 'sessões'} hoje · ${stats.pendingCount} pendente${stats.pendingCount !== 1 ? 's' : ''}`
            : 'Sua agenda está livre hoje'
          }
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={Calendar} label="Sessões Hoje" value={stats.todayCount} color="indigo" trend="Agendadas" />
        <StatCard icon={CheckCircle2} label="Pendentes" value={stats.pendingCount} color="amber" trend="Para completar" />
        <StatCard icon={Users} label="Pacientes" value={stats.activePatients} color="emerald" trend="Ativos" />
        {(user?.role === 'admin' || user?.role === 'financeiro') && (
          <StatCard
            icon={DollarSign}
            label="Receita Mês"
            value={`R$ ${stats.monthlyRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`}
            color="violet"
            trend="Este mês"
          />
        )}
        {(user?.role === 'admin' || user?.role === 'atendimento') && stats.pendingLeads > 0 && (
          <StatCard icon={Bell} label="Leads" value={stats.pendingLeads} color="rose" trend="Aguardando" />
        )}
      </div>

      {/* Quick Links */}
      <div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Acesso Rápido</p>
        <div className="grid grid-cols-3 gap-3">
          <QuickLinkCard to="/admin/agenda" icon={Calendar} label="Agenda" color="indigo" />
          <QuickLinkCard to="/admin/pacientes" icon={Users} label="Pacientes" color="emerald" />
          {user?.role === 'terapeuta' && (
            <QuickLinkCard to="/admin/portal-terapeuta" icon={Activity} label="Portal" color="violet" />
          )}
          {(user?.role === 'admin' || user?.role === 'atendimento') && (
            <QuickLinkCard to="/admin/atendimento" icon={MessageSquare} label="Atendimento" color="amber" />
          )}
        </div>
      </div>

      {/* Today's Sessions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Agenda de Hoje</p>
          <Link to="/admin/agenda" className="text-xs font-bold text-indigo-600 flex items-center gap-1">
            Ver tudo <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="space-y-2">
          {todaySessions.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-6 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              <p className="text-sm text-slate-400 font-medium">Nenhuma sessão agendada para hoje</p>
            </div>
          ) : (
            todaySessions.map((s, i) => <SessionItem key={s.id || i} session={s} />)
          )}
        </div>
      </div>

      {/* Desktop notice */}
      <div className="flex items-start gap-3 bg-slate-50 border border-slate-200 rounded-2xl p-4">
        <AlertCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
        <p className="text-xs text-slate-500 font-medium leading-relaxed">
          Relatórios, financeiro e configurações avançadas estão disponíveis apenas na versão desktop.
        </p>
      </div>
    </div>
  );
}
