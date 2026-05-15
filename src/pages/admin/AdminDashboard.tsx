import React from 'react';
import { TrendingUp, Users, Calendar, DollarSign, ArrowUpRight, ArrowDownRight, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { cn } from '@/src/lib/utils';

const data = [
  { name: 'Seg', sessões: 12, receita: 1800 },
  { name: 'Ter', sessões: 18, receita: 2700 },
  { name: 'Qua', sessões: 15, receita: 2250 },
  { name: 'Qui', sessões: 20, receita: 3000 },
  { name: 'Sex', sessões: 14, receita: 2100 },
];

import { useNavigate } from 'react-router-dom';

export default function AdminDashboard() {
  const navigate = useNavigate();
  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Painel Executivo</h2>
          <p className="text-slate-500 font-medium">Visão geral do desempenho da sua clínica hoje.</p>
        </div>
        <div className="flex items-center gap-3 p-1 bg-white rounded-2xl border border-slate-200 shadow-sm">
           <button className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-bold transition-all">Hoje</button>
           <button className="px-4 py-2 bg-white text-slate-400 rounded-xl text-xs font-bold hover:text-slate-600 transition-all">Esta Semana</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Faturamento Mensal', value: 'R$ 42.850', color: 'indigo', icon: DollarSign, trend: '+12.5%' },
          { label: 'Pacientes Ativos', value: '158', color: 'emerald', icon: Users, trend: '+8' },
          { label: 'Sessões Realizadas', value: '24', color: 'sky', icon: Calendar, trend: 'Hoje' },
          { label: 'Taxa de Retenção', value: '94%', color: 'rose', icon: TrendingUp, trend: '+2%' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all">
            <div className="flex items-start justify-between mb-4">
              <div className={stat.color === 'indigo' ? "p-3 bg-indigo-50 text-indigo-600 rounded-2xl" : stat.color === 'emerald' ? "p-3 bg-emerald-50 text-emerald-600 rounded-2xl" : stat.color === 'sky' ? "p-3 bg-sky-50 text-sky-600 rounded-2xl" : "p-3 bg-rose-50 text-rose-600 rounded-2xl"}>
                <stat.icon className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">{stat.trend}</span>
            </div>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
            <h4 className="text-3xl font-black text-slate-900 mt-1">{stat.value}</h4>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm space-y-8">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-slate-900">Desempenho Semanal</h3>
            <div className="flex items-center gap-6">
               <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-indigo-600" />
                  <span className="text-xs font-bold text-slate-500 uppercase">Receita (R$)</span>
               </div>
            </div>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorRec" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 700}} dy={10} />
                <YAxis hide />
                <Tooltip 
                  contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)'}}
                />
                <Area type="monotone" dataKey="receita" stroke="#4f46e5" strokeWidth={4} fillOpacity={1} fill="url(#colorRec)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-slate-900 p-10 rounded-[3rem] text-white space-y-8 relative overflow-hidden">
           <div className="relative z-10 space-y-8">
              <h3 className="text-xl font-bold">Alertas Críticos</h3>
              <div className="space-y-4">
                 {[
                   { msg: '3 Faturas vencem amanhã', icon: AlertCircle, color: 'text-amber-400', path: '/admin/financeiro' },
                   { msg: 'Estoque de insumos baixo', icon: AlertCircle, color: 'text-rose-400', path: '/admin/insumos' },
                   { msg: 'Google Meet API conectada', icon: CheckCircle2, color: 'text-emerald-400', path: '/admin/configuracoes' },
                 ].map((alert, i) => (
                   <div 
                     key={i} 
                     onClick={() => navigate(alert.path)}
                     className="flex items-center gap-4 p-5 bg-white/5 rounded-2xl border border-white/5 group hover:bg-white/10 transition-all cursor-pointer"
                   >
                      <alert.icon className={cn("w-5 h-5", alert.color)} />
                      <p className="text-sm font-medium text-slate-300">{alert.msg}</p>
                   </div>
                 ))}
              </div>
              <div className="pt-4">
                 <button 
                   onClick={() => navigate('/admin/relatorios')}
                   className="w-full py-4 bg-indigo-600 rounded-2xl font-bold hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-900/50"
                 >
                   Ver Central de Relatórios
                 </button>
              </div>
           </div>
           <div className="absolute bottom-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl translate-y-1/2 translate-x-1/2" />
        </div>
      </div>

      <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm space-y-8">
         <h3 className="text-xl font-bold text-slate-900">Agenda de Hoje</h3>
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { time: '14:00', patient: 'João Oliveira', therapist: 'Dra. Ana Silva', status: 'Em andamento' },
              { time: '15:00', patient: 'Maria Santos', therapist: 'Dra. Ana Silva', status: 'A seguir' },
              { time: '16:00', patient: 'Pedro Souza', therapist: 'Dra. Ana Silva', status: 'Agendado' },
              { time: '17:00', patient: 'Carla Dias', therapist: 'Dra. Ana Silva', status: 'Agendado' },
            ].map((appt, i) => (
              <div key={i} className="p-6 bg-slate-50 rounded-3xl border border-slate-100 flex flex-col justify-between group hover:bg-white hover:border-indigo-100 hover:shadow-lg transition-all cursor-pointer">
                 <div className="space-y-1">
                    <span className="text-2xl font-black text-indigo-600">{appt.time}</span>
                    <p className="font-bold text-slate-900 text-lg leading-tight">{appt.patient}</p>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">{appt.therapist}</p>
                 </div>
                 <div className="mt-6 flex items-center gap-2">
                    <div className={cn("w-2 h-2 rounded-full animate-pulse", appt.status === 'Em andamento' ? 'bg-indigo-500' : 'bg-slate-300')} />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{appt.status}</span>
                 </div>
              </div>
            ))}
         </div>
      </div>
    </div>
  );
}
