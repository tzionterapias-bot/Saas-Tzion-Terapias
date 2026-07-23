import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Heart, Lock, Mail, ArrowRight, Loader2, Key, Phone } from 'lucide-react';
import { useAuth } from '@/src/contexts/AuthContext';
import { cn } from '@/src/lib/utils';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginMethod, setLoginMethod] = useState<'password' | 'code'>('password');
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [requestingCode, setRequestingCode] = useState(false);
  const navigate = useNavigate();
  const { login, loginWithCode, user, loading } = useAuth();

  useEffect(() => {
    document.title = "Acessar Portal | Tzion Terapias";
    let metaDescription = document.querySelector('meta[name="description"]');
    if (!metaDescription) {
      metaDescription = document.createElement('meta');
      metaDescription.setAttribute('name', 'description');
      document.head.appendChild(metaDescription);
    }
    metaDescription.setAttribute('content', 'Entre no portal do paciente e do terapeuta da Tzion Terapias para gerenciar suas consultas, sessões e prontuários de forma segura.');
  }, []);

  const getDestination = (role?: string) => {
    if (role === 'paciente') return '/portal';
    if (role === 'terapeuta') return '/admin/portal-terapeuta';
    return '/admin';
  };

  // Auto-login if email and code parameters are present in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const emailParam = params.get('email');
    const codeParam = params.get('code');
    if (emailParam && codeParam) {
      const autoLogin = async () => {
        setIsLoading(true);
        setError('');
        try {
          const response = await loginWithCode(emailParam, codeParam);
          if (response.success) {
            navigate(getDestination(response.user?.role), { replace: true });
          } else {
            setError(response.error || 'Código de acesso inválido ou expirado.');
          }
        } catch (err: any) {
          setError(err.message || 'Erro ao processar login automático.');
        } finally {
          setIsLoading(false);
        }
      };
      autoLogin();
    }
  }, [navigate, loginWithCode]);

  useEffect(() => {
    if (!loading && user) {
      navigate(getDestination(user.role), { replace: true });
    }
  }, [user, loading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("LoginPage: handleLogin start with email:", email);
    setError('');
    setSuccessMessage('');
    setIsLoading(true);
    try {
      const response = await login(email, password);
      console.log("LoginPage: login response received:", response);
      if (response.success) {
        navigate(getDestination(response.user?.role), { replace: true });
      } else {
        setError(response.error || 'Credenciais inválidas. Verifique e tente novamente.');
      }
    } catch (err: any) {
      console.error("LoginPage: handleLogin caught error:", err);
      setError(err.message || 'Erro ao processar login.');
    } finally {
      console.log("LoginPage: setting isLoading to false");
      setIsLoading(false);
    }
  };

  const handleRequestCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!emailOrPhone.trim()) {
      setError('Por favor, informe seu E-mail ou WhatsApp primeiro.');
      return;
    }
    setError('');
    setSuccessMessage('');
    setRequestingCode(true);
    try {
      const response = await fetch('/api/auth/request-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ emailOrPhone })
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setSuccessMessage('Código de acesso enviado com sucesso para o seu WhatsApp! Verifique seu aparelho.');
        setCodeSent(true);
      } else {
        setError(data.error || 'Erro ao enviar código. Certifique-se de usar os dados cadastrados.');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Erro ao solicitar código de acesso.');
    } finally {
      setRequestingCode(false);
    }
  };

  const handleLoginWithCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setIsLoading(true);
    try {
      const response = await loginWithCode(emailOrPhone, code);
      if (response.success) {
        navigate(getDestination(response.user?.role), { replace: true });
      } else {
        setError(response.error || 'Código incorreto ou expirado. Tente novamente.');
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao processar login com código.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute top-[-10%] left-[-5%] w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-5%] w-80 h-80 bg-violet-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full relative z-10">
        {/* Card */}
        <div className="bg-white/5 backdrop-blur-xl rounded-[2.5rem] border border-white/10 p-10 shadow-2xl space-y-6">
          {/* Logo */}
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-500/20 rounded-2xl border border-indigo-500/30 mb-2">
              <Heart className="w-8 h-8 text-indigo-400 fill-indigo-400/30" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-white tracking-tight">Bem-vindo de volta</h1>
              <p className="text-slate-400 font-medium mt-1">Acesse a plataforma Tzion Terapias</p>
            </div>
          </div>

          {/* Method Selector */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-white/5 rounded-2xl border border-white/10">
            <button
              type="button"
              onClick={() => { setLoginMethod('password'); setError(''); setSuccessMessage(''); setCodeSent(false); }}
              className={cn(
                "py-2.5 rounded-xl text-xs font-bold transition-all",
                loginMethod === 'password'
                  ? "bg-white text-slate-900 shadow"
                  : "text-slate-400 hover:text-white"
              )}
            >
              Entrar com Senha
            </button>
            <button
              type="button"
              onClick={() => { setLoginMethod('code'); setError(''); setSuccessMessage(''); setCodeSent(false); }}
              className={cn(
                "py-2.5 rounded-xl text-xs font-bold transition-all",
                loginMethod === 'code'
                  ? "bg-white text-slate-900 shadow"
                  : "text-slate-400 hover:text-white"
              )}
            >
              Entrar sem Senha
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm font-bold text-center animate-in fade-in">
              {error}
            </div>
          )}

          {/* Success */}
          {successMessage && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm font-bold text-center animate-in fade-in">
              {successMessage}
            </div>
          )}

          {/* Form */}
          {loginMethod === 'password' ? (
            <form onSubmit={handleLogin} className="space-y-4 animate-in fade-in">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">E-mail ou WhatsApp</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    type="text"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="Seu E-mail ou WhatsApp (ex: 63984861923)"
                    autoComplete="username"
                    required
                    className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white/10 transition-all font-medium"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between ml-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Senha</label>
                  <button 
                    type="button" 
                    onClick={() => { setLoginMethod('code'); setEmailOrPhone(email); setError(''); setSuccessMessage(''); }}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-bold transition-colors"
                  >
                    Receber código no WhatsApp
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                    className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white/10 transition-all font-medium"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold text-base transition-all shadow-xl shadow-indigo-900/50 flex items-center justify-center gap-2 group disabled:opacity-60 mt-2"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>Entrar <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" /></>
                )}
              </button>
            </form>
          ) : !codeSent ? (
            <form onSubmit={handleRequestCode} className="space-y-4 animate-in fade-in">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">E-mail ou WhatsApp</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    type="text"
                    value={emailOrPhone}
                    onChange={e => setEmailOrPhone(e.target.value)}
                    placeholder="voce@email.com ou (11) 99999-9999"
                    autoComplete="username"
                    required
                    className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white/10 transition-all font-medium"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={requestingCode || !emailOrPhone.trim()}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold text-base transition-all shadow-xl shadow-indigo-900/50 flex items-center justify-center gap-2 group disabled:opacity-60 mt-2"
              >
                {requestingCode ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>Enviar Código de Acesso <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" /></>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleLoginWithCode} className="space-y-4 animate-in fade-in">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between ml-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">E-mail ou WhatsApp</label>
                  <button
                    type="button"
                    onClick={() => { setCodeSent(false); setError(''); setSuccessMessage(''); }}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-bold transition-colors"
                  >
                    Alterar dados
                  </button>
                </div>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500/50" />
                  <input
                    type="text"
                    value={emailOrPhone}
                    disabled
                    className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/5 rounded-2xl text-slate-400 cursor-not-allowed font-medium"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between ml-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Código de Acesso (6 dígitos)</label>
                  <button
                    type="button"
                    onClick={() => handleRequestCode()}
                    disabled={requestingCode}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-bold transition-colors disabled:opacity-50"
                  >
                    {requestingCode ? 'Enviando...' : 'Reenviar código'}
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
                    className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white/10 transition-all font-black text-center text-lg tracking-[0.3em]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || requestingCode}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold text-base transition-all shadow-xl shadow-indigo-900/50 flex items-center justify-center gap-2 group disabled:opacity-60 mt-2"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>Confirmar e Entrar <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" /></>
                )}
              </button>
            </form>
          )}

          {/* Register Link */}
          <p className="text-center text-slate-400 text-sm">
            Não tem uma conta?{' '}
            <Link to="/cadastro" className="text-indigo-400 hover:text-indigo-300 font-bold transition-colors">
              Cadastre-se gratuitamente
            </Link>
          </p>
        </div>

        <p className="text-center text-slate-600 text-xs mt-6">
          © 2025 Tzion Terapias · Todos os direitos reservados
        </p>
      </div>
    </div>
  );
}
