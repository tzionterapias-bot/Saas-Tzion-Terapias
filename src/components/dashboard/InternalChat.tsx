import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MessageSquare, X, Send, ChevronLeft, Users, Stethoscope, Banknote, Calendar, ShoppingCart, Shield } from 'lucide-react';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/contexts/AuthContext';
import { cn } from '@/src/lib/utils';

interface Message {
  id: string;
  sender_name: string;
  sender_role: string;
  content: string;
  channel: string;
  created_at: string;
}

interface Contact {
  id: string;
  name: string;
  role: string;
  icon: React.ReactNode;
  color: string;
}

const playChimeSound = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch (e) {}
};

const DEPARTMENT_CONTACTS: Contact[] = [
  { id: 'admin',      name: 'Administração',   role: 'admin',      icon: <Shield className="w-5 h-5" />,      color: 'bg-slate-700' },
  { id: 'atendimento',name: 'Recepção / Agenda',role: 'atendimento',icon: <Calendar className="w-5 h-5" />,     color: 'bg-indigo-500' },
  { id: 'financeiro', name: 'Financeiro',       role: 'financeiro', icon: <Banknote className="w-5 h-5" />,     color: 'bg-emerald-500' },
  { id: 'comercial',  name: 'Comercial',        role: 'comercial',  icon: <ShoppingCart className="w-5 h-5" />, color: 'bg-amber-500' },
];

