import React, { useState, useEffect, useRef } from 'react';
import { 
  Megaphone, Plus, Search, MessageSquare, Play, Pause, RefreshCw, 
  Send, Users, Calendar, AlertCircle, FileText, Image as ImageIcon, 
  Loader2, CheckCircle2, XCircle, Clock, Trash2, Upload, HelpCircle, 
  Eye, Filter, CalendarClock, Zap, BarChart2, ChevronLeft, ChevronRight, X
} from 'lucide-react';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/contexts/AuthContext';
import { cn } from '@/src/lib/utils';

interface Campaign {
  id: string;
  name: string;
  message: string;
  delay_seconds: number;
  target_gender: string;
  attachment_url: string;
  status: 'draft' | 'scheduled' | 'running' | 'completed' | 'paused' | 'failed';
  created_at: string;
  scheduled_at: string | null;
  total_contacts: number;
  sent_contacts: number;
}

interface CampaignLog {
  id: string;
  patient_id: string;
  patient_phone: string;
  status: 'pending' | 'sent' | 'failed';
  error_message: string | null;
  sent_at: string | null;
  patients?: { name: string };
}

function formatWhatsAppMessage(text: string) {
  if (!text) return "";
  let escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  escaped = escaped.replace(/\*([^\*]+)\*/g, "<strong>$1</strong>");
  escaped = escaped.replace(/_([^_]+)_/g, "<em>$1</em>");
  escaped = escaped.replace(/~([^~]+)~/g, "<del>$1</del>");
  escaped = escaped.replace(/\n/g, "<br />");
  return escaped;
}

const STATUS_CONFIG = {
  draft:     { label: 'Rascunho',    color: 'bg-slate-100 text-slate-600' },
  scheduled: { label: 'Agendado',    color: 'bg-violet-100 text-violet-700 animate-pulse' },
  running:   { label: 'Disparando',  color: 'bg-indigo-100 text-indigo-700 animate-pulse' },
  paused:    { label: 'Pausado',     color: 'bg-amber-100 text-amber-700' },
  completed: { label: 'Concluído',   color: 'bg-emerald-100 text-emerald-700' },
  failed:    { label: 'Falhou',      color: 'bg-rose-100 text-rose-700' },
};

