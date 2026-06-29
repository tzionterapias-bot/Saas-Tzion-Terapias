import React, { useState, useEffect, useCallback } from 'react';
import { 
  CreditCard, DollarSign, CheckCircle2, AlertCircle, Loader2, X, Save, 
  Users, Briefcase, Percent
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { supabase } from '@/src/lib/supabase';
import { sendWhatsAppMessage } from '@/src/lib/whatsapp';

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

const PAYMENT_METHODS = [
  { value: 'asaas_pix', label: 'PIX (Gerar QR Code - Asaas)' },
  { value: 'asaas_credit', label: 'Cartão de Crédito Online (Enviar WhatsApp - Asaas)' },
  { value: 'credit_card', label: 'Cartão de Crédito (Maquininha Física)' },
  { value: 'debit_card', label: 'Cartão de Débito (Maquininha Física)' },
  { value: 'cash', label: 'Dinheiro' },
  { value: 'transfer', label: 'Transferência / TED' },
  { value: 'pix', label: 'PIX Manual (Chave da Clínica)' },
];

export default function QuickSellPage() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [patients, setPatients] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [therapists, setTherapists] = useState<Therapist[]>([]);

  const emptySell = { patient_id: '', service_id: '', payment_method: 'asaas_pix', therapist_id: '', referral_source: 'therapist' as const };
  const [sellData, setSellData] = useState(emptySell);
  const [cardFeeRateInput, setCardFeeRateInput] = useState('0');
  const [multimodalItems, setMultimodalItems] = useState<{ service_id: string; sessions: number }[]>([]);
  
  const [createdAsaasPayment, setCreatedAsaasPayment] = useState<{ url: string; amount: number; patientName: string; phone: string | null } | null>(null);
  const [createdPixQrCode, setCreatedPixQrCode] = useState<{ encodedImage: string; payload: string; amount: number; patientName: string } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [servicesRes, patientsRes] = await Promise.all([
        supabase.from('services').select('*').order('name'),
        supabase.from('patients').select('id, name, phone, cpf').eq('status', 'Ativo').order('name')
      ]);

      setServices(servicesRes.data || []);
      setPatients(patientsRes.data || []);

      const therapistsRes = await supabase
        .from('therapists')
        .select('id, name, phone, pix_key, commission_rate_clinic, commission_rate_self, user_id')
        .order('name');
      
      if (!therapistsRes.error) {
        setTherapists((therapistsRes.data || []) as Therapist[]);
      } else {
        const fallback = await supabase.from('therapists').select('id, name, user_id').order('name');
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
  }, []);

  const selectedSvc = services.find(s => s.id === sellData.service_id);

  const handleSellService = async () => {
    if (!sellData.patient_id || !sellData.service_id) {
      showToast('Selecione o paciente e o serviço.', 'error');
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
        const response = await fetch('/api/financeiro/criar-cobranca', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            valor: service.price,
            pacienteId: sellData.patient_id,
            description: `${service.name} — Tzion Terapias`,
            billingType: isAsaasPix ? 'PIX' : 'CREDIT_CARD'
          })
        });

        const result = await response.json();
        if (!response.ok) {
          showToast(result.error || 'Erro ao gerar cobrança no Asaas.', 'error');
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
      : 0;
    const feeVal = service.price * (rate / 100);
    const netVal = service.price - feeVal;

    const { error: payErr } = await supabase.from('payments').insert([{
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
    }]);

    if (payErr) { 
      showToast('Erro ao registrar pagamento.', 'error'); 
      setSaving(false); 
      return; 
    }

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
        const qrRes = await fetch(`/api/financeiro/obter-pix-qrcode/${asaasId}`);
        if (qrRes.ok) {
          const qrData = await qrRes.json();
          if (qrData.success || qrData.encodedImage) {
            setCreatedPixQrCode({
              encodedImage: qrData.encodedImage,
              payload: qrData.payload,
              amount: service.price,
              patientName: patient.name
            });
            showToast('QR Code do PIX gerado com sucesso!');
          } else {
            showToast('Cobrança PIX criada, mas erro ao gerar QR Code.', 'error');
          }
        } else {
          showToast('Erro de API ao buscar QR Code do PIX.', 'error');
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
        phone: patient.phone
      });

      // Enviar cobrança automaticamente se tiver telefone
      if (patient.phone) {
        try {
          const firstName = patient.name.split(' ')[0];
          const msg = `Olá, *${firstName}*! ✨\n\nSegue o link para pagamento do seu pacote *${service.name}* na Tzion Terapias:\n\n🔗 ${asaasLink}\n\nVocê pode pagar via PIX, Cartão de Crédito ou Boleto. Qualquer dúvida, estamos à disposição! 💙`;
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
      showToast('Venda registrada com sucesso!');
      setSellData(emptySell);
      setMultimodalItems([]);
    }

    setSaving(false);
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-10 animate-in fade-in duration-500 relative">
      {toast && (
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
      )}

      {/* Header card */}
      <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex items-center gap-4">
        <div className="p-4 bg-emerald-500 text-white rounded-3xl shadow-lg shadow-emerald-100 shrink-0">
          <Briefcase className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight leading-tight">Venda Rápida de Serviços</h2>
          <p className="text-slate-500 text-sm mt-1 font-medium">Cadastre vendas e gere links de pagamento sem precisar abrir o financeiro.</p>
        </div>
      </div>

      {/* Form card */}
      <div className="bg-white border border-slate-200 rounded-[2.5rem] shadow-sm overflow-hidden p-6 sm:p-8 space-y-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
            <p className="text-slate-400 font-bold text-sm">Carregando dados...</p>
          </div>
        ) : (
          <>
            {/* Paciente */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Paciente *</label>
              <select 
                value={sellData.patient_id} 
                onChange={e => setSellData({ ...sellData, patient_id: e.target.value })}
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-700 appearance-none focus:bg-white focus:border-indigo-400 transition-all cursor-pointer text-sm"
              >
                <option value="">Selecione o paciente...</option>
                {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            {/* Serviço */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Serviço ou Pacote *</label>
              <select 
                value={sellData.service_id} 
                onChange={e => {
                  const svcId = e.target.value;
                  setSellData({ ...sellData, service_id: svcId });
                  const svc = services.find(s => s.id === svcId);
                  if (svc && svc.type === 'pacote') {
                    setMultimodalItems([{ service_id: '', sessions: svc.sessions_count }]);
                  } else {
                    setMultimodalItems([]);
                  }
                }}
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-700 appearance-none focus:bg-white focus:border-indigo-400 transition-all cursor-pointer text-sm"
              >
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
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-700 appearance-none focus:bg-white focus:border-indigo-400 transition-all cursor-pointer text-sm"
                >
                  {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Terapeuta</label>
                <select 
                  value={sellData.therapist_id} 
                  onChange={e => setSellData({ ...sellData, therapist_id: e.target.value })}
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-700 appearance-none focus:bg-white focus:border-indigo-400 transition-all cursor-pointer text-sm"
                >
                  <option value="">Sem terapeuta</option>
                  {therapists.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>

            {/* Taxa da Maquininha (cartões) */}
            {(sellData.payment_method === 'credit_card' || sellData.payment_method === 'debit_card') && (
              <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
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
                  const price = selectedSvc?.price ?? 0;
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
                      className={cn("p-4 rounded-2xl border-2 font-bold text-sm flex flex-col items-center gap-2 transition-all cursor-pointer",
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
              {sellData.service_id && (() => {
                const th = therapists.find(t => t.id === sellData.therapist_id);
                if (!selectedSvc) return null;
                const rate = sellData.referral_source === 'clinic' ? (th?.commission_rate_clinic ?? 50) : (th?.commission_rate_self ?? 25);
                const clinicAmt = selectedSvc.price * (rate / 100);
                const therapistAmt = selectedSvc.price - clinicAmt;
                return (
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/60 grid grid-cols-2 gap-4 text-center">
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

            {/* Confirm button */}
            <button 
              onClick={handleSellService} 
              disabled={saving}
              className="w-full py-5 bg-emerald-500 text-white rounded-[2rem] font-black text-lg shadow-xl shadow-emerald-100 hover:bg-emerald-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />} Confirmar Venda
            </button>
          </>
        )}
      </div>

      {/* Modal: PIX QR Code */}
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
            
            <div className="p-8 space-y-6 text-center">
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
                  className="w-56 h-56 rounded-3xl border border-slate-200 p-3 bg-white shadow-inner" 
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

      {/* Asaas Payment Link Info */}
      {createdAsaasPayment && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white rounded-[3rem] w-full max-w-md shadow-2xl border border-slate-100 overflow-hidden">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-indigo-50/50">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-600 text-white rounded-2xl"><CreditCard className="w-6 h-6" /></div>
                <div>
                  <h3 className="text-2xl font-black text-slate-900">Cobrança Asaas</h3>
                  <p className="text-sm text-slate-500 font-medium">Link de pagamento online gerado!</p>
                </div>
              </div>
              <button onClick={() => setCreatedAsaasPayment(null)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 cursor-pointer"><X className="w-6 h-6" /></button>
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
                  className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold shadow-lg hover:bg-slate-800 transition-all flex items-center justify-center gap-2 cursor-pointer text-sm"
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
                    className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-bold shadow-lg hover:bg-emerald-600 transition-all flex items-center justify-center gap-2 text-center block cursor-pointer text-sm"
                  >
                    Enviar Link via WhatsApp Manual
                  </a>
                ) : null}

                <button 
                  onClick={() => setCreatedAsaasPayment(null)}
                  className="w-full py-3 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all cursor-pointer text-sm"
                >
                  Fechar Janela
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
