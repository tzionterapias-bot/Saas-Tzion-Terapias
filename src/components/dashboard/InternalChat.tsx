import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { MessageSquare, X, Send, ChevronLeft, Stethoscope, Banknote, ShoppingCart, Shield, Headset } from 'lucide-react';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/contexts/AuthContext';
import { cn } from '@/src/lib/utils';

interface Message {
  id: string;
  sender_id?: string;
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

interface PresenceUser {
  id: string;
  name: string;
  role: string;
  therapist_id?: string | null;
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



const READ_KEY = (userId: string) => `internalChat_readTimestamps_${userId}`;

const getChannelId = (uId: string, cId: string) => {
  return [uId, cId].sort().join('_');
};

export default function InternalChat() {
  const { user } = useAuth();
  const [isOpen, setIsOpen]                       = useState(false);
  const [view, setView]                           = useState<'contacts' | 'chat'>('contacts');
  const [activeContact, setActiveContact]         = useState<Contact | null>(null);
  const [messages, setMessages]                   = useState<Message[]>([]);
  const [therapists, setTherapists]               = useState<any[]>([]);
  const [newMessage, setNewMessage]               = useState('');
  const [unreadCount, setUnreadCount]             = useState(0);
  const [contactUnreadMap, setContactUnreadMap]   = useState<Record<string, number>>({});
  const [onlineUsers, setOnlineUsers]             = useState<PresenceUser[]>([]);

  const messagesEndRef    = useRef<HTMLDivElement>(null);
  const processedMsgIds   = useRef<Set<string>>(new Set());
  const readTimestampsRef = useRef<Record<string, string>>({});
  const isOpenRef         = useRef(isOpen);
  const activeContactRef  = useRef<Contact | null>(activeContact);

  useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);
  useEffect(() => { activeContactRef.current = activeContact; }, [activeContact]);

  const saveReadTimestamps = useCallback(() => {
    if (!user?.id) return;
    localStorage.setItem(READ_KEY(user.id), JSON.stringify(readTimestampsRef.current));
  }, [user?.id]);

  const markChannelRead = useCallback((channelId: string) => {
    // Adiciona 1 minuto ao tempo atual para evitar problemas de fuso/delay do relógio do banco de dados
    const futureDate = new Date();
    futureDate.setMinutes(futureDate.getMinutes() + 1);
    readTimestampsRef.current[channelId] = futureDate.toISOString();
    saveReadTimestamps();
    setContactUnreadMap(prev => {
      const count = prev[channelId] || 0;
      if (count > 0) setUnreadCount(total => Math.max(0, total - count));
      return { ...prev, [channelId]: 0 };
    });
  }, [saveReadTimestamps]);

  const isMessageUnread = useCallback((msg: Message): boolean => {
    if (!user) return false;
    if (msg.sender_id && msg.sender_id === user.id) return false;
    if (!msg.sender_id && msg.sender_name === user.name) return false;
    if (processedMsgIds.current.has(msg.id)) return false;
    const lastRead = readTimestampsRef.current[msg.channel];
    if (lastRead && new Date(msg.created_at) <= new Date(lastRead)) return false;
    return true;
  }, [user]);

