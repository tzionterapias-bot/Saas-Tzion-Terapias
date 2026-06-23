import React, { createContext, useContext, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight } from 'lucide-react';

export interface ActiveSession {
  id: string;
  patientId: string;
  patient: string;
  time: string;
  type: string;
  therapy: string;
  therapistId: string;
  therapist: string;
  startTime: number;
}

interface ActiveSessionContextType {
  activeSession: ActiveSession | null;
  startActiveSession: (sessionData: Omit<ActiveSession, 'startTime'>) => void;
  clearActiveSession: () => void;
  showBlockModal: boolean;
  setShowBlockModal: (show: boolean) => void;
}

const ActiveSessionContext = createContext<ActiveSessionContextType | undefined>(undefined);

export const ActiveSessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Load from sessionStorage on mount
  useEffect(() => {
    const saved = sessionStorage.getItem('@tzion:active-session');
    if (saved) {
      try {
        setActiveSession(JSON.parse(saved));
      } catch (e) {
        console.error('Erro ao ler active-session do sessionStorage:', e);
      }
    }
  }, []);

  // Block route changes when there is an active session
  useEffect(() => {
    if (activeSession && location.pathname !== '/admin/sessoes') {
      // Force user to stay on the session page
      navigate('/admin/sessoes', { replace: true });
      setShowBlockModal(true);
    }
  }, [location.pathname, activeSession, navigate]);

  // Block page close or reload
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (activeSession) {
        e.preventDefault();
        e.returnValue = ''; // Required for standard browsers
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [activeSession]);

  const startActiveSession = (sessionData: Omit<ActiveSession, 'startTime'>) => {
    const session: ActiveSession = {
      ...sessionData,
      startTime: Date.now(),
    };
    setActiveSession(session);
    sessionStorage.setItem('@tzion:active-session', JSON.stringify(session));
  };

  const clearActiveSession = () => {
    setActiveSession(null);
    sessionStorage.removeItem('@tzion:active-session');
    sessionStorage.removeItem('@tzion:session-logger:notes');
    sessionStorage.removeItem('@tzion:session-logger:guidance');
  };

  return (
    <ActiveSessionContext.Provider
      value={{
        activeSession,
        startActiveSession,
        clearActiveSession,
        showBlockModal,
        setShowBlockModal,
      }}
    >
      {children}

      {/* Premium Lock Modal */}
      {showBlockModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl p-8 border border-slate-100 relative text-center space-y-6 animate-in zoom-in-95 duration-300">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-500 shadow-sm animate-bounce">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight">Atendimento em Andamento!</h3>
              <p className="text-slate-500 text-sm leading-relaxed">
                Você tem uma sessão ativa com o paciente <strong className="text-slate-800">{activeSession?.patient}</strong>.
                Para navegar para outras abas ou sair do sistema, você deve primeiro finalizar e encerrar a sessão atual.
              </p>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setShowBlockModal(false)}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 transition-all active:scale-95 text-sm"
              >
                Voltar ao Atendimento <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </ActiveSessionContext.Provider>
  );
};

export const useActiveSession = () => {
  const context = useContext(ActiveSessionContext);
  if (context === undefined) {
    throw new Error('useActiveSession must be used within an ActiveSessionProvider');
  }
  return context;
};
