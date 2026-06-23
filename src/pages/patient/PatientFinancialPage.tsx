import React, { useState, useEffect } from 'react';
import { CreditCard, Download, FileText, CheckCircle2, AlertCircle, ArrowUpRight, Loader2 } from 'lucide-react';
import { supabase } from '@/src/lib/supabase';
import { cn } from '@/src/lib/utils';
import { useAuth } from '@/src/contexts/AuthContext';

export default function PatientFinancialPage() {
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<any[]>([]);
  const [stats, setStats] = useState({ pending: 0, totalPaid: 0 });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  const { user } = useAuth();

  const fetchData = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);

      // 1. Buscar paciente vinculado ao usuário (usando ilike para e-mail case-insensitive)
      const { data: patient } = await supabase.from('patients').select('id').ilike('email', user.email).single();
      if (!patient) return;

      const { data: payHistory } = await supabase
        .from('payments')
        .select('*')
        .eq('patient_id', patient.id)
        .order('created_at', { ascending: false });
      
      const history = payHistory || [];
      setPayments(history);

      const pending = history.filter(p => p.status === 'pending' || p.status === 'overdue').reduce((acc, curr) => acc + Number(curr.amount), 0);
      const paid = history.filter(p => p.status === 'paid').reduce((acc, curr) => acc + Number(curr.amount), 0);
      
      setStats({ pending, totalPaid: paid });

    } catch (error) {
      console.error('Erro ao buscar financeiro:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = "Pagamentos & NF | Tzion Terapias";
    let metaDescription = document.querySelector('meta[name="description"]');
    if (!metaDescription) {
      metaDescription = document.createElement('meta');
      metaDescription.setAttribute('name', 'description');
      document.head.appendChild(metaDescription);
    }
    metaDescription.setAttribute('content', 'Gerencie suas faturas, formas de pagamento, histórico financeiro e baixe seus recibos na Tzion Terapias.');
  }, []);

  useEffect(() => {
    fetchData();
    setCurrentPage(1);
  }, [user]);

  // Helper para agrupar pagamentos por mês/ano
  const groupByMonth = (paymentsList: any[]) => {
    const groups: { [key: string]: any[] } = {};
    paymentsList.forEach(p => {
      const date = new Date(p.created_at);
      const monthYear = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      const capitalized = monthYear.charAt(0).toUpperCase() + monthYear.slice(1);
      if (!groups[capitalized]) {
        groups[capitalized] = [];
      }
      groups[capitalized].push(p);
    });
    return groups;
  };

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = payments.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(payments.length / itemsPerPage);
  const groupedPayments = groupByMonth(currentItems);

  const handleDownload = (id: string) => {
    alert(`Iniciando download do recibo: ${id}.pdf`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      <div>
        <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Pagamentos & NF</h2>
        <p className="text-slate-500 font-medium">Gerencie suas faturas, formas de pagamento e baixe seus recibos.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Payment Methods */}
        <div className="bg-slate-900 rounded-[2.5rem] p-10 text-white relative overflow-hidden shadow-2xl">
           <div className="relative z-10 space-y-8">
              <div className="flex justify-between items-start">
                 <div className="p-4 bg-white/10 rounded-2xl border border-white/10">
                    <CreditCard className="w-8 h-8 text-indigo-300" />
                 </div>
                 <button className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest hover:text-white transition-colors">Gerenciar Cartões</button>
              </div>
              <div>
                 <p className="text-xs font-bold text-indigo-300 uppercase tracking-widest mb-1">Forma de Pagamento Padrão</p>
                 <h3 className="text-2xl font-bold">Pix / Cartão</h3>
                 <p className="text-slate-400 font-mono mt-2">Pagamento automático via Asaas</p>
              </div>
              <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                 <div className="flex items-center gap-2 text-emerald-400 text-sm font-bold">
                    <CheckCircle2 className="w-4 h-4" /> Conta Ativa
                 </div>
                 <button className="px-6 py-3 bg-indigo-600 rounded-xl font-bold text-sm hover:bg-indigo-500 transition-all">Configurar</button>
              </div>
           </div>
           <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        </div>

        {/* Financial Health */}
        <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-between">
            <div className="space-y-6">
              <div className="flex justify-between items-center text-emerald-600">
                 <h3 className="font-bold">Status da Conta</h3>
                 <span className={cn(
                   "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                   stats.pending > 0 ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"
                 )}>
                   {stats.pending > 0 ? 'Pendente' : 'Regular'}
                 </span>
              </div>
              <div className="space-y-2">
                 <p className="text-sm text-slate-500 font-medium">
                   {stats.pending > 0 
                    ? `Você possui R$ ${stats.pending.toLocaleString('pt-BR')} em cobranças pendentes.`
                    : "Você não possui faturas em aberto. Seu próximo agendamento será cobrado automaticamente."}
                 </p>
              </div>
            </div>
            <div className="mt-8 p-6 bg-slate-50 rounded-3xl flex items-center justify-between">
               <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Pago (Histórico)</p>
                  <p className="text-2xl font-bold text-slate-900">R$ {stats.totalPaid.toLocaleString('pt-BR')}</p>
               </div>
               <button className="p-3 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-indigo-600 transition-all shadow-sm">
                  <ArrowUpRight className="w-5 h-5" />
               </button>
            </div>
        </div>
      </div>

      {/* History Grouped List */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
           <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" /> Histórico de Faturas
           </h3>
           <button 
             className="flex items-center gap-2 px-4 py-2 bg-slate-50 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-100 transition-all select-none"
           >
              <Download className="w-4 h-4" /> Baixar Tudo
           </button>
        </div>

        {payments.length === 0 ? (
          <div className="py-20 text-center text-slate-400 font-medium bg-slate-50 rounded-[2.5rem] border border-dashed border-slate-200">
            Nenhum registro financeiro encontrado.
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedPayments).map(([month, items]) => (
              <div key={month} className="space-y-4 animate-in fade-in duration-300">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">{month}</h4>
                <div className="space-y-3">
                  {items.map((p: any) => (
                    <div key={p.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-indigo-100 hover:shadow-md transition-all group">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-slate-50 flex flex-col items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                          <span className="text-[10px] font-bold uppercase">{new Date(p.created_at).toLocaleDateString('pt-BR', { month: 'short' })}</span>
                          <span className="text-lg font-bold leading-none">{new Date(p.created_at).getDate()}</span>
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 text-sm">Sessão de Terapia</p>
                          <p className="text-xs text-slate-500 font-medium">R$ {Number(p.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 self-end sm:self-auto">
                        <button 
                          onClick={() => handleDownload(p.id)}
                          className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 text-xs font-bold bg-indigo-50 px-3 py-2 rounded-xl transition-all"
                        >
                          <FileText className="w-4 h-4" /> Recibo
                        </button>
                        <span className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                          p.status === 'paid' ? "bg-emerald-50 text-emerald-600" : 
                          p.status === 'overdue' ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-600"
                        )}>
                          {p.status === 'paid' ? 'Pago' : p.status === 'overdue' ? 'Vencido' : 'Pendente'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 mt-8 pt-6 border-t border-slate-100">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-5 py-3 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 bg-white hover:bg-slate-50 hover:border-indigo-200 hover:text-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:border-slate-200 disabled:hover:text-slate-600 transition-all select-none cursor-pointer"
                >
                  Anterior
                </button>
                <span className="text-sm font-black text-slate-500">
                  Página {currentPage} de {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-5 py-3 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 bg-white hover:bg-slate-50 hover:border-indigo-200 hover:text-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:border-slate-200 disabled:hover:text-slate-600 transition-all select-none cursor-pointer"
                >
                  Próximo
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
