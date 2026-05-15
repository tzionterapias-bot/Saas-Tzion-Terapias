import React, { useState } from 'react';
import { Package, Plus, Search, Filter, AlertCircle, ShoppingCart, Trash2, Edit, X } from 'lucide-react';
import { cn } from '@/src/lib/utils';

const initialItems = [
  { id: 1, name: 'Lençol Descartável (Rolo)', stock: 5, minStock: 10, category: 'Higiene', price: 42.90 },
  { id: 2, name: 'Álcool em Gel 70% (5L)', stock: 2, minStock: 5, category: 'Sanitização', price: 89.00 },
  { id: 3, name: 'Luvas Nitrílicas (Cxs)', stock: 15, minStock: 10, category: 'EPIs', price: 65.50 },
  { id: 4, name: 'Máscaras Cirúrgicas (Cxs)', stock: 8, minStock: 5, category: 'EPIs', price: 35.00 },
];

export default function SuppliesPage() {
  const [items, setItems] = useState(initialItems);
  const [showModal, setShowModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState<{item: any, type: 'in' | 'out'} | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [newItem, setNewItem] = useState({ name: '', category: 'Higiene', stock: '', minStock: '', price: '' });
  const [stockAmount, setStockAmount] = useState('');

  const handleAddItem = () => {
    const item = {
      id: Date.now(),
      name: newItem.name,
      category: newItem.category,
      stock: Number(newItem.stock),
      minStock: Number(newItem.minStock),
      price: Number(newItem.price)
    };
    setItems([...items, item]);
    setShowModal(false);
    alert('Insumo cadastrado com sucesso!');
  };

  const handleStockAdjust = () => {
    if (!showStockModal) return;
    const amount = Number(stockAmount);
    setItems(items.map(i => {
      if (i.id === showStockModal.item.id) {
        const newStock = showStockModal.type === 'in' ? i.stock + amount : i.stock - amount;
        return { ...i, stock: Math.max(0, newStock) };
      }
      return i;
    }));
    setShowStockModal(null);
    setStockAmount('');
  };

  const filteredItems = items.filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Cadastro de Insumos</h2>
          <p className="text-slate-500 font-medium">Controle de estoque, fornecedores e insumos da clínica.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all"
        >
          <Plus className="w-4 h-4" /> Novo Insumo
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="bg-amber-50 border border-amber-100 p-8 rounded-[2rem] flex items-center gap-6">
            <div className="p-4 bg-amber-100 text-amber-600 rounded-2xl">
               <AlertCircle className="w-8 h-8" />
            </div>
            <div>
               <p className="text-4xl font-black text-amber-600">2</p>
               <p className="text-sm font-bold text-amber-700/60 uppercase tracking-widest">Itens Abaixo do Mínimo</p>
            </div>
         </div>
         <div className="bg-indigo-50 border border-indigo-100 p-8 rounded-[2rem] flex items-center gap-6">
            <div className="p-4 bg-indigo-100 text-indigo-600 rounded-2xl">
               <Package className="w-8 h-8" />
            </div>
            <div>
               <p className="text-4xl font-black text-indigo-600">324</p>
               <p className="text-sm font-bold text-indigo-700/60 uppercase tracking-widest">Total em Estoque</p>
            </div>
         </div>
         <div className="bg-emerald-50 border border-emerald-100 p-8 rounded-[2rem] flex items-center gap-6">
            <div className="p-4 bg-emerald-100 text-emerald-600 rounded-2xl">
               <ShoppingCart className="w-8 h-8" />
            </div>
            <div>
               <p className="text-4xl font-black text-emerald-600">R$ 1.150</p>
               <p className="text-sm font-bold text-emerald-700/60 uppercase tracking-widest">Valor de Inventário</p>
            </div>
         </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm">
        <div className="p-8 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
           <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                placeholder="Buscar insumo..."
                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-transparent focus:bg-white focus:border-slate-200 rounded-xl outline-none transition-all font-medium"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
           </div>
           <div className="flex gap-2">
              <button className="px-4 py-3 border border-slate-200 rounded-xl font-bold text-slate-500 hover:bg-slate-50 transition-all flex items-center gap-2">
                 <Filter className="w-4 h-4" /> Categoria
              </button>
           </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-10 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Insumo</th>
                <th className="px-10 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Categoria</th>
                <th className="px-10 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Estoque Atual</th>
                <th className="px-10 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Preço Unit.</th>
                <th className="px-10 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredItems.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/30 transition-colors group">
                  <td className="px-10 py-6">
                    <p className="font-bold text-slate-800">{item.name}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">ID: {item.id}</p>
                  </td>
                  <td className="px-10 py-6">
                    <span className="px-3 py-1 bg-slate-100 rounded-full text-[10px] font-bold text-slate-500 uppercase tracking-wider">{item.category}</span>
                  </td>
                  <td className="px-10 py-6">
                    <div className="flex items-center gap-2">
                       <span className={cn("text-lg font-black", item.stock <= item.minStock ? "text-rose-500" : "text-slate-900")}>
                          {item.stock}
                       </span>
                       <span className="text-xs font-bold text-slate-400">/ min {item.minStock}</span>
                    </div>
                  </td>
                  <td className="px-10 py-6 font-bold text-slate-600">R$ {item.price.toFixed(2)}</td>
                  <td className="px-10 py-6 text-right">
                    <div className="flex justify-end gap-2">
                       <button 
                         onClick={() => setShowStockModal({ item, type: 'in' })}
                         className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-bold uppercase hover:bg-emerald-600 hover:text-white transition-all"
                       >
                         Entrada
                       </button>
                       <button 
                         onClick={() => setShowStockModal({ item, type: 'out' })}
                         className="flex items-center gap-1 px-3 py-1.5 bg-rose-50 text-rose-600 rounded-lg text-[10px] font-bold uppercase hover:bg-rose-600 hover:text-white transition-all"
                       >
                         Saída
                       </button>
                       <button className="p-2 text-slate-300 hover:text-indigo-600 transition-colors"><Edit className="w-5 h-5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Novo Insumo */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-[3rem] p-10 shadow-2xl space-y-8 animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center">
              <h3 className="text-2xl font-black text-slate-900">Novo Insumo</h3>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X className="w-6 h-6 text-slate-400" /></button>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div className="col-span-full space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Nome do Item</label>
                <input 
                  className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-medium" 
                  placeholder="Ex: Luvas Nitrílicas"
                  value={newItem.name}
                  onChange={e => setNewItem({...newItem, name: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Categoria</label>
                <select 
                  className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-medium cursor-pointer"
                  value={newItem.category}
                  onChange={e => setNewItem({...newItem, category: e.target.value})}
                >
                  <option>Higiene</option>
                  <option>Sanitização</option>
                  <option>EPIs</option>
                  <option>Escritório</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Estoque Inicial</label>
                <input 
                  type="number"
                  className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-medium" 
                  value={newItem.stock}
                  onChange={e => setNewItem({...newItem, stock: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Estoque Mínimo</label>
                <input 
                  type="number"
                  className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-medium" 
                  value={newItem.minStock}
                  onChange={e => setNewItem({...newItem, minStock: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Preço Unitário</label>
                <input 
                  type="number"
                  className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-medium" 
                  placeholder="R$ 0,00"
                  value={newItem.price}
                  onChange={e => setNewItem({...newItem, price: e.target.value})}
                />
              </div>
            </div>
            <button 
              onClick={handleAddItem}
              className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100"
            >
              Finalizar Cadastro
            </button>
          </div>
        </div>
      )}

      {/* Modal: Ajuste de Estoque */}
      {showStockModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-10 shadow-2xl space-y-6 animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-black text-slate-900">
                {showStockModal.type === 'in' ? 'Registrar Entrada' : 'Registrar Saída'}
              </h3>
              <button onClick={() => setShowStockModal(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X className="w-6 h-6 text-slate-400" /></button>
            </div>
            <div className="space-y-4">
              <p className="text-sm font-medium text-slate-500">
                Item: <span className="text-slate-900 font-bold">{showStockModal.item.name}</span>
              </p>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Quantidade</label>
                <input 
                  type="number"
                  autoFocus
                  className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-2xl text-center" 
                  placeholder="0"
                  value={stockAmount}
                  onChange={e => setStockAmount(e.target.value)}
                />
              </div>
            </div>
            <button 
              onClick={handleStockAdjust}
              className={cn(
                "w-full py-4 text-white rounded-2xl font-bold transition-all shadow-xl",
                showStockModal.type === 'in' ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100" : "bg-rose-600 hover:bg-rose-700 shadow-rose-100"
              )}
            >
              Confirmar Movimentação
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
