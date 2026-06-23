import React, { useState, useEffect } from 'react';
import { Calendar, Video, Clock, ChevronRight, FileText, CheckCircle2, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/src/lib/supabase';
import { cn } from '@/src/lib/utils';
import { useAuth } from '@/src/contexts/AuthContext';

export default function PatientDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [joining, setJoining] = useState(false);
  const [loading, setLoading] = useState(true);
  const [nextAppointment, setNextAppointment] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [stats, setStats] = useState({ pending: 0, lastPaid: 0 });

  const fetchData = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);

      // 1. Buscar paciente vinculado ao usuário (usando ilike para e-mail case-insensitive)
      const { data: patient } = await supabase.from('patients').select('id').ilike('email', user.email).single();
      if (!patient) return;

      // 2. Próximo agendamento
      const { data: appointments } = await supabase
        .from('appointments')
        .select('*, therapists(name)')
        .eq('patient_id', patient.id)
        .gte('start_time', new Date().toISOString())
        .order('start_time', { ascending: true })
        .limit(1);
      
      if (appointments && appointments.length > 0) {
        setNextAppointment(appointments[0]);
      }

      // 3. Histórico recente
      const { data: pastSessions } = await supabase
        .from('appointments')
        .select('*, therapists(name)')
        .eq('patient_id', patient.id)
        .lt('start_time', new Date().toISOString())
        .order('start_time', { ascending: false })
        .limit(3);
      setHistory(pastSessions || []);

      // 4. Financeiro
      const { data: payments } = await supabase.from('payments').select('id, amount, status').eq('patient_id', patient.id);
      const pending = payments?.filter(p => p.status === 'pending' || p.status === 'overdue').reduce((acc, curr) => acc + Number(curr.amount), 0) || 0;
      const lastPaid = payments?.filter(p => p.status === 'paid').sort((a,b) => b.id - a.id)[0]?.amount || 0;
      setStats({ pending, lastPaid });

    } catch (error) {
      console.error('Erro ao carregar portal:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = "Painel do Paciente | Tzion Terapias";
    let metaDescription = document.querySelector('meta[name="description"]');
    if (!metaDescription) {
      metaDescription = document.createElement('meta');
      metaDescription.setAttribute('name', 'description');
      document.head.appendChild(metaDescription);
    }
    metaDescription.setAttribute('content', 'Acompanhe seu tratamento, visualize próximos agendamentos e acesse o link de telemedicina no Painel do Paciente da Tzion Terapias.');
  }, []);

  useEffect(() => {
    fetchData();
  }, [user]);

  const handleJoinRoom = () => {
    setJoining(true);
    setTimeout(() => {
      window.open(nextAppointment?.meet_link || 'https://meet.google.com', '_blank');
      setJoining(false);
    }, 1500);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      {/* Next Appointment Card */}
      <div className={cn(
        "rounded-[2.5rem] p-10 text-white shadow-2xl relative overflow-hidden group transition-all duration-500",
        nextAppointment ? "bg-indigo-600 shadow-indigo-200" : "bg-slate-800 shadow-slate-200"
      )}>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full text-[10px] font-bold uppercase tracking-widest border border-white/30 backdrop-blur-sm">
              {nextAppointment ? 'Próxima Sessão' : 'Tudo pronto!'}
            </div>
            <h3 className="text-4xl font-bold tracking-tight">
              {nextAppointment 
                ? new Date(nextAppointment.start_time).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' })
                : "Aguardando seu próximo agendamento"}
            </h3>
            {nextAppointment && (
              <div className="flex items-center gap-6 text-indigo-100 font-medium">
                <div className="flex items-center gap-2 bg-indigo-500/30 px-3 py-1.5 rounded-lg">
                  <Video className="w-4 h-4" /> Videochamada
                </div>
                <div className="flex items-center gap-2 bg-indigo-500/30 px-3 py-1.5 rounded-lg">
                  <Clock className="w-4 h-4" /> 60 minutos
                </div>
              </div>
            )}
          </div>
          {nextAppointment && (
            <button 
              onClick={handleJoinRoom}
              className="bg-white text-indigo-600 px-8 py-5 rounded-2xl font-bold text-lg hover:bg-slate-50 transition-all flex items-center gap-2 h-fit whitespace-nowrap shadow-xl"
            >
              {joining ? (
                <span className="flex items-center gap-2">Conectando... <Clock className="w-5 h-5 animate-spin" /></span>
              ) : (
                <>Acessar Sala do Meet <ChevronRight className="w-5 h-5" /></>
              )}
            </button>
          )}
        </div>
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl group-hover:bg-white/10 transition-all duration-700" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        <div className="space-y-6">
          <h4 className="text-xl font-bold flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-600" /> Histórico Recente
          </h4>
          <div className="space-y-4">
            {history.map((session, i) => (
              <div 
                key={i} 
                onClick={() => navigate('/portal/sessoes')}
                className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between group hover:border-indigo-100 hover:shadow-md transition-all cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-slate-50 flex flex-col items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                    <span className="text-[10px] font-bold uppercase">{new Date(session.start_time).toLocaleDateString('pt-BR', { month: 'short' })}</span>
                    <span className="text-lg font-bold leading-none">{new Date(session.start_time).getDate()}</span>
                  </div>
                  <div>
                    <p className="font-bold text-slate-800">{session.therapists?.name}</p>
                    <p className="text-xs text-slate-500 font-medium">Sessão Realizada</p>
                  </div>
                </div>
                <div className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-bold uppercase tracking-wider">Realizada</div>
              </div>
            ))}
            {history.length === 0 && <div className="py-10 text-center text-slate-400 font-medium bg-slate-50 rounded-3xl border border-dashed border-slate-200">Sem histórico de sessões.</div>}
          </div>
        </div>

        <div className="space-y-6">
          <h4 className="text-xl font-bold flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" /> Cobranças e Recibos
          </h4>
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
            <div className="space-y-4">
              {stats.lastPaid > 0 && (
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                  <div>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Último Pagamento</p>
                    <p className="font-bold text-slate-800">R$ {Number(stats.lastPaid).toLocaleString('pt-BR')}</p>
                  </div>
                  <button onClick={() => navigate('/portal/financeiro')} className="text-xs font-bold text-indigo-600 hover:underline">Ver Recibo</button>
                </div>
              )}
              {stats.pending > 0 ? (
                <div className="flex items-center justify-between p-4 bg-amber-50 border border-amber-100 rounded-2xl">
                  <div>
                    <p className="text-xs text-amber-600 font-bold uppercase tracking-wider">Fatura Pendente</p>
                    <p className="text-sm font-bold text-amber-700">R$ {stats.pending.toLocaleString('pt-BR')}</p>
                  </div>
                  <button onClick={() => navigate('/portal/financeiro')} className="px-4 py-2 bg-white text-amber-600 rounded-xl text-[10px] font-bold uppercase border border-amber-200">Pagar agora</button>
                </div>
              ) : (
                <div className="flex items-center justify-between p-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl">
                  <div>
                    <p className="text-xs text-emerald-600 font-bold uppercase tracking-wider">Tudo em dia!</p>
                    <p className="text-sm font-medium text-emerald-700">Não há faturas pendentes.</p>
                  </div>
                  <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                </div>
              )}
            </div>
            <button 
              onClick={() => navigate('/portal/financeiro')}
              className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold text-sm tracking-wide hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
            >
              Acessar Histórico Financeiro
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
