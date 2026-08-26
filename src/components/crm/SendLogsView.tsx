import React, { useState, useEffect } from 'react';
import { supabase } from '@/src/lib/supabase';
import { cn } from '@/src/lib/utils';
import { RefreshCw, Search, CheckCircle2, XCircle, Clock, Smartphone, Loader2, ChevronLeft, ChevronRight, Send, X, Phone, Edit3 } from 'lucide-react';
import { sendWhatsAppMessage } from '@/src/lib/whatsapp';

export default function SendLogsView() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [resending, setResending] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Modal State para Reenvio
  const [resendModal, setResendModal] = useState<{
    open: boolean;
    log: any | null;
    recipientName: string;
    phone: string;
    updatePatientPhone: boolean;
    loadingFresh: boolean;
  }>({
    open: false,
    log: null,
    recipientName: '',
    phone: '',
    updatePatientPhone: true,
    loadingFresh: false,
  });

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('communications_log')
        .select('*, patients(name, phone)')
        .order('created_at', { ascending: false })
        .limit(100);
      
      setLogs(data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const getRecipientLabel = (log: any) => {
    if (log.patients?.name) {
      return log.patients.name;
    }
    const match = log.content?.match(/Olá,?\s*\*?([^*!\n\r]+)\*?!?/i);
    if (match && match[1]) {
      const firstName = match[1].trim();
      return `${firstName} (Terapeuta)`;
    }
    if (log.trigger_event?.includes('therapist')) {
      return 'Terapeuta / Equipe';
    }
    return 'Destinatário sem nome';
  };

  const openResendModal = async (log: any) => {
    const name = getRecipientLabel(log);
    let initialPhone = log.recipient_phone || log.patients?.phone || '';

    setResendModal({
      open: true,
      log,
      recipientName: name,
      phone: initialPhone,
      updatePatientPhone: true,
      loadingFresh: true,
    });

    let freshPhone = initialPhone;

    // Buscar SEMPRE o telefone mais recente do cadastro do paciente se houver patient_id
    if (log.patient_id) {
      const { data: freshPatient } = await supabase
        .from('patients')
        .select('phone, name')
        .eq('id', log.patient_id)
        .maybeSingle();

      if (freshPatient?.phone) {
        freshPhone = freshPatient.phone;
      }
    } else if (!freshPhone) {
      // Tentar buscar telefone de terapeuta se for envio de equipe
      const match = log.content?.match(/Olá,?\s*\*?([^*!\n\r]+)\*?!?/i);
      if (match && match[1]) {
        const firstName = match[1].trim();
        const { data: therapist } = await supabase
          .from('therapists')
          .select('phone')
          .ilike('name', `${firstName}%`)
          .maybeSingle();

        if (therapist?.phone) {
          freshPhone = therapist.phone;
        }
      }
    }

    setResendModal(prev => ({
      ...prev,
      phone: freshPhone,
      loadingFresh: false,
    }));
  };

  const handleExecuteResend = async () => {
    if (!resendModal.log || !resendModal.phone) {
      alert('Informe o número de telefone de destino.');
      return;
    }

    const { log, phone, updatePatientPhone } = resendModal;
    setResending(log.id);

    try {
      // 1. Se marcou para atualizar no cadastro do paciente e houver patient_id
      if (updatePatientPhone && log.patient_id) {
        await supabase
          .from('patients')
          .update({ phone: phone })
          .eq('id', log.patient_id);
      }

      // 2. Limpar tag de anexo caso exista e substituir localhost pelo domínio oficial
      let cleanContent = log.content.replace('[Anexo Enviado] ', '');
      cleanContent = cleanContent.replace(/http:\/\/localhost:3000/g, 'https://tzionterapias.com.br')
                                 .replace(/https:\/\/saas-tzion-terapias-six\.vercel\.app/g, 'https://tzionterapias.com.br');

      // 3. Disparar mensagem com o telefone fornecido
      const success = await sendWhatsAppMessage(
        log.patient_id,
        phone,
        cleanContent,
        (log.trigger_event || 'manual') + '_resend'
      );

      if (success) {
        await supabase
          .from('communications_log')
          .update({ status: 'sent', recipient_phone: phone })
          .eq('id', log.id);

        setResendModal({ open: false, log: null, recipientName: '', phone: '', updatePatientPhone: true, loadingFresh: false });
        fetchLogs();
      } else {
        alert('Falha ao reenviar. Verifique se o número possui WhatsApp ativo ou a conexão da API.');
      }
    } catch (err) {
      console.error('Erro ao reenviar:', err);
      alert('Erro ao processar reenvio.');
    } finally {
      setResending(null);
    }
  };

  const totalPages = Math.ceil(logs.length / itemsPerPage);
  const currentLogs = logs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-2xl font-black text-slate-900">Histórico de Disparos</h3>
          <p className="text-slate-500 font-medium mt-1">Acompanhe e reenvie as mensagens automáticas enviadas via WhatsApp.</p>
        </div>
        <button onClick={fetchLogs} className="p-3 bg-slate-50 text-slate-600 rounded-xl hover:bg-slate-100 transition-colors border border-slate-200">
          <RefreshCw className={cn("w-5 h-5", loading && "animate-spin")} />
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-slate-400 pl-4">Status</th>
              <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Data/Hora</th>
              <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Destinatário / Paciente</th>
              <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Mensagem</th>
              <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right pr-4">Ação</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {loading && logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-10 text-center text-slate-400 font-medium">Carregando histórico...</td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-10 text-center text-slate-400 font-medium">Nenhum disparo registrado ainda.</td>
              </tr>
            ) : currentLogs.map((log) => (
              <tr key={log.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors group">
                <td className="py-4 pl-4">
                  <div className="flex items-center gap-2">
                    {log.status === 'sent' ? (
                      <span className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-full text-xs font-bold border border-emerald-100">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Enviado
                      </span>
                    ) : log.status === 'test_sent' ? (
                      <span className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-full text-xs font-bold border border-indigo-100">
                        <Smartphone className="w-3.5 h-3.5" /> Teste (Log)
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 px-2.5 py-1 bg-rose-50 text-rose-600 rounded-full text-xs font-bold border border-rose-100">
                        <XCircle className="w-3.5 h-3.5" /> Falha
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-4">
                  <div className="flex items-center gap-1.5 text-slate-500 font-medium whitespace-nowrap">
                    <Clock className="w-3.5 h-3.5" />
                    {new Date(log.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                  </div>
                </td>
                <td className="py-4 font-bold text-slate-800">
                  {getRecipientLabel(log)}
                </td>
                <td className="py-4">
                  <p className="text-slate-600 font-medium truncate max-w-[300px]" title={log.content}>
                    {log.content}
                  </p>
                </td>
                <td className="py-4 pr-4 text-right">
                   {(log.status === 'failed' || log.status === 'test_sent' || log.status === 'sent') && (
                      <button 
                         onClick={() => openResendModal(log)}
                         disabled={resending === log.id}
                         className="px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-lg text-xs font-bold transition-colors shadow-sm disabled:opacity-50 inline-flex items-center gap-1.5 ml-auto"
                      >
                         {resending === log.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Reenviar
                      </button>
                   )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-100 pt-6">
          <p className="text-sm font-medium text-slate-500">
            Mostrando <span className="font-bold text-slate-900">{((currentPage - 1) * itemsPerPage) + 1}</span> a <span className="font-bold text-slate-900">{Math.min(currentPage * itemsPerPage, logs.length)}</span> de <span className="font-bold text-slate-900">{logs.length}</span> registros
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 bg-slate-50 text-slate-600 rounded-xl hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-slate-200"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-1 px-4 py-2 bg-slate-50 rounded-xl border border-slate-200 font-bold text-sm">
              <span className="text-indigo-600">{currentPage}</span>
              <span className="text-slate-400">/</span>
              <span className="text-slate-600">{totalPages}</span>
            </div>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 bg-slate-50 text-slate-600 rounded-xl hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-slate-200"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* MODAL DE REENVIO / AJUSTE DE TELEFONE */}
      {resendModal.open && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl border border-slate-100 overflow-hidden space-y-6 p-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Reenviar Disparo / Orientação</h3>
                  <p className="text-xs text-slate-400 font-bold">{resendModal.recipientName}</p>
                </div>
              </div>
              <button onClick={() => setResendModal({ open: false, log: null, recipientName: '', phone: '', updatePatientPhone: true, loadingFresh: false })} className="p-2 hover:bg-slate-100 rounded-full text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Telefone para envio (WhatsApp) *</label>
                <div className="relative">
                  <input
                    type="text"
                    value={resendModal.phone}
                    onChange={e => setResendModal(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="Ex: 5511999999999"
                    className="w-full pl-5 pr-10 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                  {resendModal.loadingFresh && (
                    <Loader2 className="w-4 h-4 animate-spin absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  )}
                </div>
                <p className="text-[11px] text-slate-400 ml-1 font-medium">
                  *Busca automática do telefone mais recente no cadastro. Você pode corrigir o número aqui antes de enviar.
                </p>
              </div>

              {resendModal.log?.patient_id && (
                <div className="p-3.5 bg-indigo-50/70 border border-indigo-100 rounded-2xl">
                  <label className="flex items-center gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={resendModal.updatePatientPhone}
                      onChange={e => setResendModal(prev => ({ ...prev, updatePatientPhone: e.target.checked }))}
                      className="w-4 h-4 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <span className="text-xs font-bold text-indigo-950">
                      Atualizar este novo número na ficha do paciente
                    </span>
                  </label>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Preview do Conteúdo</label>
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-600 font-medium max-h-32 overflow-y-auto whitespace-pre-wrap">
                  {resendModal.log?.content}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setResendModal({ open: false, log: null, recipientName: '', phone: '', updatePatientPhone: true, loadingFresh: false })}
                className="w-1/2 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-bold text-xs transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleExecuteResend}
                disabled={resending !== null || !resendModal.phone}
                className="w-1/2 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-xs shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {resending !== null ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Disparar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
