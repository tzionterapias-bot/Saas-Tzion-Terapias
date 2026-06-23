import React from 'react';
import { Search, Filter, Clock, MoreVertical, MessageCircle, RefreshCw, User } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { supabase } from '@/src/lib/supabase';

export interface Ticket {
  id: string;
  customerName: string;
  phone: string;
  lastMessage: string;
  time: string;
  status: 'waiting' | 'open' | 'closed';
  departmentId: string;
  departmentName?: string;
  instanceId?: string;
  category?: string;
  unreadCount?: number;
}

interface Props {
  activeTicketId?: string;
  onSelectTicket: (ticket: Ticket) => void;
  filterDeptId: string;
  view: 'meus' | 'fila' | 'finalizados';
}

import NewTicketModal from './NewTicketModal';
import { Plus } from 'lucide-react';

// Função auxiliar para formatar o número e criar iniciais
function formatPhone(phone: string) {
  if (!phone) return 'Sem número';
  let clean = phone.replace(/\D/g, '');
  if (clean.length > 13) clean = clean.substring(0, 13);
  if (clean.length === 12 || clean.length === 13) {
    const cc = clean.substring(0, 2);
    const ddd = clean.substring(2, 4);
    const num = clean.substring(4);
    if (num.length === 9) {
      return `+${cc} (${ddd}) ${num.substring(0, 5)}-${num.substring(5)}`;
    }
    return `+${cc} (${ddd}) ${num.substring(0, 4)}-${num.substring(4)}`;
  }
  return phone;
}

