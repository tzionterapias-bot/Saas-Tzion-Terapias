import React from 'react';
import { Calendar as CalendarIcon, Clock, User, ChevronLeft, ChevronRight, Video, MapPin, MoreHorizontal, X } from 'lucide-react';
import { cn } from '@/src/lib/utils';

const hours = Array.from({ length: 12 }, (_, i) => `${i + 8}:00`);
const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const events = [
  { hour: '09:00', patient: 'João Oliveira', therapist: 'Dra. Ana Silva', type: 'Presencial' },
  { hour: '14:00', patient: 'Maria Santos', therapist: 'Dra. Ana Silva', type: 'Online' },
  { hour: '11:00', patient: 'Ana Costa', therapist: 'Dr. Roberto Costa', type: 'Presencial' },
];

export default function AgendaManager() {
  const [showModal, setShowModal] = React.useState(false);
  const [dailyEvents, setDailyEvents] = React.useState(events);

  const handleAddAppointment = () => {
    const newEvent = { hour: '16:00', patient: 'Novo Paciente', therapist: 'Dra. Ana Silva', type: 'Online' };
    setDailyEvents([...dailyEvents, newEvent]);
    alert('Agendamento realizado com sucesso!');
    setShowModal(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <button className="p-2 hover:bg-slate-100 rounded-lg transition-colors"><ChevronLeft className="w-5 h-5 text-slate-400" /></button>
            <h2 className="text-xl font-bold text-slate-800">Maio, 2026</h2>
            <button className="p-2 hover:bg-slate-100 rounded-lg transition-colors"><ChevronRight className="w-5 h-5 text-slate-400" /></button>
          </div>
          <button className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-bold hover:bg-slate-50 transition-colors">Hoje</button>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button className="px-4 py-1.5 text-sm font-bold bg-white shadow-sm rounded-lg">Dia</button>
            <button className="px-4 py-1.5 text-sm font-bold text-slate-500 hover:text-slate-700">Semana</button>
            <button className="px-4 py-1.5 text-sm font-bold text-slate-500 hover:text-slate-700">Mês</button>
          </div>
          <button 
            onClick={() => setShowModal(true)}
            className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all active:scale-95"
          >
            + Novo Agendamento
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px rounded-[2rem] overflow-hidden border border-slate-200 shadow-sm bg-slate-200">
        {weekDays.map((day) => (
          <div key={day} className="bg-slate-50 p-4 text-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{day}</span>
          </div>
        ))}
        {Array.from({ length: 35 }, (_, i) => (
          <div key={i} className={`bg-white h-32 p-3 hover:bg-indigo-50/30 transition-all group relative cursor-pointer ${i < 3 || i > 33 ? 'opacity-30 bg-slate-50/50' : ''}`}>
            <span className={`text-sm font-bold ${i === 7 ? 'bg-indigo-600 text-white w-7 h-7 flex items-center justify-center rounded-lg shadow-lg shadow-indigo-100' : 'text-slate-600'}`}>
              {i % 31 + 1}
            </span>
            {i === 7 && (
              <div className="mt-2 space-y-1">
                <div className="px-2 py-1 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded text-[9px] font-bold truncate">
                  09:00 - João Oliveira
                </div>
                <div className="px-2 py-1 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded text-[9px] font-bold truncate">
                  14:00 - Maria Santos
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Daily Sessions List and Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
          <h3 className="text-xl font-bold text-slate-900 tracking-tight">Sessões do Dia (05/05/2026)</h3>
          <div className="space-y-4">
            {dailyEvents.map((event, i) => (
              <div key={i} className="group p-6 border border-slate-100 rounded-3xl hover:border-indigo-200 hover:bg-slate-50/50 transition-all flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="text-indigo-600 font-mono font-bold text-xl">{event.hour}</div>
                  <div className="h-10 w-px bg-slate-200" />
                  <div>
                    <h4 className="font-bold text-lg text-slate-900 group-hover:text-indigo-600 transition-colors">{event.patient}</h4>
                    <p className="text-sm text-slate-500 font-medium">{event.therapist}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest",
                    event.type === 'Online' ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-400'
                  )}>
                    {event.type === 'Online' ? <Video className="w-3.5 h-3.5" /> : <MapPin className="w-3.5 h-3.5" />}
                    {event.type}
                  </div>
                  <button className="p-2 hover:bg-slate-200 rounded-xl transition-colors text-slate-400">
                    <MoreHorizontal className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-indigo-600 p-8 rounded-[2.5rem] text-white shadow-xl shadow-indigo-100 relative overflow-hidden">
            <div className="relative z-10">
              <h4 className="font-bold text-xl mb-6">Resumo Semanal</h4>
              <div className="space-y-6">
                {[
                  { label: 'Sessões Agendadas', val: '42' },
                  { label: 'Novos Pacientes', val: '08' },
                  { label: 'Horas Totais', val: '25h' },
                ].map((stat, i) => (
                  <div key={i} className="flex justify-between items-end border-b border-white/10 pb-4 last:border-0 last:pb-0">
                    <p className="text-indigo-100/70 text-xs font-bold uppercase tracking-widest">{stat.label}</p>
                    <p className="text-4xl font-bold">{stat.val}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
          </div>
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 text-center space-y-4">
            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto text-slate-300">
              <CalendarIcon className="w-8 h-8" />
            </div>
            <p className="text-slate-500 text-sm font-medium leading-relaxed">As agendas são integradas automaticamente com o <strong>Google Calendar</strong> para avisos de choque de horários.</p>
          </div>
        </div>
      </div>

      {/* New Appointment Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] w-full max-w-xl shadow-2xl border border-slate-100 overflow-hidden">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-2xl font-bold text-slate-900 tracking-tight">Novo Agendamento</h3>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-50 rounded-full transition-colors text-slate-400">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Paciente</label>
                <select className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium appearance-none">
                  <option>Selecione um paciente...</option>
                  <option>João Oliveira</option>
                  <option>Maria Santos</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Data</label>
                  <input type="date" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Horário</label>
                  <input type="time" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium" />
                </div>
              </div>
              <button 
                onClick={handleAddAppointment}
                className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-bold shadow-xl shadow-indigo-100 transition-all hover:bg-indigo-700 active:scale-95"
              >
                Confirmar Agendamento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