export default function InternalChat() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<'contacts' | 'chat'>('contacts');
  const [activeContact, setActiveContact] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [therapists, setTherapists] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const processedMsgIds = useRef<Set<string>>(new Set());

  const triggerIncomingNotification = (newMsg: Message) => {
    if (!user) return;
    if (processedMsgIds.current.has(newMsg.id)) return;
    processedMsgIds.current.add(newMsg.id);

    // Ignorar se a mensagem foi enviada pelo próprio usuário
    if (newMsg.sender_name === user.name) return;

    // Tocar sinal sonoro de notificação
    playChimeSound();

    // Notificar no ícone de Sino do Sistema
    window.dispatchEvent(new CustomEvent('new-chat-message', {
      detail: {
        title: `💬 Mensagem de ${newMsg.sender_name}`,
        description: `"${newMsg.content.substring(0, 50)}${newMsg.content.length > 50 ? '...' : ''}"`
      }
    }));

    // Abrir o Popup do Chat automaticamente para o destinatário!
    const senderContact: Contact = {
      id: newMsg.channel,
      name: newMsg.sender_name,
      role: newMsg.sender_role || 'Equipe',
      icon: <Users className="w-5 h-5" />,
      color: 'bg-indigo-600'
    };

    setActiveContact(senderContact);
    setView('chat');
    setIsOpen(true);
  };

  // Fetch therapists to build contact list
  useEffect(() => {
    supabase.from('therapists').select('id, name, specialty').eq('active', true).then(({ data }) => {
      setTherapists(data || []);
    });
  }, []);

  // Build therapistContacts early so useEffect below can use it
  const therapistContacts: Contact[] = useMemo(() => therapists.map(t => ({
    id: t.id,
    name: t.name,
    role: t.specialty || 'Terapeuta',
    icon: <Stethoscope className="w-5 h-5" />,
    color: 'bg-violet-500',
  })), [therapists]);

  // Listen for external trigger (e.g. from session list buttons)
  useEffect(() => {
    const handler = (e: Event) => {
      const { contactId, name, role } = (e as CustomEvent).detail;
      // Find in static departments first
      const dept = DEPARTMENT_CONTACTS.find(c => c.id === contactId);
      if (dept) {
        handleOpenContact(dept);
      } else {
        // Try therapists
        const t = therapistContacts.find(c => c.id === contactId);
        if (t) handleOpenContact(t);
      }
      setIsOpen(true);
    };
    window.addEventListener('open-internal-chat', handler);
    return () => window.removeEventListener('open-internal-chat', handler);
  }, [therapistContacts]);

  // Subscribe to realtime messages
  useEffect(() => {
    const channel = supabase.channel('public:internal_messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'internal_messages' }, (payload) => {
        const newMsg = payload.new as Message;
        setMessages((prev) => {
          if (prev.find(m => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
        
        triggerIncomingNotification(newMsg);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isOpen, activeContact, user]);

  // Fetch messages when opening a channel with polling fallback
  useEffect(() => {
    if (!activeContact) return;

    const fetchChannelMessages = async () => {
      const { data, error } = await supabase
        .from('internal_messages')
        .select('*')
        .eq('channel', activeContact.id)
        .order('created_at', { ascending: true })
        .limit(100);
      
      if (!error && data) {
        setMessages(data);
      }
    };

    fetchChannelMessages();
    const interval = setInterval(fetchChannelMessages, 4000);
    return () => clearInterval(interval);
  }, [activeContact]);

  // Polling de background para abrir popup e notificar no sino mesmo com o chat fechado
  useEffect(() => {
    if (!user) return;
    const checkNewGlobalMessages = async () => {
      const { data } = await supabase
        .from('internal_messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (data) {
        data.reverse().forEach((msg: Message) => {
          triggerIncomingNotification(msg);
        });
      }
    };

    const interval = setInterval(checkNewGlobalMessages, 5000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    if (isOpen && view === 'chat') {
      setUnreadCount(0);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, [isOpen, view, messages]);

  const handleOpenContact = (contact: Contact) => {
    setActiveContact(contact);
    setMessages([]);
    setView('chat');
  };

  const handleBack = () => {
    setView('contacts');
    setActiveContact(null);
    setMessages([]);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || !activeContact) return;
    
    const content = newMessage.trim();
    setNewMessage('');

    // Atualização Otimista (UI instantânea)
    const tempMsg: Message = {
      id: `temp-${Date.now()}`,
      sender_name: user.name || 'Usuário',
      sender_role: user.role || 'Membro',
      content,
      channel: activeContact.id,
      created_at: new Date().toISOString()
    };

    setMessages(prev => [...prev, tempMsg]);

    const { error } = await supabase.from('internal_messages').insert({
      sender_name: user.name || 'Usuário',
      sender_role: user.role || 'Membro',
      content,
      channel: activeContact.id,
    });

    if (error) {
      console.error("Erro ao enviar mensagem interna:", error);
      alert('Erro ao enviar mensagem. Certifique-se de executar o script SQL supabase_internal_messages.sql no Supabase.');
    }
  };

  const allContacts = [...DEPARTMENT_CONTACTS, ...therapistContacts];

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end">
      {/* Chat Window */}
      {isOpen && (
        <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-[360px] sm:w-[400px] h-[540px] mb-4 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 fade-in duration-300">

          {/* ── HEADER ── */}
          <div className="bg-indigo-600 px-5 py-4 text-white flex items-center gap-3">
            {view === 'chat' && (
              <button onClick={handleBack} className="p-1.5 hover:bg-white/20 rounded-full transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <div className={cn("w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0", view === 'chat' && activeContact ? activeContact.color : 'bg-white/20')}>
              {view === 'chat' && activeContact ? activeContact.icon : <MessageSquare className="w-5 h-5 text-white" />}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-sm leading-none truncate">
                {view === 'chat' && activeContact ? activeContact.name : 'Chat da Clínica'}
              </h3>
              <p className="text-[10px] text-indigo-200 uppercase tracking-widest font-bold mt-0.5">
                {view === 'chat' && activeContact ? activeContact.role : 'Comunicação Interna'}
              </p>
            </div>
            <button onClick={() => setIsOpen(false)} className="p-1.5 hover:bg-white/20 rounded-full transition-colors flex-shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* ── CONTACT LIST ── */}
          {view === 'contacts' && (
            <div className="flex-1 overflow-y-auto">
              {/* Departments */}
              <div className="px-4 pt-4 pb-1">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1 mb-2">Departamentos</p>
                <div className="space-y-1">
                  {DEPARTMENT_CONTACTS.map(c => (
                    <button
                      key={c.id}
                      onClick={() => handleOpenContact(c)}
                      className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-indigo-50 transition-all text-left group"
                    >
                      <div className={cn("w-10 h-10 rounded-full flex items-center justify-center text-white flex-shrink-0", c.color)}>
                        {c.icon}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 text-sm group-hover:text-indigo-700">{c.name}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">{c.role}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Therapists */}
              {therapistContacts.length > 0 && (
                <div className="px-4 pt-3 pb-4">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1 mb-2">Terapeutas</p>
                  <div className="space-y-1">
                    {therapistContacts.map(c => (
                      <button
                        key={c.id}
                        onClick={() => handleOpenContact(c)}
                        className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-violet-50 transition-all text-left group"
                      >
                        <div className="w-10 h-10 rounded-full bg-violet-500 flex items-center justify-center text-white flex-shrink-0 font-bold text-sm">
                          {c.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 text-sm group-hover:text-violet-700">{c.name}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">{c.role}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── CHAT MESSAGES ── */}
          {view === 'chat' && (
            <>
              <div className="flex-1 overflow-y-auto p-4 bg-slate-50 space-y-4">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2">
                    <MessageSquare className="w-8 h-8 opacity-40" />
                    <p className="text-sm font-medium">Nenhuma mensagem ainda.</p>
                    <p className="text-xs text-center text-slate-300">Seja o primeiro a enviar uma mensagem!</p>
                  </div>
                ) : messages.map((msg) => {
                  const isMe = msg.sender_name === user?.name;
                  return (
                    <div key={msg.id} className={cn("flex flex-col", isMe ? "items-end" : "items-start")}>
                      {!isMe && (
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-[10px] font-bold text-slate-500">{msg.sender_name}</span>
                          <span className={cn("text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-md",
                            msg.sender_role === 'terapeuta' ? 'bg-violet-100 text-violet-700' : 'bg-indigo-100 text-indigo-700'
                          )}>{msg.sender_role}</span>
                        </div>
                      )}
                      <div className={cn(
                        "px-4 py-2.5 rounded-2xl max-w-[85%] text-sm font-medium shadow-sm",
                        isMe ? "bg-indigo-600 text-white rounded-tr-sm" : "bg-white border border-slate-200 text-slate-700 rounded-tl-sm"
                      )}>
                        {msg.content}
                      </div>
                      <span className="text-[9px] text-slate-400 font-medium mt-1">
                        {new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-4 bg-white border-t border-slate-100">
                <form onSubmit={handleSend} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder={`Mensagem para ${activeContact?.name}...`}
                    className="flex-1 bg-slate-100 border-none outline-none rounded-full px-5 py-3 text-sm font-medium text-slate-700 focus:ring-2 focus:ring-indigo-500"
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={!newMessage.trim()}
                    className="p-3 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:opacity-40 transition-all shadow-md"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      )}

      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-16 h-16 bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-xl shadow-indigo-200 hover:bg-indigo-700 hover:scale-105 transition-all relative"
      >
        {isOpen ? <X className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
        {!isOpen && unreadCount > 0 && (
          <div className="absolute -top-1 -right-1 w-6 h-6 bg-rose-500 text-white rounded-full flex items-center justify-center text-[11px] font-black border-2 border-white animate-bounce">
            {unreadCount > 99 ? '99+' : unreadCount}
          </div>
        )}
      </button>
    </div>
  );
}
