const UNIDADES = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const DEZENAS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const CENTENAS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

export function numberToWords(n: number): string {
  if (!n || isNaN(n) || n <= 0) return 'zero';
  if (n === 100) return 'cem';
  if (n < 20) return UNIDADES[n];
  if (n < 100) {
    const d = Math.floor(n / 10);
    const u = n % 10;
    return u > 0 ? `${DEZENAS[d]} e ${UNIDADES[u]}` : DEZENAS[d];
  }
  if (n < 1000) {
    const c = Math.floor(n / 100);
    const rest = n % 100;
    return rest > 0 ? `${CENTENAS[c]} e ${numberToWords(rest)}` : CENTENAS[c];
  }
  if (n < 1000000) {
    const mil = Math.floor(n / 1000);
    const rest = n % 1000;
    const milStr = mil === 1 ? 'mil' : `${numberToWords(mil)} mil`;
    return rest > 0 ? `${milStr}${rest < 100 || rest % 100 === 0 ? ' e ' : ' '}${numberToWords(rest)}` : milStr;
  }
  return String(n);
}

export function moneyToWords(value: number): string {
  if (!value || isNaN(value) || value <= 0) return 'zero reais';
  const integerPart = Math.floor(value);
  const cents = Math.round((value - integerPart) * 100);

  let result = '';
  if (integerPart > 0) {
    const words = numberToWords(integerPart);
    result += `${words} ${integerPart === 1 ? 'real' : 'reais'}`;
  }

  if (cents > 0) {
    const centsWords = numberToWords(cents);
    if (result) result += ' e ';
    result += `${centsWords} ${cents === 1 ? 'centavo' : 'centavos'}`;
  }

  return result || 'zero reais';
}

