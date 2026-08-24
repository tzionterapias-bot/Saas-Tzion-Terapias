import React, { useState, useEffect } from 'react';
import { supabase } from '@/src/lib/supabase';
import { 
  Brain, 
  Plus, 
  Trash2, 
  Edit3, 
  Search, 
  Sparkles, 
  BookOpen, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  X, 
  HelpCircle, 
  Database,
  Layers,
  Send,
  FileText
} from 'lucide-react';
import { cn } from '@/src/lib/utils';

interface KnowledgeDoc {
  id: string;
  instance_id: string;
  title: string;
  category: string;
  content: string;
  metadata: any;
  created_at?: string;
  updated_at?: string;
}

export default function KnowledgeBaseManager() {
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('todos');
  
  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingDoc, setEditingDoc] = useState<KnowledgeDoc | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('especialidades');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);

  // Test Simulator State
  const [testQuery, setTestQuery] = useState('');
  const [testResults, setTestResults] = useState<any[]>([]);
  const [testing, setTesting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchDocs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('tzion_knowledge_documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocs(data || []);
    } catch (err: any) {
      console.error('Erro ao buscar documentos RAG:', err);
      showToast('Erro ao carregar base de conhecimento: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocs();
  }, []);

  const handleOpenAdd = () => {
    setEditingDoc(null);
    setTitle('');
    setCategory('especialidades');
    setContent('');
    setShowModal(true);
  };

  const handleOpenEdit = (doc: KnowledgeDoc) => {
    setEditingDoc(doc);
    setTitle(doc.title);
    setCategory(doc.category || 'geral');
    setContent(doc.content);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      showToast('Por favor, preencha o título e o conteúdo.', 'error');
      return;
    }

    try {
      setSaving(true);
      if (editingDoc) {
        // Atualizar
        const { error } = await supabase
          .from('tzion_knowledge_documents')
          .update({
            title: title.trim(),
            category: category.trim(),
            content: content.trim(),
            updated_at: new Date().toISOString()
          })
          .eq('id', editingDoc.id);

        if (error) throw error;
        showToast('Documento atualizado com sucesso!');
      } else {
        // Criar
        const { error } = await supabase
          .from('tzion_knowledge_documents')
          .insert({
            instance_id: 'tzion',
            title: title.trim(),
            category: category.trim(),
            content: content.trim(),
            metadata: { source: 'admin_dashboard', author: 'admin' }
          });

        if (error) throw error;
        showToast('Novo documento adicionado à Base de Conhecimento!');
      }

      setShowModal(false);
      await fetchDocs();
    } catch (err: any) {
      console.error('Erro ao salvar documento:', err);
      showToast('Erro ao salvar: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, docTitle: string) => {
    if (!confirm(`Tem certeza que deseja excluir o documento "${docTitle}"? A IA deixará de consultar essa informação.`)) return;

    try {
      const { error } = await supabase
        .from('tzion_knowledge_documents')
        .delete()
        .eq('id', id);

      if (error) throw error;
      showToast('Documento removido da Base de Conhecimento.');
      setDocs(docs.filter(d => d.id !== id));
    } catch (err: any) {
      console.error('Erro ao excluir:', err);
      showToast('Erro ao excluir: ' + err.message, 'error');
    }
  };

  const handleSimulateSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testQuery.trim()) return;

    try {
      setTesting(true);
      // Busca textual simples ou no DB
      const { data, error } = await supabase
        .from('tzion_knowledge_documents')
        .select('id, title, category, content')
        .ilike('content', `%${testQuery.trim()}%`)
        .limit(3);

      if (error) throw error;
      setTestResults(data || []);
      if (!data || data.length === 0) {
        showToast('Nenhum trecho correspondente encontrado para este termo.', 'error');
      }
    } catch (err: any) {
      console.error('Erro no teste:', err);
    } finally {
      setTesting(false);
    }
  };

  const categories = Array.from(new Set(['todos', ...docs.map(d => d.category || 'geral')]));

  const filteredDocs = docs.filter(doc => {
    const matchesSearch = doc.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          doc.content.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = selectedCategory === 'todos' || doc.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Toast */}
      {toast && (
        <div className={cn(
          "fixed bottom-6 right-6 z-50 px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-sm font-semibold border transition-all transform animate-in slide-in-from-bottom-5",
          toast.type === 'success' ? "bg-emerald-950/90 text-emerald-300 border-emerald-500/30" : "bg-rose-950/90 text-rose-300 border-rose-500/30"
        )}>
          {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <AlertCircle className="w-5 h-5 text-rose-400" />}
          {toast.message}
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-8 text-white border border-indigo-900/40 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/20 text-indigo-300 rounded-full text-xs font-semibold uppercase tracking-wider border border-indigo-500/30">
              <Sparkles className="w-3.5 h-3.5" />
              IA RAG • Conhecimento Vetorial
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight">Base de Conhecimento da IA</h1>
            <p className="text-slate-300 text-sm max-w-2xl leading-relaxed">
              Aqui você ensina tudo o que a inteligência artificial da Tzion no WhatsApp precisa saber sobre tratamentos, preços, localização, equipe e regras com precisão cirúrgica.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchDocs}
              disabled={loading}
              className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl transition-all border border-white/10 shadow-sm"
              title="Atualizar lista"
            >
              <RefreshCw className={cn("w-5 h-5", loading && "animate-spin")} />
            </button>

            <button
              onClick={handleOpenAdd}
              className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold text-sm shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2 border border-indigo-400/30"
            >
              <Plus className="w-5 h-5" />
              Adicionar Conhecimento
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="mt-8 pt-6 border-t border-white/10 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
            <p className="text-xs text-slate-400 font-medium">Documentos Ativos</p>
            <p className="text-2xl font-black text-white mt-1">{docs.length}</p>
          </div>
          <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
            <p className="text-xs text-slate-400 font-medium">Categorias</p>
            <p className="text-2xl font-black text-indigo-400 mt-1">{categories.length - 1}</p>
          </div>
          <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
            <p className="text-xs text-slate-400 font-medium">Status no n8n</p>
            <p className="text-2xl font-black text-emerald-400 mt-1 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              Conectado
            </p>
          </div>
          <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
            <p className="text-xs text-slate-400 font-medium">Motor de Busca</p>
            <p className="text-2xl font-black text-amber-400 mt-1">pgvector HNSW</p>
          </div>
        </div>
      </div>

      {/* Simulator Test Sandbox */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Brain className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Simulador de Consulta da IA</h3>
            <p className="text-xs text-slate-500">Digite uma dúvida como se fosse um paciente para ver quais informações a IA localiza.</p>
          </div>
        </div>

        <form onSubmit={handleSimulateSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={testQuery}
              onChange={(e) => setTestQuery(e.target.value)}
              placeholder="Ex: Quanto custa o Tzion Care 180? / Onde fica o consultório? / Vocês atendem ansiedade?"
              className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
          </div>
          <button
            type="submit"
            disabled={testing || !testQuery.trim()}
            className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-sm font-bold transition-all disabled:opacity-50 flex items-center gap-2 shrink-0"
          >
            {testing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Testar Busca
          </button>
        </form>

        {testResults.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Documentos correspondentes encontrados:</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {testResults.map((res) => (
                <div key={res.id} className="p-4 bg-indigo-50/60 border border-indigo-100 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-900">{res.title}</span>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 bg-indigo-200/60 text-indigo-700 rounded-md">{res.category}</span>
                  </div>
                  <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">{res.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Filter & Search Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Pesquisar conhecimentos..."
            className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm transition-all"
          />
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-bold capitalize transition-all shrink-0",
                selectedCategory === cat
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Documents Grid */}
      {loading ? (
        <div className="py-20 text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
          <p className="text-sm font-medium text-slate-500">Carregando documentos da base...</p>
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-3xl border border-dashed border-slate-200 p-8 space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center mx-auto">
            <BookOpen className="w-8 h-8" />
          </div>
          <div>
            <h4 className="text-base font-bold text-slate-900">Nenhum documento encontrado</h4>
            <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1">
              {searchTerm ? 'Nenhum resultado corresponde à sua pesquisa.' : 'Adicione seu primeiro conhecimento para que a IA comece a aprender.'}
            </p>
          </div>
          <button
            onClick={handleOpenAdd}
            className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Criar Documento
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDocs.map((doc) => (
            <div 
              key={doc.id} 
              className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="inline-block px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-[11px] font-bold uppercase tracking-wider mb-2">
                      {doc.category || 'Geral'}
                    </span>
                    <h3 className="font-bold text-slate-900 text-base leading-snug group-hover:text-indigo-600 transition-colors">
                      {doc.title}
                    </h3>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-xs text-slate-600 leading-relaxed line-clamp-6 whitespace-pre-line">
                    {doc.content}
                  </p>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] font-medium text-slate-400">
                  {doc.content.length} caracteres
                </span>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenEdit(doc)}
                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                    title="Editar Documento"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(doc.id, doc.title)}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                    title="Excluir"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Add / Edit */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-8 shadow-2xl border border-slate-100 space-y-6 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-all"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
                <Brain className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">
                  {editingDoc ? 'Editar Conhecimento' : 'Novo Conhecimento para a IA'}
                </h3>
                <p className="text-xs text-slate-500">
                  Adicione textos claros, objetivos e detalhados. A IA usará essa fonte exata.
                </p>
              </div>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Título do Conhecimento
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Terapia de Casal: Como funciona e duração"
                  required
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Categoria
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  <option value="especialidades">Especialidades & Terapias</option>
                  <option value="planos">Planos & Programas (Care 180)</option>
                  <option value="regras">Regras & Política da Clínica</option>
                  <option value="localizacao">Endereço & Estrutura</option>
                  <option value="equipe">Corpo Clínico & Terapeutas</option>
                  <option value="financeiro">Valores & Pagamentos</option>
                  <option value="geral">Geral / FAQs</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700 uppercase">
                    Conteúdo Explicativo (Texto para a IA)
                  </label>
                  <span className="text-[11px] text-slate-400">
                    {content.length} caracteres
                  </span>
                </div>
                <textarea
                  rows={8}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Escreva aqui todas as informações que a IA deve utilizar para responder aos clientes..."
                  required
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 leading-relaxed font-sans"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2"
                >
                  {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {editingDoc ? 'Salvar Alterações' : 'Adicionar à Base'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
