import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  Wifi, ShieldCheck, Users, BarChart3, ClipboardList, Settings, 
  CheckCircle2, XCircle, AlertTriangle, Clock, Star, Trophy, 
  Flame, Zap, RefreshCw, QrCode, Link as LinkIcon, Eye, EyeOff, 
  Plus, Trash2, Pencil, ChevronLeft, ChevronRight, Smartphone, 
  Signal, Sparkles, Radio, Loader2, Save, X
} from 'lucide-react';
import { supabase } from '@/src/lib/supabase';
import { cn } from '@/src/lib/utils';

interface WifiCheckin {
    id: string;
    patient_id?: string;
    guest_name?: string;
    guest_email?: string;
    guest_phone?: string;
    clinic_id: string;
    device_mac?: string;
    checkin_at: string;
    is_patient: boolean;
    ssid?: string;
    ap_name?: string;
}

interface WifiSettings {
    id?: string;
    clinic_id: string;
    ssid: string;
    gateway_ip?: string;
    portal_title?: string;
    portal_subtitle?: string;
    portal_bg_color?: string;
    portal_accent_color?: string;
    require_registration: boolean;
    session_duration_minutes: number;
    enabled: boolean;
    portal_verse?: string;
    show_linktree?: boolean;
    linktree_links?: Array<{ label: string; url: string; icon?: string }>;
}

const TABS = [
    { id: 'live', label: 'Ao Vivo', icon: Radio },
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'checkins', label: 'Histórico', icon: ClipboardList },
    { id: 'integration', label: 'Integração', icon: Smartphone },
    { id: 'settings', label: 'Configuração', icon: Settings },
];