export const DEFAULT_CONTRACT_TEMPLATE = `TERMO DE COMPROMISSO DE ATENDIMENTO TERAPÊUTICO  

Interagente: {{nome_paciente}}
Responsável(is): {{responsavel_nome}}

1. Das partes
As partes identificadas, de um lado a TZION TERAPIAS INTEGRATIVAS, com CNPJ 37.821.226/0001-63, com atendimento à Rua Princesa Isabel , Qd V Lt- 01 segundo andar -Setor Santa Helena, em Araguaína TO; neste ato representada pelo terapeuta Marcos Dany Teixeira Magalhães com registro profissional CRTH-BR 6793, inscrito no CPF Nº 011.533.991-48, e de outro lado o(a) Sr(a) {{nome_contratante}} com Identidade nº {{rg_paciente}} expedido por {{orgao_emissor_rg}} na data {{data_emissao_rg}} e CPF sob o número {{cpf_paciente}} firmam entre si o presente TERMO DE COMPROMISSO de Atendimento Terapêutico Integrativo, para o cliente {{nome_paciente}}.

2. Atendimento
Cada atendimento terapêutico terá a duração de 50 minutos em média, sendo realizado em horário combinado, na TZION TERAPIAS INTEGRATIVAS, com CNPJ 37.821.226/0001-63, com atendimento à Rua Princesa Isabel , Qd V Lt- 01 segundo andar -Setor Santa Helena, em Araguaína TO; neste ato representada pelo terapeuta Marcos Dany Teixeira Magalhães; pelo terapeuta: {{nome_terapeuta}} para a realização de terapias: {{nome_terapia}} sendo o mesmo habilitado, capacitado e portador de registro profissional emitido pela ABRATH, Associação Brasileira dos Terapeutas Holísticos; estando o terapeuta a disposição do cliente no período ajustado entre as partes. Não será possível estender o horário para além do previsto, mesmo em caso de atraso do cliente.

2. Sigilo
O terapeuta respeitará o sigilo profissional a fim de proteger, por meio da confiabilidade, a intimidade do paciente, grupos ou organizações, a que tenha acesso no exercício profissional. 

3. Duração da Terapia
A duração do programa terapêutico será de {{quantidade_sessoes}} sessões, com foco na demanda estabelecida na consulta de avaliação e anamnese; podendo se estender por mais {{extensao_sessoes}} sessões, sem ônus para o cliente. Concluído o processo, uma nova demanda, exigirá uma nova consulta e um novo pacote de atendimento terapêutico.

4. Dia e Horário
Os dias e horário dos atendimentos serão acordado entre as partes. As sessões ajustadas em pacote, poderão ser agendadas, mensalmente; e a cada sessão para as sessões individuais.

5. Honorários
O pacote ajustado são de {{quantidade_sessoes}} ({{quantidade_sessoes_extenso}}) sessões no valor total de {{valor_total}} ({{valor_total_extenso}}). O pagamento será feito em dinheiro, cartão de crédito ou débito, ou transferência bancária; pagos no ato da contratação dos serviços terapêuticos. 

6. Desmarcações ou mudanças de horário
As desmarcações deverão ser feitas com antecedência de, no mínimo de 3 horas. O terapeuta deverá ser avisado no caso de imprevistos que impeçam o comparecimento do cliente. Mudanças de horário só serão possíveis quando houver disponibilidade em agenda. As sessões não comparecidas, e não justificadas em tempo hábil, serão consideradas, realizadas. 

7. Faltas
Sessões em que o cliente não comparecer serão cobradas normalmente. A partir de três (03) faltas consecutivas, sem aviso, durante o tratamento, o atendimento será considerado interrompido e o cliente poderá perder sua vaga preferencial de horário.

8. Das Sessões On-Line 
As Sessões online acontecem pelas plataformas MEET . A secretária fará o teste antecipado para teste de conexão e acesso. Será respeitado o horário established para o atendimento. O equipamento (celular, tablet ou outros) deverá estar carregado e com condições de suportar a videoconferência durante toda a sessão. O cliente deverá estar em um ambiente que lhe proporcione absoluta privacidade, tranquilidade e silêncio e, em hipótese nenhuma, poderá haver interrupções seja por pessoas, crianças, animais ou nada que não permita a concentração. Em caso de uso de tablet ou celular, o cliente deverá prover um suporte a fim de que suas mãos estejam livres para os procedimentos terapêuticos. 

9. Transferência de Titularidade no Atendimento Terapêutico
O Atendimento Terapêutico programado é pessoal e intransferível. Em hipótese alguma será permitido a transferência de um pacote pago a uma outra pessoa; 
Excetua-se o caso de Terapia de Casais, que, havendo necessidade, podem trocar sessões de atendimento entre os mesmos (no caso dos atendimentos individuais); 

10. O controle de Atendimento Terapêutico 
Para o atendimento presencial, O Controle de Atendimento Terapêutico, devidamente assinado, é parte integrante deste termo de compromisso. Nos atendimentos ON-LINE, uma mensagem de confirmação enviada por email ou whatsapp servirá como comprovação da realização da sessão; 

11. Terapia com menores
As terapias com menores, somente serão realizados com o devido acompanhamento dos pais ou de uma pessoa responsável; que após o atendimento receberão a devolutiva do acompanhamento ou terapia aplicados. 

12. Quanto a acompanhamento psiquiátrico e medicação 
O acompanhamento terapêutico não substitui acompanhamento psiquiátrico e nem a administração medicamentosa administrada sob orientação médica. A suspensão ou uso irregular ou indevido da medicação por deliberação espontânea do paciente, não configura responsabilidade do terapeuta sob nenhuma hipótese. 

13. Do resultado Proposto
Nem o Contratante pode exigir e nem o Contratado pode garantir que o tratamento tenha 100% (cem por cento) de eficácia. Esta possibilidade poderá acontecer, todavia ela é imprevisível, pois depende das ferramentas aplicadas pelo terapeuta e do comportamento e atitudes de mudança da pessoa terapeutizada; portanto o resultado transcende a responsabilidade exclusiva do terapeuta, uma vez que ele é apenas a parte orientadora do processo; 

14. Das devoluções de valores: 
Em casos de insatisfação quanto às consultas e sessões e possíveis devoluções de valores, fica established que será necessário manifestação das partes até a SEGUNDA SESSÃO TERAPÊUTICA, descontados os respectivos custos operacionais referentes a despesas operacionais, taxa da máquina de cartão de crédito e/ou débito, locação de salas e demais despesas adicionais constantes do acordo firmado anteriormente.

Em casos de pacote(es) ou programa(as) os atendimentos individuais ou de casais, em que restem acordados valores fixos, independentemente da quantidade de sessões, o profissional terapêutico se compromete a concluir a demanda do cliente sem acréscimos de valores futuros, porém será imprescindível a conclusão outrora acordado do pacote ou programa solicitado pelo(os) interagente(es).

15. De demandas e desacordos
As partes aqui qualificadas, de comum acordo, decidem desde agora que toda e qualquer controvérsia que venha a existir em relação à execução do presente Termo de Compromisso, será decidida pelo Sistema de Arbitragem nos termos da Lei Federal 13.129/15, em seu artigo primeiro e segundo, o rito processual será por equidade, artigo 21, parágrafo terceiro no que tange a representação, sem a necessidade de postular através de advogado, desta forma aplica-se integralmente o que dispõe a Lei.

	Caberá ao Demandante informar a abertura da demanda ao Tribunal de Arbitragem da ABRATH, entidade especializada para processar e julgar a causa, observando sempre que a sentença será prolatada pelos meios que este sistema provir.

Após a demanda ser acolhida, a Abrath indicará um Juiz Arbitral, devidamente qualificado e treinado entre seus filiados para arbitrar a demanda.

16. Dos órgãos de arbitragem 
As partes elegem de comum acordo o Sistema de Arbitragem, mais precisamente o Tribunal de Arbitragem da Abrath, abrindo mão do Órgão do Poder Judiciário ou Serviços de Proteção ao Consumidor como Procon, DECOM, Delegacias ou afins, ao qual caberia originariamente processar e julgar a causa.

E por estarem justas e contratadas as partes, assinam o presente instrumento particular em duas vias de igual teor.

Araguaína - TO, {{data_atual}}`;

