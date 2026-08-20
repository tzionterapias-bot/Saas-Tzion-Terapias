import React, { useState, useEffect } from 'react';
import { 
  X, StickyNote, Send, Loader2, Clock, User, Trash2, Tag, 
  AlertCircle, CheckCircle2, Shield, Calendar, Sparkles, MessageSquare 
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/contexts/AuthContext';

export interface PatientNotesModalProps {
  patient: {
    id: string;
    name: string;
    phone?: string;
  } | null;
  isOpen: boolean;
  onClose: () => void;
  onNoteAdded?: () => void;
}

const CATEGORIES = [
  { id: 'Geral', label: '📌 Geral', color: 'bg-slate-100 text-slate-700 border-slate-200' },
  { id: 'Atendimento', label: '💙 Atendimento', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { id: 'Horários / Atraso', label: '⏰ Horários / Atraso', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { id: 'Financeiro', label: '💳 Financeiro / Recibo', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { id: 'Preferência', label: '⭐ Preferência', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { id: 'Importante', label: '⚠️ Importante', color: 'bg-rose-50 text-rose-700 border-rose-200' },
];

export default function PatientNotesModal({
  patient,
  isOpen,
  onClose,
  onNoteAdded
}: PatientNotesModalProps) {
  const { user } = useAuth();
  const [notesList, setNotesList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Geral');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const showFeedback = (msg: string) => {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  const fetchNotes = async () => {
    if (!patient?.id) return;
    try {
      setLoading(true);

      // Busca anotações em patient_evolutions com dados do terapeuta se houver
      const { data, error } = await supabase
        .from('patient_evolutions')
        .select('*, therapists(name)')
        .eq('patient_id', patient.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotesList(data || []);
    } catch (err: any) {
      console.error('Erro ao carregar anotações do paciente:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && patient?.id) {
      fetchNotes();
      setNewNoteText('');
      setSelectedCategory('Geral');
    }
  }, [isOpen, patient?.id]);

  if (!isOpen || !patient) return null;

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = newNoteText.trim();
    if (!text) return;

    try {
      setSaving(true);

      const authorRoleLabel = user?.role === 'terapeuta' 
        ? 'Terapeuta' 
        : user?.role === 'admin' 
          ? 'Administração' 
          : 'Recepção / Secretária';
      
      const authorName = user?.name || user?.email?.split('@')[0] || authorRoleLabel;
      const formattedNote = `[${selectedCategory}] ${text}\n— Por ${authorName} (${authorRoleLabel})`;

      const { data, error } = await supabase
        .from('patient_evolutions')
        .insert([{
          patient_id: patient.id,
          therapist_id: user?.role === 'terapeuta' ? (user as any)?.therapist_id || null : null,
          type: user?.role === 'terapeuta' ? 'Anotação do Terapeuta' : 'Anotação da Recepção',
          notes: formattedNote
        }])
        .select()
        .single();

      if (error) throw error;

      setNewNoteText('');
      showFeedback('Anotação registrada com sucesso!');
      await fetchNotes();
      if (onNoteAdded) onNoteAdded();
    } catch (err: any) {
      console.error('Erro ao salvar anotação:', err);
      showFeedback('Erro ao salvar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('Deseja realmente remover esta anotação?')) return;
    try {
      setDeletingId(noteId);
      const { error } = await supabase
        .from('patient_evolutions')
        .delete()
        .eq('id', noteId);

      if (error) throw error;

      setNotesList(prev => prev.filter(n => n.id !== noteId));
      showFeedback('Anotação removida.');
      if (onNoteAdded) onNoteAdded();
    } catch (err: any) {
      console.error('Erro ao remover anotação:', err);
      showFeedback('Erro ao remover: ' + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[120] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white rounded-[2.5rem] w-full max-w-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 sm:p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-200 shrink-0">
              <StickyNote className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  Anotações da Recepção
                </h3>
                <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-black uppercase rounded-full tracking-wider">
                  Secretaria
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 font-medium flex items-center gap-2 mt-0.5">
                <span>Paciente: <strong className="text-slate-800">{patient.name}</strong></span>
                {patient.phone && (
                  <span className="text-slate-400">• {patient.phone}</span>
                )}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-3 hover:bg-white rounded-full text-slate-400 hover:text-slate-600 transition-all border border-transparent hover:border-slate-200 shadow-sm"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Feedback Alert */}
        {feedbackMsg && (
          <div className="px-6 py-3 bg-emerald-50 border-b border-emerald-100 text-emerald-800 text-xs font-bold flex items-center justify-between animate-in slide-in-from-top-2">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> {feedbackMsg}
            </span>
          </div>
        )}

        {/* Body Content */}
        <div className="p-6 sm:p-8 overflow-y-auto flex-1 space-y-6">
          
          {/* Nova Anotação Form */}
          <form onSubmit={handleAddNote} className="bg-slate-50 p-5 rounded-3xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Nova Observação / Recado
              </label>
              <span className="text-[10px] text-slate-400 font-bold">Ficará visível para toda a equipe</span>
            </div>

            {/* Categorias / Tags */}
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={cn(
                    "px-3 py-1 rounded-xl text-xs font-bold transition-all border",
                    selectedCategory === cat.id 
                      ? `${cat.color} ring-2 ring-indigo-400 ring-offset-1 font-black shadow-sm` 
                      : "bg-white text-slate-500 border-slate-200 hover:bg-slate-100"
                  )}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Textarea */}
            <div className="relative">
              <textarea
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                placeholder="Escreva aqui a anotação, recado, preferência de horário, acompanhante ou observação..."
                rows={3}
                className="w-full p-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-amber-500 font-medium text-sm text-slate-800 placeholder-slate-400 resize-none transition-all shadow-inner"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving || !newNoteText.trim()}
                className="px-6 py-3 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-amber-200 flex items-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Salvando...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" /> Salvar Anotação
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Lista de Anotações Históricas */}
          <div className="space-y-4">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" /> Histórico de Observações ({notesList.length})
            </h4>

            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
                <span className="text-xs font-bold">Carregando anotações...</span>
              </div>
            ) : notesList.length === 0 ? (
              <div className="py-12 text-center bg-slate-50/50 rounded-3xl border border-dashed border-slate-200 p-8 space-y-2">
                <StickyNote className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="font-bold text-slate-600 text-sm">Nenhuma anotação registrada ainda.</p>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">
                  Use o campo acima para adicionar recados, preferências ou avisos importantes sobre este paciente.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {notesList.map((note) => {
                  const isReception = note.type === 'Anotação da Recepção' || !note.therapist_id;
                  const formattedDate = new Date(note.created_at).toLocaleDateString('pt-BR');
                  const formattedTime = new Date(note.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

                  return (
                    <div 
                      key={note.id} 
                      className="p-5 bg-white rounded-2xl border border-slate-200 hover:border-slate-300 shadow-sm transition-all space-y-3 group"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={cn(
                            "px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider",
                            isReception 
                              ? "bg-amber-50 text-amber-800 border border-amber-200" 
                              : "bg-indigo-50 text-indigo-700 border border-indigo-200"
                          )}>
                            {isReception ? 'Recepção / Secretária' : `Terapeuta: ${note.therapists?.name || 'Clínico'}`}
                          </span>

                          <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {formattedDate} às {formattedTime}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteNote(note.id)}
                          disabled={deletingId === note.id}
                          className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
                          title="Excluir anotação"
                        >
                          {deletingId === note.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-500" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>

                      <p className="text-sm font-medium text-slate-700 whitespace-pre-wrap leading-relaxed">
                        {note.notes || '(Sem conteúdo)'}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs rounded-xl transition-all shadow-sm"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
}
