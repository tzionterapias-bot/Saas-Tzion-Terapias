import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/src/contexts/AuthContext';
import { ShieldAlert } from 'lucide-react';

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: Array<'admin' | 'terapeuta' | 'atendimento' | 'financeiro' | 'paciente'>;
}

export default function RoleGuard({ children, allowedRoles }: RoleGuardProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  }

  // Se não estiver logado, manda pro login salvando a rota atual para redirecionar depois
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // O Admin tem acesso supremo a tudo (exceto portal do paciente que é outra interface)
  if (user.role === 'admin' && !location.pathname.startsWith('/portal')) {
    return <>{children}</>;
  }

  // Verifica se a role do usuário está na lista de roles permitidas
  if (!allowedRoles.includes(user.role)) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white p-10 rounded-[2rem] shadow-xl border border-rose-100 text-center space-y-4">
          <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldAlert className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-black text-slate-900">Acesso Negado</h2>
          <p className="text-slate-500 font-medium pb-6">
            Você não tem permissão para acessar esta área do sistema. Nível de acesso exigido não compatível com o seu cargo ({user.role}).
          </p>
          <button 
            onClick={() => window.history.back()}
            className="w-full py-4 bg-slate-100 text-slate-700 hover:bg-slate-200 font-bold rounded-xl transition-colors"
          >
            Voltar para página anterior
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
