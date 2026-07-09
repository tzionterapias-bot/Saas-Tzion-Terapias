import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  CreditCard, TrendingUp, TrendingDown, DollarSign, Download,
  Plus, Calendar, ArrowUpRight, ArrowDownRight,
  FileText, CheckCircle2, AlertCircle, Loader2, Link as LinkIcon, X, Save,
  Users, Briefcase, PieChart, Wallet, Clock, UserCheck, Percent,
  MessageCircle, ChevronLeft, ChevronRight, Ban, Receipt, BarChart2, Settings,
  Award, Check, Pencil
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend
} from 'recharts';
import { cn } from '@/src/lib/utils';
import { supabase } from '@/src/lib/supabase';
import { sendWhatsAppMessage } from '@/src/lib/whatsapp';
import { useAuth } from '@/src/contexts/AuthContext';
import { getSystemBaseUrl } from '@/src/utils/systemUrl';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Payment {
  id: string;
  amount: number;
  net_amount?: number | null;      // Valor líquido após taxas de cartão/Asaas
  card_fee_rate?: number | null;   // % da taxa cobrada
  card_fee_val?: number | null;    // Valor da taxa em R$
  installments?: number | null;    // Número de parcelas (crédito)
  is_fixed?: boolean;              // Se é uma despesa fixa
  type: 'income' | 'expense';
  status: 'paid' | 'pending' | 'cancelled';
  description: string;
  category: string;
  payment_method: string;
  referral_source: 'clinic' | 'therapist';
  therapist_id: string | null;
  patient_id: string | null;
  due_date: string | null;
  created_at: string;
  patients?: { name: string; phone: string };
  asaas_id?: string | null;
  asaas_link?: string | null;
  receipt_url?: string | null;
}

interface Therapist {
  id: string;
  name: string;
  phone: string | null;
  pix_key: string | null;
  commission_rate_clinic: number;
  commission_rate_self: number;
  user_id: string | null;
}

interface StaffBonus {
  id: string;
  staff_id: string;
  month: number;
  year: number;
  clinic_net_base: number;
  commission_rate: number;
  bonus_amount: number;
  status: 'pending' | 'paid';
  paid_at: string | null;
  payment_method: string | null;
  notes: string | null;
  staff?: { name: string; role: string; base_salary: number };
}

interface CommissionPayout {
  id: string;
  therapist_id: string;
  month: number;
  year: number;
  gross_total: number;
  clinic_share: number;
  therapist_net: number;
  status: 'pending' | 'paid';
  paid_at: string | null;
  notes: string | null;
  therapists?: { name: string };
}


interface DailyClosing {
  id: string;
  closing_date: string;
  expected_balance: number;
  physical_balance: number;
  difference: number;
  status: string;
  notes: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const MONTH_NAMES = Array.from({ length: 12 }, (_, i) =>
  new Date(2000, i, 1).toLocaleString('pt-BR', { month: 'long' })
);

const CATEGORIES_INCOME = ['Sessão', 'Avaliação', 'Pacote', 'Serviço', 'Outros'];
const CATEGORIES_EXPENSE = [
  'Aluguel', 'Internet', 'Energia', 'Água', 'Telefone', 
  'Insumos', 'Marketing', 'Impostos', 'Salário', 'Manutenção', 
  'Sistemas/Software', 'Limpeza', 'Outros'
];
const PAYMENT_METHODS = [
  { value: 'pix', label: 'PIX' },
  { value: 'credit_card', label: 'Cartão de Crédito (Maquininha)' },
  { value: 'debit_card', label: 'Cartão de Débito (Maquininha)' },
  { value: 'cash', label: 'Dinheiro' },
  { value: 'transfer', label: 'Transferência' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'asaas_pix', label: 'PIX (Gerar QR Code - Asaas)' },
  { value: 'asaas_credit', label: 'Cartão de Crédito Online (Enviar WhatsApp - Asaas)' },
];

// ── Taxas de pagamento configuráveis ───────────────────────────────────────
export const DEFAULT_FEE_RATES = {
  debit: 1.50,          // Débito (maquininha)
  credit_1x: 2.50,      // Crédito à vista
  credit_2_6x: 3.50,    // Crédito parcelado 2x–6x
  credit_7_12x: 4.99,   // Crédito parcelado 7x–12x
  asaas_pix: 0.99,      // PIX via Asaas
  asaas_credit: 3.49,   // Cartão online via Asaas
};
export type FeeRates = typeof DEFAULT_FEE_RATES;

const INSTALLMENT_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

function getFeeRate(method: string, installments: number, rates: FeeRates): number {
  if (method === 'debit_card') return rates.debit;
  if (method === 'credit_card') {
    if (installments === 1) return rates.credit_1x;
    if (installments <= 6) return rates.credit_2_6x;
    return rates.credit_7_12x;
  }
  if (method === 'asaas_pix') return rates.asaas_pix;
  if (method === 'asaas_credit' || method === 'asaas') return rates.asaas_credit;
  return 0;
}

const getMethodLabel = (method: string) => {
  const found = PAYMENT_METHODS.find(m => m.value === method);
  return found ? found.label : method;
};

function exportCSV(data: Payment[], filename: string) {
  const header = ['Data', 'Descrição', 'Categoria', 'Tipo', 'Valor', 'Método', 'Status'];
  const rows = data.map(p => [
    new Date(p.created_at).toLocaleDateString('pt-BR'),
    `"${(p.description || '').replace(/"/g, '""')}"`,
    p.category || '',
    p.type === 'income' ? 'Receita' : 'Despesa',
    fmt(Math.abs(p.amount)),
    p.payment_method || '',
    p.status === 'paid' ? 'Pago' : p.status === 'pending' ? 'Pendente' : 'Cancelado',
  ]);
  const csv = [header, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Toast ─────────────────────────────────────────────────────────────────────

interface ToastState { message: string; type: 'success' | 'error' }

function Toast({ toast }: { toast: ToastState }) {
  return (
    <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[300] animate-in slide-in-from-top-4 fade-in duration-300">
      <div className={cn(
        "px-8 py-4 rounded-[2rem] shadow-2xl font-bold flex items-center gap-3",
        toast.type === 'success' ? "bg-slate-900 text-white" : "bg-rose-600 text-white"
      )}>
        {toast.type === 'success'
          ? <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          : <AlertCircle className="w-5 h-5 text-rose-200" />}
        {toast.message}
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function FinancialPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    if (user?.role === 'atendimento') {
      setActiveTab('payables');
    }
  }, [user]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  // ── Data ────────────────────────────────────────────────────────────────────
  const [payments, setPayments] = useState<Payment[]>([]);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<CommissionPayout[]>([]);
  const [closings, setClosings] = useState<DailyClosing[]>([]);
  const [staffBonuses, setStaffBonuses] = useState<StaffBonus[]>([]);

  // ── Filter State ────────────────────────────────────────────────────────────
  const now = new Date();
  const [filterMonth, setFilterMonth] = useState(now.getMonth());
  const [filterYear] = useState(now.getFullYear());
  const [commissionMonth, setCommissionMonth] = useState(now.getMonth());
  const [staffBonusMonth, setStaffBonusMonth] = useState(now.getMonth());
  const [cashflowPage, setCashflowPage] = useState(1);
  const [payablesPage, setPayablesPage] = useState(1);
  const ITEMS = 10;

  // ── Modal State ─────────────────────────────────────────────────────────────
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [showSellModal, setShowSellModal] = useState(false);
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showPayoutModal, setShowPayoutModal] = useState<CommissionPayout | null>(null);
  const [showTherapistConfigModal, setShowTherapistConfigModal] = useState<Therapist | null>(null);
  const [showBonusModal, setShowBonusModal] = useState<StaffBonus | null>(null);
  const [bonusPayMethod, setBonusPayMethod] = useState('pix');
  const [bonusPayNote, setBonusPayNote] = useState('');
  const [createdAsaasPayment, setCreatedAsaasPayment] = useState<{ url: string; amount: number; patientName: string; phone: string | null; paymentId: string } | null>(null);
  const [createdPixQrCode, setCreatedPixQrCode] = useState<{ encodedImage: string; payload: string; amount: number; patientName: string; paymentId: string } | null>(null);
  const [confirmingPayment, setConfirmingPayment] = useState<Payment | null>(null);
  const [confirmMethod, setConfirmMethod] = useState('pix');
  const [confirmFeeRate, setConfirmFeeRate] = useState('0');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);

  // ── Form State ──────────────────────────────────────────────────────────────
  const emptyEntry = { amount: '', description: '', type: 'income' as const, status: 'paid' as const, category: 'Sessão', payment_method: 'pix', due_date: '', is_fixed: false };
  const [newEntry, setNewEntry] = useState(emptyEntry);
  const emptySell = { patient_id: '', service_id: '', payment_method: 'asaas_pix', therapist_id: '', referral_source: 'therapist' as const };
  const [sellData, setSellData] = useState(emptySell);
  const [cardFeeRateInput, setCardFeeRateInput] = useState('0');
  const [multimodalItems, setMultimodalItems] = useState<{ service_id: string; sessions: number }[]>([]);
  const [newStaff, setNewStaff] = useState({ name: '', role: '', commission_rate: '0', base_salary: '0' });
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [newSupplier, setNewSupplier] = useState({ company_name: '', cnpj: '', category: 'Manutenção', phone: '', email: '', products_provided: '' });
  const [payoutNote, setPayoutNote] = useState('');
  const [payoutMethod, setPayoutMethod] = useState('pix');
  const [closingInput, setClosingInput] = useState({ physical_balance: '', notes: '' });
  const [therapistConfig, setTherapistConfig] = useState({ commission_rate_clinic: '50', commission_rate_self: '25', pix_key: '', phone: '' });
  // ── Taxas de pagamento e parcelamento ───────────────────────────────────────
  const [feeRates, setFeeRates] = useState<FeeRates>(DEFAULT_FEE_RATES);
  const [feeRatesInput, setFeeRatesInput] = useState<FeeRates>(DEFAULT_FEE_RATES);
  const [showFeeSettingsModal, setShowFeeSettingsModal] = useState(false);
  const [installments, setInstallments] = useState(1);
  const [confirmInstallments, setConfirmInstallments] = useState(1);

  // ─── Toast Helper ────────────────────────────────────────────────────────────
  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // ─── Fetch ─────────────────────────────────────────────────────────────────
  // Resiliente: cada query falha de forma independente (tabelas novas podem não existir ainda)
  const fetchAll = useCallback(async () => {
    setLoading(true);

    // Queries que sempre existem
    const [paymentsRes, servicesRes, patientsRes, staffRes, suppliersRes] = await Promise.all([
      supabase.from('payments').select('*, patients(name, phone)').order('created_at', { ascending: false }),
      supabase.from('services').select('*').order('name'),
      supabase.from('patients').select('id, name, phone, cpf').order('name'),
      supabase.from('staff').select('*').order('name'),
      supabase.from('suppliers').select('*').order('company_name'),
    ]);

    setPayments((paymentsRes.data || []) as Payment[]);
    setServices(servicesRes.data || []);
    setPatients(patientsRes.data || []);
    if (staffRes.data) setStaff(staffRes.data);
    if (suppliersRes.data) setSuppliers(suppliersRes.data);

    // Carregar bônus da equipe
    const { data: bonusesData } = await supabase
      .from('staff_bonuses')
      .select('*, staff(name, role, base_salary)')
      .order('created_at', { ascending: false });
    setStaffBonuses((bonusesData || []) as StaffBonus[]);

    // Terapeuta — tenta selecionar colunas novas, mas faz fallback seguro
    const therapistsRes = await supabase
      .from('therapists')
      .select('id, name, phone, pix_key, commission_rate_clinic, commission_rate_self, user_id')
      .order('name');
    if (!therapistsRes.error) {
      setTherapists((therapistsRes.data || []) as Therapist[]);
    } else {
      // Fallback: buscar apenas colunas básicas se as novas ainda não existem
      const fallback = await supabase.from('therapists').select('id, name, user_id').order('name');
      setTherapists(((fallback.data || []).map((t: any) => ({
        ...t,
        phone: null, pix_key: null,
        commission_rate_clinic: 50, commission_rate_self: 25,
      }))) as Therapist[]);
    }

    // Tabelas criadas pela migration — opcional (mostra aviso no console se não existir ainda)
    const payoutsRes = await supabase
      .from('commission_payouts')
      .select('*, therapists(name)')
      .order('year', { ascending: false })
      .order('month', { ascending: false });
    if (!payoutsRes.error) {
      setPayouts((payoutsRes.data || []) as CommissionPayout[]);
    } else {
      console.warn('[Financeiro] Tabela commission_payouts não encontrada. Execute supabase_financial_v2.sql.');
      setPayouts([]);
    }

    const closingsRes = await supabase
      .from('daily_closings')
      .select('*')
      .order('closing_date', { ascending: false })
      .limit(30);
    if (!closingsRes.error) {
      setClosings((closingsRes.data || []) as DailyClosing[]);
    } else {
      console.warn('[Financeiro] Tabela daily_closings não encontrada. Execute supabase_financial_v2.sql.');
      setClosings([]);
    }

    // Carregar taxas de pagamento salvas
    const { data: feeSettingsData } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'payment_fee_rates')
      .single();
    if (feeSettingsData?.value) {
      try {
        const saved = JSON.parse(feeSettingsData.value) as Partial<FeeRates>;
        const merged = { ...DEFAULT_FEE_RATES, ...saved };
        setFeeRates(merged);
        setFeeRatesInput(merged);
      } catch { /* ignora erro de parse */ }
    }

    setLoading(false);
  }, [showToast]);

