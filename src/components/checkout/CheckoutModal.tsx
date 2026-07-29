import React, { useState, useEffect } from 'react';
import { X, Smartphone, CheckCircle2, Loader2, BookOpen } from 'lucide-react';
import { supabase } from '@/src/lib/supabase';

// Helper functions for masking
const maskCpf = (value: string) => {
  return value
    .replace(/\D/g, '')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})/, '$1-$2')
    .replace(/(-\d{2})\d+?$/, '$1');
};

const maskPhone = (value: string) => {
  return value
    .replace(/\D/g, '')
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2')
    .replace(/(-\d{4})\d+?$/, '$1');
};

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  productName: string;
  price: number;
  downloadUrl?: string;
}

export default function CheckoutModal({ isOpen, onClose, productName, price, downloadUrl }: CheckoutModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    cpfCnpj: '',
    phone: '',
  });
  const [pixData, setPixData] = useState<{ payload: string; encodedImage: string; id: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'approved'>('pending');

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (step === 2 && paymentId && paymentStatus === 'pending') {
      const checkStatus = async () => {
        try {
          const { data } = await supabase
            .from('product_sales')
            .select('status')
            .eq('asaas_payment_id', paymentId)
            .single();

          if (data?.status === 'paid' || data?.status === 'confirmed') {
             setPaymentStatus('approved');
          }
        } catch (err) {
          console.error('Erro ao verificar status:', err);
        }
      };

      interval = setInterval(checkStatus, 3000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [step, paymentId, paymentStatus]);

  if (!isOpen) return null;

  const handleProcessPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const cleanCpf = formData.cpfCnpj.replace(/\D/g, '');
      const cleanPhone = formData.phone.replace(/\D/g, '');

      if (cleanCpf.length !== 11) {
        throw new Error('CPF inválido.');
      }

      // 1. Check if patient exists or create new one to act as Asaas Customer
      let { data: patient } = await supabase
        .from('patients')
        .select('id')
        .eq('cpf', formData.cpfCnpj)
        .maybeSingle();

      if (!patient) {
        let { data: patientByEmail } = await supabase
          .from('patients')
          .select('id')
          .eq('email', formData.email)
          .maybeSingle();
        patient = patientByEmail;
      }

      if (!patient) {
        let { data: patientByPhone } = await supabase
          .from('patients')
          .select('id')
          .eq('phone', cleanPhone)
          .maybeSingle();
        patient = patientByPhone;
      }

      if (!patient) {
        const { data: newPatient, error: createErr } = await supabase
          .from('patients')
          .insert({
            name: formData.name,
            cpf: formData.cpfCnpj,
            phone: cleanPhone,
            email: formData.email,
            status: 'lead' // Mark as lead initially
          })
          .select('id')
          .single();

        if (createErr) {
          console.error("Supabase Insert Error:", createErr);
          throw new Error(createErr.message || 'Erro ao cadastrar lead no banco de dados.');
        }
        if (!newPatient) throw new Error('Erro ao cadastrar lead (nenhum dado retornado).');
        
        patient = newPatient;
      }

      // 2. Call Edge Function to create Payment in Asaas
      const { data: result, error: fnError } = await supabase.functions.invoke('asaas-integration/checkout', {
        method: 'POST',
        body: {
          valor: price,
          pacienteId: patient.id,
          description: `Compra do E-book: ${productName}`,
          billingType: 'PIX'
        }
      });

      if (fnError || result?.error) {
        throw new Error(result?.error || 'Erro ao gerar cobrança no Asaas.');
      }

      const paymentId = result.id;
      setPaymentId(paymentId);

      // 3. Get Pix QR Code
      const { data: pixResult, error: pixFnError } = await supabase.functions.invoke('asaas-integration/pix', {
        method: 'POST',
        body: { paymentId }
      });

      if (pixFnError || pixResult?.error || !pixResult?.success) {
        throw new Error('Erro ao gerar QR Code do Pix.');
      }

      // 4. Salvar no Supabase (product_sales)
      const { error: dbError } = await supabase.from('product_sales').insert({
        product_id: 'ebook_default',
        product_name: productName,
        product_url: downloadUrl,
        customer_name: formData.name,
        customer_email: formData.email,
        customer_phone: cleanPhone,
        customer_cpf: formData.cpfCnpj,
        price: price,
        asaas_payment_id: paymentId,
        status: 'pending'
      });

      // 5. Salvar também no financeiro (payments) para aparecer na Gestão Financeira
      await supabase.from('payments').insert({
        amount: price,
        net_amount: price,
        status: 'pending',
        type: 'income',
        category: 'Infoproduto',
        payment_method: 'pix',
        description: `Venda E-book: ${productName} — ${formData.name}`,
        asaas_id: paymentId,
        installments: 1
      });

      if (dbError) {
        console.error('Erro ao salvar venda:', dbError);
      }

      setPixData({
        payload: pixResult.payload,
        encodedImage: pixResult.encodedImage,
        id: paymentId
      });
      setStep(2);

    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro ao processar o pagamento.');
    } finally {
      setLoading(false);
    }
  };

  const copyPix = () => {
    if (pixData?.payload) {
      navigator.clipboard.writeText(pixData.payload);
      alert('Código Pix copiado!');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
      <div className="bg-white rounded-[3rem] w-full max-w-lg shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Finalizar Compra</h3>
              <p className="text-sm font-medium text-slate-500">{productName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-white rounded-full transition-all text-slate-400 border border-transparent hover:border-slate-200">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-8 overflow-y-auto custom-scrollbar">
          {error && (
            <div className="mb-6 p-4 bg-rose-50 text-rose-600 rounded-2xl text-sm font-bold border border-rose-100">
              {error}
            </div>
          )}

          {step === 1 ? (
            <form onSubmit={handleProcessPayment} className="space-y-6">
              <div className="p-5 bg-indigo-50/50 rounded-2xl border border-indigo-100 flex items-center justify-between mb-8">
                <span className="font-bold text-slate-700">Total a pagar:</span>
                <span className="text-2xl font-black text-indigo-600">
                  R$ {price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome Completo</label>
                <input 
                  required
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
                  placeholder="Seu nome completo"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">CPF</label>
                  <input 
                    required
                    value={formData.cpfCnpj}
                    onChange={(e: any) => setFormData({...formData, cpfCnpj: maskCpf(e.target.value)})}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
                    placeholder="000.000.000-00"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">WhatsApp</label>
                  <input 
                    required
                    value={formData.phone}
                    onChange={(e: any) => setFormData({...formData, phone: maskPhone(e.target.value)})}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">E-mail</label>
                <input 
                  type="email"
                  required
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
                  placeholder="Seu melhor e-mail"
                />
              </div>

              <button 
                type="submit"
                disabled={loading}
                className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-bold shadow-2xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 mt-8 disabled:opacity-70"
              >
                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Smartphone className="w-6 h-6" />}
                Pagar com Pix
              </button>
              <p className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Pagamento 100% Seguro
              </p>
            </form>
          ) : paymentStatus === 'approved' ? (
            <div className="flex flex-col items-center justify-center py-6 space-y-8 animate-in zoom-in-95 duration-500">
              <div className="text-center space-y-2">
                <div className="w-20 h-20 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-xl shadow-emerald-200">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h4 className="text-3xl font-black text-slate-900">Pagamento Aprovado!</h4>
                <p className="text-slate-500 font-medium text-base mt-2">
                  Tudo certo com a sua compra. O seu E-book acaba de ser enviado para o seu WhatsApp!
                </p>
              </div>
              <button 
                onClick={onClose}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all"
              >
                Fechar Janela
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 space-y-8 animate-in zoom-in-95 duration-500">
              <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h4 className="text-2xl font-black text-slate-900">Pedido Gerado!</h4>
                <p className="text-slate-500 font-medium text-sm">Escaneie o QR Code abaixo para liberar seu E-book.</p>
              </div>

              {pixData?.encodedImage && (
                <div className="p-4 bg-white border-2 border-dashed border-slate-200 rounded-3xl">
                  <img src={`data:image/png;base64,${pixData.encodedImage}`} alt="QR Code Pix" className="w-48 h-48" />
                </div>
              )}

              <div className="w-full space-y-3">
                <button 
                  onClick={copyPix}
                  className="w-full py-4 bg-indigo-50 text-indigo-700 rounded-2xl font-bold border border-indigo-100 hover:bg-indigo-100 transition-all"
                >
                  Copiar Código Pix (Copia e Cola)
                </button>
                <p className="text-center text-xs text-slate-500 font-medium px-4">
                  Assim que o pagamento for aprovado, você receberá o E-book diretamente no seu WhatsApp!
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
