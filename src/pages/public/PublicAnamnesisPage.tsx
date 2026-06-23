import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/src/lib/supabase';
import { Heart, FileText, CheckCircle2, Loader2, AlertCircle, MapPin, Save, HelpCircle } from 'lucide-react';
import { cn } from '@/src/lib/utils';

export default function PublicAnamnesisPage() {
  const { token } = useParams<{ token: string }>();
  const [patientName, setPatientName] = useState('');
  const [template, setTemplate] = useState<any>(null);
  const [responses, setResponses] = useState<Record<string, any>>({});
  
  // Legacy fallback states
  const [complaint, setComplaint] = useState('');
  const [familyHistory, setFamilyHistory] = useState('');
  const [lifestyle, setLifestyle] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Ficha de Anamnese | Tzion Terapias";
    let metaDescription = document.querySelector('meta[name="description"]');
    if (!metaDescription) {
      metaDescription = document.createElement('meta');
      metaDescription.setAttribute('name', 'description');
      document.head.appendChild(metaDescription);
    }
    metaDescription.setAttribute('content', 'Preencha com total confidencialidade a sua ficha de anamnese clínica antes do início das suas sessões na Tzion Terapias.');
  }, []);

  useEffect(() => {
    const fetchPatientAndAnamnesis = async () => {
      if (!token) return;
      try {
        setLoading(true);
        const res = await fetch(`/api/public/anamnese/${token}`);
        if (!res.ok) {
          setErrorMsg('Paciente não encontrado ou link inválido.');
          setLoading(false);
          return;
        }

        const data = await res.json();
        setPatientName(data.patientName);
        setTemplate(data.template);
        setResponses(data.responses || {});
        setComplaint(data.complaint || '');
        setFamilyHistory(data.familyHistory || '');
        setLifestyle(data.lifestyle || '');
      } catch (err) {
        console.error(err);
        setErrorMsg('Erro ao carregar dados do formulário.');
      } finally {
        setLoading(false);
      }
    };

    fetchPatientAndAnamnesis();
  }, [token]);

  const handleFieldChange = (fieldId: string, value: any) => {
    setResponses(prev => ({ ...prev, [fieldId]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setErrorMsg(null);

    try {
      // Map dynamic fields to legacy fields for backwards compatibility
      let comp = complaint;
      let fam = familyHistory;
      let life = lifestyle;

      if (template && template.fields) {
        template.fields.forEach((f: any) => {
          const val = responses[f.id];
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

      const res = await fetch(`/api/public/anamnese/${token}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          templateId: template?.id || null,
          responses,
          complaint: comp,
          familyHistory: fam,
          lifestyle: life
        })
      });

      if (!res.ok) {
        throw new Error(await res.text() || 'Erro ao salvar a ficha de anamnese.');
      }

      setSubmitted(true);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Falha ao salvar a ficha de anamnese. Por favor, tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const renderFieldInput = (field: any) => {
    const val = responses[field.id] !== undefined ? responses[field.id] : '';

    switch (field.type) {
      case 'textarea':
        return (
          <textarea
            required={field.required}
            value={val}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            rows={4}
            placeholder="Digite sua resposta aqui..."
            className="w-full p-5 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-2xl text-slate-700 font-medium leading-relaxed outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
          />
        );

      case 'date':
        return (
          <input
            type="date"
            required={field.required}
            value={val}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            className="w-full md:w-64 p-4 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl text-slate-700 font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
          />
        );

      case 'select':
        return (
          <div className="relative w-full md:w-80">
            <select
              required={field.required}
              value={val}
              onChange={(e) => handleFieldChange(field.id, e.target.value)}
              className="w-full p-4 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl text-slate-700 font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all appearance-none cursor-pointer"
            >
              <option value="">Selecione uma opção...</option>
              {field.options && field.options.map((opt: string, i: number) => (
                <option key={i} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        );

      case 'yesno':
        return (
          <div className="flex gap-3">
            {[
              { label: 'Sim', value: 'Sim' },
              { label: 'Não', value: 'Não' }
            ].map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleFieldChange(field.id, opt.value)}
                className={cn(
                  "px-8 py-3.5 rounded-xl text-xs font-bold border transition-all active:scale-95",
                  val === opt.value
                    ? opt.value === 'Sim' 
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100"
                      : "bg-slate-700 text-white border-slate-700 shadow-md shadow-slate-100"
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        );

      case 'scale':
        return (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 11 }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleFieldChange(field.id, i)}
                  className={cn(
                    "w-11 h-11 rounded-xl text-xs font-bold transition-all border flex items-center justify-center active:scale-90",
                    val === i
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100 scale-105"
                      : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                  )}
                >
                  {i}
                </button>
              ))}
            </div>
            <div className="flex justify-between max-w-lg text-[10px] font-bold text-slate-400 px-1">
              <span>Mínimo</span>
              <span>Máximo</span>
            </div>
          </div>
        );

      case 'text':
      default:
        return (
          <input
            type="text"
            required={field.required}
            value={val}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            placeholder="Digite aqui..."
            className="w-full p-4 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl text-slate-700 font-medium outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
          />
        );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-6">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mx-auto" />
          <p className="text-slate-500 font-bold text-sm tracking-wide uppercase">Carregando Ficha de Entrada...</p>
        </div>
      </div>
    );
  }

  if (errorMsg && !submitted) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-6">
        <div className="bg-white rounded-[2.5rem] p-10 max-w-md w-full border border-slate-200 shadow-xl text-center space-y-6">
          <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-500 mx-auto shadow-sm">
            <AlertCircle className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-extrabold text-slate-900">Ops! Algo deu errado</h3>
            <p className="text-slate-500 font-medium text-sm leading-relaxed">{errorMsg}</p>
          </div>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-6">
        <div className="bg-white rounded-[3rem] p-10 sm:p-12 max-w-lg w-full border border-slate-200 shadow-xl text-center space-y-6 animate-in zoom-in-95 duration-500">
          <div className="w-20 h-20 bg-emerald-50 rounded-[2rem] flex items-center justify-center text-emerald-500 mx-auto shadow-inner animate-pulse">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <div className="space-y-3">
            <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight">Ficha Enviada!</h3>
            <p className="text-slate-500 text-lg leading-relaxed font-medium">
              Obrigado, <strong className="text-slate-700">{patientName}</strong>! Suas respostas foram salvas com sucesso e já estão vinculadas ao seu prontuário clínico.
            </p>
            <p className="text-slate-400 text-sm">Nos vemos em breve na Tzion Terapias. 💙</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] py-12 px-6">
      <div className="max-w-3xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="w-14 h-14 bg-indigo-600 rounded-3xl flex items-center justify-center shadow-lg shadow-indigo-100">
            <Heart className="w-8 h-8 text-white fill-white/20" />
          </div>
          <div className="space-y-1">
            <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">TZION TERAPIAS</h2>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Ficha de Anamnese</h1>
            <p className="text-slate-500 text-sm max-w-md mx-auto">
              Olá, <strong className="text-indigo-600">{patientName}</strong>. Por favor, preencha as informações abaixo para nos ajudar a planejar o seu tratamento.
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl p-8 sm:p-10 space-y-8">
          
          <div className="space-y-8">
            {template && template.fields && template.fields.length > 0 ? (
              // Dynamic Form Rendering
              template.fields.map((field: any, index: number) => (
                <section key={field.id} className="space-y-3">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-5 h-5 rounded-lg bg-indigo-50 text-indigo-600 font-extrabold flex items-center justify-center text-[9px]">{index + 1}</span>
                    {field.label} {field.required && <span className="text-rose-500">*</span>}
                  </label>
                  {renderFieldInput(field)}
                </section>
              ))
            ) : (
              // Legacy Fallback Form Rendering
              <>
                <section className="space-y-3">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-indigo-500" /> 1. Queixa Principal & Motivo da Busca *
                  </label>
                  <p className="text-xs text-slate-400 font-medium">O que te motivou a buscar terapia neste momento?</p>
                  <textarea 
                    required
                    value={complaint}
                    onChange={(e) => setComplaint(e.target.value)}
                    rows={5}
                    placeholder="Descreva aqui o motivo da sua consulta..."
                    className="w-full p-6 bg-slate-50 border border-slate-100 focus:border-indigo-500 focus:bg-white rounded-[2rem] text-slate-700 font-medium outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                  />
                </section>

                <section className="space-y-3">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Heart className="w-4 h-4 text-rose-500" /> 2. Histórico Familiar / Genograma
                  </label>
                  <p className="text-xs text-slate-400 font-medium">Existe algum histórico de doenças na família?</p>
                  <textarea 
                    value={familyHistory}
                    onChange={(e) => setFamilyHistory(e.target.value)}
                    rows={4}
                    placeholder="Descreva brevemente seu histórico familiar..."
                    className="w-full p-6 bg-slate-50 border border-slate-100 focus:border-indigo-500 focus:bg-white rounded-[2rem] text-slate-700 font-medium outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                  />
                </section>

                <section className="space-y-3">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-emerald-500" /> 3. Estilo de Vida & Hábitos
                  </label>
                  <p className="text-xs text-slate-400 font-medium">Como é sua rotina, sono, esportes ou vícios?</p>
                  <textarea 
                    value={lifestyle}
                    onChange={(e) => setLifestyle(e.target.value)}
                    rows={4}
                    placeholder="Ex: Durmo mal, bebo muito café..."
                    className="w-full p-6 bg-slate-50 border border-slate-100 focus:border-indigo-500 focus:bg-white rounded-[2rem] text-slate-700 font-medium outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                  />
                </section>
              </>
            )}
          </div>

          {/* Submit Action */}
          <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-xs text-slate-400 font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              Suas respostas são confidenciais e protegidas por sigilo ético.
            </span>
            <button 
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto px-10 py-5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-[1.5rem] shadow-xl shadow-indigo-100 hover:shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {saving ? (
                <>Enviando... <Loader2 className="w-5 h-5 animate-spin" /></>
              ) : (
                <>Enviar Ficha de Anamnese <Save className="w-5 h-5" /></>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
