import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FileText, ArrowLeft } from 'lucide-react';

export default function TermsOfUse() {
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = 'Termos de Uso | Tzion Terapias';
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans antialiased selection:bg-indigo-500 selection:text-white pb-20">
      
      {/* Header Simples */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-slate-200/80 h-20 flex items-center px-6 lg:px-20 justify-between shadow-xs">
        <Link to="/" className="flex items-center hover:opacity-80 transition-opacity">
          <img src="/logo.png" alt="Tzion Terapias Integrativas" className="h-11 object-contain" />
        </Link>
        <Link 
          to="/" 
          className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar ao site
        </Link>
      </nav>

      {/* Conteúdo Principal */}
      <main className="max-w-4xl mx-auto mt-12 px-6">
        <div className="bg-white rounded-[2rem] border border-slate-200/80 shadow-xl overflow-hidden">
          
          {/* Header dos Termos */}
          <div className="bg-slate-900 text-white p-10 md:p-14 relative overflow-hidden">
            <div className="relative z-10 space-y-4">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-slate-800 rounded-xl mb-2">
                <FileText className="w-6 h-6 text-slate-300" />
              </div>
              <h1 className="text-3xl md:text-5xl font-black tracking-tight">Termos de Uso</h1>
              <p className="text-slate-400 text-lg">Atualizado em {new Date().toLocaleDateString('pt-BR')}</p>
            </div>
            {/* Decoração bg */}
            <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 w-96 h-96 bg-slate-800/50 rounded-full blur-[80px]" />
          </div>

          {/* Texto dos Termos */}
          <div className="p-10 md:p-14 prose prose-slate prose-indigo max-w-none prose-headings:font-black prose-h2:text-2xl prose-a:text-indigo-600 hover:prose-a:text-indigo-500">
            <p className="lead text-lg text-slate-600 font-medium">
              Bem-vindo(a) à <strong>Tzion Terapias Integrativas</strong>. Ao utilizar nosso site, plataforma de agendamento e usufruir de nossos serviços terapêuticos (presenciais ou online), você concorda com as regras descritas nestes Termos de Uso.
            </p>

            <h2>1. Sobre os Serviços</h2>
            <p>
              A Tzion Terapias oferece serviços de psicologia, terapias integrativas, aconselhamento e saúde emocional. Os atendimentos são realizados por profissionais devidamente qualificados e capacitados.
            </p>
            <p>
              <strong>Aviso Importante:</strong> Em casos de emergência psiquiátrica ou risco iminente à vida, nossos serviços ambulatoriais/online podem não ser suficientes. Recomendamos que, nestas situações, busque atendimento de urgência ou ligue para o CVV (Centro de Valorização da Vida) no número 188.
            </p>

            <h2>2. Regras de Agendamento, Atrasos e Faltas</h2>
            <p>
              O compromisso com o horário agendado é fundamental para a eficácia do tratamento e respeito mútuo.
            </p>
            <ul>
              <li><strong>Atrasos:</strong> Em caso de atraso por parte do paciente, a sessão será encerrada no horário originalmente previsto, não havendo prorrogação ou desconto no valor da sessão.</li>
              <li><strong>Faltas e Cancelamentos:</strong> Cancelamentos ou reagendamentos devem ser informados com antecedência mínima de 24 horas. Faltas não justificadas ou cancelamentos em cima da hora poderão ser cobrados integralmente.</li>
            </ul>

            <h2>3. Atendimentos Online</h2>
            <p>Para pacientes na modalidade online, é de inteira responsabilidade do paciente:</p>
            <ul>
              <li>Garantir uma conexão de internet estável;</li>
              <li>Estar em um ambiente privado e silencioso no momento da sessão;</li>
              <li>O uso de fones de ouvido é fortemente recomendado para garantir a privacidade e qualidade do áudio.</li>
            </ul>

            <h2>4. Pagamentos e Planos</h2>
            <p>
              Os valores das sessões, pacotes terapêuticos e formas de pagamento serão previamente acordados no momento do agendamento ou contrato terapêutico. O não pagamento nas datas combinadas poderá acarretar a suspensão temporária dos atendimentos.
            </p>

            <h2>5. Materiais e Propriedade Intelectual</h2>
            <p>
              Todo o conteúdo disponibilizado pela Tzion Terapias (textos do site, e-books, materiais de apoio, planilhas e infográficos) são protegidos por direitos autorais. 
            </p>
            <p>
              É expressamente <strong>proibida</strong> a reprodução, distribuição, revenda ou uso comercial não autorizado de qualquer material adquirido ou fornecido gratuitamente pela nossa clínica.
            </p>

            <h2>6. Portal do Paciente</h2>
            <p>
              Caso a clínica disponibilize um Portal do Paciente (área logada), as credenciais de acesso (login e senha) são de uso pessoal e intransferível. O paciente é responsável por manter o sigilo de suas senhas.
            </p>

            <h2>7. Alterações nestes Termos</h2>
            <p>
              A Tzion Terapias reserva-se o direito de alterar estes Termos de Uso a qualquer momento, visando adaptações legais ou melhorias nos serviços. Recomendamos a leitura periódica desta página.
            </p>

            <h2>8. Contato</h2>
            <p>
              Ficou com alguma dúvida sobre nossos termos? Entre em contato diretamente com nossa equipe de atendimento via WhatsApp ou pelo e-mail:
            </p>
            <p className="font-bold text-lg text-indigo-700">tzionterapias@gmail.com</p>
          </div>
        </div>
      </main>
    </div>
  );
}
