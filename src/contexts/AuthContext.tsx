import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/src/lib/supabase';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'terapeuta' | 'atendimento' | 'financeiro' | 'paciente';
  status?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; user?: User }>;
  loginWithCode: (emailOrPhone: string, code: string) => Promise<{ success: boolean; error?: string; user?: User }>;
  loginWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  register: (data: RegisterData) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  updateUserProfile: (data: Partial<User>) => void;
}

interface RegisterData {
  name: string;
  email: string;
  password: string;
  phone?: string;
  role: 'paciente' | 'terapeuta';
  specialty?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (authUserId: string, email?: string): Promise<User | null> => {
    console.log("AuthContext: loadProfile start for id:", authUserId, "email:", email);

    const isKnownAdmin = email === 'tzionterapias@gmail.com' || email === 'admin@tzion.com.br';

    try {
      const queryPromise = supabase
        .from('profiles')
        .select('*')
        .eq('id', authUserId)
        .maybeSingle();

      const timeoutPromise = new Promise<{ data: any; error: any; timeout: boolean }>((resolve) =>
        setTimeout(() => resolve({ data: null, error: null, timeout: true }), 8000)
      );

      const res = await Promise.race([queryPromise, timeoutPromise]) as any;
      
      if (res?.timeout) {
        console.warn("AuthContext: loadProfile query timed out after 8s for user", authUserId);
      }

      const data = res?.data;

      if (data) {
        return {
          id: data.id,
          name: data.name || email?.split('@')[0] || 'Usuário',
          email: data.email || email || '',
          role: (data.role || 'admin') as User['role'],
          status: data.status,
        };
      }
    } catch (err: any) {
      console.error("AuthContext: loadProfile query error", err);
    }

    if (isKnownAdmin) {
      return { id: authUserId, name: 'Administrador Tzion', email: email!, role: 'admin' };
    }

    return null;
  };

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (cancelled) return;

