import React from 'react';
import { LayoutDashboard, Calendar, FileText, CreditCard, LogOut, Heart } from 'lucide-react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { cn } from '@/src/lib/utils';

const sidebarItems = [
  { icon: LayoutDashboard, label: 'Meu Resumo', path: '/portal' },
  { icon: Calendar, label: 'Minhas Sessões', path: '/portal/sessoes' },
  { icon: CreditCard, label: 'Pagamentos & NF', path: '/portal/financeiro' },
];

export default function PatientLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    if (confirm('Deseja realmente sair do portal?')) {
      navigate('/');
    }
  };

  return (
    <div className="flex min-h-screen bg-indigo-50/30">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-indigo-100 sticky top-0 h-screen hidden md:block">
        <div className="p-8 pb-12">
          <div className="flex items-center gap-2 font-bold text-xl text-indigo-600">
            <Heart className="w-8 h-8 fill-indigo-600" />
            <span>TZION</span>
          </div>
          <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest mt-1">Portal do Paciente</p>
        </div>

        <nav className="px-4 space-y-2">
          {sidebarItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-5 py-4 rounded-2xl text-sm font-bold transition-all",
                  isActive 
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" 
                    : "text-slate-600 hover:bg-indigo-50 hover:text-indigo-600"
                )}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-8 w-full px-4">
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
      <main className="flex-1 max-w-5xl mx-auto p-6 md:p-12 space-y-10">
        <header className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Olá, João Oliveira!</h2>
            <p className="text-slate-500 font-medium">Bem-vindo à sua área de saúde integrada.</p>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-bold text-xl shadow-xl shadow-indigo-100">
            JO
          </div>
        </header>

        <div>
          {children}
        </div>
      </main>
    </div>
  );
}
