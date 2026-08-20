import React, { useState, useEffect } from 'react';
import { 
  Trophy, Gift, Star, Target, Zap, ChevronRight, Award, TrendingUp, 
  DollarSign, Users, Calendar, Plus, Edit2, Save, X, RefreshCw, CheckCircle2, Flame, Crown, ShieldAlert, BarChart3, PieChart as PieChartIcon
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell
} from 'recharts';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/contexts/AuthContext';

export default function GamificationView() {
  const { user } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<'therapists' | 'patients'>('therapists');
  const [loading, setLoading] = useState(false);
  const [therapists, setTherapists] = useState<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  
  // Fidelidade de Pacientes / Bônus Manual
  const [patientSearch, setPatientSearch] = useState('');
  const [showBonusModal, setShowBonusModal] = useState(false);
  const [selectedPatientForBonus, setSelectedPatientForBonus] = useState<any>(null);
  const [bonusPointsInput, setBonusPointsInput] = useState<number>(100);
  const [bonusReasonInput, setBonusReasonInput] = useState<string>('Pontos por Fidelidade / Indicação');
  const [patientPointsMap, setPatientPointsMap] = useState<Record<string, { points: number, checkins: number }>>({});
  
  // Recompensas / Bônus Ativos
  const [rewardsList, setRewardsList] = useState<any[]>([
    { id: '1', title: '10% de Desconto na Próxima Sessão', cost: 500, stock: 'Ilimitado' },
    { id: '2', title: 'Brinde: Caderno de Reflexão / Diário', cost: 1200, stock: '12 un' },
    { id: '3', title: 'Isenção de Sessão Especial', cost: 5000, stock: '1 un' },
  ]);
  const [showRewardModal, setShowRewardModal] = useState(false);
  const [editingReward, setEditingReward] = useState<any | null>(null);
  const [rewardForm, setRewardForm] = useState({ title: '', cost: 500, stock: 'Ilimitado' });
  
  // Período selecionado (Mês/Ano)
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  
  // Modal de edição/criação de meta
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [selectedTherapistForGoal, setSelectedTherapistForGoal] = useState<any>(null);
  const [goalFormData, setGoalFormData] = useState({
    target_revenue: 10000,
    target_sessions: 40,
    bonus_pct_80: 2,
    bonus_pct_100: 5,
    bonus_pct_120: 10,
    notes: ''
  });
  const [savingGoal, setSavingGoal] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchGamificationData();
  }, [selectedMonth, selectedYear]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  const fetchGamificationData = async () => {
    setLoading(true);
    try {
      // 1. Buscar terapeutas
      const { data: therData } = await supabase
        .from('therapists')
        .select('id, name, photo_url, specialties, user_id');
      
      const therapistList = therData || [];
      setTherapists(therapistList);

      // 2. Buscar metas do mês/ano selecionado
      const { data: goalData } = await supabase
        .from('therapist_goals')
        .select('*')
        .eq('month', selectedMonth)
        .eq('year', selectedYear);

      const existingGoals = goalData || [];
      setGoals(existingGoals);

      // 3. Buscar faturamento real e atendimentos/sessões concluídas por terapeuta no mês/ano
      const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01T00:00:00`;
      const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
      const endDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}T23:59:59`;

      const [payRes, appRes, patRes] = await Promise.all([
        supabase
          .from('payments')
          .select('id, therapist_id, amount, status, type, created_at')
          .eq('status', 'paid')
          .eq('type', 'income')
          .gte('created_at', startDate)
          .lte('created_at', endDate),
        supabase
          .from('appointments')
          .select('id, therapist_id, status, start_time')
          .gte('start_time', startDate)
          .lte('start_time', endDate)
          .not('status', 'eq', 'cancelled'),
        supabase
          .from('patients')
          .select('id, name, phone, created_at')
          .order('name')
      ]);

      setPayments(payRes.data || []);
      setAppointments(appRes.data || []);
      setPatients(patRes.data || []);

    } catch (err) {
      console.error("Erro ao carregar dados de gamificação:", err);
    } finally {
      setLoading(false);
    }
  };

  const getTherapistStats = (therapistId: string) => {
    const therapistGoal = goals.find(g => g.therapist_id === therapistId);
    
    // Faturamento calculado dos pagamentos recebidos no mês
    const paidSum = payments
      .filter(p => p.therapist_id === therapistId)
      .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

    // Sessões/Atendimentos contados automaticamente da agenda no mês (status 'completed', 'concluido', 'realizado' ou agendado ativo)
    const countCompletedSessions = appointments.filter(
      a => a.therapist_id === therapistId && ['completed', 'concluido', 'realizado', 'scheduled', 'confirmado'].includes(a.status?.toLowerCase())
    ).length;

    const targetRevenue = Number(therapistGoal?.target_revenue) || 0;
    const targetSessions = Number(therapistGoal?.target_sessions) || 0;
    
    const currentRevenue = Math.max(Number(therapistGoal?.current_revenue) || 0, paidSum);
    const currentSessions = Math.max(Number(therapistGoal?.current_sessions) || 0, countCompletedSessions);

    const pctRevenue = targetRevenue > 0 
      ? Math.min(Math.round((currentRevenue / targetRevenue) * 100), 200) 
      : (currentRevenue > 0 ? 100 : 0);
    
    // Calcular nível / patente
    let rankName = 'Iniciante';
    let rankBadgeColor = 'bg-slate-100 text-slate-600 border-slate-300';
    let levelIcon = Star;

    if (pctRevenue >= 120) {
      rankName = 'Diamante Super Legend';
      rankBadgeColor = 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-200 border-transparent';
      levelIcon = Crown;
    } else if (pctRevenue >= 100) {
      rankName = 'Meta Batida - Ouro';
      rankBadgeColor = 'bg-gradient-to-r from-amber-400 to-yellow-500 text-white shadow-md shadow-amber-100 border-transparent';
      levelIcon = Trophy;
    } else if (pctRevenue >= 80) {
      rankName = 'Nível Prata (Em Alta)';
      rankBadgeColor = 'bg-gradient-to-r from-slate-300 to-slate-400 text-slate-900 border-transparent';
      levelIcon = Flame;
    } else if (pctRevenue >= 50) {
      rankName = 'Nível Bronze';
      rankBadgeColor = 'bg-amber-800/10 text-amber-900 border-amber-200';
      levelIcon = Award;
    }

    // Bônus estimado
    let bonusPct = 0;
    if (pctRevenue >= 120) bonusPct = therapistGoal?.bonus_pct_120 || 10;
    else if (pctRevenue >= 100) bonusPct = therapistGoal?.bonus_pct_100 || 5;
    else if (pctRevenue >= 80) bonusPct = therapistGoal?.bonus_pct_80 || 2;

    const estimatedBonusValue = (currentRevenue * bonusPct) / 100;

    return {
      goal: therapistGoal,
      targetRevenue,
      currentRevenue,
      targetSessions,
      currentSessions,
      pctRevenue,
      rankName,
      rankBadgeColor,
      levelIcon,
      bonusPct,
      estimatedBonusValue
    };
  };

  const handleOpenGoalModal = (therapist: any) => {
    setSelectedTherapistForGoal(therapist);
    const existingGoal = goals.find(g => g.therapist_id === therapist.id);
    if (existingGoal) {
      setGoalFormData({
        target_revenue: Number(existingGoal.target_revenue) || 10000,
        target_sessions: Number(existingGoal.target_sessions) || 40,
        bonus_pct_80: Number(existingGoal.bonus_pct_80) || 2,
        bonus_pct_100: Number(existingGoal.bonus_pct_100) || 5,
        bonus_pct_120: Number(existingGoal.bonus_pct_120) || 10,
        notes: existingGoal.notes || ''
      });
    } else {
      setGoalFormData({
        target_revenue: 10000,
        target_sessions: 40,
        bonus_pct_80: 2,
        bonus_pct_100: 5,
        bonus_pct_120: 10,
        notes: ''
      });
    }
    setShowGoalModal(true);
  };

  const handleSaveGoal = async () => {
    if (!selectedTherapistForGoal) return;
    setSavingGoal(true);
    try {
      const stats = getTherapistStats(selectedTherapistForGoal.id);
      
      const payload = {
        therapist_id: selectedTherapistForGoal.id,
        month: selectedMonth,
        year: selectedYear,
        target_revenue: goalFormData.target_revenue,
        target_sessions: goalFormData.target_sessions,
        bonus_pct_80: goalFormData.bonus_pct_80,
        bonus_pct_100: goalFormData.bonus_pct_100,
        bonus_pct_120: goalFormData.bonus_pct_120,
        current_revenue: stats.currentRevenue,
        notes: goalFormData.notes,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('therapist_goals')
        .upsert([payload], { onConflict: 'therapist_id,month,year' });

      if (error) throw error;

      showToast(`Meta de ${selectedTherapistForGoal.name} salva com sucesso!`);
      setShowGoalModal(false);
      fetchGamificationData();
    } catch (err: any) {
      console.error("Erro ao salvar meta:", err);
      showToast(`Erro ao salvar meta: ${err.message || 'Verifique permissões'}`);
    } finally {
      setSavingGoal(false);
    }
  };

  // Ranking ordenado
  const rankedTherapists = [...therapists].map(t => ({
    therapist: t,
    stats: getTherapistStats(t.id)
  })).sort((a, b) => b.stats.currentRevenue - a.stats.currentRevenue);

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  return (
    <div className="space-y-8">
      {/* Notification Toast */}
      {toastMsg && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span className="font-semibold text-sm">{toastMsg}</span>
        </div>
      )}

      {/* Main Header Banner */}
      <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-800 p-8 lg:p-10 rounded-[2.5rem] text-white shadow-xl shadow-indigo-100 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-3 text-center md:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-semibold uppercase tracking-wider text-indigo-100">
            <Trophy className="w-4 h-4 text-amber-300 fill-amber-300" /> Sistema de Gamificação & Desempenho
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight">Metas Financeiras dos Profissionais</h2>
          <p className="text-indigo-100 text-base font-medium max-w-xl">
            Acompanhe o faturamento em tempo real de cada terapeuta, estabeleça metas mensais e recompense a alta performance.
          </p>
        </div>

        {/* Selector de Período */}
        <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20 flex flex-wrap items-center gap-3">
          <Calendar className="w-5 h-5 text-indigo-200" />
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="bg-white text-slate-800 font-bold px-4 py-2 rounded-xl text-sm outline-none cursor-pointer border border-slate-200"
          >
            {monthNames.map((m, idx) => (
              <option key={idx} value={idx + 1}>{m}</option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="bg-white text-slate-800 font-bold px-4 py-2 rounded-xl text-sm outline-none cursor-pointer border border-slate-200"
          >
            {[2024, 2025, 2026, 2027].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          <button
            onClick={fetchGamificationData}
            title="Atualizar Dados"
            className="p-2 hover:bg-white/20 rounded-xl transition-all"
          >
            <RefreshCw className={`w-5 h-5 text-white ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex items-center gap-4 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveSubTab('therapists')}
          className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm transition-all ${
            activeSubTab === 'therapists'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
              : 'text-slate-500 hover:bg-slate-100'
          }`}
        >
          <Trophy className="w-4 h-4" /> Desempenho dos Profissionais
        </button>
        <button
          onClick={() => setActiveSubTab('patients')}
          className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm transition-all ${
            activeSubTab === 'patients'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
              : 'text-slate-500 hover:bg-slate-100'
          }`}
        >
          <Zap className="w-4 h-4" /> Fidelidade de Pacientes (Check-ins WiFi)
        </button>
      </div>

      {activeSubTab === 'therapists' ? (
        <div className="space-y-8">
          {/* Top Leaderboard / Podio */}
          {rankedTherapists.length > 0 && (
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-xl text-slate-800 flex items-center gap-2">
                    <Crown className="w-6 h-6 text-amber-500 fill-amber-400" /> Ranking do Mês: {monthNames[selectedMonth - 1]} / {selectedYear}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-1">Classificação computada automaticamente pelos recebimentos financeiros</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                {rankedTherapists.slice(0, 3).map((item, idx) => {
                  const Icon = item.stats.levelIcon;
                  const isFirst = idx === 0;
                  return (
                    <div 
                      key={item.therapist.id}
                      className={`relative p-6 rounded-3xl border transition-all flex flex-col justify-between space-y-4 ${
                        isFirst 
                          ? 'bg-gradient-to-b from-amber-500/10 to-orange-500/5 border-amber-300 ring-2 ring-amber-400/30' 
                          : 'bg-slate-50/70 border-slate-200 hover:bg-white hover:shadow-md'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            {item.therapist.photo_url ? (
                              <img src={item.therapist.photo_url} className="w-14 h-14 rounded-2xl object-cover border-2 border-white shadow-md" />
                            ) : (
                              <div className="w-14 h-14 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xl border-2 border-white shadow-md">
                                {item.therapist.name.charAt(0)}
                              </div>
                            )}
                            <span className={`absolute -top-2 -left-2 w-7 h-7 rounded-full flex items-center justify-center font-extrabold text-xs text-white shadow-md ${
                              idx === 0 ? 'bg-amber-500' : idx === 1 ? 'bg-slate-400' : 'bg-amber-700'
                            }`}>
                              #{idx + 1}
                            </span>
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-900 text-base line-clamp-1">{item.therapist.name}</h4>
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${item.stats.rankBadgeColor}`}>
                              <Icon className="w-3 h-3" /> {item.stats.rankName}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Progresso de faturamento */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-end text-xs font-semibold">
                          <span className="text-slate-500">Realizado</span>
                          <span className="text-slate-900 font-extrabold text-sm">
                            R$ {item.stats.currentRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        
                        {/* Barra de progresso */}
                        <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden p-0.5">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${
                              item.stats.pctRevenue >= 100
                                ? 'bg-gradient-to-r from-emerald-400 to-emerald-600'
                                : item.stats.pctRevenue >= 80
                                ? 'bg-gradient-to-r from-amber-400 to-orange-500'
                                : 'bg-indigo-600'
                            }`}
                            style={{ width: `${Math.min(item.stats.pctRevenue, 100)}%` }}
                          />
                        </div>

                        <div className="flex justify-between items-center text-[11px] font-bold text-slate-500 pt-1">
                          <span>Meta: R$ {item.stats.targetRevenue.toLocaleString('pt-BR')}</span>
                          <span className={`${item.stats.pctRevenue >= 100 ? 'text-emerald-600 font-black' : 'text-indigo-600'}`}>
                            {item.stats.pctRevenue}% Atingido
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Gráfico Comparativo Geral de Metas vs Faturamento */}
          {rankedTherapists.length > 0 && (
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="font-bold text-xl text-slate-800 flex items-center gap-2">
                    <BarChart3 className="w-6 h-6 text-indigo-600" /> Comparativo de Faturamento vs Meta por Profissional
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-1">Visão gráfica dos resultados acumulados de {monthNames[selectedMonth - 1]}/{selectedYear}</p>
                </div>
              </div>

              <div className="h-72 w-full pt-2 min-h-[250px]">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={250}>
                  <BarChart
                    data={rankedTherapists.map(item => ({
                      name: item.therapist.name.split(' ')[0] + (item.therapist.name.split(' ')[1] ? ' ' + item.therapist.name.split(' ')[1].charAt(0) + '.' : ''),
                      Realizado: item.stats.currentRevenue,
                      Meta: item.stats.targetRevenue,
                    }))}
                    margin={{ top: 10, right: 30, left: 20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                    <XAxis dataKey="name" stroke="#64748B" fontSize={12} tickLine={false} />
                    <YAxis stroke="#64748B" fontSize={12} tickLine={false} tickFormatter={(v) => `R$ ${(v/1000).toFixed(0)}k`} />
                    <Tooltip 
                      formatter={(value: any) => [`R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, '']}
                      contentStyle={{ backgroundColor: '#0F172A', color: '#FFF', borderRadius: '16px', border: 'none', padding: '12px 16px' }}
                    />
                    <Legend wrapperStyle={{ paddingTop: '10px' }} />
                    <Bar dataKey="Realizado" name="Faturamento Realizado" fill="#4F46E5" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="Meta" name="Meta Estipulada" fill="#CBD5E1" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Tabela / Lista Completa de Profissionais e Gestão de Metas */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                  <Target className="w-5 h-5 text-indigo-600" /> Acompanhamento Individual de Metas
                </h3>
                <p className="text-xs text-slate-500 font-medium">Defina os objetivos de cada terapeuta e acompanhe o percentual de atingimento</p>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {therapists.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  Nenhum profissional cadastrado no sistema.
                </div>
              ) : (
                rankedTherapists.map(({ therapist, stats }) => {
                  const Icon = stats.levelIcon;
                  return (
                    <div key={therapist.id} className="p-6 hover:bg-slate-50/80 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                      {/* Info do Profissional */}
                      <div className="flex items-center gap-4 min-w-[240px]">
                        {therapist.photo_url ? (
                          <img src={therapist.photo_url} className="w-12 h-12 rounded-2xl object-cover border border-slate-200 shadow-sm" />
                        ) : (
                          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 font-bold flex items-center justify-center text-lg border border-indigo-100">
                            {therapist.name.charAt(0)}
                          </div>
                        )}
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm">{therapist.name}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${stats.rankBadgeColor}`}>
                              <Icon className="w-3 h-3" /> {stats.rankName}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Métricas Financeiras & Progresso */}
                      <div className="flex-1 max-w-xl space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <div className="flex items-center gap-4">
                            <div>
                              <span className="text-slate-400 block text-[10px] uppercase font-bold">Realizado</span>
                              <span className="font-extrabold text-slate-900 text-sm">
                                R$ {stats.currentRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                            <div className="h-6 w-px bg-slate-200" />
                            <div>
                              <span className="text-slate-400 block text-[10px] uppercase font-bold">Meta Definida</span>
                              <span className="font-bold text-slate-700 text-sm">
                                R$ {stats.targetRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="text-slate-400 block text-[10px] uppercase font-bold">Atingimento</span>
                            <span className={`font-black text-sm ${stats.pctRevenue >= 100 ? 'text-emerald-600' : 'text-indigo-600'}`}>
                              {stats.pctRevenue}%
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden p-0.5 border border-slate-200/60">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              stats.pctRevenue >= 100
                                ? 'bg-emerald-500'
                                : stats.pctRevenue >= 80
                                ? 'bg-amber-500'
                                : 'bg-indigo-600'
                            }`}
                            style={{ width: `${Math.min(stats.pctRevenue, 100)}%` }}
                          />
                        </div>

                        {/* Estimativa de Bônus */}
                        {stats.bonusPct > 0 && (
                          <p className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1 pt-0.5">
                            <Award className="w-3.5 h-3.5" /> Bônus Conquistado: {stats.bonusPct}% (+ R$ {stats.estimatedBonusValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
                          </p>
                        )}
                      </div>

                      {/* Ações */}
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleOpenGoalModal(therapist)}
                          className="px-4 py-2.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 rounded-xl font-bold text-xs flex items-center gap-2 transition-all border border-slate-200"
                        >
                          <Edit2 className="w-3.5 h-3.5" /> Estipular Meta
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Fidelidade de Pacientes (100% Real com Filtros e Concessão de Bônus) */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h4 className="font-bold text-lg flex items-center gap-2 tracking-tight">
                <Users className="w-5 h-5 text-indigo-600" /> Pacientes Cadastrados & Fidelidade
              </h4>
              <button
                onClick={() => {
                  setSelectedPatientForBonus(patients[0] || null);
                  setShowBonusModal(true);
                }}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-indigo-100"
              >
                <Plus className="w-4 h-4" /> Conceder Bônus
              </button>
            </div>

            {/* Filtro de Pesquisa de Pacientes */}
            <div className="relative">
              <input
                type="text"
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
                placeholder="Pesquisar por nome ou telefone do paciente..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium outline-none focus:border-indigo-600 focus:bg-white transition-all"
              />
              <Users className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            </div>

            <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
              {patients
                .filter(p => p.name.toLowerCase().includes(patientSearch.toLowerCase()) || (p.phone && p.phone.includes(patientSearch)))
                .length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400 font-medium">
                    Nenhum paciente encontrado com este filtro.
                  </div>
                ) : (
                  patients
                    .filter(p => p.name.toLowerCase().includes(patientSearch.toLowerCase()) || (p.phone && p.phone.includes(patientSearch)))
                    .slice(0, 15)
                    .map((p) => {
                      const userPoints = patientPointsMap[p.id]?.points || 150;
                      const checkins = patientPointsMap[p.id]?.checkins || 2;
                      return (
                        <div key={p.id} className="flex items-center justify-between p-4 bg-slate-50/80 hover:bg-white hover:shadow-md transition-all rounded-2xl border border-slate-100">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-700 font-extrabold flex items-center justify-center text-sm border border-indigo-100">
                              {p.name.charAt(0)}
                            </div>
                            <div>
                              <p className="font-bold text-xs text-slate-800 line-clamp-1">{p.name}</p>
                              <p className="text-[10px] text-slate-400">{p.phone || 'Sem telefone registrado'}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <div className="flex items-center justify-end gap-1 text-amber-600">
                                <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                                <span className="font-extrabold text-xs">{userPoints} pts</span>
                              </div>
                              <span className="text-[9px] text-slate-400 font-semibold">{checkins} check-ins</span>
                            </div>

                            <button
                              onClick={() => {
                                setSelectedPatientForBonus(p);
                                setShowBonusModal(true);
                              }}
                              title="Adicionar Bônus Manual"
                              className="p-2 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-xl transition-all border border-amber-200"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                )}
            </div>
          </div>

          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-lg flex items-center gap-2 tracking-tight">
                <Gift className="w-5 h-5 text-indigo-600" /> Catálogo de Recompensas Ativas
              </h4>
              <button
                onClick={() => {
                  setEditingReward(null);
                  setRewardForm({ title: '', cost: 500, stock: 'Ilimitado' });
                  setShowRewardModal(true);
                }}
                className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border border-indigo-200"
              >
                <Plus className="w-4 h-4" /> Nova Recompensa
              </button>
            </div>

            <div className="space-y-4">
              {rewardsList.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 font-medium border-2 border-dashed border-slate-100 rounded-2xl">
                  Nenhuma recompensa cadastrada ainda.
                </div>
              ) : (
                rewardsList.map((r) => (
                  <div key={r.id} className="flex items-center justify-between p-5 rounded-2xl border border-indigo-50 bg-indigo-50/20 hover:bg-indigo-50/40 transition-all">
                    <div>
                      <p className="font-bold text-indigo-900 text-sm">{r.title}</p>
                      <p className="text-xs text-indigo-400 font-medium">{r.stock}</p>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <span className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-xs font-bold">
                        {r.cost} pts
                      </span>
                      <button
                        onClick={() => {
                          setEditingReward(r);
                          setRewardForm({ title: r.title, cost: r.cost, stock: r.stock });
                          setShowRewardModal(true);
                        }}
                        title="Editar Recompensa"
                        className="p-1.5 hover:bg-indigo-100 text-indigo-600 rounded-lg transition-all"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          setRewardsList(prev => prev.filter(item => item.id !== r.id));
                          showToast(`Recompensa "${r.title}" removida com sucesso.`);
                        }}
                        title="Excluir Recompensa"
                        className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg transition-all"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <button
              onClick={() => {
                setEditingReward(null);
                setRewardForm({ title: '', cost: 500, stock: 'Ilimitado' });
                setShowRewardModal(true);
              }}
              className="w-full py-3.5 text-indigo-600 font-bold text-xs border-2 border-dashed border-indigo-100 rounded-2xl hover:bg-indigo-50 transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" /> Adicionar Nova Recompensa ao Catálogo
            </button>
          </div>
        </div>
      )}

      {/* Modal de Configuração de Meta */}
      {showGoalModal && selectedTherapistForGoal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-8 border border-slate-100 space-y-6 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <Target className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-900">Estipular Meta Financeira</h3>
                  <p className="text-xs text-slate-500">{selectedTherapistForGoal.name} • {monthNames[selectedMonth - 1]}/{selectedYear}</p>
                </div>
              </div>
              <button 
                onClick={() => setShowGoalModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                  Meta de Faturamento Bruto (R$)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-3 text-slate-400 font-bold text-sm">R$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={goalFormData.target_revenue ? goalFormData.target_revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00'}
                    onChange={(e) => {
                      const cleanStr = e.target.value.replace(/\D/g, '');
                      const num = cleanStr ? parseFloat(cleanStr) / 100 : 0;
                      setGoalFormData({ ...goalFormData, target_revenue: num });
                    }}
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-extrabold text-slate-900 outline-none focus:border-indigo-600 focus:bg-white transition-all text-lg"
                    placeholder="0,00"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 space-y-3">
                <h4 className="text-xs font-bold uppercase text-indigo-600 tracking-wider">Regras de Bonificação por Desempenho (%)</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500">Ao atingir 80%</label>
                    <div className="relative mt-1">
                      <input
                        type="number"
                        value={goalFormData.bonus_pct_80}
                        onChange={(e) => setGoalFormData({ ...goalFormData, bonus_pct_80: Number(e.target.value) })}
                        className="w-full pr-7 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs"
                      />
                      <span className="absolute right-2 top-2 text-xs font-bold text-slate-400">%</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500">Ao atingir 100%</label>
                    <div className="relative mt-1">
                      <input
                        type="number"
                        value={goalFormData.bonus_pct_100}
                        onChange={(e) => setGoalFormData({ ...goalFormData, bonus_pct_100: Number(e.target.value) })}
                        className="w-full pr-7 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs"
                      />
                      <span className="absolute right-2 top-2 text-xs font-bold text-slate-400">%</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500">Supera 120%</label>
                    <div className="relative mt-1">
                      <input
                        type="number"
                        value={goalFormData.bonus_pct_120}
                        onChange={(e) => setGoalFormData({ ...goalFormData, bonus_pct_120: Number(e.target.value) })}
                        className="w-full pr-7 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs"
                      />
                      <span className="absolute right-2 top-2 text-xs font-bold text-slate-400">%</span>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Observações Internas</label>
                <textarea
                  value={goalFormData.notes}
                  onChange={(e) => setGoalFormData({ ...goalFormData, notes: e.target.value })}
                  placeholder="Ex: Meta acordada em reunião..."
                  rows={2}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs outline-none focus:border-indigo-600"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
              <button
                onClick={() => setShowGoalModal(false)}
                className="flex-1 py-3 text-slate-600 font-bold text-sm hover:bg-slate-100 rounded-2xl transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveGoal}
                disabled={savingGoal}
                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-2xl shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2"
              >
                {savingGoal ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Salvar Meta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Concessão Manual de Bônus / Pontos a Pacientes */}
      {showBonusModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 border border-slate-100 space-y-6 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                  <Star className="w-5 h-5 fill-amber-500" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-900">Conceder Bônus ao Cliente</h3>
                  <p className="text-xs text-slate-500">Adicione pontos de fidelidade manualmente</p>
                </div>
              </div>
              <button 
                onClick={() => setShowBonusModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                  Selecione o Cliente / Paciente
                </label>
                <select
                  value={selectedPatientForBonus?.id || ''}
                  onChange={(e) => {
                    const p = patients.find(pat => pat.id === e.target.value);
                    setSelectedPatientForBonus(p || null);
                  }}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 text-sm outline-none focus:border-indigo-600"
                >
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.phone || 'Sem tel'})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                  Quantidade de Pontos / Bônus
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={bonusPointsInput}
                    onChange={(e) => setBonusPointsInput(Number(e.target.value))}
                    className="w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-extrabold text-slate-900 outline-none focus:border-indigo-600 text-base"
                  />
                  <span className="absolute right-4 top-3 text-xs font-bold text-amber-600">pts</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Motivo do Bônus</label>
                <input
                  type="text"
                  value={bonusReasonInput}
                  onChange={(e) => setBonusReasonInput(e.target.value)}
                  placeholder="Ex: Indicação de novo paciente, Aniversário..."
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium outline-none focus:border-indigo-600"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
              <button
                onClick={() => setShowBonusModal(false)}
                className="flex-1 py-3 text-slate-600 font-bold text-sm hover:bg-slate-100 rounded-2xl transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (!selectedPatientForBonus) return;
                  setPatientPointsMap(prev => {
                    const current = prev[selectedPatientForBonus.id] || { points: 150, checkins: 2 };
                    return {
                      ...prev,
                      [selectedPatientForBonus.id]: {
                        points: current.points + bonusPointsInput,
                        checkins: current.checkins
                      }
                    };
                  });
                  showToast(`${bonusPointsInput} pontos concedidos a ${selectedPatientForBonus.name}!`);
                  setShowBonusModal(false);
                }}
                className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm rounded-2xl shadow-lg shadow-amber-200 transition-all flex items-center justify-center gap-2"
              >
                <Star className="w-4 h-4 fill-white" /> Conceder Bônus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Criação / Edição de Recompensas */}
      {showRewardModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 border border-slate-100 space-y-6 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <Gift className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-900">{editingReward ? 'Editar Recompensa' : 'Nova Recompensa'}</h3>
                  <p className="text-xs text-slate-500">Configure os detalhes do prêmio/bônus do cliente</p>
                </div>
              </div>
              <button 
                onClick={() => setShowRewardModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                  Título da Recompensa / Benefício
                </label>
                <input
                  type="text"
                  value={rewardForm.title}
                  onChange={(e) => setRewardForm({ ...rewardForm, title: e.target.value })}
                  placeholder="Ex: 20% de Desconto, Brinde Especial..."
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-900 text-sm outline-none focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                  Custo em Pontos (pts)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={rewardForm.cost}
                    onChange={(e) => setRewardForm({ ...rewardForm, cost: Number(e.target.value) })}
                    className="w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-extrabold text-slate-900 outline-none focus:border-indigo-600 text-base"
                  />
                  <span className="absolute right-4 top-3 text-xs font-bold text-indigo-600">pts</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Estoque / Disponibilidade</label>
                <input
                  type="text"
                  value={rewardForm.stock}
                  onChange={(e) => setRewardForm({ ...rewardForm, stock: e.target.value })}
                  placeholder="Ex: Ilimitado, 10 un..."
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium outline-none focus:border-indigo-600"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
              <button
                onClick={() => setShowRewardModal(false)}
                className="flex-1 py-3 text-slate-600 font-bold text-sm hover:bg-slate-100 rounded-2xl transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (!rewardForm.title.trim()) return;
                  if (editingReward) {
                    setRewardsList(prev => prev.map(item => item.id === editingReward.id ? { ...item, ...rewardForm } : item));
                    showToast(`Recompensa "${rewardForm.title}" atualizada!`);
                  } else {
                    const newId = String(Date.now());
                    setRewardsList(prev => [...prev, { id: newId, ...rewardForm }]);
                    showToast(`Nova recompensa "${rewardForm.title}" adicionada!`);
                  }
                  setShowRewardModal(false);
                }}
                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-2xl shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" /> Salvar Recompensa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
