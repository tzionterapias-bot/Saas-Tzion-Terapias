import React from 'react';
import { Calendar, Video, Clock, ChevronRight, FileText } from 'lucide-react';

import { useNavigate } from 'react-router-dom';

export default function PatientDashboard() {
  const navigate = useNavigate();
  const [joining, setJoining] = React.useState(false);

  const handleJoinRoom = () => {
    setJoining(true);
    setTimeout(() => {
      window.open('https://meet.google.com/ais-demo', '_blank');
      setJoining(false);
    }, 1500);
  };

  return (
    <div className="space-y-10">
      {/* Next Appointment Card */}
      <div className="bg-indigo-600 rounded-[2.5rem] p-10 text-white shadow-2xl shadow-indigo-200 relative overflow-hidden group">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full text-[10px] font-bold uppercase tracking-widest border border-white/30 backdrop-blur-sm">
              Próxima Sessão
            </div>
            <h3 className="text-4xl font-bold tracking-tight">Quarta-feira, 05 de Maio às 14:00</h3>
            <div className="flex items-center gap-6 text-indigo-100 font-medium">
              <div className="flex items-center gap-2 bg-indigo-500/30 px-3 py-1.5 rounded-lg">
                <Video className="w-4 h-4" /> Videochamada
              </div>
              <div className="flex items-center gap-2 bg-indigo-500/30 px-3 py-1.5 rounded-lg">
                <Clock className="w-4 h-4" /> 60 minutos
              </div>
            </div>
          </div>
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
        </div>
        
        {/* Abstract pattern */}
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl group-hover:bg-white/10 transition-all duration-700" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        {/* Recent Session History */}
        <div className="space-y-6">
          <h4 className="text-xl font-bold flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-600" /> Histórico Recente
          </h4>
          <div className="space-y-4">
            {[
              { date: '28 de Abr', type: 'Sessão Online', professional: 'Dra. Ana Silva', status: 'Realizada' },
              { date: '21 de Abr', type: 'Sessão Online', professional: 'Dra. Ana Silva', status: 'Realizada' },
              { date: '14 de Abr', type: 'Sessão Online', professional: 'Dra. Ana Silva', status: 'Realizada' },
            ].map((session, i) => (
              <div 
                key={i} 
                onClick={() => navigate('/portal/sessoes')}
                className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between group hover:border-indigo-100 hover:shadow-md transition-all cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-slate-50 flex flex-col items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                    <span className="text-[10px] font-bold uppercase">{session.date.split(' ').slice(2).join('')}</span>
                    <span className="text-lg font-bold leading-none">{session.date.split(' ')[0]}</span>
                  </div>
                  <div>
                    <p className="font-bold text-slate-800">{session.professional}</p>
                    <p className="text-xs text-slate-500 font-medium">{session.type}</p>
                  </div>
                </div>
                <div className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-bold uppercase tracking-wider">
                  {session.status}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Finance Quick View */}
        <div className="space-y-6">
          <h4 className="text-xl font-bold flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" /> Cobranças e Recibos
          </h4>
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                <div>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Último Pagamento</p>
                  <p className="font-bold text-slate-800">R$ 150,00</p>
                </div>
                <button 
                  onClick={() => navigate('/portal/financeiro')}
                  className="text-xs font-bold text-indigo-600 hover:underline"
                >
                  Ver NF-e
                </button>
              </div>
              <div className="flex items-center justify-between p-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl">
                <div>
                  <p className="text-xs text-emerald-600 font-bold uppercase tracking-wider">Tudo em dia!</p>
                  <p className="text-sm font-medium text-emerald-700">Não há faturas pendentes.</p>
                </div>
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              </div>
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

import { CheckCircle2 } from 'lucide-react';