export function fillContractTemplate(template: string, data: {
  patient?: any;
  package?: any;
  therapist?: any;
}) {
  const patient = data.patient || {};
  const pkg = data.package || {};
  const therapist = data.therapist || {};

  const today = new Date();
  const dateFormatted = today.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });

  const totalSessions = pkg?.total_sessions || pkg?.sessions || 1;
  const extraSessions = pkg?.extension_sessions || pkg?.bonus_sessions || 0;
  const priceVal = Number(pkg?.price || pkg?.total_price || pkg?.value || 0);
  const priceFormatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(priceVal);

  const replacements: Record<string, string> = {
    '{{nome_paciente}}': patient.name || '____________________',
    '{{interagente}}': patient.name || '____________________',
    '{{cpf_paciente}}': patient.cpf || '____________________',
    '{{cpf}}': patient.cpf || '____________________',
    '{{rg_paciente}}': patient.rg || '____________________',
    '{{rg}}': patient.rg || '____________________',
    '{{orgao_emissor_rg}}': patient.rg_issuer || 'SSP',
    '{{data_emissao_rg}}': patient.rg_issue_date ? new Date(patient.rg_issue_date).toLocaleDateString('pt-BR') : '____/____/________',
    '{{profissao}}': patient.profession || '____________________',
    '{{estado_civil}}': patient.marital_status || '____________________',
    '{{endereco_completo}}': [patient.address, patient.address_number, patient.neighborhood, patient.city, patient.state].filter(Boolean).join(', ') || '____________________',
    '{{telefone_paciente}}': patient.phone || '____________________',

    '{{responsavel_nome}}': patient.guardian_name || patient.name || '____________________',
    '{{responsavel_cpf}}': patient.guardian_cpf || patient.cpf || '____________________',
    '{{nome_contratante}}': patient.guardian_name || patient.name || '____________________',

    '{{nome_terapeuta}}': therapist.name || pkg.therapist_name || 'Marcos Dany Teixeira Magalhães',
    '{{registro_terapeuta}}': therapist.professional_registration || 'CRTH-BR 6793',
    '{{nome_terapia}}': pkg.service_name || pkg.services?.name || pkg.title || 'Terapias Integrativas',

    '{{quantidade_sessoes}}': String(totalSessions),
    '{{quantidade_sessoes_extenso}}': numberToWords(totalSessions),
    '{{extensao_sessoes}}': String(extraSessions),
    '{{valor_total}}': priceFormatted,
    '{{valor_total_extenso}}': moneyToWords(priceVal),

    '{{data_atual}}': dateFormatted,
  };

  let result = template || DEFAULT_CONTRACT_TEMPLATE;
  for (const [key, val] of Object.entries(replacements)) {
    const regex = new RegExp(key.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g');
    result = result.replace(regex, val);
  }

  // Also replace any legacy single variable placeholders
  result = result
    .replace(/\{\{nome\}\}/g, patient.name || '')
    .replace(/\{\{data\}\}/g, dateFormatted);

  return result;
}
