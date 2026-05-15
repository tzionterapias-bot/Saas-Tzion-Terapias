import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import AdminLayout from '@/src/components/dashboard/AdminLayout';
import InstitutionalSite from '@/src/pages/site/InstitutionalSite';
import LoginPage from '@/src/pages/auth/LoginPage';
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
import CRMPage from '@/src/pages/admin/CRMPage';
import ConfigPage from '@/src/pages/admin/ConfigPage';
import { cn } from '@/src/lib/utils';
import { Calendar as CalendarIcon, Clock, User, CheckCircle2, AlertCircle, ArrowUpRight, TrendingUp, Users, DollarSign, Wallet, Cake, FileText, Plus, PlayCircle } from 'lucide-react';

// App Component

export default function App() {
  return (
    <Router>
      <Routes>
        {/* Auth */}
        <Route path="/login" element={<LoginPage />} />

        {/* Institutional Site */}
        <Route path="/" element={<InstitutionalSite />} />
        
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
        <Route path="/portal" element={<PatientLayout><PatientDashboard /></PatientLayout>} />
        <Route path="/portal/sessoes" element={<PatientLayout><PatientSessionsPage /></PatientLayout>} />
        <Route path="/portal/financeiro" element={<PatientLayout><PatientFinancialPage /></PatientLayout>} />

        {/* Admin Dashboard */}
        <Route path="/admin" element={<AdminLayout><AdminDashboard /></AdminLayout>} />
        <Route path="/admin/agenda" element={<AdminLayout><AgendaManager /></AdminLayout>} />
        <Route path="/admin/pacientes" element={<AdminLayout><PatientList /></AdminLayout>} />
        <Route path="/admin/financeiro" element={<AdminLayout><FinancialPage /></AdminLayout>} />
        <Route path="/admin/relatorios" element={<AdminLayout><ReportsPage /></AdminLayout>} />
        <Route path="/admin/insumos" element={<AdminLayout><SuppliesPage /></AdminLayout>} />
        <Route path="/admin/crm" element={<AdminLayout><CRMPage /></AdminLayout>} />
        <Route path="/admin/sessoes" element={<AdminLayout><SessionLogger /></AdminLayout>} />
        <Route path="/admin/config" element={<AdminLayout><ConfigPage /></AdminLayout>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