        if (session?.user) {
          const profile = await loadProfile(session.user.id, session.user.email ?? undefined);
          if (!cancelled) {
            if (profile) {
              setUser(profile);
            } else {
              const meta = session.user.user_metadata || {};
              setUser({
                id: session.user.id,
                name: meta.name || session.user.email?.split('@')[0] || 'Usuário',
                email: session.user.email || '',
                role: (meta.role as any) || 'admin',
                status: 'active'
              });
            }
          }
        } else {
          // Fallback para sistema legado (localStorage)
          const saved = localStorage.getItem('@tzion:user');
          if (saved && !cancelled) {
            try { setUser(JSON.parse(saved)); } catch {}
          }
        }
      } catch (err) {
        console.error('Auth init error:', err);
        try {
          const saved = localStorage.getItem('@tzion:user');
          if (saved && !cancelled) setUser(JSON.parse(saved));
        } catch {}
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    init();

    // Listener de mudanças de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const profile = await loadProfile(session.user.id, session.user.email ?? undefined);
        const meta = session.user.user_metadata || {};
        const finalUser: User = profile || {
          id: session.user.id,
          name: meta.name || session.user.email?.split('@')[0] || 'Usuário',
          email: session.user.email || '',
          role: (meta.role as any) || 'admin',
          status: 'active'
        };
        setUser(finalUser);
        setLoading(false);
        localStorage.removeItem('@tzion:user');
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setLoading(false);
        localStorage.removeItem('@tzion:user');
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (rawEmail: string, rawPassword: string) => {
    const input = (rawEmail || '').trim();
    const password = (rawPassword || '').trim();
    console.log("AuthContext: login start for input:", input);

    try {
      let targetEmail = input.toLowerCase();

      // 1. Se o usuário digitou telefone no lugar do e-mail, buscar o e-mail correspondente
      if (!input.includes('@')) {
        const cleanPhone = input.replace(/\D/g, '');
        if (cleanPhone) {
          const { data: foundProfile } = await supabase
            .from('profiles')
            .select('email')
            .or(`phone.eq.${cleanPhone},phone.eq.55${cleanPhone}`)
            .maybeSingle();

          if (foundProfile?.email) {
            targetEmail = foundProfile.email.toLowerCase();
          } else {
            const { data: foundPatient } = await supabase
              .from('patients')
              .select('email')
              .or(`phone.eq.${cleanPhone},phone.eq.55${cleanPhone}`)
              .maybeSingle();

            if (foundPatient?.email) {
              targetEmail = foundPatient.email.toLowerCase();
            }
          }
        }
      }

      // 2. Tentar Supabase Auth
      console.log("AuthContext: calling signInWithPassword for targetEmail:", targetEmail);
      const { data, error } = await supabase.auth.signInWithPassword({ email: targetEmail, password });

      if (!error && data.user) {
        const profile = await loadProfile(data.user.id, targetEmail);
        if (profile) {
          setUser(profile);
          return { success: true, user: profile };
        }
      }

      // 3. Fallback inteligente: Se o paciente existe e a senha for a senha provisória padrão do sistema
      const { data: patientProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', targetEmail)
        .maybeSingle();

      const { data: patientRow } = await supabase
        .from('patients')
        .select('*')
        .eq('email', targetEmail)
        .maybeSingle();

      const candidateObj = patientProfile || patientRow;

      if (candidateObj) {
        const phoneDigits = (candidateObj.phone || '').replace(/\D/g, '');
        const lastFour = phoneDigits.slice(-4);
        const expectedTempPwd1 = lastFour.length === 4 ? `Tzion@${lastFour}` : 'Tzion@123';
        const expectedTempPwd2 = lastFour.length === 4 ? `tzion@${lastFour}` : 'tzion@123';

        // Se a senha informada for a senha provisória padrão
        if (password === expectedTempPwd1 || password === expectedTempPwd2 || password === 'Tzion@123' || password === 'tzion@123') {
          const loggedUser: User = {
            id: candidateObj.id,
            name: candidateObj.name || targetEmail,
            email: targetEmail,
            role: 'paciente',
            status: candidateObj.status || 'temp_password'
          };
          setUser(loggedUser);
          localStorage.setItem('@tzion:user', JSON.stringify(loggedUser));
          console.log("AuthContext: login success via patient temp password fallback");
          return { success: true, user: loggedUser };
        }
      }

      // 4. Fallback: system_users (sistema legado)
      const { data: sysUser } = await supabase
        .from('system_users')
        .select('*')
        .eq('email', targetEmail)
        .eq('password_hash', password)
        .maybeSingle();

      if (sysUser) {
        const loggedUser: User = { id: sysUser.id, name: sysUser.name, email: sysUser.email, role: sysUser.role };
        setUser(loggedUser);
        localStorage.setItem('@tzion:user', JSON.stringify(loggedUser));
        return { success: true, user: loggedUser };
      }

      // 5. Fallback demo admin
      if ((targetEmail === 'admin@tzion.com.br' || targetEmail === 'tzionterapias@gmail.com') && password === 'admin123') {
        const mockUser: User = { id: 'mock-admin', name: 'Administrador', email: targetEmail, role: 'admin' };
        setUser(mockUser);
        localStorage.setItem('@tzion:user', JSON.stringify(mockUser));
        return { success: true, user: mockUser };
      }

      console.log("AuthContext: login failed, credentials invalid");
      return { success: false, error: error?.message || 'Credenciais inválidas. Verifique seu e-mail/WhatsApp e senha.' };
    } catch (e: any) {
      console.error("AuthContext: login caught exception", e);
      return { success: false, error: e.message || 'Erro inesperado.' };
    }
  };

  const loginWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/admin`,
        },
      });
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  };

  const register = async ({ name, email, password, phone, role, specialty }: RegisterData) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name, role, specialty: specialty || '', phone: phone || '' },
        },
      });

      if (error) return { success: false, error: error.message };
      if (!data.user) return { success: false, error: 'Erro ao criar usuário.' };

      // Upsert profile manually to guarantee it exists
      await supabase.from('profiles').upsert({
        id: data.user.id,
        name,
        email,
        role,
        specialty: specialty || null,
        phone: phone || null,
        status: role === 'terapeuta' ? 'pending' : 'active',
      });

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  };

  const loginWithCode = async (emailOrPhone: string, code: string) => {
    console.log("AuthContext: loginWithCode start for", emailOrPhone, "code:", code);
    try {
      const cleanPhone = emailOrPhone.replace(/\D/g, "");
      
      let query = supabase.from('profiles').select('*');
      if (emailOrPhone.includes('@')) {
        query = query.eq('email', emailOrPhone.trim());
      } else {
        const phoneVariants = [emailOrPhone.trim(), cleanPhone];
        if (cleanPhone.startsWith('55')) {
          phoneVariants.push(cleanPhone.substring(2));
        } else {
          phoneVariants.push(`55${cleanPhone}`);
        }
        query = query.or(`phone.in.(${phoneVariants.map(p => `"${p}"`).join(',')})`);
      }

      const { data: profile, error: fetchError } = await query.maybeSingle();
      if (fetchError || !profile) {
        return { success: false, error: 'Usuário não encontrado com estes dados.' };
      }

      if (!profile.whatsapp_login_code || profile.whatsapp_login_code !== code.trim()) {
        return { success: false, error: 'Código de acesso incorreto.' };
      }

      const expiry = new Date(profile.whatsapp_login_code_expires_at);
      if (expiry.getTime() < Date.now()) {
        return { success: false, error: 'Código de acesso expirado. Solicite outro.' };
      }

      // Limpar o código para segurança
      await supabase
        .from('profiles')
        .update({
          whatsapp_login_code: null,
          whatsapp_login_code_expires_at: null
        })
        .eq('id', profile.id);

      const loggedUser: User = { 
        id: profile.id, 
        name: profile.name || profile.email, 
        email: profile.email, 
        role: profile.role as User['role'],
        status: profile.status
      };
      
      setUser(loggedUser);
      localStorage.setItem('@tzion:user', JSON.stringify(loggedUser));
      console.log("AuthContext: loginWithCode success");
      return { success: true, user: loggedUser };

    } catch (e: any) {
      console.error("AuthContext: loginWithCode caught exception", e);
      return { success: false, error: e.message || 'Erro inesperado.' };
    }
  };

  const updateUserProfile = (data: Partial<User>) => {
    if (!user) return;
    const updated = { ...user, ...data };
    setUser(updated);
    localStorage.setItem('@tzion:user', JSON.stringify(updated));
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    localStorage.removeItem('@tzion:user');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, loginWithCode, loginWithGoogle, register, logout, updateUserProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
