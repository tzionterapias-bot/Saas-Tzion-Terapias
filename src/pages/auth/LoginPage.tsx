import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Heart, Lock, Mail, ArrowRight, Loader2, Chrome, Key, Phone } from 'lucide-react';
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
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [requestingCode, setRequestingCode] = useState(false);
  const navigate = useNavigate();
  const { login, loginWithCode, loginWithGoogle, user, loading } = useAuth();

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
            const destination = response.user?.role === 'paciente' ? '/portal' : '/admin';
            navigate(destination, { replace: true });
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
      navigate(user.role === 'paciente' ? '/portal' : '/admin', { replace: true });
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
        const destination = response.user?.role === 'paciente' ? '/portal' : '/admin';
        console.log("LoginPage: redirecting to:", destination);
        navigate(destination, { replace: true });
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
        const destination = response.user?.role === 'paciente' ? '/portal' : '/admin';
        navigate(destination, { replace: true });
      } else {
        setError(response.error || 'Código incorreto ou expirado. Tente novamente.');
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao processar login com código.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setSuccessMessage('');
    setIsGoogleLoading(true);
    const { success, error: gError } = await loginWithGoogle();
    if (!success) {
      setError(gError || 'Erro ao entrar com Google.');
      setIsGoogleLoading(false);
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

          {/* Google Button */}
          <button
            onClick={handleGoogle}
            disabled={isGoogleLoading || isLoading}
            className="w-full py-4 bg-white hover:bg-slate-100 text-slate-800 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all shadow-lg disabled:opacity-60 group"
          >
            {isGoogleLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continuar com Google
              </>
            )}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-slate-500 text-xs font-bold uppercase tracking-widest">ou</span>
            <div className="flex-1 h-px bg-white/10" />
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
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">E-mail</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="voce@email.com"
                    required
                    className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white/10 transition-all font-medium"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between ml-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Senha</label>
                  <button type="button" className="text-xs text-indigo-400 hover:text-indigo-300 font-bold transition-colors">
                    Esqueci a senha
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white/10 transition-all font-medium"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || isGoogleLoading}
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
                    required
                    className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white/10 transition-all font-black text-center text-lg tracking-[0.3em]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || isGoogleLoading || requestingCode}
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
