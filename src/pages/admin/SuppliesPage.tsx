import React, { useState, useEffect } from 'react';
import { Package, Plus, Search, Filter, AlertCircle, ShoppingCart, Trash2, Edit, X, Loader2, CheckCircle2 } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { supabase } from '@/src/lib/supabase';

interface Supply {
  id: string;
  name: string;
  category: string;
  stock: number;
  min_stock: number;
  price: number;
}

export default function SuppliesPage() {
  const [items, setItems] = useState<Supply[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showStockModal, setShowStockModal] = useState<{item: Supply, type: 'in' | 'out'} | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [newItem, setNewItem] = useState({ name: '', category: 'Higiene', stock: '', min_stock: '', price: '' });
  const [stockAmount, setStockAmount] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchSupplies = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('supplies').select('*').order('name');
      if (error && error.code !== 'PGRST205') throw error;
      setItems(data || []);
    } catch (e) {
      console.error('Erro ao buscar insumos:', e);
      showToast('error', 'Erro ao carregar insumos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSupplies();
  }, []);

  const handleDelete = async (id: string) => {
    setLoading(true);
    const { error } = await supabase.from('supplies').delete().eq('id', id);
    if (error) {
      showToast('error', 'Erro ao excluir insumo.');
      setLoading(false);
    } else {
      setConfirmDeleteId(null);
      showToast('success', 'Insumo excluído com sucesso.');
      fetchSupplies();
    }
  };

  const handleSaveItem = async () => {
    if (!newItem.name.trim()) return;
    setSaving(true);
    
    const supplyData = {
      name: newItem.name.trim(),
      category: newItem.category,
      stock: Number(newItem.stock) || 0,
      min_stock: Number(newItem.min_stock) || 0,
      price: Number(newItem.price) || 0
    };

    let error;
    if (editingId) {
      const { error: err } = await supabase.from('supplies').update(supplyData).eq('id', editingId);
      error = err;
    } else {
      const { error: err } = await supabase.from('supplies').insert([supplyData]);
      error = err;
    }

    setSaving(false);

    if (error) {
      showToast('error', `Erro ao salvar insumo: ${error.message || 'Verifique as permissões ou a tabela no Supabase.'}`);
      console.error('Erro ao salvar insumo:', error);
      return;
    }

    showToast('success', 'Insumo salvo com sucesso!');
    setShowModal(false);
    setEditingId(null);
    setNewItem({ name: '', category: 'Higiene', stock: '', min_stock: '', price: '' });
    fetchSupplies();
  };

  const openNewItemModal = () => {
    setEditingId(null);
    setNewItem({ name: '', category: 'Higiene', stock: '', min_stock: '', price: '' });
    setShowModal(true);
  };

  const handleEdit = (item: Supply) => {
    setNewItem({
      name: item.name,
      category: item.category,
      stock: String(item.stock),
      min_stock: String(item.min_stock),
      price: String(item.price)
    });
    setEditingId(item.id);
    setShowModal(true);
  };

  const handleStockAdjust = async () => {
    if (!showStockModal) return;
    const amount = Number(stockAmount);
    if (!amount || amount <= 0) return;

    setSaving(true);
    const item = showStockModal.item;
    const newStock = showStockModal.type === 'in' ? item.stock + amount : item.stock - amount;
    const finalStock = Math.max(0, newStock);

    const { error } = await supabase.from('supplies').update({ stock: finalStock }).eq('id', item.id);
    
    setSaving(false);
    if (error) {
      showToast('error', 'Erro ao atualizar estoque.');
    } else {
      showToast('success', 'Estoque atualizado!');
      setShowStockModal(null);
      setStockAmount('');
      fetchSupplies();
    }
  };

  const filteredItems = items.filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase()));
  
  const lowStockCount = items.filter(i => i.stock <= i.min_stock).length;
  const totalStock = items.reduce((acc, i) => acc + i.stock, 0);
  const totalValue = items.reduce((acc, i) => acc + (i.stock * i.price), 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 relative">
      {/* Toast */}
      {toast && (
        <div className={cn(
          "fixed top-6 right-6 z-[9999] flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl font-bold text-sm animate-in slide-in-from-top-4 duration-300",
          toast.type === 'success' ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"
        )}>
          {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {toast.msg}
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Cadastro de Insumos</h2>
          <p className="text-slate-500 font-medium">Controle de estoque, fornecedores e insumos da clínica.</p>
        </div>
        <button 
          onClick={openNewItemModal}
          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all"
        >
          <Plus className="w-5 h-5" />
          Novo Insumo
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-amber-50 border border-amber-100 rounded-3xl p-6 flex items-center gap-6 shadow-sm">
          <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center shrink-0">
            <AlertCircle className="w-8 h-8 text-amber-500" />
          </div>
          <div>
            <p className="text-4xl font-black text-amber-700">{lowStockCount}</p>
            <p className="text-amber-600/80 font-bold text-sm uppercase tracking-wider">Itens Abaixo do Mínimo</p>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-100 rounded-3xl p-6 flex items-center gap-6 shadow-sm">
          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shrink-0 shadow-sm border border-slate-100">
            <Package className="w-8 h-8 text-indigo-500" />
          </div>
          <div>
            <p className="text-4xl font-black text-indigo-950">{totalStock}</p>
            <p className="text-slate-500 font-bold text-sm uppercase tracking-wider">Total em Estoque</p>
          </div>
        </div>

        <div className="bg-emerald-50 border border-emerald-100 rounded-3xl p-6 flex items-center gap-6 shadow-sm">
          <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center shrink-0">
            <ShoppingCart className="w-8 h-8 text-emerald-500" />
          </div>
          <div>
            <p className="text-3xl font-black text-emerald-700">
              R$ {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-emerald-600/80 font-bold text-sm uppercase tracking-wider">Valor do Inventário</p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative max-w-md w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input 
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar insumo..."
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-xl text-slate-700 font-medium placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-4" />
              <p className="font-medium">Carregando insumos do banco de dados...</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50">
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider w-1/3">Insumo</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">Categoria</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">Estoque Atual</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Preço Unit.</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                          <Package className="w-5 h-5 text-slate-500" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{item.name}</p>
                          <p className="text-xs font-medium text-slate-400 mt-0.5">ID: {item.id.slice(0,8)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center">
                        <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold uppercase tracking-wider">
                          {item.category}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col items-center justify-center gap-1">
                        <div className="flex items-end gap-1">
                          <span className={cn(
                            "text-xl font-black",
                            item.stock <= item.min_stock ? "text-rose-600" : "text-slate-900"
                          )}>
                            {item.stock}
                          </span>
                          <span className="text-sm font-medium text-slate-400 mb-0.5">/ min {item.min_stock}</span>
                        </div>
                        {item.stock <= item.min_stock && (
                          <span className="text-[10px] font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-md uppercase tracking-wider">Estoque Baixo</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-bold text-slate-900">
                        R$ {item.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => setShowStockModal({ item, type: 'in' })}
                          className="px-3 py-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
                        >
                          ENTRADA
                        </button>
                        <button 
                          onClick={() => setShowStockModal({ item, type: 'out' })}
                          className="px-3 py-1.5 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors"
                        >
                          SAÍDA
                        </button>
                        <div className="w-px h-6 bg-slate-200 mx-1"></div>
                        <button 
                          onClick={() => handleEdit(item)}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        
                        {confirmDeleteId === item.id ? (
                          <div className="flex items-center gap-1 bg-white shadow-lg p-1 rounded-xl border border-slate-100 absolute right-8 z-10">
                            <button 
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-lg text-xs"
                            >
                              Cancelar
                            </button>
                            <button 
                              onClick={() => handleDelete(item.id)}
                              className="px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-lg text-xs"
                            >
                              Confirmar
                            </button>
                          </div>
                        ) : (
                          <button 
                            onClick={() => setConfirmDeleteId(item.id)}
                            className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredItems.length === 0 && !loading && (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-500 font-medium">
                      Nenhum insumo encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Stock Adjust Modal */}
      {showStockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className={cn(
              "p-6 text-white",
              showStockModal.type === 'in' ? "bg-emerald-500" : "bg-rose-500"
            )}>
              <h3 className="text-xl font-black">
                {showStockModal.type === 'in' ? 'Entrada de Estoque' : 'Saída de Estoque'}
              </h3>
              <p className="text-white/80 font-medium mt-1">{showStockModal.item.name}</p>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Quantidade</label>
                <div className="flex items-center gap-3">
                  <input 
                    type="number" 
                    value={stockAmount}
                    onChange={(e) => setStockAmount(e.target.value)}
                    autoFocus
                    placeholder="0"
                    className="w-full p-4 bg-slate-50 border-none rounded-xl text-3xl font-black text-slate-900 text-center focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <p className="text-center text-sm font-medium text-slate-500 mt-2">
                  Estoque atual: <span className="font-bold text-slate-900">{showStockModal.item.stock}</span>
                </p>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => { setShowStockModal(null); setStockAmount(''); }}
                  className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleStockAdjust}
                  disabled={saving || !stockAmount || Number(stockAmount) <= 0}
                  className={cn(
                    "flex-1 py-3.5 text-white font-bold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center",
                    showStockModal.type === 'in' ? "bg-emerald-500 hover:bg-emerald-600" : "bg-rose-500 hover:bg-rose-600"
                  )}
                >
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Item Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
              <h3 className="text-xl font-black text-slate-900">
                {editingId ? 'Editar Insumo' : 'Novo Insumo'}
              </h3>
              <button 
                onClick={() => setShowModal(false)}
                className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-5 overflow-y-auto">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Nome do Insumo</label>
                <input 
                  type="text" 
                  value={newItem.name}
                  onChange={(e) => setNewItem({...newItem, name: e.target.value})}
                  placeholder="Ex: Lençol Descartável"
                  className="w-full p-4 bg-slate-50 border-none rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Categoria</label>
                  <select
                    value={newItem.category}
                    onChange={(e) => setNewItem({...newItem, category: e.target.value})}
                    className="w-full p-4 bg-slate-50 border-none rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500"
                  >
                    <option>Higiene</option>
                    <option>Sanitização</option>
                    <option>EPIs</option>
                    <option>Aromaterapia</option>
                    <option>Descartáveis</option>
                    <option>Outros</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Preço Base (R$)</label>
                  <input 
                    type="number" 
                    value={newItem.price}
                    onChange={(e) => setNewItem({...newItem, price: e.target.value})}
                    placeholder="0.00"
                    className="w-full p-4 bg-slate-50 border-none rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Estoque Atual</label>
                  <input 
                    type="number" 
                    value={newItem.stock}
                    onChange={(e) => setNewItem({...newItem, stock: e.target.value})}
                    placeholder="0"
                    className="w-full p-4 bg-slate-50 border-none rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Estoque Mínimo</label>
                  <input 
                    type="number" 
                    value={newItem.min_stock}
                    onChange={(e) => setNewItem({...newItem, min_stock: e.target.value})}
                    placeholder="0"
                    className="w-full p-4 bg-slate-50 border-none rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 flex gap-3 shrink-0">
              <button 
                onClick={() => setShowModal(false)}
                className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSaveItem}
                disabled={saving || !newItem.name.trim()}
                className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transition-all flex justify-center items-center"
              >
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Salvar Insumo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
