import React from 'react';
import { 
  Smartphone, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  QrCode, 
  Power, 
  Settings, 
  MessageSquare, 
  Zap, 
  Plus, 
  X,
  Trash2,
  Copy,
  Check,
  Save,
  Loader2
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { evolutionService } from '@/src/services/evolutionService';
import { supabase } from '@/src/lib/supabase';

interface Instance {
  id: string;
  name: string;
  status: 'open' | 'connecting' | 'disconnected';
  phone?: string;
  uptime?: string;
  token?: string;
  messageCount?: number;
}

export default function EvolutionManager() {
  const [instances, setInstances] = React.useState<Instance[]>([]);
  const [loadingInstances, setLoadingInstances] = React.useState(true);
  const [showQR, setShowQR] = React.useState<{ id: string, base64: string | null } | null>(null);
  const [loading, setLoading] = React.useState<string | null>(null);
  const [showNewModal, setShowNewModal] = React.useState(false);
  const [newInstanceName, setNewInstanceName] = React.useState('');
  const [showSettings, setShowSettings] = React.useState<Instance | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [aiEnabled, setAiEnabled] = React.useState(true);
  const [aiInstructions, setAiInstructions] = React.useState('');
  const [savingAI, setSavingAI] = React.useState(false);
  const [toast, setToast] = React.useState<{ message: string, type: 'success' | 'error' } | null>(null);

  const handleShowToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchInstances = async () => {
    try {
      setLoadingInstances(true);
      
      const { data: dbInstances } = await supabase
        .from('whatsapp_instances')
        .select('*'); // Pegar tudo para ter o token se precisar
      
      const allowedNames = dbInstances?.map(i => i.instance_name) || [];
      const dbMap = new Map(dbInstances?.map(i => [i.instance_name, i]));

      // Buscar contagem de mensagens para cada instância
      const { data: messageCounts } = await supabase
        .from('chat_messages')
        .select('instance_id');
      
      const countMap = new Map();
      messageCounts?.forEach(m => {
        countMap.set(m.instance_id, (countMap.get(m.instance_id) || 0) + 1);
      });

      const data = await evolutionService.getInstances();
      if (!Array.isArray(data)) return;

      const mapped: Instance[] = data
        .map((item: any) => item.instance || item)
        .filter((inst: any) => {
          const name = inst.instanceName || inst.name;
          return allowedNames.includes(name) || name?.toLowerCase().startsWith('tzion_');
        })
        .map((inst: any) => {
          const name = inst.instanceName || inst.name;
          const dbData = dbMap.get(name);
          // Tentar pegar o número de várias fontes (ownerJid, owner, jid, profile.number)
          const rawPhone = inst.ownerJid || inst.owner || inst.jid || inst.number || inst.profile?.number || '';
          const phone = rawPhone.split('@')[0].split(':')[0];
          
          return {
            id: name,
            name: name,
            status: inst.status === 'open' || inst.connectionStatus === 'open' ? 'open' : 'disconnected',
            phone: phone || 'N/A',
            uptime: inst.uptime || 'N/A',
            token: dbData?.instance_token || inst.token || 'Não disponível',
            messageCount: countMap.get(name) || 0
          };
        });

      setInstances(mapped);
    } catch (error) {
      console.error('Erro ao buscar instâncias:', error);
    } finally {
      setLoadingInstances(false);
    }
  };

  React.useEffect(() => {
    fetchInstances();
  }, []);

  // Polling para verificar status de instâncias desconectadas
  React.useEffect(() => {
    const interval = setInterval(async () => {
      const hasDisconnected = instances.some(i => i.status !== 'open');
      if (hasDisconnected) {
        await fetchInstances();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [instances]);

  // Fechar o modal de QR Code automaticamente ao conectar
  React.useEffect(() => {
    if (showQR) {
      const activeInst = instances.find(i => i.id === showQR.id);
      if (activeInst && activeInst.status === 'open') {
        setShowQR(null);
        handleShowToast('WhatsApp conectado com sucesso!');
      }
    }
  }, [instances, showQR]);

  const handleGenerateQR = async (inst: Instance) => {
    try {
      setLoading(inst.id);
      const result = await evolutionService.setupNewCustomerInstance(inst.name, inst.id);
      const base64 = await evolutionService.getQRCode(result.instanceName);
      setShowQR({ id: inst.id, base64 });
    } catch (error) {
      console.error('Erro ao gerar QR Code:', error);
    } finally {
      setLoading(null);
    }
  };

  const handleDeleteInstance = async (id: string) => {
    if (!confirm('🚨 ATENÇÃO: Deseja REMOVER COMPLETAMENTE esta instância do servidor? Esta ação não pode ser desfeita.')) return;
    try {
      setLoading(id);
      await evolutionService.deleteInstance(id);
      await fetchInstances();
    } catch (error) {
      console.error('Erro ao deletar:', error);
      handleShowToast('Erro ao remover instância.', 'error');
    } finally {
      setLoading(null);
    }
  };

  const handleSaveAISettings = async () => {
    if (!showSettings) return;
    try {
      setSavingAI(true);
      const { error } = await supabase
        .from('whatsapp_instances')
        .upsert({ 
          instance_name: showSettings.name,
          ai_enabled: aiEnabled,
          ai_instructions: aiInstructions,
          instance_token: showSettings.token
        }, { onConflict: 'instance_name' });

      if (error) throw error;
      handleShowToast('Configurações de IA salvas com sucesso! O n8n já pode ler estas regras.');
    } catch (error) {
      console.error('Erro ao salvar IA:', error);
      handleShowToast('Erro ao salvar configurações.', 'error');
    } finally {
      setSavingAI(false);
    }
  };

  const openSettings = async (inst: Instance) => {
    setShowSettings(inst);
    // Buscar configurações atuais no DB
    const { data } = await supabase
      .from('whatsapp_instances')
      .select('ai_enabled, ai_instructions')
      .eq('instance_name', inst.name)
      .single();
    
    if (data) {
      setAiEnabled(data.ai_enabled);
      setAiInstructions(data.ai_instructions || '');
    }
  };

  const handleLogout = async (id: string) => {
    if (!confirm('Deseja desconectar o WhatsApp desta instância? Você precisará ler o QR Code novamente para conectar.')) return;
    try {
      setLoading(id);
      await evolutionService.logoutInstance(id);
      await fetchInstances();
      handleShowToast('WhatsApp desconectado com sucesso!');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      handleShowToast('Erro ao desconectar. A instância já pode estar desconectada.', 'error');
    } finally {
      setLoading(null);
    }
  };

  const handleCreateInstance = async () => {
    if (!newInstanceName.trim()) return;
    
    // Criar instância com o nome real
    try {
      setLoading('new');
      await evolutionService.setupNewCustomerInstance(newInstanceName, newInstanceName);
      setNewInstanceName('');
      setShowNewModal(false);
      await fetchInstances();
    } catch (error) {
      console.error('Erro ao criar:', error);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-slate-900">Instâncias WhatsApp</h3>
          <p className="text-sm text-slate-500">Gerencie suas conexões com a Evolution API</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={fetchInstances}
            className="p-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all"
          >
            <RefreshCw className={cn("w-5 h-5", loadingInstances && "animate-spin")} />
          </button>
          <button 
            onClick={() => setShowNewModal(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Nova Instância
          </button>
        </div>
      </div>

      {loadingInstances && instances.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-20 bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200">
           <RefreshCw className="w-12 h-12 text-slate-300 animate-spin mb-4" />
           <p className="text-slate-500 font-medium">Buscando instâncias reais na API...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {instances.map((inst) => (
            <div key={inst.id} className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
              <div className="flex items-start justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center transition-colors",
                    inst.status === 'open' ? "bg-emerald-50 text-emerald-600" : "bg-slate-50 text-slate-400"
                  )}>
                    <Smartphone className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900">{inst.name}</h4>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "w-2 h-2 rounded-full",
                        inst.status === 'open' ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
                      )} />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {inst.status === 'open' ? 'Conectado' : 'Desconectado'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => openSettings(inst)}
                    className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => handleLogout(inst.id)}
                    title="Desconectar WhatsApp"
                    className={cn(
                      "p-2 rounded-xl transition-colors",
                      inst.status === 'open' ? "bg-emerald-50 text-emerald-600 hover:bg-rose-50 hover:text-rose-600" : "text-slate-300 cursor-not-allowed"
                    )}
                  >
                    <Power className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => handleDeleteInstance(inst.id)}
                    title="Remover Instância"
                    className="p-2 hover:bg-rose-50 rounded-xl text-rose-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {inst.status === 'open' ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-4 rounded-2xl">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Número</p>
                    <p className="font-bold text-slate-700">+{inst.phone}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Status</p>
                    <p className="font-bold text-emerald-600">Ativo</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-6 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-3">
                    {loading === inst.id ? (
                      <RefreshCw className="w-12 h-12 text-indigo-500 animate-spin" />
                    ) : (
                      <QrCode className="w-12 h-12 text-slate-300" />
                    )}
                    <button 
                      onClick={() => handleGenerateQR(inst)}
                      disabled={loading === inst.id}
                      className="px-6 py-2 bg-white border border-slate-200 rounded-xl font-bold text-xs hover:bg-slate-100 transition-all shadow-sm disabled:opacity-50"
                    >
                      {loading === inst.id ? 'Gerando...' : 'Gerar QR Code'}
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-8 pt-6 border-t border-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-[10px] font-bold text-slate-500">{inst.messageCount || 0} Mensagens</span>
                  </div>
                </div>
                <button 
                  disabled
                  className="text-[10px] font-bold text-slate-300 uppercase tracking-widest cursor-not-allowed"
                >
                  Em breve
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className={cn(
          "fixed bottom-8 right-8 z-[1000] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border backdrop-blur-md animate-in slide-in-from-right duration-300",
          toast.type === 'success' 
            ? "bg-emerald-500/90 border-emerald-400 text-white" 
            : "bg-rose-500/90 border-rose-400 text-white"
        )}>
          {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <p className="text-sm font-bold">{toast.message}</p>
          <button onClick={() => setToast(null)} className="ml-4 opacity-50 hover:opacity-100 transition-opacity">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {showNewModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] p-10 max-w-sm w-full space-y-6 shadow-2xl relative">
            <button 
              onClick={() => setShowNewModal(false)}
              className="absolute top-6 right-6 p-2 hover:bg-slate-50 rounded-full text-slate-400 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="text-center space-y-2">
              <h3 className="text-2xl font-bold text-slate-900">Nova Instância</h3>
              <p className="text-sm text-slate-500">Dê um nome amigável para sua nova conexão WhatsApp.</p>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Nome da Instância</label>
                <input 
                  autoFocus
                  value={newInstanceName}
                  onChange={(e) => setNewInstanceName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateInstance()}
                  placeholder="Ex: Comercial, Suporte..."
                  className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 focus:bg-white outline-none transition-all font-medium text-slate-700"
                />
              </div>
              
              <button 
                onClick={handleCreateInstance}
                disabled={!newInstanceName.trim()}
                className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50 disabled:shadow-none"
              >
                Criar e Gerar QR Code
              </button>
            </div>
          </div>
        </div>
      )}

      {showQR && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] p-10 max-w-sm w-full text-center space-y-6 shadow-2xl relative">
            <button 
              onClick={() => setShowQR(null)}
              className="absolute top-6 right-6 p-2 hover:bg-slate-50 rounded-full text-slate-400 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-2xl font-bold text-slate-900">Escaneie o QR Code</h3>
            <p className="text-sm text-slate-500">Abra o WhatsApp no seu celular e vá em Dispositivos Conectados.</p>
            <div className="bg-slate-50 p-6 rounded-[2rem] border-2 border-slate-100 inline-block overflow-hidden">
               {showQR.base64 ? (
                 <img src={showQR.base64} alt="WhatsApp QR Code" className="w-48 h-48 rounded-xl" />
               ) : (
                 <div className="w-48 h-48 bg-slate-200 rounded-xl animate-pulse flex items-center justify-center">
                   <QrCode className="w-20 h-20 text-slate-400" />
                 </div>
               )}
            </div>
            <button 
              onClick={() => setShowQR(null)}
              className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all"
            >
              Concluir
            </button>
            <div className="flex items-center justify-center gap-2">
              <RefreshCw className="w-3 h-3 text-emerald-500 animate-spin" />
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Sincronizando em tempo real...</p>
            </div>
          </div>
        </div>
      )}
      {showSettings && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] p-10 max-w-lg w-full space-y-8 shadow-2xl relative">
            <button 
              onClick={() => setShowSettings(null)}
              className="absolute top-6 right-6 p-2 hover:bg-slate-50 rounded-full text-slate-400 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                <Settings className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-slate-900">Configurações</h3>
                <p className="text-sm text-slate-500">Instância: <span className="font-mono font-bold text-indigo-600">{showSettings.name}</span></p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-3">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Token da Instância (API Key)</label>
                <div className="relative group">
                  <input 
                    readOnly
                    value={showSettings.token}
                    className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-mono text-sm text-slate-600 pr-14"
                  />
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(showSettings.token || '');
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-white shadow-sm border border-slate-100 rounded-xl hover:bg-slate-50 text-slate-400 hover:text-indigo-600 transition-all"
                  >
                    {copied ? <Check className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5" />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 px-1 italic">Use este token para autenticar chamadas de API via n8n ou Postman.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-5 bg-slate-50 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-600">Recusar Chamadas</span>
                    <div className="w-10 h-5 bg-emerald-500 rounded-full relative">
                       <div className="absolute right-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow-sm" />
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400">Bloqueia chamadas de voz automaticamente.</p>
                </div>
                <div className="p-5 bg-slate-50 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-600">Sempre Online</span>
                    <div className="w-10 h-5 bg-emerald-500 rounded-full relative">
                       <div className="absolute right-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow-sm" />
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400">Mantém o status "Online" no WhatsApp.</p>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 space-y-4">
                 <div className="flex items-center justify-between px-1">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Configurações de IA</p>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer"
                        checked={aiEnabled}
                        onChange={(e) => setAiEnabled(e.target.checked)}
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                 </div>
                 
                 <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase px-1">Instruções do Agente (Prompt)</label>
                    <textarea 
                      value={aiInstructions}
                      onChange={(e) => setAiInstructions(e.target.value)}
                      placeholder="Ex: Você é um assistente da Tzion Terapias..."
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-600 min-h-[120px] focus:ring-2 focus:ring-indigo-500/20 transition-all resize-none"
                    />
                    <p className="text-[9px] text-slate-400 italic px-1">Estas instruções definem como a IA responderá aos seus clientes.</p>
                 </div>

                 <button 
                  onClick={handleSaveAISettings}
                  disabled={savingAI}
                  className="w-full py-3 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-all flex items-center justify-center gap-2"
                 >
                   {savingAI ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                   Salvar Configurações de IA
                 </button>
              </div>

              <div className="pt-4 border-t border-slate-100">
                 <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 px-1">Webhook URL</p>
                 <div className="px-4 py-3 bg-slate-50 rounded-xl text-[11px] font-mono text-slate-500 break-all border border-slate-100">
                    https://youxrufxufxxcgixymdd.supabase.co/functions/v1/whatsapp-router
                 </div>
              </div>
            </div>

            <button 
              onClick={() => setShowSettings(null)}
              className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-xl"
            >
              Fechar Configurações
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
