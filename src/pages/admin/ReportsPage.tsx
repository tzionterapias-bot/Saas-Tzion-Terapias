import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Download, Filter, TrendingUp, Users, Calendar, DollarSign, FileText } from 'lucide-react';

const occupancyData = [
  { name: 'Dra. Ana', value: 85 },
  { name: 'Dr. Roberto', value: 65 },
  { name: 'Dra. Cláudia', value: 92 },
  { name: 'Dr. Marcos', value: 45 },
];

const conversionData = [
  { name: 'Leads', value: 120 },
  { name: 'Triagens', value: 85 },
  { name: 'Inícios', value: 42 },
];

const COLORS = ['#4f46e5', '#818cf8', '#c7d2fe', '#e2e8f0'];

export default function ReportsPage() {
  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Central de Relatórios</h2>
          <p className="text-slate-500 font-medium">Análise detalhada de performance e produtividade clínica.</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition-all">
            <Filter className="w-4 h-4" /> Filtrar Período
          </button>
          <button className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all">
            <Download className="w-4 h-4" /> Exportar PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Occupancy Chart */}
        <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm space-y-8">
          <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" /> Taxa de Ocupação por Profissional
          </h3>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={occupancyData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: '#475569', fontSize: 12, fontWeight: 700}} width={100} />
                <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                <Bar dataKey="value" fill="#4f46e5" radius={[0, 10, 10, 0]} barSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Conversion Funnel */}
        <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm space-y-8">
          <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-600" /> Funil de Conversão (Novos Pacientes)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 items-center">
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={conversionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {conversionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-4">
               {conversionData.map((item, i) => (
                 <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                       <div className="w-3 h-3 rounded-full" style={{backgroundColor: COLORS[i % COLORS.length]}} />
                       <span className="text-sm font-bold text-slate-600">{item.name}</span>
                    </div>
                    <span className="font-black text-slate-900">{item.value}</span>
                 </div>
               ))}
               <div className="pt-4 border-t border-slate-100">
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Conversão Final</p>
                  <p className="text-2xl font-black text-indigo-600">35%</p>
               </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-900 text-white rounded-[3rem] p-10 shadow-2xl relative overflow-hidden">
         <div className="relative z-10">
            <h3 className="text-2xl font-bold mb-6">Métricas de Performance Financeira</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
               <div className="space-y-2">
                  <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Ticket Médio por Sessão</p>
                  <p className="text-4xl font-black text-indigo-400">R$ 158,00</p>
                  <span className="text-xs text-emerald-400">+4% em relação ao mês anterior</span>
               </div>
               <div className="space-y-2">
                  <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Lifetime Value (LTV)</p>
                  <p className="text-4xl font-black text-white">R$ 4.250,00</p>
                  <span className="text-xs text-indigo-300">Média de 26 sessões por paciente</span>
               </div>
               <div className="space-y-2">
                  <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Taxa de Churn</p>
                  <p className="text-4xl font-black text-rose-400">2.4%</p>
                  <span className="text-xs text-slate-500">Abaixo da média do setor (5%)</span>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
