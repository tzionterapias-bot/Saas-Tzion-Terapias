import React from 'react';
import { CreditCard, Download, FileText, CheckCircle2, AlertCircle, ArrowUpRight } from 'lucide-react';

const invoices = [
  { id: 1, date: '28/04/2026', value: 150.00, method: 'Cartão •••• 4242', status: 'Pago', nf: 'NF-00124' },
  { id: 2, date: '21/04/2026', value: 150.00, method: 'Pix', status: 'Pago', nf: 'NF-00123' },
  { id: 3, date: '14/04/2026', value: 150.00, method: 'Dinheiro', status: 'Pago', nf: 'NF-00122' },
];

export default function PatientFinancialPage() {
  const handleDownload = (nf: string = 'todos') => {
    alert(`Iniciando download: ${nf}.pdf`);
  };

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
                 <h3 className="text-2xl font-bold">Cartão de Crédito</h3>
                 <p className="text-slate-400 font-mono mt-2">•••• •••• •••• 4242</p>
              </div>
              <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                 <div className="flex items-center gap-2 text-emerald-400 text-sm font-bold">
                    <CheckCircle2 className="w-4 h-4" /> Conta Ativa
                 </div>
                 <button className="px-6 py-3 bg-indigo-600 rounded-xl font-bold text-sm hover:bg-indigo-500 transition-all">Alterar</button>
              </div>
           </div>
           <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        </div>

        {/* Financial Health */}
        <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-between">
            <div className="space-y-6">
              <div className="flex justify-between items-center text-emerald-600">
                 <h3 className="font-bold">Status da Conta</h3>
                 <span className="px-3 py-1 bg-emerald-50 rounded-full text-[10px] font-bold uppercase tracking-wider">Regular</span>
              </div>
              <div className="space-y-2">
                 <p className="text-sm text-slate-500 font-medium">Você não possui faturas em aberto. Seu próximo agendamento será cobrado automaticamente após a sessão.</p>
              </div>
            </div>
            <div className="mt-8 p-6 bg-slate-50 rounded-3xl flex items-center justify-between">
               <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Saldo para Reembolso</p>
                  <p className="text-2xl font-bold text-slate-900">R$ 0,00</p>
               </div>
               <button className="p-3 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-indigo-600 transition-all shadow-sm">
                  <ArrowUpRight className="w-5 h-5" />
               </button>
            </div>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-white border border-slate-100 rounded-[2.5rem] shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-50 flex items-center justify-between">
           <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" /> Histórico de Faturas
           </h3>
           <button 
             onClick={() => handleDownload()}
             className="flex items-center gap-2 px-4 py-2 bg-slate-50 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-100 transition-all"
           >
              <Download className="w-4 h-4" /> Baixar Tudo
           </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="px-10 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Data</th>
                <th className="px-10 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Valor</th>
                <th className="px-10 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Método</th>
                <th className="px-10 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nota Fiscal</th>
                <th className="px-10 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50/30 transition-colors">
                  <td className="px-10 py-6 font-bold text-slate-700">{inv.date}</td>
                  <td className="px-10 py-6 font-bold text-slate-900">R$ {inv.value.toFixed(2)}</td>
                  <td className="px-10 py-6 text-sm text-slate-500 font-medium">{inv.method}</td>
                  <td className="px-10 py-6">
                    <button 
                      onClick={() => handleDownload(inv.nf)}
                      className="flex items-center gap-2 text-indigo-600 hover:underline text-sm font-bold"
                    >
                       <FileText className="w-4 h-4" /> {inv.nf}
                    </button>
                  </td>
                  <td className="px-10 py-6 text-right">
                    <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-bold uppercase tracking-wider">{inv.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
