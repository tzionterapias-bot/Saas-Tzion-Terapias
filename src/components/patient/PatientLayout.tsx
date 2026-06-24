import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Calendar, CreditCard, LogOut, Heart, Key, Eye, EyeOff, Loader2, CheckCircle2, Sun, Moon, Menu, X } from 'lucide-react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { cn } from '@/src/lib/utils';
import { useAuth } from '@/src/contexts/AuthContext';
import { supabase } from '@/src/lib/supabase';

const menuCategories = [
  {
    title: 'Minha Área',
    items: [
      { icon: LayoutDashboard, label: 'Meu Resumo', path: '/portal' },
      { icon: Calendar, label: 'Minhas Sessões', path: '/portal/sessoes' },
    ]
  },
  {
    title: 'Financeiro',
    items: [
      { icon: CreditCard, label: 'Pagamentos & NF', path: '/portal/financeiro' },
    ]
  }
];

export default function PatientLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [whiteLabel, setWhiteLabel] = useState<any>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    async function loadWhiteLabel() {
      const { data } = await supabase.from('settings').select('value').eq('key', 'white_label').maybeSingle();
      if (data && data.value) {
        setWhiteLabel(data.value);
        
        // Apply brand colors to CSS variables for system-wide Tailwind overrides
        const root = document.documentElement;
        if (data.value.primaryColor) {
          root.style.setProperty('--color-indigo-600', data.value.primaryColor);
          root.style.setProperty('--color-indigo-700', `color-mix(in srgb, ${data.value.primaryColor} 85%, black)`);
          root.style.setProperty('--color-indigo-500', data.value.primaryColor);
        }
        if (data.value.secondaryColor) {
          root.style.setProperty('--color-indigo-50', data.value.secondaryColor);
          root.style.setProperty('--color-indigo-100', `color-mix(in srgb, ${data.value.secondaryColor} 70%, white)`);
        } else if (data.value.primaryColor) {
          root.style.setProperty('--color-indigo-50', `color-mix(in srgb, ${data.value.primaryColor} 10%, white)`);
          root.style.setProperty('--color-indigo-100', `color-mix(in srgb, ${data.value.primaryColor} 20%, white)`);
        }
      }
    }
    loadWhiteLabel();
  }, []);

  // Theme State
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'light';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  // Password Update States
  const forceChangePassword = user?.status === 'temp_password';
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState(false);
  const [updatingPwd, setUpdatingPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfPwd, setShowConfPwd] = useState(false);

  const handleLogout = async () => {
    if (confirm('Deseja realmente sair do portal?')) {
      await logout();
      navigate('/login');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError('');
    
    if (newPassword.length < 6) {
      setPwdError('A senha deve conter no mínimo 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdError('As senhas não coincidem.');
      return;
    }
    
    setUpdatingPwd(true);
    try {
      // 1. Atualizar senha no Supabase Auth
      const { error: authError } = await supabase.auth.updateUser({ password: newPassword });
      if (authError) throw authError;

      // 2. Atualizar status na tabela profiles
      if (user?.id) {
        const { error: dbError } = await supabase
          .from('profiles')
          .update({ status: 'active', updated_at: new Date().toISOString() })
          .eq('id', user.id);
          
        if (dbError) throw dbError;
        
        // Atualiza estado local
        user.status = 'active';
      }
      
      setPwdSuccess(true);
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      console.error("Erro ao alterar senha:", err);
      setPwdError(err.message || 'Erro ao atualizar a senha.');
    } finally {
      setUpdatingPwd(false);
    }
  };

  const initials = user?.name 
    ? user.name.trim().split(' ').map(n => n.charAt(0)).join('').toUpperCase().slice(0, 2) 
    : 'P';

  return (
    <div className="flex min-h-screen bg-indigo-50/30 overflow-hidden">
      {/* Mobile Backdrop */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-indigo-100 transition-transform duration-300 md:translate-x-0 md:static md:h-screen md:flex flex-col justify-between",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="p-8 pb-6">
            <div className="flex items-center justify-between gap-2">
              <div className={cn("flex items-center", whiteLabel?.logoUrl ? "justify-center w-full" : "gap-2 font-bold text-xl")} style={{ color: whiteLabel?.primaryColor || '#4f46e5' }}>
                {whiteLabel?.logoUrl ? (
                   <img src={whiteLabel.logoUrl} alt="Logo" className="max-h-12 max-w-full object-contain" />
                ) : (
                   <>
                     <Heart className="w-8 h-8" style={{ fill: whiteLabel?.primaryColor || '#4f46e5' }} />
                     <span>{whiteLabel?.portalName || 'TZION'}</span>
                   </>
                )}
              </div>
              <button 
                className="md:hidden p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-xl"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <X className="w-5 h-5" style={{ color: whiteLabel?.primaryColor || '#4f46e5' }} />
              </button>
            </div>
            {!whiteLabel?.logoUrl && (
              <p className="text-[10px] font-bold uppercase tracking-widest mt-1 text-center" style={{ color: whiteLabel?.primaryColor || '#4f46e5', opacity: 0.7 }}>Portal do Paciente</p>
            )}
          </div>

          <nav className="px-4 space-y-6 flex-1 overflow-y-auto">
            {menuCategories.map((category, catIdx) => (
              <div key={catIdx} className="space-y-1">
                <h3 className="px-5 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 mt-4">{category.title}</h3>
                {category.items.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-5 py-4 rounded-2xl text-sm font-bold transition-all group",
                        isActive 
                          ? "text-white shadow-lg" 
                          : "text-slate-600 hover:bg-slate-50 hover:text-indigo-600"
                      )}
                      style={isActive ? { backgroundColor: whiteLabel?.primaryColor || '#4f46e5', boxShadow: `0 10px 15px -3px ${whiteLabel?.primaryColor || '#4f46e5'}40` } : {}}
                    >
                      <item.icon className={cn("w-5 h-5", isActive ? "text-white" : "text-slate-400 group-hover:text-indigo-600")} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>

        <div className="p-4 pb-8 border-t border-slate-50">
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 px-5 py-4 w-full text-sm font-bold text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-2xl transition-all active:scale-95"
          >
            <LogOut className="w-5 h-5" />
            Sair do Portal
          </button>
        </div>
      </aside>


      {/* Main Content */}
      <main className="flex-1 max-w-[1200px] mx-auto p-6 md:p-12 space-y-10 w-full overflow-y-auto h-screen">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button 
              className="md:hidden p-2.5 bg-white rounded-xl text-slate-600 shadow-sm border border-indigo-50 flex items-center justify-center shrink-0"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu className="w-5 h-5" style={{ color: whiteLabel?.primaryColor || '#4f46e5' }} />
            </button>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 leading-tight">Olá, {user?.name || 'Paciente'}!</h2>
              <p className="text-slate-500 font-medium text-sm hidden sm:block">Bem-vindo à sua área de saúde integrada.</p>
            </div>
          </div>
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            <button
              onClick={toggleTheme}
              className="p-3 bg-white text-slate-400 hover:text-indigo-600 rounded-2xl shadow-sm border border-indigo-50 transition-all flex items-center justify-center cursor-pointer"
              title={theme === 'dark' ? 'Mudar para Modo Claro' : 'Mudar para Modo Escuro'}
            >
              {theme === 'dark' ? (
                <Sun className="w-6 h-6 text-amber-500 fill-amber-500/20" />
              ) : (
                <Moon className="w-6 h-6 text-slate-400" />
              )}
            </button>
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center text-white font-bold text-lg sm:text-xl shadow-xl shrink-0" style={{ backgroundColor: whiteLabel?.primaryColor || '#4f46e5', boxShadow: `0 10px 15px -3px ${whiteLabel?.primaryColor || '#4f46e5'}40` }}>
              {initials}
            </div>
          </div>
        </header>

        <div>
          {children}
        </div>
      </main>

      {/* Modal Obrigatório de Alteração de Senha Provisória */}
      {forceChangePassword && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[999] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl overflow-hidden border border-slate-100 p-8 space-y-6 animate-in zoom-in-95 duration-500">
            <div className="text-center space-y-3">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-50 rounded-2xl text-indigo-600 shadow-sm">
                <Key className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Alterar Senha Provisória</h3>
              <p className="text-slate-500 font-medium text-sm leading-relaxed">
                Você está acessando a conta com uma senha provisória. Cadastre uma nova senha pessoal para a segurança de seus dados clínicos.
              </p>
            </div>

            {pwdError && (
              <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-xs font-bold text-center">
                {pwdError}
              </div>
            )}

            {pwdSuccess ? (
              <div className="p-6 bg-emerald-50 border border-emerald-100 rounded-3xl text-emerald-700 text-sm font-bold text-center flex flex-col items-center gap-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                Senha atualizada com sucesso! Redirecionando...
              </div>
            ) : (
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Nova Senha</label>
                  <div className="relative">
                    <input
                      type={showNewPwd ? "text" : "password"}
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Mínimo de 6 caracteres"
                      required
                      className="w-full pl-5 pr-12 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all font-bold"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPwd(!showNewPwd)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showNewPwd ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Confirmar Nova Senha</label>
                  <div className="relative">
                    <input
                      type={showConfPwd ? "text" : "password"}
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="Repita a nova senha"
                      required
                      className="w-full pl-5 pr-12 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all font-bold"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfPwd(!showConfPwd)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showConfPwd ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={updatingPwd}
                  className="w-full py-4 text-white rounded-2xl font-bold transition-all shadow-xl flex items-center justify-center gap-2 disabled:opacity-60 mt-4"
                  style={{ backgroundColor: whiteLabel?.primaryColor || '#4f46e5', boxShadow: `0 10px 15px -3px ${whiteLabel?.primaryColor || '#4f46e5'}40` }}
                >
                  {updatingPwd ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    'Salvar Nova Senha'
                  )}
                </button>
                
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-bold text-xs transition-colors"
                >
                  Sair do Portal
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