  const triggerNotification = useCallback((msg: Message, isRealtime: boolean) => {
    if (!user) return;
    if (!isMessageUnread(msg)) return;
    
    // Validar se a mensagem pertence a um canal válido (evita contar canais inativos ou bugados)
    if (!msg.channel.includes(user.id)) return;

    processedMsgIds.current.add(msg.id);
    const activeChannel = activeContactRef.current ? getChannelId(user.id, activeContactRef.current.id) : null;
    if (isOpenRef.current && activeChannel === msg.channel) {
      markChannelRead(msg.channel);
      return;
    }
    setUnreadCount(prev => prev + 1);
    setContactUnreadMap(prev => ({ ...prev, [msg.channel]: (prev[msg.channel] || 0) + 1 }));
    if (isRealtime) {
      playChimeSound();
      window.dispatchEvent(new CustomEvent('new-chat-message', {
        detail: {
          title: `Mensagem de ${msg.sender_name}`,
          description: `"${msg.content.substring(0, 50)}${msg.content.length > 50 ? '...' : ''}"`
        }
      }));
    }
  }, [user, isMessageUnread, markChannelRead]);

  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, name, role')
      .neq('status', 'inativo')
      .in('role', ['admin', 'terapeuta', 'atendimento', 'financeiro', 'comercial'])
      .then(({ data }) => {
        setTherapists(data || []);
      });
  }, []);

  const therapistContacts: Contact[] = useMemo(() => therapists
    .filter(t => t.id !== user?.id)
    .map(t => {
      const roleLabel =
        t.role === 'admin'      ? 'ADMINISTRADOR' :
        t.role === 'atendimento' ? 'SECRETARIA' :
        t.role === 'financeiro'  ? 'FINANCEIRO' :
        t.role === 'comercial'   ? 'COMERCIAL' : 'TERAPEUTA';

      let icon = <Stethoscope className="w-5 h-5" />;
      let color = 'bg-violet-500';

      if (t.role === 'admin') {
        icon = <Shield className="w-5 h-5" />;
        color = 'bg-rose-500';
      } else if (t.role === 'atendimento') {
        icon = <Headset className="w-5 h-5" />;
        color = 'bg-blue-500';
      } else if (t.role === 'financeiro') {
        icon = <Banknote className="w-5 h-5" />;
        color = 'bg-emerald-500';
      } else if (t.role === 'comercial') {
        icon = <ShoppingCart className="w-5 h-5" />;
        color = 'bg-amber-500';
      }

      return {
        id: t.id,
        name: t.name || 'Usuário',
        role: roleLabel,
        icon,
        color,
      };
    }), [therapists, user?.id]);

  useEffect(() => {
    const handler = (e: Event) => {
      const { contactId } = (e as CustomEvent).detail;
      const t = therapistContacts.find(c => c.id === contactId);
      if (t) openContact(t);
      setIsOpen(true);
    };
    window.addEventListener('open-internal-chat', handler);
    return () => window.removeEventListener('open-internal-chat', handler);
  }, [therapistContacts]);

  useEffect(() => {
    const channel = supabase
      .channel('internal_messages:realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'internal_messages' }, (payload) => {
        const newMsg = payload.new as Message;
        const activeChannel = activeContactRef.current ? getChannelId(user?.id || '', activeContactRef.current.id) : null;
        if (activeChannel === newMsg.channel) {
          setMessages(prev => {
            if (prev.find(m => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
        triggerNotification(newMsg, true);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [triggerNotification]);

  useEffect(() => {
    if (!user) return;
    const room = supabase.channel('presence:online-users', { config: { presence: { key: user.id } } });
    room
      .on('presence', { event: 'sync' }, () => {
        const state = room.presenceState<PresenceUser>();
        const users: PresenceUser[] = [];
        for (const key of Object.keys(state)) {
          const presences = state[key] as any[];
          if (presences?.length > 0) users.push(presences[0] as PresenceUser);
        }
        setOnlineUsers(users);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          const { data: therapistData } = await supabase
            .from('therapists').select('id').eq('user_id', user.id).maybeSingle();
          await room.track({
            id: user.id, name: user.name, role: user.role,
            therapist_id: therapistData?.id ?? null,
          } as PresenceUser);
        }
      });
    return () => { supabase.removeChannel(room); };
  }, [user]);

  useEffect(() => {
    if (!activeContact || !user?.id) return;
    const fetchMessages = async () => {
      const channelId = getChannelId(user.id, activeContact.id);
      const { data, error } = await supabase
        .from('internal_messages').select('*')
        .eq('channel', channelId)
        .order('created_at', { ascending: true }).limit(100);
      if (!error && data) {
        setMessages(data);
        data.forEach((m: Message) => processedMsgIds.current.add(m.id));
      }
    };
    fetchMessages();
  }, [activeContact]);

  useEffect(() => {
    if (!user?.id) return;
    const stored = localStorage.getItem(READ_KEY(user.id));
    if (stored) { try { readTimestampsRef.current = JSON.parse(stored); } catch {} }
    const countUnread = async () => {
      const { data } = await supabase.from('internal_messages').select('*')
        .like('channel', `%${user.id}%`) // Only fetch channels containing the user
        .order('created_at', { ascending: false }).limit(50);
      if (!data) return;
      data.forEach((msg: Message) => {
        const isOwn = msg.sender_id === user.id || (!msg.sender_id && msg.sender_name === user.name);
        const lastRead = readTimestampsRef.current[msg.channel];
        const alreadyRead = lastRead && new Date(msg.created_at) <= new Date(lastRead);
        if (isOwn || alreadyRead) processedMsgIds.current.add(msg.id);
      });
      const unreadMap: Record<string, number> = {};
      let totalUnread = 0;
      data.forEach((msg: Message) => {
        if (!processedMsgIds.current.has(msg.id)) {
          unreadMap[msg.channel] = (unreadMap[msg.channel] || 0) + 1;
          totalUnread++;
          processedMsgIds.current.add(msg.id);
        }
      });
      setContactUnreadMap(unreadMap);
      setUnreadCount(totalUnread);
    };
    countUnread();
  }, [user?.id]);

  useEffect(() => {
    if (isOpen && view === 'chat' && activeContact) {
      markChannelRead(activeContact.id);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, [isOpen, view, messages, activeContact, markChannelRead]);

  const openContact = (contact: Contact) => {
    setActiveContact(contact);
    setMessages([]);
    setView('chat');
    if (user?.id) {
      markChannelRead(getChannelId(user.id, contact.id));
    }
  };

  const handleBack = () => { setView('contacts'); setActiveContact(null); setMessages([]); };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || !activeContact) return;
    const content = newMessage.trim();
    setNewMessage('');

    const channelId = getChannelId(user.id, activeContact.id);

    const { error } = await supabase.from('internal_messages').insert({
      sender_id: user.id, sender_name: user.name || 'Usuario',
      sender_role: user.role || 'Membro', content, channel: channelId,
    });
    if (error) {
      console.error('Erro ao enviar mensagem interna:', error);
      alert('Erro ao enviar mensagem. Verifique o script supabase_internal_messages.sql no Supabase.');
    }
  };

  const isTherapistOnline = (contact: Contact) => onlineUsers.some(u => u.therapist_id === contact.id || u.id === contact.id);
  const onlineCount = onlineUsers.filter(u => u.id !== user?.id).length;

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end">
      {isOpen && (
        <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-[360px] sm:w-[400px] h-[560px] mb-4 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className="bg-indigo-600 px-5 py-4 text-white flex items-center gap-3">
            {view === 'chat' && (
              <button onClick={handleBack} className="p-1.5 hover:bg-white/20 rounded-full transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <div className={cn('w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0', view === 'chat' && activeContact ? activeContact.color : 'bg-white/20')}>
              {view === 'chat' && activeContact ? activeContact.icon : <MessageSquare className="w-5 h-5 text-white" />}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-sm leading-none truncate">
                {view === 'chat' && activeContact ? activeContact.name : 'Chat da Clínica'}
              </h3>
              <p className="text-[10px] text-indigo-200 uppercase tracking-widest font-bold mt-0.5">
                {view === 'chat' && activeContact ? activeContact.role : onlineCount > 0 ? `${onlineCount} online agora` : 'Comunicação Interna'}
              </p>
            </div>
            <button onClick={() => setIsOpen(false)} className="p-1.5 hover:bg-white/20 rounded-full transition-colors flex-shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>

          {view === 'contacts' && (
            <div className="flex-1 overflow-y-auto">
              {therapistContacts.length > 0 ? (
                <div className="px-4 pt-4 pb-4">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1 mb-2">EQUIPE</p>
                  <div className="space-y-1">
                    {therapistContacts.map(c => {
                      const channelId = user?.id ? getChannelId(user.id, c.id) : c.id;
                      const unread = contactUnreadMap[channelId] || 0;
                      const isOnline = isTherapistOnline(c);
                      return (
                        <button key={c.id} onClick={() => openContact(c)} className="w-full flex items-center justify-between p-3 rounded-2xl hover:bg-indigo-50 transition-all text-left group">
                          <div className="flex items-center gap-3">
                            <div className={cn('w-10 h-10 rounded-full flex items-center justify-center text-white flex-shrink-0 font-bold text-sm relative', c.color)}>
                              {c.name.charAt(0)}
                              {isOnline && <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-400 border-2 border-white rounded-full shadow-sm" />}
                            </div>
                            <div>
                              <p className="font-bold text-slate-800 text-sm group-hover:text-indigo-700">{c.name}</p>
                              <p className={cn('text-[10px] font-bold uppercase', isOnline ? 'text-emerald-500' : 'text-slate-400')}>
                                {isOnline ? '● Online' : c.role}
                              </p>
                            </div>
                          </div>
                          {unread > 0 && (
                            <span className="px-2 py-0.5 bg-rose-500 text-white rounded-full text-[10px] font-extrabold shadow-sm animate-pulse">
                              {unread} pendente{unread > 1 ? 's' : ''}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-16 space-y-2">
                  <MessageSquare className="w-8 h-8 opacity-30" />
                  <p className="text-sm font-medium">Nenhum membro encontrado.</p>
                </div>
              )}
            </div>
          )}

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
                  const isMe = (msg.sender_id && msg.sender_id === user?.id) || msg.sender_name === user?.name;
                  return (
                    <div key={msg.id} className={cn('flex flex-col', isMe ? 'items-end' : 'items-start')}>
                      {!isMe && (
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-[10px] font-bold text-slate-500">{msg.sender_name}</span>
                          <span className={cn('text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-md',
                            msg.sender_role === 'terapeuta' ? 'bg-violet-100 text-violet-700' : 'bg-indigo-100 text-indigo-700'
                          )}>{msg.sender_role}</span>
                        </div>
                      )}
                      <div className={cn('px-4 py-2.5 rounded-2xl max-w-[85%] text-sm font-medium shadow-sm',
                        isMe ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-white border border-slate-200 text-slate-700 rounded-tl-sm'
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
              <div className="p-4 bg-white border-t border-slate-100">
                <form onSubmit={handleSend} className="flex items-center gap-2">
                  <input
                    type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)}
                    placeholder={`Mensagem para ${activeContact?.name}...`}
                    className="flex-1 bg-slate-100 border-none outline-none rounded-full px-5 py-3 text-sm font-medium text-slate-700 focus:ring-2 focus:ring-indigo-500"
                    autoFocus
                  />
                  <button type="submit" disabled={!newMessage.trim()}
                    className="p-3 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:opacity-40 transition-all shadow-md">
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      )}

      <button onClick={() => setIsOpen(!isOpen)}
        className="w-16 h-16 bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-xl shadow-indigo-200 hover:bg-indigo-700 hover:scale-105 transition-all relative">
        {isOpen ? <X className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
        {!isOpen && unreadCount > 0 && (
          <div className="absolute -top-1 -right-1 w-6 h-6 bg-rose-500 text-white rounded-full flex items-center justify-center text-[11px] font-black border-2 border-white animate-bounce">
            {unreadCount > 99 ? '99+' : unreadCount}
          </div>
        )}
        {!isOpen && onlineCount > 0 && unreadCount === 0 && (
          <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-400 border-2 border-white rounded-full" />
        )}
      </button>
    </div>
  );
}
