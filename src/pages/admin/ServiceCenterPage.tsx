import React from 'react';
import DepartmentSidebar from '@/src/components/crm/service/DepartmentSidebar';
import TicketList, { Ticket } from '@/src/components/crm/service/TicketList';
import ChatWindow from '@/src/components/crm/service/ChatWindow';
import { MessageSquare } from 'lucide-react';
import { cn } from '@/src/lib/utils';

export default function ServiceCenterPage() {
  const [selectedDeptId, setSelectedDeptId] = React.useState('all');
  const [selectedTicket, setSelectedTicket] = React.useState<Ticket | null>(null);
  const [activeView, setActiveView] = React.useState<'meus' | 'fila' | 'finalizados'>('meus');

  React.useEffect(() => {
    const handleTransfer = (e: any) => {
      // Se o ticket transferido for o que está aberto, nós o fechamos.
      if (selectedTicket && e.detail === selectedTicket.id) {
        setSelectedTicket(null);
      } else if (!selectedTicket) {
        // Se nenhum estiver aberto, apenas limpamos por segurança.
        setSelectedTicket(null);
      }
    };
    window.addEventListener('ticket-transferred', handleTransfer);
    return () => window.removeEventListener('ticket-transferred', handleTransfer);
  }, [selectedTicket]);

  const views = [
    { id: 'meus', label: 'Meus Atendimentos' },
    { id: 'fila', label: 'Fila do Departamento' },
    { id: 'finalizados', label: 'Finalizados' },
  ];

  return (
    <div className="flex h-[calc(100vh-11rem)] lg:h-[calc(100vh-14rem)] min-h-[500px] bg-white/40 backdrop-blur-3xl rounded-[3rem] border border-white/60 overflow-hidden shadow-[0_8px_40px_rgba(0,0,0,0.04)] animate-in fade-in zoom-in-95 duration-500">
      <DepartmentSidebar 
        activeDept={selectedDeptId} 
        onSelect={(id) => {
          setSelectedDeptId(id);
          setSelectedTicket(null);
          // Removemos o reset de aba aqui para que o usuário continue na aba que ele escolheu ver
        }} 
      />
      
      <div className="flex flex-1 flex-col overflow-hidden relative">
        {/* Header de Visualização (Tabs) */}
        <div className="bg-white/60 backdrop-blur-xl border-b border-white/50 p-4 flex items-center justify-center relative z-20">
          <div className="bg-slate-100/80 backdrop-blur-md p-1.5 rounded-2xl flex items-center gap-1 shadow-inner border border-white/20">
            {views.map((view) => (
              <button
                key={view.id}
                onClick={() => setActiveView(view.id as any)}
                className={cn(
                  "px-8 py-2.5 rounded-xl font-bold text-xs transition-all relative overflow-hidden",
                  activeView === view.id 
                    ? "text-indigo-700 shadow-sm bg-white" 
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                )}
              >
                {activeView === view.id && (
                  <span className="absolute inset-0 rounded-xl bg-gradient-to-br from-indigo-500/5 to-purple-500/5 pointer-events-none" />
                )}
                <span className="relative z-10">{view.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden relative">
          <TicketList 
            filterDeptId={selectedDeptId}
            activeTicketId={selectedTicket?.id}
            onSelectTicket={setSelectedTicket}
            view={activeView}
          />
        
        {selectedTicket ? (
          <ChatWindow ticket={selectedTicket} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-transparent p-20 text-center space-y-8 relative overflow-hidden">
             <div className="relative z-10 space-y-6">
                <div className="w-40 h-40 bg-white/80 backdrop-blur-2xl rounded-[4rem] shadow-[0_20px_60px_-15px_rgba(79,70,229,0.3)] flex items-center justify-center mx-auto group hover:scale-110 transition-all duration-700 hover:shadow-[0_20px_60px_-15px_rgba(16,185,129,0.3)] border border-white">
                   <MessageSquare className="w-16 h-16 text-indigo-500 group-hover:rotate-12 transition-transform duration-500 group-hover:text-emerald-500" />
                </div>
                <div>
                   <h3 className="text-3xl font-black text-slate-800 tracking-tight mb-3">Central de Atendimento</h3>
                   <p className="text-slate-500 max-w-sm mx-auto font-medium text-sm leading-relaxed">Selecione um atendimento na lista ao lado para visualizar o histórico de mensagens e responder ao paciente.</p>
                </div>
             </div>
             
             {/* Background Effects Premium */}
             <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/3 pointer-events-none" />
             <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[120px] translate-y-1/3 -translate-x-1/3 pointer-events-none" />
             <div className="absolute top-1/2 left-1/2 w-[800px] h-[800px] bg-white/40 rounded-full blur-[100px] -translate-y-1/2 -translate-x-1/2 pointer-events-none" />
          </div>
        )}
      </div>
    </div>
  </div>
  );
}