export default function CampaignsPage() {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'scheduled' | 'running' | 'completed'>('all');

  // Form States
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [delaySeconds, setDelaySeconds] = useState(15);
  const [targetGender, setTargetGender] = useState('all');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [attachmentBase64, setAttachmentBase64] = useState<string | null>(null);
  const [attachmentName, setAttachmentName] = useState('');
  const [attachmentType, setAttachmentType] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [useSchedule, setUseSchedule] = useState(false);

  // Audience
  const [estimatedCount, setEstimatedCount] = useState(0);
  const [patientsList, setPatientsList] = useState<any[]>([]);

  // Logs Modal
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [selectedCampaignLogs, setSelectedCampaignLogs] = useState<CampaignLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logsPage, setLogsPage] = useState(1);
  const logsPerPage = 10;

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const actionInProgressRef = useRef<Set<string>>(new Set());

  useEffect(() => { setLogsPage(1); }, [selectedCampaign]);
  const totalLogsPages = Math.ceil(selectedCampaignLogs.length / logsPerPage);
  const paginatedLogs = selectedCampaignLogs.slice((logsPage - 1) * logsPerPage, logsPage * logsPerPage);

  useEffect(() => { fetchCampaigns(); fetchPatients(); }, []);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  // Auto-poll when a campaign is running
  useEffect(() => {
    const hasRunning = campaigns.some(c => c.status === 'running' || c.status === 'scheduled');
    if (!hasRunning) return;
    const interval = setInterval(fetchCampaigns, 6000);
    return () => clearInterval(interval);
  }, [campaigns]);

  // Target estimation
  useEffect(() => {
    if (patientsList.length > 0) {
      const filtered = patientsList.filter(p => targetGender === 'all' || p.gender === targetGender);
      setEstimatedCount(filtered.length);
    }
  }, [targetGender, patientsList]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => setToast({ message, type });

  const fetchPatients = async () => {
    const { data } = await supabase.from('patients').select('id, name, gender, phone').eq('status', 'Ativo');
    if (data) setPatientsList(data);
  };

  const fetchCampaigns = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('campaigns').select('*').order('created_at', { ascending: false });
    if (error) showToast('Erro ao carregar campanhas', 'error');
    else if (data) setCampaigns(data);
    setLoading(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { showToast('O arquivo não pode exceder 10MB', 'error'); return; }
    setAttachment(file);
    setAttachmentName(file.name);
    setAttachmentType(file.type);
    const reader = new FileReader();
    reader.onloadend = () => setAttachmentBase64(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !message.trim()) { showToast('Preencha os campos obrigatórios', 'error'); return; }

    setSaving(true);
    try {
      const targets = patientsList.filter(p => targetGender === 'all' || p.gender === targetGender);
      if (targets.length === 0) { showToast('Nenhum paciente ativo atende aos filtros', 'error'); setSaving(false); return; }

      // Upload anexo se houver
      let attachmentUrl = '';
      if (attachment && attachmentBase64) {
        const fileExt = attachmentName.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `attachments/${fileName}`;
        const base64Data = attachmentBase64.split(',')[1];
        const binaryString = window.atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
        const { error: uploadError } = await supabase.storage.from('campaign_attachments').upload(filePath, bytes.buffer, { contentType: attachmentType, cacheControl: '3600', upsert: false });
        if (!uploadError) {
          const { data: publicUrlData } = supabase.storage.from('campaign_attachments').getPublicUrl(filePath);
          attachmentUrl = publicUrlData?.publicUrl || '';
        }
      }

      // Determinar status inicial
      let initialStatus: Campaign['status'] = 'draft';
      let scheduledAtValue: string | null = null;
      if (useSchedule && scheduledAt) {
        initialStatus = 'scheduled';
        scheduledAtValue = new Date(scheduledAt).toISOString();
      }

      // Salvar campanha
      const { data: campaignData, error: campaignError } = await supabase
        .from('campaigns')
        .insert([{
          name, message,
          delay_seconds: delaySeconds,
          target_gender: targetGender,
          attachment_url: attachmentUrl,
          status: initialStatus,
          scheduled_at: scheduledAtValue,
          total_contacts: targets.length,
          sent_contacts: 0,
          created_by: user?.id
        }])
        .select().single();
      if (campaignError) throw campaignError;

      // Salvar fila de envio — com upsert para evitar duplicatas
      const logsPayload = targets.map(p => ({
        campaign_id: campaignData.id,
        patient_id: p.id,
        patient_phone: p.phone,
        status: 'pending'
      }));
      const { error: logsError } = await supabase.from('campaign_logs').upsert(logsPayload, { onConflict: 'campaign_id,patient_id', ignoreDuplicates: true });
      if (logsError) throw logsError;

      showToast(useSchedule && scheduledAt ? 'Campanha agendada com sucesso!' : 'Campanha salva como rascunho!');
      setShowCreateModal(false);
      resetForm();
      fetchCampaigns();
    } catch (err: any) {
      showToast(`Erro ao criar campanha: ${err.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setName(''); setMessage(''); setDelaySeconds(15); setTargetGender('all');
    setAttachment(null); setAttachmentBase64(null); setAttachmentName(''); setAttachmentType('');
    setScheduledAt(''); setUseSchedule(false);
  };

  const handleOpenLogs = async (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setLoadingLogs(true);
    const { data, error } = await supabase.from('campaign_logs').select('*, patients(name)').eq('campaign_id', campaign.id);
    if (!error && data) setSelectedCampaignLogs(data as any);
    setLoadingLogs(false);
  };

  /** Iniciar disparo — guard contra duplo clique */
  const handleStartCampaign = async (campaignId: string) => {
    if (actionInProgressRef.current.has(campaignId)) return;
    actionInProgressRef.current.add(campaignId);
    try {
      const { error } = await supabase.from('campaigns').update({ status: 'running', scheduled_at: null }).eq('id', campaignId);
      if (error) showToast('Erro ao iniciar disparo', 'error');
      else { showToast('Disparo iniciado — o servidor processa em segundo plano!'); fetchCampaigns(); }
    } finally {
      actionInProgressRef.current.delete(campaignId);
    }
  };

  const handlePauseCampaign = async (campaignId: string) => {
    const { error } = await supabase.from('campaigns').update({ status: 'paused' }).eq('id', campaignId);
    if (error) showToast('Erro ao pausar', 'error');
    else { showToast('Campanha pausada.'); fetchCampaigns(); }
  };

  const handleDeleteCampaign = async (campaignId: string) => {
    if (!window.confirm('Excluir esta campanha e todos os seus logs?')) return;
    const { error } = await supabase.from('campaigns').delete().eq('id', campaignId);
    if (error) showToast('Erro ao excluir', 'error');
    else { showToast('Campanha excluída.'); setSelectedCampaign(null); fetchCampaigns(); }
  };

  const filteredCampaigns = campaigns.filter(c => {
    if (activeTab === 'all') return true;
    if (activeTab === 'scheduled') return c.status === 'scheduled';
    if (activeTab === 'running') return c.status === 'running';
    if (activeTab === 'completed') return c.status === 'completed';
    return true;
  });

  // Stats
  const totalSent = campaigns.reduce((acc, c) => acc + c.sent_contacts, 0);
  const running = campaigns.filter(c => c.status === 'running').length;
  const scheduled = campaigns.filter(c => c.status === 'scheduled').length;

  // Min datetime for scheduling (now + 1 min)
  const minDateTime = new Date(Date.now() + 60000).toISOString().slice(0, 16);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Toast */}
      {toast && (
        <div className={cn(
          "fixed bottom-8 right-8 z-50 px-5 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border",
          toast.type === 'success' ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-rose-50 text-rose-800 border-rose-200"
        )}>
          {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" /> : <XCircle className="w-5 h-5 text-rose-500 shrink-0" />}
          <p className="text-sm font-bold">{toast.message}</p>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
              <Megaphone className="w-5 h-5 text-white" />
            </div>
            Mensagem em Massa
          </h2>
          <p className="text-slate-500 font-medium text-sm mt-1 ml-1">Dispare comunicados via WhatsApp para pacientes ativos, com agendamento e controle completo.</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-6 py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-2xl font-bold shadow-xl shadow-indigo-200 flex items-center gap-2 transition-all active:scale-95 shrink-0"
        >
          <Plus className="w-5 h-5" /> Nova Campanha
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total de Campanhas', value: campaigns.length, icon: Megaphone, color: 'from-indigo-500 to-violet-600', bg: 'bg-indigo-50', text: 'text-indigo-600' },
          { label: 'Em Execução', value: running, icon: Zap, color: 'from-emerald-500 to-teal-500', bg: 'bg-emerald-50', text: 'text-emerald-600' },
          { label: 'Agendadas', value: scheduled, icon: CalendarClock, color: 'from-violet-500 to-purple-600', bg: 'bg-violet-50', text: 'text-violet-600' },
          { label: 'Mensagens Enviadas', value: totalSent.toLocaleString('pt-BR'), icon: Send, color: 'from-sky-500 to-blue-600', bg: 'bg-sky-50', text: 'text-sky-600' },
        ].map(stat => (
          <div key={stat.label} className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-4 hover:shadow-md transition-shadow">
            <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center shrink-0", stat.bg)}>
              <stat.icon className={cn("w-5 h-5", stat.text)} />
            </div>
            <div>
              <p className="text-2xl font-black text-slate-900">{stat.value}</p>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Running Banner */}
      {running > 0 && (
        <div className="bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-200 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shrink-0">
            <Loader2 className="w-5 h-5 text-white animate-spin" />
          </div>
          <div>
            <p className="font-extrabold text-slate-800 text-sm">{running} campanha{running > 1 ? 's' : ''} em execução</p>
            <p className="text-xs text-slate-500 font-medium mt-0.5">O servidor processa os envios em segundo plano. Você pode fechar esta página com segurança.</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white p-1.5 rounded-2xl border border-slate-200 flex gap-1 w-full max-w-lg">
        {[
          { id: 'all',       label: 'Todas',     count: campaigns.length },
          { id: 'scheduled', label: 'Agendadas', count: scheduled },
          { id: 'running',   label: 'Em Envio',  count: running },
          { id: 'completed', label: 'Concluídas', count: campaigns.filter(c => c.status === 'completed').length },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "flex-1 py-2.5 text-[11px] font-bold rounded-xl transition-all flex items-center justify-center gap-1.5",
              activeTab === tab.id ? "bg-slate-900 text-white shadow-md" : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
            )}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={cn("px-1.5 py-0.5 rounded-full text-[9px] font-black", activeTab === tab.id ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500")}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Campaign List */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {loading ? (
          <div className="col-span-full py-24 flex justify-center"><Loader2 className="w-10 h-10 text-indigo-600 animate-spin" /></div>
        ) : filteredCampaigns.map(campaign => {
          const progress = campaign.total_contacts > 0 ? Math.round((campaign.sent_contacts / campaign.total_contacts) * 100) : 0;
          const cfg = STATUS_CONFIG[campaign.status] || STATUS_CONFIG.draft;

          return (
            <div
              key={campaign.id}
              className={cn(
                "bg-white rounded-3xl border transition-all p-6 flex flex-col justify-between hover:shadow-lg hover:-translate-y-0.5 duration-200",
                campaign.status === 'running' ? "border-indigo-300 ring-2 ring-indigo-500/10" : "border-slate-200"
              )}
            >
              <div>
                <div className="flex justify-between items-start mb-4">
                  <span className={cn("px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider", cfg.color)}>
                    {cfg.label}
                  </span>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-400 font-bold">{new Date(campaign.created_at).toLocaleDateString('pt-BR')}</p>
                    {campaign.scheduled_at && (
                      <p className="text-[10px] text-violet-500 font-bold flex items-center gap-1 justify-end mt-0.5">
                        <CalendarClock className="w-3 h-3" />
                        {new Date(campaign.scheduled_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                  </div>
                </div>

                <h3 className="font-extrabold text-slate-800 text-lg line-clamp-1">{campaign.name}</h3>
                <p className="text-slate-500 text-xs mt-2 line-clamp-3 leading-relaxed font-medium bg-slate-50 p-3 rounded-xl border border-slate-100">
                  {campaign.message}
                </p>

                {campaign.attachment_url && (
                  <div className="mt-3 flex items-center gap-2 text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-3 py-2 rounded-xl">
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span className="truncate">{campaign.attachment_url.split('/').pop()}</span>
                  </div>
                )}

                <div className="mt-5 space-y-1.5">
                  <div className="flex justify-between text-xs font-bold text-slate-600">
                    <span className="flex items-center gap-1"><BarChart2 className="w-3 h-3" /> Progresso</span>
                    <span>{campaign.sent_contacts} / {campaign.total_contacts} — {progress}%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className={cn("h-full transition-all duration-700 rounded-full", campaign.status === 'completed' ? "bg-emerald-500" : "bg-gradient-to-r from-indigo-500 to-violet-500")}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                <button onClick={() => handleOpenLogs(campaign)} className="px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-bold rounded-xl border border-slate-200/60 flex items-center gap-1.5 transition-all">
                  <Eye className="w-3.5 h-3.5" /> Relatório
                </button>

                <div className="flex gap-2">
                  {(campaign.status === 'draft' || campaign.status === 'paused' || campaign.status === 'scheduled') && (
                    <button
                      onClick={() => handleStartCampaign(campaign.id)}
                      className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5"
                    >
                      <Play className="w-3.5 h-3.5 fill-emerald-600" /> Disparar agora
                    </button>
                  )}

                  {campaign.status === 'running' && (
                    <button
                      onClick={() => handlePauseCampaign(campaign.id)}
                      className="px-3 py-2 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5"
                    >
                      <Pause className="w-3.5 h-3.5 fill-amber-600" /> Pausar
                    </button>
                  )}

                  <button
                    onClick={() => handleDeleteCampaign(campaign.id)}
                    className="p-2 bg-rose-50 hover:bg-rose-100 border border-rose-100 text-rose-600 rounded-xl transition-colors"
                    title="Excluir"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {!loading && filteredCampaigns.length === 0 && (
          <div className="col-span-full bg-white rounded-3xl border border-slate-200 p-20 text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Megaphone className="w-8 h-8 text-slate-300" />
            </div>
            <h4 className="font-extrabold text-slate-800 text-lg">Nenhuma campanha encontrada</h4>
            <p className="text-slate-400 font-medium text-sm mt-2">Clique em "Nova Campanha" para criar seu primeiro disparo.</p>
          </div>
        )}
      </div>

      {/* ── CREATE MODAL ── */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-[2.5rem] w-full max-w-5xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden max-h-[95vh] my-4">
            {/* Modal Header */}
            <div className="p-7 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white shrink-0">
              <div>
                <h3 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                  <Megaphone className="w-6 h-6 text-indigo-600" /> Nova Campanha
                </h3>
                <p className="text-xs font-medium text-slate-500 mt-1">Configure e salve o disparo. Envie agora ou agende para mais tarde.</p>
              </div>
              <button onClick={() => { setShowCreateModal(false); resetForm(); }} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleCreateCampaign} className="p-7 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* ── Left Column ── */}
                <div className="lg:col-span-7 space-y-6">
                  {/* Nome */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Nome da Campanha *</label>
                    <input
                      required value={name} onChange={e => setName(e.target.value)}
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700 transition-all"
                      placeholder="Ex: Campanha Novembro Azul, Retorno Inativo..."
                    />
                  </div>

                  {/* Público + Delay */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Filtrar por Gênero</label>
                      <select
                        value={targetGender} onChange={e => setTargetGender(e.target.value)}
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700"
                      >
                        <option value="all">Todos os ativos ({patientsList.length})</option>
                        <option value="masculino">Masculino</option>
                        <option value="feminino">Feminino</option>
                      </select>
                      <p className="text-[10px] text-indigo-500 font-bold ml-1 flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" /> {estimatedCount} paciente{estimatedCount !== 1 ? 's' : ''} receberá{estimatedCount !== 1 ? 'o' : ''} esta campanha
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Delay entre Envios (seg)</label>
                      <input
                        type="number" min={5} max={120} required value={delaySeconds}
                        onChange={e => setDelaySeconds(Number(e.target.value))}
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700"
                      />
                      <p className="text-[10px] text-slate-400 font-medium ml-1">Mín. 15s recomendado para evitar bloqueio.</p>
                    </div>
                  </div>

                  {/* Mensagem */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Mensagem *</label>
                    <textarea
                      required rows={5} value={message} onChange={e => setMessage(e.target.value)}
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-slate-700 resize-none"
                      placeholder="Escreva sua mensagem. Use *negrito*, _itálico_, ~tachado~."
                    />
                    <p className="text-[10px] text-slate-400 ml-1">{message.length} caracteres</p>
                  </div>

                  {/* Anexo */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Anexo de Mídia (opcional)</label>
                    {!attachmentName ? (
                      <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center bg-slate-50 hover:bg-slate-100/50 transition-colors relative cursor-pointer">
                        <input type="file" accept="image/*,application/pdf" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                        <Upload className="w-8 h-8 text-slate-300 mb-2" />
                        <p className="text-xs font-bold text-slate-500">Arraste ou clique para selecionar</p>
                        <p className="text-[10px] text-slate-400 mt-1">Imagens ou PDFs até 10MB</p>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3">
                        <div className="flex items-center gap-2">
                          {attachmentType.startsWith('image/') ? <ImageIcon className="w-4 h-4 text-indigo-600" /> : <FileText className="w-4 h-4 text-indigo-600" />}
                          <span className="text-xs font-bold text-indigo-700 truncate max-w-[200px]">{attachmentName}</span>
                        </div>
                        <button type="button" onClick={() => { setAttachment(null); setAttachmentBase64(null); setAttachmentName(''); }} className="text-indigo-600 hover:text-indigo-900 font-extrabold text-xs">Remover</button>
                      </div>
                    )}
                  </div>

                  {/* Agendamento */}
                  <div className="space-y-3 bg-violet-50 border border-violet-100 rounded-2xl p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CalendarClock className="w-4 h-4 text-violet-600" />
                        <span className="text-sm font-extrabold text-slate-700">Agendar Disparo</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setUseSchedule(!useSchedule)}
                        className={cn(
                          "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                          useSchedule ? "bg-violet-600" : "bg-slate-200"
                        )}
                      >
                        <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform", useSchedule ? "translate-x-6" : "translate-x-1")} />
                      </button>
                    </div>

                    {useSchedule && (
                      <div className="space-y-2 pt-1 animate-in slide-in-from-top-2 duration-200">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Data e Hora do Disparo</label>
                        <input
                          type="datetime-local"
                          min={minDateTime}
                          value={scheduledAt}
                          onChange={e => setScheduledAt(e.target.value)}
                          required={useSchedule}
                          className="w-full p-4 bg-white border border-violet-200 rounded-2xl focus:ring-2 focus:ring-violet-500 outline-none font-bold text-slate-700"
                        />
                        <p className="text-[10px] text-violet-600 font-medium ml-1 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> O servidor iniciará o disparo automaticamente neste horário.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Buttons */}
                  <div className="pt-4 border-t border-slate-100 flex gap-4">
                    <button type="button" onClick={() => { setShowCreateModal(false); resetForm(); }} className="flex-1 py-4 bg-slate-50 text-slate-600 rounded-2xl font-bold hover:bg-slate-100 transition-all border border-slate-200">
                      Cancelar
                    </button>
                    <button
                      type="submit" disabled={saving}
                      className="flex-1 py-4 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl font-bold shadow-xl shadow-indigo-100 hover:from-indigo-700 hover:to-violet-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : useSchedule ? <CalendarClock className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
                      {useSchedule ? 'Agendar Campanha' : 'Salvar como Rascunho'}
                    </button>
                  </div>
                </div>

                {/* ── Right Column — Preview ── */}
                <div className="lg:col-span-5 flex flex-col gap-3 lg:sticky lg:top-0 h-fit">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Pré-visualização WhatsApp</label>

                  <div className="border border-slate-200 rounded-[2rem] shadow-lg overflow-hidden bg-[#efeae2] flex flex-col h-[480px] relative font-sans">
                    {/* WA Header */}
                    <div className="bg-[#008069] text-white px-4 py-3 flex items-center justify-between shrink-0">
                      <div className="flex items-center gap-2">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" className="text-white/80"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"></path></svg>
                        <div className="w-9 h-9 rounded-full bg-teal-100 flex items-center justify-center text-teal-800 font-extrabold text-xs border border-white/20 shadow-sm select-none">TZ</div>
                        <div>
                          <h4 className="font-bold text-xs leading-tight text-white select-none">Tzion Terapias</h4>
                          <span className="text-[9px] text-teal-100/90 select-none">online</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-white/95">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"></path></svg>
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.57a.98.98 0 0 0-1.01.24l-2.2 2.2a15.045 15.045 0 0 1-6.59-6.59l2.2-2.2c.28-.28.36-.67.25-1.02A11.36 11.36 0 0 1 8.5 4c0-.56-.45-1-1-1H4c-.56 0-1 .45-1 1 0 9.39 7.61 17 17 17 .56 0 1-.45 1-1v-3.59c0-.57-.45-1.03-1.01-1.03z"></path></svg>
                      </div>
                    </div>

                    {/* Chat */}
                    <div className="flex-1 p-4 overflow-y-auto flex flex-col justify-end" style={{ backgroundColor: '#efeae2', backgroundImage: `url("data:image/svg+xml,%3Csvg width='400' height='400' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23c8b89a' fill-opacity='0.15'%3E%3Cpath d='M0 0h400v400H0V0zm30 30h340v340H30V30z'/%3E%3C/g%3E%3C/svg%3E")` }}>
                      <div className="self-center bg-white/90 text-[9px] font-bold text-slate-500 px-2.5 py-0.5 rounded-lg shadow-xs mb-3 uppercase tracking-wider select-none border border-slate-100">Hoje</div>
                      <div className="self-end max-w-[88%] bg-[#d9fdd3] text-[#111b21] rounded-2xl rounded-tr-none px-3 py-2 shadow-sm flex flex-col gap-1">
                        {attachmentBase64 && (
                          <div className="rounded-xl overflow-hidden mb-1 border border-black/5 max-h-[160px] flex items-center justify-center bg-black/5">
                            {attachmentType.startsWith('image/') ? (
                              <img src={attachmentBase64} alt="Anexo" className="object-cover w-full h-full max-h-[160px]" />
                            ) : (
                              <div className="flex items-center gap-3 p-3 bg-white w-full">
                                <div className="p-2 bg-rose-100 rounded-lg text-rose-600 shrink-0"><FileText className="w-6 h-6" /></div>
                                <div><p className="text-xs font-bold text-slate-800 truncate">{attachmentName}</p></div>
                              </div>
                            )}
                          </div>
                        )}
                        <div
                          className="text-[12.5px] font-medium leading-relaxed break-words whitespace-pre-wrap select-text pr-2"
                          dangerouslySetInnerHTML={{ __html: formatWhatsAppMessage(message || 'Escreva sua mensagem no campo ao lado para visualizar a prévia aqui...') }}
                        />
                        <div className="flex items-center justify-end gap-0.5 self-end mt-0.5 select-none">
                          <span className="text-[9px] text-slate-500 font-bold">{new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                          <svg viewBox="0 0 24 24" width="13" height="13" fill="#53bdeb"><path d="M12.45 16.2L11 14.75l1.45-1.45L11 11.85l1.45-1.45 2.9 2.9-2.9 2.9zm4.7 0L15.7 14.75l1.45-1.45-1.45-1.45 1.45-1.45 2.9 2.9-2.9 2.9zM7.5 12.3L4.7 9.5l1.4-1.4 2.8 2.8-1.4 1.4zm3 3L7.7 12.5l1.4-1.4 2.8 2.8-1.4 1.4z" /></svg>
                        </div>
                      </div>
                    </div>

                    {/* WA Input Bar */}
                    <div className="bg-[#f0f2f5] p-1.5 flex items-center gap-2 border-t border-slate-200/60 shrink-0 select-none">
                      <div className="flex-1 bg-white rounded-full px-3.5 py-2 flex items-center justify-between border border-slate-200/50">
                        <span className="text-slate-400 text-[11px] font-medium">Mensagem</span>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-[#008069] flex items-center justify-center text-white shrink-0">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.42 2.72 6.2 6 6.72V21h2v-3.28c3.28-.52 6-3.3 6-6.72h-1.7z"></path></svg>
                      </div>
                    </div>
                  </div>

                  {/* Info Box */}
                  <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-xs text-amber-700 font-medium space-y-1.5">
                    <p className="font-extrabold flex items-center gap-1.5"><AlertCircle className="w-4 h-4" /> Boas práticas</p>
                    <ul className="list-disc ml-5 space-y-1 text-[11px]">
                      <li>Use delay de <strong>15s ou mais</strong> para evitar banimento.</li>
                      <li>Evite disparar mais de <strong>200 mensagens/dia</strong> por instância.</li>
                      <li>Prefira <strong>horários comerciais</strong> para maior abertura.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── LOGS MODAL ── */}
      {selectedCampaign && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-4xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
            <div className="p-7 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                  <BarChart2 className="w-5 h-5 text-indigo-600" /> {selectedCampaign.name}
                </h3>
                <p className="text-xs font-medium text-slate-500 mt-1">Relatório detalhado de envio por paciente.</p>
              </div>
              <button onClick={() => setSelectedCampaign(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"><X className="w-6 h-6" /></button>
            </div>

            <div className="p-7 overflow-y-auto space-y-6 flex-1">
              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl text-center">
                  <p className="text-xs text-indigo-600 font-bold uppercase tracking-wider">Total</p>
                  <p className="text-3xl font-black text-indigo-950 mt-1">{selectedCampaign.total_contacts}</p>
                </div>
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-center">
                  <p className="text-xs text-emerald-600 font-bold uppercase tracking-wider">Enviados</p>
                  <p className="text-3xl font-black text-emerald-950 mt-1">{selectedCampaign.sent_contacts}</p>
                </div>
                <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-center">
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Status</p>
                  <p className={cn("text-base font-black mt-2 px-3 py-1 rounded-full inline-block", STATUS_CONFIG[selectedCampaign.status]?.color)}>
                    {STATUS_CONFIG[selectedCampaign.status]?.label}
                  </p>
                </div>
              </div>

              {/* Logs table */}
              <div>
                <h4 className="font-extrabold text-slate-800 text-sm mb-3">Lista de Envio</h4>
                {loadingLogs ? (
                  <div className="py-10 flex justify-center"><Loader2 className="w-8 h-8 text-indigo-600 animate-spin" /></div>
                ) : (
                  <div className="space-y-3">
                    <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-[300px] overflow-y-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-widest sticky top-0">
                            <th className="px-5 py-3.5">Paciente</th>
                            <th className="px-5 py-3.5">Telefone</th>
                            <th className="px-5 py-3.5">Enviado em</th>
                            <th className="px-5 py-3.5">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                          {paginatedLogs.map(log => (
                            <tr key={log.id} className="hover:bg-slate-50/60">
                              <td className="px-5 py-3">{log.patients?.name || '—'}</td>
                              <td className="px-5 py-3">{log.patient_phone}</td>
                              <td className="px-5 py-3">{log.sent_at ? new Date(log.sent_at).toLocaleString('pt-BR') : '—'}</td>
                              <td className="px-5 py-3">
                                <span className={cn("px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider",
                                  log.status === 'sent'    && "bg-emerald-50 text-emerald-600",
                                  log.status === 'failed'  && "bg-rose-50 text-rose-600",
                                  log.status === 'pending' && "bg-slate-100 text-slate-500 animate-pulse"
                                )}>
                                  {log.status === 'sent' ? 'Enviado' : log.status === 'failed' ? 'Falhou' : 'Pendente'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {totalLogsPages > 1 && (
                      <div className="flex items-center justify-between bg-slate-50 border border-slate-200 p-3 rounded-2xl">
                        <button onClick={() => setLogsPage(p => Math.max(p - 1, 1))} disabled={logsPage === 1} className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 flex items-center gap-1">
                          <ChevronLeft className="w-3.5 h-3.5" /> Anterior
                        </button>
                        <span className="text-xs font-bold text-slate-400">Pág. {logsPage} / {totalLogsPages}</span>
                        <button onClick={() => setLogsPage(p => Math.min(p + 1, totalLogsPages))} disabled={logsPage === totalLogsPages} className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 flex items-center gap-1">
                          Próxima <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="p-5 border-t border-slate-100 flex justify-end bg-slate-50/50">
              <button onClick={() => setSelectedCampaign(null)} className="px-6 py-3 bg-white hover:bg-slate-50 text-slate-600 rounded-xl font-bold border border-slate-200">Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
