import React from 'react';
import { useAuth } from '@/src/contexts/AuthContext';
import { Navigate } from 'react-router-dom';

import AdminView from '@/src/components/dashboard/views/AdminView';
import TherapistView from '@/src/components/dashboard/views/TherapistView';
import ReceptionView from '@/src/components/dashboard/views/ReceptionView';
import FinancialView from '@/src/components/dashboard/views/FinancialView';

export default function AdminDashboard() {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Renderiza a visão específica baseada no papel (role) do usuário
  switch (user.role) {
    case 'admin':
      return <AdminView />;
    case 'terapeuta':
      return <TherapistView />;
    case 'atendimento':
      return <ReceptionView />;
    case 'financeiro':
      return <FinancialView />;
    default:
      // Fallback genérico ou para pacientes que não deveriam estar aqui
      return <Navigate to="/portal" replace />;
  }
}
