import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { AuthProvider } from '@/src/contexts/AuthContext';
import { ActiveSessionProvider } from '@/src/contexts/ActiveSessionContext';
import RoleGuard from '@/src/components/auth/RoleGuard';
import AdminLayout from '@/src/components/dashboard/AdminLayout';
import InstitutionalSite from '@/src/pages/site/InstitutionalSite';
import PrivacyPolicy from '@/src/pages/site/PrivacyPolicy';
import TermsOfUse from '@/src/pages/site/TermsOfUse';
import NpsFeedbackPage from '@/src/pages/public/NpsFeedbackPage';
import TicketNpsPage from '@/src/pages/public/TicketNpsPage';
import PublicContractPage from '@/src/pages/public/PublicContractPage';
import PublicAnamnesisPage from '@/src/pages/public/PublicAnamnesisPage';
import LoginPage from '@/src/pages/auth/LoginPage';
import RegisterPage from '@/src/pages/auth/RegisterPage';
import ResetPasswordPage from '@/src/pages/auth/ResetPasswordPage';
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
import QuickSellPage from '@/src/pages/admin/QuickSellPage';
import TherapistPage from '@/src/pages/admin/TherapistPage';
import UsersManager from '@/src/pages/admin/UsersManager';
import TherapistsManagementPage from '@/src/pages/admin/TherapistsManagementPage';
import ServicesPage from '@/src/pages/admin/ServicesPage';
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

import { useDebugConsole } from '@/src/hooks/useDebugConsole';

import KnowledgeBaseManager from '@/src/components/admin/KnowledgeBaseManager';

// App Component

export default function App() {
  useDebugConsole();
  return (
    <AuthProvider>
      <Router>
        <ActiveSessionProvider>
          <NPSDaemon />
          <Routes>
          {/* Auth */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/cadastro" element={<RegisterPage />} />
          <Route path="/recuperar-senha" element={<ResetPasswordPage />} />
          <Route path="/redefinir-senha" element={<ResetPasswordPage />} />

          {/* Institutional Site */}
          <Route path="/" element={<InstitutionalSite />} />
          <Route path="/politica-de-privacidade" element={<PrivacyPolicy />} />
          <Route path="/termos-de-uso" element={<TermsOfUse />} />
          
          {/* Avaliação NPS (Pública) */}
          <Route path="/avaliacao/:id" element={<NpsFeedbackPage />} />
          <Route path="/avaliacao-atendimento/:id" element={<TicketNpsPage />} />
          
          {/* Contrato (Pública) */}
          <Route path="/contrato/:id" element={<PublicContractPage />} />
          
          {/* Anamnese (Pública) */}
          <Route path="/anamnese/:token" element={<PublicAnamnesisPage />} />
          
          {/* Booking Interface -> Redireciona diretamente para o WhatsApp */}
          <Route path="/agenda" element={
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center">
              <div className="bg-white p-10 rounded-3xl shadow-xl max-w-md space-y-6 border border-slate-100">
                <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto text-emerald-600">
                  <span className="text-3xl">💬</span>
                </div>
                <h2 className="text-2xl font-bold text-slate-900">Agendamento via WhatsApp</h2>
                <p className="text-slate-600 text-sm">Clique no botão abaixo para conversar diretamente com a nossa equipe no WhatsApp e agendar a sua consulta.</p>
                <a
                  href={`https://wa.me/5563992530004?text=${encodeURIComponent('Olá! Gostaria de agendar uma consulta na Tzion Terapias.')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block w-full py-4 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
                >
                  Agendar pelo WhatsApp
                </a>
                <div>
                  <Link to="/" className="text-xs text-slate-400 hover:text-slate-600 font-medium">← Voltar ao site principal</Link>
                </div>
              </div>
            </div>
          } />
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
          <Route path="/admin/vendas" element={<RoleGuard allowedRoles={['admin', 'financeiro', 'atendimento']}><AdminLayout><QuickSellPage /></AdminLayout></RoleGuard>} />
          <Route path="/admin/crm" element={<RoleGuard allowedRoles={['admin', 'atendimento']}><AdminLayout><CRMPage /></AdminLayout></RoleGuard>} />
          <Route path="/admin/campanhas" element={<RoleGuard allowedRoles={['admin', 'atendimento']}><AdminLayout><CampaignsPage /></AdminLayout></RoleGuard>} />
          <Route path="/admin/base-conhecimento" element={<RoleGuard allowedRoles={['admin', 'atendimento']}><AdminLayout><KnowledgeBaseManager /></AdminLayout></RoleGuard>} />
          <Route path="/admin/sessoes" element={<RoleGuard allowedRoles={['admin', 'terapeuta']}><AdminLayout><SessionLogger /></AdminLayout></RoleGuard>} />
          <Route path="/admin/config" element={<RoleGuard allowedRoles={['admin']}><AdminLayout><ConfigPage /></AdminLayout></RoleGuard>} />
          <Route path="/admin/servicos" element={<RoleGuard allowedRoles={['admin', 'financeiro']} allowedEmails={['formacaoterapia@gmail.com']}><AdminLayout><ServicesPage /></AdminLayout></RoleGuard>} />
          <Route path="/admin/portal-terapeuta" element={<RoleGuard allowedRoles={['admin', 'terapeuta']}><AdminLayout><TherapistPage /></AdminLayout></RoleGuard>} />
          <Route path="/admin/usuarios" element={<RoleGuard allowedRoles={['admin']}><AdminLayout><UsersManager /></AdminLayout></RoleGuard>} />
          <Route path="/admin/terapeutas" element={<RoleGuard allowedRoles={['admin']}><AdminLayout><TherapistsManagementPage /></AdminLayout></RoleGuard>} />
          <Route path="/admin/gamificacao" element={<RoleGuard allowedRoles={['admin', 'financeiro', 'terapeuta']}><AdminLayout><GamificationView /></AdminLayout></RoleGuard>} />
          <Route path="/admin/editor-site" element={<RoleGuard allowedRoles={['admin']}><AdminLayout><SiteEditorPage /></AdminLayout></RoleGuard>} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </ActiveSessionProvider>
      </Router>
    </AuthProvider>
  );
}
