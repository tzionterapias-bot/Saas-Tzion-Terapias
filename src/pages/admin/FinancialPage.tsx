import React from 'react';
import { DollarSign, ArrowUpRight, ArrowDownRight, Wallet, Receipt, Download, Filter, TrendingUp, CreditCard, X } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const data = [
  { name: 'Jan', receita: 4000, despesas: 2400 },
  { name: 'Fev', receita: 3000, despesas: 1398 },
  { name: 'Mar', receita: 2000, despesas: 9800 },
  { name: 'Abr', receita: 2780, despesas: 3908 },
  { name: 'Mai', receita: 1890, despesas: 4800 },
  { name: 'Jun', receita: 2390, despesas: 3800 },
];

const initialTransactions = [
  { id: 1, patient: 'João Oliveira', value: 150.00, date: '2024-05-04', type: 'Receita', category: 'Sessão', status: 'Concluído', method: 'Pix' },
  { id: 2, patient: 'Maria Santos', value: 300.00, date: '2024-05-04', type: 'Receita', category: 'Sessão', status: 'Pendente', method: 'Cartão' },
  { id: 3, description: 'Aluguel Sala 302', value: 1200.00, date: '2024-05-02', type: 'Despesa', category: 'Infraestrutura', status: 'Concluído', method: 'Boleto' },
  { id: 4, patient: 'Pedro Souza', value: 150.00, date: '2024-05-01', type: 'Receita', category: 'Sessão', status: 'Concluído', method: 'Dinheiro' },
  { id: 5, description: 'Energia Elétrica', value: 240.00, date: '2024-05-05', type: 'Despesa', category: 'Utilidades', status: 'A Pagar', method: 'Boleto' },
];

