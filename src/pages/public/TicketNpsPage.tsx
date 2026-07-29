import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/src/lib/supabase';
import { Star, Heart, Send, Frown, Meh, Smile, Loader2 } from 'lucide-react';
import { cn } from '@/src/lib/utils';

export default function TicketNpsPage() {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [alreadyVoted, setAlreadyVoted] = useState(false);
  const [success, setSuccess] = useState(false);
  
  const [patientId, setPatientId] = useState<string | null>(null);
  const [latestAppointmentId, setLatestAppointmentId] = useState<string | null>(null);

  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = "Avaliação de Atendimento | Tzion Terapias";
    let metaDescription = document.querySelector('meta[name="description"]');
    if (!metaDescription) {
      metaDescription = document.createElement('meta');
      metaDescription.setAttribute('name', 'description');
      document.head.appendChild(metaDescription);
    }
    metaDescription.setAttribute('content', 'Deixe seu feedback e avaliação sobre o atendimento recebido. Sua opinião ajuda a aprimorar nossos serviços.');
  }, []);

  useEffect(() => {
    async function loadData() {
      if (!id) {
        setError('ID do atendimento inválido.');
        setLoading(false);
        return;
      }

      try {
        // Verifica se o ticket existe
        const { data: ticketData, error: ticketError } = await supabase
          .from('service_tickets')
          .select('id, customer_phone')
          .eq('id', id)
          .maybeSingle();

        if (ticketError || !ticketData) {
          setError('Atendimento não encontrado ou link expirado.');
          setLoading(false);
          return;
        }

        // Tenta achar o paciente e o agendamento mais recente se houver
        let pid = null;
        let aid = null;
        if (ticketData.customer_phone) {
          const digitsPhone = ticketData.customer_phone.replace(/\D/g, '');
          const last8 = digitsPhone.slice(-8);
          
          if (last8) {
            const { data: pData } = await supabase
              .from('patients')
              .select('id')
              .like('phone', `%${last8}`)
              .limit(1)
              .maybeSingle();
              
            if (pData) {
              pid = pData.id;
              setPatientId(pData.id);
              
              const { data: aData } = await supabase
                .from('appointments')
                .select('id')
                .eq('patient_id', pData.id)
                .order('start_time', { ascending: false })
                .limit(1)
                .maybeSingle();
                
              if (aData) {
                aid = aData.id;
                setLatestAppointmentId(aData.id);
              }
            }
          }
        }

        // Verifica se já existe um feedback NPS nas últimas 2 horas para esse ticket
        // Como o nps_feedbacks não tem ticket_id, vamos checar pelo patient_id (se tiver)
        // Ou pelo appointment_id (se tiver). Mas na verdade, como não vinculamos ticket_id, 
        // a gente deixa o usuário votar.
      } catch (err) {
        console.error(err);
        setError('Erro ao carregar dados da avaliação.');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [id]);

  const handleSubmit = async () => {
    if (score === null) return;
    setSubmitting(true);
    try {
      const { error: insertError } = await supabase.from('nps_feedbacks').insert({
        patient_id: patientId,
        appointment_id: latestAppointmentId,
        score: score,
        comment: comment.trim() || null
      });

      if (insertError) throw insertError;
      setSuccess(true);
    } catch (err) {
      console.error(err);
      alert('Houve um erro ao enviar sua avaliação. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const getEmojiForScore = () => {
    if (score === null) return <Star className="w-16 h-16 text-indigo-200" />;
    if (score >= 9) return <Smile className="w-16 h-16 text-emerald-400" />;
    if (score >= 7) return <Meh className="w-16 h-16 text-amber-400" />;
    return <Frown className="w-16 h-16 text-rose-400" />;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center">
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 max-w-sm w-full">
           <Frown className="w-16 h-16 text-slate-300 mx-auto mb-4" />
           <h2 className="text-xl font-bold text-slate-900 mb-2">Ops!</h2>
           <p className="text-slate-500">{error}</p>
        </div>
      </div>
    );
  }

  if (alreadyVoted || success) {
    return (
      <div className="min-h-screen bg-emerald-50 flex items-center justify-center p-6 text-center animate-in fade-in zoom-in duration-500">
        <div className="bg-white p-10 rounded-[2.5rem] shadow-xl shadow-emerald-100/50 border border-emerald-100 max-w-sm w-full">
           <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
             <Heart className="w-10 h-10 text-emerald-500 fill-emerald-500" />
           </div>
           <h2 className="text-2xl font-black text-slate-900 mb-3">Muito Obrigado!</h2>
           <p className="text-slate-600 font-medium leading-relaxed">
             Sua avaliação é muito importante para continuarmos melhorando a qualidade dos nossos atendimentos na Tzion Terapias.
           </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 py-10 font-sans">
      <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="text-center mb-8">
           <h1 className="text-2xl font-black text-indigo-900 mb-2">Tzion Terapias</h1>
           <p className="text-slate-500 font-medium">Pesquisa de Satisfação</p>
        </div>

        <div className="bg-white p-8 sm:p-10 rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100">
          <div className="text-center mb-8 space-y-4">
             <div className="flex justify-center transition-all duration-300 transform scale-110">
               {getEmojiForScore()}
             </div>
             <h2 className="text-[22px] font-bold text-slate-900 leading-tight">
               Como foi seu atendimento conosco?
             </h2>
             <p className="text-sm text-slate-500 font-medium">
               De 0 a 10, o quanto você recomendaria nossos serviços para um amigo?
             </p>
          </div>

          <div className="flex flex-wrap justify-center gap-2 mb-8">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
              <button
                key={num}
                onClick={() => setScore(num)}
                className={cn(
                  "w-11 h-11 sm:w-12 sm:h-12 rounded-2xl font-black text-lg transition-all active:scale-95 border-2",
                  score === num 
                    ? num >= 9 ? "bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-200"
                      : num >= 7 ? "bg-amber-500 text-white border-amber-500 shadow-lg shadow-amber-200"
                      : "bg-rose-500 text-white border-rose-500 shadow-lg shadow-rose-200"
                    : "bg-white text-slate-400 border-slate-100 hover:border-slate-300 hover:text-slate-600"
                )}
              >
                {num}
              </button>
            ))}
          </div>

          <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-8 px-2">
             <span>0 - Jamais</span>
             <span>10 - Com certeza</span>
          </div>

          {score !== null && (
            <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
              <div className="space-y-2">
                 <label className="text-xs font-bold text-slate-700 uppercase tracking-widest ml-2">Deixe um comentário (opcional)</label>
                 <textarea
                   rows={3}
                   value={comment}
                   onChange={(e) => setComment(e.target.value)}
                   placeholder="O que motivou sua nota?"
                   className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 font-medium resize-none"
                 />
              </div>

              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-lg flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed shadow-xl shadow-indigo-100"
              >
                {submitting ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                  <>Enviar Avaliação <Send className="w-5 h-5" /></>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
