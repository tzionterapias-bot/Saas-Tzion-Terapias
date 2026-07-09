import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, Legend
} from 'recharts';
import { 
  Download, Filter, TrendingUp, Users, Calendar, DollarSign, 
  FileText, ArrowUpRight, Zap, Target, Star, ChevronDown, Smile, Meh, Frown, Loader2, ArrowDownRight
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { supabase } from '@/src/lib/supabase';

const COLORS = ['#4f46e5', '#818cf8', '#c7d2fe', '#e2e8f0'];
const NPS_COLORS = ['#10b981', '#f59e0b', '#ef4444'];
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [filterMonth, setFilterMonth] = useState<number>(new Date().getMonth());
  const [filterYear, setFilterYear] = useState<number>(new Date().getFullYear());

  // KPIs Data
  const [revenue, setRevenue] = useState(0);
  const [expenses, setExpenses] = useState(0);
  const [newPatients, setNewPatients] = useState(0);
  const [attendanceRate, setAttendanceRate] = useState(0);
  
  // Charts Data
  const [financialYearData, setFinancialYearData] = useState<any[]>([]);
  const [therapistProductivity, setTherapistProductivity] = useState<any[]>([]);
  const [patientsSource, setPatientsSource] = useState<any[]>([]);
  
  // NPS Data
  const [globalNpsScore, setGlobalNpsScore] = useState<number>(0);
  const [npsDistribution, setNpsDistribution] = useState<any[]>([]);
  const [therapistsRank, setTherapistsRank] = useState<any[]>([]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const startOfMonth = new Date(filterYear, filterMonth, 1).toISOString();
      const endOfMonth = new Date(filterYear, filterMonth + 1, 0, 23, 59, 59).toISOString();
      const startOfYear = new Date(filterYear, 0, 1).toISOString();
      const endOfYear = new Date(filterYear, 11, 31, 23, 59, 59).toISOString();

      // 1. Fetch Payments (Mês atual para KPI e Ano todo para gráfico)
      const { data: paymentsData } = await supabase
        .from('payments')
        .select('amount, type, status, created_at')
        .gte('created_at', startOfYear)
        .lte('created_at', endOfYear);

      // 2. Fetch Appointments (Mês atual)
      const { data: appointmentsData } = await supabase
        .from('appointments')
        .select('status, therapist_id, therapists(name)')
        .gte('start_time', startOfMonth)
        .lte('start_time', endOfMonth);

      // 3. Fetch All Patients (Para a base total) e filtrar no JS para Novos Pacientes
      const { data: patientsData } = await supabase
        .from('patients')
        .select('id, created_at, status');

      // 4. Fetch NPS
      const { data: npsData } = await supabase
        .from('nps_feedbacks')
        .select('score, created_at, appointments(therapist_id, therapists(name))')
        .gte('created_at', startOfMonth)
        .lte('created_at', endOfMonth);

      // --- Process KPIs ---
      let currentMonthIncome = 0;
      let currentMonthExpense = 0;

      if (paymentsData) {
        paymentsData.forEach(p => {
          const d = new Date(p.created_at);
          if (d.getMonth() === filterMonth && d.getFullYear() === filterYear && p.status === 'paid') {
            if (p.type === 'income') currentMonthIncome += Number(p.amount);
            if (p.type === 'expense') currentMonthExpense += Number(p.amount);
          }
        });
      }
      setRevenue(currentMonthIncome);
      setExpenses(currentMonthExpense);

      let novosMês = 0;
      if (patientsData) {
         patientsData.forEach(p => {
            const d = new Date(p.created_at);
            if (d.getMonth() === filterMonth && d.getFullYear() === filterYear) {
               novosMês++;
            }
         });
      }
      setNewPatients(novosMês);

      let totalAppts = 0;
      let completedAppts = 0;
      const tMap: Record<string, { name: string, total: number, completed: number }> = {};

      if (appointmentsData) {
        appointmentsData.forEach(a => {
           totalAppts++;
           if (a.status === 'completed') completedAppts++;
           
           if (a.therapists && a.therapist_id) {
              const tid = a.therapist_id;
              if (!tMap[tid]) tMap[tid] = { name: (a.therapists as any).name, total: 0, completed: 0 };
              tMap[tid].total++;
              if (a.status === 'completed') tMap[tid].completed++;
           }
        });
      }
      setAttendanceRate(totalAppts > 0 ? Math.round((completedAppts / totalAppts) * 100) : 0);

      // --- Process Therapist Productivity Chart ---
      const prodData = Object.values(tMap).map(t => ({
        name: t.name,
        'Agendadas': t.total,
        'Realizadas': t.completed,
        'Taxa': Math.round((t.completed / t.total) * 100)
      })).sort((a, b) => b['Realizadas'] - a['Realizadas']).slice(0, 8); // top 8
      setTherapistProductivity(prodData);

      // --- Process Financial Year Chart ---
      const yearStats = Array.from({ length: 12 }, (_, i) => ({ name: MONTHS[i].substring(0, 3), Receitas: 0, Despesas: 0 }));
      if (paymentsData) {
         paymentsData.forEach(p => {
            if (p.status === 'paid') {
               const m = new Date(p.created_at).getMonth();
               if (p.type === 'income') yearStats[m].Receitas += Number(p.amount);
               if (p.type === 'expense') yearStats[m].Despesas += Number(p.amount);
            }
         });
      }
      setFinancialYearData(yearStats);

      // --- Process NPS ---
      if (npsData && npsData.length > 0) {
        let promoters = 0;
        let passives = 0;
        let detractors = 0;
        const npsTherapistMap: Record<string, { name: string, totalScore: number, count: number }> = {};

        npsData.forEach((fb: any) => {
          const score = fb.score;
          if (score >= 9) promoters++;
          else if (score >= 7) passives++;
          else detractors++;

          const therapistInfo = fb.appointments?.therapists;
          if (therapistInfo) {
            const tId = fb.appointments.therapist_id;
            if (!npsTherapistMap[tId]) {
              npsTherapistMap[tId] = { name: therapistInfo.name, totalScore: 0, count: 0 };
            }
            npsTherapistMap[tId].totalScore += score;
            npsTherapistMap[tId].count += 1;
          }
        });

        const total = npsData.length;
        const nps = Math.round(((promoters / total) - (detractors / total)) * 100);
        setGlobalNpsScore(nps);

        setNpsDistribution([
          { name: 'Satisfeitos (9-10)', value: promoters },
          { name: 'Indiferentes (7-8)', value: passives },
          { name: 'Insatisfeitos (0-6)', value: detractors }
        ]);

        const rankings = Object.values(npsTherapistMap).map(t => ({
          name: t.name,
          avg: (t.totalScore / t.count).toFixed(1),
          count: t.count
        })).sort((a, b) => Number(b.avg) - Number(a.avg));
        setTherapistsRank(rankings);
      } else {
        setGlobalNpsScore(0);
        setNpsDistribution([
          { name: 'Satisfeitos (9-10)', value: 1 },
          { name: 'Indiferentes (7-8)', value: 0 },
          { name: 'Insatisfeitos (0-6)', value: 0 }
        ]);
        setTherapistsRank([]);
      }
      
      // --- Pacientes Status (Active vs Others) ---
      let ativos = 0;
      let inativos = 0;
      if (patientsData) {
         patientsData.forEach(p => {
            if (p.status === 'active') ativos++;
            else inativos++;
         });
      }
      setPatientsSource([
         { name: 'Ativos', value: ativos || 1 },
         { name: 'Inativos/Alta', value: inativos || 0 }
      ]);

    } catch (error) {
      console.error('Error fetching reports data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filterMonth, filterYear]);

  const years = Array.from({length: 5}, (_, i) => new Date().getFullYear() - i);

  return (
    <div className="space-y-10 animate-in fade-in duration-700 pb-20">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight dark:text-white">Analytics & Relatórios</h2>
          <p className="text-slate-500 font-medium text-lg dark:text-slate-400">Inteligência de dados para o crescimento da clínica.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-2 shadow-sm">
             <select 
                value={filterMonth} 
                onChange={(e) => setFilterMonth(Number(e.target.value))}
                className="bg-transparent border-none text-slate-700 dark:text-slate-200 font-bold focus:ring-0 cursor-pointer"
             >
                {MONTHS.map((m, i) => <option key={i} value={i} className="dark:bg-slate-800">{m}</option>)}
             </select>
             <select 
                value={filterYear} 
                onChange={(e) => setFilterYear(Number(e.target.value))}
                className="bg-transparent border-none text-slate-700 dark:text-slate-200 font-bold focus:ring-0 cursor-pointer pl-0"
             >
                {years.map((y) => <option key={y} value={y} className="dark:bg-slate-800">{y}</option>)}
             </select>
          </div>
          <button onClick={() => window.print()} className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 shadow-xl shadow-indigo-100 dark:shadow-none transition-all">
            <Download className="w-5 h-5" /> Exportar PDF
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Faturamento Bruto', value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(revenue), icon: DollarSign, color: 'emerald' },
          { label: 'Novos Pacientes', value: loading ? '...' : `+${newPatients}`, icon: Users, color: 'indigo' },
          { label: 'Comparecimento', value: `${attendanceRate}%`, icon: Target, color: 'blue' },
          { label: 'NPS Global', value: loading ? '...' : globalNpsScore, icon: Star, color: 'amber' },
        ].map((kpi, i) => (
          <div key={i} className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-xl transition-all group">
            <div className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center mb-6",
              kpi.color === 'indigo' ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400" :
              kpi.color === 'amber' ? "bg-amber-50 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400" :
              kpi.color === 'emerald' ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400" :
              "bg-blue-50 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400"
            )}>
              <kpi.icon className="w-6 h-6" />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{kpi.label}</p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white">{kpi.value}</h3>
          </div>
        ))}
      </div>

      {/* Crescimento Financeiro */}
      <div className="bg-white dark:bg-slate-800 p-10 rounded-[3rem] border border-slate-100 dark:border-slate-700 shadow-sm space-y-8">
         <div className="flex items-center justify-between">
         <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-emerald-500" /> Evolução Financeira ({filterYear})
         </h3>
         </div>
         <div className="h-[300px] w-full">
         <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={financialYearData}>
               <defs>
               <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
               </linearGradient>
               <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
               </linearGradient>
               </defs>
               <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" className="dark:stroke-slate-700" />
               <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} dy={10} />
               <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} tickFormatter={(val) => `R$ ${val/1000}k`} />
               <Tooltip 
                  formatter={(value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)}
                  contentStyle={{borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)', padding: '16px'}} 
               />
               <Legend verticalAlign="top" height={36}/>
               <Area type="monotone" dataKey="Receitas" stroke="#10b981" strokeWidth={4} fillOpacity={1} fill="url(#revGrad)" />
               <Area type="monotone" dataKey="Despesas" stroke="#ef4444" strokeWidth={4} fillOpacity={1} fill="url(#expGrad)" />
            </AreaChart>
         </ResponsiveContainer>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Therapist Productivity Chart */}
        <div className="bg-white dark:bg-slate-800 p-10 rounded-[3rem] border border-slate-100 dark:border-slate-700 shadow-sm space-y-8">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="w-6 h-6 text-indigo-600 dark:text-indigo-400" /> Produtividade por Terapeuta
            </h3>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 dark:bg-slate-700 px-3 py-1 rounded-full border border-slate-100 dark:border-slate-600">Mês Atual</span>
          </div>
          <div className="h-[300px] w-full">
            {therapistProductivity.length > 0 ? (
               <ResponsiveContainer width="100%" height="100%">
               <BarChart data={therapistProductivity} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" className="dark:stroke-slate-700" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 700}} width={100} />
                  <Tooltip cursor={{fill: 'transparent'}} contentStyle={{borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)', padding: '16px'}} />
                  <Legend />
                  <Bar dataKey="Agendadas" fill="#e2e8f0" radius={[0, 4, 4, 0]} barSize={12} label={{ position: 'right', fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }} />
                  <Bar dataKey="Realizadas" fill="#4f46e5" radius={[0, 4, 4, 0]} barSize={12} label={{ position: 'right', fill: '#4f46e5', fontSize: 10, fontWeight: 'bold' }} />
               </BarChart>
               </ResponsiveContainer>
            ) : (
               <div className="flex h-full items-center justify-center text-slate-400 font-medium text-sm">Sem dados para este mês.</div>
            )}
          </div>
        </div>

        {/* Patients Active/Inactive */}
        <div className="bg-white dark:bg-slate-800 p-10 rounded-[3rem] border border-slate-100 dark:border-slate-700 shadow-sm space-y-8">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-blue-500" /> Status da Base de Pacientes
            </h3>
          </div>
          <div className="flex flex-col md:flex-row items-center gap-8">
             <div className="w-[200px] h-[200px]">
               <ResponsiveContainer width="100%" height="100%">
                 <PieChart>
                   <Pie
                     data={patientsSource}
                     cx="50%"
                     cy="50%"
                     innerRadius={60}
                     outerRadius={80}
                     paddingAngle={5}
                     dataKey="value"
                   >
                     <Cell fill="#3b82f6" />
                     <Cell fill="#cbd5e1" />
                   </Pie>
                   <Tooltip />
                 </PieChart>
               </ResponsiveContainer>
             </div>
             <div className="space-y-4 flex-1">
                {patientsSource.map((p, i) => (
                   <div key={i} className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-2 last:border-0">
                      <div className="flex items-center gap-2">
                         <div className={cn("w-3 h-3 rounded-full", i === 0 ? "bg-blue-500" : "bg-slate-300")} />
                         <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{p.name}</span>
                      </div>
                      <span className="font-black text-slate-900 dark:text-white">{p.value}</span>
                   </div>
                ))}
             </div>
          </div>
        </div>
      </div>

      {/* Centro de Avaliação de Profissionais (NPS) */}
      <div className="bg-white dark:bg-slate-800 p-10 rounded-[3rem] border border-slate-100 dark:border-slate-700 shadow-sm space-y-8">
        <div>
           <h3 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2 mb-2">
             <Star className="w-7 h-7 text-amber-400 fill-amber-400" /> Centro de Avaliação (NPS)
           </h3>
           <p className="text-slate-500 font-medium">Monitoramento de qualidade no mês de {MONTHS[filterMonth]}/{filterYear}.</p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
           <div className="lg:col-span-5 h-[300px] flex flex-col justify-center">
              {npsDistribution.reduce((a, b) => a + b.value, 0) > 0 ? (
                 <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                       <Pie
                         data={npsDistribution}
                         cx="50%"
                         cy="50%"
                         innerRadius={80}
                         outerRadius={110}
                         paddingAngle={5}
                         dataKey="value"
                       >
                         {npsDistribution.map((entry, index) => (
                           <Cell key={`cell-${index}`} fill={NPS_COLORS[index % NPS_COLORS.length]} />
                         ))}
                       </Pie>
                       <Tooltip cursor={{fill: 'transparent'}} contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)', padding: '16px'}} />
                    </PieChart>
                 </ResponsiveContainer>
              ) : (
                 <div className="flex h-full items-center justify-center text-slate-400">Sem avaliações no período.</div>
              )}
              <div className="flex items-center justify-center gap-6 mt-4 flex-wrap">
                 <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-500" /> <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Satisfeitos</span></div>
                 <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-amber-500" /> <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Indiferentes</span></div>
                 <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-rose-500" /> <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Insatisfeitos</span></div>
              </div>
           </div>

           <div className="lg:col-span-7 bg-slate-50 dark:bg-slate-900/50 rounded-[2rem] p-8 border border-slate-100 dark:border-slate-800">
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-widest mb-6">Ranking de Desempenho</h4>
              
              {loading ? (
                 <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-indigo-600" /></div>
              ) : therapistsRank.length > 0 ? (
                 <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {therapistsRank.map((t, i) => (
                       <div key={i} className="flex items-center justify-between bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                          <div className="flex items-center gap-4">
                             <div className={cn("w-8 h-8 rounded-full flex items-center justify-center font-black text-sm", i === 0 ? "bg-amber-100 text-amber-600 dark:bg-amber-500/20" : "bg-slate-100 text-slate-400 dark:bg-slate-700")}>
                               {i + 1}
                             </div>
                             <div>
                               <p className="font-bold text-slate-900 dark:text-white">{t.name}</p>
                               <p className="text-xs text-slate-500 font-medium">{t.count} avaliações recebidas</p>
                             </div>
                          </div>
                          <div className="flex items-center gap-3">
                             <div className="text-right">
                               <p className="text-xl font-black text-indigo-600 dark:text-indigo-400">{t.avg}</p>
                               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nota Média</p>
                             </div>
                             {Number(t.avg) >= 9 ? <Smile className="w-8 h-8 text-emerald-400" /> : 
                              Number(t.avg) >= 7 ? <Meh className="w-8 h-8 text-amber-400" /> : 
                              <Frown className="w-8 h-8 text-rose-400" />}
                          </div>
                       </div>
                    ))}
                 </div>
              ) : (
                 <div className="py-10 text-center space-y-3">
                    <Star className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
                    <p className="text-slate-500 font-medium text-sm">Nenhuma avaliação recebida ainda neste mês.</p>
                 </div>
              )}
           </div>
        </div>
      </div>
    </div>
  );
}
