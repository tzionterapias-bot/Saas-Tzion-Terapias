import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, Plus, Search, X, Save, Trash2, ChevronDown, ChevronUp,
  CheckCircle2, AlertCircle, Loader2, Percent, Star, UserCheck,
  Clock, UserX, DoorOpen, Phone, CreditCard, FileText, Camera,
  Monitor, MapPin, Globe, Award, Edit2, RefreshCw, Filter
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { supabase } from '@/src/lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Therapist {
  id: string;
  user_id: string;
  name: string;
  email?: string;
  cpf?: string;
  phone?: string;
  whatsapp?: string;
  pix_key?: string;
  specialties?: string[];
  commission_rate_clinic?: number;
  commission_rate_self?: number;
  room_id?: string;
  active: boolean;
  bio?: string;
  professional_registration?: string;
  avatar_url?: string;
  attendance_modes?: string[];
  rooms?: { id: string; name: string; color: string } | null;
  profile_status?: string;
}

interface Room {
  id: string;
  name: string;
  color: string;
  status: string;
}

interface Specialty {
  id: string;
  name: string;
  is_system: boolean;
}

const ATTENDANCE_MODES = [
  { id: 'presencial', label: 'Presencial', icon: MapPin },
  { id: 'online', label: 'Online / Remoto', icon: Monitor },
  { id: 'domiciliar', label: 'Atendimento Domiciliar', icon: Globe },
];

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  if (status === 'active') return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-600 border border-emerald-100">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
      Ativo
    </span>
  );
  if (status === 'pending') return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-amber-50 text-amber-600 border border-amber-100">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
      Pendente
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-500 border border-slate-200">
      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
      Inativo
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function TherapistsManagementPage() {
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending' | 'inactive'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Add Therapist Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addStep, setAddStep] = useState<'search' | 'form'>('search');
  const [userSearch, setUserSearch] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<any[]>([]);
  const [userSearching, setUserSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [newCustomSpecialty, setNewCustomSpecialty] = useState('');
  const [therapistForm, setTherapistForm] = useState({
    name: '',
    cpf: '',
    whatsapp: '',
    pix_key: '',
    bio: '',
    professional_registration: '',
    attendance_modes: [] as string[],
    specialties: [] as string[],
    commission_rate_clinic: 50,
    commission_rate_self: 25,
  });

  // Expanded Card State
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingCommissionId, setEditingCommissionId] = useState<string | null>(null);
  const [commissionEdit, setCommissionEdit] = useState({ rate_clinic: '50', rate_self: '25', pix_key: '', phone: '' });
  const [savingCommission, setSavingCommission] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [reviewingTherapist, setReviewingTherapist] = useState<Therapist | null>(null);

  // ── Toast Helper ────────────────────────────────────────────────────────────
  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Fetch ────────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [tRes, rRes, sRes] = await Promise.all([
        supabase
          .from('therapists')
          .select('*, rooms(id, name, color)')
          .order('name'),
        supabase.from('rooms').select('*').eq('status', 'active').order('name'),
        supabase.from('therapy_specialties').select('*').eq('active', true).order('name'),
      ]);
      const therapistList = (tRes.data as Therapist[]) || [];

      // Fetch profile statuses separately (no FK exists in schema)
      if (therapistList.length > 0) {
        const userIds = therapistList.map(t => t.user_id).filter(Boolean);
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, status')
          .in('id', userIds);
        const profileMap: Record<string, string> = {};
        (profileData || []).forEach((p: any) => { profileMap[p.id] = p.status; });
        therapistList.forEach(t => {
          (t as any).profile_status = profileMap[t.user_id] || 'active';
        });
      }

      setTherapists(therapistList);
      setRooms((rRes.data as Room[]) || []);
      setSpecialties((sRes.data as Specialty[]) || []);
    } catch (e) {
      console.error('Erro ao carregar terapeutas:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Filtered Therapists ──────────────────────────────────────────────────────
  const filtered = therapists.filter(t => {
    const matchSearch = !searchQuery || t.name.toLowerCase().includes(searchQuery.toLowerCase());
    const profileStatus = (t as any).profile_status;
    if (statusFilter === 'active') return matchSearch && t.active && profileStatus !== 'pending';
    if (statusFilter === 'pending') return matchSearch && profileStatus === 'pending';
    if (statusFilter === 'inactive') return matchSearch && !t.active;
    return matchSearch;
  });

  const counts = {
    active: therapists.filter(t => t.active && (t as any).profile_status !== 'pending').length,
    pending: therapists.filter(t => (t as any).profile_status === 'pending').length,
    inactive: therapists.filter(t => !t.active).length,
  };

  // ── User Search ──────────────────────────────────────────────────────────────
  const handleUserSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userSearch.trim()) return;
    setUserSearching(true);
    const { data } = await supabase
      .from('profiles')
      .select('id, name, email, phone, role, status')
      .or(`name.ilike.%${userSearch}%,email.ilike.%${userSearch}%`)
      .limit(10);
    setUserSearchResults(data || []);
    setUserSearching(false);
  };

  const handleSelectUser = (u: any) => {
    setSelectedUser(u);
    setTherapistForm(f => ({ ...f, name: u.name || '', whatsapp: u.phone || '' }));
    setAddStep('form');
  };

  // ── Create Therapist ─────────────────────────────────────────────────────────
  const handleCreateTherapist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setSaving(true);
    try {
      const { data: existing } = await supabase
        .from('therapists')
        .select('id')
        .eq('user_id', selectedUser.id)
        .maybeSingle();

      // Build payload — new columns (professional_registration, attendance_modes) require
      // the supabase_therapist_profile_v3.sql migration to be run first.
      // They are omitted gracefully if not present yet.
      const payload: Record<string, any> = {
        name: therapistForm.name,
        cpf: therapistForm.cpf || null,
        phone: therapistForm.whatsapp || null,
        whatsapp: therapistForm.whatsapp || null,
        pix_key: therapistForm.pix_key || null,
        specialties: therapistForm.specialties,
        commission_rate_clinic: therapistForm.commission_rate_clinic,
        commission_rate_self: therapistForm.commission_rate_self,
        bio: therapistForm.bio || null,
        active: true,
      };
      if (therapistForm.professional_registration) {
        payload.professional_registration = therapistForm.professional_registration;
      }
      if (therapistForm.attendance_modes && therapistForm.attendance_modes.length > 0) {
        payload.attendance_modes = therapistForm.attendance_modes;
      }

      if (existing) {
        await supabase.from('therapists').update(payload).eq('id', existing.id);
      } else {
        await supabase.from('therapists').insert({
          user_id: selectedUser.id,
          email: selectedUser.email,
          commission_rate: 0,
          ...payload,
        });
      }

      await supabase.from('profiles').update({ role: 'terapeuta', status: 'active' }).eq('id', selectedUser.id);

      resetAddModal();
      fetchData();
      showToast('success', `${therapistForm.name} vinculado(a) com sucesso!`);
    } catch (err: any) {
      showToast('error', 'Erro ao cadastrar terapeuta: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const resetAddModal = () => {
    setShowAddModal(false);
    setAddStep('search');
    setUserSearch('');
    setUserSearchResults([]);
    setSelectedUser(null);
    setTherapistForm({
      name: '', cpf: '', whatsapp: '', pix_key: '', bio: '',
      professional_registration: '', attendance_modes: [], specialties: [],
      commission_rate_clinic: 50, commission_rate_self: 25,
    });
    setNewCustomSpecialty('');
  };

  // ── Commission Save ───────────────────────────────────────────────────────────
  const saveCommission = async (therapistId: string) => {
    setSavingCommission(true);
    const { error } = await supabase.from('therapists').update({
      commission_rate_clinic: Number(commissionEdit.rate_clinic),
      commission_rate_self: Number(commissionEdit.rate_self),
      pix_key: commissionEdit.pix_key || null,
      phone: commissionEdit.phone || null,
    }).eq('id', therapistId);
    if (!error) {
      setEditingCommissionId(null);
      fetchData(true);
      showToast('success', 'Configurações salvas!');
    }
    setSavingCommission(false);
  };

  // ── Update Room ───────────────────────────────────────────────────────────────
  const updateRoom = async (therapistId: string, roomId: string) => {
    await supabase.from('therapists').update({ room_id: roomId || null }).eq('id', therapistId);
    fetchData(true);
  };

  // ── Approve / Reject ────────────────==========================================
  const approveTherapist = async (t: Therapist) => {
    setApprovingId(t.id);
    if (t.user_id) {
      await supabase.from('profiles').update({ status: 'active' }).eq('id', t.user_id);
    }
    await supabase.from('therapists').update({ active: true }).eq('id', t.id);
    fetchData(true);
    showToast('success', `${t.name} aprovado(a) com sucesso!`);
    setApprovingId(null);
  };

  const rejectTherapist = async (t: Therapist) => {
    setApprovingId(t.id);
    if (t.user_id) {
      await supabase.from('profiles').update({ status: 'inactive' }).eq('id', t.user_id);
    }
    await supabase.from('therapists').update({ active: false }).eq('id', t.id);
    fetchData(true);
    showToast('success', 'Cadastro recusado.');
    setApprovingId(null);
  };

  // ── Deactivate ────────────────────────────────────────────────────────────────
  const deactivateTherapist = async (t: Therapist) => {
    setDeletingId(t.id);
    await supabase.from('therapists').update({ active: false }).eq('id', t.id);
    if (t.user_id) {
      await supabase.from('profiles').update({ status: 'inactive' }).eq('id', t.user_id);
    }
    setDeletingId(null);
    fetchData(true);
    showToast('success', `${t.name} desativado(a).`);
  };

  const reactivateTherapist = async (t: Therapist) => {
    await supabase.from('therapists').update({ active: true }).eq('id', t.id);
    if (t.user_id) {
      await supabase.from('profiles').update({ status: 'active' }).eq('id', t.user_id);
    }
    fetchData(true);
    showToast('success', `${t.name} reativado(a).`);
  };

  const deleteTherapist = async (t: Therapist) => {
    if (confirm(`Tem certeza que deseja excluir DEFINITIVAMENTE o registro do(a) terapeuta ${t.name} e TODOS os seus agendamentos vinculados?`)) {
      setDeletingId(t.id);
      try {
        // 1. Remover agendamentos vinculados a este terapeuta
        const { error: apptError } = await supabase.from('appointments').delete().eq('therapist_id', t.id);
        if (apptError) throw apptError;

        // 2. Remover da tabela therapists
        const { error } = await supabase.from('therapists').delete().eq('id', t.id);
        if (error) throw error;

        if (t.user_id) {
          await supabase.from('profiles').update({ role: 'paciente' }).eq('id', t.user_id);
        }

        showToast('success', `${t.name} e seus agendamentos foram excluídos com sucesso.`);
        fetchData(true);
      } catch (err: any) {
        showToast('error', 'Erro ao excluir terapeuta: ' + err.message);
      } finally {
        setDeletingId(null);
      }
    }
  };

  // ── Add Custom Specialty ──────────────────────────────────────────────────────
  const addCustomSpecialty = async () => {
    if (!newCustomSpecialty.trim()) return;
    const { data, error } = await supabase.from('therapy_specialties')
      .insert({ name: newCustomSpecialty.trim(), is_system: false })
      .select().single();
    if (error) {
      if (error.code === '42501' || error.message?.includes('denied') || error.message?.includes('policy')) {
        showToast('error', 'Sem permissão para criar especialidades. Execute a migration SQL no Supabase.');
      } else {
        showToast('error', 'Erro ao criar especialidade: ' + error.message);
      }
      return;
    }
    if (data) {
      setSpecialties(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setTherapistForm(f => ({ ...f, specialties: [...f.specialties, data.name] }));
    }
    setNewCustomSpecialty('');
  };

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">

      {/* ── Toast ── */}
      {toast && (
        <div className={cn(
          "fixed bottom-6 right-6 z-[200] flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl font-bold text-sm animate-in slide-in-from-bottom-4 duration-300",
          toast.type === 'success' ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"
        )}>
          {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {toast.msg}
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 rounded-full text-[10px] font-bold text-indigo-600 uppercase tracking-widest mb-3">
            <Users className="w-3 h-3" /> Equipe Clínica
          </div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight">Terapeutas</h2>
          <p className="text-slate-500 font-medium text-lg mt-1">
            Gerencie os profissionais, aprovações e configurações de repasse.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-all shadow-sm"
          >
            <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-6 py-3.5 bg-indigo-600 text-white rounded-2xl font-bold shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95"
          >
            <Plus className="w-5 h-5" /> Vincular Terapeuta
          </button>
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: 'Ativos', value: counts.active, color: 'emerald', filter: 'active' as const },
          { label: 'Pendentes', value: counts.pending, color: 'amber', filter: 'pending' as const },
          { label: 'Inativos', value: counts.inactive, color: 'slate', filter: 'inactive' as const },
        ].map(stat => (
          <button
            key={stat.filter}
            onClick={() => setStatusFilter(statusFilter === stat.filter ? 'all' : stat.filter)}
            className={cn(
              "p-5 rounded-2xl border text-left transition-all",
              statusFilter === stat.filter
                ? stat.color === 'emerald' ? "bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-100"
                  : stat.color === 'amber' ? "bg-amber-500 text-white border-amber-500 shadow-lg shadow-amber-100"
                  : "bg-slate-700 text-white border-slate-700 shadow-lg"
                : "bg-white border-slate-100 hover:border-slate-200 shadow-sm hover:shadow-md"
            )}
          >
            <p className={cn("text-3xl font-black", statusFilter !== stat.filter && "text-slate-900")}>{stat.value}</p>
            <p className={cn("text-xs font-bold uppercase tracking-widest mt-1", statusFilter !== stat.filter && "text-slate-400")}>
              {stat.label}
            </p>
          </button>
        ))}
      </div>

      {/* ── Pending Alert ── */}
      {counts.pending > 0 && (
        <div className="flex items-center gap-4 p-5 bg-amber-50 border border-amber-200 rounded-3xl animate-in slide-in-from-top duration-300">
          <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center shrink-0 animate-pulse">
            <Clock className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h4 className="font-bold text-amber-800">
              {counts.pending === 1 ? '1 cadastro aguardando aprovação' : `${counts.pending} cadastros aguardando aprovação`}
            </h4>
            <p className="text-xs text-amber-700 font-medium mt-0.5">
              Terapeutas que se registraram pelo portal e aguardam validação administrativa.
            </p>
          </div>
          <button
            onClick={() => setStatusFilter('pending')}
            className="px-4 py-2 bg-amber-600 text-white rounded-xl text-xs font-bold hover:bg-amber-700 transition-colors shrink-0"
          >
            Ver Pendentes
          </button>
        </div>
      )}

      {/* ── Search + Filter Bar ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Buscar por nome..."
            className="w-full pl-11 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium transition-all"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'active', 'pending', 'inactive'] as const).map(f => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={cn(
                "px-4 py-3 rounded-2xl text-xs font-bold transition-all border",
                statusFilter === f
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-slate-500 border-slate-200 hover:border-indigo-300 hover:text-indigo-600"
              )}
            >
              {f === 'all' ? 'Todos' : f === 'active' ? 'Ativos' : f === 'pending' ? 'Pendentes' : 'Inativos'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Therapist List ── */}
      {loading ? (
        <div className="flex justify-center items-center py-32">
          <div className="text-center space-y-4">
            <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mx-auto" />
            <p className="text-slate-400 font-medium">Carregando terapeutas...</p>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mb-6">
            <Users className="w-10 h-10 text-slate-300" />
          </div>
          <h3 className="text-xl font-bold text-slate-700 mb-2">Nenhum terapeuta encontrado</h3>
          <p className="text-slate-400 text-sm max-w-xs">
            {statusFilter !== 'all' ? 'Tente mudar o filtro de status.' : 'Clique em "Vincular Terapeuta" para começar.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(t => {
            const profileStatus = (t as any).profile_status;
            const isPending = profileStatus === 'pending';
            const isExpanded = expandedId === t.id;

            return (
              <div
                key={t.id}
                className={cn(
                  "bg-white rounded-3xl border overflow-hidden transition-all duration-300 shadow-sm",
                  isPending ? "border-amber-200" : isExpanded ? "border-indigo-200 shadow-lg" : "border-slate-100 hover:border-slate-200 hover:shadow-md"
                )}
              >
                {/* Card Header */}
                <div className="p-6 flex items-center gap-4">
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    {t.avatar_url ? (
                      <img src={t.avatar_url} alt={t.name} className="w-14 h-14 rounded-2xl object-cover" />
                    ) : (
                      <div className={cn(
                        "w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl",
                        isPending ? "bg-amber-100 text-amber-600" : "bg-indigo-100 text-indigo-600"
                      )}>
                        {t.name.charAt(0)}
                      </div>
                    )}
                    {isPending && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full border-2 border-white" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-black text-slate-900 text-lg">{t.name}</h3>
                      <StatusBadge status={isPending ? 'pending' : t.active ? 'active' : 'inactive'} />
                    </div>
                    {t.email && (
                      <p className="text-xs text-slate-500 font-medium mb-1">{t.email}</p>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                      {(t.specialties || []).slice(0, 3).map((s, i) => (
                        <span key={i} className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-100">
                          {s}
                        </span>
                      ))}
                      {(t.specialties || []).length > 3 && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-50 text-slate-400">
                          +{(t.specialties || []).length - 3}
                        </span>
                      )}
                    </div>
                    {t.professional_registration && (
                      <p className="text-xs text-slate-400 font-medium mt-1">
                        <Award className="w-3 h-3 inline mr-1" />{t.professional_registration}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Pending actions */}
                    {isPending && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => rejectTherapist(t)}
                          disabled={approvingId === t.id}
                          className="px-3 py-2 bg-rose-50 text-rose-600 border border-rose-200 rounded-xl text-xs font-bold hover:bg-rose-100 transition-all flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <UserX className="w-3.5 h-3.5" /> Recusar
                        </button>
                        <button
                          onClick={() => setReviewingTherapist(t)}
                          disabled={approvingId === t.id}
                          className="px-3 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-all flex items-center gap-1.5 shadow-lg shadow-emerald-100 disabled:opacity-50"
                        >
                          {approvingId === t.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
                          Revisar e Aprovar
                        </button>
                      </div>
                    )}

                    {/* Inactive reactivate */}
                    {!t.active && !isPending && (
                      <button
                        onClick={() => reactivateTherapist(t)}
                        className="px-3 py-2 bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-all flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Reativar
                      </button>
                    )}

                    {/* Expand toggle */}
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : t.id)}
                      className={cn(
                        "p-2.5 rounded-2xl border transition-all",
                        isExpanded ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-400 border-slate-200 hover:border-indigo-200 hover:text-indigo-600"
                      )}
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Commission chips */}
                <div className="px-6 pb-4 flex flex-wrap gap-3 -mt-2">
                  <div className="flex items-center gap-1.5 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-100">
                    <Percent className="w-3 h-3 text-indigo-500" />
                    <span className="text-[10px] font-bold text-indigo-700">Clínica indica: {t.commission_rate_clinic ?? 50}% p/ clínica</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100">
                    <Percent className="w-3 h-3 text-emerald-500" />
                    <span className="text-[10px] font-bold text-emerald-700">Terapeuta indica: {t.commission_rate_self ?? 25}% p/ clínica</span>
                  </div>
                  {t.attendance_modes && t.attendance_modes.length > 0 && t.attendance_modes.map(m => (
                    <div key={m} className="flex items-center gap-1.5 bg-violet-50 px-3 py-1.5 rounded-xl border border-violet-100">
                      {m === 'online' ? <Monitor className="w-3 h-3 text-violet-500" /> : m === 'domiciliar' ? <Globe className="w-3 h-3 text-violet-500" /> : <MapPin className="w-3 h-3 text-violet-500" />}
                      <span className="text-[10px] font-bold text-violet-700 capitalize">{m}</span>
                    </div>
                  ))}
                </div>

                {/* Expanded Panel */}
                {isExpanded && (
                  <div className="border-t border-slate-100 p-6 space-y-6 bg-slate-50/50 animate-in slide-in-from-top-2 duration-300">

                    {/* Bio */}
                    {t.bio && (
                      <div className="p-4 bg-white rounded-2xl border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Bio</p>
                        <p className="text-sm text-slate-600 font-medium leading-relaxed">{t.bio}</p>
                      </div>
                    )}

                    {/* Room Selector */}
                    <div className="flex items-center gap-3">
                      <DoorOpen className="w-4 h-4 text-slate-400 shrink-0" />
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest shrink-0">Sala Padrão:</label>
                      <select
                        value={t.room_id || ''}
                        onChange={e => updateRoom(t.id, e.target.value)}
                        className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                      >
                        <option value="">Sem sala fixa</option>
                        {rooms.map(r => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Commission Editor Toggle */}
                    <div className="space-y-3">
                      <button
                        onClick={() => {
                          if (editingCommissionId === t.id) {
                            setEditingCommissionId(null);
                          } else {
                            setEditingCommissionId(t.id);
                            setCommissionEdit({
                              rate_clinic: String(t.commission_rate_clinic ?? 50),
                              rate_self: String(t.commission_rate_self ?? 25),
                              pix_key: t.pix_key || '',
                              phone: t.phone || '',
                            });
                          }
                        }}
                        className={cn(
                          "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border transition-all",
                          editingCommissionId === t.id
                            ? "bg-indigo-600 text-white border-indigo-600"
                            : "bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                        )}
                      >
                        <Percent className="w-3.5 h-3.5" />
                        {editingCommissionId === t.id ? 'Fechar Editor de Repasse' : 'Configurar Repasse & Pagamento'}
                      </button>

                      {editingCommissionId === t.id && (
                        <div className="p-5 bg-white rounded-2xl border border-indigo-100 shadow-sm space-y-4 animate-in slide-in-from-top-2 duration-200">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest block">% Clínica indica o paciente</label>
                              <p className="text-[10px] text-slate-400 font-medium">Clínica retém esta % do valor</p>
                              <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3">
                                <input
                                  type="number" min={0} max={100}
                                  value={commissionEdit.rate_clinic}
                                  onChange={e => setCommissionEdit({ ...commissionEdit, rate_clinic: e.target.value })}
                                  className="flex-1 bg-transparent outline-none font-black text-indigo-700 text-2xl w-16"
                                />
                                <span className="text-indigo-400 font-black text-xl">%</span>
                              </div>
                              <p className="text-[10px] text-slate-400 font-bold">Terapeuta recebe: {100 - Number(commissionEdit.rate_clinic)}%</p>
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest block">% Terapeuta traz o paciente</label>
                              <p className="text-[10px] text-slate-400 font-medium">Clínica retém esta % do valor</p>
                              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                                <input
                                  type="number" min={0} max={100}
                                  value={commissionEdit.rate_self}
                                  onChange={e => setCommissionEdit({ ...commissionEdit, rate_self: e.target.value })}
                                  className="flex-1 bg-transparent outline-none font-black text-emerald-700 text-2xl w-16"
                                />
                                <span className="text-emerald-400 font-black text-xl">%</span>
                              </div>
                              <p className="text-[10px] text-slate-400 font-bold">Terapeuta recebe: {100 - Number(commissionEdit.rate_self)}%</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Chave PIX</label>
                              <input
                                value={commissionEdit.pix_key}
                                onChange={e => setCommissionEdit({ ...commissionEdit, pix_key: e.target.value })}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none font-bold text-slate-700 text-sm focus:ring-2 focus:ring-indigo-500/20"
                                placeholder="CPF, e-mail ou telefone"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">WhatsApp</label>
                              <input
                                value={commissionEdit.phone}
                                onChange={e => setCommissionEdit({ ...commissionEdit, phone: e.target.value })}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none font-bold text-slate-700 text-sm focus:ring-2 focus:ring-indigo-500/20"
                                placeholder="(11) 99999-9999"
                              />
                            </div>
                          </div>
                          <button
                            onClick={() => saveCommission(t.id)}
                            disabled={savingCommission}
                            className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                          >
                            {savingCommission ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Salvar Configurações
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Deactivate / Delete Actions */}
                    <div className="pt-2 border-t border-slate-200 space-y-2">
                      {t.active && !isPending && (
                        deletingId === t.id ? (
                          <div className="flex items-center gap-3">
                            <p className="text-sm text-slate-500 font-medium flex-1">Confirmar desativação de <strong>{t.name}</strong>?</p>
                            <button onClick={() => setDeletingId(null)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-600 transition-colors">Cancelar</button>
                            <button onClick={() => deactivateTherapist(t)} className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-xs font-bold transition-colors">Desativar</button>
                          </div>
                        ) : (
                          <button onClick={() => setDeletingId(t.id)} className="flex items-center gap-2 px-4 py-2.5 text-rose-500 bg-rose-50 hover:bg-rose-100 rounded-xl text-xs font-bold transition-all border border-rose-100">
                            <UserX className="w-3.5 h-3.5" /> Desativar Terapeuta
                          </button>
                        )
                      )}
                      <button
                        onClick={() => deleteTherapist(t)}
                        className="flex items-center gap-2 px-4 py-2.5 text-slate-400 hover:text-rose-600 bg-slate-50 hover:bg-rose-50 rounded-xl text-xs font-bold transition-all border border-slate-100 hover:border-rose-200"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Excluir Definitivamente
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          Modal: Vincular Novo Terapeuta
      ══════════════════════════════════════════════════════════════════ */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2.5rem] w-full max-w-2xl shadow-2xl border border-slate-100 overflow-hidden max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-8 border-b border-slate-100 bg-gradient-to-r from-indigo-600 to-violet-700 text-white flex justify-between items-center shrink-0">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  {addStep === 'form' && (
                    <button
                      onClick={() => { setAddStep('search'); setSelectedUser(null); }}
                      className="text-indigo-200 hover:text-white text-xs font-bold transition-colors"
                    >
                      ← Voltar
                    </button>
                  )}
                </div>
                <h3 className="text-2xl font-black">
                  {addStep === 'search' ? 'Vincular Novo Terapeuta' : 'Configurar Perfil Profissional'}
                </h3>
                <p className="text-indigo-200 font-medium mt-1 text-sm">
                  {addStep === 'search'
                    ? 'Passo 1 de 2 — Busque a conta do profissional'
                    : 'Passo 2 de 2 — Preencha os dados do terapeuta'}
                </p>
              </div>
              <button onClick={resetAddModal} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1">
              {/* Step 1: Search User */}
              {addStep === 'search' && (
                <div className="p-8 space-y-6">
                  <div className="flex items-start gap-3 p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                    <AlertCircle className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                    <p className="text-sm text-indigo-700 font-medium leading-relaxed">
                      O profissional precisa ter uma <strong>conta cadastrada</strong> no sistema (via portal de registro ou cadastro manual). Busque pelo nome ou e-mail.
                    </p>
                  </div>

                  <form onSubmit={handleUserSearch} className="flex gap-3">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                      <input
                        autoFocus
                        value={userSearch}
                        onChange={e => setUserSearch(e.target.value)}
                        placeholder="Nome ou e-mail do profissional..."
                        className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium transition-all"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={userSearching}
                      className="px-5 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-colors flex items-center gap-2 disabled:opacity-60"
                    >
                      {userSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                      Buscar
                    </button>
                  </form>

                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {userSearchResults.map(u => (
                      <button
                        key={u.id}
                        onClick={() => handleSelectUser(u)}
                        className="w-full text-left p-4 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-200 border border-slate-100 rounded-2xl cursor-pointer transition-all flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center font-bold text-indigo-600 text-sm">
                            {(u.name || u.email).charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 group-hover:text-indigo-700">{u.name || 'Sem Nome'}</p>
                            <p className="text-xs text-slate-500 font-medium">{u.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {u.status === 'pending' && (
                            <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-amber-50 text-amber-600 border border-amber-100">Pendente</span>
                          )}
                          <span className={cn(
                            'text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full',
                            u.role === 'terapeuta' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-500'
                          )}>
                            {u.role}
                          </span>
                        </div>
                      </button>
                    ))}
                    {userSearchResults.length === 0 && userSearch && !userSearching && (
                      <p className="text-center py-8 text-slate-400 font-medium text-sm">Nenhum usuário encontrado.</p>
                    )}
                  </div>
                </div>
              )}

              {/* Step 2: Form */}
              {addStep === 'form' && selectedUser && (
                <form onSubmit={handleCreateTherapist} className="p-8 space-y-6">
                  {/* Selected User Banner */}
                  <div className="flex items-center justify-between p-4 bg-emerald-50 border border-emerald-100 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                        {(selectedUser.name || selectedUser.email).charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Conta Vinculada</p>
                        <p className="font-bold text-slate-900">{selectedUser.name || 'Sem Nome'}</p>
                        <p className="text-xs text-slate-500">{selectedUser.email}</p>
                      </div>
                    </div>
                    <button type="button" onClick={() => { setAddStep('search'); setSelectedUser(null); }} className="px-3 py-1.5 bg-white border border-slate-200 text-slate-500 rounded-xl text-xs font-bold hover:bg-slate-100 transition-colors">
                      Alterar
                    </button>
                  </div>

                  {/* Basic Info */}
                  <div className="space-y-1">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5" /> Dados Pessoais
                    </h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Nome Completo *</label>
                      <input
                        required
                        value={therapistForm.name}
                        onChange={e => setTherapistForm(f => ({ ...f, name: e.target.value }))}
                        placeholder="Nome que aparecerá no sistema"
                        className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">CPF</label>
                      <input
                        value={therapistForm.cpf}
                        onChange={e => setTherapistForm(f => ({ ...f, cpf: e.target.value }))}
                        placeholder="000.000.000-00"
                        className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">WhatsApp</label>
                      <input
                        value={therapistForm.whatsapp}
                        onChange={e => setTherapistForm(f => ({ ...f, whatsapp: e.target.value }))}
                        placeholder="(11) 99999-9999"
                        className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Registro Profissional (CRP / CRM / etc)</label>
                      <input
                        value={therapistForm.professional_registration}
                        onChange={e => setTherapistForm(f => ({ ...f, professional_registration: e.target.value }))}
                        placeholder="Ex: CRP 06/123456"
                        className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Chave PIX</label>
                      <input
                        value={therapistForm.pix_key}
                        onChange={e => setTherapistForm(f => ({ ...f, pix_key: e.target.value }))}
                        placeholder="CPF, e-mail, telefone ou chave aleatória"
                        className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium transition-all"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Bio / Apresentação Profissional</label>
                      <textarea
                        rows={3}
                        value={therapistForm.bio}
                        onChange={e => setTherapistForm(f => ({ ...f, bio: e.target.value }))}
                        placeholder="Uma breve descrição profissional que aparecerá no perfil..."
                        className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium transition-all resize-none"
                      />
                    </div>
                  </div>

                  {/* Attendance Modes */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <Monitor className="w-3.5 h-3.5" /> Modalidades de Atendimento
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {ATTENDANCE_MODES.map(mode => {
                        const selected = therapistForm.attendance_modes.includes(mode.id);
                        return (
                          <button
                            key={mode.id}
                            type="button"
                            onClick={() => setTherapistForm(f => ({
                              ...f,
                              attendance_modes: selected
                                ? f.attendance_modes.filter(m => m !== mode.id)
                                : [...f.attendance_modes, mode.id]
                            }))}
                            className={cn(
                              "flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold border transition-all",
                              selected
                                ? "bg-violet-600 text-white border-violet-600 shadow-lg shadow-violet-100"
                                : "bg-slate-50 text-slate-600 border-slate-200 hover:border-violet-300 hover:text-violet-600"
                            )}
                          >
                            <mode.icon className="w-3.5 h-3.5" />
                            {mode.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Specialties */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <Star className="w-3.5 h-3.5" /> Especialidades
                    </h4>
                    <div className="flex flex-wrap gap-2 p-4 bg-slate-50 border border-slate-200 rounded-2xl min-h-[56px]">
                      {specialties.map(spec => {
                        const selected = therapistForm.specialties.includes(spec.name);
                        return (
                          <button
                            key={spec.id}
                            type="button"
                            onClick={() => setTherapistForm(f => ({
                              ...f,
                              specialties: selected
                                ? f.specialties.filter(s => s !== spec.name)
                                : [...f.specialties, spec.name]
                            }))}
                            className={cn(
                              'px-3 py-1.5 rounded-full text-xs font-bold transition-all border',
                              selected
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                                : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
                            )}
                          >
                            {spec.name}
                            {!spec.is_system && <span className="ml-1 opacity-60">✦</span>}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex gap-2">
                      <input
                        value={newCustomSpecialty}
                        onChange={e => setNewCustomSpecialty(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomSpecialty(); } }}
                        placeholder="+ Criar especialidade personalizada..."
                        className="flex-1 px-4 py-3 bg-slate-50 border border-dashed border-slate-300 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm font-medium transition-all"
                      />
                      <button
                        type="button"
                        onClick={addCustomSpecialty}
                        disabled={!newCustomSpecialty.trim()}
                        className="px-4 py-3 bg-indigo-600 text-white rounded-2xl font-bold text-sm hover:bg-indigo-700 disabled:opacity-40"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Commission */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <Percent className="w-3.5 h-3.5" /> Comissionamento
                    </h4>
                    <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest block">% Clínica indica o paciente</label>
                        <div className="flex items-center gap-2 bg-white border border-indigo-200 rounded-xl px-3 py-2">
                          <input
                            type="number" min={0} max={100}
                            value={therapistForm.commission_rate_clinic}
                            onChange={e => setTherapistForm(f => ({ ...f, commission_rate_clinic: Number(e.target.value) }))}
                            className="flex-1 bg-transparent outline-none font-black text-indigo-700 text-xl w-10"
                          />
                          <span className="text-indigo-400 font-black">%</span>
                        </div>
                        <p className="text-[10px] text-slate-400">Terapeuta recebe: {100 - therapistForm.commission_rate_clinic}%</p>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest block">% Terapeuta indica o paciente</label>
                        <div className="flex items-center gap-2 bg-white border border-emerald-200 rounded-xl px-3 py-2">
                          <input
                            type="number" min={0} max={100}
                            value={therapistForm.commission_rate_self}
                            onChange={e => setTherapistForm(f => ({ ...f, commission_rate_self: Number(e.target.value) }))}
                            className="flex-1 bg-transparent outline-none font-black text-emerald-700 text-xl w-10"
                          />
                          <span className="text-emerald-400 font-black">%</span>
                        </div>
                        <p className="text-[10px] text-slate-400">Terapeuta recebe: {100 - therapistForm.commission_rate_self}%</p>
                      </div>
                    </div>
                  </div>

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={saving || !therapistForm.name}
                    className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                    Cadastrar Terapeuta
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          Modal: Revisar e Aprovar Terapeuta
      ══════════════════════════════════════════════════════════════════ */}
      {reviewingTherapist && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2.5rem] w-full max-w-xl shadow-2xl border border-slate-100 overflow-hidden max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-8 border-b border-slate-100 bg-gradient-to-r from-emerald-600 to-teal-600 text-white flex justify-between items-start shrink-0">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full text-[10px] font-bold uppercase tracking-widest mb-3">
                  <UserCheck className="w-3 h-3" /> Aprovação Pendente
                </div>
                <h3 className="text-2xl font-black">Revisar Cadastro</h3>
                <p className="text-emerald-100 font-medium mt-1 text-sm">
                  Revise os dados antes de aprovar o profissional
                </p>
              </div>
              <button onClick={() => setReviewingTherapist(null)} className="p-2 hover:bg-white/20 rounded-full transition-colors mt-1">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-8 space-y-6">
              {/* Therapist Identity */}
              <div className="flex items-center gap-4 p-5 bg-emerald-50 border border-emerald-100 rounded-2xl">
                <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-2xl shrink-0">
                  {reviewingTherapist.avatar_url
                    ? <img src={reviewingTherapist.avatar_url} alt={reviewingTherapist.name} className="w-16 h-16 rounded-2xl object-cover" />
                    : reviewingTherapist.name.charAt(0)
                  }
                </div>
                <div>
                  <h4 className="font-black text-slate-900 text-xl">{reviewingTherapist.name}</h4>
                  {reviewingTherapist.email && (
                    <p className="text-sm text-slate-500 font-medium">{reviewingTherapist.email}</p>
                  )}
                  {reviewingTherapist.professional_registration && (
                    <p className="text-sm text-emerald-700 font-bold mt-1">
                      <Award className="w-3.5 h-3.5 inline mr-1" />
                      {reviewingTherapist.professional_registration}
                    </p>
                  )}
                </div>
              </div>

              {/* Contact Info */}
              <div className="grid grid-cols-2 gap-4">
                {reviewingTherapist.phone && (
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                      <Phone className="w-3 h-3" /> WhatsApp
                    </p>
                    <p className="font-bold text-slate-800">{reviewingTherapist.phone}</p>
                  </div>
                )}
                {reviewingTherapist.pix_key && (
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                      <CreditCard className="w-3 h-3" /> Chave PIX
                    </p>
                    <p className="font-bold text-slate-800 text-sm break-all">{reviewingTherapist.pix_key}</p>
                  </div>
                )}
              </div>

              {/* Bio */}
              {reviewingTherapist.bio && (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <FileText className="w-3 h-3" /> Bio Profissional
                  </p>
                  <p className="text-sm text-slate-600 font-medium leading-relaxed">{reviewingTherapist.bio}</p>
                </div>
              )}

              {/* Specialties */}
              {(reviewingTherapist.specialties || []).length > 0 && (
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <Star className="w-3 h-3" /> Especialidades
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(reviewingTherapist.specialties || []).map((s, i) => (
                      <span key={i} className="px-3 py-1.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Attendance Modes */}
              {(reviewingTherapist.attendance_modes || []).length > 0 && (
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <Monitor className="w-3 h-3" /> Modalidades de Atendimento
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(reviewingTherapist.attendance_modes || []).map((m, i) => (
                      <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-violet-50 text-violet-700 border border-violet-100 rounded-full text-xs font-bold capitalize">
                        {m === 'online' ? <Monitor className="w-3 h-3" /> : m === 'domiciliar' ? <Globe className="w-3 h-3" /> : <MapPin className="w-3 h-3" />}
                        {m}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No data notice */}
              {!reviewingTherapist.bio && (reviewingTherapist.specialties || []).length === 0 && (
                <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-100 rounded-2xl">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                  <p className="text-sm text-amber-700 font-medium">
                    Este terapeuta ainda não preencheu bio ou especialidades. Você pode aprovar agora e aguardar a atualização do perfil.
                  </p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex gap-3 shrink-0">
              <button
                onClick={() => {
                  setReviewingTherapist(null);
                  rejectTherapist(reviewingTherapist);
                }}
                disabled={approvingId === reviewingTherapist.id}
                className="flex-1 py-3.5 bg-white border border-rose-200 text-rose-600 rounded-2xl font-bold hover:bg-rose-50 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <UserX className="w-4 h-4" /> Recusar Cadastro
              </button>
              <button
                onClick={() => {
                  approveTherapist(reviewingTherapist);
                  setReviewingTherapist(null);
                }}
                disabled={approvingId === reviewingTherapist.id}
                className="flex-1 py-3.5 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-100 disabled:opacity-50"
              >
                {approvingId === reviewingTherapist.id
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <UserCheck className="w-4 h-4" />
                }
                Aprovar e Ativar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
