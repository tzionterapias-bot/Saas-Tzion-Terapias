import React, { useState, useEffect } from 'react';
import { supabase } from '@/src/lib/supabase';
import { cn } from '@/src/lib/utils';
import { RefreshCw, Search, CheckCircle2, XCircle, Clock, Smartphone, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { sendWhatsAppMessage } from '@/src/lib/whatsapp';

export default function SendLogsView() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [resending, setResending] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

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

  const handleResend = async (log: any) => {
    if (resending) return;
    setResending(log.id);

    try {
      const phone = log.patients?.phone;
      if (!phone) {
         alert('Paciente não possui telefone cadastrado.');
         return;
      }

      // Remove a tag de anexo caso exista na string do log (para reenviar apenas o texto base se não tivermos o arquivo)
      const cleanContent = log.content.replace('[Anexo Enviado] ', '');

      const success = await sendWhatsAppMessage(log.patient_id, phone, cleanContent, log.trigger_event + '_resend');
      
      if (success) {
         // Atualiza status visualmente e recarrega
         await supabase.from('communications_log').update({ status: 'sent' }).eq('id', log.id);
         fetchLogs();
      } else {
         alert('Falha ao reenviar. Verifique a API do WhatsApp.');
      }
    } catch (err) {
      console.error(err);
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
          <p className="text-slate-500 font-medium mt-1">Acompanhe as mensagens automáticas enviadas via WhatsApp.</p>
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
              <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Paciente</th>
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
                  {log.patients?.name || <span className="text-slate-400 font-normal">Sem nome</span>}
                </td>
                <td className="py-4">
                  <p className="text-slate-600 font-medium truncate max-w-[300px]" title={log.content}>
                    {log.content}
                  </p>
                </td>
                <td className="py-4 pr-4 text-right">
                   {(log.status === 'failed' || log.status === 'test_sent') && (
                      <button 
                         onClick={() => handleResend(log)}
                         disabled={resending === log.id}
                         className="px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-lg text-xs font-bold transition-colors shadow-sm disabled:opacity-50"
                      >
                         {resending === log.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Reenviar'}
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
    </div>
  );
}
