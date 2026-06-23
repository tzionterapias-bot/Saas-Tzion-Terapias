import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { AuthProvider } from '@/src/contexts/AuthContext';
import { ActiveSessionProvider } from '@/src/contexts/ActiveSessionContext';
import RoleGuard from '@/src/components/auth/RoleGuard';
import AdminLayout from '@/src/components/dashboard/AdminLayout';
import InstitutionalSite from '@/src/pages/site/InstitutionalSite';
import NpsFeedbackPage from '@/src/pages/public/NpsFeedbackPage';
import PublicContractPage from '@/src/pages/public/PublicContractPage';
import PublicAnamnesisPage from '@/src/pages/public/PublicAnamnesisPage';
import LoginPage from '@/src/pages/auth/LoginPage';
import RegisterPage from '@/src/pages/auth/RegisterPage';
import PatientList from '@/src/components/dashboard/PatientList';
import FinancialDashboard from '@/src/components/dashboard/FinancialDashboard';
import SessionLogger from '@/src/components/dashboard/SessionLogger';
import GamificationView from '@/src/components/dashboard/GamificationView';
import PayrollManager from '@/src/components/dashboard/PayrollManager';
import AgendaManager from '@/src/components/dashboard/AgendaManager';
import PatientLayout from '@/src/components/patient/PatientLayout';
import PatientDashboard from '@/src/pages/patient/PatientDashboard';
import PatientSessionsPage from '@/src/pages/patient/PatientSessionsPage';
import PatientFinancialPage from '@/src/pages/patient/PatientFinancialPage';
import AdminDashboard from '@/src/pages/admin/AdminDashboard';
import ReportsPage from '@/src/pages/admin/ReportsPage';
import SuppliesPage from '@/src/pages/admin/SuppliesPage';
import FinancialPage from '@/src/pages/admin/FinancialPage';
import CampaignsPage from '@/src/pages/admin/CampaignsPage';
import CRMPage from '@/src/pages/admin/CRMPage';
import ConfigPage from '@/src/pages/admin/ConfigPage';
import ServiceCenterPage from '@/src/pages/admin/ServiceCenterPage';
import TherapistPage from '@/src/pages/admin/TherapistPage';
import UsersManager from '@/src/pages/admin/UsersManager';
import WifiCaptivePortal from '@/src/components/crm/WifiCaptivePortal';
import SiteEditorPage from '@/src/pages/admin/SiteEditorPage';
import { cn } from '@/src/lib/utils';
import { Calendar as CalendarIcon, Clock, User, CheckCircle2, AlertCircle, ArrowUpRight, TrendingUp, Users, DollarSign, Wallet, Cake, FileText, Plus, PlayCircle } from 'lucide-react';
import { useNPSPoller } from '@/src/hooks/useNPSPoller';

// Componente invisível para rodar o polling do NPS
function NPSDaemon() {
  // useNPSPoller(); // Desativado no frontend — agora executado pelo backend server.ts
  return null;
}

