import React, { useState, useEffect, useRef } from 'react';
import { Settings, Shield, Bell, Database, Globe, User, Users, Palette, CreditCard, FileText, X, Save, Plus, Trash2, CheckCircle2, AlertCircle, Calendar, Clock, Check, DoorOpen, ChevronUp, ChevronDown, Loader2, Percent, Upload, ArrowRight } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { supabase } from '@/src/lib/supabase';
import { useNavigate } from 'react-router-dom';

// ============================================================
// MODELO PADRÃƒO DE ANAMNESE â€” inserido automaticamente no primeiro uso
// ============================================================
const DEFAULT_ANAMNESIS_FIELDS = [
  { id: 'f1',  label: 'Nome Completo',                       type: 'text',     required: true  },
  { id: 'f2',  label: 'Data de Nascimento',                  type: 'date',     required: true  },
  { id: 'f3',  label: 'Estado Civil',                        type: 'select',   required: false, options: ['Solteiro(a)', 'Casado(a)', 'DiÃ³rcio/SeparaÃ§Ã£o', 'ViÃºvo(a)', 'UniÃ£o EstÃ¡vel'] },
  { id: 'f4',  label: 'ProfissÃ£o / OcupaÃ§Ã£o',               type: 'text',     required: false },
  { id: 'f5',  label: 'Queixa Principal (Motivo da Consulta)', type: 'textarea', required: true  },
  { id: 'f6',  label: 'HÃ¡ quanto tempo apresenta este sintoma?', type: 'text',   required: false },
  { id: 'f7',  label: 'JÃ¡ fez acompanhamento psicoterÃ¡pico antes?', type: 'yesno', required: true },
  { id: 'f8',  label: 'Faz uso de algum medicamento atualmente?',   type: 'yesno', required: true },
  { id: 'f9',  label: 'Se sim, qual medicamento e dosagem?',   type: 'textarea', required: false },
  { id: 'f10', label: 'HistÃ³rico de doenÃ§as mentais na famÃ­lia', type: 'yesno',   required: false },
  { id: 'f11', label: 'Como vocÃª classifica sua qualidade de sono?', type: 'scale', required: false },
  { id: 'f12', label: 'NÃ­vel de estresse atual (0 = baixo, 10 = muito alto)', type: 'scale', required: false },
  { id: 'f13', label: 'O que espera alcanÃ§ar com a terapia?',    type: 'textarea', required: true  },
];

const ROOM_COLORS = [
  { label: 'Ãndigo', value: '#6366f1' },
  { label: 'Esmeralda', value: '#10b981' },
  { label: 'Ã‚mbar', value: '#f59e0b' },
  { label: 'Rosa', value: '#f43f5e' },
  { label: 'Ciano', value: '#06b6d4' },
  { label: 'Violeta', value: '#8b5cf6' },
];

const configSections = [
  { id: 'perfil', title: 'Perfil da Clínica', desc: 'Dados básicos, logo e informações de contato.', icon: User, items: ['Nome Fantasia', 'CNPJ / CPF', 'Endereço', 'URL do Sistema', 'Escala de Horários'] },
  { id: 'seguranca', title: 'SeguranÃ§a & Acesso', desc: 'Controle de senhas, autenticaÃ§Ã£o e permissÃµes.', icon: Shield, items: ['Alterar Senha', 'AutenticaÃ§Ã£o 2FA'] },
  { id: 'usuarios', title: 'GestÃ£o de Equipe', desc: 'Cadastre funcionÃ¡rios e gerencie permissÃµes do sistema.', icon: User, items: ['Equipe Administrativa'] },
  { id: 'equipe', title: 'Equipe & Terapeutas', desc: 'Gerencie os profissionais e suas especialidades.', icon: Users, items: ['→ Ir para Gestão de Terapeutas'] },
  { id: 'salas', title: 'Salas de Atendimento', desc: 'Cadastre e gerencie as salas disponÃ­veis na clÃ­nica.', icon: DoorOpen, items: ['Gerenciar Salas'] },
  { id: 'servicos', title: 'ServiÃ§os & PreÃ§os', desc: 'Defina as terapias oferecidas e valores das sessÃµes.', icon: CreditCard, items: ['CatÃ¡logo de ServiÃ§os'] },
  { id: 'clinico', title: 'ClÃ­nico & Anamnese', desc: 'Configure os modelos de perguntas e campos do prontuÃ¡rio.', icon: FileText, items: ['Modelos de Anamnese', 'Tipos de EvoluÃ§Ã£o', 'Termos de Consentimento'] },
  { id: 'notificacoes', title: 'NotificaÃ§Ãµes & Alertas', desc: 'Configure o envio de lembretes via WhatsApp/E-mail.', icon: Bell, items: ['Lembretes de SessÃ£o', 'Pesquisa NPS (SatisfaÃ§Ã£o)', 'AutomaÃ§Ã£o de Tickets'] },
  { id: 'integracoes', title: 'API & IntegraÃ§Ãµes', desc: 'Configure chaves e webhooks de automaÃ§Ã£o.', icon: Database, items: ['API Asaas', 'AutomaÃ§Ã£o (n8n / Make)'] },
];

