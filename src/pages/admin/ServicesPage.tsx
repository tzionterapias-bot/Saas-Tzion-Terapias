import React, { useState, useEffect } from 'react';
import { supabase } from '@/src/lib/supabase';
import {
  CreditCard, Plus, Trash2, Clock, Package, Sparkles,
  Search, Loader2, CheckCircle2, AlertCircle, Tag, X, Edit2, Save,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import { cn } from '@/src/lib/utils';

interface Service {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
  type: string;
  description?: string;
  sessions_count?: number;
}

const EMPTY_FORM = {
  name: '',
  price: '',
  type: 'sessão avulsa',
  description: '',
  duration_minutes: '60',
  sessions_count: '1',
};

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Pagination & Filters
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState<'todos' | 'sessao' | 'pacote'>('todos');
  const itemsPerPage = 5;

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);

  // Add form state
  const [form, setForm] = useState(EMPTY_FORM);

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchServices = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('services').select('*').order('name');
      if (error) throw error;
      setServices(data || []);
    } catch (e) {
      console.error('Erro de rede ao buscar serviços:', e);
      showToast('error', 'Falha ao carregar serviços. Verifique sua conexão.');
      setServices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchServices(); }, []);

  // Reset pagination when filtering
  useEffect(() => {
    setCurrentPage(1);
  }, [search, activeTab]);

  const handleAdd = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('services').insert({
      name: form.name.trim(),
      price: Number(form.price) || 0,
      duration_minutes: Number(form.duration_minutes) || 60,
      type: form.type,
      description: form.description.trim() || null,
      sessions_count: form.type === 'pacote' ? Number(form.sessions_count) : 1,
    });
    setSaving(false);
    if (error) { showToast('error', 'Erro ao cadastrar serviço.'); return; }
    showToast('success', 'Serviço cadastrado com sucesso!');
    setForm(EMPTY_FORM);
    setShowForm(false);
    fetchServices();
  };

  const handleEdit = (s: Service) => {
    setEditingId(s.id);
    setEditForm({
      name: s.name,
      price: String(s.price),
      type: s.type,
      description: s.description || '',
      duration_minutes: String(s.duration_minutes),
      sessions_count: String(s.sessions_count || 1),
    });
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editForm.name.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('services').update({
      name: editForm.name.trim(),
      price: Number(editForm.price) || 0,
      duration_minutes: Number(editForm.duration_minutes) || 60,
      type: editForm.type,
      description: editForm.description.trim() || null,
      sessions_count: editForm.type === 'pacote' ? Number(editForm.sessions_count) : 1,
    }).eq('id', editingId);
    setSaving(false);
    if (error) { showToast('error', 'Erro ao atualizar serviço.'); return; }
    showToast('success', 'Serviço atualizado!');
    setEditingId(null);
    fetchServices();
  };

  const handleDelete = async (id: string) => {
    setLoading(true);
    await supabase.from('appointments').update({ service_id: null }).eq('service_id', id);
    try { await supabase.from('patient_packages').update({ service_id: null }).eq('service_id', id); } catch {}
    const { error } = await supabase.from('services').delete().eq('id', id);
    setDeletingId(null);
    if (error) { showToast('error', 'Erro ao excluir serviço.'); setLoading(false); return; }
    showToast('success', 'Serviço excluído.');
    fetchServices();
  };

  // Filter Data
  const filtered = services.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase()) || 
                          (s.description || '').toLowerCase().includes(search.toLowerCase());
    
    let matchesTab = true;
    if (activeTab === 'sessao') matchesTab = s.type !== 'pacote';
    if (activeTab === 'pacote') matchesTab = s.type === 'pacote';
    
    return matchesSearch && matchesTab;
  });

  // Pagination Logic
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const InputField = ({ label, value, onChange, type = 'text', placeholder = '', autoFocus = false, amber = false }: any) => (
    <div className="space-y-1.5">
      <label className={cn("text-[10px] font-bold uppercase tracking-widest ml-1", amber ? "text-amber-500" : "text-indigo-400")}>{label}</label>
      <input
        autoFocus={autoFocus}
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "w-full bg-white p-4 rounded-xl border-none outline-none focus:ring-2 font-bold placeholder:opacity-40 shadow-sm transition-all",
          amber ? "focus:ring-amber-500 text-amber-900 border-2 border-amber-200" : "focus:ring-indigo-500 text-indigo-900"
        )}
      />
    </div>
  );

  const ServiceForm = ({ f, setF, onSave, onCancel, savingLabel }: any) => (
    <div className="p-5 bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 rounded-2xl flex flex-col gap-4 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
      <InputField label="Nome do Serviço / Pacote" value={f.name} onChange={(v: string) => setF((p: any) => ({ ...p, name: v }))} placeholder="Ex: Sessão de Psicologia, Pacote Premium..." autoFocus />

      <div className={cn("grid gap-3", f.type === 'pacote' ? "grid-cols-2 md:grid-cols-4" : "grid-cols-1 md:grid-cols-3")}>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest ml-1">Tipo</label>
          <select
            value={f.type}
            onChange={e => setF((p: any) => ({ ...p, type: e.target.value }))}
            className="w-full bg-white pl-3 pr-8 py-4 rounded-xl border-none outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-indigo-900 text-sm cursor-pointer shadow-sm"
          >
            <option value="sessão avulsa">Sessão Avulsa</option>
            <option value="pacote">Pacote</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest ml-1">Preço (R$)</label>
          <input
            type="number"
            value={f.price}
            onChange={e => setF((p: any) => ({ ...p, price: e.target.value }))}
            placeholder="0.00"
            className="w-full bg-white p-4 rounded-xl border-none outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-indigo-900 placeholder:text-indigo-300 shadow-sm"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest ml-1">Tempo (min)</label>
          <input
            type="number"
            value={f.duration_minutes}
            onChange={e => setF((p: any) => ({ ...p, duration_minutes: e.target.value }))}
            placeholder="60"
            className="w-full bg-white p-4 rounded-xl border-none outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-indigo-900 placeholder:text-indigo-300 text-center shadow-sm"
          />
        </div>
        {f.type === 'pacote' && (
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-amber-500 uppercase tracking-widest ml-1">Qtd. Sessões</label>
            <input
              type="number"
              value={f.sessions_count}
              onChange={e => setF((p: any) => ({ ...p, sessions_count: e.target.value }))}
              placeholder="1"
              className="w-full bg-white p-4 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 font-black text-amber-900 placeholder:text-amber-300 text-center border-2 border-amber-300 shadow-sm"
            />
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest ml-1">Descritivo (Opcional)</label>
        <textarea
          value={f.description}
          onChange={e => setF((p: any) => ({ ...p, description: e.target.value }))}
          placeholder="O que está incluso neste serviço ou pacote?"
          rows={2}
          className="w-full bg-white p-4 rounded-xl border-none outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-indigo-900 placeholder:text-indigo-300 resize-none shadow-sm"
        />
      </div>

      <div className="flex gap-2 mt-1">
        <button onClick={onCancel} className="flex-1 py-3.5 bg-white hover:bg-slate-50 text-slate-500 font-bold rounded-xl transition-colors shadow-sm border border-slate-200">
          Cancelar
        </button>
        <button
          onClick={onSave}
          disabled={saving || !f.name.trim()}
          className="flex-1 py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {savingLabel}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 p-4 md:p-8 relative">

      {/* Toast */}
      {toast && (
        <div className={cn(
          "fixed top-6 right-6 z-[9999] flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl font-bold text-sm animate-in slide-in-from-top-4 duration-300",
          toast.type === 'success'
            ? "bg-emerald-500 text-white"
            : "bg-rose-500 text-white"
        )}>
          {toast.type === 'success'
            ? <CheckCircle2 className="w-5 h-5 shrink-0" />
            : <AlertCircle className="w-5 h-5 shrink-0" />}
          {toast.msg}
        </div>
      )}

      {/* Header Container - Alinhado à esquerda */}
      <div className="w-full max-w-6xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
              <CreditCard className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Serviços & Preços</h1>
              <p className="text-slate-500 font-medium text-sm mt-0.5">
                {services.length} {services.length === 1 ? 'serviço cadastrado' : 'serviços cadastrados'}
              </p>
            </div>
          </div>
          <button
            onClick={() => { setShowForm(true); setEditingId(null); }}
            disabled={showForm}
            className="flex items-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-2xl shadow-lg shadow-indigo-200 transition-all hover:scale-105 active:scale-100"
          >
            <Plus className="w-4 h-4" />
            Novo Serviço
          </button>
        </div>

        {/* Filters and Tabs */}
        {services.length > 0 && (
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex bg-slate-100/50 p-1 rounded-2xl border border-slate-200/60 w-fit">
              <button
                onClick={() => setActiveTab('todos')}
                className={cn("px-6 py-2.5 rounded-xl font-bold text-sm transition-all", activeTab === 'todos' ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50")}
              >
                Todos
              </button>
              <button
                onClick={() => setActiveTab('sessao')}
                className={cn("px-6 py-2.5 rounded-xl font-bold text-sm transition-all", activeTab === 'sessao' ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50")}
              >
                Sessões
              </button>
              <button
                onClick={() => setActiveTab('pacote')}
                className={cn("px-6 py-2.5 rounded-xl font-bold text-sm transition-all", activeTab === 'pacote' ? "bg-white text-amber-600 shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50")}
              >
                Pacotes
              </button>
            </div>

            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar serviço..."
                className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-slate-700 font-medium placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm transition-all"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Add Form */}
        {showForm && (
          <div className="mb-6">
            <ServiceForm
              f={form}
              setF={setForm}
              onSave={handleAdd}
              onCancel={() => { setShowForm(false); setForm(EMPTY_FORM); }}
              savingLabel="Cadastrar Serviço"
            />
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20 gap-3 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="font-medium">Carregando serviços...</span>
          </div>
        ) : filtered.length === 0 && !showForm ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center">
              <Sparkles className="w-10 h-10 text-indigo-300" />
            </div>
            <div>
              <p className="font-black text-slate-700 text-lg">
                {search || activeTab !== 'todos' ? 'Nenhum resultado encontrado' : 'Nenhum serviço cadastrado'}
              </p>
              <p className="text-slate-400 font-medium text-sm mt-1">
                {search || activeTab !== 'todos' ? 'Tente alterar os filtros de busca.' : 'Clique em "Novo Serviço" para começar.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {paginated.map(s => (
              <div key={s.id} className="animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-both" style={{ animationDelay: '50ms' }}>
                {editingId === s.id ? (
                  <ServiceForm
                    f={editForm}
                    setF={setEditForm}
                    onSave={handleSaveEdit}
                    onCancel={() => setEditingId(null)}
                    savingLabel="Salvar Alterações"
                  />
                ) : (
                  <div className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-100 transition-all duration-200">
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <div className={cn(
                        "w-11 h-11 rounded-xl flex items-center justify-center shrink-0 mt-0.5",
                        s.type === 'pacote' ? "bg-amber-50" : "bg-indigo-50"
                      )}>
                        {s.type === 'pacote'
                          ? <Package className="w-5 h-5 text-amber-500" />
                          : <Tag className="w-5 h-5 text-indigo-500" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="font-black text-slate-900 text-base leading-tight">{s.name}</p>
                          <span className={cn(
                            "px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wide",
                            s.type === 'pacote'
                              ? "bg-amber-100 text-amber-700"
                              : "bg-indigo-100 text-indigo-700"
                          )}>
                            {s.type === 'pacote' ? `Pacote ${s.sessions_count || 1}x` : 'Sessão'}
                          </span>
                        </div>
                        {s.description && (
                          <p className="text-sm text-slate-500 font-medium mb-1.5 leading-relaxed truncate md:whitespace-normal">{s.description}</p>
                        )}
                        <div className="flex items-center gap-1 text-slate-400">
                          <Clock className="w-3.5 h-3.5" />
                          <span className="text-xs font-bold uppercase tracking-wide">{s.duration_minutes} min</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 sm:gap-4 pl-[3.75rem] sm:pl-0 shrink-0">
                      <p className="text-xl font-black text-slate-900">
                        R$ {Number(s.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleEdit(s)}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {deletingId === s.id ? (
                          <div className="flex items-center gap-1.5 animate-in fade-in zoom-in duration-150">
                            <button
                              onClick={() => setDeletingId(null)}
                              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl text-xs transition-colors"
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={() => handleDelete(s.id)}
                              className="px-3 py-2 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl text-xs transition-colors"
                            >
                              Excluir
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeletingId(s.id)}
                            className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && !loading && (
          <div className="flex items-center justify-between mt-6 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Mostrando <span className="font-bold text-slate-900">{(currentPage - 1) * itemsPerPage + 1}</span> até <span className="font-bold text-slate-900">{Math.min(currentPage * itemsPerPage, filtered.length)}</span> de <span className="font-bold text-slate-900">{filtered.length}</span> resultados
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 bg-slate-50 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed text-slate-600 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentPage(i + 1)}
                    className={cn(
                      "w-8 h-8 rounded-lg font-bold text-sm transition-colors",
                      currentPage === i + 1 
                        ? "bg-indigo-600 text-white" 
                        : "text-slate-600 hover:bg-slate-100"
                    )}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 bg-slate-50 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed text-slate-600 rounded-lg transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Stats Footer */}
        {services.length > 0 && !loading && (
          <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[
              {
                label: 'Total de Serviços',
                value: services.length,
                icon: CreditCard,
                color: 'indigo'
              },
              {
                label: 'Sessões Avulsas',
                value: services.filter(s => s.type !== 'pacote').length,
                icon: Tag,
                color: 'purple'
              },
              {
                label: 'Pacotes',
                value: services.filter(s => s.type === 'pacote').length,
                icon: Package,
                color: 'amber'
              },
            ].map((stat, i) => (
              <div key={i} className={cn(
                "bg-white rounded-2xl p-4 border shadow-sm flex items-center gap-3 transition-transform hover:-translate-y-1 duration-300",
                stat.color === 'indigo' ? "border-indigo-100" :
                stat.color === 'purple' ? "border-purple-100" : "border-amber-100"
              )}>
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                  stat.color === 'indigo' ? "bg-indigo-50" :
                  stat.color === 'purple' ? "bg-purple-50" : "bg-amber-50"
                )}>
                  <stat.icon className={cn(
                    "w-5 h-5",
                    stat.color === 'indigo' ? "text-indigo-500" :
                    stat.color === 'purple' ? "text-purple-500" : "text-amber-500"
                  )} />
                </div>
                <div>
                  <p className="text-2xl font-black text-slate-900">{stat.value}</p>
                  <p className="text-xs text-slate-400 font-medium">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
