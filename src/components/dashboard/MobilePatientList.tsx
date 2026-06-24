import React, { useState, useEffect } from 'react';
import {
  Search, Phone, MessageSquare, User, Plus, X, Loader2,
  ChevronRight, Heart, FileText, Calendar, MapPin, Mail,
  CheckCircle2, AlertCircle, Clock, Send
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { supabase } from '@/src/lib/supabase';
import { sendWhatsAppMessage } from '@/src/lib/whatsapp';
import { getSystemBaseUrl } from '@/src/utils/systemUrl';
import { useAuth } from '@/src/contexts/AuthContext';

const statusColor: Record<string, string> = {
  Ativo: 'bg-emerald-100 text-emerald-700',
  Inativo: 'bg-slate-100 text-slate-500',
  Alta: 'bg-blue-100 text-blue-700',
  default: 'bg-amber-100 text-amber-700',
};

export default function MobilePatientList() {
  const { user } = useAuth();
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [toast, setToast] = useState('');
  const [sending, setSending] = useState(false);

  // New patient modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPatient, setNewPatient] = useState({ name: '', phone: '', email: '' });
  const [saving, setSaving] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const fetchPatients = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('patients')
      .select('id, name, phone, email, status, birth_date, city, anamnesis_token, created_at')
      .order('name', { ascending: true });
    if (!error && data) setPatients(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  const filteredPatients = patients.filter(p =>
    p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.phone?.includes(searchTerm) ||
    p.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleWhatsApp = (patient: any) => {
    if (!patient.phone) return showToast('Paciente sem telefone cadastrado.');
    const phone = patient.phone.replace(/\D/g, '');
    window.open(`https://wa.me/55${phone}`, '_blank');
  };

  const handleCall = (patient: any) => {
    if (!patient.phone) return showToast('Paciente sem telefone cadastrado.');
    window.location.href = `tel:${patient.phone}`;
  };

  const handleSendAnamnesisLink = async (patient: any) => {
    if (!patient.phone) return showToast('Paciente sem telefone cadastrado.');
    setSending(true);
    try {
      const baseUrl = await getSystemBaseUrl();
      const link = `${baseUrl}/anamnese/${patient.anamnesis_token || patient.id}`;
      const firstName = patient.name.split(' ')[0] || 'Paciente';
      const msg = `[Ficha de Entrada - Tzion Terapias]\n\nOlá, *${firstName}*! ✨\n\nPor favor, preencha a sua Ficha de Anamnese antes da nossa próxima sessão:\n\n🔗 ${link}\n\nQualquer dúvida, estamos à disposição! 💙`;
      const sent = await sendWhatsAppMessage(patient.id, patient.phone, msg, 'anamnesis_invite');
      showToast(sent ? 'Link de anamnese enviado!' : 'Erro ao enviar link.');
    } finally {
      setSending(false);
    }
  };

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPatient.name || !newPatient.phone) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('patients').insert([{
        name: newPatient.name,
        phone: newPatient.phone,
        email: newPatient.email || null,
        status: 'Ativo',
      }]);
      if (error) throw error;
      showToast('Paciente cadastrado com sucesso!');
      setShowAddModal(false);
      setNewPatient({ name: '', phone: '', email: '' });
      fetchPatients();
    } catch (err: any) {
      showToast('Erro ao cadastrar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const getInitials = (name: string) =>
    name?.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase() || '?';

  const getAge = (birthDate: string) => {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  };

  return (
    <div className="flex flex-col h-full bg-[#F8FAFC] pb-4">
      {/* Toast */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-sm font-bold px-5 py-3 rounded-2xl shadow-xl animate-in fade-in slide-in-from-top-4 duration-200">
          {toast}
        </div>
      )}

      {/* Header strip */}
      <div className="px-4 pt-4 pb-2 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-900">Pacientes</h2>
            <p className="text-xs text-slate-400 font-medium">{patients.length} cadastrados</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="w-10 h-10 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200 active:scale-95 transition-transform"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Buscar por nome, telefone ou e-mail..."
            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Patient List */}
      <div className="flex-1 overflow-y-auto px-4 space-y-2 pt-2">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          </div>
        ) : filteredPatients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-3 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center">
              <User className="w-8 h-8 text-slate-300" />
            </div>
            <p className="text-slate-500 font-medium text-sm">
              {searchTerm ? 'Nenhum paciente encontrado.' : 'Nenhum paciente cadastrado.'}
            </p>
          </div>
        ) : (
          filteredPatients.map(patient => (
            <button
              key={patient.id}
              onClick={() => setSelectedPatient(patient)}
              className="w-full text-left bg-white border border-slate-100 rounded-2xl p-4 flex items-center gap-3 shadow-sm active:scale-[0.99] transition-transform hover:border-indigo-100"
            >
              {/* Avatar */}
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center font-black text-indigo-600 text-sm shrink-0 border border-indigo-100">
                {getInitials(patient.name)}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="font-bold text-slate-900 text-sm truncate">{patient.name}</p>
                  {patient.status && (
                    <span className={cn(
                      'text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full shrink-0',
                      statusColor[patient.status] || statusColor.default
                    )}>
                      {patient.status}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 font-medium truncate">
                  {patient.phone || patient.email || 'Sem contato'}
                  {getAge(patient.birth_date) && ` · ${getAge(patient.birth_date)} anos`}
                </p>
              </div>

              <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
            </button>
          ))
        )}
      </div>

      {/* Patient Detail Bottom Sheet */}
      {selectedPatient && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => setSelectedPatient(null)}
          />

          {/* Sheet */}
          <div className="relative bg-white rounded-t-[2rem] px-5 pt-5 pb-8 space-y-5 max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom-4 duration-300">
            {/* Drag Handle */}
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-2" />

            {/* Close */}
            <button
              onClick={() => setSelectedPatient(null)}
              className="absolute top-5 right-5 w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center"
            >
              <X className="w-4 h-4 text-slate-500" />
            </button>

            {/* Patient Header */}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center font-black text-indigo-600 text-xl border border-indigo-100">
                {getInitials(selectedPatient.name)}
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900">{selectedPatient.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  {selectedPatient.status && (
                    <span className={cn(
                      'text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full',
                      statusColor[selectedPatient.status] || statusColor.default
                    )}>
                      {selectedPatient.status}
                    </span>
                  )}
                  {getAge(selectedPatient.birth_date) && (
                    <span className="text-xs text-slate-400 font-medium">{getAge(selectedPatient.birth_date)} anos</span>
                  )}
                </div>
              </div>
            </div>

            {/* Contact Info */}
            <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
              {selectedPatient.phone && (
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="font-medium text-slate-700">{selectedPatient.phone}</span>
                </div>
              )}
              {selectedPatient.email && (
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="font-medium text-slate-700 truncate">{selectedPatient.email}</span>
                </div>
              )}
              {selectedPatient.city && (
                <div className="flex items-center gap-3 text-sm">
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="font-medium text-slate-700">{selectedPatient.city}</span>
                </div>
              )}
              {!selectedPatient.phone && !selectedPatient.email && (
                <p className="text-xs text-slate-400 text-center py-2">Nenhum contato cadastrado</p>
              )}
            </div>

            {/* Quick Actions */}
            <div className="space-y-2">
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Ações Rápidas</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleWhatsApp(selectedPatient)}
                  disabled={!selectedPatient.phone}
                  className="flex items-center justify-center gap-2 py-3.5 bg-emerald-50 text-emerald-700 font-bold rounded-2xl text-sm border border-emerald-100 active:scale-95 transition-transform disabled:opacity-40"
                >
                  <MessageSquare className="w-4 h-4" />
                  WhatsApp
                </button>
                <button
                  onClick={() => handleCall(selectedPatient)}
                  disabled={!selectedPatient.phone}
                  className="flex items-center justify-center gap-2 py-3.5 bg-blue-50 text-blue-700 font-bold rounded-2xl text-sm border border-blue-100 active:scale-95 transition-transform disabled:opacity-40"
                >
                  <Phone className="w-4 h-4" />
                  Ligar
                </button>
              </div>
              <button
                onClick={() => handleSendAnamnesisLink(selectedPatient)}
                disabled={!selectedPatient.phone || sending}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-indigo-600 text-white font-bold rounded-2xl text-sm active:scale-95 transition-transform disabled:opacity-60 shadow-lg shadow-indigo-200"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Enviar Link de Anamnese
              </button>
            </div>

            {/* Info note */}
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-2xl p-3">
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 font-medium leading-relaxed">
                Para editar prontuário, anamnese e histórico completo acesse pelo computador.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Add Patient Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
          <div className="relative bg-white rounded-t-[2rem] px-5 pt-5 pb-8 space-y-4 animate-in slide-in-from-bottom-4 duration-300">
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-2" />
            <button onClick={() => setShowAddModal(false)} className="absolute top-5 right-5 w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center">
              <X className="w-4 h-4 text-slate-500" />
            </button>

            <div>
              <h3 className="text-xl font-black text-slate-900">Novo Paciente</h3>
              <p className="text-xs text-slate-400 mt-1">Cadastro rápido. Demais dados pelo computador.</p>
            </div>

            <form onSubmit={handleQuickAdd} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Nome *</label>
                <input
                  required
                  value={newPatient.name}
                  onChange={e => setNewPatient(p => ({ ...p, name: e.target.value }))}
                  placeholder="Nome completo"
                  className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1.5">WhatsApp *</label>
                <input
                  required
                  type="tel"
                  value={newPatient.phone}
                  onChange={e => setNewPatient(p => ({ ...p, phone: e.target.value }))}
                  placeholder="(11) 99999-9999"
                  className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1.5">E-mail</label>
                <input
                  type="email"
                  value={newPatient.email}
                  onChange={e => setNewPatient(p => ({ ...p, email: e.target.value }))}
                  placeholder="email@exemplo.com"
                  className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-lg shadow-indigo-200 active:scale-95 transition-transform disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Cadastrar Paciente
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
