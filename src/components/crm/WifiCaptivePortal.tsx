import React, { useState, useEffect } from 'react';
import { Wifi, Loader2, CheckCircle2, ArrowRight, User, Mail, Smartphone } from 'lucide-react';
import { wifiService } from '@/src/services/wifiService';
import { cn } from '@/src/lib/utils';

export default function WifiCaptivePortal() {
    const [step, setStep] = useState<'login' | 'success'>('login');
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [settings, setSettings] = useState<any>(null);

    useEffect(() => {
        const fetchSettings = async () => {
            const data = await wifiService.getSettings();
            setSettings(data);
        };
        fetchSettings();
    }, []);

    const handleConnect = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) return;

        setLoading(true);
        try {
            // Check if patient exists
            const patient = await wifiService.checkPatientEmail(email);
            
            await wifiService.registerCheckin({
                clinic_id: settings?.clinic_id || 'default',
                patient_id: patient?.id,
                guest_name: patient ? `${patient.first_name} ${patient.last_name}` : 'Visitante',
                guest_email: email,
                is_patient: !!patient,
                checkin_at: new Date().toISOString(),
                ssid: settings?.ssid
            });

            setStep('success');
            
            // In a real captive portal, we would redirect to the original URL here
            // window.location.href = redirectUrl;
        } catch (error) {
            console.error('Error connecting to WiFi:', error);
        } finally {
            setLoading(false);
        }
    };

    if (!settings && step === 'login') {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
                <Loader2 className="w-10 h-10 text-white animate-spin" />
            </div>
        );
    }

    return (
        <div 
            className="min-h-screen flex flex-col items-center justify-center p-6 transition-all duration-700"
            style={{ backgroundColor: settings?.portal_bg_color || '#1e293b' }}
        >
            <div className="w-full max-w-md bg-white/10 backdrop-blur-xl p-10 rounded-[3rem] border border-white/10 shadow-2xl space-y-10">
                <div className="text-center space-y-4">
                    <div 
                        className="w-20 h-20 rounded-[2rem] mx-auto flex items-center justify-center shadow-2xl animate-bounce-slow"
                        style={{ backgroundColor: settings?.portal_accent_color || '#4f46e5' }}
                    >
                        <Wifi className="w-10 h-10 text-white" />
                    </div>
                    <h1 className="text-3xl font-black text-white tracking-tight">
                        {settings?.portal_title || 'Tzion Terapias'}
                    </h1>
                    <p className="text-white/60 font-medium">
                        {settings?.portal_subtitle || 'Conecte-se à nossa rede WiFi gratuita.'}
                    </p>
                </div>

                {step === 'login' ? (
                    <form onSubmit={handleConnect} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Seu E-mail</label>
                            <div className="relative group">
                                <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30 group-focus-within:text-white transition-colors" />
                                <input 
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="exemplo@email.com"
                                    className="w-full pl-14 pr-6 py-5 bg-white/5 border border-white/10 rounded-3xl text-white placeholder:text-white/20 outline-none focus:ring-4 focus:ring-white/5 focus:border-white/20 transition-all font-medium"
                                />
                            </div>
                        </div>

                        <button 
                            type="submit"
                            disabled={loading}
                            className="w-full py-5 bg-white text-slate-900 rounded-3xl font-black uppercase tracking-widest shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                        >
                            {loading ? (
                                <Loader2 className="w-6 h-6 animate-spin" />
                            ) : (
                                <>Conectar Agora <ArrowRight className="w-6 h-6" /></>
                            )}
                        </button>

                        <p className="text-[10px] text-center text-white/30 font-bold uppercase tracking-tighter">
                            Ao conectar, você aceita nossos termos de uso.
                        </p>
                    </form>
                ) : (
                    <div className="text-center space-y-8 animate-in zoom-in duration-500">
                        <div className="w-24 h-24 bg-emerald-500 rounded-full mx-auto flex items-center justify-center shadow-2xl shadow-emerald-500/20">
                            <CheckCircle2 className="w-12 h-12 text-white" />
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-2xl font-black text-white">Conectado com Sucesso!</h2>
                            <p className="text-white/60 font-medium">Você já pode navegar em nossa rede.</p>
                        </div>
                        <button 
                            onClick={() => window.location.href = 'https://google.com'}
                            className="w-full py-5 bg-white/10 border border-white/10 text-white rounded-3xl font-bold hover:bg-white/20 transition-all"
                        >
                            Ir para o Google
                        </button>
                    </div>
                )}
            </div>

            {/* Footer decoration */}
            <div className="mt-12 flex items-center gap-6 text-white/20">
                <Smartphone className="w-5 h-5" />
                <div className="w-1 h-1 rounded-full bg-white/20" />
                <Wifi className="w-5 h-5" />
                <div className="w-1 h-1 rounded-full bg-white/20" />
                <Mail className="w-5 h-5" />
            </div>
        </div>
    );
}
