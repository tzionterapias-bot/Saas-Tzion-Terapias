import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Heart, Lock, Mail, ArrowRight, Loader2, Key, CheckCircle2, ShieldCheck, Eye, EyeOff, Sparkles, MessageCircle } from 'lucide-react';
import { cn } from '@/src/lib/utils';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Mode: 'request' (pedir envio) ou 'reset' (digitar código + nova senha)
  const [mode, setMode] = useState<'request' | 'reset'>('request');
  
  // Form fields
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // States
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSuccessDone, setIsSuccessDone] = useState(false);

  useEffect(() => {
    document.title = "Recuperação de Senha | Tzion Terapias";
    let metaDescription = document.querySelector('meta[name="description"]');
    if (!metaDescription) {
      metaDescription = document.createElement('meta');
      metaDescription.setAttribute('name', 'description');
      document.head.appendChild(metaDescription);
    }
    metaDescription.setAttribute('content', 'Recupere sua senha de acesso à plataforma Tzion Terapias via WhatsApp de forma rápida e segura.');
  }, []);

  // Preenche automaticamente caso venha com parâmetros da URL (ex: link do WhatsApp)
  useEffect(() => {
    const urlEmail = searchParams.get('email');
    const urlCode = searchParams.get('code');
    const urlToken = searchParams.get('token');

    if (urlEmail) {
      setEmailOrPhone(urlEmail);
    }
    if (urlCode || urlToken) {
      setCode(urlCode || urlToken || '');
      setMode('reset');
    }
  }, [searchParams]);

  // Enviar código / link via WhatsApp
  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailOrPhone.trim()) {
      setError('Por favor, informe seu E-mail ou WhatsApp.');
      return;
    }

    setError('');
    setSuccessMessage('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailOrPhone: emailOrPhone.trim() })
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setSuccessMessage('Enviamos o código e o link de recuperação para o seu WhatsApp cadastrado!');
        if (data.email) {
          setEmailOrPhone(data.email);
        }
        setMode('reset');
      } else {
        setError(data.error || 'Não foi possível enviar a recuperação. Verifique os dados digitados.');
      }
    } catch (err: any) {
      console.error('Erro ao solicitar recuperação:', err);
      setError(err.message || 'Erro de conexão ao solicitar recuperação.');
    } finally {
      setIsLoading(false);
    }
  };

  // Salvar nova senha
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!emailOrPhone.trim()) {
      setError('Por favor, informe seu e-mail ou WhatsApp.');
      return;
    }

    if (!code.trim()) {
      setError('Por favor, informe o código de 6 dígitos recebido no WhatsApp.');
      return;
    }

    if (newPassword.length < 6) {
      setError('A nova senha deve ter no mínimo 6 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('As senhas digitadas não coincidem.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailOrPhone: emailOrPhone.trim(),
          code: code.trim(),
          newPassword: newPassword
        })
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setIsSuccessDone(true);
        setSuccessMessage('Sua senha foi redefinida com sucesso!');
        setTimeout(() => {
          navigate('/login', { replace: true, state: { resetSuccess: true } });
        }, 2200);
      } else {
        setError(data.error || 'Não foi possível redefinir a senha. O código pode ter expirado.');
      }
    } catch (err: any) {
      console.error('Erro ao redefinir senha:', err);
      setError(err.message || 'Erro de conexão ao redefinir a senha.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 flex items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Background glowing blobs */}
      <div className="absolute top-[-10%] left-[-5%] w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-5%] w-80 h-80 bg-violet-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full relative z-10">
        {/* Main Card */}
        <div className="bg-white/5 backdrop-blur-xl rounded-[2.5rem] border border-white/10 p-8 sm:p-10 shadow-2xl space-y-6">
          
          {/* Header */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-500/20 rounded-2xl border border-indigo-500/30 mb-1 relative">
              <ShieldCheck className="w-8 h-8 text-indigo-400" />
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-slate-900 flex items-center justify-center">
                <Sparkles className="w-2.5 h-2.5 text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {isSuccessDone ? 'Tudo Pronto!' : mode === 'request' ? 'Recuperar Senha' : 'Criar Nova Senha'}
              </h1>
              <p className="text-slate-400 text-sm font-medium mt-1">
                {isSuccessDone
                  ? 'Redirecionando para a tela de login...'
                  : mode === 'request'
                  ? 'Receba um link e código de segurança no WhatsApp'
                  : 'Informe o código do WhatsApp e defina sua nova senha'}
              </p>
            </div>
          </div>

          {/* Feedback Messages */}
          {error && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-sm font-bold text-center animate-in fade-in">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400 text-sm font-bold text-center animate-in fade-in flex items-center justify-center gap-2">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Step Navigation Tabs if not finished */}
          {!isSuccessDone && (
            <div className="grid grid-cols-2 gap-2 p-1 bg-white/5 rounded-2xl border border-white/10">
              <button
                type="button"
                onClick={() => { setMode('request'); setError(''); setSuccessMessage(''); }}
                className={cn(
                  "py-2.5 rounded-xl text-xs font-bold transition-all",
                  mode === 'request'
                    ? "bg-white text-slate-900 shadow"
                    : "text-slate-400 hover:text-white"
                )}
              >
                1. Solicitar Código
              </button>
              <button
                type="button"
                onClick={() => { setMode('reset'); setError(''); }}
                className={cn(
                  "py-2.5 rounded-xl text-xs font-bold transition-all",
                  mode === 'reset'
                    ? "bg-white text-slate-900 shadow"
                    : "text-slate-400 hover:text-white"
                )}
              >
                2. Redefinir Senha
              </button>
            </div>
          )}

          {/* SUCCESS DONE STATE */}
          {isSuccessDone ? (
            <div className="py-6 text-center space-y-4 animate-in zoom-in-95">
              <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto text-emerald-400 border border-emerald-500/30">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <p className="text-slate-300 text-sm">
                Sua senha foi redefinida com sucesso. Você será redirecionado para acessar sua conta.
              </p>
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-400" />
            </div>
          ) : mode === 'request' ? (
            /* STEP 1: REQUEST CODE */
            <form onSubmit={handleRequestReset} className="space-y-4 animate-in fade-in">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">
                  E-mail ou WhatsApp cadastrado
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    type="text"
                    value={emailOrPhone}
                    onChange={e => setEmailOrPhone(e.target.value)}
                    placeholder="Seu e-mail ou WhatsApp (com DDD)"
                    autoComplete="username"
                    required
                    className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white/10 transition-all font-medium"
                  />
                </div>
              </div>

              <div className="p-3.5 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 flex items-start gap-3 text-xs text-indigo-200">
                <MessageCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  Enviaremos uma mensagem segura no seu <strong>WhatsApp oficial</strong> com o link direto e o código de redefinição de 6 dígitos.
                </span>
              </div>

              <button
                type="submit"
                disabled={isLoading || !emailOrPhone.trim()}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold text-base transition-all shadow-xl shadow-indigo-900/50 flex items-center justify-center gap-2 group disabled:opacity-60 mt-2"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    Enviar Link no WhatsApp
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>
          ) : (
            /* STEP 2: ENTER CODE & NEW PASSWORD */
            <form onSubmit={handleResetPassword} className="space-y-4 animate-in fade-in">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between ml-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    E-mail ou WhatsApp
                  </label>
                  <button
                    type="button"
                    onClick={() => { setMode('request'); setError(''); setSuccessMessage(''); }}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-bold transition-colors"
                  >
                    Alterar
                  </button>
                </div>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    type="text"
                    value={emailOrPhone}
                    onChange={e => setEmailOrPhone(e.target.value)}
                    placeholder="Seu e-mail ou WhatsApp"
                    required
                    className="w-full pl-12 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-2xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white/10 transition-all font-medium text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between ml-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    Código do WhatsApp (6 dígitos)
                  </label>
                  <button
                    type="button"
                    onClick={handleRequestReset}
                    disabled={isLoading || !emailOrPhone.trim()}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-bold transition-colors disabled:opacity-50"
                  >
                    Reenviar código
                  </button>
                </div>
                <div className="relative">
                  <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    type="text"
                    value={code}
                    onChange={e => setCode(e.target.value)}
                    placeholder="••••••"
                    maxLength={6}
                    autoComplete="one-time-code"
                    required
                    className="w-full pl-12 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-2xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white/10 transition-all font-black text-center text-lg tracking-[0.25em]"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">
                  Nova Senha
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    autoComplete="new-password"
                    required
                    className="w-full pl-12 pr-12 py-3.5 bg-white/5 border border-white/10 rounded-2xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white/10 transition-all font-medium text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">
                  Confirmar Nova Senha
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Repita sua nova senha"
                    autoComplete="new-password"
                    required
                    className="w-full pl-12 pr-12 py-3.5 bg-white/5 border border-white/10 rounded-2xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white/10 transition-all font-medium text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || !code.trim() || !newPassword || !confirmPassword}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold text-base transition-all shadow-xl shadow-indigo-900/50 flex items-center justify-center gap-2 group disabled:opacity-60 mt-2"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    Salvar Nova Senha
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Footer Back to Login Link */}
          <div className="pt-2 text-center">
            <Link
              to="/login"
              className="text-xs text-slate-400 hover:text-indigo-300 font-bold transition-colors inline-flex items-center gap-1.5"
            >
              ← Voltar para a tela de login
            </Link>
          </div>
        </div>

        <p className="text-center text-slate-600 text-xs mt-6">
          © 2025 Tzion Terapias · Todos os direitos reservados
        </p>
      </div>
    </div>
  );
}
