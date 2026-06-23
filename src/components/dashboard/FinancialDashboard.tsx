import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ArrowUpRight, ArrowDownRight, TrendingUp, Loader2 } from 'lucide-react';
import { supabase } from '@/src/lib/supabase';
import { cn } from '@/src/lib/utils';

export default function FinancialDashboard() {
  const [stats, setStats] = useState({
    gross: 0,
    commissions: 0,
    overdue: 0
  });
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // 1. Faturamento Bruto (Soma de pagos)
      const { data: payments } = await supabase.from('payments').select('amount, status, created_at, patients(name)');
      const gross = payments?.filter(p => p.status === 'paid').reduce((acc, curr) => acc + Number(curr.amount), 0) || 0;
      
      // 2. Inadimplência (Soma de vencidos)
      const overdue = payments?.filter(p => p.status === 'overdue').reduce((acc, curr) => acc + Number(curr.amount), 0) || 0;

      // 3. Comissões Devidas
      const { data: commissions } = await supabase.from('commission_payouts').select('amount').eq('status', 'pending');
      const totalCommissions = commissions?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0;

      setStats({ gross, commissions: totalCommissions, overdue });
      
      // 4. Últimas Transações
      const lastTx = (payments || []).slice(0, 5).map((p: any) => ({
        patient: (Array.isArray(p.patients) ? p.patients[0]?.name : p.patients?.name) || 'Paciente',
        value: `R$ ${Number(p.amount).toLocaleString('pt-BR')}`,
        status: p.status === 'paid' ? 'Pago' : p.status === 'overdue' ? 'Vencido' : 'Pendente',
        date: new Date(p.created_at).toLocaleDateString('pt-BR')
      }));
      setTransactions(lastTx);

    } catch (error) {
      console.error('Erro ao buscar dados financeiros:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
          <p className="text-sm font-medium text-slate-500">Faturamento Bruto</p>
          <div className="flex items-end gap-3 mt-4">
            <h3 className="text-3xl font-bold text-slate-900">R$ {stats.gross.toLocaleString('pt-BR')}</h3>
            <span className="flex items-center text-xs font-bold text-emerald-600 mb-1">
              <ArrowUpRight className="w-4 h-4" /> 100%
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-2">Total histórico</p>
        </div>

        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
          <p className="text-sm font-medium text-slate-500">Comissões Devidas</p>
          <div className="flex items-end gap-3 mt-4">
            <h3 className="text-3xl font-bold text-slate-900">R$ {stats.commissions.toLocaleString('pt-BR')}</h3>
            <span className="flex items-center text-xs font-bold text-amber-600 mb-1">
              <TrendingUp className="w-4 h-4" /> Pendente
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-2">A pagar para terapeutas</p>
        </div>

        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
          <p className="text-sm font-medium text-slate-500">Inadimplência</p>
          <div className="flex items-end gap-3 mt-4">
            <h3 className="text-3xl font-bold text-slate-900">R$ {stats.overdue.toLocaleString('pt-BR')}</h3>
            <span className="flex items-center text-xs font-bold text-rose-600 mb-1">
              <ArrowDownRight className="w-4 h-4" /> Alerta
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-2">Faturas em atraso</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-lg font-bold">Fluxo de Caixa Mensal</h4>
            <button onClick={fetchData} className="p-2 hover:bg-slate-50 rounded-lg">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4 text-indigo-600" />}
            </button>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={[{name: 'Mai', value: stats.gross}]}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip />
                <Area type="monotone" dataKey="value" stroke="#4f46e5" strokeWidth={3} fill="#4f46e520" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-bold">Últimas Transações</h4>
            <button className="text-sm font-bold text-indigo-600 hover:underline">Ver tudo</button>
          </div>
          <div className="space-y-4">
            {transactions.map((t, i) => (
              <div key={i} className="flex items-center justify-between p-4 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 font-bold">{t.patient.charAt(0)}</div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{t.patient}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{t.date}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-900">{t.value}</p>
                  <span className={cn(
                    "text-[10px] font-bold px-2 py-0.5 rounded-full",
                    t.status === 'Pago' ? "bg-emerald-50 text-emerald-600" : 
                    t.status === 'Vencido' ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-600"
                  )}>{t.status}</span>
                </div>
              </div>
            ))}
            {transactions.length === 0 && (
              <div className="py-10 text-center text-slate-400 font-medium">Nenhuma transação encontrada.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
