import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Heart, Lock, Mail, ArrowRight, Loader2, User, Stethoscope, Phone, BookOpen, CheckCircle2, ChevronLeft } from 'lucide-react';
import { useAuth } from '@/src/contexts/AuthContext';
import { cn } from '@/src/lib/utils';

type Role = 'paciente' | 'terapeuta';
type Step = 'choose' | 'form' | 'success';

export default function RegisterPage() {
  const [step, setStep] = useState<Step>('choose');
  const [role, setRole] = useState<Role>('paciente');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { register, loginWithGoogle } = useAuth();

  React.useEffect(() => {
    document.title = "Criar Conta | Tzion Terapias";
    let metaDescription = document.querySelector('meta[name="description"]');
    if (!metaDescription) {
      metaDescription = document.createElement('meta');
      metaDescription.setAttribute('name', 'description');
      document.head.appendChild(metaDescription);
    }
    metaDescription.setAttribute('content', 'Cadastre-se na Tzion Terapias como paciente ou terapeuta para ter acesso aos nossos recursos exclusivos e agendamento online.');
  }, []);

  const handleSelectRole = (r: Role) => {
    setRole(r);
    setStep('form');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }
    if (password.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres.');
      return;
    }
    setIsLoading(true);
    const { success, error: regError } = await register({ name, email, password, phone, role, specialty });
    if (success) {
      setStep('success');
    } else {
      setError(regError || 'Erro ao criar conta. Tente novamente.');
    }
    setIsLoading(false);
  };

  const handleGoogle = async () => {
    await loginWithGoogle();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-violet-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-5%] w-80 h-80 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full relative z-10">
        <div className="bg-white/5 backdrop-blur-xl rounded-[2.5rem] border border-white/10 p-10 shadow-2xl">

          {/* ── STEP 1: ESCOLHA O PERFIL ── */}
          {step === 'choose' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-3 duration-300">
              <div className="text-center space-y-3">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-500/20 rounded-2xl border border-indigo-500/30 mb-2">
                  <Heart className="w-8 h-8 text-indigo-400 fill-indigo-400/30" />
                </div>
                <h1 className="text-3xl font-black text-white tracking-tight">Criar Conta</h1>
                <p className="text-slate-400 font-medium">Como você vai usar a plataforma?</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => handleSelectRole('paciente')}
                  className="group p-6 bg-white/5 hover:bg-indigo-600/20 border border-white/10 hover:border-indigo-500/40 rounded-3xl flex flex-col items-center gap-4 transition-all hover:scale-105"
                >
                  <div className="w-14 h-14 bg-indigo-500/20 group-hover:bg-indigo-500/30 rounded-2xl flex items-center justify-center transition-all">
                    <User className="w-7 h-7 text-indigo-400" />
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-white text-sm">Sou Paciente</p>
                    <p className="text-slate-400 text-[11px] mt-0.5">Acompanhe suas sessões</p>
                  </div>
                </button>

                <button
                  onClick={() => handleSelectRole('terapeuta')}
                  className="group p-6 bg-white/5 hover:bg-violet-600/20 border border-white/10 hover:border-violet-500/40 rounded-3xl flex flex-col items-center gap-4 transition-all hover:scale-105"
                >
                  <div className="w-14 h-14 bg-violet-500/20 group-hover:bg-violet-500/30 rounded-2xl flex items-center justify-center transition-all">
                    <Stethoscope className="w-7 h-7 text-violet-400" />
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-white text-sm">Sou Terapeuta</p>
                    <p className="text-slate-400 text-[11px] mt-0.5">Gerencie sua agenda</p>
                  </div>
                </button>
              </div>

              {/* Google */}
              <div>
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex-1 h-px bg-white/10" />
                  <span className="text-slate-500 text-xs font-bold uppercase tracking-widest">ou</span>
                  <div className="flex-1 h-px bg-white/10" />
                </div>
                <button
                  onClick={handleGoogle}
                  className="w-full py-4 bg-white hover:bg-slate-100 text-slate-800 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all shadow-lg"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Cadastrar com Google
                </button>
              </div>

              <p className="text-center text-slate-400 text-sm">
                Já tem conta?{' '}
                <Link to="/login" className="text-indigo-400 hover:text-indigo-300 font-bold transition-colors">
                  Entrar
                </Link>
              </p>
            </div>
          )}

          {/* ── STEP 2: FORMULÁRIO ── */}
          {step === 'form' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-3 duration-300">
              <div className="flex items-center gap-3">
                <button onClick={() => setStep('choose')} className="p-2 hover:bg-white/10 rounded-xl transition-colors text-slate-400">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div>
                  <h2 className="text-2xl font-black text-white">
                    {role === 'paciente' ? '👤 Cadastro de Paciente' : '🩺 Cadastro de Terapeuta'}
                  </h2>
                  {role === 'terapeuta' && (
                    <p className="text-amber-400 text-xs font-bold mt-0.5">⚠️ Aguardará aprovação do administrador</p>
                  )}
                </div>
              </div>

              {error && (
                <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm font-bold text-center">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Nome */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Nome Completo</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                    <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Seu nome completo" required
                      className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium" />
                  </div>
                </div>

                {/* Email */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">E-mail</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="voce@email.com" required
                      className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium" />
                  </div>
                </div>

                {/* Telefone */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Telefone / WhatsApp</label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                    <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(11) 99999-9999"
                      className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium" />
                  </div>
                </div>

                {/* Especialidade (somente terapeuta) */}
                {role === 'terapeuta' && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Especialidade</label>
                    <div className="relative">
                      <BookOpen className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                      <input type="text" value={specialty} onChange={e => setSpecialty(e.target.value)} placeholder="Ex: Psicanálise Clínica, TCC..." required
                        className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium" />
                    </div>
                  </div>
                )}

                {/* Senha */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Senha</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" required
                      className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium" />
                  </div>
                </div>

                {/* Confirmar senha */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Confirmar Senha</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                    <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repita a senha" required
                      className={cn(
                        "w-full pl-12 pr-4 py-4 bg-white/5 border rounded-2xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 transition-all font-medium",
                        confirmPassword && password !== confirmPassword
                          ? "border-rose-500/40 focus:ring-rose-500"
                          : "border-white/10 focus:ring-indigo-500"
                      )} />
                  </div>
                </div>

                <button type="submit" disabled={isLoading}
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold text-base transition-all shadow-xl shadow-indigo-900/50 flex items-center justify-center gap-2 group disabled:opacity-60 mt-2"
                >
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>
                    Criar Conta <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </>}
                </button>
              </form>
            </div>
          )}

          {/* ── STEP 3: SUCESSO ── */}
          {step === 'success' && (
            <div className="text-center space-y-6 py-4 animate-in fade-in zoom-in duration-300">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-emerald-500/20 rounded-full border border-emerald-500/30">
                <CheckCircle2 className="w-10 h-10 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-white">Conta Criada! 🎉</h2>
                {role === 'terapeuta' ? (
                  <p className="text-slate-400 mt-2 leading-relaxed">
                    Seu cadastro foi enviado para análise. O administrador irá aprovar o seu acesso em breve. Você receberá uma notificação.
                  </p>
                ) : (
                  <p className="text-slate-400 mt-2 leading-relaxed">
                    Verifique seu e-mail para confirmar a conta e depois acesse o portal do paciente.
                  </p>
                )}
              </div>
              <button
                onClick={() => navigate('/login')}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold transition-all"
              >
                Ir para o Login
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-slate-600 text-xs mt-6">
          © 2025 Tzion Terapias · Todos os direitos reservados
        </p>
      </div>
    </div>
  );
}
