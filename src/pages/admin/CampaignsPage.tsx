import React, { useState, useEffect } from 'react';
import { 
  Megaphone, Plus, Search, MessageSquare, Play, Pause, RefreshCw, 
  Send, Users, Calendar, AlertCircle, FileText, Image as ImageIcon, 
  Loader2, CheckCircle2, XCircle, Clock, Trash2, Upload, HelpCircle, Eye
} from 'lucide-react';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/contexts/AuthContext';
import { cn } from '@/src/lib/utils';
import { sendWhatsAppMessage } from '@/src/lib/whatsapp';

interface Campaign {
  id: string;
  name: string;
  message: string;
  delay_seconds: number;
  target_gender: string;
  attachment_url: string;
  status: 'draft' | 'running' | 'completed' | 'paused' | 'failed';
  created_at: string;
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
  patients?: {
    name: string;
  };
}

function formatWhatsAppMessage(text: string) {
  if (!text) return "";
  
  // Escapar HTML para evitar XSS e injeção de tags indesejadas
  let escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  
  // Negrito: *texto*
  escaped = escaped.replace(/\*([^\*]+)\*/g, "<strong>$1</strong>");
  
  // Itálico: _texto_
  escaped = escaped.replace(/_([^_]+)_/g, "<em>$1</em>");
  
  // Tachado: ~texto~
  escaped = escaped.replace(/~([^~]+)~/g, "<del>$1</del>");
  
  // Quebras de linha: \n
  escaped = escaped.replace(/\n/g, "<br />");
  
  return escaped;
}

