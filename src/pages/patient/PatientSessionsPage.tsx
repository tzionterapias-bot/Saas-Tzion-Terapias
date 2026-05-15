import React from 'react';
import { Calendar, Clock, MapPin, Video, ChevronRight, History } from 'lucide-react';

const mySessions = [
  { id: 1, date: '05 de Mai', hour: '14:00', professional: 'Dra. Ana Silva', type: 'Videochamada', status: 'Agendada' },
  { id: 2, date: '28 de Abr', hour: '14:00', professional: 'Dra. Ana Silva', type: 'Videochamada', status: 'Realizada' },
  { id: 3, date: '21 de Abr', hour: '14:00', professional: 'Dra. Ana Silva', type: 'Videochamada', status: 'Realizada' },
  { id: 4, date: '14 de Abr', hour: '14:00', professional: 'Dra. Ana Silva', type: 'Videochamada', status: 'Realizada' },
];

export default function PatientSessionsPage() {
  const [joining, setJoining] = React.useState(false);

  const handleJoin = () => {
    setJoining(true);
    setTimeout(() => {
      window.open('https://meet.google.com/ais-demo', '_blank');
      setJoining(false);
    }, 1500);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Minhas Sessões</h2>
          <p className="text-slate-500 font-medium">Consulte seus agendamentos e histórico de terapias.</p>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-100 bg-slate-50/30 flex items-center gap-3">
          <Calendar className="w-5 h-5 text-indigo-600" />
          <h3 className="font-bold text-slate-900">Agenda Próxima</h3>
        </div>
        <div className="p-8">
           <div className="bg-indigo-50 border border-indigo-100 rounded-3xl p-8 flex flex-col md:flex-row items-center justify-between gap-6">
             <div className="flex items-center gap-6">
                <div className="w-16 h-16 rounded-2xl bg-white flex flex-col items-center justify-center text-indigo-600 shadow-sm">
                   <span className="text-[10px] font-bold uppercase">MAI</span>
                   <span className="text-2xl font-bold leading-none">05</span>
                </div>
                <div>
                   <p className="font-bold text-slate-900 text-lg">Sessão Regular Individual</p>
                   <div className="flex items-center gap-4 mt-1 text-sm text-slate-500 font-medium">
                      <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> 14:00</span>
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

      <div className="space-y-6">
        <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
           <History className="w-5 h-5 text-indigo-600" /> Histórico Completo
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {mySessions.filter(s => s.status === 'Realizada').map((s) => (
            <div key={s.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:border-indigo-100 hover:shadow-md transition-all group">
               <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-slate-50 flex flex-col items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                     <span className="text-[10px] font-bold uppercase">{s.date.split(' ')[2]}</span>
                     <span className="text-lg font-bold leading-none">{s.date.split(' ')[0]}</span>
                  </div>
                  <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-bold uppercase">Realizada</span>
               </div>
               <div className="space-y-1">
                  <p className="font-bold text-slate-800">{s.professional}</p>
                  <p className="text-sm text-slate-500 font-medium">Sessão de Psicoterapia • 60min</p>
               </div>
               <div className="mt-4 pt-4 border-t border-slate-50 flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-400 uppercase">Recibo Disponível</span>
                  <button className="text-xs font-bold text-indigo-600 hover:underline">Ver Detalhes</button>
               </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
