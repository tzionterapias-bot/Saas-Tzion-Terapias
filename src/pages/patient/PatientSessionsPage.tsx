import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Video, History, Loader2 } from 'lucide-react';
import { supabase } from '@/src/lib/supabase';
import { cn } from '@/src/lib/utils';
import { useAuth } from '@/src/contexts/AuthContext';

export default function PatientSessionsPage() {
  const [joining, setJoining] = useState(false);
  const [loading, setLoading] = useState(true);
  const [next, setNext] = useState<any>(null);
  const [past, setPast] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;
  const { user } = useAuth();

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

      // Próxima sessão
      const { data: nextSessions } = await supabase
        .from('appointments')
        .select('*, therapists(name)')
        .eq('patient_id', patient.id)
        .gte('start_time', new Date().toISOString())
        .order('start_time', { ascending: true })
        .limit(1);
      if (nextSessions && nextSessions.length > 0) setNext(nextSessions[0]);

      // Histórico
      const { data: pastSessions } = await supabase
        .from('appointments')
        .select('*, therapists(name)')
        .eq('patient_id', patient.id)
        .lt('start_time', new Date().toISOString())
        .order('start_time', { ascending: false });
      setPast(pastSessions || []);

    } catch (error) {
      console.error('Erro ao buscar sessões:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = "Minhas Sessões | Tzion Terapias";
    let metaDescription = document.querySelector('meta[name="description"]');
    if (!metaDescription) {
      metaDescription = document.createElement('meta');
      metaDescription.setAttribute('name', 'description');
      document.head.appendChild(metaDescription);
    }
    metaDescription.setAttribute('content', 'Consulte seu histórico de consultas, sessões realizadas e próximas sessões agendadas na Tzion Terapias.');
  }, []);

  useEffect(() => {
    fetchData();
    setCurrentPage(1);
  }, [user]);

  const handleJoin = () => {
    setJoining(true);
    setTimeout(() => {
      window.open(next?.meet_link || 'https://meet.google.com', '_blank');
      setJoining(false);
    }, 1500);
  };

  // Helper para agrupar sessões por mês/ano
  const groupByMonth = (sessions: any[]) => {
    const groups: { [key: string]: any[] } = {};
    sessions.forEach(session => {
      const date = new Date(session.start_time);
      const monthYear = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      const capitalized = monthYear.charAt(0).toUpperCase() + monthYear.slice(1);
      if (!groups[capitalized]) {
        groups[capitalized] = [];
      }
      groups[capitalized].push(session);
    });
    return groups;
  };

  // Cálculos de paginação
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = past.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(past.length / itemsPerPage);
  const groupedSessions = groupByMonth(currentItems);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Minhas Sessões</h2>
          <p className="text-slate-500 font-medium">Consulte seus agendamentos e histórico de terapias.</p>
        </div>
      </div>

      {next && (
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-8 border-b border-slate-100 bg-slate-50/30 flex items-center gap-3">
            <Calendar className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-slate-900">Agenda Próxima</h3>
          </div>
          <div className="p-8">
             <div className="bg-indigo-50 border border-indigo-100 rounded-3xl p-8 flex flex-col md:flex-row items-center justify-between gap-6">
               <div className="flex items-center gap-6">
                  <div className="w-16 h-16 rounded-2xl bg-white flex flex-col items-center justify-center text-indigo-600 shadow-sm">
                     <span className="text-[10px] font-bold uppercase">{new Date(next.start_time).toLocaleDateString('pt-BR', { month: 'short' })}</span>
                     <span className="text-2xl font-bold leading-none">{new Date(next.start_time).getDate()}</span>
                  </div>
                  <div>
                     <p className="font-bold text-slate-900 text-lg">Sessão com {next.therapists?.name}</p>
                     <div className="flex items-center gap-4 mt-1 text-sm text-slate-500 font-medium">
                        <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {new Date(next.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                        <span className="flex items-center gap-1"><Video className="w-4 h-4" /> Videochamada</span>
                     </div>
                  </div>
               </div>
               <button 
                  onClick={handleJoin}
                  className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 min-w-[200px]"
               >
                  {joining ? (
                    <span className="flex items-center gap-2 justify-center">Entrando... <Clock className="w-4 h-4 animate-spin" /></span>
                  ) : 'Acessar Sala do Meet'}
               </button>
             </div>
          </div>
        </div>
      )}

      <div className="space-y-6">
        <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
           <History className="w-5 h-5 text-indigo-600" /> Histórico Completo
        </h3>

        {past.length === 0 ? (
          <div className="py-20 text-center text-slate-400 font-medium bg-slate-50 rounded-[2.5rem] border border-dashed border-slate-200">
            Nenhuma sessão realizada anteriormente.
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedSessions).map(([month, sessions]) => (
              <div key={month} className="space-y-4 animate-in fade-in duration-300">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">{month}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {sessions.map((s: any) => (
                    <div key={s.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:border-indigo-100 hover:shadow-md transition-all group">
                       <div className="flex justify-between items-start mb-4">
                          <div className="w-12 h-12 rounded-2xl bg-slate-50 flex flex-col items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                             <span className="text-[10px] font-bold uppercase">{new Date(s.start_time).toLocaleDateString('pt-BR', { month: 'short' })}</span>
                             <span className="text-lg font-bold leading-none">{new Date(s.start_time).getDate()}</span>
                          </div>
                          <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-bold uppercase">Realizada</span>
                       </div>
                       <div className="space-y-1">
                          <p className="font-bold text-slate-800">{s.therapists?.name}</p>
                          <p className="text-sm text-slate-500 font-medium">Sessão Individual • 60min</p>
                       </div>
                       <div className="mt-4 pt-4 border-t border-slate-50 flex justify-between items-center">
                          <span className="text-xs font-bold text-slate-400 uppercase">Recibo Disponível</span>
                          <button className="text-xs font-bold text-indigo-600 hover:underline">Ver Detalhes</button>
                       </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 mt-8 pt-6 border-t border-slate-100">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-5 py-3 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 bg-white hover:bg-slate-50 hover:border-indigo-200 hover:text-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:border-slate-200 disabled:hover:text-slate-600 transition-all select-none cursor-pointer"
                >
                  Anterior
                </button>
                <span className="text-sm font-black text-slate-500">
                  Página {currentPage} de {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-5 py-3 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 bg-white hover:bg-slate-50 hover:border-indigo-200 hover:text-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:border-slate-200 disabled:hover:text-slate-600 transition-all select-none cursor-pointer"
                >
                  Próximo
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