export default function CampaignsPage() {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'running' | 'completed'>('all');
  
  // Form States
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [delaySeconds, setDelaySeconds] = useState(10);
  const [targetGender, setTargetGender] = useState('all');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [attachmentBase64, setAttachmentBase64] = useState<string | null>(null);
  const [attachmentName, setAttachmentName] = useState('');
  const [attachmentType, setAttachmentType] = useState('');

  // Target estimation
  const [estimatedCount, setEstimatedCount] = useState(0);
  const [patientsList, setPatientsList] = useState<any[]>([]);

  // Detailed Modal View
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [selectedCampaignLogs, setSelectedCampaignLogs] = useState<CampaignLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Local Dispatch Loop state
  const [localRunningCampaignId, setLocalRunningCampaignId] = useState<string | null>(null);
  const [dispatchProgress, setDispatchProgress] = useState('');

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    fetchCampaigns();
    fetchPatients();
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Target estimation on filters change
  useEffect(() => {
    if (patientsList.length > 0) {
      const filtered = patientsList.filter(p => {
        if (targetGender === 'all') return true;
        return p.gender === targetGender;
      });
      setEstimatedCount(filtered.length);
    }
  }, [targetGender, patientsList]);

  // Poll progress in background when a campaign is running
  useEffect(() => {
    const isRunning = campaigns.some(c => c.status === 'running');
    if (!isRunning) return;

    const interval = setInterval(() => {
      fetchCampaigns();
    }, 5000);

    return () => clearInterval(interval);
  }, [campaigns]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
  };

  const fetchPatients = async () => {
    const { data } = await supabase
      .from('patients')
      .select('id, name, gender, phone')
      .eq('status', 'Ativo');
    if (data) setPatientsList(data);
  };

  const fetchCampaigns = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('campaigns')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error(error);
      showToast('Erro ao carregar campanhas', 'error');
    } else if (data) {
      setCampaigns(data);
    }
    setLoading(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        showToast('O arquivo não pode exceder 10MB', 'error');
        return;
      }
      setAttachment(file);
      setAttachmentName(file.name);
      setAttachmentType(file.type);

      const reader = new FileReader();
      reader.onloadend = () => {
        setAttachmentBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !message.trim()) {
      showToast('Preencha os campos obrigatórios', 'error');
      return;
    }

    setSaving(true);
    try {
      // 1. Filtrar pacientes alvo
      const targets = patientsList.filter(p => {
        if (targetGender === 'all') return true;
        return p.gender === targetGender;
      });

      if (targets.length === 0) {
        showToast('Nenhum paciente ativo atende aos filtros desta campanha', 'error');
        setSaving(false);
        return;
      }

      // 2. Upload anexo se houver
      let attachmentUrl = '';
      if (attachment && attachmentBase64) {
        const fileExt = attachmentName.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `attachments/${fileName}`;

        // Converter base64 para arraybuffer
        const base64Data = attachmentBase64.split(',')[1];
        const binaryString = window.atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        const { error: uploadError } = await supabase.storage
          .from('campaign_attachments')
          .upload(filePath, bytes.buffer, {
            contentType: attachmentType,
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          console.error("Erro ao subir arquivo:", uploadError);
          showToast('Erro ao enviar anexo, mas a campanha continuará', 'error');
        } else {
          const { data: publicUrlData } = supabase.storage
            .from('campaign_attachments')
            .getPublicUrl(filePath);
          attachmentUrl = publicUrlData?.publicUrl || '';
        }
      }

      // 3. Salvar campanha no banco
      const { data: campaignData, error: campaignError } = await supabase
        .from('campaigns')
        .insert([{
          name,
          message,
          delay_seconds: delaySeconds,
          target_gender: targetGender,
          attachment_url: attachmentUrl,
          status: 'draft',
          total_contacts: targets.length,
          sent_contacts: 0,
          created_by: user?.id
        }])
        .select()
        .single();

      if (campaignError) throw campaignError;

      // 4. Salvar logs para cada paciente (Fila de Disparo)
      const logsPayload = targets.map(p => ({
        campaign_id: campaignData.id,
        patient_id: p.id,
        patient_phone: p.phone,
        status: 'pending'
      }));

      const { error: logsError } = await supabase
        .from('campaign_logs')
        .insert(logsPayload);

      if (logsError) throw logsError;

      showToast('Campanha criada com sucesso como rascunho!');
      setShowCreateModal(false);
      resetForm();
      fetchCampaigns();
    } catch (err: any) {
      console.error(err);
      showToast(`Erro ao criar campanha: ${err.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setName('');
    setMessage('');
    setDelaySeconds(10);
    setTargetGender('all');
    setAttachment(null);
    setAttachmentBase64(null);
    setAttachmentName('');
    setAttachmentType('');
  };

  const handleOpenLogs = async (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setLoadingLogs(true);
    
    const { data, error } = await supabase
      .from('campaign_logs')
      .select('*, patients(name)')
      .eq('campaign_id', campaign.id);

    if (error) {
      console.error(error);
      showToast('Erro ao carregar detalhes do disparo', 'error');
    } else if (data) {
      setSelectedCampaignLogs(data as any);
    }
    setLoadingLogs(false);
  };

  // Iniciar disparo de campanha no servidor
  const handleStartCampaignLocal = async (campaignId: string) => {
    const { error } = await supabase.from('campaigns').update({ status: 'running' }).eq('id', campaignId);
    if (error) {
      showToast('Erro ao iniciar disparo', 'error');
    } else {
      showToast('Disparo iniciado em segundo plano pelo servidor!');
      fetchCampaigns();
    }
  };

  const handlePauseCampaign = async (campaignId: string) => {
    const { error } = await supabase
      .from('campaigns')
      .update({ status: 'paused' })
      .eq('id', campaignId);

    if (error) {
      showToast('Erro ao pausar campanha', 'error');
    } else {
      showToast('Campanha pausada com sucesso no servidor.');
      fetchCampaigns();
    }
  };

  const handleDeleteCampaign = async (campaignId: string) => {
    if (!window.confirm('Tem certeza que deseja excluir esta campanha e todos os seus logs de envio?')) return;

    const { error } = await supabase
      .from('campaigns')
      .delete()
      .eq('id', campaignId);

    if (error) {
      showToast('Erro ao excluir campanha', 'error');
    } else {
      showToast('Campanha excluída com sucesso.');
      setSelectedCampaign(null);
      fetchCampaigns();
    }
  };

  const filteredCampaigns = campaigns.filter(c => {
    if (activeTab === 'all') return true;
    return c.status === activeTab;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Toast Alert */}
      {toast && (
        <div className={cn(
          "fixed bottom-8 right-8 z-50 p-4 rounded-2xl shadow-2xl flex items-center gap-3 border animate-bounce",
          toast.type === 'success' ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-rose-50 text-rose-800 border-rose-200"
        )}>
          {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <XCircle className="w-5 h-5 text-rose-500" />}
          <p className="text-sm font-bold">{toast.message}</p>
        </div>
      )}

      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Megaphone className="w-8 h-8 text-indigo-600 animate-pulse" /> Campanhas e Disparos
          </h2>
          <p className="text-slate-500 font-medium text-sm mt-1">Dispare comunicados em massa via WhatsApp para seus pacientes ativos.</p>
        </div>
        <button 
          onClick={() => setShowCreateModal(true)} 
          className="px-6 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold shadow-xl shadow-indigo-100 flex items-center gap-2 transition-all active:scale-95 shrink-0"
        >
          <Plus className="w-5 h-5" /> Nova Campanha
        </button>
      </div>

      {/* Server Campaign Progress Banner */}
      {campaigns.some(c => c.status === 'running') && (
        <div className="bg-emerald-50 border border-emerald-100 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-pulse">
          <div className="flex items-center gap-4">
            <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
            <div>
              <p className="font-extrabold text-slate-800 text-sm font-sans">Disparo em Execução (Servidor)</p>
              <p className="text-xs text-slate-500 font-medium mt-0.5 font-sans">
                O servidor está enviando as mensagens em segundo plano. Você pode fechar esta página com segurança.
              </p>
            </div>
          </div>
          <div className="text-xs font-bold text-emerald-600 bg-emerald-100/60 px-4 py-2 rounded-xl border border-emerald-200/50 font-sans">
            Processamento em Segundo Plano Ativo.
          </div>
        </div>
      )}

      {/* Tabs Menu */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200 flex gap-1 w-full max-w-md">
        {[
          { id: 'all', label: 'Todas' },
          { id: 'running', label: 'Em Envio' },
          { id: 'completed', label: 'Concluídas' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "flex-1 py-3 text-xs font-bold rounded-xl transition-all",
              activeTab === tab.id 
                ? "bg-slate-900 text-white shadow-md" 
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Campaign List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-20 flex justify-center"><Loader2 className="w-10 h-10 text-indigo-600 animate-spin" /></div>
        ) : filteredCampaigns.map(campaign => {
          const progress = campaign.total_contacts > 0 
            ? Math.round((campaign.sent_contacts / campaign.total_contacts) * 100) 
            : 0;

          return (
            <div 
              key={campaign.id} 
              className={cn(
                "bg-white rounded-[2rem] border transition-all p-6 flex flex-col justify-between hover:shadow-lg",
                campaign.status === 'running' ? "border-indigo-500 ring-2 ring-indigo-500/10" : "border-slate-200"
              )}
            >
              <div>
                <div className="flex justify-between items-start mb-4">
                  <span className={cn(
                    "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider",
                    campaign.status === 'completed' && "bg-emerald-50 text-emerald-600",
                    campaign.status === 'running' && "bg-indigo-50 text-indigo-600 animate-pulse",
                    campaign.status === 'paused' && "bg-amber-50 text-amber-600",
                    campaign.status === 'draft' && "bg-slate-100 text-slate-600"
                  )}>
                    {campaign.status === 'completed' ? 'Concluído' : 
                     campaign.status === 'running' ? 'Processando' : 
                     campaign.status === 'paused' ? 'Pausado' : 'Rascunho'}
                  </span>
                  <p className="text-[10px] text-slate-400 font-bold">{new Date(campaign.created_at).toLocaleDateString('pt-BR')}</p>
                </div>

                <h3 className="font-extrabold text-slate-800 text-lg line-clamp-1">{campaign.name}</h3>
                <p className="text-slate-500 text-xs mt-2 line-clamp-3 leading-relaxed font-medium bg-slate-50 p-3 rounded-xl border border-slate-100">
                  {campaign.message}
                </p>

                {campaign.attachment_url && (
                  <div className="mt-3 flex items-center gap-2 text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-100 px-3 py-2 rounded-xl">
                    <FileText className="w-3.5 h-3.5 text-indigo-500" />
                    <span className="truncate">{campaign.attachment_url.split('/').pop()}</span>
                  </div>
                )}

                {/* Progress bar */}
                <div className="mt-5 space-y-2">
                  <div className="flex justify-between text-xs font-bold text-slate-600">
                    <span>Progresso</span>
                    <span>{campaign.sent_contacts} / {campaign.total_contacts} ({progress}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                    <div 
                      className={cn(
                        "h-full transition-all duration-500",
                        campaign.status === 'completed' ? "bg-emerald-500" : "bg-indigo-600"
                      )} 
                      style={{ width: `${progress}%` }} 
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                <button 
                  onClick={() => handleOpenLogs(campaign)}
                  className="px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-800 text-xs font-bold rounded-xl transition-all border border-slate-200/50 flex items-center gap-1.5"
                >
                  <Eye className="w-3.5 h-3.5" /> Detalhes
                </button>

                <div className="flex gap-2">
                  {campaign.status === 'draft' || campaign.status === 'paused' ? (
                    <>
                      <button 
                        onClick={() => handleStartCampaignLocal(campaign.id)}
                        className="p-2.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-600 rounded-xl transition-colors"
                        title="Disparar via Navegador"
                      >
                        <Play className="w-4 h-4 fill-emerald-600" />
                      </button>
                      
                      {/* N8N Integration Indicator */}
                      <button 
                        onClick={async () => {
                          await supabase.from('campaigns').update({ status: 'running' }).eq('id', campaign.id);
                          showToast('Disparo iniciado. Aguardando processamento da fila de logs...');
                          fetchCampaigns();
                        }}
                        className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 text-indigo-600 rounded-xl text-xs font-extrabold transition-colors flex items-center gap-1"
                        title="Habilita para processar no fluxo do N8N"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> N8N
                      </button>
                    </>
                  ) : campaign.status === 'running' ? (
                    <button 
                      onClick={() => handlePauseCampaign(campaign.id)}
                      className="p-2.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-600 rounded-xl transition-colors"
                      title="Pausar Envio"
                    >
                      <Pause className="w-4 h-4 fill-amber-600" />
                    </button>
                  ) : null}

                  <button 
                    onClick={() => handleDeleteCampaign(campaign.id)}
                    className="p-2.5 bg-rose-50 hover:bg-rose-100 border border-rose-100 text-rose-600 rounded-xl transition-colors"
                    title="Excluir Campanha"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {!loading && filteredCampaigns.length === 0 && (
          <div className="col-span-full bg-white rounded-[2.5rem] border border-slate-200 p-20 text-center max-w-lg mx-auto w-full">
            <Megaphone className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h4 className="font-extrabold text-slate-800 text-lg">Nenhuma Campanha Encontrada</h4>
            <p className="text-slate-500 font-medium text-xs mt-2">Clique em "Nova Campanha" para criar seu primeiro lote de disparos.</p>
          </div>
        )}
      </div>

      {/* CREATE CAMPAIGN MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-5xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                  <Megaphone className="w-6 h-6 text-indigo-600" /> Criar Nova Campanha
                </h3>
                <p className="text-xs font-medium text-slate-500 mt-1">Configure o lote de mensagens que será colocado na fila de envio.</p>
              </div>
              <button 
                onClick={() => {
                  setShowCreateModal(false);
                  resetForm();
                }} 
                className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleCreateCampaign} className="p-8 overflow-y-auto">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Form Inputs (Left Column) */}
                <div className="lg:col-span-7 space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Nome da Campanha *</label>
                    <input 
                      required 
                      value={name} 
                      onChange={e => setName(e.target.value)} 
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700" 
                      placeholder="Ex: Campanha de Satisfação Junina, Novembro Azul..." 
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Filtro de Público (Gênero)</label>
                      <select 
                        value={targetGender} 
                        onChange={e => setTargetGender(e.target.value)} 
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700"
                      >
                        <option value="all">Todos os pacientes ativos</option>
                        <option value="masculino">Masculino</option>
                        <option value="feminino">Feminino</option>
                      </select>
                      <p className="text-[10px] text-indigo-500 font-bold ml-1 flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" /> Público estimado: {estimatedCount} pacientes.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Delay entre Envios (Segundos)</label>
                      <input 
                        type="number" 
                        min={5} 
                        max={120} 
                        required 
                        value={delaySeconds} 
                        onChange={e => setDelaySeconds(Number(e.target.value))} 
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700" 
                      />
                      <p className="text-[10px] text-slate-400 font-medium ml-1">Recomendado: 10 segundos ou mais para evitar bloqueios.</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Mensagem da Campanha *</label>
                    <textarea 
                      required 
                      rows={4}
                      value={message} 
                      onChange={e => setMessage(e.target.value)} 
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-slate-700" 
                      placeholder="Escreva sua mensagem. Dica: Use formatação do WhatsApp como *negrito*, _itálico_." 
                    />
                  </div>

                  {/* File Attachment */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Anexo de Mídia (Imagem ou PDF)</label>
                    <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 flex flex-col items-center justify-center bg-slate-50 hover:bg-slate-100/50 transition-colors relative">
                      <input 
                        type="file" 
                        accept="image/*,application/pdf" 
                        onChange={handleFileChange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                      />
                      <Upload className="w-8 h-8 text-slate-400 mb-2" />
                      <p className="text-xs font-bold text-slate-600">Arraste ou clique para selecionar</p>
                      <p className="text-[10px] text-slate-400 mt-1">Imagens (.png, .jpg, .jpeg) ou PDFs até 10MB</p>
                    </div>
                    {attachmentName && (
                      <div className="flex items-center justify-between bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2 text-xs text-indigo-700">
                        <span className="truncate font-bold">{attachmentName}</span>
                        <button 
                          type="button" 
                          onClick={() => {
                            setAttachment(null);
                            setAttachmentBase64(null);
                            setAttachmentName('');
                          }} 
                          className="text-indigo-600 hover:text-indigo-900 font-extrabold"
                        >
                          Remover
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Actions buttons under inputs */}
                  <div className="pt-6 border-t border-slate-100 flex gap-4">
                    <button 
                      type="button" 
                      onClick={() => {
                        setShowCreateModal(false);
                        resetForm();
                      }}
                      className="flex-1 py-4 bg-slate-50 text-slate-600 rounded-2xl font-bold hover:bg-slate-100 transition-all border border-slate-200"
                    >
                      Cancelar
                    </button>
                    <button 
                      type="submit" 
                      disabled={saving}
                      className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                      Salvar Campanha
                    </button>
                  </div>
                </div>

                {/* WhatsApp Chat Preview (Right Column) */}
                <div className="lg:col-span-5 flex flex-col gap-2 lg:sticky lg:top-0 h-fit">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                    Pré-visualização da Mensagem
                  </label>
                  
                  {/* WhatsApp Mobile Mockup */}
                  <div className="border border-slate-200 rounded-[2rem] shadow-lg overflow-hidden bg-[#efeae2] flex flex-col h-[480px] relative font-sans">
                    {/* WhatsApp Header */}
                    <div className="bg-[#008069] text-white px-4 py-3 flex items-center justify-between shrink-0">
                      <div className="flex items-center gap-2">
                        {/* Back Arrow */}
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" className="text-white/80">
                          <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"></path>
                        </svg>
                        {/* Avatar */}
                        <div className="w-9 h-9 rounded-full bg-teal-100 flex items-center justify-center text-teal-800 font-extrabold text-xs border border-white/20 select-none shadow-sm">
                          TZ
                        </div>
                        <div>
                          <h4 className="font-bold text-xs leading-tight text-white select-none">Tzion Terapias</h4>
                          <span className="text-[9px] text-teal-100/90 select-none">online</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 text-white/95">
                        {/* Video Call */}
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                          <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"></path>
                        </svg>
                        {/* Phone Call */}
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                          <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.57a.98.98 0 0 0-1.01.24l-2.2 2.2a15.045 15.045 0 0 1-6.59-6.59l2.2-2.2c.28-.28.36-.67.25-1.02A11.36 11.36 0 0 1 8.5 4c0-.56-.45-1-1-1H4c-.56 0-1 .45-1 1 0 9.39 7.61 17 17 17 .56 0 1-.45 1-1v-3.59c0-.57-.45-1.03-1.01-1.03z"></path>
                        </svg>
                        {/* More options */}
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                          <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"></path>
                        </svg>
                      </div>
                    </div>

                    {/* Chat Area with Classic WhatsApp Pattern Background */}
                    <div 
                      className="flex-1 p-4 overflow-y-auto flex flex-col justify-end relative"
                      style={{
                        backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")',
                        backgroundSize: 'contain',
                        backgroundBlendMode: 'overlay',
                        backgroundColor: '#efeae2'
                      }}
                    >
                      {/* Date Bubble */}
                      <div className="self-center bg-white/90 backdrop-blur-xs text-[9px] font-bold text-slate-500 px-2.5 py-0.5 rounded-lg shadow-xs mb-3 uppercase tracking-wider select-none border border-slate-100">
                        Hoje
                      </div>

                      {/* Right Message Bubble */}
                      <div className="self-end max-w-[85%] bg-[#d9fdd3] text-[#111b21] rounded-2xl rounded-tr-none px-3 py-2 shadow-sm flex flex-col gap-1 relative border border-[#b2e7a6]/20">
                        
                        {/* Media Attachment Preview inside chat bubble */}
                        {attachmentBase64 && (
                          <div className="rounded-xl overflow-hidden mb-1 border border-black/5 bg-black/5 max-h-[160px] flex items-center justify-center">
                            {attachmentType.startsWith('image/') ? (
                              <img 
                                src={attachmentBase64} 
                                alt="Anexo" 
                                className="object-cover w-full h-full max-h-[160px]"
                              />
                            ) : (
                              <div className="flex items-center gap-3 p-3 bg-white w-full">
                                <div className="p-2 bg-rose-100 rounded-lg text-rose-600 shrink-0">
                                  <FileText className="w-6 h-6" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-bold text-slate-800 truncate">{attachmentName}</p>
                                  <p className="text-[9px] text-slate-500 font-bold uppercase">{attachmentType.split('/')[1] || 'PDF'}</p>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* WhatsApp Message Body */}
                        <div 
                          className="text-[12.5px] font-medium leading-relaxed break-words whitespace-pre-wrap select-text pr-2"
                          dangerouslySetInnerHTML={{ __html: formatWhatsAppMessage(message || 'Escreva sua mensagem no campo ao lado para visualizar a prévia aqui...') }}
                        />

                        {/* Timestamp & Delivered Double Check */}
                        <div className="flex items-center justify-end gap-0.5 self-end mt-0.5 select-none">
                          <span className="text-[9px] text-slate-500 font-bold">
                            {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <svg viewBox="0 0 24 24" width="13" height="13" fill="#53bdeb">
                            <path d="M12.45 16.2L11 14.75l1.45-1.45L11 11.85l1.45-1.45 2.9 2.9-2.9 2.9zm4.7 0L15.7 14.75l1.45-1.45-1.45-1.45 1.45-1.45 2.9 2.9-2.9 2.9zM7.5 12.3L4.7 9.5l1.4-1.4 2.8 2.8-1.4 1.4zm3 3L7.7 12.5l1.4-1.4 2.8 2.8-1.4 1.4z" />
                          </svg>
                        </div>
                      </div>
                    </div>

                    {/* WhatsApp Fake Chat Input Bar */}
                    <div className="bg-[#f0f2f5] p-1.5 flex items-center gap-2 border-t border-slate-200/60 shrink-0 select-none">
                      <div className="flex-1 bg-white rounded-full px-3.5 py-1.5 flex items-center justify-between border border-slate-200/50">
                        <span className="text-slate-400 text-[11px] font-medium">Mensagem</span>
                        <div className="flex items-center gap-2 text-slate-400">
                          {/* Paperclip */}
                          <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
                            <path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5a2.5 2.5 0 0 1 5 0v10.5c0 .83-.67 1.5-1.5 1.5s-1.5-.67-1.5-1.5V6H9v9.5a3 3 0 0 0 6 0V5a4 4 0 0 0-8 0v11.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"></path>
                          </svg>
                        </div>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-[#008069] flex items-center justify-center text-white shrink-0 shadow-xs">
                        {/* Microphone */}
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                          <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.42 2.72 6.2 6 6.72V21h2v-3.28c3.28-.52 6-3.3 6-6.72h-1.7z"></path>
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW LOGS MODAL */}
      {selectedCampaign && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-4xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                  <Megaphone className="w-6 h-6 text-indigo-600" /> Relatório: {selectedCampaign.name}
                </h3>
                <p className="text-xs font-medium text-slate-500 mt-1">Consulte o status do envio individual para cada paciente.</p>
              </div>
              <button 
                onClick={() => setSelectedCampaign(null)} 
                className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="p-8 overflow-y-auto space-y-6 flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl text-center">
                  <p className="text-xs text-indigo-600 font-bold uppercase tracking-wider">Total de Alvos</p>
                  <p className="text-3xl font-black text-indigo-950 mt-1">{selectedCampaign.total_contacts}</p>
                </div>
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-center">
                  <p className="text-xs text-emerald-600 font-bold uppercase tracking-wider">Envios Efetuados</p>
                  <p className="text-3xl font-black text-emerald-950 mt-1">{selectedCampaign.sent_contacts}</p>
                </div>
                <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-center">
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Status Atual</p>
                  <p className="text-3xl font-black text-slate-800 mt-1 capitalize">{selectedCampaign.status}</p>
                </div>
              </div>

              <div>
                <h4 className="font-extrabold text-slate-800 text-sm mb-4">Lista de Envio</h4>
                {loadingLogs ? (
                  <div className="py-10 flex justify-center"><Loader2 className="w-8 h-8 text-indigo-600 animate-spin" /></div>
                ) : (
                  <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white max-h-[300px] overflow-y-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          <th className="px-6 py-4">Paciente</th>
                          <th className="px-6 py-4">Telefone</th>
                          <th className="px-6 py-4">Data Envio</th>
                          <th className="px-6 py-4">Status</th>
                          <th className="px-6 py-4">Detalhes Erro</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-700">
                        {selectedCampaignLogs.map(log => (
                          <tr key={log.id} className="hover:bg-slate-50/50">
                            <td className="px-6 py-3.5">{log.patients?.name || 'Não cadastrado'}</td>
                            <td className="px-6 py-3.5">{log.patient_phone}</td>
                            <td className="px-6 py-3.5">
                              {log.sent_at ? new Date(log.sent_at).toLocaleString('pt-BR') : '-'}
                            </td>
                            <td className="px-6 py-3.5">
                              <span className={cn(
                                "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider",
                                log.status === 'sent' && "bg-emerald-50 text-emerald-600",
                                log.status === 'failed' && "bg-rose-50 text-rose-600",
                                log.status === 'pending' && "bg-slate-100 text-slate-500 animate-pulse"
                              )}>
                                {log.status === 'sent' ? 'Enviado' : log.status === 'failed' ? 'Falhou' : 'Pendente'}
                              </span>
                            </td>
                            <td className="px-6 py-3.5 text-slate-400 text-[10px] font-normal italic">
                              {log.error_message || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="p-8 border-t border-slate-100 flex justify-end bg-slate-50/50">
              <button 
                onClick={() => setSelectedCampaign(null)}
                className="px-6 py-3 bg-white hover:bg-slate-50 text-slate-600 rounded-xl font-bold border border-slate-200"
              >
                Fechar Relatório
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
