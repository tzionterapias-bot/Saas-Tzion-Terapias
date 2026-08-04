import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calendar, Heart, Shield, Clock, MessageCircle, MapPin, Phone, Instagram, Facebook, 
  Users, Globe, BookOpen, ChevronRight, ChevronLeft, CheckCircle2, Star, ChevronDown, Sparkles, 
  ArrowRight, ShieldCheck, UserCheck, Zap, Lock, Headphones, Building, Briefcase
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/src/lib/supabase';
import CheckoutModal from '@/src/components/checkout/CheckoutModal';
import { cn } from '@/src/lib/utils';

// ─── Icon Map ──────────────────────────────────────────────────────────────────
const IconMap: Record<string, React.ComponentType<any>> = {
  Heart, Users, Shield, MessageCircle, Clock, Calendar, Globe, Sparkles, ShieldCheck, UserCheck, Zap, Lock, Headphones, Building, Briefcase
};

function ServiceIcon({ name, className }: { name: string; className?: string }) {
  const Icon = IconMap[name] || Heart;
  return <Icon className={className || "w-6 h-6"} />;
}

function TzionLogo({ isDark = false, className = "h-11" }: { isDark?: boolean; className?: string }) {
  return (
    <div className="flex items-center gap-3 group">
      <img 
        src={isDark ? "/logo-rodape.png" : "/logo.png"} 
        alt="Tzion Terapias Integrativas" 
        className={cn(className, "object-contain transition-transform group-hover:scale-105")} 
      />
    </div>
  );
}

// ─── Default Content ───────────────────────────────────────────────────────────
const DEFAULT: any = {
  nav: { 
    clinicName: 'TZION TERAPIAS', 
    logoUrl: '/tzion-logo.svg', 
    ctaLabel: 'Agendar no WhatsApp', 
    ctaColor: '#059669' 
  },
  hero: {
    badge: '🌿 Atendimento Presencial em Araguaína - TO & Online',
    title: 'Cuidado integral para uma',
    titleHighlight: 'vida equilibrada & sem dor.',
    subtitle: 'A Tzion Terapias oferece um ambiente acolhedor e seguro para sua jornada de autoconhecimento, cura emocional e desenvolvimento pessoal.',
    ctaPrimary: 'Agendar Consulta no WhatsApp',
    ctaSecondary: 'Conhecer Especialidades',
    stat: '+500',
    statLabel: 'Pacientes acolhidos',
    stat2: '5.0/5.0',
    statLabel2: 'Avaliação no Google ⭐',
    imageUrl: '/recepcao.jpg',
  },
  services: [
    { id: 's1', icon: 'Heart', category: 'Individual', title: 'Terapia Individual', desc: 'Acompanhamento focado no autoconhecimento, superação de traumas e fortalecimento da saúde mental.', duration: '50 min' },
    { id: 's2', icon: 'Users', category: 'Casal', title: 'Terapia de Casal', desc: 'Mediação profissional para resgatar a comunicação, cumplicidade e resolver conflitos do relacionamento.', duration: '50 min' },
    { id: 's3', icon: 'Shield', category: 'Infantil', title: 'Terapia Infantil e Adolescentes', desc: 'Atendimentos lúdicos para o desenvolvimento emocional saudável de crianças e jovens.', duration: '50 min' },
    { id: 's4', icon: 'MessageCircle', category: 'Família', title: 'Terapia Familiar', desc: 'Harmonização do ambiente familiar e aperfeiçoamento da convivência entre pais e filhos.', duration: '60 min' },
    { id: 's5', icon: 'Clock', category: 'Ansiedade', title: 'Ansiedade & Stress', desc: 'Estratégias práticas e técnicas corporais/cognitivas para aliviar a pressão e ter paz de espírito.', duration: '50 min' },
    { id: 's6', icon: 'Building', category: 'Empresarial', title: 'Treinamentos Empresariais & Palestras', desc: 'Desenvolvimento de saúde emocional para equipes, prevenção de Burnout e palestras corporativas de alta performance.', duration: 'Sob Consulta' },
  ],
  team: { 
    enabled: true, 
    title: 'Nossos Terapeutas', 
    subtitle: 'Profissionais experientes, acolhedores e comprometidos com a sua transformação.', 
    members: [
      {
        id: 't1',
        name: 'Jhonantan de Santana Bezerra',
        role: 'Terapeuta Integrativo',
        bio: 'Especialista em saúde emocional, equilíbrio mente-corpo e processos de cura integrativa.',
        photoUrl: ''
      },
      {
        id: 't2',
        name: 'Marcos',
        role: 'Terapeuta Clínico & Gestor',
        bio: 'Especializado em atendimentos presenciais e online focados em libertação emocional e bem-estar.',
        photoUrl: ''
      }
    ] 
  },
  cta: {
    title: 'Dê o primeiro passo para a sua cura emocional hoje.',
    subtitle: 'Nossa equipe está pronta no WhatsApp para entender sua necessidade e agendar o seu atendimento com total privacidade.',
    ctaLabel: 'Falar com Atendimento no WhatsApp',
    whatsappNumber: '5563992530004',
    whatsappLabel: 'Chamar no WhatsApp',
    bgColor: '#4f46e5',
  },
  products: {
    enabled: true,
    sectionTitle: 'Materiais Exclusivos e E-books',
    items: [
      {
        id: 'p1',
        title: 'E-book: Desperte seu Potencial Emocional',
        description: 'Desenvolva inteligência emocional, supere bloqueios do passado e construa relacionamentos saudáveis com este guia prático.',
        price: 97,
        originalPrice: 197.90,
        coverUrl: '',
        badge: 'Lançamento Exclusivo'
      }
    ]
  },
  faq: [
    {
      q: 'Como funciona o primeiro atendimento?',
      a: 'No primeiro contato fazemos uma consulta avaliativa acolhedora para compreender o seu momento, tirar todas as suas dúvidas e definir o plano terapêutico mais adequado para você.'
    },
    {
      q: 'O atendimento online é tão eficaz quanto o presencial?',
      a: 'Sim! As sessões online possuem a mesma eficácia científica, ocorrem via videochamada segura e oferecem a conveniência de você realizar a terapia no conforto e privacidade de sua casa.'
    },
    {
      q: 'Onde fica localizado o consultório presencial?',
      a: 'Nosso espaço fica na Rua Princesa Isabel, esquina com Rua Capibaribe, em Araguaína - TO. Um ambiente planejado para garantir total conforto, silêncio e acolhimento.'
    },
    {
      q: 'Como é garantido o sigilo das sessões?',
      a: 'Todas as informações conversadas em sessão são estritamente confidenciais, respaldadas pelo Código de Ética Profissional e com proteção total aos seus dados.'
    },
    {
      q: 'Como faço para agendar um horário?',
      a: 'É super simples! Basta clicar em qualquer botão de agendamento do site e você será direcionado para o nosso WhatsApp oficial, onde nossa equipe informará os horários disponíveis.'
    }
  ],
  testimonials: [
    {
      name: 'Carla M.',
      role: 'Paciente de Terapia Individual',
      text: 'Encontrei na Tzion Terapias o acolhimento que precisava em um momento de muita ansiedade. As sessões mudaram minha forma de lidar com a vida.',
      stars: 5
    },
    {
      name: 'Lucas & Fernanda',
      role: 'Pacientes de Terapia de Casal',
      text: 'A terapia de casal foi o divisor de águas no nosso casamento. Conseguimos resgatar o diálogo e o respeito. Recomendamos de olhos fechados!',
      stars: 5
    },
    {
      name: 'Roberto S.',
      role: 'Paciente Atendimento Online',
      text: 'Faço atendimento online estando em outra cidade e o cuidado é exatamente o mesmo. Profissionais extremamente humanos e preparados.',
      stars: 5
    },
    {
      name: 'Juliana V.',
      role: 'Paciente de Gestão do Estresse',
      text: 'Ambiente espetacular em Araguaína e terapeutas muito atenciosos. Consegui superar a sobrecarga de trabalho com as técnicas aplicadas.',
      stars: 5
    },
    {
      name: 'Marcelo T.',
      role: 'Gestor de Recursos Humanos',
      text: 'Contratamos o workshop da Tzion Terapias para nossa equipe e o resultado foi incrível! Conteúdo prático sobre saúde mental no trabalho.',
      stars: 5
    },
    {
      name: 'Patrícia G.',
      role: 'Mãe de Paciente Infantil',
      text: 'O atendimento com minha filha foi extremamente profissional e carinhoso. Notamos uma evolução extraordinária no desenvolvimento dela.',
      stars: 5
    }
  ],
  footer: {
    about: 'Tzion Terapias é uma clínica dedicada à promoção da saúde emocional e do bem-estar através de atendimentos humanizados, éticos e especializados.',
    address: 'Rua Princesa Isabel, esquina com Rua Capibaribe',
    city: 'Araguaína - TO',
    phone: '(63) 99253-0004',
    email: 'tzionterapias@gmail.com',
    instagram: '@tzionterapias',
    facebook: '#',
    copyright: '© 2026 Tzion Terapias. Todos os direitos reservados.',
  },
};

