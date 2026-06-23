import React, { useState, useEffect } from 'react';
import { 
  CreditCard, TrendingUp, TrendingDown, DollarSign, Wallet, ArrowUpRight, ArrowDownRight, Loader2, AlertCircle
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { cn } from '@/src/lib/utils';
import { supabase } from '@/src/lib/supabase';

export default function FinancialView() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    revenue: 0,
    expenses: 0,
    pendingPayments: 0,
    overdue: 0
  });
  const [chartData, setChartData] = useState<any[]>([]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

      // 1. Fetch Monthly Payments
      const { data: payments } = await supabase.from('payments')
        .select('*')
        .gte('due_date', firstDay)
        .lte('due_date', lastDay);

      let revenue = 0;
      let expenses = 0;
      let pending = 0;
      let overdue = 0;

      const todayStr = new Date().toISOString().split('T')[0];

      (payments || []).forEach(p => {
        if (p.type === 'income') {
          if (p.status === 'paid') revenue += Number(p.amount);
          else if (p.status === 'pending') {
            pending += Number(p.amount);
            if (p.due_date < todayStr) overdue += Number(p.amount);
          }
        } else if (p.type === 'expense') {
          if (p.status === 'paid') expenses += Number(p.amount);
        }
      });

      setStats({
        revenue,
        expenses,
        pendingPayments: pending,
        overdue
      });

      // 2. Generate Chart Data (Last 7 Days)
      const last7Days = Array.from({length: 7}, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return d;
      });

      const chartPoints = last7Days.map(date => {
        const dateStr = date.toISOString().split('T')[0];
        const dayLabel = date.toLocaleDateString('pt-BR', { weekday: 'short' });
        
        const dayIncome = (payments || [])
          .filter(p => p.type === 'income' && p.status === 'paid' && p.due_date.startsWith(dateStr))
          .reduce((acc, curr) => acc + Number(curr.amount), 0);
          
        const dayExpense = (payments || [])
          .filter(p => p.type === 'expense' && p.status === 'paid' && p.due_date.startsWith(dateStr))
          .reduce((acc, curr) => acc + Number(curr.amount), 0);

        return { 
          name: dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1), 
          Entradas: dayIncome,
          Saídas: dayExpense
        };
      });
      setChartData(chartPoints);

    } catch (error) {
      console.error('Erro ao buscar estatísticas financeiras:', error);
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
          <h2 className="text-4xl font-black text-slate-900 tracking-tight">Painel Financeiro</h2>
          <p className="text-slate-500 font-medium text-lg">Visão detalhada de fluxo de caixa e inadimplência.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchStats} className="px-5 py-3 bg-white border border-slate-200 rounded-2xl font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm">
            Atualizar Dados
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Receita (Mês)', value: `R$ ${stats.revenue.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, icon: TrendingUp, color: 'emerald', trend: 'Recebido' },
          { label: 'Despesas (Mês)', value: `R$ ${stats.expenses.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, icon: TrendingDown, color: 'rose', trend: 'Pago' },
          { label: 'A Receber', value: `R$ ${stats.pendingPayments.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, icon: Wallet, color: 'indigo', trend: 'Previsto' },
          { label: 'Inadimplência', value: `R$ ${stats.overdue.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, icon: AlertCircle, color: 'amber', trend: 'Atrasado' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all group">
            <div className="flex justify-between items-start mb-6">
              <div className={cn(
                "w-14 h-14 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110",
                stat.color === 'emerald' ? "bg-emerald-50 text-emerald-600" :
                stat.color === 'rose' ? "bg-rose-50 text-rose-600" :
                stat.color === 'indigo' ? "bg-indigo-50 text-indigo-600" :
                "bg-amber-50 text-amber-600"
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

      {/* Chart */}
      <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-emerald-600" /> Fluxo de Caixa (Últimos 7 dias)
          </h3>
          <select className="bg-slate-50 border-none rounded-xl text-xs font-bold p-2 outline-none">
            <option>Últimos 7 dias</option>
          </select>
        </div>
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorEntradas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorSaidas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
              <Tooltip 
                contentStyle={{borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.25)', padding: '20px'}}
              />
              <Area type="monotone" dataKey="Entradas" stroke="#10b981" strokeWidth={4} fillOpacity={1} fill="url(#colorEntradas)" />
              <Area type="monotone" dataKey="Saídas" stroke="#f43f5e" strokeWidth={4} fillOpacity={1} fill="url(#colorSaidas)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