export default function WifiPresence() {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [checkins, setCheckins] = useState<WifiCheckin[]>([]);
    const [liveCheckins, setLiveCheckins] = useState<WifiCheckin[]>([]);
    const [newArrivals, setNewArrivals] = useState<Set<string>>(new Set());
    const [liveCounter, setLiveCounter] = useState(30);
    const liveTimerRef = useRef<NodeJS.Timeout | null>(null);
    const [settings, setSettings] = useState<WifiSettings>({
        clinic_id: 'default',
        ssid: '',
        portal_title: 'Tzion Terapias',
        portal_subtitle: 'Conecte-se ao nosso WiFi',
        require_registration: true,
        session_duration_minutes: 120,
        enabled: false,
        portal_bg_color: '#1e293b',
        portal_accent_color: '#4f46e5',
        show_linktree: false,
        linktree_links: [],
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [dateFilter, setDateFilter] = useState('7days');
    const [checkinPage, setCheckinPage] = useState(1);
    const CHECKINS_PER_PAGE = 15;

    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [settingsRes, checkinsRes] = await Promise.all([
                supabase.from('wifi_settings').select('*').maybeSingle(),
                supabase.from('wifi_checkins').select('*').order('checkin_at', { ascending: false }).limit(200),
            ]);

            if (settingsRes.data) setSettings(settingsRes.data);
            if (checkinsRes.data) setCheckins(checkinsRes.data);
        } catch (err) {
            console.error('Error loading wifi data:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();

        const channel = supabase
            .channel('wifi_presence_changes')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'wifi_checkins' },
                (payload) => {
                    const newCheckin = payload.new as WifiCheckin;
                    setCheckins(prev => [newCheckin, ...prev]);
                    setLiveCheckins(prev => [newCheckin, ...prev.slice(0, 49)]);
                    setNewArrivals(prev => new Set([...prev, newCheckin.id]));
                    setTimeout(() => {
                        setNewArrivals(prev => { const s = new Set(prev); s.delete(newCheckin.id); return s; });
                    }, 8000);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [loadData]);

    useEffect(() => {
        if (activeTab !== 'live') return;

        const loadLive = async () => {
            const sessionMinutes = settings.session_duration_minutes || 120;
            const since = new Date(Date.now() - sessionMinutes * 60 * 1000).toISOString();
            const { data } = await supabase
                .from('wifi_checkins')
                .select('*')
                .gte('checkin_at', since)
                .order('checkin_at', { ascending: false })
                .limit(50);
            if (data) setLiveCheckins(data);
        };

        loadLive();
        setLiveCounter(30);
        liveTimerRef.current = setInterval(() => {
            setLiveCounter(prev => {
                if (prev <= 1) { loadLive(); return 30; }
                return prev - 1;
            });
        }, 1000);

        return () => { if (liveTimerRef.current) clearInterval(liveTimerRef.current); };
    }, [activeTab, settings.session_duration_minutes]);

    const portalLink = useMemo(() => {
        // Exibido na UI do admin — usa origin atual (correto para QR code local)
        return `${window.location.origin}/wifi`;
    }, []);

    const handleCopyPortalLink = () => {
        navigator.clipboard.writeText(portalLink);
        alert('Link do portal copiado!');
    };

    const filteredCheckins = useMemo(() => {
        const cutoff = new Date();
        if (dateFilter === '7days') cutoff.setDate(cutoff.getDate() - 7);
        else if (dateFilter === '30days') cutoff.setDate(cutoff.getDate() - 30);
        else if (dateFilter === 'today') cutoff.setHours(0, 0, 0, 0);
        return checkins.filter(c => new Date(c.checkin_at) >= cutoff);
    }, [checkins, dateFilter]);

    const analytics = useMemo(() => {
        const patients = filteredCheckins.filter(c => c.is_patient).length;
        const guests = filteredCheckins.filter(c => !c.is_patient).length;
        const unique = new Set(filteredCheckins.map(c => c.patient_id || c.guest_email)).size;
        const today = filteredCheckins.filter(c => new Date(c.checkin_at).toDateString() === new Date().toDateString()).length;

        return { patients, guests, unique, today };
    }, [filteredCheckins]);

    const handleSaveSettings = async () => {
        setIsSaving(true);
        try {
            if (settings.id) {
                const { error } = await supabase.from('wifi_settings').update(settings).eq('id', settings.id);
                if (error) throw error;
            } else {
                const { data, error } = await supabase.from('wifi_settings').insert(settings).select().single();
                if (error) throw error;
                if (data) setSettings(data);
            }
        } catch (err) {
            console.error('Error saving wifi settings:', err);
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Tab Navigation */}
            <div className="flex p-1.5 bg-slate-100 rounded-2xl w-fit border border-slate-200">
                {TABS.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                            "flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all",
                            activeTab === tab.id 
                                ? "bg-white text-indigo-600 shadow-md" 
                                : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
                        )}
                    >
                        <tab.icon className={cn("w-4 h-4", tab.id === 'live' && activeTab !== 'live' && "text-rose-500")} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {activeTab === 'dashboard' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {[
                            { label: 'Total Conexões', value: filteredCheckins.length, icon: Signal, color: 'indigo' },
                            { label: 'Pacientes', value: analytics.patients, icon: Users, color: 'emerald' },
                            { label: 'Visitantes', value: analytics.guests, icon: Smartphone, color: 'amber' },
                            { label: 'Hoje', value: analytics.today, icon: Clock, color: 'rose' },
                        ].map((stat, i) => (
                            <div key={i} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4">
                                <div className={cn(
                                    "w-12 h-12 rounded-2xl flex items-center justify-center",
                                    stat.color === 'indigo' ? "bg-indigo-50 text-indigo-600" :
                                    stat.color === 'emerald' ? "bg-emerald-50 text-emerald-600" :
                                    stat.color === 'amber' ? "bg-amber-50 text-amber-600" :
                                    "bg-rose-50 text-rose-600"
                                )}>
                                    <stat.icon className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
                                    <h3 className="text-xl font-bold text-slate-900">{stat.value}</h3>
                                </div>
                            </div>
                        ))}
                    </div>
                    
                    <div className="bg-indigo-600 p-8 rounded-[3rem] text-white flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-3xl bg-white/10 flex items-center justify-center">
                                <QrCode className="w-8 h-8" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold">Portal WiFi Ativo</h3>
                                <p className="text-white/70">Aponte seu roteador para o portal captivo da Tzion.</p>
                                <p className="text-[10px] font-mono mt-1 text-white/50">{portalLink}</p>
                            </div>
                        </div>
                        <button 
                            onClick={handleCopyPortalLink}
                            className="px-8 py-4 bg-white text-indigo-600 rounded-2xl font-bold hover:bg-indigo-50 transition-all flex items-center gap-2"
                        >
                            <LinkIcon className="w-5 h-5" /> Copiar Link do Portal
                        </button>
                    </div>
                </div>
            )}

            {activeTab === 'integration' && (
                <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-slate-900 rounded-[3rem] p-10 text-white shadow-2xl">
                        <div className="flex items-center gap-6 mb-10">
                            <div className="w-16 h-16 bg-white/10 rounded-[2rem] flex items-center justify-center">
                                <Smartphone className="w-8 h-8 text-white" />
                            </div>
                            <div>
                                <h2 className="text-3xl font-black tracking-tight">Guia de Integração AP Intelbras</h2>
                                <p className="text-white/50 font-medium">Siga os passos abaixo para configurar seu Access Point.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {[
                                { 
                                    step: '01', 
                                    title: 'Acesse o WiseFi', 
                                    desc: 'Entre no painel do seu roteador ou controlador WiseFi da Intelbras.',
                                    icon: Settings
                                },
                                { 
                                    step: '02', 
                                    title: 'Configurar Hotspot', 
                                    desc: 'Selecione "Portal Externo" e cole o URL do portal captivo abaixo.',
                                    icon: Radio
                                },
                                { 
                                    step: '03', 
                                    title: 'Salvar e Testar', 
                                    desc: 'Aplique as configurações e conecte um celular ao WiFi para validar.',
                                    icon: CheckCircle2
                                }
                            ].map((item, idx) => (
                                <div key={idx} className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 hover:bg-white/10 transition-all">
                                    <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-black mb-6 shadow-lg shadow-indigo-600/20">
                                        {item.step}
                                    </div>
                                    <h4 className="text-xl font-bold mb-3">{item.title}</h4>
                                    <p className="text-white/50 text-sm leading-relaxed">{item.desc}</p>
                                </div>
                            ))}
                        </div>

                        <div className="mt-10 p-8 bg-white/5 rounded-[2rem] border border-white/10">
                            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                                <div>
                                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">URL para o Roteador</p>
                                    <p className="text-lg font-mono text-white/80">{portalLink}</p>
                                </div>
                                <button 
                                    onClick={handleCopyPortalLink}
                                    className="px-6 py-3 bg-white text-slate-900 rounded-xl font-bold hover:bg-slate-100 transition-all flex items-center gap-2"
                                >
                                    <LinkIcon className="w-4 h-4" /> Copiar URL
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm space-y-6">
                        <h3 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                            <ShieldCheck className="w-8 h-8 text-indigo-600" /> Domínios Permitidos (Walled Garden)
                        </h3>
                        <p className="text-slate-500 font-medium">Para que o portal funcione corretamente, seu roteador deve permitir acesso aos seguintes domínios sem autenticação:</p>
                        
                        <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 font-mono text-sm text-slate-600 space-y-2">
                            <p>supabase.co</p>
                            <p>google.com (para fontes e mapas se necessário)</p>
                            <p>tzion.terapias (seu domínio atual)</p>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'live' && (
                <div className="space-y-6">
                    <div className="bg-rose-600 p-6 rounded-[2.5rem] text-white flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="relative">
                                <div className="w-3 h-3 bg-white rounded-full animate-ping absolute inset-0" />
                                <div className="w-3 h-3 bg-white rounded-full relative" />
                            </div>
                            <h3 className="font-bold">Monitoramento em Tempo Real</h3>
                        </div>
                        <p className="text-white/70 text-sm font-bold uppercase tracking-widest">Atualizando em {liveCounter}s</p>
                    </div>

                    <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm">
                        <div className="divide-y divide-slate-100">
                            {liveCheckins.length === 0 ? (
                                <div className="p-20 text-center text-slate-400">
                                    <Radio className="w-12 h-12 mx-auto mb-4 opacity-20" />
                                    <p className="font-bold text-lg">Nenhuma conexão ativa no momento</p>
                                </div>
                            ) : (
                                liveCheckins.map((c) => (
                                    <div key={c.id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-all">
                                        <div className="flex items-center gap-4">
                                            <div className={cn(
                                                "w-12 h-12 rounded-2xl flex items-center justify-center font-bold",
                                                c.is_patient ? "bg-indigo-50 text-indigo-600" : "bg-slate-100 text-slate-500"
                                            )}>
                                                {(c.guest_name || 'P').charAt(0)}
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-900">{c.guest_name || 'Paciente'}</p>
                                                <p className="text-xs text-slate-500 font-medium">{c.guest_email || 'conexão automática'}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-slate-900">{new Date(c.checkin_at).toLocaleTimeString()}</p>
                                            <span className={cn(
                                                "px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest",
                                                c.is_patient ? "bg-indigo-50 text-indigo-600" : "bg-slate-50 text-slate-400"
                                            )}>
                                                {c.is_patient ? 'Paciente' : 'Visitante'}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'checkins' && (
                <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm">
                    <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-100">
                            <tr>
                                <th className="text-left p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Pessoa</th>
                                <th className="text-left p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipo</th>
                                <th className="text-left p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Dispositivo</th>
                                <th className="text-left p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Data/Hora</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredCheckins.map((c) => (
                                <tr key={c.id} className="hover:bg-slate-50 transition-all">
                                    <td className="p-6 font-bold text-slate-900">{c.guest_name || 'Paciente'}</td>
                                    <td className="p-6">
                                        <span className={cn(
                                            "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                                            c.is_patient ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600"
                                        )}>
                                            {c.is_patient ? 'Paciente' : 'Visitante'}
                                        </span>
                                    </td>
                                    <td className="p-6 text-sm text-slate-500 font-medium">{c.device_mac || 'Desconhecido'}</td>
                                    <td className="p-6 text-right font-bold text-slate-900">
                                        {new Date(c.checkin_at).toLocaleDateString()} {new Date(c.checkin_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {activeTab === 'settings' && (
                <div className="max-w-2xl bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm space-y-8">
                    <div className="flex items-center gap-4 mb-2">
                        <div className="p-3 bg-indigo-600 text-white rounded-2xl"><Settings className="w-6 h-6" /></div>
                        <h3 className="text-2xl font-black text-slate-900 tracking-tight">Configuração do Portal</h3>
                    </div>

                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">SSID do WiFi (Nome da Rede)</label>
                                <input 
                                    value={settings.ssid}
                                    onChange={(e) => setSettings({...settings, ssid: e.target.value})}
                                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20" 
                                    placeholder="Ex: Tzion_Terapias_WiFi" 
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Duração da Sessão (min)</label>
                                <input 
                                    type="number"
                                    value={settings.session_duration_minutes}
                                    onChange={(e) => setSettings({...settings, session_duration_minutes: parseInt(e.target.value)})}
                                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20" 
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Título do Portal</label>
                            <input 
                                value={settings.portal_title}
                                onChange={(e) => setSettings({...settings, portal_title: e.target.value})}
                                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20" 
                            />
                        </div>

                        <div className="flex items-center justify-between p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                            <div>
                                <p className="font-bold text-slate-900">Ativar Portal Captivo</p>
                                <p className="text-xs text-slate-500">Habilita a página de login para o WiFi.</p>
                            </div>
                            <button 
                                onClick={() => setSettings({...settings, enabled: !settings.enabled})}
                                className={cn(
                                    "w-14 h-8 rounded-full relative transition-all duration-300",
                                    settings.enabled ? "bg-indigo-600" : "bg-slate-300"
                                )}
                            >
                                <div className={cn(
                                    "absolute top-1 w-6 h-6 bg-white rounded-full transition-all duration-300",
                                    settings.enabled ? "left-7" : "left-1"
                                )} />
                            </button>
                        </div>

                        <button 
                            onClick={handleSaveSettings}
                            disabled={isSaving}
                            className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-bold shadow-2xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                        >
                            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                            Salvar Configurações
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