export default function ConfigPage() {
  const navigate = useNavigate();
  const [editingItem, setEditingItem] = useState<{section: string, item: string} | null>(null);
  
  const [services, setServices] = useState<any[]>([]);
  const [clinicalTemplates, setClinicalTemplates] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Forms State
  const [addingService, setAddingService] = useState(false);
  const [newServiceName, setNewServiceName] = useState('');
  const [newServicePrice, setNewServicePrice] = useState('');
  const [newServiceType, setNewServiceType] = useState('sessÃ£o avulsa');
  const [newServiceDesc, setNewServiceDesc] = useState('');
  const [newServiceDuration, setNewServiceDuration] = useState('60');
  const [newServiceSessions, setNewServiceSessions] = useState('1');
  const [addingTemplate, setAddingTemplate] = useState(false);
  const [newTemplateTitle, setNewTemplateTitle] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);



  // Rooms Form State
  const [addingRoom, setAddingRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomDesc, setNewRoomDesc] = useState('');
  const [newRoomColor, setNewRoomColor] = useState('#6366f1');
  const [newRoomCapacity, setNewRoomCapacity] = useState('1');

  // Settings states
  const [clinicProfile, setClinicProfile] = useState({ name: 'Tzion Terapias', cnpj: '', address: '', system_url: '' });
  const [integrations, setIntegrations] = useState({ asaas_token: '', google_client_id: '', meet_webhook: '' });
  const [securitySettings, setSecuritySettings] = useState({ twoFactor: false });
  const [teamRoles, setTeamRoles] = useState(['Admin Geral', 'Secretaria Administrativa', 'Comercial']);
  const [addingRole, setAddingRole] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [schedule, setSchedule] = useState<any>({
    Segunda: { start: '08:00', end: '18:00' },
    Terça: { start: '08:00', end: '18:00' },
    Quarta: { start: '08:00', end: '18:00' },
    Quinta: { start: '08:00', end: '18:00' },
    Sexta: { start: '08:00', end: '18:00' }
  });
  const [notifications, setNotifications] = useState({ 
    sessionReminders: true, 
    paymentConfirm: true, 
    birthdayReminder: true, 
    birthdayMessage: 'OlÃ¡, {{nome}}! ðŸŽ‚âœ¨\nA equipe da Tzion Terapias deseja um feliz aniversÃ¡rio! Que este novo ano seja repleto de evoluÃ§Ã£o, paz e conquistas. ParabÃ©ns!' 
  });
  const [npsSettings, setNpsSettings] = useState({ delay_minutes: 30, message: 'OlÃ¡! GostarÃ­amos de saber como foi sua sessÃ£o de hoje na ClÃ­nica Tzion Terapias. De 0 a 10, o quanto vocÃª recomendaria nossos serviÃ§os?' });
  const [contractTemplate, setContractTemplate] = useState('Este Ã© o contrato padrÃ£o. Paciente: {{nome_paciente}}, CPF: {{cpf_paciente}}, Data: {{data_atual}}.');
  const [contractPreview, setContractPreview] = useState(false);
  const [ticketSettings, setTicketSettings] = useState({ autoCloseHours: 24, closeMessage: 'Seu atendimento foi encerrado devido Ã  falta de interaÃ§Ã£o nas Ãºltimas 24 horas. Caso precise de ajuda, envie uma nova mensagem!' });

  const [whiteLabel, setWhiteLabel] = useState({ primaryColor: '#4f46e5', secondaryColor: '#e0e7ff', logoUrl: '', portalName: 'Tzion Terapias' });
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('A imagem deve ter no mÃ¡ximo 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setWhiteLabel(prev => ({ ...prev, logoUrl: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  // Clinical Form Builder state
  const [editingTemplate, setEditingTemplate] = useState<any | null>(null);
  const [templateFields, setTemplateFields] = useState<any[]>([]);
  const [addingField, setAddingField] = useState(false);
  const [newField, setNewField] = useState({ label: '', type: 'text', required: true, options: '' });
  const [savingTemplate, setSavingTemplate] = useState(false);

  // Evolution Types state
  const [evolutionTypes, setEvolutionTypes] = useState<any[]>([]);
  const [addingEvolType, setAddingEvolType] = useState(false);
  const [newEvolType, setNewEvolType] = useState({ name: '', color: '#6366f1', description: '' });

  const EVOL_COLORS = [
    '#6366f1', '#10b981', '#f59e0b', '#f43f5e', '#06b6d4', '#8b5cf6', '#ec4899', '#64748b'
  ];

  const FIELD_TYPES = [
    { value: 'text',     label: 'Texto Curto',   icon: 'ðŸ·' },
    { value: 'textarea', label: 'Texto Longo',   icon: 'ðŸ“' },
    { value: 'select',   label: 'MÃºltipla Escolha', icon: 'âœ…' },
    { value: 'checkbox', label: 'Caixas de SeleÃ§Ã£o', icon: 'â˜‘ï¸' },
    { value: 'date',     label: 'Data',          icon: 'ðŸ“…' },
    { value: 'scale',    label: 'Escala (1-10)', icon: 'ðŸ“Š' },
    { value: 'yesno',    label: 'Sim / NÃ£o',     icon: 'ðŸ”„' },
  ];

  const fetchData = async () => {
    setLoading(true);
    const { data: s } = await supabase.from('services').select('*');
    setServices(s || []);
    const { data: ct } = await supabase.from('clinical_templates').select('*').order('created_at');
    setClinicalTemplates(ct || []);
    // Auto-seed: se nÃ£o hÃ¡ nenhum modelo de anamnese, insere o padrÃ£o do sistema
    const hasAnamnesis = (ct || []).some((t: any) => t.category === 'anamnesis');
    if (!hasAnamnesis) {
      await supabase.from('clinical_templates').insert({
        title: 'Anamnese Inicial PadrÃ£o',
        category: 'anamnesis',
        fields: DEFAULT_ANAMNESIS_FIELDS,
      });
      const { data: ct2 } = await supabase.from('clinical_templates').select('*').order('created_at');
      setClinicalTemplates(ct2 || []);
    }
    const { data: r } = await supabase.from('rooms').select('*').order('name');
    setRooms(r || []);

    // Load evolution types from settings
    try {
      const { data: setts, error } = await supabase.from('settings').select('*');
      if (!error && setts) {
        const profile = setts.find(s => s.key === 'clinic_profile');
        if (profile && profile.value) {
          setClinicProfile({
            name: profile.value.name || 'Tzion Terapias',
            cnpj: profile.value.cnpj || '',
            address: profile.value.address || '',
            system_url: profile.value.system_url || ''
          });
        }
        const ints = setts.find(s => s.key === 'integrations');
        if (ints && ints.value) setIntegrations(ints.value);
        try {
           const { data: hasAsaas } = await supabase.rpc('has_asaas_key');
           if (hasAsaas) setIntegrations(prev => ({ ...prev, asaas_token: 'â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢' }));
        } catch(e) {}
        const sec = setts.find(s => s.key === 'security');
        if (sec && sec.value) setSecuritySettings(sec.value);
        const roles = setts.find(s => s.key === 'team_roles');
        if (roles && roles.value) setTeamRoles(roles.value);
        const sched = setts.find(s => s.key === 'schedule');
        if (sched && sched.value) setSchedule(sched.value);
        const notifs = setts.find(s => s.key === 'notifications');
        if (notifs && notifs.value) setNotifications({
          sessionReminders: true,
          paymentConfirm: true,
          birthdayReminder: true,
          birthdayMessage: 'OlÃ¡, {{nome}}! ðŸŽ‚âœ¨\nA equipe da Tzion Terapias deseja um feliz aniversÃ¡rio! Que este novo ano seja repleto de evoluÃ§Ã£o, paz e conquistas. ParabÃ©ns!',
          ...notifs.value
        });
        const nps = setts.find(s => s.key === 'nps_settings');
        if (nps && nps.value) setNpsSettings(nps.value);
        const contract = setts.find(s => s.key === 'contract_template');
        if (contract && contract.value) setContractTemplate(contract.value);
        const tkt = setts.find(s => s.key === 'ticket_automation');
        if (tkt && tkt.value) setTicketSettings(tkt.value);
        const wl = setts.find(s => s.key === 'white_label');
        if (wl && wl.value) setWhiteLabel(wl.value);
        const evolTypes = setts.find(s => s.key === 'evolution_types');
        if (evolTypes && evolTypes.value) setEvolutionTypes(evolTypes.value);
        else setEvolutionTypes([
          { id: 'prog', name: 'Progresso', color: '#10b981', description: 'Registro de avanÃ§os terapÃªuticos' },
          { id: 'sess', name: 'SessÃ£o Regular', color: '#6366f1', description: 'Nota de sessÃ£o padrÃ£o' },
          { id: 'crise', name: 'Crise / IntercorrÃªncia', color: '#f43f5e', description: 'Registro de situaÃ§Ãµes urgentes' },
          { id: 'alta', name: 'Alta TerapÃªutica', color: '#f59e0b', description: 'Encerramento do processo' },
        ]);
      }
    } catch(e) { console.log('Tabela settings pode nÃ£o existir ainda'); }
    
    setLoading(false);
  };

  const handleSyncAll = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/financeiro/sincronizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      if (data.success) {
        alert('SincronizaÃ§Ã£o concluÃ­da com sucesso!\n\n' + data.log.join('\n'));
      } else {
        alert('Erro ao sincronizar: ' + (data.error || 'Erro desconhecido'));
      }
    } catch (err) {
      console.error(err);
      alert('Erro ao executar sincronizaÃ§Ã£o.');
    }
    await fetchData();
  };

  useEffect(() => { fetchData(); }, []);

  // Handlers

  const handleAddRoom = async () => {
    if (!newRoomName) return;
    setLoading(true);
    await supabase.from('rooms').insert({
      name: newRoomName,
      description: newRoomDesc,
      color: newRoomColor,
      capacity: Number(newRoomCapacity) || 1,
      status: 'active'
    });
    setNewRoomName('');
    setNewRoomDesc('');
    setNewRoomColor('#6366f1');
    setNewRoomCapacity('1');
    setAddingRoom(false);
    fetchData();
  };

  const toggleRoomStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    await supabase.from('rooms').update({ status: newStatus }).eq('id', id);
    fetchData();
  };

  const handleAddService = async () => {
    if (!newServiceName) return;
    setLoading(true);
    await supabase.from('services').insert({ 
       name: newServiceName, 
       price: Number(newServicePrice) || 0, 
       duration_minutes: Number(newServiceDuration) || 60, 
       type: newServiceType, 
       description: newServiceDesc,
       sessions_count: newServiceType === 'pacote' ? Number(newServiceSessions) : 1
    });
    setNewServiceName('');
    setNewServicePrice('');
    setNewServiceType('sessÃ£o avulsa');
    setNewServiceDesc('');
    setNewServiceDuration('60');
    setNewServiceSessions('1');
    setAddingService(false);
    fetchData();
  };

  const handleAddTemplate = async (category: string) => {
    if (!newTemplateTitle) return;
    setLoading(true);
    await supabase.from('clinical_templates').insert({ title: newTemplateTitle, category, fields: [] });
    setNewTemplateTitle('');
    setAddingTemplate(false);
    fetchData();
  };

  // ---- Form Builder handlers ----
  const insertDefaultTemplate = async () => {
    setLoading(true);
    await supabase.from('clinical_templates').insert({
      title: 'Anamnese Inicial PadrÃ£o',
      category: 'anamnesis',
      fields: DEFAULT_ANAMNESIS_FIELDS,
    });
    fetchData();
  };

  const openTemplateBuilder = (template: any) => {
    setEditingTemplate(template);
    setTemplateFields(template.fields || []);
    setAddingField(false);
    setNewField({ label: '', type: 'text', required: true, options: '' });
  };

  const closeTemplateBuilder = () => {
    setEditingTemplate(null);
    setTemplateFields([]);
    setAddingField(false);
  };

  const addFieldToTemplate = () => {
    if (!newField.label) return;
    const field = {
      id: Date.now().toString(),
      label: newField.label,
      type: newField.type,
      required: newField.required,
      options: newField.type === 'select' || newField.type === 'checkbox'
        ? newField.options.split(',').map(o => o.trim()).filter(Boolean)
        : undefined,
    };
    setTemplateFields(prev => [...prev, field]);
    setNewField({ label: '', type: 'text', required: true, options: '' });
    setAddingField(false);
  };

  const removeField = (fieldId: string) => {
    setTemplateFields(prev => prev.filter(f => f.id !== fieldId));
  };

  const moveField = (idx: number, dir: 'up' | 'down') => {
    const arr = [...templateFields];
    const swap = dir === 'up' ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= arr.length) return;
    [arr[idx], arr[swap]] = [arr[swap], arr[idx]];
    setTemplateFields(arr);
  };

  const saveTemplateFields = async () => {
    if (!editingTemplate) return;
    setSavingTemplate(true);
    await supabase.from('clinical_templates').update({ fields: templateFields }).eq('id', editingTemplate.id);
    setSavingTemplate(false);
    closeTemplateBuilder();
    fetchData();
  };

  // ---- Evolution Types handlers ----
  const saveEvolutionTypes = async (types: any[]) => {
    const { data: existing } = await supabase.from('settings').select('id').eq('key', 'evolution_types').maybeSingle();
    if (existing) {
      await supabase.from('settings').update({ value: types }).eq('key', 'evolution_types');
    } else {
      await supabase.from('settings').insert({ key: 'evolution_types', value: types });
    }
    setEvolutionTypes(types);
  };

  const handleAddEvolutionType = async () => {
    if (!newEvolType.name) return;
    const newType = { ...newEvolType, id: Date.now().toString() };
    const updated = [...evolutionTypes, newType];
    await saveEvolutionTypes(updated);
    setNewEvolType({ name: '', color: '#6366f1', description: '' });
    setAddingEvolType(false);
  };

  const handleDeleteEvolutionType = async (id: string) => {
    const updated = evolutionTypes.filter(t => t.id !== id);
    await saveEvolutionTypes(updated);
  };

  const executeDelete = async (table: string, id: string) => {
    setLoading(true);
    await supabase.from(table).delete().eq('id', id);
    setDeletingId(null);
    fetchData();
  };

  const handleAddRole = () => {
    if (!newRoleName) return;
    setTeamRoles([...teamRoles, newRoleName]);
    setNewRoleName('');
    setAddingRole(false);
  };

  const removeRole = (roleToRemove: string) => {
    setTeamRoles(teamRoles.filter(role => role !== roleToRemove));
  };

  const handleScheduleChange = (day: string, field: 'start'|'end', value: string) => {
    setSchedule({ ...schedule, [day]: { ...schedule[day], [field]: value } });
  };

  const saveSettings = async () => {
    setLoading(true);
    try {
      let safeIntegrations = { ...integrations };
      if (integrations.asaas_token && integrations.asaas_token !== 'â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢') {
        const { error } = await supabase.rpc('set_asaas_key', { secret_key: integrations.asaas_token });
        if (!error) {
          const { asaas_token, ...rest } = safeIntegrations as any;
          safeIntegrations = rest as any;
          setIntegrations(prev => ({...prev, asaas_token: 'â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢'}));
        }
      } else if (integrations.asaas_token === 'â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢') {
         const { asaas_token, ...rest } = safeIntegrations as any;
         safeIntegrations = rest as any;
      }

      await supabase.from('settings').upsert([
        { key: 'clinic_profile', value: clinicProfile },
        { key: 'integrations', value: safeIntegrations },
        { key: 'security', value: securitySettings },
        { key: 'team_roles', value: teamRoles },
        { key: 'schedule', value: schedule },
        { key: 'notifications', value: notifications },
        { key: 'nps_settings', value: npsSettings },
        { key: 'contract_template', value: contractTemplate },
        { key: 'ticket_automation', value: ticketSettings },
        { key: 'white_label', value: whiteLabel }
      ]);
    } catch(e) { alert('Erro ao salvar settings. Execute o script SQL no Supabase para criar a tabela.'); }
    setLoading(false);
    setEditingItem(null);
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">ConfiguraÃ§Ãµes</h2>
          <p className="text-slate-500 font-medium">Controle total do ecossistema Tzion Terapias.</p>
        </div>
        <button onClick={handleSyncAll} className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-2">
           {loading ? <Clock className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Sincronizar
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {configSections.map((section) => (
          <div key={section.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all group">
            <div className="flex items-start justify-between mb-6">
              <div className="p-4 bg-slate-50 rounded-2xl text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all">
                <section.icon className="w-7 h-7" />
              </div>
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">{section.title}</h3>
            <p className="text-sm text-slate-500 mb-6 font-medium leading-relaxed">{section.desc}</p>
            <div className="space-y-2">
              {section.items.map((item, i) => (
                <div
                  key={i}
                  onClick={() => {
                    if (item.startsWith('→')) {
                      navigate('/admin/terapeutas');
                    } else {
                      setEditingItem({ section: section.title, item });
                    }
                  }}
                  className="flex items-center justify-between p-3 bg-slate-50/50 rounded-xl group/item cursor-pointer hover:bg-white border border-transparent hover:border-slate-100 transition-all"
                >
                  <span className={cn("text-sm font-bold", item.startsWith('→') ? "text-indigo-600" : "text-slate-700")}>{item}</span>
                  {item.startsWith('→')
                    ? <ArrowRight className="w-4 h-4 text-indigo-400 opacity-0 group-hover/item:opacity-100 transition-opacity" />
                    : <button className="text-[10px] font-bold text-indigo-500 opacity-0 group-hover/item:opacity-100 uppercase tracking-widest">Ajustar</button>
                  }
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {editingItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in duration-300">
           <div className="bg-white rounded-[2.5rem] w-full max-w-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-100"><Settings className="w-6 h-6" /></div>
                  <div><h3 className="text-2xl font-bold text-slate-900 tracking-tight">{editingItem.item}</h3><p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{editingItem.section}</p></div>
                </div>
                <button onClick={() => setEditingItem(null)} className="p-2 hover:bg-white rounded-full transition-all text-slate-400 border border-transparent hover:border-slate-200"><X className="w-6 h-6" /></button>
              </div>

              <div className="p-8 overflow-y-auto space-y-8">
                {editingItem.section === 'Perfil da ClÃ­nica' && (
                  <div className="space-y-4">
                    <label className="text-xs font-bold text-slate-500 uppercase">{editingItem.item}</label>
                    {editingItem.item === 'Nome Fantasia' && (
                      <input value={clinicProfile.name} onChange={e => setClinicProfile({...clinicProfile, name: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold" placeholder="Nome Fantasia" />
                    )}
                    {editingItem.item === 'CNPJ / CPF' && (
                      <input value={clinicProfile.cnpj} onChange={e => setClinicProfile({...clinicProfile, cnpj: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold" placeholder="CNPJ / CPF" />
                    )}
                    {editingItem.item === 'EndereÃ§o' && (
                      <input value={clinicProfile.address} onChange={e => setClinicProfile({...clinicProfile, address: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold" placeholder="EndereÃ§o Completo" />
                    )}
                    {editingItem.item === 'URL do Sistema' && (
                      <div className="space-y-2">
                        <input value={clinicProfile.system_url || ''} onChange={e => setClinicProfile({...clinicProfile, system_url: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold" placeholder="https://app.tzionterapias.com.br" />
                        <p className="text-xs text-slate-400 font-medium">Digite a URL base de produÃ§Ã£o do sistema. Ela serÃ¡ utilizada como domÃ­nio de origem para os links enviados de forma automatizada por WhatsApp (anamnese, contratos, NPS, etc.).</p>
                      </div>
                    )}
                  </div>
                )}

                {editingItem.section === 'SeguranÃ§a & Acesso' && (
                  <div className="space-y-6">
                    {editingItem.item === 'Alterar Senha' && (
                      <div className="space-y-4">
                        <div className="p-4 bg-indigo-50 text-indigo-700 rounded-2xl text-sm font-medium border border-indigo-100 flex items-start gap-3">
                           <Shield className="w-5 h-5 mt-0.5 shrink-0" />
                           <p>Para sua seguranÃ§a, enviaremos um link de redefiniÃ§Ã£o para o e-mail cadastrado na conta administradora.</p>
                        </div>
                        <button className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold shadow-xl shadow-slate-200 transition-colors">Enviar E-mail de RedefiniÃ§Ã£o</button>
                      </div>
                    )}
                    {editingItem.item === 'AutenticaÃ§Ã£o 2FA' && (
                      <div className="flex items-center justify-between p-6 bg-slate-50 rounded-2xl border border-slate-200">
                        <div>
                          <p className="font-bold text-slate-900">ProteÃ§Ã£o 2FA</p>
                          <p className="text-xs text-slate-500 mt-1">Exigir cÃ³digo via SMS/E-mail no login</p>
                        </div>
                        <button onClick={() => setSecuritySettings({twoFactor: !securitySettings.twoFactor})} className={cn("relative inline-flex h-7 w-12 items-center rounded-full transition-colors", securitySettings.twoFactor ? "bg-indigo-600" : "bg-slate-300")}>
                          <span className={cn("inline-block h-5 w-5 transform rounded-full bg-white transition-transform", securitySettings.twoFactor ? "translate-x-6" : "translate-x-1")} />
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {editingItem.section === 'API & IntegraÃ§Ãµes' && (
                  <div className="space-y-4">
                    {editingItem.item === 'API Asaas' && (
                      <div className="space-y-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Token Asaas (Chave de API)</label>
                          <input value={integrations.asaas_token} onChange={e => setIntegrations({...integrations, asaas_token: e.target.value})} type="password" placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                        </div>
                        
                        <div className="pt-4 border-t border-slate-100">
                          <h4 className="text-sm font-bold text-slate-900 mb-2">ConfiguraÃ§Ã£o do Webhook</h4>
                          <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                            Para que o sistema receba as confirmaÃ§Ãµes de pagamento automaticamente, vÃ¡ no seu painel do Asaas em 
                            <strong className="text-slate-700"> Minha Conta &gt; IntegraÃ§Ãµes &gt; Webhooks</strong> e cole a URL abaixo. Ative os eventos de <strong>"CobranÃ§a Criada"</strong> e <strong>"CobranÃ§a Paga"</strong>.
                          </p>
                          
                          <div className="p-4 bg-slate-900 rounded-2xl flex items-center justify-between gap-4 mb-4 shadow-inner">
                            <code className="text-xs font-mono text-emerald-400 truncate flex-1 select-all">
                              {import.meta.env.VITE_SUPABASE_URL}/functions/v1/asaas-webhook
                            </code>
                            <button 
                              onClick={() => {
                                navigator.clipboard.writeText(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/asaas-webhook`);
                                alert('URL copiada!');
                              }}
                              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold transition-colors shrink-0"
                            >
                              Copiar URL
                            </button>
                          </div>

                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Token de Acesso do Webhook</label>
                            <input 
                              value={integrations.asaas_webhook_token || ''} 
                              onChange={e => setIntegrations({...integrations, asaas_webhook_token: e.target.value})} 
                              type="password" 
                              placeholder="Token gerado na aba de Webhooks do Asaas..." 
                              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-sm outline-none focus:ring-2 focus:ring-indigo-500" 
                            />
                            <p className="text-[10px] text-slate-400 ml-1 font-medium">Usado para validar que as mensagens recebidas realmente vieram do Asaas.</p>
                          </div>
                        </div>
                      </div>
                    )}
                    {editingItem.item === 'AutomaÃ§Ã£o (n8n / Make)' && (
                      <div className="space-y-4">
                        <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl text-sm font-medium text-indigo-800 leading-relaxed mb-4">
                          O sistema irÃ¡ atirar um POST (Webhook) com os dados (nome, telefone, data, hora, tipo da sessÃ£o) para essa URL sempre que um <strong>novo agendamento</strong> for salvo. Use o nÃ³ Webhook do n8n para capturar esses dados, criar no Calendar/Meet e enviar a mensagem no WhatsApp.
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">URL do Webhook (Agendamentos)</label>
                          <input value={integrations.n8n_webhook_url || ''} onChange={e => setIntegrations({...integrations, n8n_webhook_url: e.target.value})} type="url" placeholder="https://seu-n8n.com/webhook/..." className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {editingItem.section === 'GestÃ£o de Equipe' && (
                  <div className="space-y-3">
                    {teamRoles.map(role => (
                      <div key={role} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <div><p className="font-bold text-slate-900">{role}</p></div>
                        <button onClick={() => removeRole(role)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    ))}
                    
                    {addingRole ? (
                      <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center gap-3">
                        <input autoFocus value={newRoleName} onChange={e => setNewRoleName(e.target.value)} placeholder="Nome do Cargo..." className="flex-1 bg-white p-3 rounded-xl border-none outline-none font-bold text-indigo-900 placeholder:text-indigo-300" />
                        <button onClick={() => setAddingRole(false)} className="p-3 text-indigo-400 hover:text-indigo-600"><X className="w-5 h-5" /></button>
                        <button onClick={handleAddRole} className="p-3 bg-indigo-600 text-white rounded-xl shadow-md"><Check className="w-5 h-5" /></button>
                      </div>
                    ) : (
                      <button onClick={() => setAddingRole(true)} className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 font-bold hover:border-indigo-300 hover:text-indigo-600 transition-all">+ Adicionar Cargo</button>
                    )}
                  </div>
                )}

                {editingItem.item === 'Escala de Horários' && (
                  <div className="space-y-4">
                    {['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'].map(day => (
                      <div key={day} className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl border border-slate-100">
                        <span className="font-bold text-slate-700 w-24">{day}</span>
                        <div className="flex items-center gap-3 flex-1 justify-end">
                           <input type="time" value={schedule[day]?.start || ''} onChange={e => handleScheduleChange(day, 'start', e.target.value)} className="p-3 border border-slate-200 rounded-xl text-sm font-bold bg-white outline-none focus:ring-2 focus:ring-indigo-500" />
                           <span className="text-slate-400 font-medium">às</span>
                           <input type="time" value={schedule[day]?.end || ''} onChange={e => handleScheduleChange(day, 'end', e.target.value)} className="p-3 border border-slate-200 rounded-xl text-sm font-bold bg-white outline-none focus:ring-2 focus:ring-indigo-500" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {editingItem.section === 'Salas de Atendimento' && (
                  <div className="space-y-3">
                    {rooms.map(room => (
                      <div key={room.id} className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl border border-slate-100 group">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm shrink-0" style={{ backgroundColor: room.color + '22', border: `2px solid ${room.color}` }}>
                            <DoorOpen className="w-5 h-5" style={{ color: room.color }} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-slate-900">{room.name}</p>
                              <span className={cn(
                                'px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest',
                                room.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'
                              )}>
                                {room.status === 'active' ? 'Ativa' : 'Inativa'}
                              </span>
                            </div>
                            {room.description && <p className="text-xs text-slate-400 font-medium mt-0.5">{room.description}</p>}
                            <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Capacidade: {room.capacity} pessoa(s)</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleRoomStatus(room.id, room.status)}
                            className={cn(
                              'px-3 py-2 rounded-xl text-xs font-bold transition-all',
                              room.status === 'active'
                                ? 'bg-slate-100 text-slate-500 hover:bg-rose-50 hover:text-rose-500'
                                : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                            )}
                          >
                            {room.status === 'active' ? 'Desativar' : 'Ativar'}
                          </button>
                          {deletingId === room.id ? (
                            <div className="flex items-center gap-2 animate-in fade-in zoom-in">
                              <button onClick={() => setDeletingId(null)} className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg text-xs transition-colors">Cancelar</button>
                              <button onClick={() => executeDelete('rooms', room.id)} className="px-3 py-2 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-lg text-xs transition-colors">Excluir</button>
                            </div>
                          ) : (
                            <button onClick={() => setDeletingId(room.id)} className="p-2 text-rose-400 hover:bg-rose-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}

                    {addingRoom ? (
                      <div className="p-5 bg-indigo-50 border border-indigo-100 rounded-2xl flex flex-col gap-4">
                        <input
                          autoFocus
                          value={newRoomName}
                          onChange={e => setNewRoomName(e.target.value)}
                          placeholder="Nome da sala (ex: Sala 1, Sala Azul)..."
                          className="w-full bg-white p-4 rounded-xl border-none outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-indigo-900 placeholder:text-indigo-300"
                        />
                        <input
                          value={newRoomDesc}
                          onChange={e => setNewRoomDesc(e.target.value)}
                          placeholder="DescriÃ§Ã£o ou equipamentos (opcional)"
                          className="w-full bg-white p-4 rounded-xl border-none outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-indigo-900 placeholder:text-indigo-300"
                        />
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest ml-1">Capacidade</label>
                            <input
                              type="number"
                              value={newRoomCapacity}
                              onChange={e => setNewRoomCapacity(e.target.value)}
                              min="1"
                              className="w-full bg-white p-4 rounded-xl border-none outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-indigo-900 text-center"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest ml-1">Cor Identificadora</label>
                            <div className="flex gap-2 flex-wrap">
                              {ROOM_COLORS.map(c => (
                                <button
                                  key={c.value}
                                  onClick={() => setNewRoomColor(c.value)}
                                  className={cn(
                                    'w-8 h-8 rounded-full border-2 transition-all hover:scale-110',
                                    newRoomColor === c.value ? 'border-slate-900 scale-110' : 'border-transparent'
                                  )}
                                  style={{ backgroundColor: c.value }}
                                  title={c.label}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => setAddingRoom(false)} className="flex-1 py-3 bg-white hover:bg-slate-50 text-indigo-400 font-bold rounded-xl transition-colors">Cancelar</button>
                          <button onClick={handleAddRoom} className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition-colors">Cadastrar Sala</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setAddingRoom(true)} className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 font-bold hover:border-indigo-300 hover:text-indigo-600 transition-all">+ Nova Sala</button>
                    )}
                  </div>
                )}

                {editingItem.section === 'ServiÃ§os & PreÃ§os' && (
                  <div className="space-y-3">
                    {services.map(s => (
                      <div key={s.id} className="flex items-start justify-between p-5 bg-slate-50 rounded-2xl border border-slate-100">
                        <div>
                           <div className="flex items-center gap-2 mb-1">
                             <p className="font-bold text-slate-900">{s.name}</p>
                             <span className={cn("px-2 py-0.5 rounded-md text-[9px] font-bold uppercase", s.type === 'pacote' ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700')}>
                               {s.type === 'pacote' ? `Pacote (${s.sessions_count || 1}x)` : 'SessÃ£o'}
                             </span>
                           </div>
                           {s.description && <p className="text-xs text-slate-500 font-medium mb-2">{s.description}</p>}
                           <p className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1"><Clock className="w-3 h-3"/> {s.duration_minutes} min</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <p className="font-bold text-indigo-600">R$ {Number(s.price).toLocaleString('pt-BR')}</p>
                          {deletingId === s.id ? (
                             <div className="flex items-center gap-2 animate-in fade-in zoom-in">
                               <button onClick={() => setDeletingId(null)} className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg text-xs transition-colors">Cancelar</button>
                               <button onClick={() => executeDelete('services', s.id)} className="px-3 py-2 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-lg text-xs transition-colors">Excluir</button>
                             </div>
                           ) : (
                             <button onClick={() => setDeletingId(s.id)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                           )}
                        </div>
                      </div>
                    ))}
                    
                    {addingService ? (
                      <div className="p-5 bg-indigo-50 border border-indigo-100 rounded-2xl flex flex-col gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest ml-1">Nome do ServiÃ§o / Pacote</label>
                          <input autoFocus value={newServiceName} onChange={e => setNewServiceName(e.target.value)} placeholder="Ex: SessÃ£o de Psicologia, Pacote EstÃ©tica..." className="w-full bg-white p-4 rounded-xl border-none outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-indigo-900 placeholder:text-indigo-300 shadow-sm" />
                        </div>
                        
                        <div className={cn("grid gap-3", newServiceType === 'pacote' ? "grid-cols-2 md:grid-cols-4" : "grid-cols-1 md:grid-cols-3")}>
                          <div className="space-y-1.5">
                             <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest ml-1">Tipo</label>
                             <select value={newServiceType} onChange={e => setNewServiceType(e.target.value)} className="w-full bg-white pl-3 pr-8 py-4 rounded-xl border-none outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-indigo-900 text-sm cursor-pointer shadow-sm">
                                <option value="sessÃ£o avulsa">SessÃ£o Avulsa</option>
                                <option value="pacote">Pacote</option>
                             </select>
                          </div>
                          <div className="space-y-1.5">
                             <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest ml-1">PreÃ§o (R$)</label>
                             <input value={newServicePrice} onChange={e => setNewServicePrice(e.target.value)} placeholder="0.00" type="number" className="w-full bg-white p-4 rounded-xl border-none outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-indigo-900 placeholder:text-indigo-300 shadow-sm" />
                          </div>
                          <div className="space-y-1.5">
                             <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest ml-1">Tempo (Min)</label>
                             <input value={newServiceDuration} onChange={e => setNewServiceDuration(e.target.value)} placeholder="60" type="number" className="w-full bg-white p-4 rounded-xl border-none outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-indigo-900 placeholder:text-indigo-300 text-center shadow-sm" />
                          </div>
                          {newServiceType === 'pacote' && (
                            <div className="space-y-1.5">
                               <label className="text-[10px] font-black text-amber-500 uppercase tracking-widest ml-1">Qtd. SessÃµes</label>
                               <input value={newServiceSessions} onChange={e => setNewServiceSessions(e.target.value)} placeholder="1" type="number" className="w-full bg-white p-4 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 font-black text-amber-900 placeholder:text-amber-300 text-center border-2 border-amber-300 shadow-sm" />
                            </div>
                          )}
                        </div>
                        
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest ml-1">Descritivo (Opcional)</label>
                          <textarea value={newServiceDesc} onChange={e => setNewServiceDesc(e.target.value)} placeholder="O que estÃ¡ incluso neste serviÃ§o ou pacote?" rows={2} className="w-full bg-white p-4 rounded-xl border-none outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-indigo-900 placeholder:text-indigo-300 resize-none shadow-sm" />
                        </div>
                        
                        <div className="flex gap-2 mt-2">
                           <button onClick={() => setAddingService(false)} className="flex-1 py-4 bg-white hover:bg-slate-50 text-indigo-400 font-bold rounded-xl transition-colors shadow-sm">Cancelar</button>
                           <button onClick={handleAddService} className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition-colors">Cadastrar ServiÃ§o</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setAddingService(true)} className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 font-bold hover:border-indigo-300 hover:text-indigo-600 transition-all">+ Novo ServiÃ§o/Pacote</button>
                    )}
                  </div>
                )}

                {editingItem.section === 'ClÃ­nico & Anamnese' && (
                  <div className="space-y-4">

                    {/* =============== MODELOS DE ANAMNESE =============== */}
                    {editingItem.item === 'Modelos de Anamnese' && (
                      <div className="space-y-4">
                        {/* Se estiver editando campos de um modelo */}
                        {editingTemplate ? (
                          <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                            {/* Header do Builder */}
                            <div className="flex items-center justify-between p-5 bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl text-white">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center font-black text-xl">ðŸ“‹</div>
                                <div>
                                  <h4 className="font-black text-lg leading-tight">{editingTemplate.title}</h4>
                                  <p className="text-indigo-200 text-xs">{templateFields.length} campo(s) configurado(s)</p>
                                </div>
                              </div>
                              <button onClick={closeTemplateBuilder} className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors">
                                <X className="w-5 h-5" />
                              </button>
                            </div>

                            {/* Lista de Campos */}
                            <div className="space-y-2">
                              {templateFields.length === 0 && (
                                <div className="py-10 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                                  <p className="text-4xl mb-2">ðŸ“­</p>
                                  <p className="font-bold text-slate-500">Nenhum campo ainda.</p>
                                  <p className="text-xs text-slate-400">Adicione campos abaixo para construir o formulÃ¡rio.</p>
                                </div>
                              )}
                              {templateFields.map((field, idx) => (
                                <div key={field.id} className="flex items-center gap-3 p-4 bg-white border border-slate-200 rounded-2xl group hover:border-indigo-200 hover:shadow-sm transition-all">
                                  <div className="flex flex-col gap-0.5">
                                    <button onClick={() => moveField(idx, 'up')} disabled={idx === 0} className="p-0.5 text-slate-300 hover:text-indigo-500 disabled:opacity-0 transition-colors">
                                      <ChevronUp className="w-3.5 h-3.5" />
                                    </button>
                                    <button onClick={() => moveField(idx, 'down')} disabled={idx === templateFields.length - 1} className="p-0.5 text-slate-300 hover:text-indigo-500 disabled:opacity-0 transition-colors">
                                      <ChevronDown className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                  <div className="w-8 h-8 bg-indigo-50 rounded-xl flex items-center justify-center text-base shrink-0">
                                    {FIELD_TYPES.find(f => f.value === field.type)?.icon || 'ðŸ“'}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-bold text-slate-900 text-sm truncate">{field.label}</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <span className="text-[10px] font-bold text-slate-400 uppercase">
                                        {FIELD_TYPES.find(f => f.value === field.type)?.label}
                                      </span>
                                      {field.required && (
                                        <span className="text-[9px] font-black text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded-full uppercase tracking-wider">ObrigatÃ³rio</span>
                                      )}
                                      {field.options?.length > 0 && (
                                        <span className="text-[9px] font-bold text-indigo-500">{field.options.length} opÃ§Ãµes</span>
                                      )}
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => removeField(field.id)}
                                    className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              ))}
                            </div>

                            {/* Adicionar Campo */}
                            {addingField ? (
                              <div className="p-5 bg-indigo-50 border border-indigo-100 rounded-2xl space-y-4">
                                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Novo Campo</p>
                                <input
                                  autoFocus
                                  value={newField.label}
                                  onChange={e => setNewField({...newField, label: e.target.value})}
                                  placeholder="Pergunta ou rÃ³tulo do campo..."
                                  className="w-full bg-white p-4 rounded-xl border-none outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-indigo-900 placeholder:text-indigo-300 shadow-sm"
                                />
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest ml-1">Tipo de Campo</label>
                                    <div className="grid grid-cols-2 gap-2">
                                      {FIELD_TYPES.map(ft => (
                                        <button
                                          key={ft.value}
                                          onClick={() => setNewField({...newField, type: ft.value})}
                                          className={cn(
                                            'p-2.5 rounded-xl border-2 text-left transition-all flex items-center gap-2',
                                            newField.type === ft.value
                                              ? 'border-indigo-500 bg-white text-indigo-700'
                                              : 'border-transparent bg-white/60 text-slate-500 hover:border-indigo-200'
                                          )}
                                        >
                                          <span className="text-base">{ft.icon}</span>
                                          <span className="text-[10px] font-black leading-tight">{ft.label}</span>
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                  <div className="space-y-3">
                                    <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-indigo-100">
                                      <span className="text-sm font-bold text-slate-700">ObrigatÃ³rio</span>
                                      <button
                                        onClick={() => setNewField({...newField, required: !newField.required})}
                                        className={cn('relative inline-flex h-6 w-11 items-center rounded-full transition-colors', newField.required ? 'bg-indigo-600' : 'bg-slate-300')}
                                      >
                                        <span className={cn('inline-block h-4 w-4 transform rounded-full bg-white transition-transform', newField.required ? 'translate-x-6' : 'translate-x-1')} />
                                      </button>
                                    </div>
                                    {(newField.type === 'select' || newField.type === 'checkbox') && (
                                      <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest ml-1">OpÃ§Ãµes (separadas por vÃ­rgula)</label>
                                        <input
                                          value={newField.options}
                                          onChange={e => setNewField({...newField, options: e.target.value})}
                                          placeholder="OpÃ§Ã£o 1, OpÃ§Ã£o 2, OpÃ§Ã£o 3"
                                          className="w-full bg-white p-3 rounded-xl border-none outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium text-indigo-900 placeholder:text-indigo-300 shadow-sm"
                                        />
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <button onClick={() => setAddingField(false)} className="flex-1 py-3 bg-white text-indigo-400 font-bold rounded-xl transition-colors hover:bg-slate-50">Cancelar</button>
                                  <button onClick={addFieldToTemplate} className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-md transition-colors hover:bg-indigo-700">Adicionar Campo</button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => setAddingField(true)}
                                className="w-full py-4 border-2 border-dashed border-indigo-200 rounded-2xl text-indigo-400 font-bold hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/50 transition-all flex items-center justify-center gap-2"
                              >
                                <Plus className="w-4 h-4" /> Adicionar Campo ao FormulÃ¡rio
                              </button>
                            )}

                            {/* Salvar Template */}
                            <button
                              onClick={saveTemplateFields}
                              disabled={savingTemplate}
                              className="w-full py-4 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl font-bold shadow-xl shadow-indigo-100 hover:shadow-2xl hover:shadow-indigo-200 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                            >
                              {savingTemplate ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                              Salvar Modelo de Anamnese
                            </button>
                          </div>
                        ) : (
                          /* Lista de templates */
                          <div className="space-y-3">

                            {/* Banner do modelo padrÃ£o quando nÃ£o hÃ¡ nenhum */}
                            {clinicalTemplates.filter(t => t.category === 'anamnesis').length === 0 && (
                              <div className="p-6 bg-gradient-to-br from-indigo-50 to-violet-50 border-2 border-indigo-200 border-dashed rounded-2xl flex flex-col items-center gap-3 text-center">
                                <div className="text-4xl">ðŸ“‹</div>
                                <div>
                                  <p className="font-black text-indigo-900">Nenhum modelo cadastrado</p>
                                  <p className="text-xs text-indigo-600 mt-1">Use o modelo padrÃ£o da clÃ­nica ou crie um do zero.</p>
                                </div>
                                <button
                                  onClick={insertDefaultTemplate}
                                  className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 hover:shadow-xl hover:shadow-indigo-300 transition-all flex items-center gap-2"
                                >
                                  <span>âœ¨</span> Inserir Modelo PadrÃ£o do Sistema (13 campos)
                                </button>
                              </div>
                            )}

                            {/* BotÃ£o de inserir modelo padrÃ£o quando jÃ¡ hÃ¡ outros */}
                            {clinicalTemplates.filter(t => t.category === 'anamnesis').length > 0 && (
                              <div className="flex items-center gap-2 p-3 bg-indigo-50 border border-indigo-100 rounded-2xl">
                                <span className="text-lg">âœ¨</span>
                                <p className="text-xs text-indigo-700 font-medium flex-1">Quer um modelo completo pronto para usar?</p>
                                <button
                                  onClick={insertDefaultTemplate}
                                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors whitespace-nowrap"
                                >
                                  + Inserir Modelo PadrÃ£o
                                </button>
                              </div>
                            )}
                            {clinicalTemplates.filter(t => t.category === 'anamnesis').map(t => (
                              <div key={t.id} className="p-5 bg-white border border-slate-200 rounded-2xl group hover:border-indigo-200 hover:shadow-sm transition-all">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-gradient-to-br from-indigo-100 to-violet-100 rounded-xl flex items-center justify-center text-xl shadow-sm">ðŸ“‹</div>
                                    <div>
                                      <p className="font-bold text-slate-900">{t.title}</p>
                                      <p className="text-xs text-slate-400 font-medium mt-0.5">{(t.fields || []).length} campos configurados</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => openTemplateBuilder(t)}
                                      className="px-4 py-2 bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white border border-indigo-100 hover:border-indigo-600 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                                    >
                                      <Settings className="w-3.5 h-3.5" /> Editar Campos
                                    </button>
                                    {deletingId === t.id ? (
                                      <div className="flex items-center gap-2 animate-in fade-in zoom-in">
                                        <button onClick={() => setDeletingId(null)} className="px-3 py-2 bg-slate-200 text-slate-700 font-bold rounded-lg text-xs">Cancelar</button>
                                        <button onClick={() => executeDelete('clinical_templates', t.id)} className="px-3 py-2 bg-rose-500 text-white font-bold rounded-lg text-xs">Excluir</button>
                                      </div>
                                    ) : (
                                      <button onClick={() => setDeletingId(t.id)} className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all opacity-0 group-hover:opacity-100">
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                                {/* Preview dos campos */}
                                {(t.fields || []).length > 0 && (
                                  <div className="mt-3 pt-3 border-t border-slate-50 flex flex-wrap gap-2">
                                    {(t.fields || []).slice(0, 6).map((f: any, i: number) => (
                                      <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-bold text-slate-500">
                                        <span>{FIELD_TYPES.find(ft => ft.value === f.type)?.icon}</span>
                                        {f.label}
                                        {f.required && <span className="text-rose-400">*</span>}
                                      </span>
                                    ))}
                                    {(t.fields || []).length > 6 && (
                                      <span className="px-2 py-1 bg-indigo-50 text-indigo-500 rounded-lg text-[10px] font-bold">+{t.fields.length - 6} mais</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}

                            {addingTemplate ? (
                              <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl flex flex-col gap-3">
                                <input autoFocus value={newTemplateTitle} onChange={e => setNewTemplateTitle(e.target.value)} placeholder="Nome do modelo (Ex: Anamnese Inicial Adulto)..." className="w-full bg-white p-4 rounded-xl border-none outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-indigo-900 placeholder:text-indigo-300" />
                                <div className="flex gap-2">
                                  <button onClick={() => setAddingTemplate(false)} className="flex-1 py-3 bg-white text-indigo-400 font-bold rounded-xl">Cancelar</button>
                                  <button onClick={() => handleAddTemplate('anamnesis')} className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-md">Criar Modelo</button>
                                </div>
                              </div>
                            ) : (
                              <button onClick={() => setAddingTemplate(true)} className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 font-bold hover:border-indigo-300 hover:text-indigo-600 transition-all">+ Novo Modelo de Anamnese</button>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* =============== TIPOS DE EVOLUÃ‡ÃƒO =============== */}
                    {editingItem.item === 'Tipos de EvoluÃ§Ã£o' && (
                      <div className="space-y-3">
                        <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex items-start gap-3">
                          <span className="text-2xl shrink-0">ðŸ’¡</span>
                          <div>
                            <p className="font-bold text-amber-900 text-sm">O que sÃ£o Tipos de EvoluÃ§Ã£o?</p>
                            <p className="text-xs text-amber-700 mt-1">SÃ£o categorias para classificar cada nota de prontuÃ¡rio. Ao registrar uma evoluÃ§Ã£o no painel do terapeuta, ele escolhe o tipo que melhor descreve aquela sessÃ£o.</p>
                          </div>
                        </div>

                        {evolutionTypes.map(et => (
                          <div key={et.id} className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-2xl group hover:border-slate-300 transition-all">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm shrink-0" style={{ backgroundColor: et.color + '22', border: `2px solid ${et.color}` }}>
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: et.color }} />
                              </div>
                              <div>
                                <p className="font-bold text-slate-900" style={{ color: et.color }}>{et.name}</p>
                                {et.description && <p className="text-xs text-slate-400 font-medium mt-0.5">{et.description}</p>}
                              </div>
                            </div>
                            {deletingId === et.id ? (
                              <div className="flex items-center gap-2 animate-in fade-in zoom-in">
                                <button onClick={() => setDeletingId(null)} className="px-3 py-2 bg-slate-200 text-slate-700 font-bold rounded-lg text-xs">Cancelar</button>
                                <button onClick={() => { handleDeleteEvolutionType(et.id); setDeletingId(null); }} className="px-3 py-2 bg-rose-500 text-white font-bold rounded-lg text-xs">Excluir</button>
                              </div>
                            ) : (
                              <button onClick={() => setDeletingId(et.id)} className="p-2 text-slate-200 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all opacity-0 group-hover:opacity-100">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ))}

                        {addingEvolType ? (
                          <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
                            <input
                              autoFocus
                              value={newEvolType.name}
                              onChange={e => setNewEvolType({...newEvolType, name: e.target.value})}
                              placeholder="Nome do tipo (Ex: SessÃ£o Regular, Alta, Crise...)" 
                              className="w-full bg-white p-4 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-900"
                            />
                            <input
                              value={newEvolType.description}
                              onChange={e => setNewEvolType({...newEvolType, description: e.target.value})}
                              placeholder="DescriÃ§Ã£o breve (opcional)"
                              className="w-full bg-white p-4 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700"
                            />
                            <div className="space-y-2">
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Cor Identificadora</label>
                              <div className="flex gap-3 flex-wrap">
                                {EVOL_COLORS.map(c => (
                                  <button
                                    key={c}
                                    onClick={() => setNewEvolType({...newEvolType, color: c})}
                                    className={cn('w-8 h-8 rounded-full border-2 transition-all hover:scale-110', newEvolType.color === c ? 'border-slate-900 scale-110' : 'border-transparent')}
                                    style={{ backgroundColor: c }}
                                  />
                                ))}
                              </div>
                              {newEvolType.name && (
                                <div className="flex items-center gap-2 p-3 bg-white rounded-xl border border-slate-100">
                                  <span className="text-xs text-slate-500">PrÃ©-visualizaÃ§Ã£o:</span>
                                  <span className="px-3 py-1 rounded-full text-xs font-black" style={{ backgroundColor: newEvolType.color + '22', color: newEvolType.color, border: `1.5px solid ${newEvolType.color}` }}>
                                    {newEvolType.name}
                                  </span>
                                </div>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => setAddingEvolType(false)} className="flex-1 py-3 bg-white text-slate-500 font-bold rounded-xl border border-slate-200">Cancelar</button>
                              <button onClick={handleAddEvolutionType} className="flex-1 py-3 bg-slate-900 text-white font-bold rounded-xl shadow-md hover:bg-black transition-colors">Criar Tipo</button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => setAddingEvolType(true)} className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 font-bold hover:border-slate-400 hover:text-slate-600 transition-all">+ Novo Tipo de EvoluÃ§Ã£o</button>
                        )}
                      </div>
                    )}

                    {/* =============== TERMOS DE CONSENTIMENTO =============== */}
                    {editingItem.item === 'Termos de Consentimento' && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-800 font-medium flex-1 mr-4">
                            <strong>Tags dinÃ¢micas disponÃ­veis:</strong>{' '}
                            <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono text-[10px] mr-1">{`{{nome_paciente}}`}</code>
                            <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono text-[10px] mr-1">{`{{cpf_paciente}}`}</code>
                            <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono text-[10px]">{`{{data_atual}}`}</code>
                          </div>
                          <button
                            onClick={() => setContractPreview(!contractPreview)}
                            className={cn('px-4 py-2.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-2 whitespace-nowrap', contractPreview ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300')}
                          >
                            {contractPreview ? 'âœï¸ Editar' : 'ðŸ‘ï¸ PrÃ©-visualizar'}
                          </button>
                        </div>

                        {contractPreview ? (
                          <div className="bg-white border border-slate-200 rounded-2xl p-8 space-y-4 shadow-sm">
                            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                              <div>
                                <p className="font-black text-slate-900 text-lg">Termo de PrestaÃ§Ã£o de ServiÃ§os TerapÃªuticos</p>
                                <p className="text-xs text-slate-400 font-medium mt-1">PrÃ©-visualizaÃ§Ã£o com dados de exemplo</p>
                              </div>
                              <div className="px-3 py-1.5 bg-amber-50 text-amber-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-amber-100">Aguardando Assinatura</div>
                            </div>
                            <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-medium">
                              {contractTemplate
                                .replace(/\{\{nome_paciente\}\}/g, 'Maria da Silva')
                                .replace(/\{\{cpf_paciente\}\}/g, '123.456.789-00')
                                .replace(/\{\{data_atual\}\}/g, new Date().toLocaleDateString('pt-BR'))}
                            </div>
                            <div className="pt-6 border-t border-slate-100">
                              <div className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl font-bold text-sm cursor-not-allowed opacity-60">
                                âœï¸ Assinar Digitalmente (SimulaÃ§Ã£o)
                              </div>
                            </div>
                          </div>
                        ) : (
                          <textarea
                            value={contractTemplate}
                            onChange={e => setContractTemplate(e.target.value)}
                            rows={14}
                            className="w-full p-5 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 font-mono text-slate-700 text-sm resize-y leading-relaxed transition-all"
                            placeholder="Escreva as clÃ¡usulas do contrato aqui...&#10;&#10;Use as tags dinÃ¢micas para personalizar automaticamente."
                          />
                        )}

                        <div className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs text-slate-500">
                          <span className="text-xl">ðŸ”</span>
                          <p>O contrato serÃ¡ enviado via WhatsApp ao paciente quando ele iniciar um novo pacote terapÃªutico. O link de assinatura digital Ã© gerado automaticamente pelo sistema.</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {editingItem.section === 'NotificaÃ§Ãµes & Alertas' && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between p-6 bg-slate-50 rounded-2xl border border-slate-200">
                      <div>
                        <p className="font-bold text-slate-900">Lembretes de SessÃ£o</p>
                        <p className="text-xs text-slate-500 mt-1">Enviar WhatsApp automÃ¡tico 24h antes da sessÃ£o</p>
                      </div>
                      <button onClick={() => setNotifications({...notifications, sessionReminders: !notifications.sessionReminders})} className={cn("relative inline-flex h-7 w-12 items-center rounded-full transition-colors", notifications.sessionReminders ? "bg-indigo-600" : "bg-slate-300")}>
                        <span className={cn("inline-block h-5 w-5 transform rounded-full bg-white transition-transform", notifications.sessionReminders ? "translate-x-6" : "translate-x-1")} />
                      </button>
                    </div>
                    
                    <div className="flex items-center justify-between p-6 bg-slate-50 rounded-2xl border border-slate-200">
                      <div>
                        <p className="font-bold text-slate-900">ConfirmaÃ§Ã£o de Pagamento</p>
                        <p className="text-xs text-slate-500 mt-1">Recibo via WhatsApp apÃ³s pagamento do Pix/CartÃ£o</p>
                      </div>
                      <button onClick={() => setNotifications({...notifications, paymentConfirm: !notifications.paymentConfirm})} className={cn("relative inline-flex h-7 w-12 items-center rounded-full transition-colors", notifications.paymentConfirm ? "bg-indigo-600" : "bg-slate-300")}>
                        <span className={cn("inline-block h-5 w-5 transform rounded-full bg-white transition-transform", notifications.paymentConfirm ? "translate-x-6" : "translate-x-1")} />
                      </button>
                    </div>

                    <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-bold text-slate-900">Mensagem de AniversÃ¡rio (WhatsApp)</p>
                          <p className="text-xs text-slate-500 mt-1">Enviar mensagem automatizada no dia do aniversÃ¡rio do paciente</p>
                        </div>
                        <button onClick={() => setNotifications({...notifications, birthdayReminder: !notifications.birthdayReminder})} className={cn("relative inline-flex h-7 w-12 items-center rounded-full transition-colors", notifications.birthdayReminder ? "bg-indigo-600" : "bg-slate-300")}>
                          <span className={cn("inline-block h-5 w-5 transform rounded-full bg-white transition-transform", notifications.birthdayReminder ? "translate-x-6" : "translate-x-1")} />
                        </button>
                      </div>
                      {notifications.birthdayReminder && (
                        <div className="space-y-1.5 pt-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Mensagem de AniversÃ¡rio (Use {"{{nome}}"} para o nome do paciente)</label>
                          <textarea rows={3} value={notifications.birthdayMessage} onChange={e => setNotifications({...notifications, birthdayMessage: e.target.value})} className="w-full bg-white p-4 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700 text-sm" />
                        </div>
                      )}
                    </div>

                    <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-bold text-slate-900">Pesquisa NPS (SatisfaÃ§Ã£o)</p>
                          <p className="text-xs text-slate-500 mt-1">Disparo automÃ¡tico apÃ³s finalizar a sessÃ£o pelo painel.</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                         <div className="space-y-1.5 md:col-span-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Espera (Minutos)</label>
                            <input value={npsSettings.delay_minutes} onChange={e => setNpsSettings({...npsSettings, delay_minutes: Number(e.target.value)})} type="number" className="w-full bg-white p-4 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-900" />
                         </div>
                         <div className="space-y-1.5 md:col-span-3">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Mensagem (Use a tecla Enter para pular linha)</label>
                            <textarea rows={3} value={npsSettings.message} onChange={e => setNpsSettings({...npsSettings, message: e.target.value})} className="w-full bg-white p-4 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700 text-sm" />
                         </div>
                      </div>
                    </div>

                    {editingItem.item === 'AutomaÃ§Ã£o de Tickets' && (
                      <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-bold text-slate-900">Encerramento AutomÃ¡tico</p>
                            <p className="text-xs text-slate-500 mt-1">Fechamento de conversas inativas para manter a caixa de entrada limpa.</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                           <div className="space-y-1.5 md:col-span-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Tempo Limite (Horas)</label>
                              <input value={ticketSettings.autoCloseHours} onChange={e => setTicketSettings({...ticketSettings, autoCloseHours: Number(e.target.value)})} type="number" min="1" className="w-full bg-white p-4 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-900" />
                           </div>
                           <div className="space-y-1.5 md:col-span-3">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Mensagem de Encerramento (Deixe em branco para nÃ£o avisar)</label>
                              <textarea rows={3} value={ticketSettings.closeMessage} onChange={e => setTicketSettings({...ticketSettings, closeMessage: e.target.value})} className="w-full bg-white p-4 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700 text-sm" placeholder="O atendimento foi finalizado..." />
                           </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="p-8 border-t border-slate-100 bg-white flex gap-4">
                <button onClick={() => { setEditingItem(null); setAddingService(false); setAddingTemplate(false); setDeletingId(null); setAddingRole(false); }} className="flex-1 py-4 bg-slate-50 hover:bg-slate-100 rounded-2xl font-bold text-slate-600 transition-colors">Cancelar</button>
                <button onClick={saveSettings} className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold shadow-xl shadow-indigo-100 flex items-center justify-center gap-2 transition-all">
                  {loading ? <Clock className="w-5 h-5 animate-spin" /> : 'Salvar AlteraÃ§Ãµes'}
                </button>
              </div>
           </div>
        </div>
      )}

      {/* Editor de Marca Modal */}
      {isEditorOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in duration-300">
           <div className="bg-white rounded-[2.5rem] w-full max-w-4xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-100"><Palette className="w-6 h-6" /></div>
                  <div>
                     <h3 className="text-2xl font-bold text-slate-900 tracking-tight">Editor de Marca</h3>
                     <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">PersonalizaÃ§Ã£o White Label</p>
                  </div>
                </div>
                <button onClick={() => setIsEditorOpen(false)} className="p-2 hover:bg-white rounded-full transition-all text-slate-400 border border-transparent hover:border-slate-200"><X className="w-6 h-6" /></button>
              </div>

              <div className="p-8 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-10">
                 <div className="space-y-6">
                    <div className="space-y-2">
                       <label className="text-xs font-bold text-slate-500 uppercase">Nome da ClÃ­nica (Portal)</label>
                       <input 
                         value={whiteLabel.portalName} 
                         onChange={e => setWhiteLabel({...whiteLabel, portalName: e.target.value})} 
                         className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold" 
                         placeholder="Minha ClÃ­nica" 
                       />
                    </div>
                    
                    <div className="space-y-2">
                       <label className="text-xs font-bold text-slate-500 uppercase">Logo da ClÃ­nica</label>
                       <div className="flex items-center gap-3">
                         <input 
                           value={whiteLabel.logoUrl} 
                           onChange={e => setWhiteLabel({...whiteLabel, logoUrl: e.target.value})} 
                           className="flex-1 p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-sm truncate" 
                           placeholder="Cole a URL ou faÃ§a upload" 
                         />
                         <input 
                           type="file" 
                           accept="image/*" 
                           className="hidden" 
                           ref={fileInputRef}
                           onChange={handleLogoUpload}
                         />
                         <button 
                           onClick={() => fileInputRef.current?.click()}
                           className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl hover:bg-indigo-100 transition-colors shrink-0 shadow-sm border border-indigo-100 flex items-center justify-center"
                           title="Fazer upload de imagem (MÃ¡x 2MB)"
                         >
                           <Upload className="w-5 h-5" />
                         </button>
                       </div>
                       <p className="text-[10px] text-slate-400 font-medium">Recomendado: Fundo transparente (PNG), mÃ¡ximo 2MB. VocÃª pode colar uma URL pÃºblica ou fazer o upload do arquivo.</p>
                    </div>

                    <div className="space-y-2">
                       <label className="text-xs font-bold text-slate-500 uppercase">Cor Principal</label>
                       <div className="flex items-center gap-4">
                          <input 
                            type="color" 
                            value={whiteLabel.primaryColor} 
                            onChange={e => setWhiteLabel({...whiteLabel, primaryColor: e.target.value})} 
                            className="w-14 h-14 rounded-2xl cursor-pointer border-none p-0 overflow-hidden" 
                          />
                          <input 
                            value={whiteLabel.primaryColor} 
                            onChange={e => setWhiteLabel({...whiteLabel, primaryColor: e.target.value})} 
                            className="flex-1 p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-mono font-bold" 
                            placeholder="#4f46e5" 
                          />
                       </div>
                    </div>

                    <div className="space-y-2">
                       <label className="text-xs font-bold text-slate-500 uppercase">Cor SecundÃ¡ria (Fundo/Destaques)</label>
                       <div className="flex items-center gap-4">
                          <input 
                            type="color" 
                            value={whiteLabel.secondaryColor} 
                            onChange={e => setWhiteLabel({...whiteLabel, secondaryColor: e.target.value})} 
                            className="w-14 h-14 rounded-2xl cursor-pointer border-none p-0 overflow-hidden" 
                          />
                          <input 
                            value={whiteLabel.secondaryColor} 
                            onChange={e => setWhiteLabel({...whiteLabel, secondaryColor: e.target.value})} 
                            className="flex-1 p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-mono font-bold" 
                            placeholder="#e0e7ff" 
                          />
                       </div>
                    </div>
                 </div>

                 {/* Preview */}
                 <div className="bg-slate-100 rounded-3xl p-6 border border-slate-200 flex flex-col">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Preview (Portal do Paciente)</p>
                    <div 
                      className="flex-1 rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col"
                      style={{ backgroundColor: '#ffffff' }}
                    >
                       {/* Mock Header */}
                       <div className="p-4 border-b border-slate-100 flex items-center justify-between" style={{ backgroundColor: whiteLabel.primaryColor }}>
                          <div className="flex items-center gap-2">
                             {whiteLabel.logoUrl ? (
                               <img src={whiteLabel.logoUrl} alt="Logo" className="h-6 object-contain" />
                             ) : (
                               <div className="w-6 h-6 bg-white/20 rounded-md" />
                             )}
                             <span className="font-bold text-white text-sm">{whiteLabel.portalName}</span>
                          </div>
                          <div className="w-6 h-6 rounded-full bg-white/20" />
                       </div>
                       
                       {/* Mock Body */}
                       <div className="p-6 space-y-4" style={{ backgroundColor: whiteLabel.secondaryColor + '20' }}>
                          <h4 className="font-bold text-slate-800">Meus Agendamentos</h4>
                          <div className="p-4 bg-white rounded-xl shadow-sm border border-slate-100 flex justify-between items-center">
                             <div>
                                <p className="font-bold text-sm text-slate-800">SessÃ£o de Terapia</p>
                                <p className="text-xs text-slate-500">AmanhÃ£, 14:00</p>
                             </div>
                             <button className="px-4 py-2 rounded-lg text-xs font-bold text-white" style={{ backgroundColor: whiteLabel.primaryColor }}>
                                Detalhes
                             </button>
                          </div>
                       </div>
                    </div>
                 </div>
              </div>

              <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end">
                 <button onClick={async () => { await saveSettings(); setIsEditorOpen(false); window.location.reload(); }} className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5" /> Salvar Identidade Visual
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* White Label Preview */}
      <div className="bg-slate-900 rounded-[3rem] p-12 text-white relative overflow-hidden shadow-2xl mt-10">
        <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-10">
          <div className="space-y-4 max-w-xl text-center lg:text-left">
            <h3 className="text-3xl font-bold tracking-tight">Identidade Visual (White Label)</h3>
            <p className="text-slate-400 text-lg">Personalize o Portal do Paciente com as cores e logo da sua clÃ­nica para uma experiÃªncia 100% proprietÃ¡ria.</p>
          </div>
          <button onClick={() => setIsEditorOpen(true)} className="px-10 py-5 bg-white text-slate-900 rounded-2xl font-bold hover:scale-105 transition-all flex items-center gap-3 shadow-2xl">
            <Palette className="w-6 h-6 text-indigo-600" /> Abrir Editor de Marca
          </button>
        </div>
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
      </div>

    </div>
  );
}

