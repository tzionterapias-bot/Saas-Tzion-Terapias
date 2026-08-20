import React, { useState, useEffect } from 'react';
import { 
  Users, Calendar, Clock, CheckCircle2, MessageSquare, Loader2, Activity, ClipboardList, X, Trash2, ArrowRight
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/src/lib/utils';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/contexts/AuthContext';
import { playCheckinChime } from '@/src/lib/soundAlerts';

export default function TherapistView() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    activePatients: 0,
    monthlySessions: 0,
    pendingEvolutions: 0
  });
  const [upcomingSessions, setUpcomingSessions] = useState<any[]>([]);
  const [cancelModalAppt, setCancelModalAppt] = useState<any | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchStats = async () => {
    try {
      setLoading(true);
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
      const today = now.toISOString().split('T')[0];

      // Busca o ID do terapeuta associado ao usuário logado
      let therapistId = '';
      if (user?.id) {
        const { data: tData } = await supabase
          .from('therapists')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();
        if (tData?.id) {
          therapistId = tData.id;
        } else if (user.email) {
          const { data: tEmail } = await supabase
            .from('therapists')
            .select('id')
            .eq('email', user.email)
            .maybeSingle();
          if (tEmail?.id) therapistId = tEmail.id;
        }
      }

      let monthlyQuery = supabase.from('appointments')
        .select('id, patient_id')
        .gte('start_time', firstDay)
        .lte('start_time', lastDay);

      let todayQuery = supabase.from('appointments')
        .select('*, patients(name, phone)')
        .gte('start_time', `${today}T00:00:00`)
        .lte('start_time', `${today}T23:59:59`)
        .order('start_time', { ascending: true })
        .limit(10);

      if (user?.role === 'terapeuta') {
        if (therapistId) {
          monthlyQuery = monthlyQuery.eq('therapist_id', therapistId);
          todayQuery = todayQuery.eq('therapist_id', therapistId);
        } else {
          monthlyQuery = monthlyQuery.eq('therapist_id', '00000000-0000-0000-0000-000000000000');
          todayQuery = todayQuery.eq('therapist_id', '00000000-0000-0000-0000-000000000000');
        }
      }

      // Execute queries in parallel for high performance
      const [monthlyApptsRes, todayApptsRes] = await Promise.all([
        monthlyQuery,
        todayQuery
      ]);

      const monthlyAppts = monthlyApptsRes.data || [];
      const todayAppts = todayApptsRes.data || [];

      // Contagem real de pacientes ativos no mês
      const uniquePatients = new Set(monthlyAppts.map(a => a.patient_id).filter(Boolean));
      
      // Contagem de evoluções pendentes: sessões de hoje não completadas/canceladas
      const pendingEvolutions = todayAppts.filter(a => a.status !== 'completed' && a.status !== 'cancelled').length;

      setStats({
        activePatients: uniquePatients.size,
        monthlySessions: monthlyAppts.length,
        pendingEvolutions: pendingEvolutions
      });

      setUpcomingSessions(todayAppts);

    } catch (error) {
      console.error('Erro ao buscar estatísticas do terapeuta:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();

    const channel = supabase
      .channel('therapist_view_appointments')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments' },
        (payload: any) => {
          if (payload.eventType === 'UPDATE' && payload.new?.status === 'arrived' && payload.old?.status !== 'arrived') {
            playCheckinChime();
            showToast('🔔 Paciente acabou de fazer o check-in na recepção e está te aguardando!');
          }
          fetchStats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const handleCancelAppointment = async () => {
    if (!cancelModalAppt) return;
    const session = cancelModalAppt;
    try {
      setActionLoading(true);
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('id', session.id);

      if (error) throw error;

      // Dispara Webhook n8n para cancelar no Google Calendar
      try {
        const { data: settings } = await supabase.from('settings').select('value').eq('key', 'integrations').maybeSingle();
        const webhookUrl = settings?.value?.n8n_webhook_url;
        if (webhookUrl) {
          await fetch('/api/n8n-proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              webhookUrl,
              payload: {
                event: 'appointment_cancelled',
                appointment_id: session.id,
                google_event_id: session.google_event_id || null,
                patient_name: session.patients?.name,
                therapist_name: user?.name
              }
            })
          });
        }
      } catch (e) {
        console.warn('Aviso ao notificar n8n:', e);
      }

      // Envia notificação WhatsApp para o paciente
      if (session.patients?.phone) {
        try {
          const { sendWhatsAppMessage } = await import('@/src/lib/whatsapp');
          const firstName = session.patients.name.split(' ')[0];
          const dataFmt = new Date(session.start_time).toLocaleDateString('pt-BR');
          const horaFmt = new Date(session.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
          const msg = `Olá, *${firstName}*! 👋\n\nInformamos que a sua sessão na *Clínica Tzion Terapias* agendada para ${dataFmt} às ${horaFmt} foi desmarcada.\n\nPara reagendar um novo horário, estamos à disposição! 💙`;
          await sendWhatsAppMessage(session.patient_id, session.patients.phone, msg, 'appointment_cancelled');
        } catch (err) {
          console.warn('Erro WhatsApp:', err);
        }
      }

      showToast('Sessão desmarcada com sucesso!');
      setCancelModalAppt(null);
      fetchStats();
    } catch (e: any) {
      showToast('Erro ao desmarcar: ' + e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteAppointment = async () => {
    if (!cancelModalAppt) return;
    const session = cancelModalAppt;
    try {
      setActionLoading(true);
      const { error } = await supabase
        .from('appointments')
        .delete()
        .eq('id', session.id);

      if (error) throw error;

      showToast('Sessão removida permanentemente!');
      setCancelModalAppt(null);
      fetchStats();
    } catch (e: any) {
      showToast('Erro ao remover sessão: ' + e.message);
    } finally {
      setActionLoading(false);
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
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl font-bold text-sm flex items-center gap-3 animate-in fade-in z-[120]">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          {toastMessage}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight">Olá, {user?.name}</h2>
          <p className="text-slate-500 font-medium text-lg">Aqui está o resumo da sua rotina clínica.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link 
            to="/admin/agenda"
            className="px-5 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-md flex items-center gap-2"
          >
            <Calendar className="w-4 h-4" /> Ver Agenda Completa
          </Link>
          <button onClick={fetchStats} className="px-5 py-3 bg-white border border-slate-200 rounded-2xl font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm">
            Atualizar
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Meus Pacientes', value: stats.activePatients, icon: Users, color: 'indigo', trend: 'Ativos' },
          { label: 'Sessões Realizadas', value: stats.monthlySessions, icon: Calendar, color: 'emerald', trend: 'Este Mês' },
          { label: 'Evoluções Pendentes', value: stats.pendingEvolutions, icon: ClipboardList, color: 'rose', trend: 'Ação Necessária' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all group">
            <div className="flex justify-between items-start mb-6">
              <div className={cn(
                "w-14 h-14 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110",
                stat.color === 'indigo' ? "bg-indigo-50 text-indigo-600" :
                stat.color === 'emerald' ? "bg-emerald-50 text-emerald-600" :
                "bg-rose-50 text-rose-600"
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

      {/* Agenda do Dia */}
      <div className="bg-white p-8 sm:p-10 rounded-[3rem] border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-xl font-bold flex items-center gap-2 text-slate-900">
              <Clock className="w-6 h-6 text-indigo-600" /> Minha Agenda de Hoje
            </h3>
            <p className="text-xs text-slate-400 mt-1 font-medium">Sessões agendadas para o seu atendimento hoje.</p>
          </div>
          <Link 
            to="/admin/agenda" 
            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5 transition-colors"
          >
            Abrir Calendário <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {upcomingSessions.map((session, i) => (
            <div key={i} className="flex items-center justify-between p-5 bg-slate-50/50 rounded-3xl border border-transparent hover:border-indigo-100 hover:bg-white transition-all group">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-14 h-14 rounded-2xl bg-white border border-slate-100 flex items-center justify-center font-black text-slate-700 group-hover:text-indigo-600 transition-colors shadow-sm text-base shrink-0">
                  {new Date(session.start_time).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 text-base truncate">{session.patients?.name || 'Paciente'}</p>
                  <p className="text-xs text-slate-500 font-medium flex items-center gap-1.5 mt-1">
                    <Activity className="w-3.5 h-3.5 text-indigo-500" /> {session.type || 'Sessão'}
                    <span className={cn(
                      "px-2 py-0.5 rounded-md text-[10px] font-bold uppercase",
                      session.status === 'completed' ? "bg-emerald-50 text-emerald-600" :
                      session.status === 'cancelled' ? "bg-rose-50 text-rose-600" :
                      session.status === 'arrived' ? "bg-amber-100 text-amber-800 animate-pulse font-black" :
                      session.status === 'calling' ? "bg-emerald-100 text-emerald-700 font-bold" :
                      "bg-slate-100 text-slate-700"
                    )}>
                      {session.status === 'completed' ? 'Concluída' : 
                       session.status === 'cancelled' ? 'Cancelada' : 
                       session.status === 'arrived' ? '🔔 Chegou na Recepção' : 
                       session.status === 'calling' ? 'Sala Liberada' : 'Agendada'}
                    </span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {session.status !== 'cancelled' && (
                  <button 
                    onClick={() => setCancelModalAppt(session)}
                    className="p-2.5 bg-slate-100 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-xl transition-colors"
                    title="Desmarcar ou Excluir Sessão"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                <Link 
                  to="/admin/registros-sessao" 
                  className="px-4 py-2.5 bg-indigo-50 text-indigo-600 font-bold text-xs rounded-xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm border border-indigo-100"
                >
                  Registrar
                </Link>
              </div>
            </div>
          ))}
          {upcomingSessions.length === 0 && (
            <div className="col-span-full h-[180px] flex flex-col items-center justify-center text-slate-400 space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-400" />
              <p className="font-medium">Sua agenda está livre hoje!</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal Desmarcar / Excluir */}
      {cancelModalAppt && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl border border-slate-100 p-8 space-y-6">
            <div className="flex items-center gap-4">
              <div className="p-3.5 bg-amber-50 text-amber-600 rounded-2xl">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900">Desmarcar ou Excluir</h3>
                <p className="text-xs text-slate-400 font-medium">Selecione a ação para esta sessão</p>
              </div>
            </div>

            <p className="text-sm text-slate-600 font-medium leading-relaxed">
              Deseja alterar a consulta de <strong className="text-slate-900">{cancelModalAppt.patients?.name}</strong> agendada para às <strong>{new Date(cancelModalAppt.start_time).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}</strong>?
            </p>

            <div className="flex flex-col gap-3 pt-2">
              <button
                onClick={handleCancelAppointment}
                disabled={actionLoading}
                className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-sm shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Clock className="w-4 h-4" /> Desmarcar (Avisar Paciente)
              </button>
              <button
                onClick={handleDeleteAppointment}
                disabled={actionLoading}
                className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-sm shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" /> Excluir Permanentemente
              </button>
              <button
                onClick={() => setCancelModalAppt(null)}
                disabled={actionLoading}
                className="w-full py-2.5 rounded-xl font-bold text-sm text-slate-500 hover:bg-slate-100 transition-colors"
              >
                Voltar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