  useEffect(() => {
    fetchAll();

    // Tentar usar Realtime (mas temos o polling de segurança abaixo)
    const channel = supabase
      .channel('public:payments')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'payments' },
        (payload) => {
          if (payload.new.status === 'paid') {
            setCreatedPixQrCode(null);
            setCreatedAsaasPayment(null);
            showToast('✅ Pagamento reconhecido com sucesso!', 'success');
            fetchAll(); // Refresh the lists automatically
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAll, showToast]);

  // POLLING DE SEGURANÇA: Se o Realtime falhar por bloqueio de rede ou RLS
  useEffect(() => {
    const activePaymentId = createdPixQrCode?.paymentId || createdAsaasPayment?.paymentId;
    if (!activePaymentId) return;

    const interval = setInterval(async () => {
      const { data } = await supabase.from('payments').select('status').eq('id', activePaymentId).single();
      if (data?.status === 'paid') {
        setCreatedPixQrCode(null);
        setCreatedAsaasPayment(null);
        showToast('✅ Pagamento reconhecido com sucesso!', 'success');
        fetchAll(); // Refresh the lists automatically
      }
    }, 3000); // Poll a cada 3 segundos

    return () => clearInterval(interval);
  }, [createdPixQrCode?.paymentId, createdAsaasPayment?.paymentId, fetchAll, showToast]);

  const getPatientsForPayout = useCallback((therapistId: string, month: number, year: number) => {
    const tPayments = payments.filter(p =>
      p.therapist_id === therapistId &&
      p.type === 'income' &&
      p.status === 'paid' &&
      new Date(p.created_at).getMonth() === (month - 1) &&
      new Date(p.created_at).getFullYear() === year
    );
    const names = Array.from(new Set(tPayments.map(p => p.patients?.name).filter(Boolean)));
    return names.length > 0 ? names.join(', ') : '—';
  }, [payments]);

  // ─── Calculations (Memoized) ─────────────────────────────────────────────────

  // Pagamentos do mês/ano selecionado no filtro, apenas PAGOS
  const monthlyPaid = useMemo(() =>
    payments.filter(p => {
      const d = new Date(p.created_at);
      return d.getMonth() === filterMonth && d.getFullYear() === filterYear && p.status === 'paid';
    }), [payments, filterMonth, filterYear]
  );

  const receitaMes = useMemo(() =>
    monthlyPaid.filter(p => p.type === 'income').reduce((s, p) => s + (p.net_amount !== null && p.net_amount !== undefined ? Math.abs(p.net_amount) : Math.abs(p.amount)), 0),
    [monthlyPaid]
  );
  const despesaMes = useMemo(() =>
    monthlyPaid.filter(p => p.type === 'expense').reduce((s, p) => s + Math.abs(p.amount), 0),
    [monthlyPaid]
  );
  const saldoMes = receitaMes - despesaMes;

  const pendingIncome = useMemo(() =>
    payments.filter(p => p.status === 'pending' && p.type === 'income').reduce((s, p) => s + Math.abs(p.amount), 0),
    [payments]
  );

  const dashboardStats = useMemo(() => {
    const paidIncomes = monthlyPaid.filter(p => p.type === 'income');
    const grossIncome = paidIncomes.reduce((s, p) => s + (p.net_amount !== null && p.net_amount !== undefined ? Math.abs(p.net_amount) : Math.abs(p.amount)), 0);
    
    // Despesas operacionais não incluem repasses ou bônus de equipe, pois estes já são deduzidos do faturamento ou lucro
    const grossExpense = monthlyPaid.filter(p => 
      p.type === 'expense' && 
      p.category !== 'Repasse Terapeuta' && 
      p.category !== 'Bônus Equipe'
    ).reduce((s, p) => s + Math.abs(p.amount), 0);

    let totalTherapistShare = 0;
    
    paidIncomes.forEach(p => {
      if (p.therapist_id) {
        const th = therapists.find(t => t.id === p.therapist_id);
        if (th) {
          const rate = (p.referral_source || 'therapist') === 'clinic'
            ? (th.commission_rate_clinic ?? 50)
            : (th.commission_rate_self ?? 25);
          
          // Calcula a comissão com base no valor líquido (após taxas de cartão)
          const base = (p.net_amount !== null && p.net_amount !== undefined) ? Math.abs(p.net_amount) : Math.abs(p.amount);
          
          const clinicShare = base * (rate / 100);
          const therapistNet = base - clinicShare;
          totalTherapistShare += therapistNet;
        }
      }
    });

    const clinicShareGross = grossIncome - totalTherapistShare;
    const clinicNetRealized = clinicShareGross - grossExpense;

    return {
      grossIncome,
      grossExpense,
      totalTherapistShare,
      clinicShareGross,
      clinicNetRealized
    };
  }, [monthlyPaid, therapists]);

  const chartData = useMemo(() => Array.from({ length: 12 }, (_, i) => {
    const label = new Date(2000, i, 1).toLocaleString('pt-BR', { month: 'short' }).replace('.', '');
    const month = payments.filter(p => {
      const d = new Date(p.created_at);
      return d.getMonth() === i && d.getFullYear() === filterYear && p.status === 'paid';
    });
    const rec = month.filter(p => p.type === 'income').reduce((s, p) => s + (p.net_amount !== null && p.net_amount !== undefined ? Math.abs(p.net_amount) : Math.abs(p.amount)), 0);
    const des = month.filter(p => p.type === 'expense').reduce((s, p) => s + Math.abs(p.amount), 0);
    return { name: label.charAt(0).toUpperCase() + label.slice(1), Receita: rec, Despesa: des };
  }), [payments, filterYear]);

  // Comissões por terapeuta para o mês selecionado
  const commissionData = useMemo(() => therapists.map(t => {
    const rate_clinic = t.commission_rate_clinic ?? 50;
    const rate_self = t.commission_rate_self ?? 25;

    const tPayments = payments.filter(p =>
      p.therapist_id === t.id &&
      p.type === 'income' &&
      p.status === 'paid' &&
      new Date(p.created_at).getMonth() === commissionMonth &&
      new Date(p.created_at).getFullYear() === filterYear
    );

    if (tPayments.length === 0) return null;

    const clinicRefs = tPayments.filter(p => (p.referral_source || 'therapist') === 'clinic');
    const selfRefs = tPayments.filter(p => (p.referral_source || 'therapist') === 'therapist');

    // 🔧 BUG FIX: usar net_amount (valor líquido após taxas de cartão) como base de cálculo
    const netBase = (p: Payment) =>
      (p.net_amount !== null && p.net_amount !== undefined) ? Math.abs(p.net_amount) : Math.abs(p.amount);
    const grossClinic = clinicRefs.reduce((s, p) => s + netBase(p), 0);
    const grossSelf = selfRefs.reduce((s, p) => s + netBase(p), 0);
    const grossTotal = grossClinic + grossSelf;

    const clinicShareFromClinic = grossClinic * (rate_clinic / 100);
    const clinicShareFromSelf = grossSelf * (rate_self / 100);
    const totalClinicShare = clinicShareFromClinic + clinicShareFromSelf;
    const therapistNet = grossTotal - totalClinicShare;

    // Verificar se já existe payout registrado para este mês
    const existingPayout = payouts.find(po =>
      po.therapist_id === t.id &&
      po.month === (commissionMonth + 1) &&
      po.year === filterYear
    );

    const patientNames = Array.from(new Set(tPayments.map(p => p.patients?.name).filter(Boolean)));

    return {
      therapist: t,
      sessions: tPayments.length,
      grossTotal, grossClinic, grossSelf,
      clinicShareFromClinic, clinicShareFromSelf,
      totalClinicShare, therapistNet,
      rateClinic: rate_clinic, rateSelf: rate_self,
      existingPayout,
      patientNames,
    };
  }).filter(Boolean) as NonNullable<ReturnType<typeof commissionData[0]>>[],
    [payments, therapists, payouts, commissionMonth, filterYear]
  );

  // DRE Data
  const dreData = useMemo(() => {
    const yearPayments = payments.filter(p => new Date(p.created_at).getFullYear() === filterYear && p.status === 'paid');
    const totalReceita = yearPayments.filter(p => p.type === 'income').reduce((s, p) => s + (p.net_amount !== null && p.net_amount !== undefined ? Math.abs(p.net_amount) : Math.abs(p.amount)), 0);
    const totalDespesa = yearPayments.filter(p => p.type === 'expense').reduce((s, p) => s + Math.abs(p.amount), 0);
    const result = totalReceita - totalDespesa;

    const byCategory = yearPayments.reduce((acc, p) => {
      const key = p.category || 'Outros';
      if (!acc[key]) acc[key] = { income: 0, expense: 0 };
      if (p.type === 'income') acc[key].income += (p.net_amount !== null && p.net_amount !== undefined ? Math.abs(p.net_amount) : Math.abs(p.amount));
      else acc[key].expense += Math.abs(p.amount);
      return acc;
    }, {} as Record<string, { income: number; expense: number }>);

    return { totalReceita, totalDespesa, result, byCategory };
  }, [payments, filterYear]);

  // ─── Handlers ────────────────────────────────────────────────────────────────

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setReceiptFile(e.target.files[0]);
    }
  };

  const handleCreateEntry = async () => {
    if (!newEntry.amount || !newEntry.description) {
      showToast('Preencha o valor e a descrição.', 'error');
      return;
    }
    if (Number(newEntry.amount) <= 0) {
      showToast('O valor deve ser maior que zero.', 'error');
      return;
    }
    if (newEntry.payment_method === 'asaas') {
      showToast('Cobranças Asaas devem ser feitas na aba "Vender Serviço" associada a um paciente.', 'error');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('payments').insert([{
      amount: Number(newEntry.amount),
      type: newEntry.type,
      status: newEntry.status,
      description: newEntry.description,
      category: newEntry.category,
      payment_method: newEntry.payment_method,
      due_date: newEntry.due_date || null,
      is_fixed: newEntry.is_fixed,
      created_at: new Date().toISOString(),
    }]);
    if (error) { showToast('Erro ao salvar lançamento.', 'error'); }
    else {
      showToast('Lançamento salvo com sucesso!');
      setShowEntryModal(false);
      setNewEntry(emptyEntry);
      fetchAll();
    }
    setSaving(false);
  };

  const handleSellService = async () => {
    if (!sellData.patient_id || !sellData.service_id) {
      showToast('Selecione paciente e serviço.', 'error');
      return;
    }
    setSaving(true);

    const service = services.find(s => s.id === sellData.service_id);
    const patient = patients.find(p => p.id === sellData.patient_id);
    const therapist = therapists.find(t => t.id === sellData.therapist_id);
    if (!service || !patient) { setSaving(false); return; }

    // Validação de pacote multimodal se for do tipo 'pacote'
    if (service.type === 'pacote') {
      const totalAssigned = multimodalItems.reduce((acc, curr) => acc + (curr.sessions || 0), 0);
      if (totalAssigned !== service.sessions_count) {
        showToast(`A soma das sessões distribuídas (${totalAssigned}) deve ser exatamente igual ao total do pacote (${service.sessions_count}).`, 'error');
        setSaving(false);
        return;
      }
      if (multimodalItems.some(item => !item.service_id)) {
        showToast('Selecione o serviço para todos os itens distribuídos do pacote.', 'error');
        setSaving(false);
        return;
      }
    }

    let asaasId: string | null = null;
    let asaasLink: string | null = null;

    const isAsaas = sellData.payment_method.startsWith('asaas_');
    const isAsaasPix = sellData.payment_method === 'asaas_pix';

    if (isAsaas) {
      try {
        const { data: result, error: fnError } = await supabase.functions.invoke('asaas-integration/checkout', {
          method: 'POST',
          body: {
            valor: service.price,
            pacienteId: sellData.patient_id,
            description: `${service.name} — Tzion Terapias`,
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

    const isCardPayment = sellData.payment_method === 'credit_card' || sellData.payment_method === 'debit_card';
    const rate = isCardPayment
      ? (parseFloat(cardFeeRateInput) || 0)
      : getFeeRate(sellData.payment_method, installments, feeRates);
    const feeVal = service.price * (rate / 100);
    const netVal = service.price - feeVal;

    const { data: payData, error: payErr } = await supabase.from('payments').insert([{
      amount: service.price,
      type: 'income',
      status: 'pending',
      description: `${service.name} — ${patient.name}${therapist ? ` (${therapist.name})` : ''}`,
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

    if (payErr || !payData) { showToast('Erro ao registrar pagamento.', 'error'); setSaving(false); return; }

    // Criar pacote de sessões como 'pending' (será ativado quando o pagamento for confirmado)
    const { data: pkgData, error: pkgErr } = await supabase.from('patient_packages').insert([{
      patient_id: sellData.patient_id,
      service_id: sellData.service_id,
      total_sessions: service.sessions_count || 1,
      used_sessions: 0,
      status: 'pending',
    }]).select().single();

    if (pkgErr) {
      console.error('Erro ao criar pacote:', pkgErr);
      showToast('Erro ao registrar pacote no banco.', 'error');
      setSaving(false);
      return;
    }

    if (service.type === 'pacote' && pkgData && multimodalItems.length > 0) {
      const itemsToInsert = multimodalItems.map(item => ({
        package_id: pkgData.id,
        service_id: item.service_id,
        total_sessions: item.sessions,
        used_sessions: 0
      }));
      const { error: itemsErr } = await supabase.from('patient_package_items').insert(itemsToInsert);
      if (itemsErr) {
        console.error('Erro ao salvar itens do pacote:', itemsErr);
        showToast('Aviso: Pacote criado, mas erro ao salvar a distribuição de sessões.', 'error');
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
            amount: service.price,
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
        amount: service.price,
        patientName: patient.name,
        phone: patient.phone,
        paymentId: payData.id
      });

      // Enviar cobrança automaticamente se tiver telefone
      if (patient.phone) {
        try {
          const firstName = patient.name.split(' ')[0];
          const msg = `Olá, *${firstName}*! ✨\n\nSegue o link para pagamento do seu pacote/serviço *${service.name}* na Tzion Terapias:\n\n🔗 ${asaasLink}\n\n💳 Você pode parcelar no Cartão de Crédito em até 12x, ou pagar via PIX/Boleto.\n\nQualquer dúvida, estamos à disposição! 💙`;
          await sendWhatsAppMessage(patient.id, patient.phone, msg, 'payment_link_sent');
          showToast('Cobrança gerada e enviada via WhatsApp!');
        } catch (err) {
          console.error('Erro ao enviar WhatsApp:', err);
          showToast('Cobrança gerada, mas erro ao enviar WhatsApp.', 'error');
        }
      } else {
        showToast('Cobrança gerada com sucesso! Copie o link na tela.');
      }
    } else {
      showToast('Venda registrada! Confirme o pagamento quando receber.');
    }

    if (!isAsaasPix && sellData.payment_method !== 'asaas_credit') {
      setShowSellModal(false);
    }
    setSellData(emptySell);
    fetchAll();
    setSaving(false);
  };

  const handleConfirmPaymentSubmit = async () => {
    if (!confirmingPayment) return;
    setSaving(true);

    const price = Math.abs(confirmingPayment.amount);
    const methodHasFee = confirmMethod === 'credit_card' || confirmMethod === 'debit_card'
      || confirmMethod === 'asaas' || confirmMethod === 'asaas_pix' || confirmMethod === 'asaas_credit';
    const rate = methodHasFee ? (parseFloat(confirmFeeRate) || 0) : 0;
    const feeVal = price * (rate / 100);
    const netVal = price - feeVal;

    let receiptUrl = null;
    if (receiptFile) {
      setUploadingFile(true);
      const fileExt = receiptFile.name.split('.').pop();
      const fileName = `${confirmingPayment.id}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(filePath, receiptFile);

      if (uploadError) {
        showToast('Erro ao enviar comprovante: ' + uploadError.message, 'error');
        setUploadingFile(false);
        setSaving(false);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from('receipts')
        .getPublicUrl(filePath);

      receiptUrl = publicUrlData?.publicUrl;
      setUploadingFile(false);
    }

    const { error: paymentError } = await supabase
      .from('payments')
      .update({
        status: 'paid',
        payment_method: confirmMethod,
        card_fee_rate: rate,
        card_fee_val: feeVal,
        net_amount: netVal,
        ...(receiptUrl ? { receipt_url: receiptUrl } : {})
      })
      .eq('id', confirmingPayment.id);

    if (paymentError) {
      showToast('Erro ao confirmar pagamento: ' + paymentError.message, 'error');
      setSaving(false);
      return;
    }

    // FIX CRÍTICO: Ativar pacotes com status 'pending' (não 'active') e gerar contrato se necessário
    if (confirmingPayment.patient_id && confirmingPayment.type === 'income') {
      const { data: pendingPkgs } = await supabase
        .from('patient_packages')
        .select('*, services(*)')
        .eq('patient_id', confirmingPayment.patient_id)
        .eq('status', 'pending');

      const { error: pkgError } = await supabase.from('patient_packages')
        .update({ status: 'active' })
        .eq('patient_id', confirmingPayment.patient_id)
        .eq('status', 'pending');

      if (pkgError) {
        console.error('Erro ao ativar pacote:', pkgError);
        showToast('Aviso: Pagamento confirmado, mas houve um erro ao ativar o pacote.', 'error');
      } else if (pendingPkgs && pendingPkgs.length > 0) {
        for (const pkg of pendingPkgs) {
          const service = pkg.services;
          if (service && service.type === 'pacote') {
            try {
              const { data: patient } = await supabase
                .from('patients')
                .select('*')
                .eq('id', confirmingPayment.patient_id)
                .single();

              if (patient) {
                const { data: setts } = await supabase.from('settings').select('value').eq('key', 'contract_template').single();
                let tpl = setts?.value || 'Contrato Tzion — Paciente: {{nome_paciente}}, Data: {{data_atual}}.';
                tpl = tpl
                  .replace(/\{\{nome_paciente\}\}/g, patient.name || '')
                  .replace(/\{\{cpf_paciente\}\}/g, patient.cpf || '')
                  .replace(/\{\{data_atual\}\}/g, new Date().toLocaleDateString('pt-BR'));

                const { data: contract } = await supabase.from('patient_contracts').insert({
                  patient_id: patient.id, content: tpl, status: 'pending',
                }).select().single();

                if (contract && patient.phone) {
                  const firstName = patient.name.split(' ')[0];
                  const baseUrl = await getSystemBaseUrl();
                  const link = `${baseUrl}/contrato/${contract.id}`;
                  const msg = `Olá, *${firstName}*! ✨\n\nSeu pacote foi iniciado! Por favor, assine o termo de serviço:\n\n🔗 ${link}\n\nQualquer dúvida, estamos à disposição! 💙`;
                  await sendWhatsAppMessage(patient.id, patient.phone, msg, 'contract_sent');
                }
              }
            } catch (err) {
              console.error('Erro na automação do contrato ao confirmar pagamento:', err);
            }
          }
        }
      }
    }

    showToast('Pagamento confirmado com sucesso!');
    setConfirmingPayment(null);
    setReceiptFile(null);
    fetchAll();
    setSaving(false);
  };

  const cancelPayment = async (id: string) => {
    if (!window.confirm('Cancelar este lançamento?')) return;
    const { error } = await supabase.from('payments').update({ status: 'cancelled' }).eq('id', id);
    if (error) {
      showToast('Erro ao cancelar lançamento: ' + error.message, 'error');
    } else {
      showToast('Lançamento cancelado.');
      fetchAll();
    }
  };

  // Dar Baixa em Repasse — REAL
  const handlePayoutConfirm = async () => {
    if (!showPayoutModal) return;
    setSaving(true);

    const payout = showPayoutModal;
    const therapist = therapists.find(t => t.id === payout.therapist_id);

    // 1. Inserir/Atualizar registro de repasse
    const { error } = await supabase.from('commission_payouts').upsert({
      id: payout.id,
      therapist_id: payout.therapist_id,
      month: payout.month,
      year: payout.year,
      gross_total: payout.gross_total,
      clinic_share: payout.clinic_share,
      therapist_net: payout.therapist_net,
      status: 'paid',
      paid_at: new Date().toISOString(),
      payment_method: payoutMethod,
      notes: payoutNote || null,
    }, { onConflict: 'id' });

    if (error) {
      if (error.code === '42P01') {
        showToast('Execute o supabase_financial_v2.sql no Supabase primeiro!', 'error');
      } else {
        showToast('Erro ao registrar baixa: ' + error.message, 'error');
      }
      setSaving(false);
      return;
    }

    // 🔧 BUG FIX: Registrar repasse como despesa no fluxo de caixa
    const mesRepasse = MONTH_NAMES[payout.month - 1];
    await supabase.from('payments').insert({
      amount: payout.therapist_net,
      type: 'expense',
      status: 'paid',
      description: `Repasse ${mesRepasse}/${payout.year} — ${therapist?.name || 'Terapeuta'}`,
      category: 'Repasse Terapeuta',
      payment_method: payoutMethod,
      created_at: new Date().toISOString(),
    });

    // 2. Notificar terapeuta via WhatsApp
    if (therapist?.phone) {
      const msg =
        `✅ *Repasse Confirmado — Tzion Terapias*\n\n` +
        `Olá, *${therapist.name}*!\n\n` +
        `O seu repasse de *${mesRepasse}/${payout.year}* foi processado:\n\n` +
        `💰 Faturamento Bruto: R$ ${fmt(payout.gross_total)}\n` +
        `🏥 Taxa Clínica: R$ ${fmt(payout.clinic_share)}\n` +
        `✅ *Valor Líquido: R$ ${fmt(payout.therapist_net)}*\n\n` +
        `💳 Método: ${payoutMethod.toUpperCase()}\n` +
        (therapist.pix_key ? `🔑 Chave PIX: ${therapist.pix_key}\n` : '') +
        (payoutNote ? `📝 Obs: ${payoutNote}\n` : '') +
        `\nQualquer dúvida, entre em contato! 💙`;

      await sendWhatsAppMessage(null, therapist.phone, msg, 'commission_paid');
    }

    showToast(`Repasse de ${(showPayoutModal as any).therapists?.name || 'terapeuta'} confirmado e notificado!`);
    setShowPayoutModal(null);
    setPayoutNote('');
    setPayoutMethod('pix');
    fetchAll();
    setSaving(false);
  };

  // Registrar repasse como pendente (para terapeutas sem payout ainda)
  const handleCreatePendingPayout = async (data: typeof commissionData[0]) => {
    if (!data) return;
    setSaving(true);
    const { error } = await supabase.from('commission_payouts').insert([{
      therapist_id: data.therapist.id,
      month: commissionMonth + 1,
      year: filterYear,
      gross_total: data.grossTotal,
      clinic_share: data.totalClinicShare,
      therapist_net: data.therapistNet,
      status: 'pending',
    }]);

    if (error) {
      if (error.code === '42P01') {
        showToast('Execute o supabase_financial_v2.sql no Supabase primeiro!', 'error');
      } else if (error.code !== '23505') {
        showToast('Erro ao criar repasse.', 'error');
      }
    } else {
      showToast('Repasse registrado como pendente.');
      fetchAll();
    }
    setSaving(false);
  };

  const handleCreateStaff = async () => {
    if (!newStaff.name || !newStaff.role) return;
    setSaving(true);
    
    if (editingStaffId) {
      const { error } = await supabase.from('staff').update({
        name: newStaff.name, role: newStaff.role,
        commission_rate: Number(newStaff.commission_rate),
        base_salary: Number(newStaff.base_salary),
      }).eq('id', editingStaffId);
      
      if (!error) { showToast('Colaborador atualizado!'); setShowStaffModal(false); setEditingStaffId(null); setNewStaff({ name: '', role: '', commission_rate: '0', base_salary: '0' }); fetchAll(); }
      else showToast('Erro ao atualizar colaborador.', 'error');
    } else {
      const { error } = await supabase.from('staff').insert([{
        name: newStaff.name, role: newStaff.role,
        commission_rate: Number(newStaff.commission_rate),
        base_salary: Number(newStaff.base_salary),
      }]);
      if (!error) { showToast('Colaborador cadastrado!'); setShowStaffModal(false); setNewStaff({ name: '', role: '', commission_rate: '0', base_salary: '0' }); fetchAll(); }
      else showToast('Erro ao cadastrar colaborador.', 'error');
    }
    
    setSaving(false);
  };

  // ── Bônus da Equipe Administrativa ──────────────────────────────────────

  // Cálculo da receita líquida da clínica para o mês selecionado na aba Equipe
  const staffBonusClinicNet = useMemo(() => {
    const monthPayments = payments.filter(p => {
      const d = new Date(p.created_at);
      return d.getMonth() === staffBonusMonth && d.getFullYear() === filterYear && p.status === 'paid';
    });
    const grossIncome = monthPayments
      .filter(p => p.type === 'income')
      .reduce((s, p) => s + ((p.net_amount !== null && p.net_amount !== undefined) ? Math.abs(p.net_amount) : Math.abs(p.amount)), 0);
    // Total repassado aos terapeutas neste mês
    let totalTherapistNet = 0;
    monthPayments.filter(p => p.type === 'income').forEach(p => {
      if (p.therapist_id) {
        const th = therapists.find(t => t.id === p.therapist_id);
        if (th) {
          const rate = (p.referral_source || 'therapist') === 'clinic'
            ? (th.commission_rate_clinic ?? 50)
            : (th.commission_rate_self ?? 25);
          const base = (p.net_amount !== null && p.net_amount !== undefined) ? Math.abs(p.net_amount) : Math.abs(p.amount);
          totalTherapistNet += base - base * (rate / 100);
        }
      }
    });
    return { grossIncome, totalTherapistNet, clinicNet: grossIncome - totalTherapistNet };
  }, [payments, therapists, staffBonusMonth, filterYear]);

  // Bonificacões calculadas por colaborador
  const staffBonusProjections = useMemo(() =>
    staff
      .filter(s => (s.commission_rate || 0) > 0)
      .map(s => {
        const existing = staffBonuses.find(
          b => b.staff_id === s.id && b.month === staffBonusMonth + 1 && b.year === filterYear
        );
        const bonusAmount = Math.round(staffBonusClinicNet.clinicNet * ((s.commission_rate || 0) / 100) * 100) / 100;
        return { ...s, bonusAmount, existing };
      }),
    [staff, staffBonuses, staffBonusClinicNet, staffBonusMonth, filterYear]
  );

  const handleGenerateStaffBonuses = async () => {
    if (staff.filter(s => (s.commission_rate || 0) > 0).length === 0) {
      showToast('Nenhum colaborador com % de bônus configurada.', 'error'); return;
    }
    setSaving(true);
    const toInsert = staff
      .filter(s => (s.commission_rate || 0) > 0)
      .map(s => ({
        staff_id: s.id,
        month: staffBonusMonth + 1,
        year: filterYear,
        clinic_net_base: staffBonusClinicNet.clinicNet,
        commission_rate: s.commission_rate,
        bonus_amount: Math.round(staffBonusClinicNet.clinicNet * (s.commission_rate / 100) * 100) / 100,
        status: 'pending',
      }));
    const { error } = await supabase.from('staff_bonuses').upsert(toInsert, { onConflict: 'staff_id,month,year', ignoreDuplicates: false });
    if (!error) {
      showToast('Bônus gerados com sucesso!');
      // Recarregar bonificacões
      const { data } = await supabase.from('staff_bonuses').select('*, staff(name, role, base_salary)').order('created_at', { ascending: false });
      setStaffBonuses((data || []) as StaffBonus[]);
    } else {
      if (error.code === '42P01') showToast('Execute o supabase_staff_bonus_v1.sql no Supabase primeiro!', 'error');
      else showToast('Erro ao gerar bônus: ' + error.message, 'error');
    }
    setSaving(false);
  };

  const handleConfirmStaffBonus = async () => {
    if (!showBonusModal) return;
    setSaving(true);
    const bonus = showBonusModal;
    const { error } = await supabase.from('staff_bonuses').update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      payment_method: bonusPayMethod,
      notes: bonusPayNote || null,
    }).eq('id', bonus.id);
    if (error) {
      showToast('Erro ao confirmar bônus: ' + error.message, 'error');
      setSaving(false); return;
    }
    // Registrar como despesa no fluxo de caixa
    const staffMember = staff.find(s => s.id === bonus.staff_id);
    const mes = MONTH_NAMES[bonus.month - 1];
    await supabase.from('payments').insert({
      amount: bonus.bonus_amount,
      type: 'expense',
      status: 'paid',
      description: `Bônus ${mes}/${bonus.year} — ${staffMember?.name || 'Colaborador'}`,
      category: 'Bônus Equipe',
      payment_method: bonusPayMethod,
      created_at: new Date().toISOString(),
    });
    showToast('Bônus confirmado e lançado como despesa!');
    setShowBonusModal(null);
    setBonusPayMethod('pix');
    setBonusPayNote('');
    fetchAll();
    // Recarregar bonificacões
    const { data } = await supabase.from('staff_bonuses').select('*, staff(name, role, base_salary)').order('created_at', { ascending: false });
    setStaffBonuses((data || []) as StaffBonus[]);
    setSaving(false);
  };



  const handleCreateSupplier = async () => {
    if (!newSupplier.company_name) return;
    setSaving(true);
    const { error } = await supabase.from('suppliers').insert([newSupplier]);
    if (!error) { showToast('Fornecedor cadastrado!'); setShowSupplierModal(false); setNewSupplier({ company_name: '', cnpj: '', category: 'Manutenção', phone: '', email: '', products_provided: '' }); fetchAll(); }
    else showToast('Erro ao cadastrar fornecedor.', 'error');
    setSaving(false);
  };

  const handleSaveTherapistConfig = async () => {
    if (!showTherapistConfigModal) return;
    setSaving(true);

    // Tenta salvar com as colunas novas; se não existir, mostra instrução
    const { error } = await supabase.from('therapists').update({
      commission_rate_clinic: Number(therapistConfig.commission_rate_clinic),
      commission_rate_self: Number(therapistConfig.commission_rate_self),
      pix_key: therapistConfig.pix_key || null,
      phone: therapistConfig.phone || null,
    }).eq('id', showTherapistConfigModal.id);

    if (!error) {
      showToast('Configurações do terapeuta salvas!');
      setShowTherapistConfigModal(null);
      fetchAll();
    } else if (error.code === '42703') {
      // Column doesn't exist yet
      showToast('Execute o supabase_financial_v2.sql no Supabase para habilitar esta função.', 'error');
    } else {
      showToast('Erro ao salvar: ' + error.message, 'error');
    }
    setSaving(false);
  };

  const handleSaveFeeRates = async () => {
    setSaving(true);
    const { error } = await supabase.from('settings').upsert(
      { key: 'payment_fee_rates', value: JSON.stringify(feeRatesInput) },
      { onConflict: 'key' }
    );
    if (!error) {
      setFeeRates({ ...feeRatesInput });
      showToast('Taxas de pagamento salvas com sucesso!');
      setShowFeeSettingsModal(false);
    } else {
      showToast('Erro ao salvar taxas: ' + error.message, 'error');
    }
    setSaving(false);
  };

  const handleDailyClosing = async () => {
    if (!closingInput.physical_balance) {
      showToast('Informe o saldo físico.', 'error');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('daily_closings').insert([{
      closing_date: new Date().toISOString().split('T')[0],
      expected_balance: saldoMes,
      physical_balance: Number(closingInput.physical_balance),
      notes: closingInput.notes || null,
      status: Math.abs(saldoMes - Number(closingInput.physical_balance)) < 0.01 ? 'closed' : 'divergent',
    }]);
    if (!error) {
      showToast('Fechamento registrado com sucesso!');
      setClosingInput({ physical_balance: '', notes: '' });
      fetchAll();
    } else if (error.code === '42P01') {
      showToast('Execute o supabase_financial_v2.sql no Supabase para habilitar o fechamento.', 'error');
    } else {
      showToast('Erro ao registrar fechamento: ' + error.message, 'error');
    }
    setSaving(false);
  };

  // Cashflow filtered
  const paidPayments = useMemo(() =>
    payments.filter(p => p.status === 'paid' &&
      new Date(p.created_at).getMonth() === filterMonth &&
      new Date(p.created_at).getFullYear() === filterYear
    ), [payments, filterMonth, filterYear]
  );

  const pendingPayments = useMemo(() =>
    payments.filter(p => p.status === 'pending'),
    [payments]
  );

  const visiblePendingPayments = useMemo(() => {
    if (user?.role === 'atendimento') {
      return pendingPayments.filter(p => p.type === 'income');
    }
    return pendingPayments;
  }, [pendingPayments, user]);

  const totalReceivable = pendingPayments.filter(p => p.type === 'income').reduce((s, p) => s + Math.abs(p.amount), 0);
  const totalPayable = pendingPayments.filter(p => p.type === 'expense').reduce((s, p) => s + Math.abs(p.amount), 0);

  const TABS = [
    { id: 'dashboard', label: 'Dashboard', icon: PieChart },
    { id: 'cashflow', label: 'Fluxo de Caixa', icon: Wallet },
    { id: 'payables', label: 'Contas a Pagar/Receber', icon: Clock },
    { id: 'suppliers', label: 'Fornecedores', icon: Briefcase },
    { id: 'staff', label: 'Equipe', icon: Users },
    { id: 'commissions', label: 'Repasses (Taxas)', icon: Percent },
    { id: 'reports', label: 'Relatórios DRE', icon: BarChart2 },
    { id: 'closing', label: 'Fechamento', icon: UserCheck },
  ];

  // ─── Render ──────────────────────────────────────────────────────────────────

  const selectedSvc = services.find(s => s.id === sellData.service_id);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      {toast && <Toast toast={toast} />}

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight">Gestão Financeira</h2>
          <p className="text-slate-500 font-medium mt-1">Controle de faturamento, comissões e fluxo de caixa.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => setShowSellModal(true)} className="px-5 py-3.5 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-600 transition-all shadow-xl shadow-emerald-100 flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> Vender Pacote/Serviço
          </button>
          {user?.role !== 'atendimento' && (
            <button onClick={() => setShowEntryModal(true)} className="px-5 py-3.5 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 flex items-center gap-2 text-sm">
              <Plus className="w-4 h-4" /> Lançamento Avulso
            </button>
          )}
        </div>
      </div>

      {/* ── Tabs ── */}
      {user?.role !== 'atendimento' && (
        <div className="flex p-1.5 bg-slate-100 rounded-2xl border border-slate-200 overflow-x-auto no-scrollbar w-full gap-1">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-3 rounded-xl font-bold text-xs transition-all whitespace-nowrap",
                activeTab === tab.id ? "bg-white text-indigo-600 shadow-md" : "text-slate-500 hover:text-slate-700 hover:bg-white/60"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* DASHBOARD                                                               */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'dashboard' && (
        <div className="space-y-8">
          {/* Month Selector */}
          <div className="flex items-center gap-2">
            <button onClick={() => setFilterMonth(m => Math.max(m - 1, 0))} className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all">
              <ChevronLeft className="w-4 h-4 text-slate-600" />
            </button>
            <select
              value={filterMonth}
              onChange={e => setFilterMonth(Number(e.target.value))}
              className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none font-bold text-slate-700 text-sm appearance-none"
            >
              {MONTH_NAMES.map((m, i) => <option key={i} value={i}>{m} {filterYear}</option>)}
            </select>
            <button onClick={() => setFilterMonth(m => Math.min(m + 1, 11))} className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all">
              <ChevronRight className="w-4 h-4 text-slate-600" />
            </button>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-white p-6 sm:p-8 rounded-3xl sm:rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden animate-pulse">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 mb-4" />
                  <div className="w-24 h-3 bg-slate-200 rounded-full mb-3" />
                  <div className="w-32 h-6 bg-slate-200 rounded-full mb-3" />
                  <div className="w-40 h-3 bg-slate-200 rounded-full" />
                </div>
              ))
            ) : (
              (() => {
                const { grossIncome, grossExpense, totalTherapistShare, clinicShareGross, clinicNetRealized } = dashboardStats;
                return [
                  { label: 'Faturamento Bruto', value: grossIncome, icon: TrendingUp, color: 'emerald', sub: `Clínica: R$ ${fmt(clinicShareGross)} | Terapeutas: R$ ${fmt(totalTherapistShare)}` },
                  { label: 'Despesas Pagas', value: grossExpense, icon: TrendingDown, color: 'rose', sub: 'Saídas operacionais do período' },
                  { label: 'Lucro Líquido Clínica', value: clinicNetRealized, icon: DollarSign, color: clinicNetRealized >= 0 ? 'indigo' : 'rose', sub: 'Faturamento Clínica − Despesas' },
                  { label: 'A Receber', value: pendingIncome, icon: Clock, color: 'amber', sub: 'Lançamentos pendentes' },
                ].map((c, i) => (
                  <div key={i} className="bg-white p-6 sm:p-8 rounded-3xl sm:rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group">
                    <div className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center mb-4 shadow-lg",
                      c.color === 'emerald' ? "bg-emerald-500 shadow-emerald-100 text-white" :
                      c.color === 'rose' ? "bg-rose-500 shadow-rose-100 text-white" :
                      c.color === 'amber' ? "bg-amber-500 shadow-amber-100 text-white" :
                      "bg-indigo-500 shadow-indigo-100 text-white"
                    )}>
                      <c.icon className="w-6 h-6" />
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{c.label}</p>
                    <h3 className={cn("text-xl sm:text-2xl font-black mb-1", c.color === 'rose' && c.label !== 'Despesas Pagas' ? "text-rose-600" : "text-slate-900")}>
                      R$ {fmt(c.value)}
                    </h3>
                    <p className="text-[10px] text-slate-400 font-medium leading-relaxed">{c.sub}</p>
                  </div>
                ));
              })()
            )}
          </div>

          {/* Chart */}
          <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
            <h3 className="text-xl font-bold text-slate-900 mb-6">Fluxo de Caixa Consolidado ({filterYear})</h3>
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(v: any) => [`R$ ${fmt(v)}`, undefined]}
                    contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.2)', padding: '16px' }}
                  />
                  <Legend />
                  <Area type="monotone" dataKey="Receita" stroke="#10b981" strokeWidth={3} fill="url(#g1)" />
                  <Area type="monotone" dataKey="Despesa" stroke="#ef4444" strokeWidth={3} fill="url(#g2)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* FLUXO DE CAIXA                                                          */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'cashflow' && (
        <div className="bg-white border border-slate-100 rounded-[3rem] shadow-sm overflow-hidden">
          <div className="p-8 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h3 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Wallet className="w-6 h-6 text-indigo-600" /> Fluxo de Caixa Realizado
            </h3>
            <div className="flex items-center gap-3">
              <select
                value={filterMonth}
                onChange={e => { setFilterMonth(Number(e.target.value)); setCashflowPage(1); }}
                className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-slate-700 text-sm appearance-none"
              >
                {MONTH_NAMES.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
              <button
                onClick={() => exportCSV(paidPayments, `fluxo-caixa-${MONTH_NAMES[filterMonth]}-${filterYear}.csv`)}
                className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-all flex items-center gap-2 text-sm"
              >
                <Download className="w-4 h-4" /> Exportar CSV
              </button>
            </div>
          </div>
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 sticky top-0 z-10">
                <tr>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Data</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Descrição</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Categoria</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Método</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {paidPayments.slice((cashflowPage - 1) * ITEMS, cashflowPage * ITEMS).map(p => (
                  <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-8 py-5 text-sm text-slate-500 font-medium">{new Date(p.created_at).toLocaleDateString('pt-BR')}</td>
                    <td className="px-8 py-5 font-bold text-slate-900">
                      <div className="flex flex-col">
                        <span>{p.description}</span>
                        {p.receipt_url && (
                          <a
                            href={p.receipt_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 hover:underline mt-1 font-semibold"
                          >
                            <FileText className="w-3.5 h-3.5" /> Ver Comprovante
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-wider">{p.category || 'Geral'}</span>
                    </td>
                    <td className={cn("px-8 py-5 font-black", p.type === 'income' ? "text-emerald-600" : "text-rose-600")}>
                      {p.type === 'income' ? '+' : '-'} R$ {fmt(Math.abs(p.amount))}
                    </td>
                    <td className="px-8 py-5 text-right text-slate-400 font-medium text-xs uppercase">{getMethodLabel(p.payment_method || 'pix')}</td>
                  </tr>
                ))}
                {paidPayments.length === 0 && (
                  <tr><td colSpan={5} className="py-20 text-center text-slate-400 font-medium">Nenhum pagamento realizado neste mês.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {paidPayments.length > ITEMS && (
            <div className="p-6 border-t border-slate-100 flex items-center justify-between">
              <button onClick={() => setCashflowPage(p => Math.max(p - 1, 1))} disabled={cashflowPage === 1}
                className="px-5 py-2 bg-white border border-slate-200 rounded-xl font-bold disabled:opacity-40 text-sm hover:bg-slate-50">Anterior</button>
              <span className="text-sm font-bold text-slate-400">Pág. {cashflowPage} / {Math.ceil(paidPayments.length / ITEMS)}</span>
              <button onClick={() => setCashflowPage(p => Math.min(p + 1, Math.ceil(paidPayments.length / ITEMS)))} disabled={cashflowPage === Math.ceil(paidPayments.length / ITEMS)}
                className="px-5 py-2 bg-white border border-slate-200 rounded-xl font-bold disabled:opacity-40 text-sm hover:bg-slate-50">Próxima</button>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* CONTAS A PAGAR / RECEBER                                                */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'payables' && (
        <div className="space-y-8">
          {user?.role !== 'atendimento' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Total a Receber</p>
                <p className="text-4xl font-black text-emerald-600">R$ {fmt(totalReceivable)}</p>
                <p className="text-xs text-slate-400 mt-2 font-medium">{pendingPayments.filter(p => p.type === 'income').length} lançamento(s) pendente(s)</p>
              </div>
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Total a Pagar</p>
                <p className="text-4xl font-black text-rose-600">R$ {fmt(totalPayable)}</p>
                <p className="text-xs text-slate-400 mt-2 font-medium">{pendingPayments.filter(p => p.type === 'expense').length} lançamento(s) pendente(s)</p>
              </div>
            </div>
          )}

          <div className="bg-white border border-slate-100 rounded-[3rem] shadow-sm overflow-hidden">
            <div className="p-8 border-b border-slate-100">
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-6 h-6 text-indigo-600" /> Agenda de Vencimentos Pendentes
              </h3>
            </div>
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 sticky top-0 z-10">
                  <tr>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Criado Em</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Vencimento</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Descrição</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipo</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {visiblePendingPayments.slice((payablesPage - 1) * ITEMS, payablesPage * ITEMS).map(p => {
                    const isOverdue = p.due_date && new Date(p.due_date) < new Date();
                    return (
                      <tr key={p.id} className={cn("hover:bg-slate-50/50 transition-colors", isOverdue && "bg-rose-50/30")}>
                        <td className="px-8 py-5 text-sm text-slate-500 font-medium">{new Date(p.created_at).toLocaleDateString('pt-BR')}</td>
                        <td className="px-8 py-5 text-sm font-bold">
                          {p.due_date
                            ? <span className={cn(isOverdue ? "text-rose-600" : "text-slate-700")}>{new Date(p.due_date).toLocaleDateString('pt-BR')} {isOverdue && '⚠️'}</span>
                            : <span className="text-slate-400 text-xs">—</span>}
                        </td>
                        <td className="px-8 py-5 font-bold text-slate-900">
                          <div className="flex flex-col">
                            <span>{p.description}</span>
                            {p.asaas_link && (
                              <a
                                href={p.asaas_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 hover:underline mt-1 font-semibold"
                              >
                                <LinkIcon className="w-3.5 h-3.5" /> Ver link de pagamento Asaas
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <span className={cn("px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider",
                            p.type === 'income' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                          )}>
                            {p.type === 'income' ? 'A Receber' : 'A Pagar'}
                          </span>
                        </td>
                        <td className="px-8 py-5 font-black text-slate-900">R$ {fmt(Math.abs(p.amount))}</td>
                        <td className="px-8 py-5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                setConfirmingPayment(p);
                                setConfirmMethod(p.payment_method || 'pix');
                                setConfirmInstallments(1);
                                const autoRate = getFeeRate(p.payment_method || 'pix', 1, feeRates);
                                setConfirmFeeRate(String(p.card_fee_rate ?? (autoRate > 0 ? autoRate : 0)));
                              }}
                              disabled={saving}
                              className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all disabled:opacity-50"
                            >
                              Confirmar
                            </button>
                            <button
                              onClick={() => cancelPayment(p.id)}
                              className="p-2 bg-slate-50 text-slate-400 rounded-xl hover:bg-rose-50 hover:text-rose-600 transition-colors"
                              title="Cancelar"
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {visiblePendingPayments.length === 0 && (
                    <tr><td colSpan={6} className="py-20 text-center text-slate-400 font-medium">Tudo em dia! Nenhum vencimento pendente.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {visiblePendingPayments.length > ITEMS && (
              <div className="p-6 border-t border-slate-100 flex items-center justify-between">
                <button onClick={() => setPayablesPage(p => Math.max(p - 1, 1))} disabled={payablesPage === 1}
                  className="px-5 py-2 bg-white border border-slate-200 rounded-xl font-bold disabled:opacity-40 text-sm">Anterior</button>
                <span className="text-sm font-bold text-slate-400">Pág. {payablesPage} / {Math.ceil(visiblePendingPayments.length / ITEMS)}</span>
                <button onClick={() => setPayablesPage(p => Math.min(p + 1, Math.ceil(visiblePendingPayments.length / ITEMS)))} disabled={payablesPage === Math.ceil(visiblePendingPayments.length / ITEMS)}
                  className="px-5 py-2 bg-white border border-slate-200 rounded-xl font-bold disabled:opacity-40 text-sm">Próxima</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* FORNECEDORES                                                             */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'suppliers' && (
        <div className="bg-white border border-slate-100 rounded-[3rem] shadow-sm overflow-hidden">
          <div className="p-8 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2"><Briefcase className="w-6 h-6 text-indigo-600" /> Fornecedores</h3>
            <button onClick={() => setShowSupplierModal(true)} className="px-5 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center gap-2 text-sm">
              <Plus className="w-4 h-4" /> Novo Fornecedor
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Empresa / Contato</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">CNPJ</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Categoria</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Produtos Fornecidos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {suppliers.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50/50">
                    <td className="px-8 py-5">
                      <p className="font-bold text-slate-900">{s.company_name}</p>
                      {(s.phone || s.email) && (
                        <p className="text-xs text-slate-500 mt-1 font-medium">
                          {s.phone && <span>{s.phone}</span>}
                          {s.phone && s.email && <span className="mx-2 text-slate-300">•</span>}
                          {s.email && <span>{s.email}</span>}
                        </p>
                      )}
                    </td>
                    <td className="px-8 py-5 text-slate-500 font-mono text-sm">{s.cnpj || '—'}</td>
                    <td className="px-8 py-5"><span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[10px] font-black uppercase">{s.category}</span></td>
                    <td className="px-8 py-5 text-slate-500 text-sm">{s.products_provided || '—'}</td>
                  </tr>
                ))}
                {suppliers.length === 0 && <tr><td colSpan={4} className="py-16 text-center text-slate-400">Nenhum fornecedor cadastrado.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* EQUIPE ADMINISTRATIVA                                                    */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'staff' && (
        <div className="space-y-8">
          {/* ── Cabeçalho ───────────────────────────────────────────────── */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><Users className="w-6 h-6 text-indigo-600" /> Equipe Administrativa</h3>
              <p className="text-sm text-slate-500 mt-1">Bônus calculado sobre a receita líquida da clínica após repasses dos terapeutas.</p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={staffBonusMonth}
                onChange={e => setStaffBonusMonth(Number(e.target.value))}
                className="px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none font-bold text-slate-700 text-sm appearance-none"
              >
                {MONTH_NAMES.map((m, i) => <option key={i} value={i}>{m} {filterYear}</option>)}
              </select>
              <button onClick={() => { setEditingStaffId(null); setNewStaff({ name: '', role: '', commission_rate: '0', base_salary: '0' }); setShowStaffModal(true); }}
                className="px-5 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center gap-2 text-sm">
                <Plus className="w-4 h-4" /> Novo Colaborador
              </button>
            </div>
          </div>

          {/* ── Painel de Receita e Bônus do Mês ────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-6 bg-white border border-slate-100 rounded-3xl shadow-sm">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Receita Bruta ({MONTH_NAMES[staffBonusMonth]})</p>
              <p className="text-2xl font-black text-slate-900">R$ {fmt(staffBonusClinicNet.grossIncome)}</p>
              <p className="text-xs text-slate-400 mt-1">Total recebido pela clínica</p>
            </div>
            <div className="p-6 bg-red-50 border border-red-100 rounded-3xl">
              <p className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-2">Repasses Terapeutas</p>
              <p className="text-2xl font-black text-red-600">− R$ {fmt(staffBonusClinicNet.totalTherapistNet)}</p>
              <p className="text-xs text-red-400 mt-1">Valor repassado aos terapeutas</p>
            </div>
            <div className="p-6 bg-gradient-to-br from-indigo-600 to-purple-600 text-white rounded-3xl shadow-lg">
              <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mb-2">Receita Líquida Clínica</p>
              <p className="text-2xl font-black">R$ {fmt(staffBonusClinicNet.clinicNet)}</p>
              <p className="text-xs text-indigo-200 mt-1">Base de cálculo dos bônus</p>
            </div>
          </div>

          {/* ── Tabela de Colaboradores com Bônus ────────────────────────── */}
          <div className="bg-white border border-slate-100 rounded-[3rem] shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h4 className="font-black text-slate-900 flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-500" /> Bônus de {MONTH_NAMES[staffBonusMonth]}/{filterYear}
              </h4>
              {staffBonusProjections.some(s => !s.existing) && (
                <button onClick={handleGenerateStaffBonuses} disabled={saving || staffBonusClinicNet.clinicNet <= 0}
                  className="px-5 py-2.5 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600 transition-all flex items-center gap-2 text-sm disabled:opacity-50">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Award className="w-4 h-4" />}
                  Gerar Bônus do Mês
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Colaborador</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cargo</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Salário Base</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">% Bônus</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Bônus Calculado</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Total a Pagar</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                    <th className="px-8 py-5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {staff.map(s => {
                    const proj = staffBonusProjections.find(p => p.id === s.id);
                    const bonusAmt = proj?.bonusAmount ?? 0;
                    const totalPay = (s.base_salary || 0) + bonusAmt;
                    const existing = proj?.existing;
                    return (
                      <tr key={s.id} className="hover:bg-slate-50/50">
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-bold">{s.name.charAt(0)}</div>
                            <p className="font-bold text-slate-900">{s.name}</p>
                          </div>
                        </td>
                        <td className="px-8 py-5 text-slate-500 font-medium">{s.role}</td>
                        <td className="px-8 py-5 font-bold text-slate-900">R$ {fmt(s.base_salary || 0)}</td>
                        <td className="px-8 py-5 font-black text-indigo-600">{s.commission_rate || 0}%</td>
                        <td className="px-8 py-5">
                          {bonusAmt > 0
                            ? <span className="font-black text-amber-600">R$ {fmt(bonusAmt)}</span>
                            : <span className="text-slate-300 text-sm">sem bônus</span>}
                        </td>
                        <td className="px-8 py-5 font-black text-slate-900">
                          {bonusAmt > 0 ? `R$ ${fmt(totalPay)}` : `R$ ${fmt(s.base_salary || 0)}`}
                        </td>
                        <td className="px-8 py-5">
                          {!existing && bonusAmt > 0 && (
                            <span className="px-3 py-1 bg-slate-100 text-slate-500 rounded-full text-xs font-bold">Não gerado</span>
                          )}
                          {existing?.status === 'pending' && (
                            <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-bold">Pendente</span>
                          )}
                          {existing?.status === 'paid' && (
                            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">✓ Pago</span>
                          )}
                          {bonusAmt === 0 && <span className="text-slate-300 text-xs">N/A</span>}
                        </td>
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-2">
                            {existing?.status === 'pending' && (
                              <button
                                onClick={() => { setShowBonusModal(existing); setBonusPayMethod('pix'); setBonusPayNote(''); }}
                                className="px-4 py-2 bg-green-600 text-white rounded-xl text-xs font-bold hover:bg-green-700 transition-all"
                              >
                                Confirmar Pagamento
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setEditingStaffId(s.id);
                                setNewStaff({
                                  name: s.name,
                                  role: s.role,
                                  commission_rate: String(s.commission_rate || 0),
                                  base_salary: String(s.base_salary || 0)
                                });
                                setShowStaffModal(true);
                              }}
                              className="p-2 bg-slate-50 text-slate-400 rounded-xl hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                              title="Editar Colaborador"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {staff.length === 0 && (
                    <tr><td colSpan={8} className="py-16 text-center text-slate-400">Nenhum colaborador administrativo cadastrado.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* REPASSES E COMISSÕES                                                     */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'commissions' && (
        <div className="space-y-8">
          {/* Month Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><Percent className="w-6 h-6 text-indigo-600" /> Repasses por Terapeuta</h3>
              <p className="text-sm text-slate-500 mt-1">Percentuais configuráveis individualmente por terapeuta.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setFeeRatesInput({ ...feeRates }); setShowFeeSettingsModal(true); }}
                className="px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-all flex items-center gap-2 text-sm"
                title="Configurar taxas de pagamento"
              >
                <Settings className="w-4 h-4" /> Taxas
              </button>
              <select
                value={commissionMonth}
                onChange={e => setCommissionMonth(Number(e.target.value))}
                className="px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none font-bold text-slate-700 text-sm appearance-none"
              >
                {MONTH_NAMES.map((m, i) => <option key={i} value={i}>{m} {filterYear}</option>)}
              </select>
            </div>
          </div>

          {/* Legend */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-wrap gap-6 text-xs font-bold text-slate-600">
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-indigo-500 inline-block" />Indicado pela Clínica → % configurável (padrão 50% clínica)</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />Trazido pelo Terapeuta → % configurável (padrão 25% clínica)</div>
          </div>

          {/* Commission Table */}
          <div className="bg-white border border-slate-100 rounded-[3rem] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Terapeuta</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Sessões</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Faturamento Bruto</th>
                    <th className="px-8 py-5 text-[10px] font-black text-indigo-600 uppercase tracking-widest">Taxa Clínica</th>
                    <th className="px-8 py-5 text-[10px] font-black text-emerald-600 uppercase tracking-widest">Líquido Terapeuta</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {commissionData.map((c, i) => {
                    const isPaid = c.existingPayout?.status === 'paid';
                    const isPending = c.existingPayout?.status === 'pending';
                    return (
                      <tr key={i} className={cn("hover:bg-slate-50/50 transition-colors", isPaid && "opacity-60")}>
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-bold">
                              {c.therapist.name.charAt(0)}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900">{c.therapist.name}</p>
                              {c.therapist.pix_key && <p className="text-xs text-slate-400 font-medium">PIX: {c.therapist.pix_key}</p>}
                              {c.patientNames && c.patientNames.length > 0 && (
                                <p className="text-[11px] text-slate-500 font-semibold mt-1 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100 block w-fit">
                                  Pacientes: {c.patientNames.join(', ')}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <div className="space-y-1">
                            <p className="text-sm font-bold text-slate-700">{c.sessions} pagamento(s)</p>
                            {c.grossClinic > 0 && <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-indigo-400" /><span className="text-xs text-indigo-600 font-bold">R$ {fmt(c.grossClinic)} via Clínica ({c.rateClinic}%)</span></div>}
                            {c.grossSelf > 0 && <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400" /><span className="text-xs text-emerald-600 font-bold">R$ {fmt(c.grossSelf)} via Terapeuta ({c.rateSelf}%)</span></div>}
                          </div>
                        </td>
                        <td className="px-8 py-5 font-bold text-slate-900">R$ {fmt(c.grossTotal)}</td>
                        <td className="px-8 py-5">
                          <p className="font-black text-indigo-600 text-lg">R$ {fmt(c.totalClinicShare)}</p>
                          {c.clinicShareFromClinic > 0 && <p className="text-[10px] text-slate-400">{c.rateClinic}% de R$ {fmt(c.grossClinic)}</p>}
                          {c.clinicShareFromSelf > 0 && <p className="text-[10px] text-slate-400">{c.rateSelf}% de R$ {fmt(c.grossSelf)}</p>}
                        </td>
                        <td className="px-8 py-5 font-black text-emerald-600 text-lg">R$ {fmt(c.therapistNet)}</td>
                        <td className="px-8 py-5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {/* Config button */}
                            <button
                              onClick={() => {
                                setShowTherapistConfigModal(c.therapist);
                                setTherapistConfig({
                                  commission_rate_clinic: String(c.therapist.commission_rate_clinic ?? 50),
                                  commission_rate_self: String(c.therapist.commission_rate_self ?? 25),
                                  pix_key: c.therapist.pix_key || '',
                                  phone: c.therapist.phone || '',
                                });
                              }}
                              className="p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                              title="Configurar taxas"
                            >
                              <Settings className="w-4 h-4" />
                            </button>

                            {isPaid ? (
                              <span className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-xs font-black border border-emerald-200 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Pago
                              </span>
                            ) : isPending ? (
                              <button
                                onClick={() => setShowPayoutModal(c.existingPayout!)}
                                className="px-4 py-2 bg-amber-50 hover:bg-amber-500 text-amber-600 hover:text-white rounded-xl text-xs font-bold transition-all border border-amber-200"
                              >
                                Dar Baixa
                              </button>
                            ) : (
                              <button
                                onClick={() => handleCreatePendingPayout(c)}
                                disabled={saving}
                                className="px-4 py-2 bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white rounded-xl text-xs font-bold transition-all border border-indigo-100 disabled:opacity-50"
                              >
                                Gerar Repasse
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {commissionData.length === 0 && (
                    <tr><td colSpan={6} className="py-20 text-center text-slate-400 font-medium">Nenhum pagamento confirmado para terapeutas neste mês.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Histórico de Repasses Pagos */}
          {payouts.filter(p => p.status === 'paid').length > 0 && (
            <div className="bg-white border border-slate-100 rounded-[3rem] shadow-sm overflow-hidden">
              <div className="p-8 border-b border-slate-100">
                <h4 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-emerald-600" /> Histórico de Repasses Pagos
                </h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Terapeuta</th>
                      <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Pacientes</th>
                      <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Período</th>
                      <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Bruto</th>
                      <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Taxa Clínica</th>
                      <th className="px-8 py-4 text-[10px] font-black text-emerald-600 uppercase tracking-widest">Líquido Pago</th>
                      <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Data Pagamento</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {payouts.filter(p => p.status === 'paid').map(p => (
                      <tr key={p.id} className="hover:bg-slate-50/50">
                        <td className="px-8 py-4 font-bold text-slate-900">{p.therapists?.name || '—'}</td>
                        <td className="px-8 py-4 text-xs text-slate-600 font-semibold max-w-[200px] truncate" title={getPatientsForPayout(p.therapist_id, p.month, p.year)}>{getPatientsForPayout(p.therapist_id, p.month, p.year)}</td>
                        <td className="px-8 py-4 text-slate-500 font-medium">{MONTH_NAMES[p.month - 1]} / {p.year}</td>
                        <td className="px-8 py-4 font-medium text-slate-700">R$ {fmt(p.gross_total)}</td>
                        <td className="px-8 py-4 font-bold text-indigo-600">R$ {fmt(p.clinic_share)}</td>
                        <td className="px-8 py-4 font-black text-emerald-600">R$ {fmt(p.therapist_net)}</td>
                        <td className="px-8 py-4 text-slate-400 text-sm font-medium">{p.paid_at ? new Date(p.paid_at).toLocaleDateString('pt-BR') : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* RELATÓRIOS DRE                                                           */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'reports' && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
              <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-2">Receita Total {filterYear}</p>
              <p className="text-3xl font-black text-slate-900">R$ {fmt(dreData.totalReceita)}</p>
            </div>
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
              <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-2">Despesas Totais {filterYear}</p>
              <p className="text-3xl font-black text-slate-900">R$ {fmt(dreData.totalDespesa)}</p>
            </div>
            <div className={cn("p-8 rounded-[2.5rem] border shadow-sm", dreData.result >= 0 ? "bg-emerald-50 border-emerald-200" : "bg-rose-50 border-rose-200")}>
              <p className={cn("text-[10px] font-black uppercase tracking-widest mb-2", dreData.result >= 0 ? "text-emerald-600" : "text-rose-600")}>Resultado Líquido {filterYear}</p>
              <p className={cn("text-3xl font-black", dreData.result >= 0 ? "text-emerald-700" : "text-rose-700")}>R$ {fmt(dreData.result)}</p>
            </div>
          </div>

          {/* DRE Chart */}
          <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-900">DRE por Mês — {filterYear}</h3>
              <button
                onClick={() => exportCSV(payments.filter(p => new Date(p.created_at).getFullYear() === filterYear), `dre-${filterYear}.csv`)}
                className="px-5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-all flex items-center gap-2 text-sm"
              >
                <Download className="w-4 h-4" /> Exportar CSV
              </button>
            </div>
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: any) => [`R$ ${fmt(v)}`, undefined]} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 40px rgba(0,0,0,0.15)' }} />
                  <Legend />
                  <Bar dataKey="Receita" fill="#10b981" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="Despesa" fill="#ef4444" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* DRE by Category */}
          <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
            <h3 className="text-xl font-bold text-slate-900 mb-6">Breakdown por Categoria</h3>
            <div className="space-y-3">
              {(Object.entries(dreData.byCategory) as [string, { income: number; expense: number }][]).sort((a, b) => (b[1].income + b[1].expense) - (a[1].income + a[1].expense)).map(([cat, vals]) => (
                <div key={cat} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="font-bold text-slate-800 text-sm">{cat}</span>
                  <div className="flex gap-6 text-sm">
                    {vals.income > 0 && <span className="font-black text-emerald-600">+R$ {fmt(vals.income)}</span>}
                    {vals.expense > 0 && <span className="font-black text-rose-600">−R$ {fmt(vals.expense)}</span>}
                  </div>
                </div>
              ))}
              {Object.keys(dreData.byCategory).length === 0 && (
                <p className="text-center text-slate-400 py-8">Nenhum dado financeiro para este ano.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* FECHAMENTO DE CAIXA                                                      */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'closing' && (
        <div className="space-y-8">
          <div className="max-w-3xl mx-auto bg-white p-10 rounded-[3rem] border border-slate-200 shadow-xl">
            <div className="flex items-center gap-4 mb-8">
              <div className="p-4 bg-indigo-600 text-white rounded-[1.5rem] shadow-lg shadow-indigo-200"><UserCheck className="w-8 h-8" /></div>
              <div>
                <h3 className="text-3xl font-black text-slate-900 tracking-tight">Fechamento de Caixa</h3>
                <p className="text-slate-500 font-medium">Data: {new Date().toLocaleDateString('pt-BR')}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-slate-100">
              <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 space-y-3">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Saldo Esperado pelo Sistema</p>
                <h4 className="text-3xl font-black text-slate-900">R$ {fmt(saldoMes)}</h4>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-medium"><span className="text-slate-400">Entradas</span><span className="text-emerald-600">+ R$ {fmt(receitaMes)}</span></div>
                  <div className="flex justify-between text-xs font-medium"><span className="text-slate-400">Saídas</span><span className="text-rose-600">− R$ {fmt(despesaMes)}</span></div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Saldo Real em Caixa / Banco (R$) *</label>
                  <input
                    type="number"
                    value={closingInput.physical_balance}
                    onChange={e => setClosingInput({ ...closingInput, physical_balance: e.target.value })}
                    className="w-full px-6 py-5 bg-slate-50 border border-slate-200 rounded-[2rem] text-3xl font-black text-indigo-600 outline-none focus:ring-4 focus:ring-indigo-500/10"
                    placeholder="0,00"
                  />
                  {closingInput.physical_balance && (
                    <p className={cn("text-sm font-black ml-1", Math.abs(saldoMes - Number(closingInput.physical_balance)) < 0.01 ? "text-emerald-600" : "text-rose-600")}>
                      Diferença: R$ {fmt(Math.abs(saldoMes - Number(closingInput.physical_balance)))}
                      {Math.abs(saldoMes - Number(closingInput.physical_balance)) < 0.01 ? ' ✅ Bateu!' : ' ⚠️ Divergência'}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Observações / Divergências</label>
                  <textarea
                    value={closingInput.notes}
                    onChange={e => setClosingInput({ ...closingInput, notes: e.target.value })}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none min-h-[80px] font-medium text-slate-700"
                    placeholder="Descreva qualquer divergência encontrada..."
                  />
                </div>
              </div>
            </div>

            <button
              onClick={handleDailyClosing}
              disabled={saving || !closingInput.physical_balance}
              className="w-full mt-8 py-5 bg-slate-900 text-white rounded-[2rem] font-black text-lg hover:bg-black transition-all shadow-2xl shadow-slate-200 flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-6 h-6 animate-spin" /> : <UserCheck className="w-6 h-6" />}
              Concluir e Salvar Fechamento
            </button>
          </div>

          {/* Histórico de Fechamentos */}
          {closings.length > 0 && (
            <div className="bg-white border border-slate-100 rounded-[3rem] shadow-sm overflow-hidden">
              <div className="p-8 border-b border-slate-100">
                <h4 className="text-lg font-bold text-slate-900">Histórico de Fechamentos</h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Data</th>
                      <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Esperado</th>
                      <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Físico</th>
                      <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Diferença</th>
                      <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {closings.map(c => (
                      <tr key={c.id} className="hover:bg-slate-50/50">
                        <td className="px-8 py-4 font-bold text-slate-900">{new Date(c.closing_date).toLocaleDateString('pt-BR')}</td>
                        <td className="px-8 py-4 text-slate-600 font-medium">R$ {fmt(c.expected_balance || 0)}</td>
                        <td className="px-8 py-4 text-slate-600 font-medium">R$ {fmt(c.physical_balance || 0)}</td>
                        <td className={cn("px-8 py-4 font-black", (c.difference || 0) === 0 ? "text-emerald-600" : "text-rose-600")}>
                          {(c.difference || 0) === 0 ? '✅ ' : '⚠️ '}R$ {fmt(Math.abs(c.difference || 0))}
                        </td>
                        <td className="px-8 py-4">
                          <span className={cn("px-3 py-1 rounded-full text-[10px] font-black uppercase",
                            c.status === 'closed' ? "bg-emerald-50 text-emerald-600" :
                            c.status === 'divergent' ? "bg-rose-50 text-rose-600" :
                            "bg-amber-50 text-amber-600"
                          )}>
                            {c.status === 'closed' ? 'Fechado' : c.status === 'divergent' ? 'Divergente' : 'Aberto'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL: NOVO LANÇAMENTO                                                   */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {showEntryModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <div className="bg-white rounded-[3rem] w-full max-w-lg shadow-2xl border border-slate-100 overflow-hidden">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-600 text-white rounded-2xl"><DollarSign className="w-6 h-6" /></div>
                <h3 className="text-2xl font-black text-slate-900">Novo Lançamento</h3>
              </div>
              <button onClick={() => setShowEntryModal(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><X className="w-6 h-6" /></button>
            </div>
            <div className="p-8 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                {(['income', 'expense'] as const).map(t => (
                  <button key={t} onClick={() => setNewEntry({ ...newEntry, type: t })}
                    className={cn("py-4 rounded-2xl font-bold flex items-center justify-center gap-2 border-2 transition-all",
                      newEntry.type === t
                        ? t === 'income' ? "bg-emerald-50 border-emerald-500 text-emerald-600" : "bg-rose-50 border-rose-500 text-rose-600"
                        : "bg-slate-50 border-transparent text-slate-400 hover:border-slate-200"
                    )}>
                    {t === 'income' ? <><ArrowUpRight className="w-5 h-5" /> Receita</> : <><ArrowDownRight className="w-5 h-5" /> Despesa</>}
                  </button>
                ))}
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Valor (R$) *</label>
                <input type="number" value={newEntry.amount} onChange={e => setNewEntry({ ...newEntry, amount: e.target.value })}
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-2xl font-black text-slate-700 focus:ring-2 focus:ring-indigo-500/20" placeholder="0,00" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Descrição *</label>
                <input value={newEntry.description} onChange={e => setNewEntry({ ...newEntry, description: e.target.value })}
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500/20" placeholder="Ex: Aluguel da Sala" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Categoria</label>
                  <select value={newEntry.category} onChange={e => setNewEntry({ ...newEntry, category: e.target.value })}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-700 appearance-none">
                    {(newEntry.type === 'income' ? CATEGORIES_INCOME : CATEGORIES_EXPENSE).map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Status</label>
                  <select value={newEntry.status} onChange={e => setNewEntry({ ...newEntry, status: e.target.value as any })}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-700 appearance-none">
                    <option value="paid">Pago / Recebido</option>
                    <option value="pending">Pendente</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Método de Pagamento</label>
                  <select value={newEntry.payment_method} onChange={e => setNewEntry({ ...newEntry, payment_method: e.target.value })}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-700 appearance-none">
                    {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Data de Vencimento</label>
                  <input type="date" value={newEntry.due_date} onChange={e => setNewEntry({ ...newEntry, due_date: e.target.value })}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-700" />
                </div>
              </div>
              
              {newEntry.type === 'expense' && (
                <div className="flex items-center gap-3 p-4 bg-rose-50 border border-rose-100 rounded-2xl">
                  <input type="checkbox" id="is_fixed" checked={newEntry.is_fixed} onChange={e => setNewEntry({ ...newEntry, is_fixed: e.target.checked })}
                    className="w-5 h-5 rounded border-rose-300 text-rose-600 focus:ring-rose-500 cursor-pointer" />
                  <label htmlFor="is_fixed" className="text-sm font-bold text-rose-700 cursor-pointer select-none">
                    Marcar como Despesa Fixa (Recorrente)
                  </label>
                </div>
              )}

              <button onClick={handleCreateEntry} disabled={saving}
                className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-bold shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} Salvar Lançamento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL: VENDER SERVIÇO                                                    */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {showSellModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <div className="bg-white rounded-[3rem] w-full max-w-lg shadow-2xl border border-slate-100 overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-emerald-50/50">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-emerald-500 text-white rounded-2xl"><Briefcase className="w-6 h-6" /></div>
                <h3 className="text-2xl font-black text-slate-900">Vender Serviço</h3>
              </div>
              <button onClick={() => setShowSellModal(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><X className="w-6 h-6" /></button>
            </div>
            <div className="p-8 space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Paciente *</label>
                <select value={sellData.patient_id} onChange={e => setSellData({ ...sellData, patient_id: e.target.value })}
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-700 appearance-none">
                  <option value="">Selecione o paciente...</option>
                  {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Serviço ou Pacote *</label>
                <select value={sellData.service_id} onChange={e => {
                  const svcId = e.target.value;
                  setSellData({ ...sellData, service_id: svcId });
                  const svc = services.find(s => s.id === svcId);
                  if (svc && svc.type === 'pacote') {
                    setMultimodalItems([{ service_id: '', sessions: svc.sessions_count }]);
                  } else {
                    setMultimodalItems([]);
                  }
                }}
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-700 appearance-none">
                  <option value="">Selecione o serviço...</option>
                  {services.map(s => <option key={s.id} value={s.id}>{s.name} — R$ {fmt(s.price)} ({s.type === 'pacote' ? `${s.sessions_count} sessões` : 'Avulso'})</option>)}
                </select>
              </div>

              {/* Distribuição de Sessões para Pacote Multimodal */}
              {selectedSvc?.type === 'pacote' && (
                <div className="p-6 bg-slate-50 border border-slate-200 rounded-[2rem] space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                      Distribuição Multimodal ({selectedSvc.sessions_count} sessões)
                    </label>
                    <button
                      type="button"
                      onClick={() => setMultimodalItems([...multimodalItems, { service_id: '', sessions: 1 }])}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer"
                    >
                      + Add Serviço
                    </button>
                  </div>

                  <div className="space-y-3">
                    {multimodalItems.map((item, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <select
                          value={item.service_id}
                          onChange={(e) => {
                            const newItems = [...multimodalItems];
                            newItems[idx].service_id = e.target.value;
                            setMultimodalItems(newItems);
                          }}
                          className="flex-1 p-3 bg-white border border-slate-200 rounded-xl font-bold text-xs text-slate-700 outline-none appearance-none cursor-pointer"
                        >
                          <option value="">Selecione o serviço...</option>
                          {services.filter(s => s.type !== 'pacote').map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min="1"
                          max={selectedSvc.sessions_count}
                          value={item.sessions}
                          onChange={(e) => {
                            const newItems = [...multimodalItems];
                            newItems[idx].sessions = parseInt(e.target.value) || 0;
                            setMultimodalItems(newItems);
                          }}
                          className="w-16 p-3 bg-white border border-slate-200 rounded-xl font-black text-xs text-slate-700 text-center outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const newItems = multimodalItems.filter((_, i) => i !== idx);
                            setMultimodalItems(newItems);
                          }}
                          className="p-3 text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {(() => {
                    const totalAssigned = multimodalItems.reduce((acc, curr) => acc + curr.sessions, 0);
                    const diff = selectedSvc.sessions_count - totalAssigned;
                    return (
                      <div className="flex justify-between items-center text-xs font-bold pt-2 border-t border-slate-200">
                        <span className="text-slate-500">Total Distribuído:</span>
                        <span className={cn(diff === 0 ? "text-emerald-600" : "text-rose-500")}>
                          {totalAssigned} de {selectedSvc.sessions_count} sessões
                          {diff !== 0 && ` (${diff > 0 ? `faltam ${diff}` : `excedeu ${Math.abs(diff)}`})`}
                        </span>
                      </div>
                    );
                  })()}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Forma de Pagamento</label>
                  <select value={sellData.payment_method} onChange={e => {
                    const method = e.target.value;
                    let defaultRate = '0';
                    if (method === 'credit_card') defaultRate = '3.5';
                    else if (method === 'debit_card') defaultRate = '1.5';
                    setSellData({ ...sellData, payment_method: method });
                    setCardFeeRateInput(defaultRate);
                  }}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-700 appearance-none">
                    {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Terapeuta</label>
                  <select value={sellData.therapist_id} onChange={e => setSellData({ ...sellData, therapist_id: e.target.value })}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-700 appearance-none">
                    <option value="">Sem terapeuta</option>
                    {therapists.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              </div>

              {/* ── Taxa de Pagamento / Parcelamento ──────────────────────── */}
              {(sellData.payment_method === 'credit_card' || sellData.payment_method === 'debit_card') && (
                <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                  {sellData.payment_method === 'credit_card' && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Parcelamento</label>
                      <div className="flex flex-wrap gap-1.5">
                        {INSTALLMENT_OPTIONS.map(n => (
                          <button key={n} type="button"
                            onClick={() => { setInstallments(n); setCardFeeRateInput(String(getFeeRate('credit_card', n, feeRates))); }}
                            className={cn('px-2.5 py-1 rounded-lg text-[11px] font-black border transition-all',
                              installments === n
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300'
                            )}>
                            {n}x
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                      Taxa {sellData.payment_method === 'credit_card' ? `Crédito ${installments}x` : 'Débito'} (%)
                    </label>
                    <input type="number" step="0.01" min="0" max="100"
                      value={cardFeeRateInput} onChange={e => setCardFeeRateInput(e.target.value)}
                      className="w-24 px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-black text-slate-700 text-right outline-none focus:border-indigo-500"
                    />
                  </div>
                  {(() => {
                    const svc = services.find(s => s.id === sellData.service_id);
                    const price = svc?.price ?? 0;
                    const rate = parseFloat(cardFeeRateInput) || 0;
                    const feeVal = price * (rate / 100);
                    const netVal = price - feeVal;
                    return (
                      <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 font-medium pt-2.5 border-t border-slate-200/60">
                        <div>Taxa Cobrada: <strong className="text-slate-800">R$ {fmt(feeVal)}</strong></div>
                        <div className="text-right">Líquido Recebido: <strong className="text-indigo-600">R$ {fmt(netVal)}</strong></div>
                      </div>
                    );
                  })()}
                </div>
              )}
              {(sellData.payment_method === 'asaas_pix' || sellData.payment_method === 'asaas_credit') && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl flex items-start gap-3">
                  <span className="text-xl mt-0.5">🔗</span>
                  <div className="text-xs text-blue-800 space-y-0.5">
                    <p className="font-black text-sm">Taxa Asaas (automática)</p>
                    <p className="font-semibold">
                      {sellData.payment_method === 'asaas_pix'
                        ? `PIX: ~${feeRates.asaas_pix}% por transação`
                        : `Cartão Online: ~${feeRates.asaas_credit}% por transação`}
                    </p>
                    <p className="text-blue-600">Valor líquido real atualizado automaticamente após confirmação Asaas.</p>
                  </div>
                </div>
              )}

              {/* Origem do Paciente */}
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Origem do Paciente</label>
                <div className="grid grid-cols-2 gap-3">
                  {(['clinic', 'therapist'] as const).map(src => {
                    const svc = services.find(s => s.id === sellData.service_id);
                    const th = therapists.find(t => t.id === sellData.therapist_id);
                    const rate = src === 'clinic' ? (th?.commission_rate_clinic ?? 50) : (th?.commission_rate_self ?? 25);
                    return (
                      <button key={src} type="button" onClick={() => setSellData({ ...sellData, referral_source: src })}
                        className={cn("p-4 rounded-2xl border-2 font-bold text-sm flex flex-col items-center gap-2 transition-all",
                          sellData.referral_source === src
                            ? src === 'clinic' ? "bg-indigo-50 border-indigo-500 text-indigo-700" : "bg-emerald-50 border-emerald-500 text-emerald-700"
                            : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                        )}>
                        <span className="text-2xl">{src === 'clinic' ? '🏥' : '👨‍⚕️'}</span>
                        <span>{src === 'clinic' ? 'Pela Clínica' : 'Pelo Terapeuta'}</span>
                        <span className={cn("text-xs px-2 py-0.5 rounded-full font-black",
                          sellData.referral_source === src
                            ? src === 'clinic' ? "bg-indigo-100 text-indigo-700" : "bg-emerald-100 text-emerald-700"
                            : "bg-slate-100 text-slate-400"
                        )}>{rate}% para a clínica</span>
                      </button>
                    );
                  })}
                </div>

                {/* Preview de comissão */}
                {sellData.service_id && (() => {
                  const svc = services.find(s => s.id === sellData.service_id);
                  const th = therapists.find(t => t.id === sellData.therapist_id);
                  if (!svc) return null;
                  const rate = sellData.referral_source === 'clinic' ? (th?.commission_rate_clinic ?? 50) : (th?.commission_rate_self ?? 25);
                  const clinicAmt = svc.price * (rate / 100);
                  const therapistAmt = svc.price - clinicAmt;
                  return (
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 grid grid-cols-2 gap-4 text-center">
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Clínica recebe</p>
                        <p className="text-xl font-black text-indigo-600">R$ {fmt(clinicAmt)}</p>
                        <p className="text-[10px] text-slate-400 font-bold">{rate}%</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Terapeuta recebe</p>
                        <p className="text-xl font-black text-emerald-600">R$ {fmt(therapistAmt)}</p>
                        <p className="text-[10px] text-slate-400 font-bold">{100 - rate}%</p>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <button onClick={handleSellService} disabled={saving}
                className="w-full py-5 bg-emerald-500 text-white rounded-2xl font-bold shadow-xl shadow-emerald-100 hover:bg-emerald-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />} Confirmar Venda
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL: PIX QR CODE                                                         */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {createdPixQrCode && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white rounded-[3rem] w-full max-w-md shadow-2xl border border-slate-100 overflow-hidden">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-indigo-50/50">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-600 text-white rounded-2xl"><DollarSign className="w-6 h-6" /></div>
                <div>
                  <h3 className="text-2xl font-black text-slate-900">Pagamento PIX</h3>
                  <p className="text-sm text-slate-500 font-medium">Escaneie o QR Code abaixo</p>
                </div>
              </div>
              <button onClick={() => setCreatedPixQrCode(null)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 cursor-pointer"><X className="w-6 h-6" /></button>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="text-center space-y-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Paciente</p>
                <p className="text-lg font-black text-slate-800">{createdPixQrCode.patientName}</p>
                <p className="text-3xl font-black text-indigo-600 mt-2">R$ {fmt(createdPixQrCode.amount)}</p>
              </div>

              <div className="flex justify-center p-4 bg-white rounded-3xl border-2 border-slate-100 shadow-sm">
                <img src={`data:image/png;base64,${createdPixQrCode.encodedImage}`} alt="QR Code PIX" className="w-64 h-64 object-contain" />
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">PIX Copia e Cola</p>
                  <textarea 
                    readOnly 
                    value={createdPixQrCode.payload}
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono text-slate-600 h-24 resize-none focus:outline-none"
                  />
                </div>
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(createdPixQrCode.payload);
                      showToast("Código PIX copiado com sucesso!");
                    } catch (err) {
                      showToast("Erro ao copiar o código.", "error");
                    }
                  }}
                  className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold shadow-lg hover:bg-slate-800 transition-all flex items-center justify-center gap-2 cursor-pointer text-sm"
                >
                  <Save className="w-5 h-5" /> Copiar Código PIX
                </button>
                <button 
                  onClick={() => setCreatedPixQrCode(null)}
                  className="w-full py-3 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all cursor-pointer text-sm"
                >
                  Fechar Janela
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL: COBRANÇA ASAAS GERADA                                             */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {createdAsaasPayment && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-6">
          <div className="bg-white rounded-[3rem] w-full max-w-md shadow-2xl border border-slate-100 overflow-hidden">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-indigo-50/50">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-600 text-white rounded-2xl"><CreditCard className="w-6 h-6" /></div>
                <div>
                  <h3 className="text-2xl font-black text-slate-900">Cobrança Asaas</h3>
                  <p className="text-sm text-slate-500 font-medium">Link de pagamento online gerado!</p>
                </div>
              </div>
              <button onClick={() => setCreatedAsaasPayment(null)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><X className="w-6 h-6" /></button>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="space-y-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Paciente</p>
                  <p className="text-lg font-black text-slate-800">{createdAsaasPayment.patientName}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
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
                  className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold shadow-lg hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                >
                  <Save className="w-5 h-5" /> Copiar Link de Pagamento
                </button>

                {createdAsaasPayment.phone ? (
                  <button
                    onClick={() => {
                      const cleanPhone = createdAsaasPayment.phone?.replace(/\D/g, '');
                      const msg = encodeURIComponent(
                        `Olá, *${createdAsaasPayment.patientName.split(' ')[0]}*! ✨\n\nSegue o link para pagamento do seu pacote na Tzion Terapias:\n\n🔗 ${createdAsaasPayment.url}\n\nVocê pode pagar via PIX, Cartão de Crédito ou Boleto. Qualquer dúvida, estamos à disposição! 💙`
                      );
                      window.open(`https://web.whatsapp.com/send?phone=55${cleanPhone}&text=${msg}`, '_blank');
                    }}
                    className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-bold shadow-lg hover:bg-emerald-600 transition-all flex items-center justify-center gap-2"
                  >
                    <MessageCircle className="w-5 h-5" /> Abrir no WhatsApp Web
                  </button>
                ) : (
                  <div className="text-center text-xs text-rose-500 font-bold bg-rose-50 py-3 rounded-xl">
                    Paciente sem telefone cadastrado para WhatsApp.
                  </div>
                )}
              </div>

              <button
                onClick={() => setCreatedAsaasPayment(null)}
                className="w-full py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-bold transition-all text-center"
              >
                Concluir e Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL: CONFIRMAR PAGAMENTO COM AJUSTE DE MÉTODO                         */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {confirmingPayment && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-6">
          <div className="bg-white rounded-[3rem] w-full max-w-md shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-indigo-50/50">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-600 text-white rounded-2xl"><CheckCircle2 className="w-6 h-6" /></div>
                <div>
                  <h3 className="text-2xl font-black text-slate-900">Confirmar Lançamento</h3>
                  <p className="text-sm text-slate-500 font-medium">Confirme a forma de recebimento</p>
                </div>
              </div>
              <button onClick={() => { setConfirmingPayment(null); setReceiptFile(null); }} className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><X className="w-6 h-6" /></button>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="space-y-4">
                <div className="bg-slate-50 rounded-2xl p-5 space-y-2 border border-slate-100">
                  <div className="text-sm"><span className="text-slate-400 font-medium">Lançamento: </span><span className="font-bold text-slate-800">{confirmingPayment.description}</span></div>
                  <div className="text-sm"><span className="text-slate-400 font-medium">Valor: </span><span className="font-black text-indigo-600 text-lg">R$ {fmt(Math.abs(confirmingPayment.amount))}</span></div>
                  {confirmingPayment.payment_method === 'asaas' && (
                    <div className="text-xs text-rose-500 bg-rose-50/80 p-3 rounded-xl border border-rose-100 mt-2 font-semibold">
                      ⚠️ Esta cobrança foi gerada via Asaas e deve ser confirmada automaticamente pelo webhook. Se o paciente pagou de outra forma na recepção, edite o método abaixo para confirmar manualmente.
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Forma de Recebimento Final</label>
                  <select
                    value={confirmMethod}
                    onChange={e => {
                      const method = e.target.value;
                      const inst = method === 'credit_card' ? confirmInstallments : 1;
                      const autoRate = getFeeRate(method, inst, feeRates);
                      setConfirmMethod(method);
                      setConfirmFeeRate(String(autoRate));
                      setConfirmInstallments(1);
                    }}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-700 appearance-none"
                  >
                    {PAYMENT_METHODS.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Comprovante de Pagamento (Imagem ou PDF)</label>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleFileChange}
                    className="w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100 cursor-pointer"
                  />
                  {uploadingFile && <p className="text-xs text-indigo-600 font-semibold animate-pulse">Fazendo upload...</p>}
                </div>

                {/* ── Taxa de Pagamento / Parcelamento ──────────────────── */}
                {(confirmMethod === 'credit_card' || confirmMethod === 'debit_card') && (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                    {confirmMethod === 'credit_card' && (
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Parcelamento</label>
                        <div className="flex flex-wrap gap-1.5">
                          {INSTALLMENT_OPTIONS.map(n => (
                            <button key={n} type="button"
                              onClick={() => { setConfirmInstallments(n); setConfirmFeeRate(String(getFeeRate('credit_card', n, feeRates))); }}
                              className={cn('px-2.5 py-1 rounded-lg text-[11px] font-black border transition-all',
                                confirmInstallments === n
                                  ? 'bg-indigo-600 text-white border-indigo-600'
                                  : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300'
                              )}>
                              {n}x
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                        Taxa {confirmMethod === 'credit_card' ? `Crédito ${confirmInstallments}x` : 'Débito'} (%)
                      </label>
                      <input type="number" step="0.01" min="0" max="100"
                        value={confirmFeeRate} onChange={e => setConfirmFeeRate(e.target.value)}
                        className="w-20 px-2.5 py-1 bg-white border border-slate-200 rounded-xl font-black text-slate-700 text-right outline-none focus:border-indigo-500"
                      />
                    </div>
                    {(() => {
                      const price = Math.abs(confirmingPayment.amount);
                      const rate = parseFloat(confirmFeeRate) || 0;
                      const feeVal = price * (rate / 100);
                      const netVal = price - feeVal;
                      return (
                        <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 font-medium pt-2 border-t border-slate-200/60">
                          <div>Taxa Cobrada: <strong className="text-slate-800">R$ {fmt(feeVal)}</strong></div>
                          <div className="text-right">Líquido Recebido: <strong className="text-indigo-600">R$ {fmt(netVal)}</strong></div>
                        </div>
                      );
                    })()}
                  </div>
                )}
                {(confirmMethod === 'asaas' || confirmMethod === 'asaas_pix' || confirmMethod === 'asaas_credit') && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest ml-1">
                        Taxa Asaas (%) — {confirmMethod === 'asaas_pix' ? 'PIX' : 'Cartão Online'}
                      </label>
                      <input type="number" step="0.01" min="0" max="100"
                        value={confirmFeeRate} onChange={e => setConfirmFeeRate(e.target.value)}
                        className="w-20 px-2.5 py-1 bg-white border border-blue-200 rounded-xl font-black text-blue-700 text-right outline-none focus:border-blue-400"
                      />
                    </div>
                    {(() => {
                      const price = Math.abs(confirmingPayment.amount);
                      const rate = parseFloat(confirmFeeRate) || 0;
                      const feeVal = price * (rate / 100);
                      const netVal = price - feeVal;
                      return (
                        <div className="grid grid-cols-2 gap-2 text-xs font-medium pt-2 border-t border-blue-200/60">
                          <div className="text-blue-700">Taxa Asaas: <strong>R$ {fmt(feeVal)}</strong></div>
                          <div className="text-right text-indigo-600">Líquido: <strong>R$ {fmt(netVal)}</strong></div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <button
                  onClick={handleConfirmPaymentSubmit}
                  disabled={saving}
                  className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-bold shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />} Confirmar Recebimento
                </button>
                <button
                  onClick={() => { setConfirmingPayment(null); setReceiptFile(null); }}
                  className="w-full py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-bold transition-all text-center"
                >
                  Voltar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL: DAR BAIXA EM REPASSE                                              */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {showPayoutModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <div className="bg-white rounded-[3rem] w-full max-w-md shadow-2xl border border-slate-100 overflow-hidden">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-emerald-50/50">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-emerald-500 text-white rounded-2xl"><Receipt className="w-6 h-6" /></div>
                <div>
                  <h3 className="text-2xl font-black text-slate-900">Dar Baixa no Repasse</h3>
                  <p className="text-sm text-slate-500">{showPayoutModal.therapists?.name || 'Terapeuta'} — {MONTH_NAMES[(showPayoutModal.month || 1) - 1]}/{showPayoutModal.year}</p>
                  {getPatientsForPayout(showPayoutModal.therapist_id, showPayoutModal.month, showPayoutModal.year) !== '—' && (
                    <p className="text-xs text-slate-500 font-medium mt-1">
                      Pacientes: <span className="text-slate-800 font-bold">{getPatientsForPayout(showPayoutModal.therapist_id, showPayoutModal.month, showPayoutModal.year)}</span>
                    </p>
                  )}
                </div>
              </div>
              <button onClick={() => setShowPayoutModal(null)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><X className="w-6 h-6" /></button>
            </div>
            <div className="p-8 space-y-5">
              {/* Summary */}
              <div className="bg-slate-50 rounded-2xl p-5 space-y-2 border border-slate-100">
                <div className="flex justify-between text-sm"><span className="text-slate-400 font-medium">Faturamento Bruto</span><span className="font-bold text-slate-800">R$ {fmt(showPayoutModal.gross_total)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-400 font-medium">Taxa Clínica</span><span className="font-bold text-indigo-600">− R$ {fmt(showPayoutModal.clinic_share)}</span></div>
                <div className="flex justify-between text-sm border-t border-slate-200 pt-2 mt-2"><span className="font-black text-slate-800">Valor a Pagar ao Terapeuta</span><span className="font-black text-emerald-600 text-lg">R$ {fmt(showPayoutModal.therapist_net)}</span></div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Método de Pagamento</label>
                <select value={payoutMethod} onChange={e => setPayoutMethod(e.target.value)}
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-700 appearance-none">
                  {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Observações (opcional)</label>
                <input value={payoutNote} onChange={e => setPayoutNote(e.target.value)}
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-700"
                  placeholder="Ex: Transferência realizada no Bradesco" />
              </div>
              <p className="text-xs text-slate-400 font-medium flex items-center gap-1">
                <MessageCircle className="w-3.5 h-3.5" /> O terapeuta receberá uma notificação via WhatsApp confirmando este repasse.
              </p>
              <button onClick={handlePayoutConfirm} disabled={saving}
                className="w-full py-5 bg-emerald-500 text-white rounded-2xl font-bold shadow-xl shadow-emerald-100 hover:bg-emerald-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />} Confirmar Pagamento do Repasse
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL: CONFIG TAXAS DO TERAPEUTA                                         */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {showTherapistConfigModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <div className="bg-white rounded-[3rem] w-full max-w-md shadow-2xl border border-slate-100 overflow-hidden">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-indigo-50/50">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-600 text-white rounded-2xl"><Settings className="w-6 h-6" /></div>
                <div>
                  <h3 className="text-xl font-black text-slate-900">Configurar Comissões</h3>
                  <p className="text-sm text-slate-500">{showTherapistConfigModal.name}</p>
                </div>
              </div>
              <button onClick={() => setShowTherapistConfigModal(null)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><X className="w-6 h-6" /></button>
            </div>
            <div className="p-8 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest ml-1">% Clínica (Indicação Clínica)</label>
                  <div className="relative">
                    <input type="number" min={0} max={100} value={therapistConfig.commission_rate_clinic}
                      onChange={e => setTherapistConfig({ ...therapistConfig, commission_rate_clinic: e.target.value })}
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-black text-indigo-600 text-2xl focus:ring-2 focus:ring-indigo-500/20" />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-lg">%</span>
                  </div>
                  <p className="text-[10px] text-slate-400 ml-1">Quando a clínica indicou o paciente</p>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest ml-1">% Clínica (Indicação Terapeuta)</label>
                  <div className="relative">
                    <input type="number" min={0} max={100} value={therapistConfig.commission_rate_self}
                      onChange={e => setTherapistConfig({ ...therapistConfig, commission_rate_self: e.target.value })}
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-black text-emerald-600 text-2xl focus:ring-2 focus:ring-emerald-500/20" />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-lg">%</span>
                  </div>
                  <p className="text-[10px] text-slate-400 ml-1">Quando o terapeuta trouxe o paciente</p>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Chave PIX</label>
                <input value={therapistConfig.pix_key} onChange={e => setTherapistConfig({ ...therapistConfig, pix_key: e.target.value })}
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-700"
                  placeholder="CPF, e-mail ou telefone" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Telefone / WhatsApp</label>
                <input value={therapistConfig.phone} onChange={e => setTherapistConfig({ ...therapistConfig, phone: e.target.value })}
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-700"
                  placeholder="(11) 99999-9999" />
              </div>
              <button onClick={handleSaveTherapistConfig} disabled={saving}
                className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-bold shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} Salvar Configurações
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL: CONFIGURAR TAXAS DE PAGAMENTO                                    */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {showFeeSettingsModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <div className="bg-white rounded-[3rem] w-full max-w-lg shadow-2xl border border-slate-100 overflow-hidden">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-indigo-50/50">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-600 text-white rounded-2xl"><Settings className="w-6 h-6" /></div>
                <div>
                  <h3 className="text-xl font-black text-slate-900">Taxas de Pagamento</h3>
                  <p className="text-sm text-slate-500">Taxas padrão aplicadas automaticamente nos cálculos</p>
                </div>
              </div>
              <button onClick={() => setShowFeeSettingsModal(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><X className="w-6 h-6" /></button>
            </div>
            <div className="p-8 space-y-6 overflow-y-auto max-h-[70vh]">
              {/* Débito */}
              <div className="space-y-3">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <span className="w-2 h-2 bg-amber-400 rounded-full inline-block" /> Cartão de Débito (Maquininha)
                </h4>
                <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                  <span className="text-sm font-bold text-slate-700">Taxa Débito (%)</span>
                  <input type="number" step="0.01" min="0" max="100" value={feeRatesInput.debit}
                    onChange={e => setFeeRatesInput(r => ({ ...r, debit: parseFloat(e.target.value) || 0 }))}
                    className="w-24 px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-black text-slate-700 text-right outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
              {/* Crédito */}
              <div className="space-y-3">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <span className="w-2 h-2 bg-indigo-400 rounded-full inline-block" /> Cartão de Crédito (Maquininha)
                </h4>
                <div className="space-y-2">
                  {([
                    { key: 'credit_1x' as keyof FeeRates, label: 'À Vista (1x)' },
                    { key: 'credit_2_6x' as keyof FeeRates, label: 'Parcelado 2x – 6x' },
                    { key: 'credit_7_12x' as keyof FeeRates, label: 'Parcelado 7x – 12x' },
                  ] as const).map(({ key, label }) => (
                    <div key={key} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                      <span className="text-sm font-bold text-slate-700">{label} (%)</span>
                      <input type="number" step="0.01" min="0" max="100" value={feeRatesInput[key]}
                        onChange={e => setFeeRatesInput(r => ({ ...r, [key]: parseFloat(e.target.value) || 0 }))}
                        className="w-24 px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-black text-slate-700 text-right outline-none focus:border-indigo-500"
                      />
                    </div>
                  ))}
                </div>
              </div>
              {/* Asaas */}
              <div className="space-y-3">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-400 rounded-full inline-block" /> Asaas (Pagamentos Online)
                </h4>
                <div className="space-y-2">
                  {([
                    { key: 'asaas_pix' as keyof FeeRates, label: 'PIX via Asaas (%)' },
                    { key: 'asaas_credit' as keyof FeeRates, label: 'Cartão Online via Asaas (%)' },
                  ] as const).map(({ key, label }) => (
                    <div key={key} className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-2xl">
                      <span className="text-sm font-bold text-blue-800">{label}</span>
                      <input type="number" step="0.01" min="0" max="100" value={feeRatesInput[key]}
                        onChange={e => setFeeRatesInput(r => ({ ...r, [key]: parseFloat(e.target.value) || 0 }))}
                        className="w-24 px-3 py-1.5 bg-white border border-blue-200 rounded-xl font-black text-blue-700 text-right outline-none focus:border-blue-400"
                      />
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-slate-400 font-medium px-1">As taxas do Asaas são estimativas. O valor líquido real é confirmado pelo webhook após o pagamento.</p>
              </div>
              <button onClick={handleSaveFeeRates} disabled={saving}
                className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-bold shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} Salvar Taxas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL: CONFIRMAR PAGAMENTO DE BÔNUS                                     */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {showBonusModal && (() => {
        const bonus = showBonusModal;
        const staffMember = staff.find(s => s.id === bonus.staff_id);
        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
            <div className="bg-white rounded-[3rem] w-full max-w-md shadow-2xl border border-slate-100 overflow-hidden">
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-amber-50/50">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-amber-500 text-white rounded-2xl"><Award className="w-6 h-6" /></div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900">Confirmar Bônus</h3>
                    <p className="text-sm text-slate-500">{staffMember?.name} — {MONTH_NAMES[bonus.month - 1]}/{bonus.year}</p>
                  </div>
                </div>
                <button onClick={() => setShowBonusModal(null)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><X className="w-6 h-6" /></button>
              </div>
              <div className="p-8 space-y-5">
                {/* Resumo */}
                <div className="p-5 bg-amber-50 border border-amber-200 rounded-2xl space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500 font-semibold">Base (Receita Líquida)</span>
                    <span className="font-black text-slate-900">R$ {fmt(bonus.clinic_net_base)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500 font-semibold">% Bônus</span>
                    <span className="font-black text-slate-900">{bonus.commission_rate}%</span>
                  </div>
                  <div className="flex justify-between border-t border-amber-200 pt-2 mt-2">
                    <span className="font-black text-amber-700">Valor do Bônus</span>
                    <span className="font-black text-2xl text-amber-600">R$ {fmt(bonus.bonus_amount)}</span>
                  </div>
                </div>
                {/* Método de pagamento */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Método de Pagamento</label>
                  <select value={bonusPayMethod} onChange={e => setBonusPayMethod(e.target.value)}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-700 appearance-none">
                    {PAYMENT_METHODS.filter(m => !m.value.startsWith('asaas')).map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
                {/* Observação */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Observação (opcional)</label>
                  <textarea value={bonusPayNote} onChange={e => setBonusPayNote(e.target.value)} rows={2}
                    placeholder="Ex: Pago junto com salário via PIX..."
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-slate-700 font-medium resize-none" />
                </div>
                <p className="text-[11px] text-slate-400 font-medium px-1">
                  O pagamento será registrado automaticamente como despesa no fluxo de caixa.
                </p>
                <button onClick={handleConfirmStaffBonus} disabled={saving}
                  className="w-full py-5 bg-amber-500 text-white rounded-2xl font-bold shadow-xl shadow-amber-100 hover:bg-amber-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                  Confirmar Pagamento de R$ {fmt(bonus.bonus_amount)}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL: NOVO COLABORADOR                                                  */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {showStaffModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <div className="bg-white rounded-[3rem] w-full max-w-md shadow-2xl border border-slate-100 overflow-hidden">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-4"><div className="p-3 bg-indigo-600 text-white rounded-2xl"><Users className="w-6 h-6" /></div><h3 className="text-xl font-black text-slate-900">{editingStaffId ? 'Editar Administrativo' : 'Novo Administrativo'}</h3></div>
              <button onClick={() => setShowStaffModal(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><X className="w-6 h-6" /></button>
            </div>
            <div className="p-8 space-y-5">
              <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome Completo</label>
                <input value={newStaff.name} onChange={e => setNewStaff({ ...newStaff, name: e.target.value })} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-700" placeholder="Ex: João Silva" /></div>
              <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cargo / Função</label>
                <input value={newStaff.role} onChange={e => setNewStaff({ ...newStaff, role: e.target.value })} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-700" placeholder="Ex: Recepcionista" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Comissão (%)</label>
                  <input type="number" value={newStaff.commission_rate} onChange={e => setNewStaff({ ...newStaff, commission_rate: e.target.value })} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-700" /></div>
                <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Salário Base (R$)</label>
                  <input type="number" value={newStaff.base_salary} onChange={e => setNewStaff({ ...newStaff, base_salary: e.target.value })} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-700" /></div>
              </div>
              <button onClick={handleCreateStaff} disabled={saving} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-bold shadow-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} {editingStaffId ? 'Salvar Alterações' : 'Cadastrar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL: NOVO FORNECEDOR                                                   */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {showSupplierModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <div className="bg-white rounded-[3rem] w-full max-w-md shadow-2xl border border-slate-100 overflow-hidden">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-4"><div className="p-3 bg-indigo-600 text-white rounded-2xl"><Briefcase className="w-6 h-6" /></div><h3 className="text-xl font-black text-slate-900">Novo Fornecedor</h3></div>
              <button onClick={() => setShowSupplierModal(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><X className="w-6 h-6" /></button>
            </div>
            <div className="p-8 space-y-5">
              <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome da Empresa</label>
                <input value={newSupplier.company_name} onChange={e => setNewSupplier({ ...newSupplier, company_name: e.target.value })} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-700" placeholder="Ex: Fornecedor de Insumos" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">CNPJ</label>
                  <input value={newSupplier.cnpj} onChange={e => setNewSupplier({ ...newSupplier, cnpj: e.target.value })} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-700" placeholder="00.000.000/0001-00" /></div>
                <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Categoria</label>
                  <input value={newSupplier.category} onChange={e => setNewSupplier({ ...newSupplier, category: e.target.value })} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-700" placeholder="Ex: Manutenção" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Telefone / WhatsApp</label>
                  <input value={newSupplier.phone} onChange={e => setNewSupplier({ ...newSupplier, phone: e.target.value })} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-700" placeholder="(00) 00000-0000" /></div>
                <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">E-mail</label>
                  <input value={newSupplier.email} onChange={e => setNewSupplier({ ...newSupplier, email: e.target.value })} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-700" placeholder="contato@empresa.com" /></div>
              </div>
              <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Produtos / Serviços Fornecidos</label>
                <input value={newSupplier.products_provided} onChange={e => setNewSupplier({ ...newSupplier, products_provided: e.target.value })} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-700" placeholder="Ex: Óleos essenciais, papel toalha, etc..." /></div>
              <button onClick={handleCreateSupplier} disabled={saving} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-bold shadow-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} Salvar Fornecedor
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
