import React, { useState, useEffect } from 'react';
import { MoreVertical, MessageSquare, Phone, Calendar, User, Plus, Loader2, Zap, ChevronRight, MapPin, X } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { supabase } from '@/src/lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { sendWhatsAppMessage } from '@/src/lib/whatsapp';

interface Lead {
  id: string;
  name: string;
  phone: string;
  lastContact: string;
  status: string;
  tags: string[];
}

const columns = [
  { id: 'new', title: 'Novos Leads', color: 'bg-blue-500' },
  { id: 'contacted', title: 'Em Atendimento', color: 'bg-amber-500' },
  { id: 'scheduled', title: 'Agendado', color: 'bg-indigo-500' },
  { id: 'completed', title: 'Convertido/Alta', color: 'bg-emerald-500' },
];

export default function KanbanBoard() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [convertingLead, setConvertingLead] = useState<Lead | null>(null);
  const [patientData, setPatientData] = useState({ email: '', cpf: '', cep: '', address: '', address_number: '', neighborhood: '', city: '', state: '' });

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;

      const formatted: Lead[] = (data || []).map(l => ({
        id: l.id,
        name: l.name,
        phone: l.phone || '',
        status: l.status || 'new',
        tags: l.tags || [],
        lastContact: new Date(l.updated_at).toLocaleDateString('pt-BR')
      }));

      setLeads(formatted);
    } catch (error) {
      console.error('Erro ao buscar leads:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateLeadStatus = async (leadId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('leads')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', leadId);

      if (error) throw error;
      fetchLeads();
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
    }
  };

  const startConversion = (lead: Lead) => {
    setConvertingLead(lead);
    setPatientData({ email: '', cpf: '', cep: '', address: '', address_number: '', neighborhood: '', city: '', state: '' });
  };

  const confirmConversion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!convertingLead) return;

    try {
      // 1. Gerar senha padrão baseada no celular ou fallback
      const digits = convertingLead.phone.replace(/\D/g, '');
      const lastFour = digits.slice(-4);
      const tempPassword = lastFour.length === 4 ? `Tzion@${lastFour}` : 'Tzion@123';

      // 2. Criar cliente Supabase temporário sem persistência de sessão para não deslogar o admin
      const tempSupabase = createClient(
        import.meta.env.VITE_SUPABASE_URL || '',
        import.meta.env.VITE_SUPABASE_ANON_KEY || '',
        { auth: { persistSession: false } }
      );

      // 3. Cadastrar usuário no Supabase Auth
      const { data: signUpData, error: signUpError } = await tempSupabase.auth.signUp({
        email: patientData.email,
        password: tempPassword,
        options: {
          data: {
            name: convertingLead.name,
            role: 'paciente',
            phone: convertingLead.phone
          }
        }
      });

      if (signUpError) {
        alert(`Erro de cadastro Auth: ${signUpError.message}`);
        return;
      }

      const userId = signUpData.user?.id;
      if (!userId) {
        alert("Erro ao gerar conta do paciente.");
        return;
      }

      // 4. Criar perfil na tabela profiles
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: userId,
        name: convertingLead.name,
        email: patientData.email,
        role: 'paciente',
        phone: convertingLead.phone,
        status: 'temp_password',
        updated_at: new Date().toISOString()
      });

      if (profileError) {
        console.error("Erro ao criar perfil:", profileError);
      }

      // 5. Atualizar status do lead
      const { error: updateError } = await supabase.from('leads').update({ status: 'converted' }).eq('id', convertingLead.id);
      if (updateError) throw updateError;
      
      // 6. Criar registro oficial em 'patients'
      const { error: insertError } = await supabase.from('patients').insert([{
        id: userId, // ID idêntico ao do Auth
        name: convertingLead.name,
        phone: convertingLead.phone,
        email: patientData.email,
        cpf: patientData.cpf,
        cep: patientData.cep,
        address: patientData.address,
        address_number: patientData.address_number,
        neighborhood: patientData.neighborhood,
        city: patientData.city,
        state: patientData.state,
        status: 'Ativo'
      }]);
      if (insertError) throw insertError;
      
      // 7. Notificar via WhatsApp
      const firstName = convertingLead.name.split(' ')[0] || 'Paciente';
      const msgText = `Olá, *${firstName}*! ✨ Bem-vindo(a) à Tzion Terapias.\n\nSua conta de paciente foi criada com sucesso! Para acessar o seu portal, utilize os dados abaixo:\n\n📧 *E-mail:* ${patientData.email}\n🔑 *Senha Temporária:* ${tempPassword}\n\n🔗 *Acesse:* ${window.location.origin}/login\n\n⚠️ *Importante:* Por segurança, você deve alterar sua senha provisória já no primeiro acesso.\n\nQualquer dúvida, estamos à disposição! 💙`;
      
      await sendWhatsAppMessage(userId, convertingLead.phone, msgText, 'patient_welcome');

      alert(`${convertingLead.name} agora é um paciente oficial e foi adicionado ao seu Cadastro de Pacientes! O paciente foi notificado das credenciais por WhatsApp.`);
      
      setConvertingLead(null);
      fetchLeads();
    } catch (error) {
      console.error('Erro na conversão:', error);
      alert('Houve um erro ao tentar converter o lead em paciente. Verifique se o script SQL foi executado no Supabase.');
    }
  };

  useEffect(() => {
    fetchLeads();
    const channel = supabase
      .channel('leads_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
        fetchLeads();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const getLeadsByStatus = (status: string) => leads.filter(l => l.status === status);

  if (loading && leads.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 overflow-x-auto pb-6">
      {columns.map((col) => (
        <div key={col.id} className="flex flex-col gap-4 min-w-[300px]">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <div className={cn("w-2 h-2 rounded-full", col.color)} />
              <h3 className="font-bold text-slate-700 uppercase text-xs tracking-widest">{col.title}</h3>
              <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded-full">
                {getLeadsByStatus(col.id).length}
              </span>
            </div>
            <button className="p-1.5 hover:bg-white rounded-lg text-slate-400 transition-colors">
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-col gap-4 min-h-[500px] p-3 bg-slate-50/50 rounded-[2.5rem] border border-slate-100">
            {getLeadsByStatus(col.id).map((lead) => (
              <div 
                key={lead.id} 
                className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all group"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex flex-wrap gap-1">
                    {lead.tags.map((tag, i) => (
                      <span key={i} className="px-2 py-0.5 bg-slate-50 text-slate-400 rounded-full text-[8px] font-bold uppercase tracking-tighter">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <button className="p-1 text-slate-300 hover:text-slate-600">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <h4 className="font-bold text-slate-900 leading-tight group-hover:text-indigo-600 transition-colors">{lead.name}</h4>
                    <p className="text-[10px] text-slate-400 font-bold flex items-center gap-1 mt-1">
                      <Phone className="w-3 h-3" /> {lead.phone}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                    <div className="flex items-center -space-x-2">
                      <div className="w-7 h-7 rounded-full bg-indigo-50 border-2 border-white flex items-center justify-center text-[10px] font-bold text-indigo-600 shadow-sm">
                        {lead.name.charAt(0)}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => window.location.href = '/admin/atendimento'}
                        className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-all shadow-sm"
                        title="Abrir na Central de Atendimento"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => window.open(`https://wa.me/${lead.phone.replace(/\D/g, '')}`, '_blank')}
                        className="p-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-all"
                        title="Enviar WhatsApp"
                      >
                        <Phone className="w-4 h-4" />
                      </button>
                      
                      {col.id === 'completed' ? (
                        <button 
                          onClick={() => startConversion(lead)}
                          className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-bold flex items-center gap-2 hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all active:scale-95"
                        >
                          <Zap className="w-3 h-3 fill-white" /> Converter
                        </button>
                      ) : (
                        <button 
                          onClick={() => updateLeadStatus(lead.id, columns[columns.findIndex(c => c.id === col.id) + 1]?.id || col.id)}
                          className="p-2 bg-slate-100 text-slate-400 rounded-xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                          title="Avançar Estágio"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            {getLeadsByStatus(col.id).length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 opacity-20 border-2 border-dashed border-slate-200 rounded-[2rem] m-2">
                <Plus className="w-6 h-6 text-slate-400 mb-2" />
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center px-4">Sem leads nesta etapa</p>
              </div>
            )}
          </div>
        </div>
      ))}

      {convertingLead && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] w-full max-w-xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600 shadow-sm">
                  <User className="w-6 h-6" />
                </div>
                <div>
                   <h3 className="text-2xl font-bold text-slate-900 tracking-tight">Converter Paciente</h3>
                   <p className="text-sm font-medium text-slate-500">Preencha os dados obrigatórios para cobrança (Asaas)</p>
                </div>
              </div>
              <button onClick={() => setConvertingLead(null)} className="p-2 hover:bg-slate-50 rounded-full transition-colors text-slate-400">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={confirmConversion} className="p-8 space-y-6 overflow-y-auto max-h-[70vh]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">E-mail *</label>
                  <input required type="email" value={patientData.email} onChange={e => setPatientData({...patientData, email: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700" placeholder="email@exemplo.com" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">CPF *</label>
                  <input required value={patientData.cpf} onChange={e => setPatientData({...patientData, cpf: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700" placeholder="000.000.000-00" />
                </div>
              </div>
              
              <div className="pt-4 border-t border-slate-100">
                 <h4 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2"><MapPin className="w-4 h-4 text-indigo-500" /> Endereço Completo</h4>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">CEP *</label>
                      <input required value={patientData.cep} onChange={e => setPatientData({...patientData, cep: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700" placeholder="00000-000" />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Rua / Logradouro *</label>
                      <input required value={patientData.address} onChange={e => setPatientData({...patientData, address: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700" placeholder="Nome da rua" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Número *</label>
                      <input required value={patientData.address_number} onChange={e => setPatientData({...patientData, address_number: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700" placeholder="123" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Bairro *</label>
                      <input required value={patientData.neighborhood} onChange={e => setPatientData({...patientData, neighborhood: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700" placeholder="Bairro" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Cidade / Estado *</label>
                      <div className="flex gap-2">
                        <input required value={patientData.city} onChange={e => setPatientData({...patientData, city: e.target.value})} className="w-[70%] p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700" placeholder="Cidade" />
                        <input required value={patientData.state} onChange={e => setPatientData({...patientData, state: e.target.value})} className="w-[30%] p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700" placeholder="UF" maxLength={2} />
                      </div>
                    </div>
                 </div>
              </div>

              <div className="pt-6 flex gap-4">
                <button type="button" onClick={() => setConvertingLead(null)} className="flex-1 py-4 bg-slate-50 text-slate-600 rounded-2xl font-bold hover:bg-slate-100 transition-all border border-slate-200">Cancelar</button>
                <button type="submit" className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"><Zap className="w-5 h-5 fill-white" /> Converter & Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
