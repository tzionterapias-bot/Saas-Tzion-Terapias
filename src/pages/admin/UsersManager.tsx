import React, { useState, useEffect } from 'react';
import { supabase } from '@/src/lib/supabase';
import { Shield, UserPlus, Trash2, Edit2, CheckCircle2, ShieldAlert, Loader2, Search, User, X, AlertCircle, UserCheck, UserX } from 'lucide-react';

interface UserProfile {
  id: string;
  name: string | null;
  email: string;
  role: 'admin' | 'terapeuta' | 'atendimento' | 'financeiro' | 'paciente';
  status: string;
  phone?: string | null;
  specialty?: string | null;
}

export default function UsersManager() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Promotion Modal State
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<UserProfile | null>(null);
  const [promotionRole, setPromotionRole] = useState<'admin' | 'terapeuta' | 'atendimento' | 'financeiro'>('atendimento');

  // Edit Modal State
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editRole, setEditRole] = useState<'admin' | 'terapeuta' | 'atendimento' | 'financeiro'>('atendimento');
  const [editStatus, setEditStatus] = useState<string>('active');

  const [saving, setSaving] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .neq('role', 'paciente')
        .order('name');
        
      if (data) {
        setUsers(data as UserProfile[]);
      }
    } catch (e) {
      console.error("Erro ao buscar usuários", e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleSearchProfiles = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .or(`name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`)
        .limit(10);
        
      if (data) {
        setSearchResults(data as UserProfile[]);
      }
    } catch (e) {
      console.error("Erro ao buscar perfis:", e);
    }
    setSearching(false);
  };

  const handlePromoteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProfile) return;
    setSaving(true);

    try {
      // 1. Atualizar perfil
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          role: promotionRole,
          status: 'active',
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedProfile.id);

      if (profileError) throw profileError;

      // 2. Se for terapeuta, vincular/criar na tabela 'therapists'
      if (promotionRole === 'terapeuta') {
        const { data: existingTherapist } = await supabase
          .from('therapists')
          .select('id')
          .eq('user_id', selectedProfile.id)
          .maybeSingle();

        if (existingTherapist) {
          await supabase
            .from('therapists')
            .update({
              name: selectedProfile.name || selectedProfile.email.split('@')[0],
              email: selectedProfile.email,
              phone: selectedProfile.phone || null,
              active: true
            })
            .eq('id', existingTherapist.id);
        } else {
          await supabase
            .from('therapists')
            .insert([{
              user_id: selectedProfile.id,
              name: selectedProfile.name || selectedProfile.email.split('@')[0],
              email: selectedProfile.email,
              phone: selectedProfile.phone || null,
              specialty: selectedProfile.specialty || 'Terapeuta',
              active: true,
              commission_rate: 0
            }]);
        }
      }

      setShowPromoteModal(false);
      setSelectedProfile(null);
      setSearchQuery('');
      setSearchResults([]);
      fetchUsers();
    } catch (err) {
      console.error(err);
      alert('Erro ao promover usuário. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setSaving(true);

    try {
      // 1. Atualizar perfil
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          role: editRole,
          status: editStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingUser.id);

      if (profileError) throw profileError;

      // 2. Ajustes se for terapeuta
      if (editRole === 'terapeuta' && editStatus === 'active') {
        const { data: existingTherapist } = await supabase
          .from('therapists')
          .select('id')
          .eq('user_id', editingUser.id)
          .maybeSingle();

        if (existingTherapist) {
          await supabase
            .from('therapists')
            .update({
              name: editingUser.name || editingUser.email.split('@')[0],
              email: editingUser.email,
              phone: editingUser.phone || null,
              active: true
            })
            .eq('id', existingTherapist.id);
        } else {
          await supabase
            .from('therapists')
            .insert([{
              user_id: editingUser.id,
              name: editingUser.name || editingUser.email.split('@')[0],
              email: editingUser.email,
              phone: editingUser.phone || null,
              specialty: editingUser.specialty || 'Terapeuta',
              active: true,
              commission_rate: 0
            }]);
        }
      } else {
        // Se mudou de cargo ou foi inativado, desativar terapeuta
        await supabase
          .from('therapists')
          .update({ active: false })
          .eq('user_id', editingUser.id);
      }

      setEditingUser(null);
      fetchUsers();
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar alterações.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (user: UserProfile) => {
    if (confirm(`Tem certeza que deseja revogar o acesso administrativo de ${user.name || user.email}? Ele será rebaixado a paciente.`)) {
      try {
        await supabase
          .from('profiles')
          .update({ role: 'paciente' })
          .eq('id', user.id);
          
        await supabase
          .from('therapists')
          .update({ active: false })
          .eq('user_id', user.id);

        fetchUsers();
      } catch (err) {
        console.error(err);
        alert('Erro ao revogar acesso.');
      }
    }
  };

  const startEdit = (user: UserProfile) => {
    setEditingUser(user);
    setEditRole(user.role as any);
    setEditStatus(user.status);
  };

  const handleApproveUser = async (user: UserProfile) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .eq('id', user.id);
      if (error) throw error;

      // Se for terapeuta, certificar que está ativo na tabela de terapeutas também
      if (user.role === 'terapeuta') {
        // Primeiro verificamos se o registro existe na tabela therapists
        const { data: existing } = await supabase
          .from('therapists')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (existing) {
          await supabase
            .from('therapists')
            .update({ active: true })
            .eq('id', existing.id);
        } else {
          await supabase
            .from('therapists')
            .insert([{
              user_id: user.id,
              name: user.name || user.email.split('@')[0],
              email: user.email,
              phone: user.phone || null,
              active: true,
              commission_rate: 0
            }]);
        }
      }

      fetchUsers();
    } catch (err) {
      console.error(err);
      alert('Erro ao aprovar usuário.');
    } finally {
      setSaving(false);
    }
  };

  const handleRejectUser = async (user: UserProfile) => {
    if (confirm(`Tem certeza que deseja inativar o acesso de ${user.name || user.email}?`)) {
      setSaving(true);
      try {
        const { error } = await supabase
          .from('profiles')
          .update({ status: 'inactive', updated_at: new Date().toISOString() })
          .eq('id', user.id);
        if (error) throw error;

        if (user.role === 'terapeuta') {
          await supabase
            .from('therapists')
            .update({ active: false })
            .eq('user_id', user.id);
        }

        fetchUsers();
      } catch (err) {
        console.error(err);
        alert('Erro ao inativar usuário.');
      } finally {
        setSaving(false);
      }
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 rounded-full text-[10px] font-bold text-indigo-600 uppercase tracking-widest mb-4">
            <Shield className="w-3 h-3" /> Controle de Acesso
          </div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight">Gestão de Usuários</h2>
          <p className="text-slate-500 font-medium text-lg">Gerencie os acessos e permissões da sua equipe clínica.</p>
        </div>
        
        <button 
          onClick={() => setShowPromoteModal(true)}
          className="px-6 py-3.5 bg-indigo-600 text-white rounded-2xl font-bold shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-2 active:scale-95 animate-in fade-in"
        >
          <UserPlus className="w-5 h-5" /> Promover Usuário
        </button>
      </div>

      <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
           <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>
        ) : users.length === 0 ? (
           <div className="p-20 text-center flex flex-col items-center">
             <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 mb-4">
               <ShieldAlert className="w-8 h-8" />
             </div>
             <h3 className="text-xl font-bold text-slate-900 mb-2">Nenhum usuário da equipe cadastrado</h3>
             <p className="text-slate-500">Promova contas de pacientes ou novos cadastros para atribuir cargos.</p>
           </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Usuário</th>
                  <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Email de Acesso</th>
                  <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                  <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cargo (Nível de Acesso)</th>
                  <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map(user => (
                  <tr key={user.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="p-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold">
                          {(user.name || user.email).charAt(0).toUpperCase()}
                        </div>
                        <span className="font-bold text-slate-900">{user.name || 'Sem Nome Cadastrado'}</span>
                      </div>
                    </td>
                    <td className="p-6 text-slate-600 font-medium">{user.email}</td>
                    <td className="p-6">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                        user.status === 'active' ? 'bg-emerald-50 text-emerald-600' :
                        user.status === 'pending' ? 'bg-amber-50 text-amber-600' :
                        'bg-slate-100 text-slate-500'
                      }`}>
                        {user.status === 'active' ? 'Ativo' : user.status === 'pending' ? 'Pendente' : 'Inativo'}
                      </span>
                    </td>
                    <td className="p-6">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                        user.role === 'admin' ? 'bg-rose-50 text-rose-600' :
                        user.role === 'terapeuta' ? 'bg-indigo-50 text-indigo-600' :
                        user.role === 'financeiro' ? 'bg-emerald-50 text-emerald-600' :
                        'bg-blue-50 text-blue-600'
                      }`}>
                        {user.role === 'admin' ? 'Administrador' :
                         user.role === 'terapeuta' ? 'Terapeuta' :
                         user.role === 'financeiro' ? 'Financeiro' : 'Atendimento'}
                      </span>
                    </td>
                    <td className="p-6 text-right">
                      <div className="flex justify-end gap-2 items-center">
                        {user.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleApproveUser(user)}
                              title="Aprovar Usuário"
                              className="px-2.5 py-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-sm"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              <span>Aprovar</span>
                            </button>
                            <button
                              onClick={() => handleRejectUser(user)}
                              title="Inativar/Recusar"
                              className="px-2.5 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-sm"
                            >
                              <UserX className="w-3.5 h-3.5" />
                              <span>Recusar</span>
                            </button>
                          </>
                        )}
                        <button 
                          onClick={() => startEdit(user)} 
                          title="Editar Permissões"
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl border border-slate-100 hover:border-indigo-100 transition-all"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(user)} 
                          title="Revogar Acesso"
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl border border-slate-100 hover:border-rose-100 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Promover Usuário */}
      {showPromoteModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] w-full max-w-xl shadow-2xl overflow-hidden border border-slate-100">
            <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-black text-slate-900">Promover Conta de Usuário</h3>
                <p className="text-slate-500 font-medium mt-1">Busque um usuário cadastrado no sistema para promovê-lo a funcionário.</p>
              </div>
              <button 
                onClick={() => { setShowPromoteModal(false); setSelectedProfile(null); setSearchQuery(''); setSearchResults([]); }}
                className="p-2 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-8 space-y-6">
              {!selectedProfile ? (
                <div className="space-y-4">
                  <form onSubmit={handleSearchProfiles} className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                      <input 
                        required
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium" 
                        placeholder="Buscar por nome ou e-mail..." 
                      />
                    </div>
                    <button type="submit" disabled={searching} className="px-6 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center">
                      {searching ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Buscar'}
                    </button>
                  </form>

                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {searchResults.map(profile => (
                      <div 
                        key={profile.id}
                        onClick={() => setSelectedProfile(profile)}
                        className="p-4 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-200 border border-slate-100 rounded-2xl cursor-pointer transition-all flex items-center justify-between"
                      >
                        <div>
                          <p className="font-bold text-slate-900">{profile.name || 'Sem Nome'}</p>
                          <p className="text-xs text-slate-500">{profile.email}</p>
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-200 text-slate-600 px-2 py-0.5 rounded">
                          {profile.role}
                        </span>
                      </div>
                    ))}
                    {searchResults.length === 0 && searchQuery && !searching && (
                      <p className="text-center py-6 text-slate-400 font-medium text-sm">Nenhum resultado encontrado.</p>
                    )}
                  </div>
                </div>
              ) : (
                <form onSubmit={handlePromoteUser} className="space-y-6">
                  <div className="p-6 bg-indigo-50/50 rounded-3xl border border-indigo-100/50 flex items-center justify-between">
                    <div>
                      <span className="text-[9px] font-black uppercase tracking-widest text-indigo-600">Usuário Selecionado</span>
                      <h4 className="text-lg font-bold text-slate-900 mt-1">{selectedProfile.name || 'Sem Nome'}</h4>
                      <p className="text-sm text-slate-500 font-medium">{selectedProfile.email}</p>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => setSelectedProfile(null)}
                      className="px-3 py-1.5 bg-white border border-slate-200 text-slate-500 rounded-xl text-xs font-bold hover:bg-slate-100 transition-colors"
                    >
                      Alterar
                    </button>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nível de Acesso (Cargo)</label>
                    <select 
                      value={promotionRole}
                      onChange={e => setPromotionRole(e.target.value as any)}
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none appearance-none cursor-pointer font-bold text-slate-700"
                    >
                      <option value="atendimento">Recepção / Atendimento</option>
                      <option value="terapeuta">Terapeuta</option>
                      <option value="financeiro">Financeiro</option>
                      <option value="admin">Administrador Geral</option>
                    </select>
                  </div>

                  <div className="pt-4 flex gap-4">
                    <button type="button" onClick={() => setSelectedProfile(null)} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-colors">Voltar</button>
                    <button type="submit" disabled={saving} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100 flex justify-center items-center gap-2">
                      {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />} Promover Conta
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Usuário */}
      {editingUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl overflow-hidden border border-slate-100">
            <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-black text-slate-900">Editar Permissões</h3>
                <p className="text-slate-500 font-medium mt-1">Altere o cargo ou desative o acesso de {editingUser.name || editingUser.email}.</p>
              </div>
              <button 
                onClick={() => setEditingUser(null)}
                className="p-2 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleSaveEdit} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nível de Acesso (Cargo)</label>
                <select 
                  value={editRole}
                  onChange={e => setEditRole(e.target.value as any)}
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none appearance-none cursor-pointer font-bold text-slate-700"
                >
                  <option value="atendimento">Recepção / Atendimento</option>
                  <option value="terapeuta">Terapeuta</option>
                  <option value="financeiro">Financeiro</option>
                  <option value="admin">Administrador Geral</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Status da Conta</label>
                <select 
                  value={editStatus}
                  onChange={e => setEditStatus(e.target.value)}
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none appearance-none cursor-pointer font-bold text-slate-700"
                >
                  <option value="active">Ativo (Acesso Liberado)</option>
                  <option value="inactive">Inativo (Acesso Bloqueado)</option>
                </select>
              </div>

              <div className="pt-4 flex gap-4">
                <button type="button" onClick={() => setEditingUser(null)} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-colors">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100 flex justify-center items-center gap-2">
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />} Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