function getInitials(name: string) {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

export default function TicketList({ activeTicketId, onSelectTicket, filterDeptId, view }: Props) {
  const [tickets, setTickets] = React.useState<Ticket[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [showNewTicketModal, setShowNewTicketModal] = React.useState(false);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('service_tickets')
        .select('*, departments(name)')
        .order('updated_at', { ascending: false });

      if (filterDeptId !== 'all') {
        query = query.eq('department_id', filterDeptId);
      }

      if (view === 'meus') {
        query = query.eq('status', 'open');
      } else if (view === 'fila') {
        query = query.eq('status', 'waiting');
      } else if (view === 'finalizados') {
        query = query.eq('status', 'closed');
      }

      const { data, error } = await query;

      if (error) throw error;

      const formatted: Ticket[] = (data || []).map(t => {
        // Limpa o @s.whatsapp.net se existir
        let cleanPhone = t.customer_phone || '';
        if (cleanPhone.includes('@')) {
          cleanPhone = cleanPhone.split('@')[0];
        }
        
        return {
          id: t.id,
          customerName: t.customer_name || 'Cliente s/ Nome',
          phone: cleanPhone,
          lastMessage: t.last_message || 'Iniciando atendimento...',
          time: new Date(t.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: t.status,
          departmentId: t.department_id,
          departmentName: t.departments?.name,
          instanceId: t.instance_id,
          category: t.category,
          unreadCount: 0
        };
      });

      setTickets(formatted);
    } catch (error) {
      console.error('Erro ao buscar tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchTickets();

    const ticketChannel = supabase
      .channel('service_tickets_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_tickets' }, () => {
        fetchTickets();
      })
      .subscribe();

    const msgChannel = supabase
      .channel('global_chat_messages_alert')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload) => {
        const newMsg = payload.new;
        if (newMsg.sender_type === 'customer') {
          const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
          audio.volume = 0.5;
          audio.play().catch(e => console.log('Audio block:', e));
          
          setTickets(prev => prev.map(t => {
            if (t.phone === newMsg.customer_phone || t.phone === newMsg.customer_phone?.split('@')[0]) {
                const isUnread = t.id !== activeTicketId;
                return { 
                  ...t, 
                  unreadCount: isUnread ? (t.unreadCount || 0) + 1 : 0, 
                  lastMessage: newMsg.message_body, 
                  time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                };
            }
            return t;
          }));
        }
      })
      .subscribe();

    const handleLocalUpdate = () => {
      fetchTickets();
    };
    window.addEventListener('ticket-transferred', handleLocalUpdate);

    return () => {
      supabase.removeChannel(ticketChannel);
      supabase.removeChannel(msgChannel);
      window.removeEventListener('ticket-transferred', handleLocalUpdate);
    };
  }, [filterDeptId, view, activeTicketId]);

  const filteredTickets = tickets.filter(t => 
    t.customerName.toLowerCase().includes(search.toLowerCase()) || 
    t.phone.includes(search)
  );

  return (
    <div className="w-full lg:w-[400px] bg-white border-r border-slate-200 flex flex-col h-full overflow-hidden relative z-10 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.05)]">
      <div className="p-5 space-y-4 bg-white border-b border-slate-100 z-20 sticky top-0">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">Atendimentos</h2>
          <div className="flex items-center gap-1.5">
             <button 
               onClick={fetchTickets}
               className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500 hover:text-slate-700"
             >
               <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
             </button>
             <button 
               onClick={() => setShowNewTicketModal(true)}
               className="flex items-center justify-center bg-slate-900 text-white rounded-lg p-2 hover:bg-slate-800 transition-colors shadow-sm"
               title="Novo Chamado"
             >
               <Plus className="w-4 h-4" />
             </button>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 focus:bg-white transition-all outline-none"
            placeholder="Buscar por nome ou fone..."
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50/50">
        {loading && tickets.length === 0 ? (
          <div className="flex justify-center p-10">
             <RefreshCw className="w-6 h-6 text-slate-400 animate-spin" />
          </div>
        ) : (
          filteredTickets.map((ticket) => (
            <button
              key={ticket.id}
              onClick={() => onSelectTicket(ticket)}
              className={cn(
                "w-full p-3.5 rounded-2xl text-left transition-all duration-200 group relative flex gap-3",
                activeTicketId === ticket.id 
                  ? "bg-white shadow-[0_2px_12px_rgb(0,0,0,0.06)] border-transparent ring-1 ring-slate-200 z-10" 
                  : "bg-transparent border border-transparent hover:bg-slate-100 hover:border-slate-200/50"
              )}
            >
              {/* Avatar */}
              <div className="relative shrink-0 mt-0.5">
                <div className={cn(
                  "w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold shadow-sm",
                  activeTicketId === ticket.id
                    ? "bg-slate-900 text-white"
                    : "bg-white text-slate-600 border border-slate-200 group-hover:border-slate-300"
                )}>
                  {getInitials(ticket.customerName)}
                </div>
                <div className={cn(
                  "absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white",
                  ticket.status === 'waiting' ? "bg-amber-400 animate-pulse" : "bg-emerald-500"
                )} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-0.5">
                  <p className="font-bold text-slate-900 text-[14px] truncate pr-2">
                    {ticket.customerName}
                  </p>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-[11px] font-semibold text-slate-400">{ticket.time}</span>
                  </div>
                </div>
                
                <p className={cn(
                  "text-[13px] mb-2 pr-2 text-left whitespace-pre-wrap leading-relaxed",
                  ticket.status === 'waiting' 
                    ? "text-slate-700 font-medium line-clamp-2" 
                    : "text-slate-500 line-clamp-1"
                )}>
                  {ticket.lastMessage}
                </p>
                
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1.5">
                    <MessageCircle className="w-3.5 h-3.5 text-slate-400" />
                    {formatPhone(ticket.phone)}
                  </span>
                  
                  <div className="flex items-center gap-2">
                    {ticket.category && (
                      <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md truncate max-w-[90px]">
                        {ticket.category}
                      </span>
                    )}
                    {ticket.unreadCount ? (
                      <span className="bg-rose-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1.5 shadow-sm animate-in zoom-in">
                        {ticket.unreadCount}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            </button>
          ))
        )}
        
        {!loading && filteredTickets.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center p-10 space-y-3">
             <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
               <MessageCircle className="w-6 h-6 text-slate-300" />
             </div>
             <div>
               <p className="font-semibold text-slate-600 text-sm">Nenhum atendimento</p>
               <p className="text-xs text-slate-400 mt-1">A lista está vazia no momento.</p>
             </div>
          </div>
        )}
      </div>

      {showNewTicketModal && (
        <NewTicketModal 
          onClose={() => setShowNewTicketModal(false)}
          onSuccess={() => {
            setShowNewTicketModal(false);
            fetchTickets();
          }}
          defaultDeptId={filterDeptId}
        />
      )}
    </div>
  );
}