export default function InstitutionalSite() {
  const [site, setSite] = useState<any>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('Todas');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [selectedProduct, setSelectedProduct] = useState<{title: string, price: number, downloadUrl?: string} | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [expandedBioId, setExpandedBioId] = useState<string | null>(null);
  const [expandedProdId, setExpandedProdId] = useState<string | null>(null);

  useEffect(() => {
    async function loadSite() {
      try {
        const { data } = await supabase.from('settings').select('value').eq('key', 'site_content').maybeSingle();
        if (data?.value) {
          setSite((prev: any) => ({
            ...DEFAULT,
            ...data.value,
            nav: { ...DEFAULT.nav, ...data.value.nav },
            hero: { 
              ...DEFAULT.hero, 
              ...data.value.hero,
              stat2: '5.0/5.0',
              statLabel2: 'Avaliação no Google ⭐'
            },
            team: { 
              ...DEFAULT.team, 
              ...data.value.team,
              members: data.value.team?.members?.length ? data.value.team.members : DEFAULT.team.members
            },
            cta: { ...DEFAULT.cta, ...data.value.cta },
            products: { 
              ...DEFAULT.products, 
              ...(data.value.products || {}),
              items: data.value.products?.items?.length ? data.value.products.items : DEFAULT.products.items
            },
            footer: { ...DEFAULT.footer, ...data.value.footer },
            services: data.value.services?.length ? data.value.services : DEFAULT.services,
            faq: data.value.faq?.length ? data.value.faq : DEFAULT.faq,
            testimonials: data.value.testimonials?.length ? data.value.testimonials : DEFAULT.testimonials
          }));
        }
      } catch (_) {
      } finally {
        setLoading(false);
      }
    }
    loadSite();
  }, []);

  const { nav, hero, services, team, products, cta, footer, faq, testimonials } = site;

  const getWhatsAppUrl = (customText?: string) => {
    const phone = (cta?.whatsappNumber || footer?.phone || '5563992530004').replace(/\D/g, '');
    const cleanPhone = phone.length > 0 ? (phone.startsWith('55') ? phone : `55${phone}`) : '5563992530004';
    const message = customText || 'Olá! Gostaria de agendar uma consulta na Tzion Terapias.';
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  };

  const categories = useMemo(() => {
    const set = new Set<string>();
    set.add('Todas');
    (services || []).forEach((s: any) => {
      if (s.category) set.add(s.category);
    });
    return Array.from(set);
  }, [services]);

  const filteredServices = useMemo(() => {
    if (activeCategory === 'Todas') return services;
    return (services || []).filter((s: any) => s.category === activeCategory);
  }, [services, activeCategory]);

  useEffect(() => {
    document.title = `${nav?.clinicName || 'Tzion Terapias'} | Cuidado Integral & Saúde Mental`;
  }, [nav]);

  return (
    <div className="bg-slate-50 text-slate-800 font-sans antialiased overflow-x-hidden selection:bg-indigo-500 selection:text-white">
      
      {/* ─── Top Announcement Bar ────────────────────────────────────────────── */}
      <div className="bg-indigo-900 text-white text-xs font-semibold py-2.5 px-4 text-center border-b border-indigo-800 flex items-center justify-center gap-3">
        <span className="inline-flex items-center gap-1.5 bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-400/30">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          Atendimento Presencial em Araguaína - TO & Online
        </span>
        <span className="hidden md:inline text-indigo-200">•</span>
        <a 
          href={getWhatsAppUrl()} 
          target="_blank" 
          rel="noreferrer" 
          className="hover:underline flex items-center gap-1 text-indigo-100 font-bold"
        >
          <MessageCircle className="w-3.5 h-3.5 text-emerald-400" /> WhatsApp: (63) 99253-0004
        </a>
      </div>

      {/* ─── Navigation Header ────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-slate-200/80 h-20 flex items-center px-6 lg:px-20 justify-between shadow-xs">
        <Link to="/" className="flex items-center">
          <TzionLogo isDark={false} className="h-11" />
        </Link>

        <div className="hidden lg:flex items-center gap-8 text-sm font-semibold text-slate-600">
          <a href="#inicio" className="hover:text-indigo-600 transition-colors">Início</a>
          <a href="#como-funciona" className="hover:text-indigo-600 transition-colors">Como Funciona</a>
          <a href="#especialidades" className="hover:text-indigo-600 transition-colors">Especialidades</a>
          <a href="#diferenciais" className="hover:text-indigo-600 transition-colors">Diferenciais</a>
          {team?.enabled && <a href="#equipe" className="hover:text-indigo-600 transition-colors">Equipe</a>}
          <a href="#faq" className="hover:text-indigo-600 transition-colors">Dúvidas</a>
          <a href="#contato" className="hover:text-indigo-600 transition-colors">Contato</a>
          <div className="h-6 w-px bg-slate-200" />
          <Link to="/login" className="hover:text-indigo-600 font-bold text-slate-500">Portal Equipe</Link>
          <a
            href={getWhatsAppUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-2.5 text-white rounded-full font-bold text-sm bg-emerald-600 hover:bg-emerald-500 transition-all shadow-md shadow-emerald-600/20 hover:scale-105 flex items-center gap-2"
          >
            <MessageCircle className="w-4 h-4 fill-white/20" /> {nav.ctaLabel || 'Agendar no WhatsApp'}
          </a>
        </div>
      </nav>

      {/* ─── Hero Section ─────────────────────────────────────────────────────── */}
      <section id="inicio" className="relative pt-16 pb-24 px-6 lg:px-20 bg-gradient-to-b from-indigo-50/70 via-slate-50 to-white overflow-hidden">
        {/* Soft Decorative Glows */}
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-indigo-200/30 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute bottom-0 right-10 w-[400px] h-[400px] bg-emerald-200/20 rounded-full blur-[120px] pointer-events-none" />

        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-16 relative z-10">
          <div className="lg:w-7/12 space-y-8 text-center lg:text-left">
            
            <div className="inline-flex items-center gap-2.5 px-4 py-2 bg-white border border-slate-200 rounded-full text-xs font-bold text-indigo-700 shadow-xs">
              <Sparkles className="w-4 h-4 text-indigo-600 animate-spin-slow" />
              <span>{hero.badge}</span>
            </div>

            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.08] text-slate-900">
              {hero.title} <br className="hidden sm:inline" />
              <span className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-teal-600 bg-clip-text text-transparent">
                {hero.titleHighlight}
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-slate-600 leading-relaxed max-w-2xl font-normal mx-auto lg:mx-0">
              {hero.subtitle}
            </p>

            <div className="flex flex-col sm:flex-row gap-4 pt-2 justify-center lg:justify-start">
              <a
                href={getWhatsAppUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold text-lg transition-all shadow-lg shadow-emerald-600/20 hover:scale-[1.02] flex items-center justify-center gap-3 group"
              >
                <MessageCircle className="w-6 h-6 group-hover:rotate-12 transition-transform" />
                {hero.ctaPrimary}
              </a>
              <a
                href="#especialidades"
                className="px-8 py-4 bg-white text-slate-800 border border-slate-200 hover:border-slate-300 rounded-2xl font-bold text-lg transition-all text-center flex items-center justify-center gap-2 shadow-xs hover:bg-slate-50"
              >
                {hero.ctaSecondary} <ArrowRight className="w-5 h-5" />
              </a>
            </div>

            {/* Metrics Trust Badges */}
            <div className="pt-8 border-t border-slate-200/80 grid grid-cols-3 gap-6 text-center lg:text-left max-w-xl mx-auto lg:mx-0">
              <div>
                <p className="text-3xl sm:text-4xl font-black text-slate-900">{hero.stat}</p>
                <p className="text-xs text-slate-500 font-semibold mt-1">{hero.statLabel}</p>
              </div>
              <div className="border-x border-slate-200 px-4">
                <p className="text-3xl sm:text-4xl font-black text-amber-500 flex items-center justify-center lg:justify-start gap-1">
                  <Star className="w-6 h-6 fill-amber-400 text-amber-400 inline" /> 5.0/5.0
                </p>
                <p className="text-xs text-slate-500 font-semibold mt-1">Avaliação no Google ⭐</p>
              </div>
              <div>
                <p className="text-3xl sm:text-4xl font-black text-emerald-600">100%</p>
                <p className="text-xs text-slate-500 font-semibold mt-1">Sigilo & Ética</p>
              </div>
            </div>

          </div>

          {/* Hero Visual Showcase */}
          <div className="lg:w-5/12 w-full relative">
            <div className="relative mx-auto max-w-md lg:max-w-none">
              <div className="absolute -inset-1 bg-gradient-to-r from-indigo-300 to-emerald-300 rounded-[2.5rem] blur-xl opacity-40"></div>
              
              <div className="relative bg-white border border-slate-200/80 rounded-[2.5rem] p-4 shadow-2xl space-y-4">
                <img
                  src={hero.imageUrl && !hero.imageUrl.includes('unsplash') ? hero.imageUrl : '/recepcao.jpg'}
                  className="rounded-2xl h-80 w-full object-cover shadow-md border border-slate-100"
                  alt="Recepção acolhedora da clínica Tzion Terapias em Araguaína - TO"
                />
                
                {/* Floating Card Overlay 1 */}
                <div className="bg-slate-50/95 backdrop-blur-md p-4 rounded-2xl border border-slate-200/80 shadow-md flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">Espaço Seguro e Acolhedor</h4>
                    <p className="text-xs text-slate-500">Sessões individuais adaptadas para cada paciente.</p>
                  </div>
                </div>

                {/* Floating Card Overlay 2 */}
                <div className="bg-slate-50/95 backdrop-blur-md p-4 rounded-2xl border border-slate-200/80 shadow-md flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700 shrink-0">
                    <Globe className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">Presencial & Online</h4>
                    <p className="text-xs text-slate-500">Atendimento em Araguaína - TO ou de onde você estiver.</p>
                  </div>
                </div>

              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ─── Como Funciona (Step by Step) ─────────────────────────────────────── */}
      <section id="como-funciona" className="py-24 px-6 lg:px-20 bg-white relative border-t border-slate-100">
        <div className="max-w-7xl mx-auto space-y-16">
          <div className="text-center space-y-4 max-w-3xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-widest text-indigo-700 bg-indigo-50 border border-indigo-100 px-3.5 py-1.5 rounded-full">
              Jornada Simplificada
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight">
              Como funciona o seu atendimento
            </h2>
            <p className="text-slate-600 text-lg">
              Em apenas 4 passos você inicia sua caminhada de cura e equilíbrio emocional com facilidade.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 relative">
            {[
              {
                step: '01',
                title: 'Contato no WhatsApp',
                desc: 'Clique em qualquer botão e envie uma mensagem rápida para nossa equipe de triagem.',
                icon: MessageCircle,
                color: 'bg-emerald-50 border-emerald-100 text-emerald-700'
              },
              {
                step: '02',
                title: 'Entendimento da Demanda',
                desc: 'Conversamos sobre suas necessidades para direcionar ao melhor terapeuta e modalidade.',
                icon: UserCheck,
                color: 'bg-indigo-50 border-indigo-100 text-indigo-700'
              },
              {
                step: '03',
                title: 'Agendamento Flexível',
                desc: 'Escolhemos o dia e horário ideais para sua sessão (Presencial em Araguaína ou Online).',
                icon: Calendar,
                color: 'bg-teal-50 border-teal-100 text-teal-700'
              },
              {
                step: '04',
                title: 'Início da Terapia',
                desc: 'Sua primeira consulta ocorre em ambiente seguro, acolhedor e com total sigilo.',
                icon: Heart,
                color: 'bg-purple-50 border-purple-100 text-purple-700'
              }
            ].map((st, i) => (
              <div 
                key={i} 
                className="relative bg-slate-50 border border-slate-200/70 rounded-3xl p-8 hover:bg-white hover:border-indigo-200 hover:shadow-xl transition-all group hover:-translate-y-2 duration-300"
              >
                <div className="flex items-center justify-between mb-8">
                  <div className={`w-14 h-14 rounded-2xl ${st.color} border flex items-center justify-center shadow-xs`}>
                    <st.icon className="w-7 h-7" />
                  </div>
                  <span className="text-4xl font-black text-slate-300 group-hover:text-indigo-600 transition-colors">
                    {st.step}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">{st.title}</h3>
                <p className="text-slate-600 text-sm leading-relaxed">{st.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Nossas Especialidades ─────────────────────────────────────────────── */}
      <section id="especialidades" className="py-24 px-6 lg:px-20 bg-slate-50 relative border-t border-slate-100">
        <div className="max-w-7xl mx-auto space-y-12">
          
          <div className="text-center space-y-4 max-w-3xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-800 bg-emerald-50 border border-emerald-200 px-3.5 py-1.5 rounded-full">
              Atendimento Especializado
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight">
              Especialidades Terapêuticas
            </h2>
            <p className="text-slate-600 text-lg">
              Escolha a modalidade ideal para o seu momento de vida. Atendimentos personalizados para cada demanda.
            </p>
          </div>

          {/* Category Filter Tabs */}
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-5 py-2.5 rounded-full text-xs font-bold transition-all border ${
                  activeCategory === cat
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20 scale-105'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:text-slate-900'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Service Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredServices.map((s: any, i: number) => (
              <div 
                key={s.id || i} 
                className="group bg-white border border-slate-200/80 hover:border-indigo-300 rounded-3xl p-8 flex flex-col justify-between shadow-sm hover:shadow-2xl transition-all duration-300"
              >
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 group-hover:scale-110 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                      <ServiceIcon name={s.icon} className="w-7 h-7" />
                    </div>
                    {s.duration && (
                      <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
                        ⏱️ {s.duration}
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className="text-2xl font-bold text-slate-900 group-hover:text-indigo-600 transition-colors mb-3">
                      {s.title}
                    </h3>
                    <p className="text-slate-600 text-sm leading-relaxed">
                      {s.desc}
                    </p>
                  </div>
                </div>

                <div className="pt-8 mt-6 border-t border-slate-100">
                  <a
                    href={getWhatsAppUrl(`Olá! Gostaria de informações para agendar a ${s.title}.`)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 px-4 bg-slate-100 hover:bg-emerald-600 text-slate-700 hover:text-white rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 group-hover:shadow-md"
                  >
                    <MessageCircle className="w-4 h-4 text-emerald-600 group-hover:text-white" /> 
                    Agendar esta Especialidade
                  </a>
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ─── Diferenciais Tzion ───────────────────────────────────────────────── */}
      <section id="diferenciais" className="py-24 px-6 lg:px-20 bg-white border-t border-slate-100">
        <div className="max-w-7xl mx-auto space-y-16">
          <div className="text-center space-y-4 max-w-3xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-widest text-teal-800 bg-teal-50 border border-teal-200 px-3.5 py-1.5 rounded-full">
              Excelência Terapêutica
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight">
              Por que escolher a Tzion Terapias?
            </h2>
            <p className="text-slate-600 text-lg">
              Nosso compromisso é proporcionar um atendimento seguro, acolhedor e altamente eficaz para o seu bem-estar.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                icon: Heart,
                title: 'Acolhimento Sem Julgamentos',
                desc: 'Escuta ativa e empática onde suas dores emocionais são respeitadas com carinho e seriedade.'
              },
              {
                icon: Lock,
                title: 'Sigilo Profissional Absoluto',
                desc: 'Conformidade com o Código de Ética e LGPD. Suas conversas permanecem 100% protegidas.'
              },
              {
                icon: MapPin,
                title: 'Estrutura Completa',
                desc: 'Consultório presencial moderno em Araguaína - TO e salas virtuais privativas para todo o Brasil.'
              },
              {
                icon: Zap,
                title: 'Métodos Comprovados',
                desc: 'Abordagens terapêuticas integrativas e científicas focadas na resolução de demandas reais.'
              }
            ].map((dif, i) => (
              <div key={i} className="bg-slate-50 border border-slate-200/70 rounded-3xl p-8 space-y-4 hover:bg-white hover:shadow-xl transition-all">
                <div className="w-12 h-12 rounded-2xl bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700">
                  <dif.icon className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-900">{dif.title}</h3>
                <p className="text-slate-600 text-sm leading-relaxed">{dif.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Corpo Clínico / Equipe ────────────────────────────────────────────── */}
      {team?.enabled && team.members?.length > 0 && (
        <section id="equipe" className="py-24 px-6 lg:px-20 bg-slate-50 border-t border-slate-100">
          <div className="max-w-7xl mx-auto space-y-16">
            <div className="text-center space-y-4 max-w-3xl mx-auto">
              <span className="text-xs font-bold uppercase tracking-widest text-purple-800 bg-purple-50 border border-purple-200 px-3.5 py-1.5 rounded-full">
                Corpo Clínico
              </span>
              <h2 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight">{team.title}</h2>
              <p className="text-slate-600 text-lg">{team.subtitle}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 justify-center items-stretch">
              {team.members.map((m: any, i: number) => {
                const memberId = m.id || String(i);
                const isExpanded = expandedBioId === memberId;
                const bioText = m.bio || '';
                const isLong = bioText.length > 180;

                return (
                  <div 
                    key={memberId} 
                    className="bg-white border border-slate-200/80 rounded-3xl p-8 flex flex-col justify-between shadow-sm hover:shadow-xl transition-all duration-300 min-h-[500px]"
                  >
                    <div className="space-y-5">
                      <div className="relative w-32 h-32 mx-auto shrink-0">
                        {m.photoUrl ? (
                          <img src={m.photoUrl} className="w-32 h-32 rounded-3xl object-cover shadow-md border-2 border-indigo-100 mx-auto" alt={m.name} />
                        ) : (
                          <div className="w-32 h-32 rounded-3xl bg-indigo-50 border-2 border-indigo-100 flex items-center justify-center mx-auto text-indigo-500">
                            <Users className="w-12 h-12" />
                          </div>
                        )}
                      </div>

                      <div className="text-center">
                        <h3 className="text-2xl font-bold text-slate-900">{m.name}</h3>
                        <p className="text-indigo-600 font-bold text-sm mt-1">{m.role}</p>
                      </div>

                      <div className="space-y-2">
                        <p className="text-slate-600 text-sm leading-relaxed text-justify hyphens-auto">
                          {isExpanded || !isLong ? bioText : `${bioText.slice(0, 180)}...`}
                        </p>
                        
                        {isLong && (
                          <button
                            onClick={() => setExpandedBioId(isExpanded ? null : memberId)}
                            className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors pt-1"
                          >
                            {isExpanded ? 'Ver menos ▴' : 'Ver biografia completa ▾'}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="pt-6 mt-6 border-t border-slate-100 shrink-0">
                      <a
                        href={getWhatsAppUrl(`Olá! Gostaria de agendar um atendimento com o terapeuta ${m.name}.`)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-3 px-4 bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 border border-emerald-200/80 shadow-xs"
                      >
                        <MessageCircle className="w-4 h-4" /> Agendar com {m.name.split(' ')[0]} →
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ─── Depoimentos / Prova Social (Google Reviews Carousel) ──────────────── */}
      {testimonials?.length > 0 && (
        <section id="depoimentos" className="py-24 px-6 lg:px-20 bg-white border-t border-slate-100">
          <div className="max-w-7xl mx-auto space-y-12">
            
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className="space-y-4 max-w-2xl">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-amber-50 border border-amber-200 rounded-full text-xs font-bold text-amber-900">
                  <span>⭐ Avaliações no Google 5.0 / 5.0</span>
                </div>
                <h2 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight">
                  O que nossos pacientes dizem
                </h2>
                <p className="text-slate-600 text-lg">
                  Relatos reais e avaliações verificadas de quem passou pelos nossos atendimentos.
                </p>
              </div>

              <div className="flex items-center gap-4 shrink-0">
                <a
                  href="https://share.google/WyHi0qpHqoESXTrK2"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden sm:inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-full text-xs font-bold transition-all shadow-sm hover:scale-105"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                  </svg>
                  Ver no Google ↗
                </a>

                {/* Slider Controls */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentSlide((prev) => (prev === 0 ? Math.max(0, testimonials.length - 3) : prev - 1))}
                    className="w-11 h-11 rounded-full bg-slate-100 hover:bg-indigo-600 hover:text-white border border-slate-200 text-slate-700 flex items-center justify-center transition-all shadow-xs"
                    title="Anterior"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setCurrentSlide((prev) => (prev >= testimonials.length - 3 ? 0 : prev + 1))}
                    className="w-11 h-11 rounded-full bg-slate-100 hover:bg-indigo-600 hover:text-white border border-slate-200 text-slate-700 flex items-center justify-center transition-all shadow-xs"
                    title="Próximo"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Testimonials Slide Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {testimonials.slice(currentSlide, currentSlide + 3).concat(
                testimonials.length < currentSlide + 3 ? testimonials.slice(0, (currentSlide + 3) - testimonials.length) : []
              ).map((t: any, i: number) => (
                <div key={i} className="bg-slate-50 border border-slate-200/80 rounded-3xl p-8 space-y-6 flex flex-col justify-between shadow-xs hover:border-indigo-200 hover:shadow-xl transition-all duration-300">
                  <div className="space-y-4">
                    <div className="flex gap-1 text-amber-400">
                      {[...Array(t.stars || 5)].map((_, s) => (
                        <Star key={s} className="w-5 h-5 fill-amber-400 text-amber-400" />
                      ))}
                    </div>
                    <p className="text-slate-700 text-sm leading-relaxed italic">
                      "{t.text}"
                    </p>
                  </div>
                  <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center font-bold text-indigo-700 text-sm">
                        {t.name.charAt(0)}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">{t.name}</h4>
                        <p className="text-xs text-slate-500">{t.role}</p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                      ✓ Google
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Dots Indicator */}
            <div className="flex justify-center gap-2 pt-4">
              {Array.from({ length: Math.max(1, testimonials.length - 2) }).map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentSlide(idx)}
                  className={`h-2.5 rounded-full transition-all ${
                    currentSlide === idx ? 'w-8 bg-indigo-600' : 'w-2.5 bg-slate-300 hover:bg-slate-400'
                  }`}
                />
              ))}
            </div>

          </div>
        </section>
      )}

      {/* ─── Materiais Exclusivos (E-books/Mentorias) ───────────────────────── */}
      {products?.enabled && products.items?.length > 0 && (
        <section id="materiais" className="py-24 px-6 lg:px-20 bg-slate-50 border-t border-slate-100">
          <div className="max-w-7xl mx-auto space-y-16">
            <div className="text-center space-y-4 max-w-3xl mx-auto">
              <span className="text-xs font-bold uppercase tracking-widest text-indigo-700 bg-indigo-50 border border-indigo-200 px-3.5 py-1.5 rounded-full">
                Desenvolvimento Contínuo
              </span>
              <h2 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight">
                {products.sectionTitle}
              </h2>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              {products.items.map((prod: any) => (
                <div key={prod.id} className="flex flex-col md:flex-row bg-white rounded-3xl p-8 md:p-10 gap-8 border border-slate-200/80 shadow-md">
                  <div className="w-full md:w-1/3 flex justify-center shrink-0">
                    {prod.coverUrl ? (
                      <img src={prod.coverUrl} alt={prod.title} loading="lazy" className="w-full max-w-[200px] h-auto rounded-xl shadow-lg object-cover" />
                    ) : (
                      <div className="w-full max-w-[200px] aspect-[3/4] bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-xl shadow-lg flex flex-col items-center justify-center p-6 text-center text-white relative overflow-hidden border border-indigo-500">
                        <BookOpen className="w-16 h-16 opacity-20 mb-4" />
                        <h3 className="text-sm font-black uppercase tracking-wider relative z-10">{prod.title}</h3>
                        <p className="text-indigo-200 text-xs mt-2 relative z-10">Material Exclusivo</p>
                      </div>
                    )}
                  </div>
                  
                  <div className="w-full md:w-2/3 space-y-6 flex flex-col justify-between">
                    <div className="space-y-3">
                      {prod.badge && (
                        <span className="inline-flex px-3 py-1 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-full text-xs font-bold uppercase tracking-widest">
                          {prod.badge}
                        </span>
                      )}
                      <h3 className="text-2xl font-bold text-slate-900">{prod.title}</h3>
                      {(() => {
                        const isExpanded = expandedProdId === prod.id;
                        const desc = prod.description || '';
                        const isLong = desc.length > 200;
                        return (
                          <div className="space-y-2">
                            <p className="text-slate-600 text-sm leading-relaxed text-justify hyphens-auto">
                              {isExpanded || !isLong ? desc : `${desc.slice(0, 200)}...`}
                            </p>
                            {isLong && (
                              <button
                                onClick={() => setExpandedProdId(isExpanded ? null : prod.id)}
                                className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                              >
                                {isExpanded ? 'Ver menos ▴' : 'Ver descrição completa ▾'}
                              </button>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                    
                    <div className="pt-4 border-t border-slate-100">
                      <div className="flex items-end gap-3 mb-4">
                        <p className="text-xs font-bold text-slate-400 line-through">De R$ {Number(prod.originalPrice).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        <p className="text-3xl font-black text-emerald-600">R$ {Number(prod.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                      </div>
                      
                      <button 
                        onClick={() => setSelectedProduct({ title: prod.title, price: prod.price, downloadUrl: prod.downloadUrl })}
                        className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
                      >
                        Adquirir Material Exclusivo <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─── Dúvidas Frequentes (FAQ Accordion) ───────────────────────────────── */}
      <section id="faq" className="py-24 px-6 lg:px-20 bg-white border-t border-slate-100">
        <div className="max-w-4xl mx-auto space-y-12">
          <div className="text-center space-y-4">
            <span className="text-xs font-bold uppercase tracking-widest text-indigo-700 bg-indigo-50 border border-indigo-200 px-3.5 py-1.5 rounded-full">
              Esclarecimentos
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight">
              Perguntas Frequentes (FAQ)
            </h2>
            <p className="text-slate-600 text-lg">
              Tire suas dúvidas antes de iniciar seu atendimento terapêutico.
            </p>
          </div>

          <div className="space-y-4">
            {faq.map((item: any, i: number) => {
              const isOpen = openFaqIndex === i;
              return (
                <div 
                  key={i} 
                  className="bg-slate-50 border border-slate-200/80 rounded-2xl overflow-hidden transition-colors"
                >
                  <button
                    onClick={() => setOpenFaqIndex(isOpen ? null : i)}
                    className="w-full p-6 text-left flex items-center justify-between gap-4 text-slate-900 font-bold text-lg hover:text-indigo-600 transition-colors"
                  >
                    <span>{item.q}</span>
                    <ChevronDown className={`w-5 h-5 text-indigo-600 transition-transform duration-300 shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-6 text-slate-600 text-sm leading-relaxed border-t border-slate-200/60 pt-4">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── CTA Final Call-to-Action ─────────────────────────────────────────── */}
      <section className="py-24 px-6 lg:px-20 bg-slate-50 relative overflow-hidden">
        <div className="max-w-7xl mx-auto rounded-[3rem] p-10 sm:p-16 lg:p-20 bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-950 text-white relative overflow-hidden shadow-2xl flex flex-col lg:flex-row items-center justify-between gap-12">
          
          <div className="relative z-10 lg:w-7/12 space-y-8">
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 rounded-full text-xs font-bold">
              🟢 Atendimento Imediato Disponível
            </span>
            <h2 className="text-4xl sm:text-6xl font-black leading-tight text-white">
              {cta.title}
            </h2>
            <p className="text-lg sm:text-xl text-slate-300 font-normal leading-relaxed">
              {cta.subtitle}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <a
                href={getWhatsAppUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="px-10 py-5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold text-lg transition-all shadow-xl shadow-emerald-950/60 flex items-center justify-center gap-3 hover:scale-105"
              >
                <MessageCircle className="w-6 h-6 fill-white/20" />
                {cta.ctaLabel || 'Falar no WhatsApp'}
              </a>
            </div>
          </div>

          {/* Warm Therapy Care Image Showcase */}
          <div className="relative z-10 lg:w-5/12 w-full flex justify-center">
            <div className="relative max-w-sm w-full">
              <div className="absolute -inset-2 bg-gradient-to-r from-emerald-500 to-indigo-500 rounded-[2.5rem] blur-lg opacity-30"></div>
              <div className="relative bg-slate-900/90 border border-slate-700/80 rounded-[2.5rem] p-4 shadow-2xl space-y-3">
                <img
                  src="/acolhimento.png"
                  alt="Atendimento terapêutico acolhedor e humanizado na Tzion Terapias"
                  className="rounded-2xl h-64 w-full object-cover shadow-lg border border-slate-700/50"
                />
                <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 flex items-center gap-3 text-xs">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold shrink-0">
                    🌿
                  </div>
                  <div>
                    <p className="font-bold text-white">Ambiente Seguro & Humanizado</p>
                    <p className="text-slate-400 text-[11px]">Sua saúde mental em 1º lugar.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/3 w-[500px] h-[500px] rounded-full bg-indigo-500/10 blur-[100px] pointer-events-none" />
        </div>
      </section>

      {/* ─── Apoio Emocional / CVV Banner ──────────────────────────────────────── */}
      <div className="bg-slate-100 py-6 px-6 border-t border-slate-200 text-center text-xs text-slate-600">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-2">
          <span>💙 <strong>Precisa de apoio emocional imediato?</strong> Em caso de crise extrema, ligue para o CVV (Centro de Valorização da Vida) no número <strong>188</strong> (ligação gratuita 24h).</span>
        </div>
      </div>

      {/* ─── Footer ───────────────────────────────────────────────────────────── */}
      <footer id="contato" className="py-20 px-6 lg:px-20 bg-slate-950 text-slate-400 border-t border-slate-900">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          
          <div className="space-y-6">
            <Link to="/" className="inline-block">
              <TzionLogo isDark={true} className="h-11" />
            </Link>
            <p className="text-sm leading-relaxed">{footer.about}</p>
            <div className="flex gap-3">
              <a href={`https://instagram.com/${footer.instagram?.replace('@', '')}`} target="_blank" rel="noreferrer" className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all text-white">
                <Instagram className="w-5 h-5" />
              </a>
              <a href={footer.facebook} className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all text-white">
                <Facebook className="w-5 h-5" />
              </a>
            </div>
          </div>

          <div className="space-y-6">
            <h4 className="text-white font-bold text-sm tracking-wider uppercase">Navegação</h4>
            <ul className="space-y-3 text-sm font-medium">
              <li><a href="#inicio" className="hover:text-indigo-400 transition-colors">Início</a></li>
              <li><a href="#como-funciona" className="hover:text-indigo-400 transition-colors">Como Funciona</a></li>
              <li><a href="#especialidades" className="hover:text-indigo-400 transition-colors">Especialidades</a></li>
              <li><a href="#diferenciais" className="hover:text-indigo-400 transition-colors">Diferenciais</a></li>
              <li><a href="#faq" className="hover:text-indigo-400 transition-colors">Dúvidas Frequentes</a></li>
            </ul>
          </div>

          <div className="space-y-6">
            <h4 className="text-white font-bold text-sm tracking-wider uppercase">Atendimento</h4>
            <ul className="space-y-3 text-sm font-medium">
              <li className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                <span>{footer.address}<br />{footer.city}</span>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-indigo-400 shrink-0" />
                <span>{footer.phone}</span>
              </li>
              <li className="flex items-center gap-3">
                <MessageCircle className="w-5 h-5 text-indigo-400 shrink-0" />
                <span>{footer.email}</span>
              </li>
            </ul>
          </div>

          <div className="space-y-6">
            <h4 className="text-white font-bold text-sm tracking-wider uppercase">Agende Agora</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Atendimento acolhedor e sigiloso diretamente pelo WhatsApp.
            </p>
            <a
              href={getWhatsAppUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs transition-all items-center justify-center gap-2 shadow-lg shadow-emerald-950/40"
            >
              <MessageCircle className="w-4 h-4 fill-white/20" /> Conversar no WhatsApp
            </a>
          </div>

        </div>

        <div className="max-w-7xl mx-auto pt-12 mt-16 border-t border-slate-900 text-xs flex flex-col md:flex-row items-center justify-between gap-4 text-slate-500">
          <p>{footer.copyright}</p>
          <div className="flex gap-6">
            <Link to="/politica-de-privacidade" className="hover:text-slate-400 transition-colors">Política de Privacidade</Link>
            <Link to="/termos-de-uso" className="hover:text-slate-400 transition-colors">Termos de Uso</Link>
          </div>
        </div>
      </footer>

      {/* ─── Floating WhatsApp Widget (FAB) ────────────────────────────────────── */}
      <a
        href={getWhatsAppUrl()}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 bg-emerald-600 hover:bg-emerald-500 text-white p-4 rounded-full shadow-2xl shadow-emerald-600/30 hover:scale-110 transition-all duration-300 flex items-center gap-3 group border border-emerald-400/30"
        title="Falar com a Tzion Terapias no WhatsApp"
      >
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-400"></span>
        </span>
        <MessageCircle className="w-7 h-7 fill-white/20" />
        <span className="hidden sm:inline font-bold text-sm pr-2">Falar no WhatsApp</span>
      </a>

      {/* Render Checkout Modal for E-books */}
      {selectedProduct && (
        <CheckoutModal 
          isOpen={!!selectedProduct} 
          onClose={() => setSelectedProduct(null)} 
          productName={selectedProduct.title} 
          price={selectedProduct.price}
          downloadUrl={selectedProduct.downloadUrl}
        />
      )}

    </div>
  );
}
