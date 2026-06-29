import React, { useState, useEffect } from 'react';
import { supabase } from '@/src/lib/supabase';
import { 
  LayoutDashboard, Users, Calendar, Banknote, MessageSquare, 
  BookOpen, Settings, LogOut, Heart, Headset, Menu, X, Bell, Search, User, Award,
  Sun, Moon, Shield, Megaphone, PieChart, Globe, Monitor, UserCog, Briefcase
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/src/lib/utils';
import { useAuth } from '@/src/contexts/AuthContext';
import { processDailyReminders, processDailyBirthdays } from '@/src/lib/reminders';
import MobilePatientList from './MobilePatientList';
import MobileDashboard from './MobileDashboard';
const menuCategories = [
  {
    title: 'Visão Geral',
    items: [
      { icon: LayoutDashboard, label: 'Dashboard', path: '/admin', roles: ['admin', 'terapeuta', 'atendimento', 'financeiro'] },
      { icon: PieChart, label: 'Relatórios', path: '/admin/relatorios', roles: ['admin', 'financeiro'] },
    ]
  },
  {
    title: 'Atendimento',
    items: [
      { icon: Calendar, label: 'Agendamentos', path: '/admin/agenda', roles: ['admin', 'terapeuta', 'atendimento'] },
      { icon: Users, label: 'Pacientes', path: '/admin/pacientes', roles: ['admin', 'atendimento', 'terapeuta'] },
      { icon: BookOpen, label: 'Registros de Sessão', path: '/admin/sessoes', roles: ['admin', 'terapeuta'] },
      { icon: Award, label: 'Portal do Terapeuta', path: '/admin/portal-terapeuta', roles: ['admin', 'terapeuta'] },
    ]
  },
  {
    title: 'Gestão & Vendas',
    items: [
      { icon: Banknote, label: 'Financeiro', path: '/admin/financeiro', roles: ['admin', 'financeiro', 'atendimento'] },
      { icon: Briefcase, label: 'Venda Rápida', path: '/admin/vendas', roles: ['admin', 'financeiro', 'atendimento'] },
      { icon: Headset, label: 'Central de Atendimento', path: '/admin/atendimento', roles: ['admin', 'atendimento'] },
      { icon: MessageSquare, label: 'CRM & Marketing', path: '/admin/crm', roles: ['admin', 'atendimento'] },
      { icon: Megaphone, label: 'Campanhas', path: '/admin/campanhas', roles: ['admin', 'atendimento'] },
    ]
  },
  {
    title: 'Sistema',
    items: [
      { icon: Settings, label: 'Configurações', path: '/admin/config', roles: ['admin'] },
      { icon: Globe, label: 'Editor do Site', path: '/admin/editor-site', roles: ['admin'] },
      { icon: UserCog, label: 'Terapeutas', path: '/admin/terapeutas', roles: ['admin'] },
      { icon: Shield, label: 'Gestão de Usuários', path: '/admin/usuarios', roles: ['admin'] },
    ]
  }
];

import InternalChat from './InternalChat';
import { useActiveSession } from '@/src/contexts/ActiveSessionContext';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { activeSession, setShowBlockModal } = useActiveSession();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [whiteLabel, setWhiteLabel] = useState<any>(() => {
    try {
      const cached = localStorage.getItem('white_label');
      if (cached) {
        const parsed = JSON.parse(cached);
        // Aplica as cores de marca nas variáveis CSS imediatamente para evitar flash de cor
        const root = document.documentElement;
        if (parsed.primaryColor) {
          root.style.setProperty('--color-indigo-600', parsed.primaryColor);
          root.style.setProperty('--color-indigo-700', `color-mix(in srgb, ${parsed.primaryColor} 85%, black)`);
          root.style.setProperty('--color-indigo-500', parsed.primaryColor);
        }
        if (parsed.secondaryColor) {
          root.style.setProperty('--color-indigo-50', parsed.secondaryColor);
          root.style.setProperty('--color-indigo-100', `color-mix(in srgb, ${parsed.secondaryColor} 70%, white)`);
        } else if (parsed.primaryColor) {
          root.style.setProperty('--color-indigo-50', `color-mix(in srgb, ${parsed.primaryColor} 10%, white)`);
          root.style.setProperty('--color-indigo-100', `color-mix(in srgb, ${parsed.primaryColor} 20%, white)`);
        }
        return parsed;
      }
    } catch (e) {
      console.error("Erro ao ler cache de white label:", e);
    }
    return null;
  });

  useEffect(() => {
    async function loadWhiteLabel() {
      const { data } = await supabase.from('settings').select('value').eq('key', 'white_label').maybeSingle();
      if (data && data.value) {
        const valueStr = JSON.stringify(data.value);
        const cachedStr = localStorage.getItem('white_label');
        
        if (valueStr !== cachedStr) {
          localStorage.setItem('white_label', valueStr);
          setWhiteLabel(data.value);
          
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
  
  // Header States
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [pendingTherapistsCount, setPendingTherapistsCount] = useState(0);
  
  // Fechar dropdowns ao clicar fora seria ideal, mas usaremos onBlur ou toggle simples por enquanto
  const toggleNotifications = () => {
      setIsNotificationsOpen(!isNotificationsOpen);
      setIsProfileOpen(false);
  };

  const toggleProfile = () => {
      setIsProfileOpen(!isProfileOpen);
      setIsNotificationsOpen(false);
  };

  const loadDynamicNotifications = async () => {
    try {
      const list: any[] = [];
      
      // 1. Buscar aniversariantes de hoje (BRT)
      const todayBRT = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(new Date());
      const [, currentMonth, currentDay] = todayBRT.split('-').map(Number);

      const { data: patients } = await supabase
        .from('patients')
        .select('id, name, birth_date')
        .eq('status', 'Ativo')
        .not('birth_date', 'is', null);

      if (patients) {
        patients.forEach(p => {
          if (!p.birth_date) return;
          const [, m, d] = p.birth_date.split('-').map(Number);
          if (m === currentMonth && d === currentDay) {
            list.push({
              id: `bday-${p.id}`,
              title: '🎈 Aniversário Hoje!',
              description: `Hoje é aniversário de ${p.name}. Parabéns enviado!`
            });
          }
        });
      }

      // 2. Buscar agendamentos de hoje para lembrete de sessão
      const { data: todayAppts } = await supabase
        .from('appointments')
        .select('id')
        .gte('start_time', `${todayBRT}T00:00:00`)
        .lte('start_time', `${todayBRT}T23:59:59`);
      
      const sessionsCount = todayAppts?.length || 0;
      if (sessionsCount > 0) {
        list.push({
          id: `sessions-today-${sessionsCount}`,
          title: 'Lembrete de Sessão',
          description: `Você tem ${sessionsCount} ${sessionsCount === 1 ? 'sessão programada' : 'sessões programadas'} para hoje.`
        });
      }

      // 3. Buscar leads pendentes
      const { count: pendingLeadsCount } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .neq('status', 'converted');

      if (pendingLeadsCount && pendingLeadsCount > 0) {
        list.push({
          id: `pending-leads-${pendingLeadsCount}`,
          title: 'CRM & Leads',
          description: `Existem ${pendingLeadsCount} leads aguardando contato no funil.`
        });
      }

      // 4. Buscar terapeutas pendentes
      const { count: pendingTherapists } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'terapeuta')
        .eq('status', 'pending');

      setPendingTherapistsCount(pendingTherapists || 0);

      if (pendingTherapists && pendingTherapists > 0) {
        list.push({
          id: `pending-therapists-${pendingTherapists}`,
          title: '⚠️ Terapeutas Pendentes',
          description: `Existe(m) ${pendingTherapists} cadastro(s) de terapeuta(s) aguardando aprovação.`
        });
      }

      // Filtrar notificações limpas salvas no localStorage
      let cleared: string[] = [];
      try {
        cleared = JSON.parse(localStorage.getItem('cleared_notifications') || '[]');
      } catch (e) {}
      
      const filteredList = list.filter(n => !cleared.includes(n.id));
      setNotifications(filteredList);
    } catch (err) {
      console.error('Erro ao carregar notificações:', err);
    }
  };

  const handleClearNotifications = () => {
    try {
      const cleared = JSON.parse(localStorage.getItem('cleared_notifications') || '[]');
      const currentIds = notifications.map(n => n.id);
      const newCleared = Array.from(new Set([...cleared, ...currentIds]));
      localStorage.setItem('cleared_notifications', JSON.stringify(newCleared));
    } catch (e) {
      console.error('Error saving cleared notifications:', e);
    }
    setNotifications([]);
  };

  useEffect(() => {
    if (!user) {
      navigate('/login');
    } else {
      // Quando o sistema carregar e o usuário estiver logado, dispara os lembretes diários e aniversários.
      processDailyReminders();
      processDailyBirthdays();
      loadDynamicNotifications();
    }
  }, [user, navigate]);

  const handleLogout = () => {
    if (activeSession) {
      setShowBlockModal(true);
      return;
    }
    logout();
    navigate('/login');
  };

  const allItems = menuCategories.flatMap(c => c.items);

  return (
    <div className="flex h-screen overflow-hidden bg-[#F8FAFC]">
      {/* Mobile Backdrop */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-slate-200 transition-transform duration-300 lg:translate-x-0 lg:static lg:block",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          <div className="p-8">
            <div className="flex items-center justify-between gap-4">
              <div className={cn("flex items-center", whiteLabel?.logoUrl ? "justify-center w-full" : "gap-3")}>
                {whiteLabel?.logoUrl ? (
                  <img src={whiteLabel.logoUrl} alt="Logo" className="max-h-12 max-w-full object-contain" />
                ) : (
                  <>
                    <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100 shrink-0">
                      <Heart className="w-6 h-6 text-white fill-white/20" />
                    </div>
                    <div className="min-w-0 flex-1">
                      {whiteLabel?.portalName ? (
                        <h2 className="font-black text-base text-slate-900 leading-tight break-words">
                          {whiteLabel.portalName}
                        </h2>
                      ) : (
                        <>
                          <h2 className="font-black text-xl text-slate-900 leading-none">TZION</h2>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">Terapias</p>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
              <button 
                className="lg:hidden p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-xl"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <nav className="flex-1 px-4 py-4 space-y-6 overflow-y-auto custom-scrollbar">
            {menuCategories.map((category, catIdx) => {
              const visibleItems = category.items.filter(item => 
                !item.roles || item.roles.includes(user?.role || '')
              );

              if (visibleItems.length === 0) return null;

              return (
                <div key={catIdx} className="space-y-1">
                  <h3 className="px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{category.title}</h3>
                  {visibleItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={(e) => {
                          setIsMobileMenuOpen(false);
                          if (activeSession && item.path !== '/admin/sessoes') {
                            e.preventDefault();
                            setShowBlockModal(true);
                          }
                        }}
                        className={cn(
                          "flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all group",
                          isActive 
                            ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" 
                            : "text-slate-500 hover:bg-slate-50 hover:text-indigo-600"
                        )}
                      >
                        <item.icon className={cn("w-5 h-5", isActive ? "text-white" : "text-slate-400 group-hover:text-indigo-600")} />
                        <span className="flex-1">{item.label}</span>
                        {item.path === '/admin/usuarios' && pendingTherapistsCount > 0 && (
                          <span className={cn(
                            "px-2 py-0.5 text-[10px] font-black rounded-full shrink-0 animate-pulse",
                            isActive ? "bg-white text-indigo-600" : "bg-rose-500 text-white"
                          )}>
                            {pendingTherapistsCount}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </nav>

          {/* Footer User Profile */}
          <div className="p-4 border-t border-slate-100">
            <div className="bg-slate-50 p-4 rounded-3xl flex items-center gap-3 border border-slate-100 mb-2">
              <div className="w-10 h-10 rounded-2xl bg-white border border-slate-200 flex items-center justify-center font-bold text-indigo-600 shadow-sm">
                {user?.name.charAt(0) || 'U'}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-bold text-slate-900 truncate">{user?.name || 'Usuário'}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{user?.role || 'Visitante'}</p>
              </div>
            </div>
            <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-3 w-full text-sm font-bold text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-2xl transition-all group">
              <LogOut className="w-5 h-5 text-slate-400 group-hover:text-rose-600" />
              Sair do Sistema
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-14 lg:h-20 bg-white border-b border-slate-200 px-4 lg:px-8 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <button 
              className="lg:hidden p-2 bg-slate-50 rounded-xl text-slate-600"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </button>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              {allItems.find(i => i.path === location.pathname)?.label || 'Bem-vindo'}
            </h1>
          </div>

          <div className="flex items-center gap-4 md:gap-6">
            
            {/* Search - Desktop Only */}
            <div className="hidden md:flex items-center relative">
              <div className="static flex items-center relative group w-auto bg-transparent shadow-none p-0 border-none z-50">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors z-10" />
                <input 
                  placeholder="Pesquisar pacientes..."
                  className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-transparent rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm w-64 font-medium"
                />
              </div>
            </div>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2.5 bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all flex items-center justify-center"
              title={theme === 'dark' ? 'Mudar para Modo Claro' : 'Mudar para Modo Escuro'}
            >
              {theme === 'dark' ? (
                <Sun className="w-6 h-6 text-amber-500 fill-amber-500/20" />
              ) : (
                <Moon className="w-6 h-6 text-slate-400 hover:text-indigo-600" />
              )}
            </button>

            {/* Notifications */}
            <div className="relative">
                <button 
                    onClick={toggleNotifications}
                    className={cn(
                        "relative p-2.5 rounded-xl transition-all",
                        isNotificationsOpen ? "bg-indigo-50 text-indigo-600" : "bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                    )}
                >
                    <Bell className="w-6 h-6" />
                    {notifications.length > 0 && (
                      <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-rose-500 border-2 border-white rounded-full animate-pulse" />
                    )}
                </button>
                
                {isNotificationsOpen && (
                    <div className="absolute right-0 top-14 w-80 bg-white rounded-[2rem] shadow-2xl border border-slate-100 p-6 z-50 animate-in fade-in slide-in-from-top-4 duration-200">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="font-black text-slate-900 flex items-center gap-2">
                                <Bell className="w-5 h-5 text-indigo-600" /> Notificações
                            </h4>
                            {notifications.length > 0 && (
                                <button 
                                    onClick={handleClearNotifications}
                                    className="text-xs font-bold text-slate-400 hover:text-indigo-600 transition-colors"
                                >
                                    Limpar
                                </button>
                            )}
                        </div>
                        <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                            {notifications.length === 0 ? (
                                <p className="text-sm text-slate-400 font-medium text-center py-4">Nenhuma notificação no momento.</p>
                            ) : (
                                notifications.map(notif => (
                                    <div key={notif.id} className="p-4 bg-slate-50 rounded-2xl">
                                        <p className="text-sm font-bold text-slate-700">{notif.title}</p>
                                        <p className="text-xs text-slate-500 mt-1">{notif.description}</p>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>

            <div className="hidden sm:block w-px h-8 bg-slate-200" />

            {/* Profile Dropdown */}
            <div className="relative">
                <div 
                    onClick={toggleProfile}
                    className="flex items-center gap-3 cursor-pointer group"
                >
                    <div className="text-right hidden sm:block">
                        <p className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{user?.name || 'Clínica Tzion'}</p>
                        <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest flex items-center justify-end gap-1">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> Online
                        </p>
                    </div>
                    <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm">
                        {user?.name?.charAt(0) || <User className="w-6 h-6" />}
                    </div>
                </div>

                {isProfileOpen && (
                    <div className="absolute right-0 top-14 w-56 bg-white rounded-[1.5rem] shadow-2xl border border-slate-100 p-2 z-50 animate-in fade-in slide-in-from-top-4 duration-200">
                        <div className="p-4 border-b border-slate-100 mb-2 sm:hidden">
                            <p className="font-bold text-slate-900">{user?.name}</p>
                            <p className="text-xs text-slate-500">{user?.role}</p>
                        </div>
                        <button className="w-full text-left px-4 py-3 text-sm font-bold text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors flex items-center gap-2">
                            <User className="w-4 h-4" /> Meu Perfil
                        </button>
                        <button className="w-full text-left px-4 py-3 text-sm font-bold text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors flex items-center gap-2">
                            <Settings className="w-4 h-4" /> Configurações
                        </button>
                        <div className="h-px bg-slate-100 my-2" />
                        <button 
                            onClick={handleLogout}
                            className="w-full text-left px-4 py-3 text-sm font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors flex items-center gap-2"
                        >
                            <LogOut className="w-4 h-4" /> Sair do Sistema
                        </button>
                    </div>
                )}
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className={cn(
          "flex-1 min-h-0",
          ['/admin/editor-site', '/admin/atendimento'].includes(location.pathname)
            ? "overflow-hidden flex flex-col"
            : "overflow-y-auto p-4 lg:p-8 xl:p-12"
        )}>
          {(() => {
            // Rotas com versão mobile simplificada
            const mobileViews: Record<string, React.ReactNode> = {
              '/admin': <MobileDashboard />,
              '/admin/pacientes': <MobilePatientList />,
            };

            // Rotas bloqueadas em mobile (sem versão mobile)
            const desktopOnlyPaths = [
              '/admin/relatorios',
              '/admin/insumos',
              '/admin/usuarios',
              '/admin/config',
              '/admin/financeiro',
              '/admin/crm',
              '/admin/campanhas',
              '/admin/editor-site',
            ];

            const mobileView = mobileViews[location.pathname];
            const isDesktopOnly = desktopOnlyPaths.includes(location.pathname);

            // Rota com versão mobile dedicada
            if (mobileView) {
              return (
                <>
                  {/* Mobile: versão simplificada */}
                  <div className="lg:hidden h-full">{mobileView}</div>
                  {/* Desktop: versão completa */}
                  <div className="hidden lg:block h-full">{children}</div>
                </>
              );
            }

            // Rota bloqueada em mobile
            if (isDesktopOnly) {
              return (
                <>
                  <div className="lg:hidden flex flex-col items-center justify-center py-20 px-6 text-center bg-white rounded-[2rem] border border-slate-100 shadow-sm space-y-6 mx-auto my-10 max-w-sm">
                    <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center shadow-inner border border-slate-100 shrink-0">
                      <Monitor className="w-8 h-8 text-indigo-600" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-xl font-bold text-slate-900 tracking-tight">Disponível apenas no PC</h3>
                      <p className="text-xs text-slate-500 font-medium leading-relaxed">
                        Esta ferramenta administrativa foi otimizada para telas grandes e não está disponível em celulares ou tablets. Por favor, acesse pelo computador.
                      </p>
                    </div>
                  </div>
                  <div className="hidden lg:block h-full">{children}</div>
                </>
              );
            }

            // Demais rotas: render normal (agenda, sessoes, portal-terapeuta, etc.)
            return children;
          })()}
        </div>
      </main>

      {/* Global Internal Chat */}
      <InternalChat />
    </div>
  );
}