// App Component

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <ActiveSessionProvider>
          <NPSDaemon />
          <Routes>
          {/* Auth */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/cadastro" element={<RegisterPage />} />

          {/* Institutional Site */}
          <Route path="/" element={<InstitutionalSite />} />
          
          {/* Avaliação NPS (Pública) */}
          <Route path="/avaliacao/:id" element={<NpsFeedbackPage />} />
          
          {/* Contrato (Pública) */}
          <Route path="/contrato/:id" element={<PublicContractPage />} />
          
          {/* Anamnese (Pública) */}
          <Route path="/anamnese/:token" element={<PublicAnamnesisPage />} />
          
          {/* Booking Interface */}
          <Route path="/agenda" element={<div className="min-h-screen bg-slate-50 p-6 lg:p-20">
            <div className="max-w-4xl mx-auto space-y-8">
              <Link to="/" className="text-indigo-600 font-bold flex items-center gap-2">← Voltar ao Site</Link>
              <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100">
                <div className="bg-indigo-600 p-10 text-white">
                  <h1 className="text-3xl font-bold">Agendamento Online</h1>
                  <p className="opacity-90 mt-2">Escolha o profissional e o horário ideal para você.</p>
                </div>
                <div className="p-10 grid grid-cols-1 md:grid-cols-3 gap-10">
                  <div className="col-span-2 space-y-6">
                    <h3 className="font-bold text-xl flex items-center gap-2"><User className="w-5 h-5" /> 1. Escolha o Profissional</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {[
                        { name: 'Dra. Ana Silva', role: 'Psicóloga Clínica' },
                        { name: 'Dr. Roberto Costa', role: 'Terapeuta de Casal' }
                      ].map((p, i) => (
                        <button key={i} className="p-4 border-2 border-slate-100 rounded-2xl hover:border-indigo-600 text-left transition-all group">
                          <p className="font-bold group-hover:text-indigo-600">{p.name}</p>
                          <p className="text-sm text-slate-500">{p.role}</p>
                        </button>
                      ))}
                    </div>

                    <h3 className="font-bold text-xl flex items-center gap-2 pt-4"><CalendarIcon className="w-5 h-5" /> 2. Data e Horário</h3>
                    <div className="p-10 text-center border-2 border-dashed border-slate-200 rounded-3xl text-sm text-slate-400">
                      Calendário interativo será carregado aqui
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-2xl p-6 h-fit space-y-6 border border-slate-200">
                    <h3 className="font-bold text-lg">Resumo do Agendamento</h3>
                    <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">Total</p>
                    <p className="text-3xl font-bold text-slate-900">R$ 150,00</p>
                    <div className="space-y-3 pt-4 border-t border-slate-200">
                      <div className="flex items-center gap-2 text-sm text-slate-600"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Link Google Meet incluso</div>
                      <div className="flex items-center gap-2 text-sm text-slate-600"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Confirmação via WhatsApp</div>
                    </div>
                    <button disabled className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold opacity-50 cursor-not-allowed">Finalizar Reserva</button>
                  </div>
                </div>
              </div>
            </div>
          </div>} />
          <Route path="/portal" element={<RoleGuard allowedRoles={['paciente']}><PatientLayout><PatientDashboard /></PatientLayout></RoleGuard>} />
          <Route path="/portal/sessoes" element={<RoleGuard allowedRoles={['paciente']}><PatientLayout><PatientSessionsPage /></PatientLayout></RoleGuard>} />
          <Route path="/portal/financeiro" element={<RoleGuard allowedRoles={['paciente']}><PatientLayout><PatientFinancialPage /></PatientLayout></RoleGuard>} />
          <Route path="/wifi" element={<WifiCaptivePortal />} />

          {/* Admin Dashboard */}
          <Route path="/admin" element={<RoleGuard allowedRoles={['admin', 'terapeuta', 'atendimento', 'financeiro']}><AdminLayout><AdminDashboard /></AdminLayout></RoleGuard>} />
          <Route path="/admin/agenda" element={<RoleGuard allowedRoles={['admin', 'terapeuta', 'atendimento']}><AdminLayout><AgendaManager /></AdminLayout></RoleGuard>} />
          <Route path="/admin/pacientes" element={<RoleGuard allowedRoles={['admin', 'atendimento', 'terapeuta']}><AdminLayout><PatientList /></AdminLayout></RoleGuard>} />
          <Route path="/admin/financeiro" element={<RoleGuard allowedRoles={['admin', 'financeiro', 'atendimento']}><AdminLayout><FinancialPage /></AdminLayout></RoleGuard>} />
          <Route path="/admin/relatorios" element={<RoleGuard allowedRoles={['admin', 'financeiro']}><AdminLayout><ReportsPage /></AdminLayout></RoleGuard>} />
          <Route path="/admin/insumos" element={<RoleGuard allowedRoles={['admin', 'atendimento']}><AdminLayout><SuppliesPage /></AdminLayout></RoleGuard>} />
          <Route path="/admin/atendimento" element={<RoleGuard allowedRoles={['admin', 'atendimento']}><AdminLayout><ServiceCenterPage /></AdminLayout></RoleGuard>} />
          <Route path="/admin/crm" element={<RoleGuard allowedRoles={['admin', 'atendimento']}><AdminLayout><CRMPage /></AdminLayout></RoleGuard>} />
          <Route path="/admin/campanhas" element={<RoleGuard allowedRoles={['admin', 'atendimento']}><AdminLayout><CampaignsPage /></AdminLayout></RoleGuard>} />
          <Route path="/admin/sessoes" element={<RoleGuard allowedRoles={['admin', 'terapeuta']}><AdminLayout><SessionLogger /></AdminLayout></RoleGuard>} />
          <Route path="/admin/config" element={<RoleGuard allowedRoles={['admin']}><AdminLayout><ConfigPage /></AdminLayout></RoleGuard>} />
          <Route path="/admin/portal-terapeuta" element={<RoleGuard allowedRoles={['admin', 'terapeuta']}><AdminLayout><TherapistPage /></AdminLayout></RoleGuard>} />
          <Route path="/admin/usuarios" element={<RoleGuard allowedRoles={['admin']}><AdminLayout><UsersManager /></AdminLayout></RoleGuard>} />
          <Route path="/admin/editor-site" element={<RoleGuard allowedRoles={['admin']}><AdminLayout><SiteEditorPage /></AdminLayout></RoleGuard>} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </ActiveSessionProvider>
      </Router>
    </AuthProvider>
  );
}
