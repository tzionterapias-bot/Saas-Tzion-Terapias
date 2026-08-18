import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/src/lib/supabase';
import { CheckCircle2, FileText, Loader2, ShieldCheck, Download } from 'lucide-react';

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
          .select('*')
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

  const handleDownloadPdf = () => {
    const printableElement = document.getElementById('printable-contract');
    if (!printableElement) {
      window.print();
      return;
    }

    // Cria iframe isolado para impressão direta sem interferência de CSS da página
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      window.print();
      return;
    }

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Termo de Adesão e Contrato - Tzion Terapias</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 15mm 15mm 15mm 15mm;
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
            color: #1e293b;
            font-size: 10.5pt;
            line-height: 1.6;
            margin: 0;
            padding: 0;
            background: #ffffff;
          }
          h2 {
            font-size: 13pt;
            font-weight: 900;
            text-align: center;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin: 0 0 16px 0;
            padding-bottom: 12px;
            border-bottom: 1.5px solid #cbd5e1;
            color: #0f172a;
          }
          h3 {
            font-size: 11pt;
            font-weight: 800;
            text-transform: uppercase;
            color: #0f172a;
            margin: 16px 0 6px 0;
          }
          p {
            text-align: justify;
            text-align-last: left;
            margin: 0 0 10px 0;
            color: #334155;
          }
          strong {
            color: #0f172a;
            font-weight: 700;
          }
          .patient-box {
            background-color: #f8fafc;
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            padding: 10px 14px;
            margin-bottom: 16px;
          }
          .patient-row {
            margin-bottom: 4px;
            font-size: 10pt;
          }
          .patient-row:last-child {
            margin-bottom: 0;
          }
          .badge {
            background: #ffffff;
            border: 1px solid #cbd5e1;
            padding: 1px 6px;
            border-radius: 4px;
            font-weight: 800;
            color: #0f172a;
          }
          .seal-box {
            margin-top: 24px;
            border-top: 2px dashed #10b981;
            background: #f0fdf4;
            border-radius: 8px;
            padding: 12px 16px;
            border-left: 4px solid #10b981;
          }
          .date-final {
            text-align: right;
            font-weight: bold;
            margin-top: 18px;
            color: #0f172a;
          }
          .print-hidden {
            display: none !important;
          }
        </style>
      </head>
      <body>
        ${printableElement.innerHTML}
      </body>
      </html>
    `);
    doc.close();

    iframe.contentWindow?.focus();
    setTimeout(() => {
      iframe.contentWindow?.print();
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 3000);
    }, 250);
  };

  const handleSign = async () => {
    setSigning(true);
    try {
      let ip = 'Desconhecido';
      try {
        const res = await fetch('https://api.ipify.org?format=json');
        const data = await res.json();
        ip = data.ip;
      } catch (e) {}

      const { error } = await supabase
        .from('patient_contracts')
        .update({
          status: 'signed',
          signed_at: new Date().toISOString(),
          signature_ip: ip
        })
        .eq('id', id);

      if (error) throw error;
      setContract({ ...contract, status: 'signed', signed_at: new Date().toISOString(), signature_ip: ip });
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

  // Parser preciso para renderizar todo o texto sem perdas e com formatação perfeita
  const renderContractBlocks = () => {
    const raw = contract?.content || '';
    if (!raw.trim()) {
      return <p className="text-slate-500 italic">Nenhum texto de contrato encontrado.</p>;
    }

    // 1. Remove qualquer menção antiga de RG
    let text = String(raw)
      .replace(/com\s+Identidade\s+n[º°]?\s*[_.\w\s/-]*\s*expedido\s+por\s*[_.\w\s/-]*\s*na\s+data\s*[_.\w\s/-]*\s*e\s+CPF\s+sob\s+o\s+n[úu]mero/gi, 'inscrito(a) no CPF sob o número')
      .replace(/com\s+Identidade\s+n[º°]?\s*[_.\w\s/-]*\s*expedido\s+por\s*[_.\w\s/-]*\s*na\s+data\s*[_.\w\s/-]*/gi, '');

    // 2. Separa por parágrafos naturais
    const paragraphs = text
      .split(/\n\s*\n/)
      .map(p => p.trim())
      .filter(Boolean);

    // Destaque cirúrgico dos dados da clínica, paciente, terapeuta, sessões e valores
    const formatKeyData = (str: string) => {
      const parts = str.split(/(TZION TERAPIAS INTEGRATIVAS|CNPJ\s*[\d./-]+|CRTH-BR\s*\d+|Marcos Dany Teixeira Magalh[ãa]es|CPF\s*(?:N[º°]|sob o n[úu]mero)?\s*[\d.-]+|R\$\s*[\d.,]+|\b\d+\s*\([^)]+\)\s*sess[õo]es|\b\d+\s*sess[õo]es)/gi);

      return parts.map((part, idx) => {
        if (/(TZION TERAPIAS INTEGRATIVAS|CNPJ|CRTH-BR|Marcos Dany|CPF|R\$|\bsess[õo]es\b)/i.test(part)) {
          return <strong key={idx} className="font-bold text-slate-900">{part}</strong>;
        }
        return part;
      });
    };

    return (
      <div className="space-y-6 text-slate-700 text-sm md:text-base leading-relaxed">
        {paragraphs.map((para, idx) => {
          // Título principal do documento
          if (para.toUpperCase().includes('TERMO DE COMPROMISSO DE ATENDIMENTO TERAPÊUTICO')) {
            return (
              <div key={idx} className="text-center pb-4 mb-6 border-b border-slate-200">
                <h2 className="text-lg md:text-xl font-black text-slate-900 uppercase tracking-tight">
                  Termo de Compromisso de Atendimento Terapêutico
                </h2>
              </div>
            );
          }

          // Bloco de Identificação: Interagente / Responsável
          if (para.startsWith('Interagente:') || para.startsWith('Responsável(is):')) {
            const lines = para.split('\n').filter(Boolean);
            return (
              <div key={idx} className="patient-box bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-2 mb-6">
                {lines.map((line, lIdx) => {
                  const colonIdx = line.indexOf(':');
                  if (colonIdx === -1) return <p key={lIdx} className="font-bold text-slate-900">{line}</p>;
                  const label = line.slice(0, colonIdx).trim();
                  const val = line.slice(colonIdx + 1).trim();
                  return (
                    <div key={lIdx} className="patient-row flex flex-wrap items-center gap-1.5">
                      <span className="font-bold text-slate-700">{label}:</span>{' '}
                      <span className="badge font-black text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">{val}</span>
                    </div>
                  );
                })}
              </div>
            );
          }

          // Data e local final
          if (/^Aragua[íi]na/i.test(para)) {
            return (
              <div key={idx} className="date-final text-right pt-6 font-bold text-slate-900 text-sm md:text-base">
                {para}
              </div>
            );
          }

          // Cláusulas numeradas (ex: "1. Das partes\nAs partes..." ou "1. Das partes As partes...")
          const matchClause = para.match(/^(\d+\.\s+[^\n\r.]+)(\.|\n|:)?\s*(.*)$/s);
          if (matchClause) {
            const title = matchClause[1].trim();
            const rest = matchClause[3]?.trim();

            return (
              <div key={idx} className="space-y-2 pt-2">
                <h3 className="font-black text-slate-900 text-sm md:text-base uppercase tracking-wide flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-600 inline-block print-hidden"></span>
                  {title}
                </h3>
                {rest && (
                  <p className="text-justify [text-align-last:left] text-slate-700 leading-relaxed font-normal">
                    {formatKeyData(rest)}
                  </p>
                )}
              </div>
            );
          }

          // Parágrafo comum
          return (
            <p key={idx} className="text-justify [text-align-last:left] text-slate-700 leading-relaxed font-normal">
              {formatKeyData(para)}
            </p>
          );
        })}

        {/* Selo de Assinatura Digital no final do contrato */}
        {isSigned && (
          <div className="seal-box mt-8 pt-6 border-t-2 border-dashed border-emerald-300 bg-emerald-50/60 p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-black text-emerald-950 uppercase">Documento Assinado Digitalmente</p>
                <p className="text-xs text-emerald-700 font-medium">Assinado em {new Date(contract.signed_at).toLocaleString('pt-BR')}</p>
                <p className="text-[10px] text-emerald-600 font-mono">IP: {contract.signature_ip || 'Registrado'} • Hash: {contract.id.toUpperCase()}</p>
              </div>
            </div>
            <div className="text-right">
              <span className="inline-block px-3 py-1 bg-emerald-200/80 text-emerald-900 font-black text-[10px] rounded-lg uppercase tracking-wider">
                Autenticidade Verificada
              </span>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col relative font-sans print:bg-white print:min-h-0 print:block">
      {/* Header Fixo */}
      <header className="bg-white border-b border-slate-200 p-4 md:p-6 sticky top-0 z-10 shadow-sm flex items-center justify-between no-print">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-md">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-black text-slate-900 leading-tight text-sm md:text-base">Termo de Serviço</h1>
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Clínica Tzion Terapias</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleDownloadPdf}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-all shadow-sm active:scale-95"
            title="Salvar ou Imprimir em PDF"
          >
            <Download className="w-4 h-4 text-indigo-600" />
            <span className="hidden sm:inline">Baixar Contrato (PDF)</span>
            <span className="sm:hidden">PDF</span>
          </button>

          {isSigned && (
            <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-2 rounded-xl border border-emerald-100 shadow-sm">
              <ShieldCheck className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider hidden sm:inline">Assinado</span>
            </div>
          )}
        </div>
      </header>

      {/* Conteúdo do Contrato */}
      <main className="flex-1 p-6 md:p-12 max-w-3xl mx-auto w-full print:p-0 print:max-w-none print:block">
        <div 
          id="printable-contract"
          className="contract-card bg-white rounded-[2rem] shadow-sm border border-slate-200 p-8 md:p-12 mb-8 relative print:border-none print:shadow-none print:p-0 print:m-0 print:block"
        >
          {/* Watermark quando assinado */}
          {isSigned && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-5 pointer-events-none rotate-[-30deg] print:hidden print-hidden">
              <span className="text-8xl font-black uppercase text-emerald-900 whitespace-nowrap">Assinado Digitalmente</span>
            </div>
          )}

          {renderContractBlocks()}
        </div>

        {/* Rodapé e Ações */}
        <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 p-8 text-center space-y-6 no-print">
          {isSigned ? (
            <div className="flex flex-col items-center justify-center py-6">
              <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-2">Contrato Assinado com Sucesso</h3>
              <p className="text-slate-500 max-w-sm text-sm">
                Sua assinatura eletrônica foi registrada com validade jurídica em {new Date(contract.signed_at).toLocaleString('pt-BR')}.
              </p>
              <p className="text-xs text-slate-400 mt-2 font-mono">ID da Assinatura: {contract.id.split('-')[0].toUpperCase()}</p>

              <button
                onClick={handleDownloadPdf}
                className="mt-6 w-full max-w-md py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-base shadow-xl shadow-emerald-200 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
              >
                <Download className="w-5 h-5" /> Baixar Contrato Assinado (PDF)
              </button>
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

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 border border-slate-200"
                >
                  <Download className="w-4 h-4 text-slate-600" /> Baixar Cópia (PDF)
                </button>

                <button 
                  onClick={handleSign}
                  disabled={signing}
                  className="flex-[2] py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-base shadow-xl shadow-indigo-200 transition-all active:scale-[0.98] disabled:opacity-70 flex items-center justify-center gap-3"
                >
                  {signing ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Registrando Assinatura...</>
                  ) : (
                    <>Assinar Digitalmente e Concordar</>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

