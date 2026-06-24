import React from 'react';
import { Send, Smile, Paperclip, MoreVertical, Phone, Video, CheckCheck, User, Shield, ArrowRightLeft, Loader2, CheckCircle2, AlertCircle, X, ChevronLeft } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { Ticket } from './TicketList';
import { supabase } from '@/src/lib/supabase';
import { sendWhatsAppMessage } from '@/src/lib/whatsapp';

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

interface Message {
  id: string;
  sender: 'staff' | 'customer' | 'bot';
  text: string;
  time: string;
  type?: 'text' | 'image' | 'document';
  mediaUrl?: string;
  status?: 'sent' | 'delivered' | 'read';
}

interface Props {
  ticket: Ticket;
  onBack?: () => void;
}

export default function ChatWindow({ ticket, onBack }: Props) {
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [inputValue, setInputValue] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [showTransferModal, setShowTransferModal] = React.useState(false);
  const [showCloseModal, setShowCloseModal] = React.useState(false);
  const [sendNps, setSendNps] = React.useState(true);
  const [departments, setDepartments] = React.useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = React.useState<string>(ticket.category || '');
  const [toast, setToast] = React.useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleShowToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchMessages = async () => {
    // Pega os últimos 10 dígitos do telefone para busca flexível no banco
    // (Isso resolve o problema do n8n salvar sem o +55 ou sem o @s.whatsapp.net)
    const digitsOnly = ticket.phone.replace(/\D/g, '');
    const shortPhone = digitsOnly.length > 10 ? digitsOnly.slice(-10) : digitsOnly;

    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .or(`customer_phone.eq.${ticket.phone},customer_phone.ilike.%${shortPhone}%`)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Erro ao buscar mensagens:', error);
      return;
    }

    const formatted: Message[] = (data || []).map(m => ({
      id: m.id,
      sender: m.sender_type === 'bot' ? 'bot' : (m.sender_type === 'customer' || m.sender_type === 'customer_nps' ? 'customer' : 'staff'),
      text: m.message_body,
      type: m.message_type || 'text',
      mediaUrl: m.media_url,
      time: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'read'
    }));

    // Se o histórico não trouxer a mensagem original do paciente (ex: pq o n8n não salvou no chat_messages),
    // nós injetamos o last_message do ticket para criar a experiência de WhatsApp
    if (!formatted.some(m => m.sender === 'customer') && ticket.lastMessage && ticket.lastMessage !== 'Iniciando atendimento...') {
      formatted.unshift({
        id: 'initial-ticket-msg',
        sender: 'customer',
        text: ticket.lastMessage,
        time: ticket.time,
        type: 'text'
      });
    }

    setMessages(formatted);
    setTimeout(() => scrollToBottom(), 100);
  };

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  React.useEffect(() => {
    fetchMessages();

    const fetchDepts = async () => {
      const { data } = await supabase.from('departments').select('id, name').order('name');
      setDepartments(data || []);
    };
    fetchDepts();

    const channel = supabase
      .channel(`chat_${ticket.phone}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'chat_messages'
      }, () => {
        fetchMessages();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ticket.phone]);

  const handleSend = async () => {
    if (!inputValue.trim() || loading) return;
    
    setLoading(true);
    const text = inputValue;
    setInputValue('');

    try {
      // 1. Salvar no Supabase
      const { error: dbError } = await supabase
        .from('chat_messages')
        .insert({
          customer_phone: ticket.phone,
          message_body: text,
          sender_type: 'agent',
          message_type: 'text',
          instance_id: ticket.instanceId || 'tzion_terapias'
        });

      if (dbError) throw dbError;

      // 2. Enviar via n8n (Webhook centralizado)
      const deptTag = ticket.departmentName ? `[${ticket.departmentName} - Tzion Terapias]\n\n` : '';
      
      await sendWhatsAppMessage(
        null, // Como é um chat de atendimento, não precisamos atrelar o paciente no log se ele não for paciente cadastrado
        ticket.phone,
        `${deptTag}${text}`,
        'chat_reply'
      );

      // 3. Atualizar status do ticket
      if (ticket.status === 'waiting') {
        await supabase.from('service_tickets').update({ status: 'open' }).eq('id', ticket.id);
      }

    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      handleShowToast('Erro ao enviar mensagem.', 'error');
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Limite de 10MB para segurança
    if (file.size > 10 * 1024 * 1024) {
      handleShowToast('Arquivo muito grande. Limite de 10MB.', 'error');
      return;
    }

    setLoading(true);
    const reader = new FileReader();
    
    reader.onload = async () => {
      try {
        const base64 = (reader.result as string).split(',')[1];
        const isImage = file.type.startsWith('image/');
        const messageType = isImage ? 'image' : 'document';

        // 1. Enviar via n8n
        const deptTag = ticket.departmentName ? `[${ticket.departmentName} - Tzion Terapias]\n\n` : '';
        
        await sendWhatsAppMessage(
          null,
          ticket.phone,
          `${deptTag}Arquivo enviado via Dashboard`,
          'chat_reply',
          {
            base64: base64,
            mimeType: file.type,
            fileName: file.name
          }
        );

        // 2. Salvar no Supabase
        await supabase
          .from('chat_messages')
          .insert({
            customer_phone: ticket.phone,
            message_body: file.name,
            sender_type: 'agent',
            message_type: messageType,
            media_url: reader.result as string, // Salva o base64 para renderizar na tela
            instance_id: ticket.instanceId || 'tzion'
          });

        handleShowToast('Arquivo enviado com sucesso!');
      } catch (error) {
        console.error('Erro ao enviar arquivo:', error);
        handleShowToast('Erro ao enviar arquivo.', 'error');
      } finally {
        setLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    reader.readAsDataURL(file);
  };

  const handleTransfer = async (deptId: string) => {
    const { error } = await supabase
      .from('service_tickets')
      .update({ department_id: deptId })
      .eq('id', ticket.id);

    if (error) {
      handleShowToast('Erro ao transferir ticket', 'error');
    } else {
      handleShowToast('Atendimento transferido com sucesso!');
      setShowTransferModal(false);
      // Dispara um evento global para o TicketList recarregar e o painel fechar o chat
      window.dispatchEvent(new CustomEvent('ticket-transferred', { detail: ticket.id }));
    }
  };

  const handleUpdateCategory = async (category: string) => {
    setSelectedCategory(category);
    const { error } = await supabase
      .from('service_tickets')
      .update({ category })
      .eq('id', ticket.id);
    if (error) {
       console.error(error);
       handleShowToast('Crie a coluna "category" no Supabase primeiro!', 'error');
    } else {
       handleShowToast('Categoria atualizada com sucesso!');
    }
  };

  const handleCloseTicket = async () => {
    setLoading(true);
    try {
      if (sendNps) {
        // Busca a mensagem NPS configurada no painel de CRM
        const { data: npsAuto } = await supabase
          .from('crm_automations')
          .select('settings')
          .eq('trigger_type', 'nps_survey')
          .single();

        let npsMessage = "Obrigado por falar conosco! Seu atendimento foi encerrado.\n\nGostaríamos muito de ouvir sua opinião! Por favor, avalie nosso atendimento respondendo esta mensagem com uma nota de *0 (Jamais recomendaria)* a *10 (Com certeza recomendaria)*.";
        if (npsAuto && npsAuto.settings && npsAuto.settings.message) {
          npsMessage = npsAuto.settings.message;
        }
        
        // Envia via WhatsApp
        await sendWhatsAppMessage(
          null,
          ticket.phone,
          npsMessage,
          'chat_reply'
        );

        // Salva no Supabase para aparecer na tela
        await supabase.from('chat_messages').insert({
          customer_phone: ticket.phone,
          message_body: npsMessage,
          sender_type: 'bot', // Registra como bot para ficar cinza/diferenciado
          message_type: 'text',
          instance_id: ticket.instanceId || 'tzion_terapias'
        });
      }

      const { error } = await supabase
        .from('service_tickets')
        .update({ status: sendNps ? 'awaiting_nps' : 'closed' })
        .eq('id', ticket.id);

      if (error) throw error;

      handleShowToast('Atendimento encerrado com sucesso!');
      setShowCloseModal(false);
    } catch (err) {
      console.error('Erro ao encerrar:', err);
      handleShowToast('Erro ao encerrar atendimento', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-white h-full relative overflow-hidden">
      <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-200 flex flex-col sm:flex-row gap-3 sm:items-center justify-between bg-white z-20 shadow-sm">
        <div className="flex items-center gap-3.5 min-w-0 flex-1">
          {onBack && (
            <button 
              onClick={onBack}
              className="lg:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors shrink-0"
              title="Voltar"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}
          <div className="w-11 h-11 rounded-full bg-slate-900 flex items-center justify-center text-white text-sm font-bold shadow-sm shrink-0">
            {getInitials(ticket.customerName)}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-slate-800 text-[15px] leading-tight mb-0.5 truncate">{ticket.customerName}</h3>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-sm shrink-0" />
              <span className="text-xs font-semibold text-slate-500 truncate">{formatPhone(ticket.phone)}</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end border-t border-slate-100 sm:border-0 pt-2 sm:pt-0 shrink-0">
           <select 
             value={selectedCategory}
             onChange={(e) => handleUpdateCategory(e.target.value)}
             className="text-xs font-bold text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-indigo-300 cursor-pointer"
           >
             <option value="">Sem Categoria</option>
             <option value="Dúvida">Dúvida</option>
             <option value="Suporte Técnico">Suporte Técnico</option>
             <option value="Financeiro/Cobrança">Financeiro/Cobrança</option>
             <option value="Agendamento">Agendamento</option>
             <option value="Reclamação">Reclamação</option>
           </select>

           <div className="w-px h-6 bg-slate-200 mx-1 hidden sm:block"></div>

           <button 
             onClick={() => setShowTransferModal(true)}
             className="flex items-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-all text-xs font-bold text-indigo-600 border border-indigo-100"
           >
             <ArrowRightLeft className="w-4 h-4" /> Transferir
           </button>
           <button 
             onClick={() => setShowCloseModal(true)}
             className="flex items-center gap-2 px-4 py-2 bg-rose-50 hover:bg-rose-100 rounded-xl transition-all text-xs font-bold text-rose-600 border border-rose-100 shadow-sm"
           >
             <X className="w-4 h-4" /> Encerrar
           </button>
        </div>
      </div>

      {/* Messages List */}
      <div 
        className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#efeae2]" 
        ref={scrollRef}
        style={{ backgroundImage: 'url("https://w0.peakpx.com/wallpaper/818/148/HD-wallpaper-whatsapp-background-cool-dark-green-light-pattern-texture.jpg")', backgroundBlendMode: 'soft-light', backgroundSize: '400px', opacity: 0.98 }}
      >
        {messages.map((msg) => (
          <div key={msg.id} className={cn(
            "flex w-full",
            msg.sender === 'customer' ? "justify-start" : "justify-end"
          )}>
            <div className={cn(
              "max-w-[75%] px-3.5 py-2 rounded-xl shadow-[0_1px_1px_rgba(0,0,0,0.1)] relative group",
              msg.sender === 'customer' 
                ? "bg-white text-slate-800 rounded-tl-sm border-none"
                : msg.sender === 'bot' 
                  ? "bg-[#e2e8f0] text-slate-700 rounded-tr-sm border-none"
                  : "bg-[#d9fdd3] text-slate-800 rounded-tr-sm"
            )}>
              {msg.sender === 'bot' && <p className="text-[8px] font-bold uppercase tracking-tighter mb-1 opacity-50">Resposta da IA</p>}
              
              {msg.type === 'image' && msg.mediaUrl ? (
                <div className="mb-2 overflow-hidden rounded-xl border border-slate-200/50 bg-slate-50/50">
                  <img 
                    src={msg.mediaUrl.startsWith('http') || msg.mediaUrl.startsWith('data:') ? msg.mediaUrl : `data:image/jpeg;base64,${msg.mediaUrl}`} 
                    alt="Mídia" 
                    className="w-full max-w-[240px] max-h-[240px] object-cover hover:scale-105 transition-transform cursor-pointer" 
                  />
                </div>
              ) : msg.type === 'audio' && msg.mediaUrl ? (
                <div className="mb-2">
                  <audio 
                    controls 
                    className="max-w-full h-10" 
                    src={msg.mediaUrl.startsWith('http') || msg.mediaUrl.startsWith('data:') ? msg.mediaUrl : `data:audio/ogg;base64,${msg.mediaUrl}`} 
                  />
                </div>
              ) : msg.type === 'document' && msg.mediaUrl ? (
                <a 
                  href={msg.mediaUrl.startsWith('http') || msg.mediaUrl.startsWith('data:') ? msg.mediaUrl : `data:application/pdf;base64,${msg.mediaUrl}`} 
                  target="_blank" 
                  rel="noreferrer" 
                  download="Documento"
                  className="flex items-center gap-3 p-3 bg-black/10 rounded-xl mb-2 hover:bg-black/20 transition-colors"
                >
                  <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                    <Shield className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <p className="text-xs font-bold truncate">{msg.text || 'Documento'}</p>
                    <p className="text-[9px] opacity-70 uppercase font-black">Clique para baixar PDF</p>
                  </div>
                </a>
              ) : null}

              <p className="text-[14.5px] leading-snug whitespace-pre-wrap">{msg.text}</p>
              
              <div className={cn(
                "flex items-center gap-1 mt-1 -mb-1",
                msg.sender === 'customer' ? "justify-end" : "justify-end"
              )}>
                <span className={cn(
                  "text-[10px] font-medium",
                  msg.sender === 'customer' ? "text-slate-400" : "text-slate-500"
                )}>{msg.time}</span>
                {msg.sender !== 'customer' && <CheckCheck className="w-3.5 h-3.5 text-blue-500" />}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-[#f0f2f5] border-t border-slate-200 z-20">
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileUpload} 
          className="hidden" 
          accept="image/*,.pdf"
        />
        
        <div className="max-w-4xl mx-auto flex items-end gap-3">
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            className="p-3 text-slate-500 hover:text-slate-700 transition-colors"
          >
            <Paperclip className="w-6 h-6" />
          </button>

          <div className="flex-1 flex items-end gap-2 bg-white px-4 py-1.5 rounded-2xl border border-transparent focus-within:border-white transition-all shadow-sm">
            <textarea 
              rows={1}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
              placeholder="Digite uma mensagem"
              className="flex-1 bg-transparent border-none outline-none py-2.5 text-[15px] resize-none max-h-32 text-slate-800 placeholder-slate-400"
              disabled={loading}
            />
            <button 
              onClick={handleSend}
              disabled={!inputValue.trim() || loading}
              className={cn(
                "p-2 mb-1 rounded-full transition-all flex items-center justify-center shrink-0",
                inputValue.trim() && !loading ? "bg-[#00a884] text-white hover:bg-[#008f6f]" : "text-slate-400 cursor-not-allowed"
              )}
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 -ml-0.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Transfer Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-indigo-600" />
                Transferir Atendimento
              </h3>
              <button onClick={() => setShowTransferModal(false)} className="p-2 hover:bg-slate-200 rounded-xl transition-colors">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              <p className="text-sm text-slate-500 mb-4">Selecione para qual departamento deseja enviar este cliente:</p>
              <div className="space-y-2">
                {departments.filter(d => d.id !== ticket.departmentId).map(dept => (
                  <button
                    key={dept.id}
                    onClick={() => handleTransfer(dept.id)}
                    className="w-full p-4 text-left rounded-2xl border border-slate-200 hover:border-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 transition-all font-bold text-slate-700 flex justify-between items-center"
                  >
                    {dept.name}
                    <ArrowRightLeft className="w-4 h-4 opacity-50" />
                  </button>
                ))}
                {departments.filter(d => d.id !== ticket.departmentId).length === 0 && (
                  <p className="text-sm text-center text-slate-400 p-4">Nenhum outro departamento disponível.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Close Modal */}
      {showCloseModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-rose-50/50">
              <h3 className="font-bold text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-rose-600" />
                Encerrar Atendimento
              </h3>
              <button onClick={() => setShowCloseModal(false)} className="p-2 hover:bg-slate-200 rounded-xl transition-colors">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-slate-600 mb-6 text-sm">Você está prestes a encerrar o atendimento de <strong className="text-slate-900">{ticket.customerName}</strong>. Este ticket desaparecerá da sua fila e o cliente passará a ser atendido pela IA em uma próxima interação.</p>
              
              <label className="flex items-start gap-3 p-4 bg-slate-50 rounded-2xl cursor-pointer border border-slate-100 mb-6 hover:bg-slate-100 transition-colors">
                <div className="pt-0.5">
                  <input 
                    type="checkbox" 
                    checked={sendNps}
                    onChange={(e) => setSendNps(e.target.checked)}
                    className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500 border-slate-300 cursor-pointer"
                  />
                </div>
                <div>
                  <p className="font-bold text-slate-700 text-sm">Enviar Pesquisa de Satisfação (NPS)</p>
                  <p className="text-xs text-slate-500 mt-1">O sistema enviará uma mensagem automática pedindo uma nota de 1 a 5.</p>
                </div>
              </label>

              <div className="flex justify-end gap-3">
                <button 
                  onClick={() => setShowCloseModal(false)}
                  className="px-6 py-3 font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleCloseTicket}
                  disabled={loading}
                  className="px-6 py-3 font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-rose-200"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirmar Encerramento'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className={cn(
          "fixed bottom-24 right-8 z-[1000] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border backdrop-blur-md animate-in slide-in-from-right duration-300",
          toast.type === 'success' 
            ? "bg-emerald-500/90 border-emerald-400 text-white" 
            : "bg-rose-500/90 border-rose-400 text-white"
        )}>
          {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <p className="text-sm font-bold">{toast.message}</p>
          <button onClick={() => setToast(null)} className="ml-4 opacity-50 hover:opacity-100 transition-opacity">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
