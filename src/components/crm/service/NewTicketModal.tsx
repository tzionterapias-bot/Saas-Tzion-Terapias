import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Send, Paperclip, Loader2, Image as ImageIcon, FileText } from 'lucide-react';
import { supabase } from '@/src/lib/supabase';
import { sendWhatsAppMessage } from '@/src/lib/whatsapp';
import { cn } from '@/src/lib/utils';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
  defaultDeptId?: string;
}

export default function NewTicketModal({ onClose, onSuccess, defaultDeptId }: Props) {
  const [loading, setLoading] = useState(false);
  const [patients, setPatients] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [selectedDeptId, setSelectedDeptId] = useState(defaultDeptId !== 'all' ? defaultDeptId : '');
  const [newDeptName, setNewDeptName] = useState('');
  const [message, setMessage] = useState('');
  
  const [attachment, setAttachment] = useState<{file: File, base64: string} | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const { data: pData } = await supabase.from('patients').select('id, name, phone').order('name');
      const { data: dData } = await supabase.from('departments').select('id, name').order('name');
      setPatients(pData || []);
      setDepartments(dData || []);
    };
    fetchData();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("O arquivo deve ter no máximo 5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setAttachment({ file, base64: event.target.result as string });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!selectedPatientId || (!selectedDeptId && !newDeptName) || (!message && !attachment)) {
      alert("Preencha todos os campos obrigatórios.");
      return;
    }

    try {
      setLoading(true);
      const patient = patients.find(p => p.id === selectedPatientId);
      if (!patient) throw new Error("Paciente inválido.");

      let finalDeptId = selectedDeptId;
      let finalDeptName = '';

      // Se for criar novo departamento
      if (selectedDeptId === 'new') {
        const { data: newDept, error: deptError } = await supabase
          .from('departments')
          .insert([{ name: newDeptName }])
          .select()
          .single();
        
        if (deptError) throw deptError;
        finalDeptId = newDept.id;
        finalDeptName = newDept.name;
      } else {
        const dept = departments.find(d => d.id === selectedDeptId);
        if (!dept) throw new Error("Departamento inválido.");
        finalDeptName = dept.name;
      }

      const fullMessage = `[${finalDeptName} - Tzion Terapias]\n\n${message}`;

      // 1. Criar Ticket
      const { data: ticket, error: ticketError } = await supabase.from('service_tickets').insert([{
        customer_name: patient.name,
        customer_phone: patient.phone,
        department_id: finalDeptId,
        status: 'open',
        last_message: message || "Arquivo enviado."
      }]).select().single();

      if (ticketError) throw ticketError;

      // 2. Enviar WhatsApp via Evolution API
      let mediaData;
      if (attachment) {
        mediaData = {
          base64: attachment.base64,
          mimeType: attachment.file.type,
          fileName: attachment.file.name
        };
      }

      const sent = await sendWhatsAppMessage(patient.id, patient.phone, fullMessage, 'ticket_opened', mediaData);

      if (!sent) {
         console.warn("Falha ao enviar mensagem para WhatsApp. Ticket criado localmente.");
      }

      onSuccess();
    } catch (error) {
      console.error("Erro ao criar chamado:", error);
      alert("Erro ao iniciar atendimento. Verifique os dados.");
    } finally {
      setLoading(false);
    }
  };
  return createPortal(
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-md z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-white/95 backdrop-blur-3xl rounded-[2rem] w-full max-w-xl max-h-[90vh] shadow-[0_30px_100px_-20px_rgba(0,0,0,0.4)] border border-white/80 overflow-hidden flex flex-col transform transition-all">
        
        {/* Header */}
        <div className="p-6 sm:p-8 border-b border-slate-200/50 flex items-center justify-between bg-gradient-to-br from-white to-slate-50/80 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center shadow-inner border border-indigo-200/50 shrink-0">
              <Send className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight leading-none">Novo Chamado</h3>
              <p className="text-xs sm:text-sm font-medium text-slate-500 mt-1">Inicie um atendimento manual com um paciente.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-slate-200/50 rounded-2xl transition-colors text-slate-400 hover:text-slate-600 shrink-0">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        {/* Body */}
        <div className="p-6 sm:p-8 space-y-6 bg-slate-50/50 overflow-y-auto">
          
          <div className="space-y-2.5">
            <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
              Paciente
            </label>
            <div className="relative">
              <select 
                value={selectedPatientId}
                onChange={(e) => setSelectedPatientId(e.target.value)}
                className="w-full p-4 pl-5 bg-white border border-slate-200/80 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-2xl outline-none font-bold text-slate-700 appearance-none transition-all shadow-sm"
              >
                <option value="">Selecione o paciente...</option>
                {patients.map(p => <option key={p.id} value={p.id}>{p.name} - {p.phone}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-2.5">
            <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              Departamento Origem
            </label>
            <select 
              value={selectedDeptId}
              onChange={(e) => setSelectedDeptId(e.target.value)}
              className="w-full p-4 pl-5 bg-white border border-slate-200/80 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 rounded-2xl outline-none font-bold text-slate-700 appearance-none transition-all shadow-sm"
            >
              <option value="">Selecione de onde está falando...</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              <option value="new" className="text-emerald-600 font-bold">+ Criar Novo Departamento...</option>
            </select>
            {selectedDeptId === 'new' && (
               <input 
                 type="text"
                 placeholder="Digite o nome do novo departamento..."
                 value={newDeptName}
                 onChange={(e) => setNewDeptName(e.target.value)}
                 className="w-full mt-3 p-4 bg-emerald-50/50 border border-emerald-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 rounded-2xl outline-none font-bold text-emerald-900 transition-all shadow-inner placeholder:text-emerald-300"
                 autoFocus
               />
            )}
          </div>

          <div className="space-y-2.5">
            <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
              Mensagem Inicial
            </label>
            <textarea 
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Digite o conteúdo da mensagem..."
              className="w-full p-5 bg-white border border-slate-200/80 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 rounded-2xl outline-none font-medium text-slate-700 min-h-[140px] resize-none transition-all shadow-sm placeholder:text-slate-400"
            />
          </div>

          <div className="space-y-2.5">
             <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                Anexar Arquivo (Opcional)
             </label>
             <div className="flex flex-col gap-3">
                <label className="cursor-pointer flex items-center justify-center gap-2 p-4 border-2 border-dashed border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 text-slate-500 hover:text-blue-600 rounded-2xl font-bold transition-all group">
                   <Paperclip className="w-5 h-5 group-hover:scale-110 transition-transform" /> 
                   <span>Escolher Arquivo do Computador</span>
                   <input type="file" className="hidden" accept="image/*,application/pdf" onChange={handleFileChange} />
                </label>
                {attachment && (
                   <div className="flex items-center justify-between gap-3 text-sm font-bold text-blue-700 bg-blue-100/50 border border-blue-200/50 px-4 py-3 rounded-2xl animate-in slide-in-from-top-2">
                      <div className="flex items-center gap-3 truncate">
                        <div className="p-2 bg-blue-200/50 rounded-lg text-blue-600">
                          {attachment.file.type.includes('image') ? <ImageIcon className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                        </div>
                        <span className="truncate">{attachment.file.name}</span>
                      </div>
                      <button onClick={() => setAttachment(null)} className="p-2 hover:bg-blue-200 rounded-lg transition-colors text-blue-500 hover:text-blue-800">
                        <X className="w-4 h-4" />
                      </button>
                   </div>
                )}
             </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-200/50 bg-white flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-6 py-3.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-2xl font-bold transition-colors"
          >
            Cancelar
          </button>
          <button 
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 max-w-[240px] py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-200 transition-all active:scale-[0.98] flex justify-center items-center gap-2 disabled:opacity-70 disabled:active:scale-100"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            Iniciar Atendimento
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
