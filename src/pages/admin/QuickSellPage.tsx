import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  CreditCard, DollarSign, CheckCircle2, AlertCircle, Loader2, X, Save, 
  Users, Briefcase, Percent, ArrowUpRight, ArrowDownRight, Plus, Search, ChevronDown, Check, Trash2, FileText
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { supabase } from '@/src/lib/supabase';
import { sendWhatsAppMessage } from '@/src/lib/whatsapp';
import { getSystemBaseUrl } from '@/src/utils/systemUrl';
import { fillContractTemplate, DEFAULT_CONTRACT_TEMPLATE } from '@/src/lib/contract';

interface Therapist {
  id: string;
  name: string;
  phone: string | null;
  pix_key: string | null;
  commission_rate_clinic: number;
  commission_rate_self: number;
  user_id: string | null;
}

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const parseCurrency = (val: string) => {
  if (!val) return 0;
  return parseFloat(val.replace(/\./g, '').replace(',', '.'));
};

const formatCurrencyInput = (val: string) => {
  let v = val.replace(/\D/g, '');
  if (!v) return '';
  const num = parseInt(v, 10) / 100;
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const PAYMENT_METHODS = [
  { value: 'asaas_pix', label: 'PIX (Gerar QR Code - Asaas)' },
  { value: 'asaas_credit', label: 'Cartão de Crédito Online (Enviar WhatsApp - Asaas)' },
  { value: 'credit_card', label: 'Cartão de Crédito (Maquininha Física)' },
  { value: 'debit_card', label: 'Cartão de Débito (Maquininha Física)' },
  { value: 'cash', label: 'Dinheiro' },
  { value: 'transfer', label: 'Transferência / TED' },
  { value: 'pix', label: 'PIX Manual (Chave da Clínica)' },
];

const CATEGORIES_INCOME = ['Sessão', 'Consulta', 'Pacote', 'Avaliação', 'Outros'];
const CATEGORIES_EXPENSE = ['Aluguel', 'Insumos', 'Marketing', 'Comissão', 'Impostos', 'Outros'];

interface CartItem {
  id: string;
  isCustomEntry: boolean;
  customTitle: string;
  customPrice: string;
  customSessions: string;
  service_id: string | null;
  catalogPrice: string;
  catalogSessions: string;
  service_name: string;
  service_type?: string;
  priceNum: number;
  sessionsNum: number;
}

export default function QuickSellPage() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [patients, setPatients] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [therapists, setTherapists] = useState<Therapist[]>([]);

  const emptySell = { patient_id: '', service_id: '', payment_method: 'asaas_pix', therapist_id: '', referral_source: 'therapist' as const };
  const [sellData, setSellData] = useState(emptySell);
  
  const [patientSearch, setPatientSearch] = useState('');
  const [isPatientDropdownOpen, setIsPatientDropdownOpen] = useState(false);
  const [recentPayments, setRecentPayments] = useState<any[]>([]);
  const [cardFeeRateInput, setCardFeeRateInput] = useState('0');
  
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  
  const [isCustomEntry, setIsCustomEntry] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [customSessions, setCustomSessions] = useState('1');
  const [generateContract, setGenerateContract] = useState(true);

  const [catalogPrice, setCatalogPrice] = useState<string>('');
  const [catalogSessions, setCatalogSessions] = useState<string>('');

  const filteredPatients = useMemo(() => {
    if (!patientSearch || !patientSearch.trim()) return patients;
    
    // Remove acentos e normaliza para minúsculas
    const normalize = (str: string) =>
      (str || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();

    const searchTerm = normalize(patientSearch);
    const searchTokens = searchTerm.split(/\s+/).filter(Boolean);
    const searchDigits = patientSearch.replace(/\D/g, '');

    return patients.filter(p => {
      const patientName = normalize(p.name || '');
      const patientCpf = (p.cpf || '').toLowerCase();
      const patientCpfDigits = (p.cpf || '').replace(/\D/g, '');
      const patientPhoneDigits = (p.phone || '').replace(/\D/g, '');

      // 1. Busca por nome (todos os termos digitados devem constar no nome)
      const matchesName = searchTokens.every(token => patientName.includes(token));

      // 2. Busca por CPF
      const matchesCpf = patientCpf.includes(searchTerm) || 
        (searchDigits.length > 0 && patientCpfDigits.includes(searchDigits));

      // 3. Busca por telefone
      const matchesPhone = searchDigits.length > 0 && patientPhoneDigits.includes(searchDigits);

      return matchesName || matchesCpf || matchesPhone;
    });
  }, [patients, patientSearch]);

  // Modal Novo Lançamento (Identico ao Financeiro)
  const [showEntryModal, setShowEntryModal] = useState(false);
  const emptyEntry = {
    type: 'income' as 'income' | 'expense',
    amount: '',
    description: '',
    category: 'Sessão',
    status: 'paid' as 'paid' | 'pending',
    payment_method: 'pix',
    due_date: new Date().toISOString().split('T')[0],
    is_fixed: false
  };
  const [newEntry, setNewEntry] = useState(emptyEntry);

  const handleCreateEntry = async () => {
    if (!newEntry.amount || Number(newEntry.amount) <= 0) {
      showToast('Informe o valor do lançamento.', 'error');
      return;
    }
    if (!newEntry.description) {
      showToast('Informe a descrição.', 'error');
      return;
    }

    setSaving(true);
    const amountVal = Number(newEntry.amount);
    let rate = 0;
    if (newEntry.payment_method === 'credit_card') rate = 3.5;
    else if (newEntry.payment_method === 'debit_card') rate = 1.5;
    else if (newEntry.payment_method === 'asaas_pix') rate = 0.99;
    else if (newEntry.payment_method === 'asaas_credit') rate = 3.49;

    const feeVal = newEntry.type === 'income' ? amountVal * (rate / 100) : 0;
    const netVal = newEntry.type === 'income' ? amountVal - feeVal : amountVal;

    const { error } = await supabase.from('payments').insert([{
      amount: amountVal,
      net_amount: netVal,
      card_fee_rate: rate,
      card_fee_val: feeVal,
      type: newEntry.type,
      status: newEntry.status,
      description: newEntry.description,
      category: newEntry.category,
      payment_method: newEntry.payment_method,
      due_date: newEntry.due_date || null,
      is_fixed: newEntry.is_fixed,
      created_at: new Date().toISOString(),
    }]);

    if (error) {
      console.error(error);
      showToast('Erro ao salvar lançamento.', 'error');
    } else {
      showToast('Lançamento salvo com sucesso!');
      setShowEntryModal(false);
      setNewEntry(emptyEntry);
      fetchData();
    }
    setSaving(false);
  };

  const handleDeletePayment = async (id: string, description?: string) => {
    const descText = description ? ` "${description}"` : '';
    if (!window.confirm(`Tem certeza que deseja EXCLUIR permanentemente este lançamento${descText}?\n\nEsta ação não poderá ser desfeita.`)) {
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('payments').delete().eq('id', id);
    if (error) {
      showToast('Erro ao excluir lançamento: ' + error.message, 'error');
    } else {
      showToast('Lançamento excluído com sucesso!');
      fetchData();
    }
    setSaving(false);
  };

  const [createdAsaasPayment, setCreatedAsaasPayment] = useState<{ url: string; amount: number; patientName: string; phone: string | null; paymentId: string } | null>(null);
  const [createdPixQrCode, setCreatedPixQrCode] = useState<{ encodedImage: string; payload: string; amount: number; patientName: string; paymentId: string } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [servicesRes, patientsRes, paymentsRes] = await Promise.all([
        supabase.from('services').select('*').order('name'),
        supabase.from('patients').select('id, name, phone, cpf').eq('status', 'Ativo').order('name'),
        supabase.from('payments').select('id, amount, net_amount, card_fee_rate, card_fee_val, status, type, created_at, description, payment_method, asaas_link, patient_id').order('created_at', { ascending: false }).limit(8)
      ]);

      setServices(servicesRes.data || []);
      setPatients(patientsRes.data || []);
      setRecentPayments(paymentsRes.data || []);

      const therapistsRes = await supabase
        .from('therapists')
        .select('id, name, phone, pix_key, commission_rate_clinic, commission_rate_self, user_id, active')
        .eq('active', true)
        .order('name');
      
      if (!therapistsRes.error) {
        setTherapists((therapistsRes.data || []) as Therapist[]);
      } else {
        const fallback = await supabase.from('therapists').select('id, name, user_id').eq('active', true).order('name');
        setTherapists(((fallback.data || []).map((t: any) => ({
          ...t,
          phone: null, pix_key: null,
          commission_rate_clinic: 50, commission_rate_self: 25,
        }))) as Therapist[]);
      }
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
      showToast('Erro ao carregar dados do banco.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel('public:payments')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'payments' },
        (payload) => {
          if (payload.new.status === 'paid') {
            setCreatedPixQrCode(null);
            setCreatedAsaasPayment(null);
            setSellData(emptySell);
            fetchData();
            showToast('✅ Pagamento reconhecido com sucesso!', 'success');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const activePaymentId = createdPixQrCode?.paymentId || createdAsaasPayment?.paymentId;
    if (!activePaymentId) return;

    const interval = setInterval(async () => {
      const { data } = await supabase.from('payments').select('status').eq('id', activePaymentId).single();
      if (data?.status === 'paid') {
        setCreatedPixQrCode(null);
        setCreatedAsaasPayment(null);
        setSellData(emptySell);
        fetchData();
        showToast('✅ Pagamento reconhecido com sucesso!', 'success');
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [createdPixQrCode?.paymentId, createdAsaasPayment?.paymentId]);

  const handleSelectCatalogService = (serviceId: string) => {
    if (!serviceId) return;
    const svc = services.find(s => s.id === serviceId);
    if (!svc) return;

    const newItem: CartItem = {
      id: Math.random().toString(36).substring(7),
      isCustomEntry: false,
      customTitle: '',
      customPrice: '',
      customSessions: '',
      service_id: svc.id,
      catalogPrice: formatCurrencyInput(svc.price.toFixed(2)),
      catalogSessions: String(svc.sessions_count || 1),
      service_name: svc.name,
      service_type: svc.type,
      priceNum: svc.price || 0,
      sessionsNum: svc.sessions_count || 1
    };

    setCartItems(prev => [...prev, newItem]);
    setSellData(prev => ({ ...prev, service_id: '' }));
    showToast(`✅ "${svc.name}" adicionado à venda!`);
  };

  const handleAddCustomEntry = () => {
    if (!customTitle.trim()) {
      showToast('Digite a descrição do lançamento avulso.', 'error');
      return;
    }
    const price = parseCurrency(customPrice) || 0;
    if (price <= 0) {
      showToast('Digite um valor válido para o lançamento.', 'error');
      return;
    }

    const newItem: CartItem = {
      id: Math.random().toString(36).substring(7),
      isCustomEntry: true,
      customTitle: customTitle.trim(),
      customPrice,
      customSessions,
      service_id: null,
      catalogPrice: '',
      catalogSessions: '',
      service_name: customTitle.trim(),
      priceNum: price,
      sessionsNum: parseInt(customSessions) || 1
    };

    setCartItems(prev => [...prev, newItem]);
    setCustomTitle('');
    setCustomPrice('');
    setCustomSessions('1');
    showToast('✅ Item avulso adicionado!');
  };

  const updateCartItemPrice = (id: string, formattedVal: string) => {
    const num = parseCurrency(formattedVal) || 0;
    setCartItems(prev => prev.map(item => 
      item.id === id ? { ...item, catalogPrice: formattedVal, priceNum: num } : item
    ));
  };

  const updateCartItemSessions = (id: string, sessionsStr: string) => {
    const num = parseInt(sessionsStr) || 1;
    setCartItems(prev => prev.map(item => 
      item.id === id ? { ...item, catalogSessions: sessionsStr, sessionsNum: num } : item
    ));
  };

  const handleFinalizeSale = async () => {
    if (!sellData.patient_id) {
      showToast('Selecione o paciente.', 'error');
      return;
    }

    // Se o usuário não clicou em "+ Adicionar", mas preencheu o formulário de serviço/avulso, inclui automaticamente
    let effectiveItems = [...cartItems];
    if (effectiveItems.length === 0) {
      if (isCustomEntry) {
        if (!customTitle.trim()) {
          showToast('Preencha a descrição do lançamento ou adicione um item à venda.', 'error');
          return;
        }
        const price = parseCurrency(customPrice) || 0;
        if (price <= 0) {
          showToast('Informe um valor válido para o lançamento.', 'error');
          return;
        }
        effectiveItems.push({
          id: Math.random().toString(36).substring(7),
          isCustomEntry: true,
          customTitle,
          customPrice,
          customSessions,
          service_id: null,
          catalogPrice: '',
          catalogSessions: '',
          service_name: customTitle.trim(),
          priceNum: price,
          sessionsNum: parseInt(customSessions) || 1
        });
      } else {
        if (!sellData.service_id) {
          showToast('Selecione um serviço do catálogo ou adicione um item à venda.', 'error');
          return;
        }
        const service = services.find(s => s.id === sellData.service_id);
        const price = (catalogPrice !== '' ? parseCurrency(catalogPrice) : (service?.price || 0)) || 0;
        const totalSessions = (catalogSessions !== '' ? parseInt(catalogSessions) : (service?.sessions_count || 1)) || 1;
        effectiveItems.push({
          id: Math.random().toString(36).substring(7),
          isCustomEntry: false,
          customTitle: '',
          customPrice: '',
          customSessions: '',
          service_id: sellData.service_id,
          catalogPrice,
          catalogSessions,
          service_name: service?.name || 'Serviço',
          service_type: service?.type,
          priceNum: price,
          sessionsNum: totalSessions
        });
      }
    }

    setSaving(true);

    const patient = patients.find(p => p.id === sellData.patient_id);
    const therapist = therapists.find(t => t.id === sellData.therapist_id);

    if (!patient) { setSaving(false); return; }

    const totalPrice = effectiveItems.reduce((sum, item) => sum + item.priceNum, 0);
    const itemNames = effectiveItems.map(i => i.service_name).join(' + ');
    const description = `${itemNames} — ${patient.name}${therapist ? ` (${therapist.name})` : ''}`;

    let asaasId: string | null = null;
    let asaasLink: string | null = null;

    const isAsaas = sellData.payment_method.startsWith('asaas_');
    const isAsaasPix = sellData.payment_method === 'asaas_pix';

    // Pagamentos manuais / maquininha física já entram como pagos imediatamente
    const paymentStatus = isAsaas ? 'pending' : 'paid';

    if (isAsaas) {
      try {
        const { data: result, error: fnError } = await supabase.functions.invoke('asaas-integration/checkout', {
          method: 'POST',
          body: {
            valor: totalPrice,
            pacienteId: sellData.patient_id,
            description: `Venda Múltipla — Tzion Terapias`,
            billingType: isAsaasPix ? 'PIX' : 'CREDIT_CARD'
          }
        });

        if (fnError || result?.error) {
          showToast(result?.error || 'Erro ao gerar cobrança no Asaas.', 'error');
          setSaving(false);
          return;
        }

        asaasId = result.id;
        asaasLink = result.invoiceUrl;
      } catch (err) {
        console.error('Erro na integração Asaas:', err);
        showToast('Erro de rede ao conectar com o Asaas.', 'error');
        setSaving(false);
        return;
      }
    }

    const rate = (sellData.payment_method === 'credit_card' || sellData.payment_method === 'debit_card')
      ? (parseFloat(cardFeeRateInput) || 0)
      : (sellData.payment_method === 'asaas_pix' ? 0.99 : (sellData.payment_method === 'asaas_credit' ? 3.49 : 0));
    const feeVal = totalPrice * (rate / 100);
    const netVal = totalPrice - feeVal;

    const { data: payData, error: payErr } = await supabase.from('payments').insert([{
      amount: totalPrice,
      type: 'income',
      status: paymentStatus,
      description,
      category: 'Serviço',
      payment_method: isAsaas ? 'asaas' : sellData.payment_method,
      patient_id: sellData.patient_id,
      therapist_id: sellData.therapist_id || null,
      referral_source: sellData.referral_source,
      created_at: new Date().toISOString(),
      asaas_id: asaasId,
      asaas_link: asaasLink,
      card_fee_rate: rate,
      card_fee_val: feeVal,
      net_amount: netVal
    }]).select().single();

    if (payErr || !payData) { 
      showToast('Erro ao registrar pagamento.', 'error'); 
      setSaving(false); 
      return; 
    }

    let hasGeneratedContract = false;

    for (const item of effectiveItems) {
      const { data: pkgData, error: pkgErr } = await supabase.from('patient_packages').insert([{
        patient_id: sellData.patient_id,
        service_id: !item.isCustomEntry ? item.service_id : null,
        total_sessions: item.sessionsNum,
        used_sessions: 0,
        status: isAsaas ? 'pending' : 'active',
      }]).select().single();

      if (pkgErr) {
        console.error('Erro ao criar pacote:', pkgErr);
        continue;
      }

      // Emissão de Contrato: Executa se generateContract estiver ativo ou se for pacote contratado
      const isPackage = item.sessionsNum > 1 || item.service_type === 'pacote' || (item.service_name && item.service_name.toLowerCase().includes('pacote'));
      const shouldGenerate = generateContract || isPackage;

      if (!isAsaas && shouldGenerate && pkgData) {
        try {
          const { data: setts } = await supabase.from('settings').select('value').eq('key', 'contract_template').maybeSingle();
          const rawTpl = setts?.value || DEFAULT_CONTRACT_TEMPLATE;
          const therapistObj = therapists.find(t => t.id === sellData.therapist_id);
          const itemName = item.service_name || item.customTitle || 'Atendimento Terapêutico';

          const filledTpl = fillContractTemplate(rawTpl, {
            patient,
            therapist: therapistObj,
            package: {
              ...pkgData,
              total_sessions: item.sessionsNum || 1,
              price: item.priceNum || item.price || totalPrice || 0,
              service_name: itemName
            }
          });

          const { data: contract, error: cErr } = await supabase.from('patient_contracts').insert({
            patient_id: patient.id,
            content: filledTpl,
            status: 'pending',
          }).select().single();

          if (cErr) {
            console.error('Erro ao salvar contrato na tabela patient_contracts:', cErr);
          } else if (contract) {
            hasGeneratedContract = true;
            if (patient.phone) {
              const firstName = patient.name.split(' ')[0];
              const baseUrl = await getSystemBaseUrl();
              const link = `${baseUrl}/contrato/${contract.id}`;
              const msg = `Olá, *${firstName}*! ✨\n\nO seu termo de compromisso de serviço terapêutico foi gerado pela Clínica Tzion Terapias.\n\nPor favor, leia e assine digitalmente no link seguro abaixo:\n\n🔗 ${link}\n\nQualquer dúvida, estamos à disposição! 💙`;
              await sendWhatsAppMessage(patient.id, patient.phone, msg, 'contract_sent');
            }
          }
        } catch (contractErr) {
          console.error('Erro ao gerar/enviar contrato na venda rápida:', contractErr);
        }
      }
    }

    if (isAsaasPix && asaasId) {
      try {
        const { data: qrData, error: fnError } = await supabase.functions.invoke(`asaas-integration/pix`, {
          method: 'POST',
          body: { paymentId: asaasId }
        });
        
        if (!fnError && qrData && (qrData.success || qrData.encodedImage)) {
          setCreatedPixQrCode({
            encodedImage: qrData.encodedImage,
            payload: qrData.payload,
            amount: totalPrice,
            patientName: patient.name,
            paymentId: payData.id
          });
          showToast('QR Code do PIX gerado com sucesso!');
        } else {
          showToast(qrData?.error || 'Erro ao gerar QR Code do PIX.', 'error');
        }
      } catch (err) {
        console.error('Erro ao buscar QR Code:', err);
        showToast('Erro ao buscar QR Code do PIX.', 'error');
      }
    } else if (sellData.payment_method === 'asaas_credit' && asaasLink) {
      setCreatedAsaasPayment({
        url: asaasLink,
        amount: totalPrice,
        patientName: patient.name,
        phone: patient.phone,
        paymentId: payData.id
      });

      if (patient.phone) {
        try {
          const firstName = patient.name.split(' ')[0];
          const msg = `Olá, *${firstName}*! ✨\n\nSegue o link para pagamento da sua compra na Tzion Terapias:\n\n🔗 ${asaasLink}\n\n💳 Você pode parcelar no Cartão de Crédito em até 12x, ou pagar via PIX/Boleto.\n\nQualquer dúvida, estamos à disposição! 💙`;
          await sendWhatsAppMessage(patient.id, patient.phone, msg, 'payment_link_sent');
          showToast('Cobrança gerada e enviada via WhatsApp!');
        } catch (err) {
          console.error('Erro ao enviar WhatsApp:', err);
          showToast('Cobrança gerada, mas erro ao enviar WhatsApp.', 'error');
        }
      } else {
        showToast('Cobrança gerada com sucesso! Copie o link abaixo.');
      }
    } else {
      if (hasGeneratedContract) {
        showToast('✅ Venda registrada e contrato enviado via WhatsApp!');
      } else {
        showToast('✅ Venda registrada com sucesso!');
      }
      setSellData(emptySell);
      setCartItems([]);
      setCustomTitle('');
      setCustomPrice('');
      setCustomSessions('1');
      setCatalogPrice('');
      setCatalogSessions('');
    }

    fetchData();
    setSaving(false);
  };

  return (
    <>
      {toast && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[300] animate-in slide-in-from-top-4 fade-in duration-300">
          <div className={cn(
            "px-8 py-4 rounded-xl shadow-2xl font-bold flex items-center gap-3",
            toast.type === 'success' ? "bg-slate-900 text-white" : "bg-rose-600 text-white"
          )}>
            {toast.type === 'success'
              ? <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              : <AlertCircle className="w-5 h-5 text-rose-200" />}
            {toast.message}
          </div>
        </div>
      )}

      <div className="w-full pb-4 animate-in fade-in duration-500 relative grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Lado Esquerdo: Formulário */}
        <div className="lg:col-span-7 space-y-4">
          {/* Header card */}
          <div className="bg-white p-6 sm:p-8 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-emerald-500 text-white rounded-lg shadow-lg shadow-emerald-100 shrink-0">
                <Briefcase className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-800 tracking-tight leading-tight">Venda Rápida de Serviços</h2>
                <p className="text-slate-500 text-sm mt-1 font-medium">Cadastre vendas e gere links de pagamento sem precisar abrir o financeiro.</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowEntryModal(true)}
              className="px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-sm shadow-md shadow-indigo-200 transition-all flex items-center gap-2 shrink-0 cursor-pointer"
            >
              + Lançamento Avulso
            </button>
          </div>

          {/* Form card */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden p-6 sm:p-6 space-y-5">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
                <p className="text-slate-400 font-bold text-sm">Carregando dados...</p>
              </div>
            ) : (
              <>
                {/* Paciente */}
                <div className="space-y-2 relative">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Paciente *</label>
                  <div className="relative">
                    <div 
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-lg outline-none font-bold text-slate-700 hover:border-indigo-400 transition-all cursor-pointer text-sm flex items-center justify-between"
                      onClick={() => setIsPatientDropdownOpen(!isPatientDropdownOpen)}
                    >
                      <span className="truncate">
                        {sellData.patient_id 
                          ? patients.find(p => p.id === sellData.patient_id)?.name || 'Selecione o paciente...'
                          : 'Selecione o paciente...'}
                      </span>
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    </div>
                    
                    {isPatientDropdownOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsPatientDropdownOpen(false)}></div>
                        <div className="absolute top-full mt-2 left-0 w-full bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
                          <div className="p-3 border-b border-slate-100 flex items-center gap-2">
                            <Search className="w-4 h-4 text-slate-400" />
                            <input 
                              type="text"
                              autoFocus
                              placeholder="Buscar por nome ou CPF..."
                              value={patientSearch}
                              onChange={e => setPatientSearch(e.target.value)}
                              className="w-full text-sm font-medium text-slate-700 outline-none"
                            />
                          </div>
                          <div className="max-h-60 overflow-y-auto p-2 space-y-1">
                            {filteredPatients.length === 0 ? (
                              <div className="p-4 text-center text-sm text-slate-400 font-medium">Nenhum paciente encontrado.</div>
                            ) : (
                              filteredPatients.map(p => (
                                <div 
                                  key={p.id}
                                  onClick={() => {
                                    setSellData({ ...sellData, patient_id: p.id });
                                    setIsPatientDropdownOpen(false);
                                    setPatientSearch('');
                                  }}
                                  className={cn(
                                    "w-full text-left px-3 py-2 text-sm font-bold rounded-lg transition-colors cursor-pointer flex items-center justify-between",
                                    sellData.patient_id === p.id ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50"
                                  )}
                                >
                                  <div>
                                    <div>{p.name}</div>
                                    {p.cpf && <div className="text-[10px] font-medium text-slate-400 mt-0.5">CPF: {p.cpf}</div>}
                                  </div>
                                  {sellData.patient_id === p.id && <Check className="w-4 h-4" />}
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4 mb-2">
                  <span className="text-xs font-black text-indigo-600 uppercase tracking-widest bg-indigo-100 px-3 py-1 rounded-full">Passo 1</span>
                  <span className="text-sm font-bold text-slate-500 uppercase tracking-widest">Adicionar Itens</span>
                </div>

                <div className="flex items-center gap-4 mb-4 mt-2">
                  <button 
                    type="button"
                    onClick={() => setIsCustomEntry(false)}
                    className={cn("px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all", !isCustomEntry ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200")}
                  >
                    Do Catálogo
                  </button>
                  <button 
                    type="button"
                    onClick={() => setIsCustomEntry(true)}
                    className={cn("px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all", isCustomEntry ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200")}
                  >
                    Avulso Manual
                  </button>
                </div>

                {/* Modo Lançamento Avulso vs Serviço do Catálogo */}
                {isCustomEntry ? (
                  <div className="p-6 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-4 animate-in fade-in duration-300">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">
                        ✨ Lançamento Avulso Personalizado
                      </span>
                      <span className="px-3 py-1 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-full uppercase">
                        Valor Customizado
                      </span>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Descrição do Serviço / Produto *</label>
                      <input
                        type="text"
                        value={customTitle}
                        onChange={e => setCustomTitle(e.target.value)}
                        placeholder="Ex: Sessão Especial de Hipnose, Produto, Avaliação..."
                        className="w-full px-5 py-4 bg-white border border-slate-200 rounded-lg outline-none font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 text-sm shadow-sm"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Valor do Lançamento (R$) *</label>
                        <input
                          type="text"
                          value={customPrice}
                          onChange={e => setCustomPrice(formatCurrencyInput(e.target.value))}
                          placeholder="0,00"
                          className="w-full px-5 py-4 bg-white border border-slate-200 rounded-lg outline-none font-black text-indigo-600 text-base shadow-sm"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Qtd. de Sessões / Créditos</label>
                        <input
                          type="number"
                          min="1"
                          value={customSessions}
                          onChange={e => setCustomSessions(e.target.value)}
                          placeholder="1"
                          className="w-full px-5 py-4 bg-white border border-slate-200 rounded-lg outline-none font-bold text-slate-800 text-left text-sm shadow-sm"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddCustomEntry}
                      className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-sm shadow-md shadow-indigo-100 transition-all flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" /> Adicionar Item Avulso à Venda
                    </button>
                  </div>
                ) : (
                  /* Serviço do Catálogo - Adiciona automaticamente ao selecionar */
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                        Selecione o Serviço ou Pacote (Adiciona Automaticamente) *
                      </label>
                      <select 
                        value="" 
                        onChange={e => handleSelectCatalogService(e.target.value)}
                        className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-lg outline-none font-bold text-slate-700 appearance-none focus:bg-white focus:border-indigo-400 transition-all cursor-pointer text-sm"
                      >
                        <option value="">+ Clique aqui para escolher um serviço...</option>
                        {services.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.name} — R$ {fmt(s.price)} ({s.type === 'pacote' ? `${s.sessions_count} sessões` : 'Avulso'})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* Lista de Itens na Venda com edição direta de valores e remoção */}
                <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                      🛒 Itens na Venda ({cartItems.length})
                    </h4>
                    {cartItems.length > 0 && (
                      <span className="text-[10px] font-bold text-slate-400 uppercase">
                        Valores e sessões podem ser ajustados abaixo
                      </span>
                    )}
                  </div>

                  {cartItems.length === 0 ? (
                    <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-xl bg-white/60">
                      <p className="text-xs font-bold text-slate-400">Nenhum serviço selecionado ainda.</p>
                      <p className="text-[11px] text-slate-400 mt-1">Escolha um serviço no catálogo acima para incluir na venda automaticamente.</p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {cartItems.map((item, idx) => (
                        <div key={item.id} className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-black text-xs flex items-center justify-center">
                                  {idx + 1}
                                </span>
                                <p className="font-black text-slate-800 text-sm">{item.service_name}</p>
                              </div>
                              <p className="text-[11px] text-slate-400 font-medium ml-7 mt-0.5">
                                {item.isCustomEntry ? 'Lançamento Avulso' : 'Catálogo'} • {item.sessionsNum} {item.sessionsNum === 1 ? 'Sessão/Unidade' : 'Sessões/Unidades'}
                              </p>
                            </div>
                            <button 
                              type="button"
                              onClick={() => setCartItems(cartItems.filter(i => i.id !== item.id))} 
                              className="text-rose-500 hover:text-rose-700 p-1.5 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
                              title="Remover item da venda"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Ajustes rápidos inline do item */}
                          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                            <div>
                              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Valor (R$)</label>
                              <input
                                type="text"
                                value={item.catalogPrice || formatCurrencyInput(item.priceNum.toFixed(2))}
                                onChange={e => updateCartItemPrice(item.id, formatCurrencyInput(e.target.value))}
                                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-black text-indigo-600 text-sm outline-none focus:bg-white focus:border-indigo-400"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Sessões / Créditos</label>
                              <input
                                type="number"
                                min="1"
                                value={item.catalogSessions || item.sessionsNum}
                                onChange={e => updateCartItemSessions(item.id, e.target.value)}
                                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-700 text-sm outline-none focus:bg-white focus:border-indigo-400"
                              />
                            </div>
                          </div>
                        </div>
                      ))}

                      <div className="flex justify-between items-center pt-3 border-t border-slate-200/80 px-1">
                        <span className="font-black text-slate-600 text-xs uppercase tracking-wider">Total a Pagar</span>
                        <span className="font-black text-indigo-950 text-xl">
                          R$ {fmt(cartItems.reduce((acc, curr) => acc + curr.priceNum, 0))}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

            {/* Forma de Pagamento e Terapeuta */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Forma de Pagamento</label>
                <select 
                  value={sellData.payment_method} 
                  onChange={e => {
                    const method = e.target.value;
                    let defaultRate = '0';
                    if (method === 'credit_card') defaultRate = '3.5';
                    else if (method === 'debit_card') defaultRate = '1.5';
                    setSellData({ ...sellData, payment_method: method });
                    setCardFeeRateInput(defaultRate);
                  }}
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-lg outline-none font-bold text-slate-700 appearance-none focus:bg-white focus:border-indigo-400 transition-all cursor-pointer text-sm"
                >
                  {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Terapeuta</label>
                <select 
                  value={sellData.therapist_id} 
                  onChange={e => setSellData({ ...sellData, therapist_id: e.target.value })}
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-lg outline-none font-bold text-slate-700 appearance-none focus:bg-white focus:border-indigo-400 transition-all cursor-pointer text-sm"
                >
                  <option value="">Sem terapeuta</option>
                  {therapists.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>

            {/* Taxa da Maquininha (cartões) */}
            {(sellData.payment_method === 'credit_card' || sellData.payment_method === 'debit_card') && (
              <div className="p-5 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Taxa da Maquininha (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={cardFeeRateInput}
                    onChange={e => setCardFeeRateInput(e.target.value)}
                    className="w-24 px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-black text-slate-700 text-right outline-none focus:border-indigo-500 text-sm"
                  />
                </div>
                {(() => {
                  const rate = parseFloat(cardFeeRateInput) || 0;
                  const totalPrice = cartItems.reduce((acc, curr) => acc + curr.priceNum, 0);
                  const feeVal = totalPrice * (rate / 100);
                  const netVal = totalPrice - feeVal;
                  return (
                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 font-medium pt-2.5 border-t border-slate-200/60">
                      <div>Taxa Cobrada: <strong className="text-slate-800">R$ {fmt(feeVal)}</strong></div>
                      <div className="text-right">Líquido Recebido: <strong className="text-indigo-600">R$ {fmt(netVal)}</strong></div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Origem do Paciente */}
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Origem do Paciente</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(['clinic', 'therapist'] as const).map(src => {
                  const th = therapists.find(t => t.id === sellData.therapist_id);
                  const rate = src === 'clinic' ? (th?.commission_rate_clinic ?? 50) : (th?.commission_rate_self ?? 25);
                  return (
                    <button 
                      key={src} 
                      type="button" 
                      onClick={() => setSellData({ ...sellData, referral_source: src })}
                      className={cn("p-4 rounded-lg border-2 font-bold text-sm flex flex-col items-center gap-2 transition-all cursor-pointer",
                        sellData.referral_source === src
                          ? src === 'clinic' ? "bg-indigo-50/50 border-indigo-500 text-indigo-700" : "bg-emerald-50/50 border-emerald-500 text-emerald-700"
                          : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                      )}
                    >
                      <span className="text-2xl">{src === 'clinic' ? '🏥' : '👨‍⚕️'}</span>
                      <span>{src === 'clinic' ? 'Pela Clínica' : 'Pelo Terapeuta'}</span>
                      <span className={cn("text-[10px] px-2.5 py-1 rounded-full font-black",
                        sellData.referral_source === src
                          ? src === 'clinic' ? "bg-indigo-100 text-indigo-700" : "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-400"
                      )}>{rate}% para a clínica</span>
                    </button>
                  );
                })}
              </div>

              {/* Preview de comissão */}
              {cartItems.length > 0 && (() => {
                const th = therapists.find(t => t.id === sellData.therapist_id);
                const rate = sellData.referral_source === 'clinic' ? (th?.commission_rate_clinic ?? 50) : (th?.commission_rate_self ?? 25);
                const totalPrice = cartItems.reduce((acc, curr) => acc + curr.priceNum, 0);
                const clinicAmt = totalPrice * (rate / 100);
                const therapistAmt = totalPrice - clinicAmt;
                return (
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200/60 grid grid-cols-2 gap-4 text-left">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Clínica recebe</p>
                      <p className="text-lg font-black text-indigo-600">R$ {fmt(clinicAmt)}</p>
                      <p className="text-[10px] text-slate-400 font-bold">{rate}%</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Terapeuta recebe</p>
                      <p className="text-lg font-black text-emerald-600">R$ {fmt(therapistAmt)}</p>
                      <p className="text-[10px] text-slate-400 font-bold">{100 - rate}%</p>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Emissão de Contrato Digital */}
            <div className="p-5 bg-gradient-to-r from-indigo-50/70 to-slate-50 border border-indigo-100/80 rounded-2xl flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-indigo-600 text-white rounded-xl shadow-md shadow-indigo-100 shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-black text-slate-800">Emissão de Contrato Digital</p>
                  <p className="text-[11px] text-slate-500 font-medium">Gerar Termo de Adesão e enviar link seguro de assinatura via WhatsApp (para pacotes ou avulsos)</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input 
                  type="checkbox" 
                  checked={generateContract} 
                  onChange={e => setGenerateContract(e.target.checked)} 
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            {/* Confirm button */}
            <button 
              onClick={handleFinalizeSale} 
              disabled={saving || cartItems.length === 0}
              className="w-full py-5 bg-emerald-500 text-white rounded-xl font-black text-lg shadow-xl shadow-emerald-100 hover:bg-emerald-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />} Confirmar Venda {cartItems.length > 0 && `(R$ ${fmt(cartItems.reduce((acc, curr) => acc + curr.priceNum, 0))})`}
            </button>
          </>
        )}
        </div>
        </div>

        {/* Lado Direito: Últimas Vendas */}
        <div className="lg:col-span-5 sticky top-6">
          {/* ÚLTIMAS VENDAS (ACOMPANHAMENTO PARA A RECEPÇÃO) */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-slate-50 text-slate-400 rounded-lg">
                <DollarSign className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-800">Últimas Vendas</h3>
                <p className="text-sm text-slate-500 font-medium">Acompanhe o status das vendas recentes</p>
              </div>
            </div>
            <button onClick={fetchData} className="p-3 bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-lg transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
            </button>
          </div>

          <div className="space-y-4">
            {recentPayments.length === 0 ? (
              <p className="text-center text-slate-400 py-4 font-medium">Nenhuma venda recente.</p>
            ) : (
              recentPayments.map(payment => {
                const isExpense = payment.type === 'expense';
                return (
                  <div 
                    key={payment.id} 
                    className={cn(
                      "flex flex-col p-4 rounded-xl border gap-3 transition-all",
                      isExpense ? "bg-orange-50/25 border-orange-100 hover:border-orange-200" : "bg-slate-50 border-slate-100 hover:border-slate-200"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
                          isExpense 
                            ? (payment.status === 'paid' ? "bg-orange-100 text-orange-600" : "bg-amber-100 text-amber-600")
                            : (payment.status === 'paid' ? "bg-emerald-100 text-emerald-600" : "bg-blue-100 text-blue-600")
                        )}>
                          {isExpense ? (
                            payment.status === 'paid' ? <ArrowDownRight className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />
                          ) : (
                            payment.status === 'paid' ? <CheckCircle2 className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-slate-800 line-clamp-1">{payment.description}</p>
                            <span className={cn(
                              "text-[9px] font-black uppercase px-1.5 py-0.5 rounded tracking-wider shrink-0",
                              isExpense ? "bg-orange-100 text-orange-700" : "bg-emerald-100 text-emerald-700"
                            )}>
                              {isExpense ? 'Saída' : 'Entrada'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">{new Date(payment.created_at).toLocaleString('pt-BR')}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="flex items-start justify-end gap-2">
                          <div>
                            <p className={cn(
                              "text-sm font-black",
                              isExpense ? "text-orange-600" : "text-emerald-600"
                            )}>
                              {isExpense ? '-' : '+'} R$ {fmt(isExpense ? payment.amount : (payment.net_amount !== null && payment.net_amount !== undefined ? payment.net_amount : payment.amount))}
                            </p>
                            {!isExpense && ((payment.card_fee_val && payment.card_fee_val > 0) || (payment.net_amount !== null && payment.net_amount !== undefined && payment.net_amount < payment.amount)) && (
                              <p className="text-[10px] text-slate-400 font-semibold">
                                Bruto: R$ {fmt(payment.amount)} (Taxa: -R$ {fmt(payment.card_fee_val || (payment.amount - (payment.net_amount || 0)))})
                              </p>
                            )}
                            <p className={cn(
                              "text-[10px] font-black uppercase tracking-widest mt-0.5",
                              payment.status === 'paid' 
                                ? (isExpense ? "text-orange-600" : "text-emerald-600")
                                : payment.status === 'cancelled' 
                                  ? "text-rose-500" 
                                  : (isExpense ? "text-amber-600" : "text-blue-600")
                            )}>
                              {payment.status === 'paid' 
                                ? (isExpense ? 'Pago (Despesa)' : 'Pago') 
                                : payment.status === 'cancelled' 
                                  ? 'Cancelado' 
                                  : (isExpense ? 'A Pagar' : 'Pendente')}
                            </p>
                          </div>
                          <button
                            onClick={() => handleDeletePayment(payment.id, payment.description)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors ml-1 cursor-pointer"
                            title="Excluir lançamento"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  
                  {payment.status === 'pending' && payment.patient_id && (
                    <button
                      onClick={async () => {
                        const pat = patients.find(p => p.id === payment.patient_id);
                        if (!pat?.phone) {
                          showToast('Paciente não possui telefone cadastrado.', 'error');
                          return;
                        }
                        try {
                          const firstName = pat.name.split(' ')[0];
                          let msg = '';
                          if (payment.asaas_link) {
                            msg = `Olá, *${firstName}*! ✨\n\nSegue o link para pagamento da sua cobrança pendente na Tzion Terapias:\n\n🔗 ${payment.asaas_link}\n\n💳 Você pode parcelar no Cartão de Crédito, ou pagar via PIX.\n\nQualquer dúvida, estamos à disposição! 💙`;
                          } else {
                            msg = `Olá, *${firstName}*! ✨\n\nPassando para lembrar que você possui um acerto pendente no valor de *R$ ${fmt(payment.amount)}* referente a:\n📍 ${payment.description}\n\nPor favor, entre em contato para regularizar ou caso já tenha efetuado o pagamento. Qualquer dúvida, estamos à disposição! 💙`;
                          }
                          
                          await sendWhatsAppMessage(pat.id, pat.phone, msg, 'payment_link_sent');
                          showToast('Lembrete enviado via WhatsApp com sucesso!');
                        } catch (err) {
                          console.error('Erro ao reenviar WhatsApp:', err);
                          showToast('Erro ao reenviar a cobrança.', 'error');
                        }
                      }}
                      className="w-full py-2.5 mt-1 bg-white border border-slate-200 text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
                      Reenviar Cobrança no WhatsApp
                    </button>
                  )}
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      </div>

      {/* Modal: PIX QR Code */}
      {createdPixQrCode && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white rounded-[3rem] w-full max-w-md shadow-2xl border border-slate-100 overflow-hidden">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-indigo-50/50">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-600 text-white rounded-lg"><DollarSign className="w-6 h-6" /></div>
                <div>
                  <h3 className="text-2xl font-black text-slate-900">Pagamento PIX</h3>
                  <p className="text-sm text-slate-500 font-medium">Escaneie o QR Code abaixo</p>
                </div>
              </div>
              <button onClick={() => setCreatedPixQrCode(null)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 cursor-pointer"><X className="w-6 h-6" /></button>
            </div>
            
            <div className="p-8 space-y-6 text-left">
              <div className="space-y-2">
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Paciente</p>
                <p className="text-lg font-black text-slate-800">{createdPixQrCode.patientName}</p>
                <p className="text-3xl font-black text-indigo-600">R$ {fmt(createdPixQrCode.amount)}</p>
              </div>

              {/* QR Code Image */}
              <div className="flex items-center justify-center">
                <img 
                  src={`data:image/png;base64,${createdPixQrCode.encodedImage}`} 
                  alt="QR Code PIX" 
                  className="w-56 h-56 rounded-lg border border-slate-200 p-3 bg-white shadow-inner" 
                />
              </div>

              <div className="space-y-3 text-left">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">PIX Copia e Cola</label>
                  <textarea 
                    readOnly 
                    value={createdPixQrCode.payload} 
                    className="w-full text-[10px] font-mono text-slate-500 bg-slate-50 border border-slate-200 p-3 rounded-xl min-h-[60px] outline-none select-all" 
                  />
                </div>

                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(createdPixQrCode.payload);
                      showToast("Código PIX copiado com sucesso!");
                    } catch (err) {
                      showToast("Erro ao copiar código.", "error");
                    }
                  }}
                  className="w-full py-4 bg-slate-900 text-white rounded-lg font-bold shadow-lg hover:bg-slate-800 transition-all flex items-center justify-center gap-2 cursor-pointer text-sm"
                >
                  <Save className="w-5 h-5" /> Copiar Código PIX
                </button>

                <button 
                  onClick={() => setCreatedPixQrCode(null)}
                  className="w-full py-3 bg-slate-100 text-slate-600 rounded-lg font-bold hover:bg-slate-200 transition-all cursor-pointer text-sm"
                >
                  Fechar Janela
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Asaas Payment Link Info */}
      {createdAsaasPayment && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white rounded-[3rem] w-full max-w-md shadow-2xl border border-slate-100 overflow-hidden">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-indigo-50/50">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-600 text-white rounded-lg"><CreditCard className="w-6 h-6" /></div>
                <div>
                  <h3 className="text-2xl font-black text-slate-900">Cobrança Asaas</h3>
                  <p className="text-sm text-slate-500 font-medium">Link de pagamento online gerado!</p>
                </div>
              </div>
              <button onClick={() => setCreatedAsaasPayment(null)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 cursor-pointer"><X className="w-6 h-6" /></button>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="space-y-4">
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Paciente</p>
                  <p className="text-lg font-black text-slate-800">{createdAsaasPayment.patientName}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor da Cobrança</p>
                  <p className="text-2xl font-black text-indigo-600">R$ {fmt(createdAsaasPayment.amount)}</p>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(createdAsaasPayment.url);
                      showToast("Link copiado para a área de transferência!");
                    } catch (err) {
                      showToast("Erro ao copiar link.", "error");
                    }
                  }}
                  className="w-full py-4 bg-slate-900 text-white rounded-lg font-bold shadow-lg hover:bg-slate-800 transition-all flex items-center justify-center gap-2 cursor-pointer text-sm"
                >
                  <Save className="w-5 h-5" /> Copiar Link de Pagamento
                </button>

                {createdAsaasPayment.phone ? (
                  <a
                    href={`https://api.whatsapp.com/send?phone=55${createdAsaasPayment.phone.replace(/\D/g, '')}&text=${encodeURIComponent(
                      `Olá, *${createdAsaasPayment.patientName.split(' ')[0]}*! ✨\n\nSegue o link para pagamento do seu atendimento na Tzion Terapias:\n\n🔗 ${createdAsaasPayment.url}\n\nVocê pode pagar via PIX, Cartão de Crédito ou Boleto. Qualquer dúvida, estamos à disposição! 💙`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-4 bg-emerald-500 text-white rounded-lg font-bold shadow-lg hover:bg-emerald-600 transition-all flex items-center justify-center gap-2 text-center block cursor-pointer text-sm"
                  >
                    Enviar Link via WhatsApp Manual
                  </a>
                ) : null}

                <button 
                  onClick={() => setCreatedAsaasPayment(null)}
                  className="w-full py-3 bg-slate-100 text-slate-600 rounded-lg font-bold hover:bg-slate-200 transition-all cursor-pointer text-sm"
                >
                  Fechar Janela
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: NOVO LANÇAMENTO (AVULSO) */}
      {showEntryModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white rounded-[3rem] w-full max-w-lg shadow-2xl border border-slate-100 overflow-hidden">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-600 text-white rounded-lg shadow-md"><DollarSign className="w-6 h-6" /></div>
                <h3 className="text-2xl font-black text-slate-900">Novo Lançamento</h3>
              </div>
              <button onClick={() => setShowEntryModal(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"><X className="w-6 h-6" /></button>
            </div>
            <div className="p-8 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                {(['income', 'expense'] as const).map(t => (
                  <button key={t} onClick={() => setNewEntry({ ...newEntry, type: t })}
                    className={cn("py-4 rounded-lg font-bold flex items-center justify-center gap-2 border-2 transition-all cursor-pointer",
                      newEntry.type === t
                        ? t === 'income' ? "bg-emerald-50 border-emerald-500 text-emerald-600" : "bg-rose-50 border-rose-500 text-rose-600"
                        : "bg-slate-50 border-transparent text-slate-400 hover:border-slate-200"
                    )}>
                    {t === 'income' ? <><ArrowUpRight className="w-5 h-5" /> Receita</> : <><ArrowDownRight className="w-5 h-5" /> Despesa</>}
                  </button>
                ))}
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">VALOR (R$) *</label>
                <input type="number" step="0.01" value={newEntry.amount} onChange={e => setNewEntry({ ...newEntry, amount: e.target.value })}
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-lg outline-none text-2xl font-black text-slate-700 focus:ring-2 focus:ring-indigo-500/20" placeholder="0,00" autoFocus />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">DESCRIÇÃO *</label>
                <input value={newEntry.description} onChange={e => setNewEntry({ ...newEntry, description: e.target.value })}
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-lg outline-none font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500/20" placeholder="Ex: Aluguel da Sala" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">CATEGORIA</label>
                  <select value={newEntry.category} onChange={e => setNewEntry({ ...newEntry, category: e.target.value })}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-lg outline-none font-bold text-slate-700 appearance-none cursor-pointer">
                    {(newEntry.type === 'income' ? CATEGORIES_INCOME : CATEGORIES_EXPENSE).map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">STATUS</label>
                  <select value={newEntry.status} onChange={e => setNewEntry({ ...newEntry, status: e.target.value as any })}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-lg outline-none font-bold text-slate-700 appearance-none cursor-pointer">
                    <option value="paid">Pago / Recebido</option>
                    <option value="pending">Pendente</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">MÉTODO DE PAGAMENTO</label>
                  <select value={newEntry.payment_method} onChange={e => setNewEntry({ ...newEntry, payment_method: e.target.value })}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-lg outline-none font-bold text-slate-700 appearance-none cursor-pointer">
                    <option value="pix">PIX</option>
                    <option value="credit_card">Cartão de Crédito</option>
                    <option value="debit_card">Cartão de Débito</option>
                    <option value="cash">Dinheiro</option>
                    <option value="transfer">Transferência / TED</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">DATA DE VENCIMENTO</label>
                  <input type="date" value={newEntry.due_date} onChange={e => setNewEntry({ ...newEntry, due_date: e.target.value })}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-lg outline-none font-bold text-slate-700" />
                </div>
              </div>
              
              {newEntry.type === 'expense' && (
                <div className="flex items-center gap-3 p-4 bg-rose-50 border border-rose-100 rounded-lg">
                  <input type="checkbox" id="is_fixed_qs" checked={newEntry.is_fixed} onChange={e => setNewEntry({ ...newEntry, is_fixed: e.target.checked })}
                    className="w-5 h-5 rounded border-rose-300 text-rose-600 focus:ring-rose-500 cursor-pointer" />
                  <label htmlFor="is_fixed_qs" className="text-sm font-bold text-rose-700 cursor-pointer select-none">
                    Marcar como Despesa Fixa (Recorrente)
                  </label>
                </div>
              )}

              <button onClick={handleCreateEntry} disabled={saving}
                className="w-full py-5 bg-indigo-600 text-white rounded-lg font-bold shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer">
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} Salvar Lançamento
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
