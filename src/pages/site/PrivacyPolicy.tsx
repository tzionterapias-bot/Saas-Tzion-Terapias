import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Shield, ArrowLeft } from 'lucide-react';
import { cn } from '@/src/lib/utils';

export default function PrivacyPolicy() {
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = 'Política de Privacidade | Tzion Terapias';
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
          
          {/* Header da Política */}
          <div className="bg-indigo-900 text-white p-10 md:p-14 relative overflow-hidden">
            <div className="relative z-10 space-y-4">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-indigo-800 rounded-xl mb-2">
                <Shield className="w-6 h-6 text-indigo-200" />
              </div>
              <h1 className="text-3xl md:text-5xl font-black tracking-tight">Política de Privacidade</h1>
              <p className="text-indigo-200 text-lg">Atualizada em {new Date().toLocaleDateString('pt-BR')}</p>
            </div>
            {/* Decoração bg */}
            <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-[80px]" />
          </div>

          {/* Texto da Política */}
          <div className="p-10 md:p-14 prose prose-slate prose-indigo max-w-none prose-headings:font-black prose-h2:text-2xl prose-a:text-indigo-600 hover:prose-a:text-indigo-500">
            <p className="lead text-lg text-slate-600 font-medium">
              A <strong>Tzion Terapias Integrativas</strong> valoriza a sua privacidade e se compromete a proteger os dados pessoais de todos os nossos pacientes e visitantes, em estrita conformidade com a Lei Geral de Proteção de Dados Pessoais (LGPD - Lei nº 13.709/2018) e com o Código de Ética Profissional do Psicólogo/Terapeuta.
            </p>
            <p>
              Esta Política de Privacidade descreve como coletamos, usamos, armazenamos e protegemos as suas informações quando você utiliza nosso site, nosso sistema de agendamento e nossos serviços clínicos (presenciais ou online).
            </p>

            <h2>1. Quais dados coletamos</h2>
            <p>Para fornecer nossos serviços com qualidade e segurança, coletamos as seguintes categorias de dados:</p>
            <ul>
              <li><strong>Dados de Identificação:</strong> Nome completo, CPF, RG, data de nascimento.</li>
              <li><strong>Dados de Contato:</strong> E-mail, número de telefone (WhatsApp) e endereço completo.</li>
              <li><strong>Dados Sensíveis (Saúde):</strong> Informações fornecidas durante as sessões, histórico médico, anamnese, relatos pessoais e avaliações psicológicas/terapêuticas. Estes dados formam o seu <strong>prontuário clínico</strong>.</li>
              <li><strong>Dados Financeiros:</strong> Informações necessárias para faturamento e processamento de pagamentos.</li>
              <li><strong>Dados de Navegação:</strong> Endereço IP, cookies e dados de uso do nosso site para melhorias de performance.</li>
            </ul>

            <h2>2. Finalidade do Uso dos Dados</h2>
            <p>Seus dados são utilizados única e exclusivamente para as seguintes finalidades:</p>
            <ul>
              <li>Realização e evolução do seu tratamento terapêutico (prontuário);</li>
              <li>Agendamento, confirmação e lembretes de sessões via WhatsApp ou E-mail;</li>
              <li>Emissão de recibos, notas fiscais e controle financeiro;</li>
              <li>Cumprimento de obrigações legais e regulatórias do Conselho de Classe.</li>
            </ul>

            <h2>3. Armazenamento e Segurança (Prontuários)</h2>
            <p>
              Os dados de saúde e prontuários clínicos (dados sensíveis) são armazenados em um sistema criptografado de alta segurança, com controle de acesso rigoroso. <strong>Somente o profissional responsável pelo seu atendimento tem acesso aos detalhes das suas sessões.</strong>
            </p>
            <p>
              De acordo com regulamentações profissionais, os prontuários físicos e eletrônicos são guardados pelo período mínimo obrigatório por lei (geralmente 5 anos após o término do tratamento), sendo descartados/apagados de forma segura após este prazo.
            </p>

            <h2>4. Compartilhamento de Dados</h2>
            <p>
              A Tzion Terapias <strong>não vende, não aluga e não compartilha</strong> seus dados pessoais com terceiros para fins publicitários. O compartilhamento só ocorre nos seguintes casos estritos:
            </p>
            <ul>
              <li>Com plataformas parceiras estritamente necessárias para a prestação do serviço (ex: gateways de pagamento, provedor de hospedagem na nuvem), que também estão sujeitas às regras da LGPD;</li>
              <li>Por determinação legal, ordem judicial ou requisição de autoridades competentes.</li>
            </ul>

            <h2>5. Direitos do Titular dos Dados</h2>
            <p>De acordo com a LGPD, você tem o direito de, a qualquer momento e mediante requisição:</p>
            <ul>
              <li>Confirmar a existência de tratamento de dados;</li>
              <li>Acessar os seus dados;</li>
              <li>Corrigir dados incompletos, inexatos ou desatualizados;</li>
              <li>Solicitar a anonimização, bloqueio ou eliminação de dados desnecessários (exceto aqueles cuja guarda seja obrigatória por lei ou regulamentação profissional);</li>
              <li>Revogar o seu consentimento.</li>
            </ul>

            <h2>6. Uso de Cookies</h2>
            <p>
              Nosso site utiliza cookies essenciais para garantir o funcionamento correto da plataforma e melhorar a sua experiência de navegação. Você pode desativá-los nas configurações do seu navegador, mas algumas funções do site podem ficar indisponíveis.
            </p>

            <h2>7. Atendimento Online</h2>
            <p>
              Se você realiza sessões online, utilizamos plataformas com criptografia ponta-a-ponta. Recomendamos que você realize as sessões em um ambiente seguro, privado e com fones de ouvido para garantir o sigilo do seu lado.
            </p>

            <h2>8. Contato do Encarregado de Dados (DPO)</h2>
            <p>
              Caso tenha qualquer dúvida sobre esta política ou queira exercer seus direitos em relação aos seus dados pessoais, entre em contato com nossa equipe de privacidade através do e-mail:
            </p>
            <p className="font-bold text-lg text-indigo-700">tzionterapias@gmail.com</p>
            <p>Responderemos sua solicitação dentro do prazo legal estipulado pela legislação vigente.</p>

          </div>
        </div>
      </main>
    </div>
  );
}
