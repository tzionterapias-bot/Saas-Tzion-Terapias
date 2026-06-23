import React, { useState, useEffect, useCallback } from 'react';
import { 
  Users, Calendar, CreditCard, TrendingUp,
  Clock, CheckCircle2, MessageSquare, Target, Loader2,
  Cake, ArrowRight, RefreshCw, BarChart2, Percent
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { cn } from '@/src/lib/utils';
import { supabase } from '@/src/lib/supabase';
import { Link } from 'react-router-dom';

// ─── Custom Tooltip ────────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 px-5 py-4 text-center">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
        <p className="text-2xl font-black text-slate-900">{payload[0].value}</p>
        <p className="text-xs text-indigo-600 font-bold mt-0.5">
          {payload[0].value === 1 ? 'sessão' : 'sessões'}
        </p>
      </div>
    );
  }
  return null;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function getTodayBRT(): string {
  // Returns today's date in YYYY-MM-DD in America/Sao_Paulo timezone
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}

export default function AdminView() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [chartPeriod, setChartPeriod] = useState<7 | 30>(7);
  const [pendingTherapistsCount, setPendingTherapistsCount] = useState(0);

  const [stats, setStats] = useState({
    activePatients: 0,
    monthlySessions: 0,
    completedSessions: 0,
    totalSessions: 0,
    revenue: 0,
    pendingLeads: 0,
  });
  const [chartData, setChartData] = useState<any[]>([]);
  const [upcomingSessions, setUpcomingSessions] = useState<any[]>([]);
  const [birthdayPatients, setBirthdayPatients] = useState<any[]>([]);

  const fetchStats = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const todayBRT = getTodayBRT();
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

      // Today window in BRT
      const todayStart = `${todayBRT}T00:00:00`;
      const todayEnd = `${todayBRT}T23:59:59`;

      const [
        patientsRes,
        leadsRes,
        monthlyApptsRes,
        monthlyPaymentsRes,
        todayApptsRes,
        allPatientsRes,
        pendingTherapistsRes,
      ] = await Promise.all([
        supabase.from('patients').select('*', { count: 'exact', head: true }).eq('status', 'Ativo'),
        supabase.from('leads').select('*', { count: 'exact', head: true }).neq('status', 'converted'),
        supabase.from('appointments').select('id, start_time, status').gte('start_time', firstDay).lte('start_time', lastDay),
        // Revenue: try both paid_at and created_at to catch all paid entries
        supabase.from('payments')
          .select('amount, type, status, paid_at, created_at')
          .eq('status', 'paid')
          .eq('type', 'income')
          .or(`paid_at.gte.${firstDay},created_at.gte.${firstDay}`)
          .lte('created_at', lastDay),
        supabase.from('appointments')
          .select('*, patients(name)')
          .gte('start_time', todayStart)
          .lte('start_time', todayEnd)
          .order('start_time', { ascending: true })
          .limit(5),
        supabase.from('patients').select('id, name, birth_date').eq('status', 'Ativo').not('birth_date', 'is', null),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'terapeuta').eq('status', 'pending'),
      ]);

      const monthlyAppts = monthlyApptsRes.data || [];
      const monthlyPayments = monthlyPaymentsRes.data || [];
      const allPatients = allPatientsRes.data || [];

      // Revenue sum
      const totalRevenue = monthlyPayments.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);

      // Attendance rate
      const completedCount = monthlyAppts.filter(a => a.status === 'realizado' || a.status === 'confirmed' || a.status === 'confirmado').length;
      const totalCount = monthlyAppts.length;

      setStats({
        activePatients: patientsRes.count || 0,
        monthlySessions: totalCount,
        completedSessions: completedCount,
        totalSessions: totalCount,
        revenue: totalRevenue,
        pendingLeads: leadsRes.count || 0,
      });

      // Chart data
      const today = new Date();
      const days = Array.from({ length: chartPeriod }, (_, i) => {
        const d = new Date(today);
        d.setDate(d.getDate() - (chartPeriod - 1 - i));
        return d;
      });

      // For 30-day, fetch the extended range
      let allAppts = monthlyAppts;
      if (chartPeriod === 30) {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const { data } = await supabase.from('appointments')
          .select('id, start_time, status')
          .gte('start_time', thirtyDaysAgo.toISOString());
        allAppts = data || [];
      }

      const chartPoints = days.map(date => {
        const dateStr = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(date);
        const dayLabel = date.toLocaleDateString('pt-BR', {
          weekday: chartPeriod === 7 ? 'short' : undefined,
          day: 'numeric',
          month: chartPeriod === 30 ? 'numeric' : undefined,
        });
        const count = allAppts.filter(a => a.start_time?.startsWith(dateStr)).length;
        const label = chartPeriod === 7
          ? (dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1, -1))
          : dayLabel;
        return { name: label, value: count };
      });
      setChartData(chartPoints);

      setUpcomingSessions(todayApptsRes.data || []);
      setPendingTherapistsCount(pendingTherapistsRes.count || 0);

      // Birthday widget: patients born this month
      const currentMonth = (new Date()).getMonth() + 1;
      const currentDay = (new Date()).getDate();
      const birthdays = allPatients
        .filter(p => {
          if (!p.birth_date) return false;
          const [, month, day] = p.birth_date.split('-').map(Number);
          return month === currentMonth && day >= currentDay;
        })
        .sort((a, b) => {
          const dayA = parseInt(a.birth_date.split('-')[2]);
          const dayB = parseInt(b.birth_date.split('-')[2]);
          return dayA - dayB;
        })
        .slice(0, 4);
      setBirthdayPatients(birthdays);

    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [chartPeriod]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mx-auto" />
          <p className="text-slate-500 font-medium">Carregando painel...</p>
        </div>
      </div>
    );
  }

  const attendanceRate = stats.totalSessions > 0
    ? Math.round((stats.completedSessions / stats.totalSessions) * 100)
    : 0;

  const todayBRT = getTodayBRT();
  const todayFormatted = new Date(todayBRT + 'T12:00:00').toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long'
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight">Painel Executivo</h2>
          <p className="text-slate-500 font-medium text-lg mt-1">
            {todayFormatted.charAt(0).toUpperCase() + todayFormatted.slice(1)}
          </p>
        </div>
        <button
          onClick={() => fetchStats(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-5 py-3 bg-white border border-slate-200 rounded-2xl font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
        >
          <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
          {refreshing ? 'Atualizando...' : 'Atualizar Dados'}
        </button>
      </div>

      {/* Alert Banner for pending therapist registrations */}
      {pendingTherapistsCount > 0 && (
        <Link 
          to="/admin/usuarios"
          className="flex items-center justify-between p-5 bg-gradient-to-r from-amber-500/10 to-orange-500/10 hover:from-amber-500/15 hover:to-orange-500/15 border border-amber-500/20 rounded-3xl transition-all duration-300 group shadow-sm animate-in slide-in-from-top duration-300"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-500/20 text-amber-600 rounded-2xl flex items-center justify-center animate-pulse">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-amber-800 text-sm">Cadastro de Terapeuta Pendente</h4>
              <p className="text-xs text-amber-700 font-medium mt-0.5">
                Existe{pendingTherapistsCount === 1 ? ' um cadastro de terapeuta' : `m ${pendingTherapistsCount} cadastros de terapeutas`} aguardando aprovação administrativa.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-500/10 px-4 py-2 rounded-xl group-hover:bg-amber-500/20 transition-all">
            Analisar Agora <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          {
            label: 'Pacientes Ativos',
            value: stats.activePatients,
            icon: Users,
            color: 'indigo',
            badge: 'Total',
            sub: null,
          },
          {
            label: 'Sessões / Mês',
            value: stats.monthlySessions,
            icon: Calendar,
            color: 'emerald',
            badge: 'Mês Atual',
            sub: null,
          },
          {
            label: 'Receita Mensal',
            value: `R$ ${stats.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
            icon: CreditCard,
            color: 'amber',
            badge: 'Mês Atual',
            sub: null,
          },
          {
            label: 'Leads Pendentes',
            value: stats.pendingLeads,
            icon: Target,
            color: 'rose',
            badge: 'Ações Necessárias',
            sub: null,
          },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-7 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-300 group">
            <div className="flex justify-between items-start mb-5">
              <div className={cn(
                "w-13 h-13 w-14 h-14 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110",
                stat.color === 'indigo' ? "bg-indigo-50 text-indigo-600" :
                stat.color === 'emerald' ? "bg-emerald-50 text-emerald-600" :
                stat.color === 'amber' ? "bg-amber-50 text-amber-600" :
                "bg-rose-50 text-rose-600"
              )}>
                <stat.icon className="w-7 h-7" />
              </div>
              <span className="px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-slate-50 text-slate-400">
                {stat.badge}
              </span>
            </div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
            <h3 className="text-3xl font-black text-slate-900">{stat.value}</h3>
          </div>
        ))}
      </div>

      {/* Second row: attendance rate + birthday */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Attendance Rate */}
        <div className="bg-white p-7 rounded-[2rem] border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
                <Percent className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900">Taxa de Comparecimento</h3>
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-50 px-3 py-1 rounded-lg">
              Mês Atual
            </span>
          </div>
          <div className="flex items-end gap-4">
            <div className="relative w-24 h-24">
              <svg viewBox="0 0 36 36" className="w-24 h-24 -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f1f5f9" strokeWidth="3" />
                <circle
                  cx="18" cy="18" r="15.9" fill="none"
                  stroke="#7c3aed"
                  strokeWidth="3"
                  strokeDasharray={`${attendanceRate} ${100 - attendanceRate}`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xl font-black text-slate-900">{attendanceRate}%</span>
              </div>
            </div>
            <div className="space-y-2 flex-1">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Realizadas</span>
                <span className="font-bold text-slate-900">{stats.completedSessions}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Total Agendadas</span>
                <span className="font-bold text-slate-900">{stats.totalSessions}</span>
              </div>
              <div className="h-px bg-slate-100 my-1" />
              <p className="text-xs text-slate-400">
                {attendanceRate >= 80 ? '✅ Excelente adesão dos pacientes!' :
                 attendanceRate >= 60 ? '🟡 Adesão razoável — considere lembretes.' :
                 '🔴 Atenção: taxa de faltas alta.'}
              </p>
            </div>
          </div>
        </div>

        {/* Birthday Widget */}
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-7 rounded-[2rem] border border-amber-100 shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
              <Cake className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900">Aniversariantes do Mês</h3>
          </div>
          {birthdayPatients.length === 0 ? (
            <div className="flex items-center justify-center h-16 text-sm text-slate-400 font-medium">
              Nenhum aniversariante nos próximos dias
            </div>
          ) : (
            <div className="space-y-3">
              {birthdayPatients.map((p, i) => {
                const [, , day] = p.birth_date.split('-');
                const isToday = p.birth_date.split('-')[2] === getTodayBRT().split('-')[2] &&
                                p.birth_date.split('-')[1] === getTodayBRT().split('-')[1];
                return (
                  <div key={i} className="flex items-center justify-between bg-white/70 rounded-2xl px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 font-black text-sm flex items-center justify-center">
                        {parseInt(day)}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 text-sm">{p.name}</p>
                        {isToday && (
                          <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">🎂 Hoje!</p>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-slate-400 font-medium">dia {parseInt(day)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Flow Chart */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-indigo-600" /> Fluxo de Atendimentos
            </h3>
            <div className="flex gap-1 bg-slate-50 p-1 rounded-xl">
              {([7, 30] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setChartPeriod(p)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                    chartPeriod === p
                      ? "bg-white text-indigo-600 shadow-sm"
                      : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  {p === 7 ? '7 dias' : '30 dias'}
                </button>
              ))}
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.12} />
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  dy={10}
                  interval={chartPeriod === 30 ? 4 : 0}
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#4f46e5"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorValue)"
                  dot={{ fill: '#4f46e5', strokeWidth: 0, r: 4 }}
                  activeDot={{ r: 6, fill: '#4f46e5' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Today's Sessions */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <Clock className="w-6 h-6 text-indigo-600" /> Sessões de Hoje
            </h3>
            <Link
              to="/admin/agenda"
              className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              Ver agenda completa <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="space-y-3 flex-1">
            {upcomingSessions.map((session, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-4 bg-slate-50/70 rounded-2xl border border-transparent hover:border-indigo-100 hover:bg-white transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-white border border-slate-100 flex items-center justify-center font-black text-slate-700 group-hover:text-indigo-600 transition-colors shadow-sm text-xs">
                    {new Date(session.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">{session.patients?.name || 'Paciente'}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{session.type || 'Consulta'}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('open-internal-chat', {
                      detail: { contactId: 'atendimento', name: 'Recepção / Agenda', role: 'atendimento' }
                    }));
                  }}
                  title="Enviar mensagem para a Recepção"
                  className="p-2.5 bg-white text-slate-400 rounded-xl hover:text-indigo-600 hover:bg-indigo-50 shadow-sm border border-slate-100 transition-all"
                >
                  <MessageSquare className="w-4 h-4" />
                </button>
              </div>
            ))}
            {upcomingSessions.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2 py-10">
                <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                <p className="font-medium">Agenda livre hoje!</p>
                <Link to="/admin/agenda" className="text-xs text-indigo-600 font-bold hover:underline">
                  Ver próximos agendamentos →
                </Link>
              </div>
            )}
          </div>
          {upcomingSessions.length > 0 && (
            <Link
              to="/admin/agenda"
              className="flex items-center justify-center gap-2 w-full py-4 mt-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all"
            >
              Ver Agenda Completa <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
