import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, Filter, MoreVertical, Phone, Mail, Calendar, X, Save, User, MapPin, FileText, History, AlertCircle, Heart, Clock, Download, Loader2, Activity, Award, DollarSign, ClipboardList, Send, CheckCircle2, Shield, TrendingUp, MessageCircle, File, Trash2, Edit, Copy, Check, ExternalLink, StickyNote } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { cn } from '@/src/lib/utils';
import { supabase } from '@/src/lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { sendWhatsAppMessage } from '@/src/lib/whatsapp';
import { getSystemBaseUrl } from '@/src/utils/systemUrl';
import { useAuth } from '@/src/contexts/AuthContext';
import { fillContractTemplate, DEFAULT_CONTRACT_TEMPLATE } from '@/src/lib/contract';
import PatientNotesModal from '@/src/components/patient/PatientNotesModal';

export default function PatientList() {
  const [patients, setPatients] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [sendWelcomeMsg, setSendWelcomeMsg] = useState(true);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'anamnesis' | 'history' | 'docs' | 'timeline' | 'homecare'>('info');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [notesPatient, setNotesPatient] = useState<{ id: string; name: string; phone?: string } | null>(null);

  // Evolution Editing State
  const [editingEvolution, setEditingEvolution] = useState<{ id: string; notes: string } | null>(null);
  const [resendingEvolutionId, setResendingEvolutionId] = useState<string | null>(null);

  // Timeline State
  const [timelineEvents, setTimelineEvents] = useState<any[]>([]);
  const [patientPackages, setPatientPackages] = useState<any[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [loadingTab, setLoadingTab] = useState<Record<string, boolean>>({});

  // Documents
  const [documents, setDocuments] = useState<any[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // New Data State
  const [newPatient, setNewPatient] = useState({
    name: '', email: '', phone: '', cpf: '',
    cep: '', address: '', address_number: '', neighborhood: '', city: '', state: '',
    gender: '', birth_date: '', profession: '', marital_status: '', guardian_name: '', guardian_cpf: ''
  });
  const [showEditModal, setShowEditModal] = useState(false);
  const [editPatient, setEditPatient] = useState({
    id: '', name: '', email: '', phone: '', cpf: '',
    cep: '', address: '', address_number: '', neighborhood: '', city: '', state: '',
    gender: '', birth_date: '', profession: '', marital_status: '', guardian_name: '', guardian_cpf: '', status: 'Ativo'
  });
  const [anamnesis, setAnamnesis] = useState({ complaint: '', family_history: '', lifestyle: '' });
  const [evolutions, setEvolutions] = useState<any[]>([]);
  const [newEvolution, setNewEvolution] = useState('');
  const [indicators, setIndicators] = useState({ anxiety: 5, vitality: 5, physical_pain: 0, sleep_quality: 5 });
  const [patientIndicators, setPatientIndicators] = useState<any[]>([]);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [newPrescriptionItems, setNewPrescriptionItems] = useState<{ type: string; name: string; usage: string }[]>([
    { type: 'floral', name: '', usage: '' }
  ]);

  const { user } = useAuth();
  const [therapistId, setTherapistId] = useState<string>('');
  const [editResponses, setEditResponses] = useState<Record<string, any>>({});
  const [activeTemplate, setActiveTemplate] = useState<any>(null);
  const [isResponsible, setIsResponsible] = useState<boolean>(false);

  // Contract Modal & Generator State
  const [showContractModal, setShowContractModal] = useState(false);
  const [contractData, setContractData] = useState({
    package_id: '',
    service_name: 'Pacote de Sessões Terapêuticas',
    total_sessions: '8',
    extension_sessions: '0',
    price: '',
    therapist_name: 'Marcos Dany Teixeira Magalhães',
  });
  const [generatingContract, setGeneratingContract] = useState(false);

  useEffect(() => {
    const initData = async () => {
      let currentTId = therapistId;
      if (user && user.role === 'terapeuta' && !currentTId) {
        const { data } = await supabase
          .from('therapists')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();
        if (data?.id) {
          currentTId = data.id;
          setTherapistId(data.id);
        }
      }
      fetchPatients(currentTId);
    };

    if (user) {
      initData();
    }
  }, [user]);

  const fetchPatients = async (currentTId?: string) => {
    setLoading(true);
    try {
      const myTId = currentTId !== undefined ? currentTId : therapistId;

      const { data, error } = await supabase
        .from('patients')
        .select(`
          id, name, email, phone, cpf, cep, gender, birth_date, status, created_at,
          address, address_number, neighborhood, city, state, profession, marital_status,
          guardian_name, guardian_cpf,
          patient_anamnesis ( id ),
          patient_contracts ( status )
        `)
        .neq('status', 'Lead')
        .order('created_at', { ascending: false });

      if (error) {
        console.error("Error fetching patients:", error);
      }

      if (!error && data) {
        if (user?.role === 'terapeuta') {
          if (myTId) {
            const { data: appts } = await supabase
              .from('appointments')
              .select('patient_id')
              .eq('therapist_id', myTId);

            const allowedPatientIds = new Set((appts || []).map((a: any) => a.patient_id).filter(Boolean));

            const filtered = data.filter((p: any) => allowedPatientIds.has(p.id));
            setPatients(filtered);
          } else {
            setPatients([]);
          }
        } else {
          setPatients(data);
        }
      }
    } catch (err) {
      console.error("Exception fetching patients:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedPatient?.id) {
      loadTabContent(activeTab, selectedPatient.id);
    }
  }, [activeTab, selectedPatient?.id]);

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const confirmDeletePatient = async () => {
    if (!selectedPatient) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('patients')
        .delete()
        .eq('id', selectedPatient.id);
      if (error) throw error;
      setToastMessage('Paciente excluído com sucesso!');
      setSelectedPatient(null);
      fetchPatients();
    } catch (err: any) {
      console.error(err);
      alert('Erro ao excluir paciente: ' + (err.message || err));
    } finally {
      setSaving(false);
      setShowDeleteConfirm(false);
    }
  };

  const loadTabContent = async (tab: string, patientId: string) => {
    if (loadingTab[tab]) return;

    setLoadingTab(prev => ({ ...prev, [tab]: true }));
    try {
      if (tab === 'info') {
        let isResp = user?.role === 'admin' || user?.role === 'atendimento';
        if (user?.role === 'terapeuta') {
          let tId = therapistId;
          if (!tId) {
            const { data } = await supabase
              .from('therapists')
              .select('id')
              .eq('user_id', user.id)
              .maybeSingle();
            tId = data?.id || '';
            if (tId) setTherapistId(tId);
          }
          if (tId) {
            const { data: apptExists } = await supabase
              .from('appointments')
              .select('id')
              .eq('patient_id', patientId)
              .eq('therapist_id', tId)
              .limit(1)
              .maybeSingle();
            if (apptExists) {
              isResp = true;
            }
          }
        }
        setIsResponsible(isResp);
      } 
      else if (tab === 'anamnesis') {
        const { data: anaData } = await supabase.from('patient_anamnesis').select('*').eq('patient_id', patientId).maybeSingle();
        if (anaData) {
          setAnamnesis({ complaint: anaData.complaint || '', family_history: anaData.family_history || '', lifestyle: anaData.lifestyle || '' });
          setEditResponses(anaData.responses || {});
        } else {
          setAnamnesis({ complaint: '', family_history: '', lifestyle: '' });
          setEditResponses({});
        }

        let templateToLoad = null;
        if (anaData?.template_id) {
          const { data: tmpl } = await supabase.from('clinical_templates').select('*').eq('id', anaData.template_id).maybeSingle();
          templateToLoad = tmpl;
        } else {
          const { data: activeTmpls } = await supabase
            .from('clinical_templates')
            .select('*')
            .eq('category', 'anamnesis')
            .eq('active', true)
            .order('created_at', { ascending: false });
          if (activeTmpls && activeTmpls.length > 0) {
            templateToLoad = activeTmpls[0];
          }
        }
        setActiveTemplate(templateToLoad);
      } 
      else if (tab === 'history') {
        const [evoRes, prescRes] = await Promise.all([
          supabase.from('patient_evolutions').select('*').eq('patient_id', patientId).order('created_at', { ascending: false }),
          supabase.from('therapeutic_prescriptions').select('*').eq('patient_id', patientId).order('created_at', { ascending: false })
        ]);
        if (evoRes.data) setEvolutions(evoRes.data);
        if (prescRes.data) setPrescriptions(prescRes.data);
        else setPrescriptions([]);
      } 
      else if (tab === 'homecare') {
        const { data: prescData } = await supabase
          .from('therapeutic_prescriptions')
          .select('*')
          .eq('patient_id', patientId)
          .order('created_at', { ascending: false });
        if (prescData) setPrescriptions(prescData);
        else setPrescriptions([]);
      }
      else if (tab === 'timeline') {
        setLoadingTimeline(true);
        const [appRes, payRes, packRes, conRes, indRes] = await Promise.all([
          supabase.from('appointments').select('*, therapists(name)').eq('patient_id', patientId),
          supabase.from('payments').select('*').eq('patient_id', patientId).order('created_at', { ascending: false }),
          supabase.from('patient_packages').select('*, services(name, price, type)').eq('patient_id', patientId),
          supabase.from('patient_contracts').select('*').eq('patient_id', patientId).order('created_at', { ascending: false }),
          supabase.from('patient_indicators').select('*').eq('patient_id', patientId).order('created_at', { ascending: true })
        ]);
        
        const appointments = appRes.data || [];
        const payments = payRes.data || [];
        const pkgs = packRes.data || [];
        const contracts = conRes.data || [];
        const indicatorsData = indRes.data || [];
        
        setPatientPackages(pkgs);
        setPatientIndicators(indicatorsData);

        const { data: evoData } = await supabase.from('patient_evolutions').select('*').eq('patient_id', patientId).order('created_at', { ascending: false });
        if (evoData) setEvolutions(evoData);

        let events: any[] = [];
        
        appointments.forEach(app => {
           events.push({
               id: `app-${app.id}`,
               type: 'appointment',
               date: new Date(app.start_time),
               title: `Sessão ${app.status === 'completed' ? 'Realizada' : 'Agendada'}`,
               description: `Modalidade: ${app.type || 'Presencial'} | Terapeuta: ${app.therapists?.name || 'Não atribuído'}`,
               status: app.status
           });
        });

        if (evoData) {
          evoData.forEach(rec => {
              events.push({
                  id: `evo-${rec.id}`,
                  type: 'record',
                  date: new Date(rec.created_at),
                  title: 'Evolução Clínica',
                  description: rec.notes ? rec.notes.substring(0, 50) + '...' : '',
              });
          });
        }

        payments.forEach(pay => {
            events.push({
                id: `pay-${pay.id}`,
                type: 'finance',
                date: new Date(pay.created_at),
                title: `Pagamento: ${pay.payment_method?.toUpperCase() || 'PIX'}`,
                description: `${pay.description} | R$ ${pay.amount.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`,
                status: pay.status
            });
        });

        const baseUrlForContracts = await getSystemBaseUrl();
        contracts.forEach(contract => {
            events.push({
                id: `contract-${contract.id}`,
                type: 'contract',
                date: new Date(contract.created_at),
                title: `Contrato de Serviço ${contract.status === 'signed' ? '(Assinado)' : '(Pendente)'}`,
                description: `Acesse o termo no link: ${baseUrlForContracts}/contrato/${contract.id}`,
                status: contract.status
            });
        });

        events.sort((a, b) => b.date.getTime() - a.date.getTime());
        setTimelineEvents(events);
        setLoadingTimeline(false);
      }
      else if (tab === 'docs') {
        const [docsRes, contractsRes] = await Promise.all([
          supabase.from('patient_documents').select('*').eq('patient_id', patientId).order('created_at', { ascending: false }),
          supabase.from('patient_contracts').select('*').eq('patient_id', patientId).order('created_at', { ascending: false })
        ]);

        let combinedDocs: any[] = [];
        if (docsRes.data) {
          combinedDocs = [...docsRes.data.map((d: any) => ({ ...d, source: 'upload' }))];
        }
        if (contractsRes.data) {
          const baseUrlForContracts = await getSystemBaseUrl();
          const mappedContracts = contractsRes.data.map((c: any) => ({
            id: `contract-${c.id}`,
            original_id: c.id,
            title: `Contrato de Serviço Terapêutico (${c.status === 'signed' ? 'Assinado' : 'Pendente'})`,
            file_url: `${baseUrlForContracts}/contrato/${c.id}`,
            created_at: c.created_at,
            source: 'contract'
          }));
          combinedDocs = [...combinedDocs, ...mappedContracts];
        }

        combinedDocs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setDocuments(combinedDocs);
      }
    } catch (err) {
      console.error(`Erro ao carregar dados da aba ${tab}:`, err);
    } finally {
      setLoadingTab(prev => ({ ...prev, [tab]: false }));
    }
  };

  const fetchPatientDetails = async (patientId: string) => {
    await loadTabContent(activeTab, patientId);
  };

  const handleSelectPatient = (patient: any) => {
    setSelectedPatient(patient);
    setActiveTab('info');
    fetchPatientDetails(patient.id);
  };

  const handleAddPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      // 1. Gerar senha padrão (Tzion@ + últimos 4 dígitos do WhatsApp/Telefone ou fallback Tzion@123)
      const digits = newPatient.phone.replace(/\D/g, '');
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
        email: newPatient.email,
        password: tempPassword,
        options: {
          data: {
            name: newPatient.name,
            role: 'paciente',
            phone: newPatient.phone
          }
        }
      });

      if (signUpError) {
        setToastMessage(`Erro de cadastro Auth: ${signUpError.message}`);
        setSaving(false);
        return;
      }

      const userId = signUpData.user?.id;
      if (!userId) {
        setToastMessage("Erro ao gerar conta do paciente.");
        setSaving(false);
        return;
      }

      // 4. Criar perfil na tabela profiles
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: userId,
        name: newPatient.name,
        email: newPatient.email,
        role: 'paciente',
        phone: newPatient.phone,
        status: 'temp_password',
        updated_at: new Date().toISOString()
      });

      if (profileError) {
        console.error("Erro ao criar profiles:", profileError);
      }

      // 5. Verificar se já existe um lead com esse e-mail. Se não, criar para garantir compatibilidade
      const { data: existingLead } = await supabase.from('leads').select('id').eq('email', newPatient.email).maybeSingle();
      let leadId = existingLead?.id;
      if (!leadId) {
        const { data: newLeadData, error: leadError } = await supabase.from('leads').insert([{
          name: newPatient.name,
          email: newPatient.email,
          phone: newPatient.phone,
          status: 'converted',
          source: 'admin_register'
        }]).select('id').single();
        if (leadError) {
          console.error("Erro ao criar lead:", leadError);
        } else {
          leadId = newLeadData?.id;
        }
      }

      // 6. Criar paciente oficial na tabela patients
      const cleanDate = (d: any) => (!d || typeof d !== 'string' || !d.trim()) ? null : d.trim();
      const patientPayload: Record<string, any> = {
        id: userId, // ID idêntico ao do Auth
        name: newPatient.name,
        email: newPatient.email,
        phone: newPatient.phone,
        cpf: newPatient.cpf,
        profession: newPatient.profession?.trim() || null,
        marital_status: newPatient.marital_status?.trim() || null,
        guardian_name: newPatient.guardian_name?.trim() || null,
        guardian_cpf: newPatient.guardian_cpf?.trim() || null,
        cep: newPatient.cep,
        address: newPatient.address,
        address_number: newPatient.address_number,
        neighborhood: newPatient.neighborhood,
        city: newPatient.city,
        state: newPatient.state,
        gender: newPatient.gender,
        birth_date: cleanDate(newPatient.birth_date),
        status: 'Ativo'
      };

      let { error: patientError } = await supabase.from('patients').insert([patientPayload]);

      if (patientError && (patientError.message?.includes('column') || patientError.code === '42703' || (patientError as any).status === 400)) {
        console.warn("Retrying patient insert without optional contract columns:", patientError);
        delete patientPayload.profession;
        delete patientPayload.marital_status;
        delete patientPayload.guardian_name;
        delete patientPayload.guardian_cpf;

        const retry = await supabase.from('patients').insert([patientPayload]);
        if (!retry.error) patientError = null;
      }

      if (patientError) {
        setToastMessage(`Erro ao criar paciente: ${patientError.message}`);
        setSaving(false);
        return;
      }

      // 7. Notificar via WhatsApp
      if (sendWelcomeMsg) {
        const firstName = newPatient.name.split(' ')[0] || 'Paciente';
        const baseUrl = await getSystemBaseUrl();
        const msgText = `Olá, *${firstName}*! ✨ Bem-vindo(a) à Tzion Terapias.\n\nSua conta de paciente foi criada com sucesso! Para acessar o seu portal, utilize os dados abaixo:\n\n📧 *E-mail:* ${newPatient.email}\n🔑 *Senha Temporária:* ${tempPassword}\n\n🔗 *Acesse:* ${baseUrl}/login\n\n⚠️ *Importante:* Por segurança, você deve alterar sua senha provisória já no primeiro acesso.\n\nQualquer dúvida, estamos à disposição! 💙`;
        
        await sendWhatsAppMessage(userId, newPatient.phone, msgText, 'patient_welcome');
      }

      setShowModal(false);
      setNewPatient({
        name: '', email: '', phone: '', cpf: '',
        cep: '', address: '', address_number: '', neighborhood: '', city: '', state: '',
        gender: '', birth_date: '', profession: '', marital_status: '', guardian_name: '', guardian_cpf: ''
      });
      fetchPatients();
      setToastMessage(sendWelcomeMsg ? "Paciente cadastrado e notificado com sucesso!" : "Paciente cadastrado com sucesso!");
    } catch (e: any) {
      console.error(e);
      setToastMessage(`Erro inesperado: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const cleanDate = (d: any) => (!d || typeof d !== 'string' || !d.trim()) ? null : d.trim();
      const updatePayload: Record<string, any> = {
        name: editPatient.name,
        email: editPatient.email,
        phone: editPatient.phone,
        cpf: editPatient.cpf,
        profession: editPatient.profession?.trim() || null,
        marital_status: editPatient.marital_status?.trim() || null,
        guardian_name: editPatient.guardian_name?.trim() || null,
        guardian_cpf: editPatient.guardian_cpf?.trim() || null,
        cep: editPatient.cep,
        address: editPatient.address,
        address_number: editPatient.address_number,
        neighborhood: editPatient.neighborhood,
        city: editPatient.city,
        state: editPatient.state,
        gender: editPatient.gender,
        birth_date: cleanDate(editPatient.birth_date),
        status: editPatient.status
      };

      let { error: patientError } = await supabase
        .from('patients')
        .update(updatePayload)
        .eq('id', editPatient.id);

      // Se falhar por e-mail já existente ou erro de chave de perfil/trigger, remove 'email' do update e salva os dados do paciente
      if (patientError && (
        patientError.message?.includes('e-mail') || 
        patientError.message?.includes('cadastrado') || 
        patientError.message?.includes('perfil') || 
        patientError.message?.includes('profiles') || 
        patientError.message?.includes('foreign key') ||
        patientError.code === '23503'
      )) {
        console.warn("E-mail ou perfil conflitante. Atualizando os dados do paciente sem alterar e-mail:", patientError.message);
        delete updatePayload.email;
        const retryEmail = await supabase.from('patients').update(updatePayload).eq('id', editPatient.id);
        if (!retryEmail.error) {
          patientError = null;
        } else {
          patientError = retryEmail.error;
        }
      }

      // Se falhar por colunas de contrato ainda inexistentes no banco, remove-as e tenta atualizar os dados padrão
      if (patientError && (patientError.message?.includes('column') || patientError.code === '42703' || (patientError as any).status === 400)) {
        console.warn("Retrying patient update without contract columns:", patientError);
        delete updatePayload.profession;
        delete updatePayload.marital_status;
        delete updatePayload.guardian_name;
        delete updatePayload.guardian_cpf;

        const retryCols = await supabase.from('patients').update(updatePayload).eq('id', editPatient.id);
        if (!retryCols.error) {
          patientError = null;
        } else {
          patientError = retryCols.error;
        }
      }

      if (patientError) {
        setToastMessage(`Erro ao atualizar paciente: ${patientError.message}`);
        setSaving(false);
        return;
      }

      const profilePayload: Record<string, any> = {
        name: editPatient.name,
        phone: editPatient.phone,
        updated_at: new Date().toISOString()
      };
      if (updatePayload.email) profilePayload.email = updatePayload.email;

      const { error: profileError } = await supabase
        .from('profiles')
        .update(profilePayload)
        .eq('id', editPatient.id);

      if (profileError) {
        console.error("Erro ao atualizar profiles:", profileError);
      }

      const updated = {
        ...selectedPatient,
        name: editPatient.name,
        email: editPatient.email,
        phone: editPatient.phone,
        cpf: editPatient.cpf,
        profession: editPatient.profession,
        marital_status: editPatient.marital_status,
        guardian_name: editPatient.guardian_name,
        guardian_cpf: editPatient.guardian_cpf,
        cep: editPatient.cep,
        address: editPatient.address,
        address_number: editPatient.address_number,
        neighborhood: editPatient.neighborhood,
        city: editPatient.city,
        state: editPatient.state,
        gender: editPatient.gender,
        birth_date: editPatient.birth_date,
        status: editPatient.status
      };
      setSelectedPatient(updated);
      setShowEditModal(false);
      fetchPatients();
      if (!toastMessage) setToastMessage("Cadastro do paciente atualizado com sucesso!");
    } catch (err: any) {
      console.error(err);
      setToastMessage(`Erro ao salvar: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAnamnesis = async () => {
    if (!selectedPatient) return;
    setSaving(true);
    
    let comp = anamnesis.complaint;
    let fam = anamnesis.family_history;
    let life = anamnesis.lifestyle;

    if (activeTemplate && activeTemplate.fields) {
      activeTemplate.fields.forEach((f: any) => {
        const val = editResponses[f.id];
        if (val === undefined || val === null) return;
        
        const labelLower = f.label.toLowerCase();
        if (labelLower.includes('queixa') || labelLower.includes('motivo') || labelLower.includes('busca')) {
          comp = String(val);
        } else if (labelLower.includes('familiar') || labelLower.includes('família') || labelLower.includes('genograma')) {
          fam = String(val);
        } else if (labelLower.includes('estilo') || labelLower.includes('hábito') || labelLower.includes('rotina') || labelLower.includes('lifestyle')) {
          life = String(val);
        }
      });
    }

    const { data } = await supabase.from('patient_anamnesis').select('id').eq('patient_id', selectedPatient.id).maybeSingle();
    
    let error;
    const payload = {
      patient_id: selectedPatient.id,
      template_id: activeTemplate?.id || null,
      responses: editResponses,
      complaint: comp,
      family_history: fam,
      lifestyle: life,
      updated_at: new Date().toISOString()
    };

    if (data?.id) {
      // Update
      const res = await supabase.from('patient_anamnesis').update(payload).eq('id', data.id);
      error = res.error;
    } else {
      // Insert
      const res = await supabase.from('patient_anamnesis').insert([payload]);
      error = res.error;
    }

    if (!error) {
      setToastMessage('Anamnese salva com sucesso!');
    } else {
      setToastMessage('Erro ao salvar anamnese.');
    }
    setSaving(false);
  };

  const handleSendAnamnesisLink = async () => {
    if (!selectedPatient?.phone) {
      setToastMessage('Paciente não possui telefone cadastrado.');
      return;
    }
    const baseUrl = await getSystemBaseUrl();
    const link = `${baseUrl}/anamnese/${selectedPatient.anamnesis_token || selectedPatient.id}`;
    const firstName = selectedPatient.name.split(' ')[0] || 'Paciente';
    const msg = `[Ficha de Entrada - Tzion Terapias]\n\nOlá, *${firstName}*! ✨\n\nPor favor, preencha a sua Ficha de Anamnese antes da nossa próxima sessão. É bem rápido e nos ajuda a preparar o seu atendimento:\n\n🔗 ${link}\n\nQualquer dúvida, estamos à disposição! 💙`;
    
    setSaving(true);
    const sent = await sendWhatsAppMessage(selectedPatient.id, selectedPatient.phone, msg, 'anamnesis_invite');
    setSaving(false);
    if (sent) {
      setToastMessage('Link de anamnese enviado com sucesso via WhatsApp!');
    } else {
      setToastMessage('Erro ao enviar link via WhatsApp.');
    }
  };

  const [sendingCode, setSendingCode] = useState(false);

  const handleSendAccessCode = async () => {
    if (!selectedPatient?.email) {
      setToastMessage('Paciente não possui e-mail cadastrado.');
      return;
    }
    if (!selectedPatient?.phone) {
      setToastMessage('Paciente não possui telefone cadastrado.');
      return;
    }
    setSendingCode(true);

    try {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          whatsapp_login_code: code,
          whatsapp_login_code_expires_at: expiresAt
        })
        .eq('id', selectedPatient.id);

      if (updateError) {
        throw new Error(`Erro ao salvar código no banco: ${updateError.message}`);
      }

      const baseUrl = await getSystemBaseUrl();
      const directLink = `${baseUrl}/login?email=${encodeURIComponent(selectedPatient.email)}&code=${code}`;

      const firstName = selectedPatient.name.split(' ')[0] || 'Paciente';
      const msg = `[Código de Acesso - Tzion Terapias]\n\nOlá, *${firstName}*! ✨\n\nVocê solicitou acesso ao portal do paciente sem precisar de senha.\n\n🔑 Seu código de acesso de uso único é: *${code}*\n\nOu clique no link abaixo para entrar diretamente:\n🔗 ${directLink}\n\n*Nota:* Este código expira em 15 minutos.\n\nQualquer dúvida, estamos à disposição! 💙`;
      
      const sent = await sendWhatsAppMessage(selectedPatient.id, selectedPatient.phone, msg, 'access_code_sent');
      
      if (sent) {
        setToastMessage('Código de acesso enviado com sucesso via WhatsApp!');
      } else {
        setToastMessage('Erro ao enviar mensagem no WhatsApp.');
      }
    } catch (err: any) {
      console.error(err);
      setToastMessage(`Erro: ${err.message}`);
    } finally {
      setSendingCode(false);
    }
  };

  const handleAddEvolution = async () => {
    if (!newEvolution.trim() || !selectedPatient) return;
    setSaving(true);
    
    const { error } = await supabase.from('patient_evolutions').insert([{
      patient_id: selectedPatient.id,
      notes: newEvolution,
      type: 'Sessão Regular'
    }]);

    if (!error) {
      await supabase.from('patient_indicators').insert([{
        patient_id: selectedPatient.id,
        anxiety: indicators.anxiety,
        vitality: indicators.vitality,
        physical_pain: indicators.physical_pain,
        sleep_quality: indicators.sleep_quality,
        notes: newEvolution
      }]);

      setNewEvolution('');
      setIndicators({ anxiety: 5, vitality: 5, physical_pain: 0, sleep_quality: 5 });
      fetchPatientDetails(selectedPatient.id);
      setToastMessage('Evolução e indicadores registrados com sucesso!');
    } else {
      setToastMessage('Erro ao registrar evolução.');
    }
    setSaving(false);
  };

  const handleUpdateEvolution = async (id: string, newNotes: string, sendWhatsApp: boolean) => {
    if (saving) return;
    try {
      setSaving(true);
      const { error } = await supabase
        .from('patient_evolutions')
        .update({ notes: newNotes })
        .eq('id', id);

      if (error) throw error;

      setEvolutions(prev => prev.map(e => e.id === id ? { ...e, notes: newNotes } : e));
      setEditingEvolution(null);

      if (sendWhatsApp && selectedPatient?.phone) {
        setResendingEvolutionId(id);
        const { sendWhatsAppMessage } = await import('@/src/lib/whatsapp');
        const msg = `*Orientação do seu terapeuta:*\n\n${newNotes}`;
        const sent = await sendWhatsAppMessage(selectedPatient.id, selectedPatient.phone, msg, 'patient_guidance_updated');
        if (sent) {
          setToastMessage('Orientação atualizada e reenviada com sucesso via WhatsApp!');
        } else {
          setToastMessage('Orientação atualizada no prontuário. Houve falha ao enviar WhatsApp.');
        }
      } else {
        setToastMessage('Orientação/Evolução atualizada com sucesso!');
      }
    } catch (err: any) {
      console.error(err);
      alert('Erro ao atualizar orientação: ' + (err.message || err));
    } finally {
      setSaving(false);
      setResendingEvolutionId(null);
    }
  };

  const handleResendContract = async (contractId: string, patientName: string, patientPhone: string) => {
    if (!patientPhone) {
        setToastMessage('Paciente não possui telefone cadastrado.');
        return;
    }
    const baseUrl = await getSystemBaseUrl();
    const link = `${baseUrl}/contrato/${contractId}`;
    const firstName = patientName?.split(' ')[0] || 'Paciente';
    let msg = `[Contrato - Tzion Terapias]\n\n`;
    msg += `Olá, *${firstName}*! ✨\n\n`;
    msg += `Segue o link de acesso ao seu termo de serviço terapêutico:\n\n`;
    msg += `🔗 ${link}\n\n`;
    msg += `Qualquer dúvida, estamos à disposição! 💙`;
    
    const sent = await sendWhatsAppMessage(selectedPatient.id, patientPhone, msg, 'contract_resent');
    if (sent) {
        setToastMessage('Link do contrato reenviado com sucesso!');
    } else {
        setToastMessage('Erro ao enviar mensagem.');
    }
  };

  const handleSavePrescription = async () => {
    if (!selectedPatient) return;
    if (newPrescriptionItems.some(item => !item.name.trim() || !item.usage.trim())) {
      setToastMessage('Por favor, preencha o nome e a instrução de uso de todos os itens.');
      return;
    }
    setSaving(true);

    const { data: createdPresc, error } = await supabase
      .from('therapeutic_prescriptions')
      .insert([{
        patient_id: selectedPatient.id,
        therapist_id: therapistId || null,
        items: newPrescriptionItems,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) {
      setToastMessage('Erro ao salvar prescrição.');
      console.error(error);
      setSaving(false);
      return;
    }

    // Enviar via WhatsApp se o paciente tiver telefone
    if (selectedPatient.phone) {
      const firstName = selectedPatient.name.split(' ')[0];
      let msg = `Olá, *${firstName}*! ✨\n\nAqui estão as suas orientações de *Autocuidado / Home Care* da Tzion Terapias:\n\n`;
      newPrescriptionItems.forEach((item, idx) => {
        const emoji = item.type === 'floral' ? '🌸' : item.type === 'ervas' ? '🌿' : item.type === 'exercicio' ? '🧘' : '📝';
        msg += `${idx + 1}. ${emoji} *${item.name}* (${item.type.toUpperCase()})\n   └ 📌 _Uso/Instruções:_ ${item.usage}\n\n`;
      });
      msg += `Qualquer dúvida ou desconforto, entre em contato conosco. Cuide-se bem! 💙`;

      await sendWhatsAppMessage(selectedPatient.id, selectedPatient.phone, msg, 'prescription_sent');
      setToastMessage('Prescrição salva e enviada via WhatsApp!');
    } else {
      setToastMessage('Prescrição salva com sucesso!');
    }

    setNewPrescriptionItems([{ type: 'floral', name: '', usage: '' }]);
    fetchPatientDetails(selectedPatient.id);
    setSaving(false);
  };

  const handleResendPrescription = async (presc: any) => {
    if (!selectedPatient?.phone) {
      setToastMessage('Paciente sem telefone cadastrado.');
      return;
    }
    setSaving(true);
    const items = presc.items || [];
    const firstName = selectedPatient.name.split(' ')[0];
    let msg = `Olá, *${firstName}*! ✨\n\nReenviando as suas orientações de *Autocuidado / Home Care* da Tzion Terapias:\n\n`;
    items.forEach((item: any, idx: number) => {
      const emoji = item.type === 'floral' ? '🌸' : item.type === 'ervas' ? '🌿' : item.type === 'exercicio' ? '🧘' : '📝';
      msg += `${idx + 1}. ${emoji} *${item.name}* (${item.type.toUpperCase()})\n   └ 📌 _Uso/Instruções:_ ${item.usage}\n\n`;
    });
    msg += `Qualquer dúvida ou desconforto, entre em contato conosco. Cuide-se bem! 💙`;

    const sent = await sendWhatsAppMessage(selectedPatient.id, selectedPatient.phone, msg, 'prescription_resent');
    setSaving(false);
    if (sent) {
      setToastMessage('Prescrição reenviada com sucesso!');
    } else {
      setToastMessage('Erro ao enviar mensagem.');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !selectedPatient) return;
    
    const file = e.target.files[0];
    setUploadingDoc(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${selectedPatient.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('patient-documents')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('patient-documents')
        .getPublicUrl(fileName);

      const { data: docData, error: docError } = await supabase.from('patient_documents').insert([{
        patient_id: selectedPatient.id,
        title: file.name,
        file_url: publicUrl,
        file_type: file.type,
        file_path: fileName,
        created_by: user?.id
      }]).select().single();

      if (docError) throw docError;

      const newDoc = {
        ...docData,
        source: 'upload'
      };
      setDocuments(prev => [newDoc, ...prev]);
      setToastMessage('Documento anexado com sucesso!');
    } catch (err: any) {
      console.error('Erro ao enviar documento:', err);
      setToastMessage(`Erro ao anexar documento: ${err.message}`);
    } finally {
      setUploadingDoc(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteDocument = async (doc: any) => {
    if (!window.confirm(`Tem certeza que deseja excluir o documento "${doc.title}"?`)) return;
    
    try {
      await supabase.storage.from('patient-documents').remove([doc.file_path]);
      const { error } = await supabase.from('patient_documents').delete().eq('id', doc.id);
      if (error) throw error;
      
      setDocuments(prev => prev.filter(d => d.id !== doc.id));
      setToastMessage('Documento excluído com sucesso!');
    } catch (err: any) {
      console.error(err);
      setToastMessage(`Erro ao excluir documento: ${err.message}`);
    }
  };

  const handleOpenManualContractModal = (pkg?: any) => {
    if (pkg) {
      setContractData({
        package_id: pkg.id || '',
        service_name: pkg.services?.name || 'Pacote de Sessões Terapêuticas',
        total_sessions: String(pkg.total_sessions || 8),
        extension_sessions: '0',
        price: pkg.services?.price ? String(pkg.services.price) : '',
        therapist_name: 'Marcos Dany Teixeira Magalhães',
      });
    } else {
      setContractData({
        package_id: '',
        service_name: 'Pacote de Sessões Terapêuticas',
        total_sessions: '8',
        extension_sessions: '0',
        price: '',
        therapist_name: 'Marcos Dany Teixeira Magalhães',
      });
    }
    setShowContractModal(true);
  };

  const handleGenerateContract = async () => {
    if (!selectedPatient) return;
    try {
      setGeneratingContract(true);
      const { data: setts } = await supabase.from('settings').select('value').eq('key', 'contract_template').maybeSingle();
      const rawTemplate = setts?.value || DEFAULT_CONTRACT_TEMPLATE;

      const filledContent = fillContractTemplate(rawTemplate, {
        patient: selectedPatient,
        package: {
          total_sessions: Number(contractData.total_sessions) || 8,
          extension_sessions: Number(contractData.extension_sessions) || 0,
          price: parseFloat(contractData.price.replace(',', '.')) || 0,
          service_name: contractData.service_name || 'Terapias Integrativas',
          title: contractData.service_name || 'Terapias Integrativas',
        },
        therapist: {
          name: contractData.therapist_name || 'Marcos Dany Teixeira Magalhães',
          professional_registration: 'CRTH-BR 6793'
        }
      });

      const { data: contract, error } = await supabase.from('patient_contracts').insert({
        patient_id: selectedPatient.id,
        content: filledContent,
        status: 'pending'
      }).select().single();

      if (error) throw error;

      const baseUrl = await getSystemBaseUrl();
      const link = `${baseUrl}/contrato/${contract.id}`;
      const firstName = selectedPatient.name?.split(' ')[0] || 'Paciente';
      const msg = `Olá, *${firstName}*! ✨\n\nO seu termo de compromisso de serviço terapêutico foi gerado pela Clínica Tzion Terapias.\n\nPor favor, leia e assine digitalmente no link seguro abaixo:\n\n🔗 ${link}\n\nQualquer dúvida, estamos à disposição! 💙`;

      if (selectedPatient.phone) {
        try {
          await sendWhatsAppMessage(selectedPatient.id, selectedPatient.phone, msg, 'contract_sent');
          setToastMessage('✅ Contrato gerado e enviado via WhatsApp!');
        } catch (err) {
          console.warn('Erro ao enviar WhatsApp:', err);
          setToastMessage('✅ Contrato gerado! Copie o link na aba de Documentos.');
        }
      } else {
        setToastMessage('✅ Contrato gerado com sucesso! Link pronto para assinatura.');
      }

      setShowContractModal(false);
      await loadTabContent(activeTab, selectedPatient.id);
      fetchPatients();
    } catch (err: any) {
      console.error('Erro ao gerar contrato:', err);
      setToastMessage('Erro ao gerar contrato: ' + err.message);
    } finally {
      setGeneratingContract(false);
    }
  };

  const handleDeleteContract = async (contractId: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este contrato?')) return;
    try {
      const { error } = await supabase.from('patient_contracts').delete().eq('id', contractId);
      if (error) throw error;
      setToastMessage('Contrato excluído com sucesso!');
      if (selectedPatient) {
        await loadTabContent(activeTab, selectedPatient.id);
        fetchPatients();
      }
    } catch (err: any) {
      setToastMessage('Erro ao excluir contrato: ' + err.message);
    }
  };

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus]);

  const filteredPatients = patients.filter(p => {
    if (!searchTerm.trim()) {
      // continua para checar filtros de status
    } else {
      const normalize = (str: string) => (str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
      const term = normalize(searchTerm);
      const digits = searchTerm.replace(/\D/g, '');

      const name = normalize(p.name);
      const email = (p.email || '').toLowerCase();
      const cpf = (p.cpf || '').toLowerCase();
      const cpfDigits = (p.cpf || '').replace(/\D/g, '');
      const phoneDigits = (p.phone || '').replace(/\D/g, '');

      const matchesSearch = 
        name.includes(term) ||
        email.includes(term) ||
        cpf.includes(term) ||
        (digits.length > 0 && cpfDigits.includes(digits)) ||
        (digits.length > 0 && phoneDigits.includes(digits));

      if (!matchesSearch) return false;
    }

    if (filterStatus === 'ativo') return p.status === 'Ativo';
    if (filterStatus === 'inativo') return p.status !== 'Ativo';
    
    if (filterStatus === 'anamnese_pendente') {
      return !(Array.isArray(p.patient_anamnesis) ? p.patient_anamnesis.length > 0 : !!p.patient_anamnesis);
    }
    
    if (filterStatus === 'contrato_pendente') {
      return !(Array.isArray(p.patient_contracts) ? p.patient_contracts.some((c: any) => c.status === 'signed') : p.patient_contracts?.status === 'signed');
    }

    return true;
  });

  const totalPages = Math.ceil(filteredPatients.length / itemsPerPage);
  const paginatedPatients = filteredPatients.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const renderIcon = (type: string) => {
      switch(type) {
          case 'appointment': return <Calendar className="w-5 h-5 text-indigo-600" />;
          case 'record': return <ClipboardList className="w-5 h-5 text-emerald-600" />;
          case 'finance': return <DollarSign className="w-5 h-5 text-rose-600" />;
          case 'contract': return <FileText className="w-5 h-5 text-amber-600" />;
          default: return <Activity className="w-5 h-5 text-slate-600" />;
      }
  };

  const renderColor = (type: string) => {
    switch(type) {
        case 'appointment': return "bg-indigo-50 border-indigo-200 text-indigo-900";
        case 'record': return "bg-emerald-50 border-emerald-200 text-emerald-900";
        case 'finance': return "bg-rose-50 border-rose-200 text-rose-900";
        case 'contract': return "bg-amber-50 border-amber-200 text-amber-900";
        default: return "bg-slate-50 border-slate-200 text-slate-900";
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      {/* Header and Search */}
      {!selectedPatient && (
        <>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar pacientes por nome, e-mail..."
                className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 relative">
              <button 
                onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                className="flex items-center gap-2 px-5 py-3 border border-slate-200 bg-white rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <Filter className="w-4 h-4" />
                Filtrar
                {filterStatus !== 'all' && <span className="w-2 h-2 rounded-full bg-indigo-500 ml-1"></span>}
              </button>

              {showFilterDropdown && (
                <div className="absolute top-full mt-2 right-0 w-56 bg-white rounded-xl border border-slate-200 shadow-xl z-50 overflow-hidden text-left">
                  <div className="p-2 space-y-1">
                    <button onClick={() => { setFilterStatus('all'); setShowFilterDropdown(false); }} className={cn("w-full text-left px-4 py-2 text-sm font-bold rounded-lg transition-colors cursor-pointer", filterStatus === 'all' ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50")}>Todos</button>
                    <button onClick={() => { setFilterStatus('ativo'); setShowFilterDropdown(false); }} className={cn("w-full text-left px-4 py-2 text-sm font-bold rounded-lg transition-colors cursor-pointer", filterStatus === 'ativo' ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50")}>Ativos</button>
                    <button onClick={() => { setFilterStatus('inativo'); setShowFilterDropdown(false); }} className={cn("w-full text-left px-4 py-2 text-sm font-bold rounded-lg transition-colors cursor-pointer", filterStatus === 'inativo' ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50")}>Inativos</button>
                    <div className="h-px bg-slate-100 my-1" />
                    <button onClick={() => { setFilterStatus('anamnese_pendente'); setShowFilterDropdown(false); }} className={cn("w-full text-left px-4 py-2 text-sm font-bold rounded-lg transition-colors cursor-pointer", filterStatus === 'anamnese_pendente' ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50")}>Anamnese Pendente</button>
                    <button onClick={() => { setFilterStatus('contrato_pendente'); setShowFilterDropdown(false); }} className={cn("w-full text-left px-4 py-2 text-sm font-bold rounded-lg transition-colors cursor-pointer", filterStatus === 'contrato_pendente' ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50")}>Contrato Pendente</button>
                  </div>
                </div>
              )}
              <button 
                onClick={() => setShowModal(true)}
                className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95"
              >
                <Plus className="w-4 h-4" />
                Novo Paciente
              </button>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-[2rem] overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50/50 border-b border-slate-100">
                  <tr>
                    <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Paciente</th>
                    <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Contato</th>
                    <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cadastrado Em</th>
                    <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status & Info</th>
                    <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loading ? (
                    Array.from({ length: 5 }).map((_, idx) => (
                      <tr key={idx} className="animate-pulse">
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-slate-100" />
                            <div className="space-y-2">
                              <div className="h-4 bg-slate-100 rounded w-28" />
                              <div className="h-3 bg-slate-50 rounded w-16" />
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <div className="space-y-2">
                            <div className="h-3.5 bg-slate-50 rounded w-44" />
                            <div className="h-3.5 bg-slate-50 rounded w-32" />
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <div className="h-4 bg-slate-50 rounded w-20" />
                        </td>
                        <td className="px-8 py-5">
                          <div className="h-5 bg-slate-50 rounded-full w-14" />
                        </td>
                        <td className="px-8 py-5 text-right">
                          <div className="h-8 bg-slate-50 rounded-lg w-8 ml-auto" />
                        </td>
                      </tr>
                    ))
                  ) : paginatedPatients.map((patient) => (
                    <tr 
                      key={patient.id} 
                      onClick={() => handleSelectPatient(patient)}
                      className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
                    >
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-lg group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm">
                            {patient.name?.charAt(0) || '?'}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{patient.name}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase">ID: {patient.id?.split('-')[0]}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm text-slate-600 font-medium">
                            <Mail className="w-3.5 h-3.5 text-indigo-400" />
                            {patient.email || 'Não informado'}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-slate-600 font-medium">
                            <Phone className="w-3.5 h-3.5 text-indigo-400" />
                            {patient.phone || 'Não informado'}
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-2 text-sm text-slate-700 font-bold">
                          <Calendar className="w-4 h-4 text-slate-300" />
                          {new Date(patient.created_at).toLocaleDateString('pt-BR')}
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex flex-col gap-2">
                          <span className={cn(
                            "inline-flex items-center w-fit px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                            patient.status === 'Ativo' ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"
                          )}>
                            {patient.status}
                          </span>
                          <span className={cn(
                            "inline-flex items-center w-fit px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                            (Array.isArray(patient.patient_anamnesis) ? patient.patient_anamnesis.length > 0 : !!patient.patient_anamnesis) ? "bg-indigo-50 text-indigo-600" : "bg-rose-50 text-rose-600"
                          )}>
                            Anamnese: {(Array.isArray(patient.patient_anamnesis) ? patient.patient_anamnesis.length > 0 : !!patient.patient_anamnesis) ? 'Preenchida' : 'Pendente'}
                          </span>
                          <span className={cn(
                            "inline-flex items-center w-fit px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                            (Array.isArray(patient.patient_contracts) ? patient.patient_contracts.some((c: any) => c.status === 'signed') : patient.patient_contracts?.status === 'signed') ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                          )}>
                            Contrato: {(Array.isArray(patient.patient_contracts) ? patient.patient_contracts.some((c: any) => c.status === 'signed') : patient.patient_contracts?.status === 'signed') ? 'Assinado' : 'Pendente'}
                          </span>
                          {patient.last_note && (
                            <div className="mt-1 flex items-start gap-1 p-2 bg-amber-50 border border-amber-200/50 rounded-lg max-w-[200px]">
                              <MessageCircle className="w-3 h-3 text-amber-600 mt-0.5 shrink-0" />
                              <p className="text-[10px] font-bold text-amber-800 leading-tight line-clamp-2" title={patient.last_note}>
                                <span className="opacity-70 mr-1 text-amber-600 uppercase tracking-widest text-[8px]">Última obs:</span>
                                {patient.last_note}
                              </p>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setNotesPatient({ id: patient.id, name: patient.name, phone: patient.phone });
                            }}
                            className="p-2 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-xl transition-colors shadow-sm"
                            title="Anotações / Recados da Recepção"
                          >
                            <StickyNote className="w-4 h-4" />
                          </button>
                          <a 
                            href={`https://wa.me/55${patient.phone?.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="p-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-xl transition-colors shadow-sm"
                            title="Enviar Mensagem (WhatsApp)"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </a>
                          <button className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 hover:text-indigo-600">
                            <MoreVertical className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!loading && filteredPatients.length === 0 && (
              <div className="p-20 text-center space-y-4">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
                  <Search className="w-8 h-8 text-slate-200" />
                </div>
                <p className="text-slate-500 font-medium">Nenhum paciente encontrado.</p>
              </div>
            )}
            
            {!loading && filteredPatients.length > 0 && (
              <div className="px-8 py-5 border-t border-slate-100 flex items-center justify-between bg-slate-50/30">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Página {currentPage} de {Math.max(1, totalPages)} ({filteredPatients.length} pacientes)
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentPage(prev => Math.max(prev - 1, 1));
                    }}
                    disabled={currentPage === 1}
                    className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:pointer-events-none transition-all cursor-pointer"
                  >
                    Anterior
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentPage(prev => Math.min(prev + 1, totalPages));
                    }}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:pointer-events-none transition-all cursor-pointer"
                  >
                    Próxima
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Patient Detail View */}
      {selectedPatient && (
        <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
          <button 
            onClick={() => setSelectedPatient(null)}
            className="flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-indigo-600 transition-colors bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm print:hidden"
          >
            <X className="w-4 h-4" /> Voltar para lista de pacientes
          </button>

          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden min-h-[600px] flex flex-col">
            {/* Detail Header */}
            <div className="p-10 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 rounded-3xl bg-indigo-600 text-white flex items-center justify-center text-3xl font-bold shadow-xl shadow-indigo-100">
                  {selectedPatient.name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-3xl font-bold text-slate-900 tracking-tight">{selectedPatient.name}</h3>
                  <div className="flex items-center gap-4 mt-1">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">ID: {selectedPatient.id.split('-')[0]}</span>
                    <span className="w-1 h-1 rounded-full bg-slate-300" />
                    <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest">{selectedPatient.status}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 print:hidden">
                <button 
                  onClick={() => {
                    setEditPatient({
                      id: selectedPatient.id,
                      name: selectedPatient.name || '',
                      email: selectedPatient.email || '',
                      phone: selectedPatient.phone || '',
                      cpf: selectedPatient.cpf || '',
                      profession: selectedPatient.profession || '',
                      marital_status: selectedPatient.marital_status || '',
                      guardian_name: selectedPatient.guardian_name || '',
                      guardian_cpf: selectedPatient.guardian_cpf || '',
                      cep: selectedPatient.cep || '',
                      address: selectedPatient.address || '',
                      address_number: selectedPatient.address_number || '',
                      neighborhood: selectedPatient.neighborhood || '',
                      city: selectedPatient.city || '',
                      state: selectedPatient.state || '',
                      gender: selectedPatient.gender || '',
                      birth_date: selectedPatient.birth_date || '',
                      status: selectedPatient.status || 'Ativo'
                    });
                    setShowEditModal(true);
                  }}
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-100 flex items-center gap-2"
                >
                  Editar Cadastro
                </button>
                {(user?.role === 'admin' || user?.role === 'atendimento') && (
                  <button 
                    onClick={() => setShowDeleteConfirm(true)}
                    className="px-6 py-3 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 rounded-xl font-bold transition-all flex items-center gap-2"
                  >
                    Excluir Paciente
                  </button>
                )}
                <button onClick={() => window.print()} className="px-6 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm">Imprimir Ficha</button>
              </div>
            </div>

            {/* Tabs Navigation */}
            <div className="flex px-10 border-b border-slate-100 bg-white overflow-x-auto no-scrollbar print:hidden">
              {[
                { id: 'info', label: 'Dados Cadastrais', icon: User },
                { id: 'anamnesis', label: 'Anamnese / Ficha de Entrada', icon: FileText },
                { id: 'history', label: 'Evolução Clínica / Prontuário', icon: History },
                { id: 'homecare', label: 'Autocuidado / Home Care', icon: Heart },
                { id: 'timeline', label: 'Visão 360º & Financeiro', icon: Activity },
                { id: 'docs', label: 'Documentos', icon: Save }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={cn(
                    "py-6 px-4 mr-8 text-sm font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap",
                    activeTab === tab.id ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-400 hover:text-slate-600"
                  )}
                >
                  <tab.icon className="w-4 h-4" /> {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="p-10 flex-1 bg-white">
              {activeTab === 'info' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-8">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 block">Informações Pessoais</label>
                      <div className="space-y-4">
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                          <p className="text-xs text-slate-400 font-medium">Nome Completo</p>
                          <p className="font-bold text-slate-700">{selectedPatient.name}</p>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                          <p className="text-xs text-slate-400 font-medium">E-mail</p>
                          <p className="font-bold text-slate-700">{selectedPatient.email || 'Não informado'}</p>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                          <p className="text-xs text-slate-400 font-medium">Sexo / Gênero</p>
                          <p className="font-bold text-slate-700">{selectedPatient.gender || 'Não informado'}</p>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                          <p className="text-xs text-slate-400 font-medium">Data de Nascimento</p>
                          <p className="font-bold text-slate-700">
                            {selectedPatient.birth_date 
                              ? new Date(selectedPatient.birth_date + 'T12:00:00').toLocaleDateString('pt-BR') 
                              : 'Não informado'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-8">
                     <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 block">Localização & Contato</label>
                      <div className="space-y-4">
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                          <p className="text-xs text-slate-400 font-medium">Endereço</p>
                          <p className="font-bold text-slate-700">{selectedPatient.address || 'Não informado'}</p>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                          <p className="text-xs text-slate-400 font-medium">WhatsApp</p>
                          <p className="font-bold text-slate-700">{selectedPatient.phone || 'Não informado'}</p>
                        </div>

                        <div className="p-6 bg-indigo-50/50 rounded-3xl border border-indigo-100/50 space-y-4 mt-6">
                          <div>
                            <p className="text-xs text-indigo-700 font-bold uppercase tracking-wider flex items-center gap-1.5">
                              <Shield className="w-4 h-4" /> Acesso sem Senha (WhatsApp)
                            </p>
                            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                              Gere e envie um código de acesso temporário via WhatsApp para o paciente entrar no portal dele sem precisar de senha.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={handleSendAccessCode}
                            disabled={sendingCode || !selectedPatient.phone}
                            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                          >
                            {sendingCode ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            Gerar e Enviar Código de Acesso
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'anamnesis' && (
                <div className="max-w-4xl space-y-10 animate-in fade-in duration-500">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-6 mb-6">
                    <div>
                      <h4 className="text-xl font-bold text-slate-900 tracking-tight">Formulário de Anamnese</h4>
                      <p className="text-sm text-slate-500">Documento base para o início do tratamento psicoterapêutico.</p>
                    </div>
                    <button 
                      onClick={handleSendAnamnesisLink}
                      disabled={saving}
                      className="px-5 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 shrink-0"
                    >
                      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Enviar por WhatsApp
                    </button>
                  </div>

                  {loadingTab['anamnesis'] ? (
                    <div className="space-y-8 animate-pulse">
                      <div className="h-24 bg-slate-50 rounded-3xl border border-slate-100" />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="h-44 bg-slate-50 rounded-3xl" />
                        <div className="h-44 bg-slate-50 rounded-3xl" />
                      </div>
                      <div className="h-12 bg-slate-100 rounded-2xl w-40 ml-auto" />
                    </div>
                  ) : user?.role === 'atendimento' ? (
                    // Hide clinical details for reception staff to maintain medical confidentiality
                    <div className="py-12 px-6 text-center bg-slate-50 rounded-3xl border border-slate-200/60 max-w-lg mx-auto">
                      <Shield className="w-10 h-10 text-indigo-500 mx-auto mb-4" />
                      <h5 className="font-extrabold text-slate-800 text-base">Dados de Uso Clínico Restrito</h5>
                      <p className="text-xs text-slate-500 leading-relaxed mt-2 font-medium">
                        Para garantir a confidencialidade e o sigilo profissional do prontuário do paciente, os dados clínicos da Ficha de Anamnese são visíveis apenas para profissionais de saúde autorizados e terapeutas do caso.
                      </p>
                    </div>
                  ) : !isResponsible ? (
                    // Show access restriction screen for unauthorized therapists
                    <div className="py-12 px-6 text-center bg-slate-50 rounded-3xl border border-slate-200/60 max-w-lg mx-auto">
                      <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-4" />
                      <h5 className="font-extrabold text-slate-900 text-base">Acesso Restrito</h5>
                      <p className="text-xs text-slate-500 leading-relaxed mt-2 font-medium">
                        Apenas o terapeuta responsável pelo acompanhamento deste paciente tem permissão para visualizar e editar a Ficha de Anamnese.
                      </p>
                    </div>
                  ) : (
                    // Show full template editor for admin and responsible therapist
                    <div className="space-y-8">
                      {activeTemplate && activeTemplate.fields && activeTemplate.fields.length > 0 ? (
                        // Render dynamic template fields
                        activeTemplate.fields.map((field: any, index: number) => {
                          const val = editResponses[field.id] !== undefined ? editResponses[field.id] : '';
                          return (
                            <section key={field.id} className="space-y-3">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <span className="w-5 h-5 rounded-lg bg-indigo-50 text-indigo-600 font-extrabold flex items-center justify-center text-[9px]">{index + 1}</span>
                                {field.label} {field.required && <span className="text-rose-500">*</span>}
                              </label>
                              {field.type === 'textarea' ? (
                                <textarea 
                                  value={val}
                                  onChange={(e) => setEditResponses({...editResponses, [field.id]: e.target.value})}
                                  className="w-full p-6 bg-slate-50 border border-slate-200 rounded-[2rem] text-slate-700 font-medium leading-relaxed focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                                  rows={5}
                                  placeholder="Digite a resposta..."
                                />
                              ) : field.type === 'date' ? (
                                <input 
                                  type="date"
                                  value={val}
                                  onChange={(e) => setEditResponses({...editResponses, [field.id]: e.target.value})}
                                  className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                                />
                              ) : field.type === 'select' ? (
                                <select 
                                  value={val}
                                  onChange={(e) => setEditResponses({...editResponses, [field.id]: e.target.value})}
                                  className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all appearance-none cursor-pointer w-full md:w-80"
                                >
                                  <option value="">Selecione...</option>
                                  {field.options && field.options.map((opt: string, i: number) => (
                                    <option key={i} value={opt}>{opt}</option>
                                  ))}
                                </select>
                              ) : field.type === 'yesno' ? (
                                <div className="flex gap-3">
                                  {['Sim', 'Não'].map(opt => (
                                    <button
                                      key={opt}
                                      type="button"
                                      onClick={() => setEditResponses({...editResponses, [field.id]: opt})}
                                      className={cn(
                                        "px-8 py-3.5 rounded-xl text-xs font-bold border transition-all active:scale-95",
                                        val === opt 
                                          ? opt === 'Sim' ? "bg-indigo-600 text-white border-indigo-600" : "bg-slate-700 text-white border-slate-700"
                                          : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                                      )}
                                    >
                                      {opt}
                                    </button>
                                  ))}
                                </div>
                              ) : field.type === 'scale' ? (
                                <div className="space-y-3">
                                  <div className="flex flex-wrap gap-2">
                                    {Array.from({ length: 11 }, (_, i) => (
                                      <button
                                        key={i}
                                        type="button"
                                        onClick={() => setEditResponses({...editResponses, [field.id]: i})}
                                        className={cn(
                                          "w-11 h-11 rounded-xl text-xs font-bold transition-all border flex items-center justify-center active:scale-90",
                                          val === i ? "bg-indigo-600 text-white border-indigo-600 shadow-md scale-105" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                                        )}
                                      >
                                        {i}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <input 
                                  type="text"
                                  value={val}
                                  onChange={(e) => setEditResponses({...editResponses, [field.id]: e.target.value})}
                                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                                  placeholder="Digite a resposta..."
                                />
                              )}
                            </section>
                          );
                        })
                      ) : (
                        // Render legacy fallback
                        <>
                          <section className="space-y-3">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                              <AlertCircle className="w-3 h-3" /> Queixa Principal & Motivo da Busca
                            </label>
                            <textarea 
                              value={anamnesis.complaint}
                              onChange={(e) => setAnamnesis({...anamnesis, complaint: e.target.value})}
                              className="w-full p-6 bg-slate-50 border border-slate-200 rounded-[2rem] text-slate-700 font-medium leading-relaxed focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                              rows={5}
                              placeholder="Descreva a queixa principal do paciente..."
                            />
                          </section>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                             <section className="space-y-3">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <Heart className="w-3 h-3" /> Histórico Familiar / Genograma
                              </label>
                              <textarea 
                                value={anamnesis.family_history}
                                onChange={(e) => setAnamnesis({...anamnesis, family_history: e.target.value})}
                                className="w-full p-6 bg-slate-50 border border-slate-200 rounded-[2rem] text-slate-700 font-medium leading-relaxed focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                                rows={4}
                                placeholder="Dinâmica familiar, doenças genéticas..."
                              />
                            </section>
                            <section className="space-y-3">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <MapPin className="w-3 h-3" /> Estilo de Vida & Hábitos
                              </label>
                              <textarea 
                                value={anamnesis.lifestyle}
                                onChange={(e) => setAnamnesis({...anamnesis, lifestyle: e.target.value})}
                                className="w-full p-6 bg-slate-50 border border-slate-200 rounded-[2rem] text-slate-700 font-medium leading-relaxed focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                                rows={4}
                                placeholder="Rotina, vícios, sono, alimentação..."
                              />
                            </section>
                          </div>
                        </>
                      )}

                      <div className="pt-6 border-t border-slate-100 flex justify-end">
                        <button 
                          onClick={handleSaveAnamnesis}
                          disabled={saving}
                          className="px-10 py-4 bg-indigo-600 text-white rounded-[1.5rem] font-bold shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-2 disabled:opacity-50"
                        >
                          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                          Salvar Anamnese
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'history' && (
                <div className="space-y-8 animate-in fade-in duration-500">
                  {loadingTab['history'] ? (
                    <div className="space-y-8 animate-pulse">
                      <div className="h-48 bg-slate-50 rounded-[2rem] border border-slate-100" />
                      <div className="space-y-6">
                        {Array.from({ length: 3 }).map((_, idx) => (
                          <div key={idx} className="pl-10 border-l-2 border-slate-100 pb-10 flex gap-4">
                            <div className="w-4 h-4 rounded-full bg-slate-200" />
                            <div className="flex-1 bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-3">
                              <div className="h-4 bg-slate-200 rounded w-1/4" />
                              <div className="h-4 bg-slate-100 rounded w-full" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100 space-y-4">
                        <h4 className="text-sm font-bold text-slate-700 uppercase tracking-widest flex items-center gap-2">
                          <Clock className="w-4 h-4" /> Registrar Nova Evolução (Prontuário)
                        </h4>
                        <textarea 
                          value={newEvolution}
                          onChange={(e) => setNewEvolution(e.target.value)}
                          className="w-full p-6 bg-white border border-slate-200 rounded-[1.5rem] outline-none focus:ring-2 focus:ring-indigo-500 min-h-[120px] font-medium" 
                          placeholder="Descreva as percepções clínicas e o que ocorreu na sessão de hoje. Esta anotação será salva com data e hora."
                        />

                        {/* Indicadores Clínicos / Emocionais */}
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-6">
                          <h5 className="font-bold text-slate-800 text-sm flex items-center gap-2">📊 Indicadores de Evolução Terapêutica</h5>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            {/* Anxiety */}
                            <div className="space-y-2">
                              <div className="flex justify-between text-xs font-bold text-slate-600">
                                <span>Ansiedade</span>
                                <span className="text-indigo-600 font-extrabold">{indicators.anxiety} / 10</span>
                              </div>
                              <input 
                                type="range" min="0" max="10" step="1"
                                value={indicators.anxiety}
                                onChange={(e) => setIndicators({...indicators, anxiety: parseInt(e.target.value)})}
                                className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                              />
                              <div className="flex justify-between text-[9px] text-slate-400 font-medium">
                                <span>Calmo</span>
                                <span>Crise/Extremo</span>
                              </div>
                            </div>

                            {/* Vitality */}
                            <div className="space-y-2">
                              <div className="flex justify-between text-xs font-bold text-slate-600">
                                <span>Vitalidade / Energia</span>
                                <span className="text-emerald-600 font-extrabold">{indicators.vitality} / 10</span>
                              </div>
                              <input 
                                type="range" min="0" max="10" step="1"
                                value={indicators.vitality}
                                onChange={(e) => setIndicators({...indicators, vitality: parseInt(e.target.value)})}
                                className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                              />
                              <div className="flex justify-between text-[9px] text-slate-400 font-medium">
                                <span>Sem Energia</span>
                                <span>Plena/Vigoroso</span>
                              </div>
                            </div>

                            {/* Physical Pain */}
                            <div className="space-y-2">
                              <div className="flex justify-between text-xs font-bold text-slate-600">
                                <span>Dor Física</span>
                                <span className="text-rose-600 font-extrabold">{indicators.physical_pain} / 10</span>
                              </div>
                              <input 
                                type="range" min="0" max="10" step="1"
                                value={indicators.physical_pain}
                                onChange={(e) => setIndicators({...indicators, physical_pain: parseInt(e.target.value)})}
                                className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-rose-600"
                              />
                              <div className="flex justify-between text-[9px] text-slate-400 font-medium">
                                <span>Sem Dor</span>
                                <span>Dor Extrema</span>
                              </div>
                            </div>

                            {/* Sleep Quality */}
                            <div className="space-y-2">
                              <div className="flex justify-between text-xs font-bold text-slate-600">
                                <span>Qualidade do Sono</span>
                                <span className="text-amber-500 font-bold">{indicators.sleep_quality} / 10</span>
                              </div>
                              <input 
                                type="range" min="0" max="10" step="1"
                                value={indicators.sleep_quality}
                                onChange={(e) => setIndicators({...indicators, sleep_quality: parseInt(e.target.value)})}
                                className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-amber-500"
                              />
                              <div className="flex justify-between text-[9px] text-slate-400 font-medium">
                                <span>Insônia/Péssimo</span>
                                <span>Sono Reparador</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-end">
                          <button 
                            onClick={handleAddEvolution}
                            disabled={saving}
                            className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95 flex items-center gap-2 disabled:opacity-50"
                          >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Salvar e Assinar Evolução
                          </button>
                        </div>
                      </div>
                      
                      <div className="space-y-6 max-h-[500px] overflow-y-auto pr-4 hide-scrollbar">
                        {evolutions.map((evol) => {
                          const isEditing = editingEvolution?.id === evol.id;
                          const isResending = resendingEvolutionId === evol.id;

                          return (
                            <div key={evol.id} className="group relative pl-10 border-l-2 border-slate-100 pb-10 last:pb-0">
                              <div className="absolute top-0 left-[-9px] w-4 h-4 rounded-full bg-white border-2 border-indigo-600 shadow-sm" />
                              <div className="bg-white p-6 rounded-3xl border border-slate-100 group-hover:border-indigo-100 group-hover:shadow-md transition-all shadow-sm space-y-4">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                   <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest">
                                     {evol.type} • {new Date(evol.created_at).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })} às {new Date(evol.created_at).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo'})}
                                   </p>
                                   <div className="flex items-center gap-3">
                                     <span className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1">
                                       <User className="w-3 h-3" /> Assinado Digitalmente
                                     </span>
                                     {!isEditing && (
                                       <button
                                         type="button"
                                         onClick={() => setEditingEvolution({ id: evol.id, notes: evol.notes || '' })}
                                         className="px-3 py-1 bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-600 rounded-lg text-xs font-bold transition-all flex items-center gap-1 shadow-sm"
                                       >
                                         <Edit className="w-3.5 h-3.5" /> Editar / Reenviar
                                       </button>
                                     )}
                                   </div>
                                </div>

                                {isEditing ? (
                                  <div className="space-y-4 bg-slate-50 p-4 rounded-2xl border border-indigo-100 animate-in fade-in duration-200">
                                    <label className="text-xs font-bold text-slate-700 block">Editar Orientação / Anotações:</label>
                                    <textarea
                                      value={editingEvolution.notes}
                                      onChange={(e) => setEditingEvolution({ ...editingEvolution, notes: e.target.value })}
                                      rows={4}
                                      className="w-full p-4 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                                      placeholder="Digite o texto corrigido da orientação..."
                                    />
                                    <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                                      <button
                                        type="button"
                                        onClick={() => setEditingEvolution(null)}
                                        disabled={saving}
                                        className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                                      >
                                        Cancelar
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateEvolution(evol.id, editingEvolution.notes, false)}
                                        disabled={saving}
                                        className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50"
                                      >
                                        {saving && !isResending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                        Salvar Alteração
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateEvolution(evol.id, editingEvolution.notes, true)}
                                        disabled={saving}
                                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-emerald-100 disabled:opacity-50"
                                      >
                                        {isResending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                                        Salvar e Reenviar via WhatsApp
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-slate-600 leading-relaxed font-medium whitespace-pre-wrap">{evol.notes}</p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        {evolutions.length === 0 && (
                          <div className="text-center py-10 text-slate-400 font-medium">Nenhuma evolução registrada para este paciente ainda.</div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              {activeTab === 'timeline' && (
                <div className="space-y-12 animate-in fade-in duration-500">
                  {loadingTimeline || loadingTab['timeline'] ? (
                    <div className="space-y-12 animate-pulse">
                      <div className="h-80 bg-slate-50 rounded-[2rem] border border-slate-100" />
                      <div className="space-y-6">
                        <div className="h-6 bg-slate-200 rounded w-1/4" />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="h-32 bg-slate-50 rounded-[2rem]" />
                          <div className="h-32 bg-slate-50 rounded-[2rem]" />
                        </div>
                      </div>
                      <div className="space-y-8">
                        <div className="h-6 bg-slate-200 rounded w-1/4" />
                        {Array.from({ length: 3 }).map((_, idx) => (
                          <div key={idx} className="flex items-center gap-6">
                            <div className="w-12 h-12 rounded-full bg-slate-200" />
                            <div className="flex-1 h-24 bg-slate-50 rounded-[2rem]" />
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Gráfico de Evolução Emocional/Física */}
                      {patientIndicators.length > 0 && (
                        <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-4 mb-10">
                          <h4 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                            <TrendingUp className="w-6 h-6 text-indigo-600"/> Gráfico de Evolução Emocional e Física
                          </h4>
                          <p className="text-sm text-slate-500 font-medium">Acompanhe o progresso das avaliações do paciente ao longo do tempo (escala de 0 a 10).</p>
                          <div className="w-full h-80 pt-4 min-h-[250px]">
                            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={250}>
                              <LineChart data={patientIndicators.map(ind => ({
                                date: new Date(ind.created_at).toLocaleDateString('pt-BR'),
                                ansiedade: ind.anxiety,
                                vitalidade: ind.vitality,
                                dor: ind.physical_pain,
                                sono: ind.sleep_quality
                              }))} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                <XAxis dataKey="date" stroke="#94a3b8" style={{ fontSize: 10, fontWeight: 'bold' }} />
                                <YAxis domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} stroke="#94a3b8" style={{ fontSize: 10, fontWeight: 'bold' }} />
                                <Tooltip contentStyle={{ borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                                <Legend wrapperStyle={{ fontSize: 12, fontWeight: 'bold', paddingTop: 10 }} />
                                <Line type="monotone" dataKey="ansiedade" name="Ansiedade" stroke="#6366f1" strokeWidth={3} activeDot={{ r: 8 }} />
                                <Line type="monotone" dataKey="vitalidade" name="Vitalidade" stroke="#10b981" strokeWidth={3} />
                                <Line type="monotone" dataKey="dor" name="Dor Física" stroke="#ef4444" strokeWidth={3} />
                                <Line type="monotone" dataKey="sono" name="Qualidade do Sono" stroke="#f59e0b" strokeWidth={3} />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      )}

                      {/* Pacotes Ativos */}
                      <div>
                        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                          <h4 className="text-xl font-bold text-slate-900 flex items-center gap-2"><Award className="w-6 h-6 text-indigo-600"/> Créditos & Pacotes</h4>
                          <button
                            type="button"
                            onClick={() => handleOpenManualContractModal()}
                            className="px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl transition-all flex items-center gap-2 shadow-sm active:scale-95"
                          >
                            <FileText className="w-4 h-4" /> Gerar Contrato Manual / Forçado
                          </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {patientPackages.map(pkg => {
                                const progress = Math.min((pkg.used_sessions / pkg.total_sessions) * 100, 100);
                                return (
                                    <div key={pkg.id} className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
                                        <div className="flex justify-between items-start">
                                            <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center"><Award className="w-5 h-5"/></div>
                                            <span className={cn(
                                                "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                                                pkg.status === 'active' ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"
                                            )}>
                                                {pkg.status === 'active' ? 'Ativo' : 'Concluído'}
                                            </span>
                                        </div>
                                        <div>
                                          <h5 className="font-bold text-slate-900 mb-1">{pkg.services?.name || 'Pacote de Terapias'}</h5>
                                          <p className="text-xs text-slate-500 font-medium">{pkg.services?.type || `${pkg.total_sessions} Sessões`}</p>
                                        </div>
                                        
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase">
                                                <span>Utilizado</span>
                                                <span>{pkg.used_sessions} de {pkg.total_sessions}</span>
                                            </div>
                                            <div className="w-full bg-slate-200 rounded-full h-2">
                                                <div className="bg-indigo-600 h-2 rounded-full transition-all" style={{ width: `${progress}%` }}></div>
                                            </div>
                                        </div>

                                        <div className="pt-3 border-t border-slate-200/60 flex items-center gap-2">
                                          <button
                                            type="button"
                                            onClick={() => handleOpenManualContractModal(pkg)}
                                            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-100 active:scale-95"
                                          >
                                            <FileText className="w-3.5 h-3.5" /> Gerar / Emitir Contrato Deste Pacote
                                          </button>
                                        </div>
                                    </div>
                                );
                            })}
                            {patientPackages.length === 0 && (
                                <div className="col-span-full text-center py-10 text-slate-400 font-medium border border-dashed border-slate-200 rounded-[2rem]">
                                    Nenhum pacote ou crédito ativo.
                                </div>
                            )}
                        </div>
                      </div>

                      {/* Linha do Tempo */}
                      <div>
                        <h4 className="text-xl font-bold text-slate-900 mb-8 flex items-center gap-2"><Activity className="w-6 h-6 text-indigo-600"/> Linha do Tempo</h4>
                        <div className="max-h-[600px] overflow-y-auto pr-4 custom-scrollbar">
                            <div className="space-y-8 relative before:absolute before:inset-0 before:ml-6 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-indigo-100 before:via-slate-200 before:to-transparent">
                                {timelineEvents.map((evt, idx) => (
                                    <div key={evt.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                                        <div className={cn(
                                            "flex items-center justify-center w-12 h-12 rounded-full border-4 border-white shadow-md shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 relative z-10 transition-transform group-hover:scale-110",
                                            evt.type === 'appointment' ? "bg-indigo-100" : 
                                            evt.type === 'record' ? "bg-emerald-100" : 
                                            evt.type === 'contract' ? "bg-amber-100" : "bg-rose-100"
                                        )}>
                                            {renderIcon(evt.type)}
                                        </div>
                                        
                                        <div className={cn(
                                            "w-[calc(100%-4rem)] md:w-[calc(50%-3rem)] p-6 rounded-[2rem] shadow-sm border transition-all hover:shadow-md",
                                            renderColor(evt.type)
                                        )}>
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-[10px] font-black uppercase tracking-widest opacity-70">
                                                    {evt.date.toLocaleDateString('pt-BR')} às {evt.date.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}
                                                </span>
                                            </div>
                                            <h5 className="text-lg font-black mb-1">{evt.title}</h5>
                                            <p className="text-sm font-medium opacity-80 leading-relaxed mb-3">{evt.description}</p>
                                            
                                            {evt.type === 'contract' && (
                                                <button 
                                                    onClick={() => handleResendContract(evt.id.replace('contract-', ''), selectedPatient?.name, selectedPatient?.phone)}
                                                    className="px-4 py-2 bg-white/50 hover:bg-white rounded-lg text-amber-700 text-xs font-bold transition-colors border border-amber-200/50 flex items-center gap-2"
                                                >
                                                    <Send className="w-3 h-3" />
                                                    Reenviar por WhatsApp
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {timelineEvents.length === 0 && (
                                    <div className="text-center py-20 text-slate-400 font-medium">Nenhum evento registrado ainda.</div>
                                )}
                            </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {activeTab === 'homecare' && (
                <div className="space-y-8 animate-in fade-in duration-500">
                  {loadingTab['homecare'] ? (
                    <div className="space-y-8 animate-pulse">
                      <div className="h-48 bg-slate-50 rounded-[2rem] border border-slate-100" />
                      <div className="space-y-4">
                        <div className="h-6 bg-slate-200 rounded w-1/4" />
                        {Array.from({ length: 2 }).map((_, idx) => (
                          <div key={idx} className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-4">
                            <div className="h-4 bg-slate-200 rounded w-1/3" />
                            <div className="grid grid-cols-2 gap-4">
                              <div className="h-16 bg-slate-100 rounded-2xl" />
                              <div className="h-16 bg-slate-100 rounded-2xl" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100 space-y-6">
                        <h4 className="text-sm font-bold text-slate-700 uppercase tracking-widest flex items-center gap-2">
                          <Heart className="w-4 h-4 text-rose-500" /> Prescrever Autocuidado / Home Care
                        </h4>
                        <p className="text-sm text-slate-500 font-medium">Recomende florais, fitoterápicos, meditações ou práticas diárias para o paciente fazer em casa. A prescrição será enviada de forma estruturada via WhatsApp.</p>
                        
                        <div className="space-y-4">
                          {newPrescriptionItems.map((item, idx) => (
                            <div key={idx} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 relative">
                              {newPrescriptionItems.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => setNewPrescriptionItems(newPrescriptionItems.filter((_, i) => i !== idx))}
                                  className="absolute top-4 right-4 p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              )}
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tipo de Orientação</label>
                                  <select
                                    value={item.type}
                                    onChange={(e) => {
                                      const newItems = [...newPrescriptionItems];
                                      newItems[idx].type = e.target.value;
                                      setNewPrescriptionItems(newItems);
                                    }}
                                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-slate-700 cursor-pointer appearance-none"
                                  >
                                    <option value="floral">🌸 Floral de Bach / Frequencial</option>
                                    <option value="ervas">🌿 Fitoterapia / Ervas / Chá</option>
                                    <option value="exercicio">🧘 Prática / Exercício / Meditação</option>
                                    <option value="outro">📝 Outros Autocuidados</option>
                                  </select>
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nome do Recomendado / Prática</label>
                                  <input
                                    type="text"
                                    value={item.name}
                                    onChange={(e) => {
                                      const newItems = [...newPrescriptionItems];
                                      newItems[idx].name = e.target.value;
                                      setNewPrescriptionItems(newItems);
                                    }}
                                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-slate-700"
                                    placeholder="Ex: Floral Rescue Remedy, Meditação Mindfulness de 10 min..."
                                  />
                                </div>
                              </div>
                              <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Instruções de Uso / Posologia / Guia</label>
                                <textarea
                                  value={item.usage}
                                  onChange={(e) => {
                                    const newItems = [...newPrescriptionItems];
                                    newItems[idx].usage = e.target.value;
                                      setNewPrescriptionItems(newItems);
                                  }}
                                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none font-medium text-slate-700 min-h-[80px]"
                                  placeholder="Ex: Tomar 4 gotas sublinguais 4x ao dia. Praticar pela manhã logo após acordar."
                                />
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="flex justify-between items-center pt-2">
                          <button
                            type="button"
                            onClick={() => setNewPrescriptionItems([...newPrescriptionItems, { type: 'floral', name: '', usage: '' }])}
                            className="px-5 py-3 border border-indigo-200 hover:border-indigo-500 text-indigo-600 bg-white rounded-xl text-xs font-bold transition-all flex items-center gap-2"
                          >
                            + Adicionar Item de Autocuidado
                          </button>
                          <button
                            onClick={handleSavePrescription}
                            disabled={saving}
                            className="px-8 py-3.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center gap-2 disabled:opacity-50"
                          >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            Salvar e Enviar WhatsApp
                          </button>
                        </div>
                      </div>

                      {/* Past Prescriptions History */}
                      <div className="space-y-6">
                        <h4 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                          <History className="w-5 h-5 text-indigo-600" /> Histórico de Prescrições Home Care
                        </h4>
                        <div className="space-y-4">
                          {prescriptions.map((presc) => (
                            <div key={presc.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                              <div className="flex justify-between items-center">
                                <p className="text-xs font-bold text-indigo-600">
                                  Prescrito em {new Date(presc.created_at).toLocaleDateString('pt-BR')} às {new Date(presc.created_at).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}
                                </p>
                                <button
                                  onClick={() => handleResendPrescription(presc)}
                                  disabled={saving}
                                  className="px-4 py-2 bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 rounded-xl text-xs font-bold border border-slate-200 hover:border-indigo-200 transition-colors flex items-center gap-1.5"
                                >
                                  <Send className="w-3.5 h-3.5" /> Reenviar WhatsApp
                                </button>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {presc.items?.map((item: any, i: number) => (
                                  <div key={i} className="p-4 bg-slate-50 rounded-2xl border border-slate-200/50 flex gap-3">
                                    <span className="text-2xl mt-0.5">
                                      {item.type === 'floral' ? '🌸' : item.type === 'ervas' ? '🌿' : item.type === 'exercicio' ? '🧘' : '📝'}
                                    </span>
                                    <div>
                                      <h5 className="font-bold text-slate-900 text-sm">{item.name}</h5>
                                      <p className="text-xs text-slate-400 font-bold uppercase">{item.type}</p>
                                      <p className="text-xs text-slate-600 font-semibold mt-1 bg-white p-2 rounded-lg border border-slate-100 whitespace-pre-wrap">{item.usage}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                          {prescriptions.length === 0 && (
                            <div className="text-center py-10 text-slate-400 font-medium">Nenhuma recomendação de autocuidado prescrita ainda.</div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {activeTab === 'docs' && (
                <div className="space-y-8 animate-in fade-in duration-500">
                  {/* Seção de Contratos de Prestação de Serviços */}
                  <div className="bg-slate-50 p-6 md:p-8 rounded-[2.5rem] border border-slate-100 space-y-6">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
                          <Shield className="w-5 h-5 text-indigo-600" /> Contratos Digitais de Prestação de Serviços
                        </h4>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">Emita termos de serviço com assinatura digital com validade jurídica e envio automático via WhatsApp.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleOpenManualContractModal()}
                        className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold transition-all shadow-md shadow-indigo-100 flex items-center gap-2 active:scale-95"
                      >
                        <Plus className="w-4 h-4" /> Gerar Contrato (Venda / Manual)
                      </button>
                    </div>

                    {/* Lista de Contratos */}
                    {documents.filter(d => d.source === 'contract').length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {documents.filter(d => d.source === 'contract').map(doc => {
                          const isSigned = doc.title?.toLowerCase().includes('assinado');
                          return (
                            <div key={doc.id} className="p-5 bg-white border border-slate-200/80 rounded-2xl flex flex-col justify-between gap-4 shadow-sm hover:border-indigo-200 transition-all">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-3 overflow-hidden">
                                  <div className={cn(
                                    "w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg shrink-0",
                                    isSigned ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                                  )}>
                                    📄
                                  </div>
                                  <div className="truncate">
                                    <h5 className="font-bold text-slate-900 text-sm truncate">{doc.title}</h5>
                                    <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
                                      Emitido em {new Date(doc.created_at).toLocaleDateString('pt-BR')} às {new Date(doc.created_at).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}
                                    </p>
                                  </div>
                                </div>
                                <span className={cn(
                                  "px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shrink-0",
                                  isSigned ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                                )}>
                                  {isSigned ? 'Assinado' : 'Pendente'}
                                </span>
                              </div>

                              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(doc.file_url);
                                    setToastMessage('📋 Link do contrato copiado!');
                                  }}
                                  className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-slate-200"
                                  title="Copiar link de assinatura"
                                >
                                  <Copy className="w-3.5 h-3.5" /> Copiar Link
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleResendContract(doc.original_id, selectedPatient?.name, selectedPatient?.phone)}
                                  className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-emerald-200"
                                  title="Reenviar link no WhatsApp do paciente"
                                >
                                  <Send className="w-3.5 h-3.5" /> Reenviar WhatsApp
                                </button>
                                <a
                                  href={doc.file_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-indigo-200"
                                  title="Abrir contrato em nova aba"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" /> Visualizar
                                </a>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteContract(doc.original_id)}
                                  className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                                  title="Excluir contrato"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="py-8 text-center bg-white rounded-2xl border border-dashed border-slate-200">
                        <p className="text-3xl mb-1">📄</p>
                        <p className="font-bold text-slate-700 text-sm">Nenhum contrato gerado para este paciente ainda.</p>
                        <p className="text-xs text-slate-400 mt-1">Clique no botão acima ou no pacote do paciente para emitir o termo de serviço.</p>
                      </div>
                    )}
                  </div>

                  {/* Seção de Upload de Arquivos / Laudos */}
                  <div className="space-y-4">
                    <div className="flex flex-col gap-4">
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        onChange={handleFileUpload} 
                      />
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingDoc}
                        className="w-full py-10 border-2 border-dashed border-slate-200 rounded-[2rem] text-slate-400 font-bold hover:border-indigo-300 hover:text-indigo-500 hover:bg-indigo-50/50 transition-all flex flex-col items-center justify-center gap-2 disabled:opacity-50"
                      >
                         <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center">
                            {uploadingDoc ? <Loader2 className="w-6 h-6 animate-spin text-indigo-600" /> : <Plus className="w-6 h-6" />}
                         </div>
                         <span className="text-sm">{uploadingDoc ? 'Enviando documento...' : 'Anexar Novo Arquivo (Laudo, Exame ou Receita)'}</span>
                      </button>
                    </div>

                    {documents.filter(d => d.source === 'upload').length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-sm font-bold text-slate-700 uppercase tracking-widest flex items-center gap-2 mb-2">
                          <FileText className="w-4 h-4" /> Outros Documentos Anexados
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {documents.filter(d => d.source === 'upload').map(doc => (
                            <div key={doc.id} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between group">
                              <div className="flex items-center gap-3 overflow-hidden">
                                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-indigo-600 shadow-sm shrink-0">
                                  <File className="w-4 h-4" />
                                </div>
                                <div className="truncate">
                                  <h5 className="font-bold text-slate-900 text-sm truncate" title={doc.title}>{doc.title}</h5>
                                  <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                                    {new Date(doc.created_at).toLocaleDateString('pt-BR')} às {new Date(doc.created_at).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <a 
                                  href={doc.file_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="w-9 h-9 flex items-center justify-center bg-white rounded-xl text-slate-400 hover:text-indigo-600 hover:shadow-sm border border-slate-200 transition-all"
                                  title="Visualizar / Baixar"
                                >
                                  <FileText className="w-4 h-4" />
                                </a>
                                <button 
                                  onClick={() => handleDeleteDocument(doc)}
                                  className="w-9 h-9 flex items-center justify-center bg-white rounded-xl text-slate-400 hover:text-rose-600 hover:shadow-sm border border-slate-200 transition-all"
                                  title="Excluir"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* New Patient Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] w-full max-w-xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600 shadow-sm">
                  <User className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 tracking-tight">Novo Paciente Clínica</h3>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-50 rounded-full transition-colors text-slate-400">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleAddPatient} className="p-8 space-y-6 overflow-y-auto max-h-[70vh]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Nome Completo *</label>
                  <input required value={newPatient.name} onChange={e => setNewPatient({...newPatient, name: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700" placeholder="Nome do paciente" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">CPF *</label>
                  <input required value={newPatient.cpf} onChange={e => setNewPatient({...newPatient, cpf: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700" placeholder="000.000.000-00" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">E-mail *</label>
                  <input required type="email" value={newPatient.email} onChange={e => setNewPatient({...newPatient, email: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700" placeholder="email@exemplo.com" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">WhatsApp *</label>
                  <input required value={newPatient.phone} onChange={e => setNewPatient({...newPatient, phone: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700" placeholder="(00) 00000-0000" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Sexo / Gênero *</label>
                  <select required value={newPatient.gender} onChange={e => setNewPatient({...newPatient, gender: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700">
                    <option value="">Selecione</option>
                    <option value="masculino">Masculino</option>
                    <option value="feminino">Feminino</option>
                    <option value="outro">Outro</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Data de Nascimento *</label>
                  <input required type="date" value={newPatient.birth_date} onChange={e => setNewPatient({...newPatient, birth_date: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700" />
                </div>
              </div>
              
              <div className="pt-4 border-t border-slate-100">
                 <h4 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2"><MapPin className="w-4 h-4 text-indigo-500" /> Endereço</h4>
                 <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">CEP *</label>
                      <input required value={newPatient.cep} onChange={e => setNewPatient({...newPatient, cep: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700" placeholder="00000-000" />
                    </div>
                    <div className="space-y-2 md:col-span-4">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Rua / Logradouro *</label>
                      <input required value={newPatient.address} onChange={e => setNewPatient({...newPatient, address: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700" placeholder="Nome da rua" />
                    </div>
                    <div className="space-y-2 md:col-span-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Número *</label>
                      <input required value={newPatient.address_number} onChange={e => setNewPatient({...newPatient, address_number: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700" placeholder="123" />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Bairro *</label>
                      <input required value={newPatient.neighborhood} onChange={e => setNewPatient({...newPatient, neighborhood: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700" placeholder="Bairro" />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Cidade *</label>
                      <input required value={newPatient.city} onChange={e => setNewPatient({...newPatient, city: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700" placeholder="Cidade" />
                    </div>
                    <div className="space-y-2 md:col-span-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">UF *</label>
                      <input required value={newPatient.state} onChange={e => setNewPatient({...newPatient, state: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700 text-center uppercase" placeholder="UF" maxLength={2} />
                    </div>
                 </div>
              </div>

               <div className="pt-4 border-t border-slate-100">
                  <h4 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-indigo-500" /> Documentação & Contrato
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div className="space-y-2">
                       <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Profissão / Ocupação</label>
                       <input value={newPatient.profession} onChange={e => setNewPatient({...newPatient, profession: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700" placeholder="Ex: Professor(a)" />
                     </div>
                     <div className="space-y-2">
                       <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Estado Civil</label>
                       <input value={newPatient.marital_status} onChange={e => setNewPatient({...newPatient, marital_status: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700" placeholder="Solteiro(a), Casado(a)..." />
                     </div>
                     <div className="space-y-2">
                       <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Nome do Responsável (se menor)</label>
                       <input value={newPatient.guardian_name} onChange={e => setNewPatient({...newPatient, guardian_name: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700" placeholder="Nome do pai/mãe/responsável" />
                     </div>
                     <div className="space-y-2">
                       <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">CPF do Responsável</label>
                       <input value={newPatient.guardian_cpf} onChange={e => setNewPatient({...newPatient, guardian_cpf: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700" placeholder="000.000.000-00" />
                     </div>
                  </div>
               </div>

              <div className="pt-4 border-t border-slate-100">
                <label className="flex items-center gap-3 cursor-pointer group w-fit">
                  <div className={cn(
                    "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all",
                    sendWelcomeMsg ? "bg-emerald-500 border-emerald-500 text-white" : "bg-slate-50 border-slate-300 text-transparent group-hover:border-indigo-400"
                  )}>
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-bold text-slate-700 select-none">Enviar WhatsApp de Boas Vindas com acesso ao portal</span>
                  <input type="checkbox" className="hidden" checked={sendWelcomeMsg} onChange={(e) => setSendWelcomeMsg(e.target.checked)} />
                </label>
              </div>

              <div className="pt-6 flex gap-4">
                <button 
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-4 bg-slate-50 text-slate-600 rounded-2xl font-bold hover:bg-slate-100 transition-all border border-slate-200"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} 
                  Cadastrar Paciente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Patient Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] w-full max-w-xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600 shadow-sm">
                  <User className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 tracking-tight">Editar Paciente</h3>
              </div>
              <button onClick={() => setShowEditModal(false)} className="p-2 hover:bg-slate-50 rounded-full transition-colors text-slate-400">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleUpdatePatient} className="p-8 space-y-6 overflow-y-auto max-h-[70vh]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Nome Completo *</label>
                  <input required value={editPatient.name} onChange={e => setEditPatient({...editPatient, name: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700" placeholder="Nome do paciente" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">CPF *</label>
                  <input required value={editPatient.cpf} onChange={e => setEditPatient({...editPatient, cpf: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700" placeholder="000.000.000-00" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">E-mail *</label>
                  <input required type="email" value={editPatient.email} onChange={e => setEditPatient({...editPatient, email: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700" placeholder="email@exemplo.com" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">WhatsApp *</label>
                  <input required value={editPatient.phone} onChange={e => setEditPatient({...editPatient, phone: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700" placeholder="(00) 00000-0000" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Sexo / Gênero *</label>
                  <select required value={editPatient.gender} onChange={e => setEditPatient({...editPatient, gender: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700">
                    <option value="">Selecione</option>
                    <option value="masculino">Masculino</option>
                    <option value="feminino">Feminino</option>
                    <option value="outro">Outro</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Data de Nascimento *</label>
                  <input required type="date" value={editPatient.birth_date} onChange={e => setEditPatient({...editPatient, birth_date: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700" />
                </div>
                <div className="space-y-2 col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Status *</label>
                  <select required value={editPatient.status} onChange={e => setEditPatient({...editPatient, status: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700">
                    <option value="Ativo">Ativo</option>
                    <option value="Inativo">Inativo</option>
                  </select>
                </div>
              </div>
              
              <div className="pt-4 border-t border-slate-100">
                 <h4 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2"><MapPin className="w-4 h-4 text-indigo-500" /> Endereço</h4>
                 <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">CEP *</label>
                      <input required value={editPatient.cep} onChange={e => setEditPatient({...editPatient, cep: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700" placeholder="00000-000" />
                    </div>
                    <div className="space-y-2 md:col-span-4">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Rua / Logradouro *</label>
                      <input required value={editPatient.address} onChange={e => setEditPatient({...editPatient, address: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700" placeholder="Nome da rua" />
                    </div>
                    <div className="space-y-2 md:col-span-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Número *</label>
                      <input required value={editPatient.address_number} onChange={e => setEditPatient({...editPatient, address_number: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700" placeholder="123" />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Bairro *</label>
                      <input required value={editPatient.neighborhood} onChange={e => setEditPatient({...editPatient, neighborhood: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700" placeholder="Bairro" />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Cidade *</label>
                      <input required value={editPatient.city} onChange={e => setEditPatient({...editPatient, city: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700" placeholder="Cidade" />
                    </div>
                    <div className="space-y-2 md:col-span-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">UF *</label>
                  <input required value={editPatient.state} onChange={e => setEditPatient({...editPatient, state: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700 text-center uppercase" placeholder="UF" maxLength={2} />
                    </div>
                 </div>
              </div>

              <div className="pt-4 border-t border-slate-100">
                 <h4 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                   <Shield className="w-4 h-4 text-indigo-500" /> Documentação & Contrato
                 </h4>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Profissão / Ocupação</label>
                      <input value={editPatient.profession} onChange={e => setEditPatient({...editPatient, profession: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700" placeholder="Ex: Professor(a)" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Estado Civil</label>
                      <input value={editPatient.marital_status} onChange={e => setEditPatient({...editPatient, marital_status: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700" placeholder="Solteiro(a), Casado(a)..." />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Nome do Responsável (se menor)</label>
                      <input value={editPatient.guardian_name} onChange={e => setEditPatient({...editPatient, guardian_name: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700" placeholder="Nome do pai/mãe/responsável" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">CPF do Responsável</label>
                      <input value={editPatient.guardian_cpf} onChange={e => setEditPatient({...editPatient, guardian_cpf: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700" placeholder="000.000.000-00" />
                    </div>
                 </div>
              </div>

              <div className="pt-6 flex gap-4">
                <button 
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 py-4 bg-slate-50 text-slate-600 rounded-2xl font-bold hover:bg-slate-100 transition-all border border-slate-200"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} 
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Emissão Manual / Forçada de Contrato */}
      {showContractModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 md:p-6 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] w-full max-w-xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 md:p-8 border-b border-slate-100 flex items-center justify-between shrink-0 bg-gradient-to-r from-indigo-50/50 to-white">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-md shadow-indigo-100">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">Gerar Contrato de Serviço</h3>
                  <p className="text-xs text-slate-400 font-bold mt-0.5">Paciente: {selectedPatient?.name}</p>
                </div>
              </div>
              <button 
                onClick={() => setShowContractModal(false)} 
                className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar flex-1 space-y-6">
              <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-start gap-3">
                <span className="text-2xl shrink-0">💡</span>
                <p className="text-xs text-indigo-900 font-medium leading-relaxed">
                  O sistema irá preencher o <strong>Termo de Compromisso Terapêutico</strong> com os dados cadastrais do paciente (CPF, endereço, telefone), número de sessões e valor acordado, gerando o link seguro de assinatura digital.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Descrição / Nome do Pacote ou Serviço</label>
                  <input
                    type="text"
                    value={contractData.service_name}
                    onChange={e => setContractData({ ...contractData, service_name: e.target.value })}
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Ex: Pacote 8 Sessões Terapêuticas, Terapia Integrativa..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Qtd. de Sessões Contratadas</label>
                    <input
                      type="number"
                      min="1"
                      value={contractData.total_sessions}
                      onChange={e => setContractData({ ...contractData, total_sessions: e.target.value })}
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Ex: 8"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Sessões Bônus / Extensão</label>
                    <input
                      type="number"
                      min="0"
                      value={contractData.extension_sessions}
                      onChange={e => setContractData({ ...contractData, extension_sessions: e.target.value })}
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Ex: 0"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Valor Total do Pacote (R$)</label>
                    <input
                      type="text"
                      value={contractData.price}
                      onChange={e => setContractData({ ...contractData, price: e.target.value })}
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black text-emerald-600 outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Ex: 7200.00"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Terapeuta Responsável</label>
                    <input
                      type="text"
                      value={contractData.therapist_name}
                      onChange={e => setContractData({ ...contractData, therapist_name: e.target.value })}
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Nome do terapeuta..."
                    />
                  </div>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200/70 rounded-2xl space-y-1 text-xs text-slate-600">
                  <div className="flex justify-between">
                    <span className="font-bold">CPF do Paciente:</span>
                    <span>{selectedPatient?.cpf || 'Não cadastrado'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-bold">WhatsApp:</span>
                    <span>{selectedPatient?.phone || 'Não cadastrado'}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 md:p-8 border-t border-slate-100 bg-slate-50/50 flex gap-4 shrink-0">
              <button
                type="button"
                onClick={() => setShowContractModal(false)}
                disabled={generatingContract}
                className="flex-1 py-4 bg-white hover:bg-slate-100 text-slate-600 rounded-2xl font-bold transition-all border border-slate-200"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleGenerateContract}
                disabled={generatingContract}
                className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold shadow-xl shadow-indigo-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95"
              >
                {generatingContract ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                {generatingContract ? 'Emitindo...' : 'Emitir e Enviar Contrato'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl z-[200] animate-in slide-in-from-bottom-4 flex items-center gap-3 font-bold">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          {toastMessage}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl border border-slate-100 p-10 text-center space-y-6 animate-in zoom-in duration-300">
            <div className="w-20 h-20 bg-rose-50 border border-rose-100 rounded-full flex items-center justify-center mx-auto text-rose-500 shadow-sm">
              <AlertCircle className="w-10 h-10" />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Excluir Paciente?</h3>
              <p className="text-slate-500 text-sm leading-relaxed">
                Esta ação é irreversível. Todos os dados associados a <strong>{selectedPatient?.name}</strong> (agendamentos, faturas, prontuários, fichas de anamnese) serão excluídos permanentemente.
              </p>
            </div>
            <div className="flex gap-4 pt-2">
              <button 
                onClick={() => setShowDeleteConfirm(false)} 
                className="flex-1 py-4 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-2xl font-bold transition-all"
                disabled={saving}
              >
                Cancelar
              </button>
              <button 
                onClick={confirmDeletePatient} 
                className="flex-1 py-4 bg-rose-600 text-white hover:bg-rose-700 rounded-2xl font-bold transition-all shadow-xl shadow-rose-100 flex items-center justify-center gap-2"
                disabled={saving}
              >
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirmar Exclusão'}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedPatient && (
        <div id="print-document" className="hidden p-8 max-w-4xl mx-auto space-y-8 bg-white text-slate-800">
          {/* Header */}
          <div className="flex items-center justify-between border-b-2 border-indigo-600 pb-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-2xl shadow-md">T</div>
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">TZION TERAPIAS</h1>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Clínica de Terapias Integradas & Desenvolvimento Humano</p>
              </div>
            </div>
            <div className="text-right text-xs text-slate-500 leading-normal">
              <p className="font-bold text-slate-800">CNPJ: 50.123.456/0001-89</p>
              <p>WhatsApp: (11) 98765-4321</p>
              <p>Email: contato@tzion.com.br</p>
            </div>
          </div>

          {/* Document Title */}
          <div className="text-center py-4 bg-slate-50 rounded-2xl border border-slate-100 print-page-break-avoid">
            <h2 className="text-lg font-black text-slate-900 tracking-wide uppercase">Ficha de Anamnese Clínica</h2>
            <p className="text-[10px] text-slate-500 font-bold mt-1">REGISTRO DE ADMISSÃO E HISTÓRICO DE SAÚDE MENTAL</p>
          </div>

          {/* Patient Details Section */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden print-page-break-avoid">
            <div className="bg-slate-50 border-b border-slate-200 px-6 py-3">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Identificação do Paciente</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 text-xs font-medium text-slate-700">
              <div className="col-span-2">
                <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider mb-1">Nome Completo</span>
                <p className="text-sm font-bold text-slate-900">{selectedPatient.name}</p>
              </div>
              <div>
                <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider mb-1">CPF</span>
                <p className="text-sm font-bold text-slate-900">{selectedPatient.cpf || 'Não Informado'}</p>
              </div>
              <div>
                <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider mb-1">WhatsApp</span>
                <p className="text-sm font-bold text-slate-900">{selectedPatient.phone || 'Não Informado'}</p>
              </div>
              <div className="col-span-2">
                <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider mb-1">E-mail</span>
                <p className="text-sm font-bold text-slate-900">{selectedPatient.email || 'Não Informado'}</p>
              </div>
              <div className="col-span-2">
                <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider mb-1">Endereço</span>
                <p className="text-sm font-bold text-slate-900">
                  {selectedPatient.address ? `${selectedPatient.address}, ${selectedPatient.address_number || 'S/N'}` : 'Não Informado'}
                </p>
              </div>
              <div>
                <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider mb-1">Bairro</span>
                <p className="text-sm font-bold text-slate-900">{selectedPatient.neighborhood || 'Não Informado'}</p>
              </div>
              <div>
                <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider mb-1">Cidade / UF</span>
                <p className="text-sm font-bold text-slate-900">
                  {selectedPatient.city ? `${selectedPatient.city}/${selectedPatient.state || 'UF'}` : 'Não Informado'}
                </p>
              </div>
            </div>
          </div>

          {/* Anamnesis Answers Section */}
          <div className="space-y-6">
            <div className="border-b border-slate-200 pb-2">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Respostas da Anamnese</h3>
            </div>
            {activeTemplate && activeTemplate.fields && activeTemplate.fields.length > 0 ? (
              // Dynamic fields printout
              activeTemplate.fields.map((field: any, idx: number) => {
                const val = editResponses[field.id];
                return (
                  <div key={field.id} className="space-y-1 print-page-break-avoid">
                    <h4 className="text-xs font-black text-slate-950 uppercase tracking-wider">
                      {idx + 1}. {field.label}
                    </h4>
                    <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-xl min-h-[40px] text-xs font-medium leading-relaxed text-slate-700 whitespace-pre-wrap">
                      {val !== undefined && val !== '' ? String(val) : 'Sem resposta fornecida.'}
                    </div>
                  </div>
                );
              })
            ) : (
              // Legacy fallback printout
              <>
                <div className="space-y-1 print-page-break-avoid">
                  <h4 className="text-xs font-black text-slate-950 uppercase tracking-wider">1. Queixa Principal & Motivo da Busca</h4>
                  <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-xl min-h-[80px] text-xs font-medium leading-relaxed text-slate-700 whitespace-pre-wrap">
                    {anamnesis.complaint || 'Sem queixa principal registrada.'}
                  </div>
                </div>
                <div className="space-y-1 print-page-break-avoid">
                  <h4 className="text-xs font-black text-slate-950 uppercase tracking-wider">2. Histórico Familiar / Genograma</h4>
                  <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-xl min-h-[80px] text-xs font-medium leading-relaxed text-slate-700 whitespace-pre-wrap">
                    {anamnesis.family_history || 'Sem histórico familiar registrado.'}
                  </div>
                </div>
                <div className="space-y-1 print-page-break-avoid">
                  <h4 className="text-xs font-black text-slate-950 uppercase tracking-wider">3. Estilo de Vida & Hábitos</h4>
                  <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-xl min-h-[80px] text-xs font-medium leading-relaxed text-slate-700 whitespace-pre-wrap">
                    {anamnesis.lifestyle || 'Sem estilo de vida ou hábitos registrados.'}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Validation & Professional Secrecy Disclaimer */}
          <div className="pt-8 space-y-8 print-page-break-avoid">
            <div className="flex justify-between items-end gap-10">
              <div className="text-xs font-bold text-slate-500">
                <p>Emissão: {new Date().toLocaleDateString('pt-BR')}</p>
                <p className="mt-1">Documento Gerado por Prontuário Digital</p>
              </div>
              <div className="text-center space-y-2 max-w-sm">
                <div className="border-t border-slate-400 w-64 mx-auto pt-2" />
                <p className="text-[10px] font-black text-slate-700 uppercase tracking-wide">Assinatura do Profissional de Saúde</p>
                <p className="text-[9px] text-slate-400 font-bold">Terapeuta Responsável / Registro Profissional</p>
              </div>
            </div>

            <div className="bg-slate-50/50 p-4 border border-slate-100 rounded-xl text-center text-[9px] font-bold text-slate-400 leading-relaxed uppercase tracking-wider">
              🔒 ESTE DOCUMENTO CONTÉM INFORMAÇÕES PESSOAIS E CLÍNICAS CONFIDENCIAIS PROTEGIDAS POR SIGILO ÉTICO PROFISSIONAL (LEI Nº 13.709/2018 - LGPD).
            </div>
          </div>
        </div>
      )}

      {/* Modal de Anotações e Observações da Secretaria */}
      <PatientNotesModal
        patient={notesPatient}
        isOpen={!!notesPatient}
        onClose={() => setNotesPatient(null)}
        onNoteAdded={() => fetchPatients()}
      />

    </div>
  );
}
