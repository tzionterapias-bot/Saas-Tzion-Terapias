import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/src/lib/supabase';
import { CheckCircle2, FileText, Loader2, ShieldCheck } from 'lucide-react';
import { cn } from '@/src/lib/utils';

export default function PublicContractPage() {
  const { id } = useParams();
  const [contract, setContract] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    document.title = "Termo de Adesão e Contrato | Tzion Terapias";
    let metaDescription = document.querySelector('meta[name="description"]');
    if (!metaDescription) {
      metaDescription = document.createElement('meta');
      metaDescription.setAttribute('name', 'description');
      document.head.appendChild(metaDescription);
    }
    metaDescription.setAttribute('content', 'Assinatura digital do Termo de Adesão e Contrato de Prestação de Serviços da clínica Tzion Terapias.');
  }, []);

  useEffect(() => {
    const fetchContract = async () => {
      try {
        const { data, error } = await supabase
          .from('patient_contracts')
          .select('*, patients(name, cpf)')
          .eq('id', id)
          .single();

        if (error || !data) throw new Error('Contrato não encontrado ou expirado.');
        setContract(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchContract();
  }, [id]);

  const handleSign = async () => {
    setSigning(true);
    try {
      // Pega IP para fins de registro de assinatura
      let ip = 'Desconhecido';
      try {
        const res = await fetch('https://api.ipify.org?format=json');
        const data = await res.json();
        ip = data.ip;
      } catch(e) {}

      const { error } = await supabase
        .from('patient_contracts')
        .update({
          status: 'signed',
          signed_at: new Date().toISOString(),
          signature_ip: ip
        })
        .eq('id', id);

      if (error) throw error;
      setContract({ ...contract, status: 'signed', signed_at: new Date().toISOString() });
    } catch (err: any) {
      alert('Ocorreu um erro ao assinar o contrato. Tente novamente.');
    } finally {
      setSigning(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mb-6">
          <FileText className="w-10 h-10" />
        </div>
        <h1 className="text-2xl font-black text-slate-900 mb-2">Ops! Algo deu errado.</h1>
        <p className="text-slate-500">{error}</p>
      </div>
    );
  }

  const isSigned = contract?.status === 'signed';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col relative font-sans">
      {/* Header Fixo */}
      <header className="bg-white border-b border-slate-200 p-6 sticky top-0 z-10 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-md">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-black text-slate-900 leading-tight">Termo de Serviço</h1>
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Clínica Tzion Terapias</p>
          </div>
        </div>
        {isSigned && (
           <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg border border-emerald-100">
             <ShieldCheck className="w-4 h-4" />
             <span className="text-xs font-bold uppercase tracking-wider">Assinado</span>
           </div>
        )}
      </header>

      {/* Conteúdo do Contrato */}
      <main className="flex-1 p-6 md:p-12 max-w-3xl mx-auto w-full">
        <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 p-8 md:p-12 mb-8 relative overflow-hidden">
          {/* Watermark quando assinado */}
          {isSigned && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-5 pointer-events-none rotate-[-30deg]">
              <span className="text-8xl font-black uppercase text-emerald-900 whitespace-nowrap">Assinado Digitalmente</span>
            </div>
          )}

          <div className="prose prose-slate prose-indigo max-w-none whitespace-pre-wrap text-sm md:text-base leading-relaxed text-slate-700">
            {contract?.content}
          </div>
        </div>

        {/* Rodapé e Ações */}
        <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 p-8 text-center space-y-6">
          {isSigned ? (
            <div className="flex flex-col items-center justify-center py-6">
              <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-2">Contrato Assinado</h3>
              <p className="text-slate-500 max-w-sm">
                Sua assinatura eletrônica foi registrada com sucesso em {new Date(contract.signed_at).toLocaleString('pt-BR')}.
              </p>
              <p className="text-xs text-slate-400 mt-4 font-mono">ID da Assinatura: {contract.id.split('-')[0].toUpperCase()}</p>
            </div>
          ) : (
            <>
              <div className="text-left bg-slate-50 p-6 rounded-2xl border border-slate-100">
                <h4 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-indigo-600" /> Assinatura Eletrônica
                </h4>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Ao clicar no botão abaixo, você declara que leu e concorda integralmente com os termos descritos acima. 
                  Sua assinatura digital (IP e Timestamp) será registrada com validade jurídica.
                </p>
              </div>

              <button 
                onClick={handleSign}
                disabled={signing}
                className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-lg shadow-xl shadow-indigo-200 transition-all active:scale-[0.98] disabled:opacity-70 flex items-center justify-center gap-3"
              >
                {signing ? (
                  <><Loader2 className="w-6 h-6 animate-spin" /> Registrando Assinatura...</>
                ) : (
                  <>Assinar Digitalmente e Concordar</>
                )}
              </button>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