export default function FinancialPage() {
  const [showModal, setShowModal] = React.useState(false);
  const [transactions, setTransactions] = React.useState(initialTransactions);
  const [filterType, setFilterType] = React.useState<'Todos' | 'Receita' | 'Despesa'>('Todos');
  const [filterStatus, setFilterStatus] = React.useState<'Todos' | 'Concluído' | 'Pendente' | 'A Pagar'>('Todos');
  const [newT, setNewT] = React.useState({ type: 'Receita', description: '', value: '', method: 'Pix', category: 'Sessão' });

  const handleAddTransaction = () => {
    const transaction = { 
      id: Date.now(), 
      description: newT.description, 
      value: Number(newT.value), 
      date: new Date().toISOString(), 
      type: newT.type, 
      category: newT.category,
      status: newT.type === 'Receita' ? 'Concluído' : 'A Pagar', 
      method: newT.method 
    };
    setTransactions([transaction, ...transactions]);
    alert('Transação registrada com sucesso!');
    setShowModal(false);
    setNewT({ type: 'Receita', description: '', value: '', method: 'Pix', category: 'Sessão' });
  };

  const filteredTransactions = transactions.filter(t => {
    const matchesType = filterType === 'Todos' || t.type === filterType;
    const matchesStatus = filterStatus === 'Todos' || t.status === filterStatus;
    return matchesType && matchesStatus;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Financeiro</h2>
          <p className="text-slate-500 font-medium">Controle de receitas, despesas e fluxo de caixa da clínica.</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-5 py-3 border border-slate-200 bg-white rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors">
            <Download className="w-4 h-4" /> Exportar
          </button>
          <button 
            onClick={() => setShowModal(true)}
            className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95"
          >
            + Nova Transação
          </button>
        </div>
      </div>

      {/* New Transaction Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl border border-slate-100 overflow-hidden">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-2xl font-bold text-slate-900">Nova Transação</h3>
              <button 
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-white rounded-full transition-all text-slate-400 border border-transparent hover:border-slate-200"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setNewT({...newT, type: 'Receita'})}
                  className={cn("py-4 rounded-2xl font-bold border-2 transition-all", newT.type === 'Receita' ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-slate-50 text-slate-400 border-transparent")}
                >
                  Receita
                </button>
                <button 
                  onClick={() => setNewT({...newT, type: 'Despesa'})}
                  className={cn("py-4 rounded-2xl font-bold border-2 transition-all", newT.type === 'Despesa' ? "bg-rose-50 text-rose-600 border-rose-200" : "bg-slate-50 text-slate-400 border-transparent")}
                >
                  Despesa
                </button>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest px-1">Descrição / Nome</label>
                  <input 
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-medium" 
                    placeholder="Ex: João Oliveira ou Aluguel"
                    value={newT.description}
                    onChange={e => setNewT({...newT, description: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest px-1">Valor (R$)</label>
                    <input 
                      type="number"
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold" 
                      placeholder="0,00"
                      value={newT.value}
                      onChange={e => setNewT({...newT, value: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest px-1">Categoria</label>
                    <select 
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                      value={newT.category}
                      onChange={e => setNewT({...newT, category: e.target.value})}
                    >
                      <option>Sessão</option>
                      <option>Laudo/Relatório</option>
                      <option>Infraestrutura</option>
                      <option>Utilidades</option>
                      <option>Marketing</option>
                      <option>Outros</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest px-1">Método de Pagamento</label>
                  <select 
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-medium"
                    value={newT.method}
                    onChange={e => setNewT({...newT, method: e.target.value})}
                  >
                    <option>Pix</option>
                    <option>Cartão de Crédito</option>
                    <option>Boleto</option>
                    <option>Dinheiro</option>
                    <option>Transferência</option>
                  </select>
                </div>
              </div>
              <button 
                onClick={handleAddTransaction}
                className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-bold shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-[0.98]"
              >
                Registrar Transação
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Saldo Total', val: 'R$ 12.450,00', color: 'indigo', icon: Wallet, trend: '+12%' },
          { label: 'Receitas (Mês)', val: 'R$ 8.200,00', color: 'emerald', icon: ArrowUpRight, trend: '+5.4%' },
          { label: 'Despesas (Mês)', val: 'R$ 2.150,00', color: 'rose', icon: ArrowDownRight, trend: '-2.1%' },
        ].map((item, i) => (
          <div key={i} className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden group">
            <div className="relative z-10">
              <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-6", 
                item.color === 'indigo' ? "bg-indigo-50 text-indigo-600" : 
                item.color === 'emerald' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600")}>
                <item.icon className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">{item.label}</p>
              <div className="flex items-end justify-between mt-2">
                <h3 className="text-3xl font-bold text-slate-900">{item.val}</h3>
                <span className={cn("text-xs font-bold px-2 py-1 rounded-lg", 
                  item.trend.startsWith('+') ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600")}>
                  {item.trend}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-500" /> Fluxo de Caixa
            </h3>
            <div className="flex gap-2">
              <button className="px-4 py-1.5 text-xs font-bold bg-indigo-50 text-indigo-600 rounded-lg">Mensal</button>
              <button className="px-4 py-1.5 text-xs font-bold text-slate-400 hover:text-slate-600">Semanal</button>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorRec" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ fontWeight: 'bold' }}
                />
                <Area type="monotone" dataKey="receita" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorRec)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-4 bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl flex flex-col justify-between">
          <div className="relative z-10 space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-white/10 rounded-2xl border border-white/10">
                <CreditCard className="w-6 h-6 text-indigo-300" />
              </div>
              <div>
                <p className="text-xs font-bold text-indigo-300 uppercase tracking-widest">Gateway Conectado</p>
                <p className="font-bold">Asaas Pagamentos</p>
              </div>
            </div>
            
            <div className="p-6 bg-white/5 rounded-2xl border border-white/10 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-400">Total Pendente</span>
                <span className="font-bold text-emerald-400">R$ 1.240,00</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-400">Próximo Repasse</span>
                <span className="font-bold">12/05/2024</span>
              </div>
            </div>
            
            <button className="w-full py-4 bg-indigo-500 text-white rounded-2xl font-bold hover:bg-indigo-400 transition-all flex items-center justify-center gap-2">
              Gerar Boleto/Link <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-8">
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Powered by Tzion Financial</p>
          </div>
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm">
        <div className="p-8 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <h3 className="text-xl font-bold text-slate-900 tracking-tight">Transações Recentes</h3>
          <div className="flex flex-wrap items-center gap-4">
             <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tipo:</span>
                <select 
                  className="px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none"
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as any)}
                >
                   <option>Todos</option>
                   <option>Receita</option>
                   <option>Despesa</option>
                </select>
             </div>
             <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status:</span>
                <select 
                  className="px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                >
                   <option>Todos</option>
                   <option>Concluído</option>
                   <option>Pendente</option>
                   <option>A Pagar</option>
                </select>
             </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Descrição</th>
                <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Categoria</th>
                <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Valor</th>
                <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Método</th>
                <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredTransactions.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50/30 transition-colors group">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-4">
                      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-all", 
                        t.type === 'Receita' ? "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white" : "bg-rose-50 text-rose-600 group-hover:bg-rose-600 group-hover:text-white")}>
                        {t.type === 'Receita' ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{t.patient || t.description}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{new Date(t.date).toLocaleDateString('pt-BR')}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className="px-3 py-1 bg-slate-50 border border-slate-100 rounded-full text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t.category}</span>
                  </td>
                  <td className={cn("px-8 py-5 font-black text-lg", t.type === 'Receita' ? "text-emerald-600" : "text-rose-600")}>
                    {t.type === 'Receita' ? '+' : '-'} R$ {t.value.toFixed(2)}
                  </td>
                  <td className="px-8 py-5 text-sm text-slate-600 font-bold">{t.method}</td>
                  <td className="px-8 py-5 text-right">
                    <span className={cn("px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm", 
                      t.status === 'Concluído' ? "bg-emerald-100 text-emerald-700" : 
                      t.status === 'Pendente' ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700")}>
                      {t.status}
                    </span>
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
