import React from 'react';
import { LayoutDashboard, Users, Calendar, Banknote, MessageSquare, BookOpen, Settings, LogOut, Heart } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/src/lib/utils';

const sidebarItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/admin' },
  { icon: Calendar, label: 'Agendamentos', path: '/admin/agenda' },
  { icon: Users, label: 'Pacientes', path: '/admin/pacientes' },
  { icon: Banknote, label: 'Financeiro', path: '/admin/financeiro' },
  { icon: MessageSquare, label: 'CRM & Marketing', path: '/admin/crm' },
  { icon: BookOpen, label: 'Atendimentos', path: '/admin/sessoes' },
  { icon: Settings, label: 'Configurações', path: '/admin/config' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 sticky top-0 h-screen overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center gap-2 font-bold text-xl text-indigo-600">
            <Heart className="w-8 h-8 fill-indigo-600" />
            <span>TZION</span>
          </div>
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mt-1">Terapias</p>
        </div>

        <nav className="px-3 space-y-1">
          {sidebarItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                  isActive 
                    ? "bg-indigo-50 text-indigo-600" 
                    : "text-slate-600 hover:bg-slate-50 hover:text-indigo-600"
                )}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 w-full p-4 border-t border-slate-100">
          <button className="flex items-center gap-3 px-4 py-3 w-full text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors">
            <LogOut className="w-5 h-5" />
            Sair
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1">
        <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between sticky top-0 z-10">
          <h1 className="text-lg font-semibold text-slate-800">
            {sidebarItems.find(i => i.path === location.pathname)?.label || 'Bem-vindo'}
          </h1>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-slate-900">Administrador</p>
              <p className="text-xs text-slate-500">Clínica Tzion</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700 font-bold">
              AD
            </div>
          </div>
        </header>

        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
