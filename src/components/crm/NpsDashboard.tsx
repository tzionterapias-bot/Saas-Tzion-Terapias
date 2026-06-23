import React, { useState, useEffect } from 'react';
import { supabase } from '@/src/lib/supabase';
import { Loader2, Heart, TrendingUp, Users, MessageSquare, Star } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell,
  LineChart, Line
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/src/lib/utils';

interface NpsFeedback {
  id: string;
  patient_id: string | null;
  appointment_id: string | null;
  score: number;
  comment: string | null;
  created_at: string;
  patients?: { name: string } | null;
  appointments?: { type?: string | null, therapist_id: string | null, therapists?: { name: string } | null } | null;
}

export default function NpsDashboard() {
  const [feedbacks, setFeedbacks] = useState<NpsFeedback[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNpsData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('nps_feedbacks')
      .select('*, patients(name), appointments(type, therapist_id, therapists(name))')
      .order('created_at', { ascending: false });

    if (data && !error) {
      setFeedbacks(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchNpsData();

    // Setup realtime subscription
    const channel = supabase
      .channel('nps_dashboard_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'nps_feedbacks' }, () => {
        fetchNpsData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading && feedbacks.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-10 h-10 text-rose-500 animate-spin" />
      </div>
    );
  }

  // Cálculos Básicos
  const total = feedbacks.length;
  const avgScore = total > 0 ? feedbacks.reduce((acc, curr) => acc + curr.score, 0) / total : 0;
  
  // Muito Satisfeitos (9-10), Indiferentes (7-8), Insatisfeitos (0-6)
  const promoters = feedbacks.filter(f => f.score >= 9).length;
  const passives = feedbacks.filter(f => f.score >= 7 && f.score <= 8).length;
  const detractors = feedbacks.filter(f => f.score >= 0 && f.score <= 6).length;

  const pctPromoters = total > 0 ? (promoters / total) * 100 : 0;
  const pctDetractors = total > 0 ? (detractors / total) * 100 : 0;
  
  // Score NPS vai de -100 a +100
  const npsScore = Math.round(pctPromoters - pctDetractors);

  // Determinar a "Zona" do NPS
  const getNpsZone = (score: number) => {
    if (score >= 75) return { label: 'Zona de Excelência', color: 'text-emerald-600', bg: 'bg-emerald-50' };
    if (score >= 50) return { label: 'Zona de Qualidade', color: 'text-indigo-600', bg: 'bg-indigo-50' };
    if (score >= 0) return { label: 'Zona de Aperfeiçoamento', color: 'text-amber-600', bg: 'bg-amber-50' };
    return { label: 'Zona Crítica', color: 'text-rose-600', bg: 'bg-rose-50' };
  };

  const zone = getNpsZone(npsScore);

  // Preparar dados para o Gráfico de Distribuição
  const distributionData = [
    { name: 'Insatisfeitos (0-6)', count: detractors, fill: '#ef4444' },
    { name: 'Indiferentes (7-8)', count: passives, fill: '#f59e0b' },
    { name: 'Muito Satisfeitos (9-10)', count: promoters, fill: '#10b981' }
  ];

  // Preparar dados para Gráfico de Tendência (Média por Data)
  const trendDataMap = new Map<string, { dateStr: string, totalScore: number, count: number }>();
  
  [...feedbacks].reverse().forEach(f => {
    if (!f.created_at) return;
    const dateKey = format(parseISO(f.created_at), 'dd/MM/yyyy');
    if (!trendDataMap.has(dateKey)) {
      trendDataMap.set(dateKey, { dateStr: dateKey, totalScore: 0, count: 0 });
    }
    const dataPoint = trendDataMap.get(dateKey)!;
    dataPoint.totalScore += f.score;
    dataPoint.count += 1;
  });

  const trendData = Array.from(trendDataMap.values()).map(d => ({
    date: d.dateStr,
    Média: Number((d.totalScore / d.count).toFixed(1))
  }));

  // Ranking de Terapeutas
  const therapistMap: Record<string, { name: string, totalScore: number, count: number }> = {};
  feedbacks.forEach(f => {
      const tInfo = f.appointments?.therapists;
      if (tInfo) {
          const tId = f.appointments?.therapist_id;
          if (tId) {
             if (!therapistMap[tId]) {
                 therapistMap[tId] = { name: tInfo.name, totalScore: 0, count: 0 };
             }
             therapistMap[tId].totalScore += f.score;
             therapistMap[tId].count += 1;
          }
      }
  });
  const therapistsRank = Object.values(therapistMap).map(t => ({
      name: t.name,
      avg: (t.totalScore / t.count).toFixed(1),
      count: t.count
  })).sort((a, b) => Number(b.avg) - Number(a.avg));

  return (
    <div className="space-y-6">
      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total</span>
          </div>
          <div>
            <h3 className="text-3xl font-black text-slate-900">{total}</h3>
            <p className="text-sm font-medium text-slate-500 mt-1">Avaliações recebidas</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center">
              <Star className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Média</span>
          </div>
          <div>
            <h3 className="text-3xl font-black text-slate-900">{avgScore.toFixed(1)} <span className="text-lg text-slate-400">/ 10</span></h3>
            <p className="text-sm font-medium text-slate-500 mt-1">Satisfação Geral</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col justify-between md:col-span-2 group hover:shadow-md transition-all relative overflow-hidden">
          <div className="flex items-center justify-between mb-2 relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center">
              <Heart className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">NPS Score</span>
          </div>
          <div className="flex items-end justify-between relative z-10">
            <div>
              <div className="flex items-baseline gap-3">
                <h3 className="text-4xl font-black text-slate-900">{npsScore}</h3>
                <div className={cn("px-3 py-1 rounded-full text-xs font-bold", zone.bg, zone.color)}>
                  {zone.label}
                </div>
              </div>
              <div className="flex items-center gap-4 mt-3">
                <p className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" /> {Math.round(pctPromoters)}% Muito Satisfeitos
                </p>
                <p className="text-xs font-bold text-blue-500 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500" /> {Math.round(passives/total*100 || 0)}% Indiferentes
                </p>
                <p className="text-xs font-bold text-rose-500 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-rose-500" /> {Math.round(pctDetractors)}% Insatisfeitos
                </p>
              </div>
            </div>
          </div>
          {/* Background gradient hint based on score */}
          <div className={cn(
             "absolute top-0 right-0 w-64 h-64 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/3 opacity-20 pointer-events-none",
             npsScore >= 50 ? "bg-emerald-500" : npsScore >= 0 ? "bg-amber-500" : "bg-rose-500"
          )} />
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico de Barras - Distribuição */}
        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
          <h3 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-2">
            Distribuição de Notas
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={distributionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} allowDecimals={false} />
                <RechartsTooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={50}>
                  {distributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico de Linha - Tendência */}
        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
          <h3 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-500" />
            Tendência de Satisfação
          </h3>
          <div className="h-64">
             {trendData.length > 1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                  <YAxis domain={[0, 10]} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="Média" 
                    stroke="#8b5cf6" 
                    strokeWidth={4} 
                    dot={{ fill: '#8b5cf6', strokeWidth: 2, r: 4 }} 
                    activeDot={{ r: 6, fill: '#fff', stroke: '#8b5cf6', strokeWidth: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
             ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-400 font-medium">
                   Poucos dados para traçar tendência.
                </div>
             )}
          </div>
        </div>
      </div>

      {/* Ranking & Lista de Feedbacks Recentes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Ranking de Terapeutas */}
        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-100 flex items-center gap-3">
            <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
            <h3 className="text-lg font-black text-slate-900">Top Terapeutas</h3>
          </div>
          <div className="p-6 flex-1 overflow-y-auto max-h-[400px]">
             {therapistsRank.length === 0 ? (
                <div className="text-center text-slate-500 font-medium py-10">Sem dados suficientes.</div>
             ) : (
                <div className="space-y-4">
                  {therapistsRank.map((t, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                       <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 font-black flex items-center justify-center text-xs">
                           {idx + 1}º
                         </div>
                         <div>
                           <p className="font-bold text-slate-900 text-sm">{t.name}</p>
                           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.count} avaliações</p>
                         </div>
                       </div>
                       <div className="text-right">
                         <p className="text-lg font-black text-indigo-600">{t.avg}</p>
                         <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Nota</p>
                       </div>
                    </div>
                  ))}
                </div>
             )}
          </div>
        </div>

        {/* Lista de Feedbacks Recentes */}
        <div className="lg:col-span-2 bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center gap-3">
            <MessageSquare className="w-5 h-5 text-slate-400" />
            <h3 className="text-lg font-black text-slate-900">Feedbacks Recentes</h3>
          </div>
          
          {feedbacks.length === 0 ? (
            <div className="p-8 text-center text-slate-500 font-medium">
              Nenhuma avaliação recebida ainda.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
              {feedbacks.map((fb) => (
                <div key={fb.id} className="p-6 hover:bg-slate-50 transition-colors flex items-start gap-4">
                  <div className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center text-xl font-black shrink-0",
                    fb.score >= 9 ? "bg-emerald-100 text-emerald-600" :
                    fb.score >= 7 ? "bg-amber-100 text-amber-600" :
                    "bg-rose-100 text-rose-600"
                  )}>
                    {fb.score}
                  </div>
                  <div>
                    <div className="flex flex-col mb-2">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-slate-900">
                          {fb.patients?.name || 'Paciente Anônimo'}
                        </span>
                        <span className="text-xs font-bold text-slate-400">
                          {fb.created_at ? format(parseISO(fb.created_at), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR }) : ''}
                        </span>
                      </div>
                      {fb.appointments?.therapists?.name && (
                         <div className="flex items-center gap-2 mt-1">
                           {fb.appointments.type && (
                             <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[9px] font-black uppercase tracking-widest">
                               {fb.appointments.type}
                             </span>
                           )}
                           <span className="text-xs font-bold text-slate-500">
                             com {fb.appointments.therapists.name}
                           </span>
                         </div>
                      )}
                    </div>
                    {fb.comment ? (
                      <p className="text-slate-600 text-sm leading-relaxed">{fb.comment}</p>
                    ) : (
                      <p className="text-slate-400 text-sm italic">Avaliação sem comentário escrito.</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
