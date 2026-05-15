import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { ArrowUpRight, ArrowDownRight, TrendingUp, DollarSign, Wallet, CreditCard } from 'lucide-react';

const data = [
  { name: 'Jan', value: 4000 },
  { name: 'Fev', value: 3000 },
  { name: 'Mar', value: 5000 },
  { name: 'Abr', value: 4500 },
  { name: 'Mai', value: 6000 },
];

export default function FinancialDashboard() {
  return (
    <div className="space-y-8">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <DollarSign className="w-16 h-16 text-indigo-600" />
          </div>
          <p className="text-sm font-medium text-slate-500">Faturamento Bruto</p>
          <div className="flex items-end gap-3 mt-4">
            <h3 className="text-3xl font-bold text-slate-900">R$ 14.250</h3>
            <span className="flex items-center text-xs font-bold text-emerald-600 mb-1">
              <ArrowUpRight className="w-4 h-4" /> 8.4%
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-2">vs. mês anterior</p>
        </div>

        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Wallet className="w-16 h-16 text-orange-600" />
          </div>
          <p className="text-sm font-medium text-slate-500">Comissões Devidas</p>
          <div className="flex items-end gap-3 mt-4">
            <h3 className="text-3xl font-bold text-slate-900">R$ 4.890</h3>
            <span className="flex items-center text-xs font-bold text-amber-600 mb-1">
              <TrendingUp className="w-4 h-4" /> 12.1%
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-2">A pagar para terapeutas</p>
        </div>

        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <CreditCard className="w-16 h-16 text-rose-600" />
          </div>
          <p className="text-sm font-medium text-slate-500">Inadimplência</p>
          <div className="flex items-end gap-3 mt-4">
            <h3 className="text-3xl font-bold text-slate-900">R$ 1.200</h3>
            <span className="flex items-center text-xs font-bold text-rose-600 mb-1">
              <ArrowDownRight className="w-4 h-4" /> 2.5%
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-2">3 faturas em atraso</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Revenue Chart */}
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
          <h4 className="text-lg font-bold mb-6">Evolução do Faturamento</h4>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <Tooltip 
                  contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                />
                <Area type="monotone" dataKey="value" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-bold">Últimas Cobranças (Asaas)</h4>
            <button className="text-sm font-bold text-indigo-600 hover:underline">Ver tudo</button>
          </div>
          <div className="space-y-4">
            {[
              { patient: 'João Oliveira', value: 'R$ 150,00', status: 'Pago', date: 'Hoje' },
              { patient: 'Maria Santos', value: 'R$ 150,00', status: 'Pendente', date: 'Hoje' },
              { patient: 'Ana Costa', value: 'R$ 200,00', status: 'Vencido', date: 'Ontem' },
              { patient: 'Pedro Souza', value: 'R$ 150,00', status: 'Pago', date: 'Ontem' },
            ].map((t, i) => (
              <div key={i} className="flex items-center justify-between p-4 rounded-xl hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 font-bold">
                    {t.patient.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{t.patient}</p>
                    <p className="text-xs text-slate-500">{t.date}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-900">{t.value}</p>
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${
                    t.status === 'Pago' ? 'text-emerald-600' : t.status === 'Pendente' ? 'text-amber-600' : 'text-rose-600'
                  }`}>
                    {t.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
