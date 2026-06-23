import React, { useEffect, useState } from 'react';
import { LayoutGrid, MessageSquare, DollarSign, Calendar, Settings, ShieldCheck, HelpCircle, Trash2, AlertCircle, X, Loader2 } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { supabase } from '@/src/lib/supabase';

export interface Department {
  id: string;
  name: string;
  icon: any;
  color: string;
  count: number;
}

interface Props {
  activeDept: string;
  onSelect: (id: string) => void;
}

const getIconForDept = (name: string) => {
  const lower = name.toLowerCase();
  if (lower.includes('agendamento')) return Calendar;
  if (lower.includes('financeiro')) return DollarSign;
  if (lower.includes('suporte') || lower.includes('técnico')) return Settings;
  if (lower.includes('comercial')) return MessageSquare;
  return HelpCircle;
};

export default function DepartmentSidebar({ activeDept, onSelect }: Props) {
  const [departments, setDepartments] = useState<Department[]>([
    { id: 'all', name: 'Todos os Tickets', icon: LayoutGrid, color: 'indigo', count: 0 }
  ]);
  const [deptToDelete, setDeptToDelete] = useState<Department | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchDeptsAndTickets = async () => {
      // 1. Fetch departments
      const { data: deptsData } = await supabase.from('departments').select('*').order('created_at', { ascending: true });
      
      // 2. Fetch active tickets to count
      const { data: ticketsData } = await supabase
        .from('service_tickets')
        .select('department_id')
        .in('status', ['open', 'waiting']);

      let totalCount = 0;
      const deptCounts: Record<string, number> = {};

      if (ticketsData) {
        totalCount = ticketsData.length;
        ticketsData.forEach(t => {
          if (t.department_id) {
            deptCounts[t.department_id] = (deptCounts[t.department_id] || 0) + 1;
          }
        });
      }

      const allOption: Department = { 
        id: 'all', 
        name: 'Todos os Tickets', 
        icon: LayoutGrid, 
        color: 'indigo', 
        count: totalCount 
      };

      const loadedDepts: Department[] = (deptsData || []).map(d => ({
        id: d.id,
        name: d.name,
        icon: getIconForDept(d.name),
        color: 'slate',
        count: deptCounts[d.id] || 0
      }));

      setDepartments([allOption, ...loadedDepts]);
    };

  useEffect(() => {
    fetchDeptsAndTickets();

    const channel = supabase
      .channel('sidebar_tickets_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_tickets' }, () => {
        fetchDeptsAndTickets();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleDeleteDept = async () => {
    if (!deptToDelete) return;
    setIsDeleting(true);
    try {
      // 1. Limpar os tickets que estão usando esse departamento (evita erro 409 Conflict FK)
      const { error: updateError } = await supabase
        .from('service_tickets')
        .update({ department_id: null })
        .eq('department_id', deptToDelete.id);
        
      if (updateError) {
         console.warn("Aviso ao desvincular tickets:", updateError);
         // Continuamos a tentar excluir o departamento, ou falhará no próximo passo
      }

      // 2. Deletar o departamento
      const { error } = await supabase.from('departments').delete().eq('id', deptToDelete.id);
      if (error) throw error;
      
      setDeptToDelete(null);
      fetchDeptsAndTickets();
      if (activeDept === deptToDelete.id) {
         onSelect('all');
      }
    } catch (e) {
      console.error(e);
      alert("Erro ao excluir departamento. Detalhes no console.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="w-20 lg:w-64 bg-white/60 backdrop-blur-3xl border-r border-slate-200/60 flex flex-col h-full transition-all relative">
      <div className="p-6 border-b border-slate-200/50 hidden lg:block bg-white/40">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Departamentos</h3>
      </div>
      
      <div className="flex-1 overflow-y-auto py-4">
        <div className="space-y-1 px-3">
          {departments.map((dept) => (
            <div
              key={dept.id}
              onClick={() => onSelect(dept.id)}
              className={cn(
                "w-full flex items-center gap-3 p-3 rounded-2xl transition-all group relative cursor-pointer",
                activeDept === dept.id 
                  ? "bg-indigo-50 text-indigo-600 shadow-sm" 
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              )}
            >
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow-sm duration-300",
                  activeDept === dept.id 
                    ? "bg-white shadow-indigo-100 scale-110" 
                    : "bg-white/60 border border-slate-100 group-hover:bg-white group-hover:shadow-md"
                )}>
                  <dept.icon className="w-5 h-5" />
                </div>
                <div className="flex-1 text-left hidden lg:block">
                  <p className={cn(
                    "font-bold text-sm leading-none transition-colors",
                    activeDept === dept.id ? "text-indigo-700" : "text-slate-600 group-hover:text-indigo-600"
                  )}>{dept.name}</p>
                  <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">{dept.count} ativos</p>
                </div>
                {activeDept === dept.id && (
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-indigo-600 rounded-l-full hidden lg:block shadow-[0_0_10px_rgba(79,70,229,0.5)]" />
                )}
                
                {/* Lixeira (Hover) */}
                {dept.id !== 'all' && (
                   <button 
                     onClick={(e) => {
                       e.stopPropagation();
                       setDeptToDelete(dept);
                     }}
                     className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-rose-50 text-rose-500 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-rose-500 hover:text-white hidden lg:flex scale-90 hover:scale-100 shadow-sm"
                     title="Excluir Departamento"
                   >
                     <Trash2 className="w-4 h-4" />
                   </button>
                )}
              </div>
            ))}
          </div>
        </div>
      
      <div className="p-4 border-t border-slate-50 hidden lg:block">
        <div className="bg-slate-900 rounded-2xl p-4 text-white space-y-3 relative overflow-hidden">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Status do Sistema</p>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold">Evolution API Online</span>
          </div>
          <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-white/5 rounded-full blur-xl" />
        </div>
      </div>

      {/* Modal de Exclusão */}
      {deptToDelete && (
        <div className="fixed inset-0 z-[200] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center mb-4">
              <AlertCircle className="w-6 h-6 text-rose-500" />
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-2">Excluir Departamento?</h3>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">
              Tem certeza que deseja excluir o departamento <strong className="text-slate-800">{deptToDelete.name}</strong>? Os tickets atuais ficarão sem departamento. Essa ação não pode ser desfeita.
            </p>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setDeptToDelete(null)}
                className="flex-1 py-3 px-4 rounded-xl font-bold text-slate-500 bg-slate-50 hover:bg-slate-100 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleDeleteDept}
                disabled={isDeleting}
                className="flex-1 py-3 px-4 rounded-xl font-bold text-white bg-rose-500 hover:bg-rose-600 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-rose-200"
              >
                {isDeleting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Sim, Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
