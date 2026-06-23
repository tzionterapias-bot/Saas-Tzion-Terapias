import React, { useState, useEffect } from 'react';
import { Calendar, Heart, Shield, Clock, MessageCircle, MapPin, Phone, Instagram, Facebook, Users, Globe } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/src/lib/supabase';

// ─── Icon Map ──────────────────────────────────────────────────────────────────
const IconMap: Record<string, React.ComponentType<any>> = {
  Heart, Users, Shield, MessageCircle, Clock, Calendar, Globe,
};
function ServiceIcon({ name, ...props }: { name: string; [k: string]: any }) {
  const Icon = IconMap[name] || Heart;
  return <Icon {...props} />;
}

// ─── Default Content ───────────────────────────────────────────────────────────
const DEFAULT: any = {
  nav: { clinicName: 'TZION', logoUrl: '', ctaLabel: 'Agendar Agora', ctaColor: '#4f46e5' },
  hero: {
    badge: 'Sua saúde mental em primeiro lugar',
    title: 'Cuidado integral para uma',
    titleHighlight: 'vida equilibrada.',
    subtitle: 'Tzion Terapias oferece um ambiente acolhedor e profissional para sua jornada de autoconhecimento e cura emocional.',
    ctaPrimary: 'Agendar Consulta',
    ctaSecondary: 'Ver Especialidades',
    stat: '+500',
    statLabel: 'Vidas transformadas',
    imageUrl: 'https://images.unsplash.com/photo-1527137342181-19aab11a8ee1?auto=format&fit=crop&q=80&w=600',
  },
  services: [
    { id: 's1', icon: 'Heart', title: 'Terapia Individual', desc: 'Foco no autoconhecimento e resolução de conflitos internos.' },
    { id: 's2', icon: 'Users', title: 'Terapia de Casal', desc: 'Mediação e fortalecimento do vínculo afetivo entre os parceiros.' },
    { id: 's3', icon: 'Shield', title: 'Terapia Infantil', desc: 'Atividades lúdicas para o desenvolvimento emocional das crianças.' },
    { id: 's4', icon: 'MessageCircle', title: 'Terapia Familiar', desc: 'Aperfeiçoamento da comunicação e dinâmicas do ambiente familiar.' },
    { id: 's5', icon: 'Clock', title: 'Ansiedade e Stress', desc: 'Estratégias práticas para lidar com a pressão e o ritmo do dia a dia.' },
    { id: 's6', icon: 'Calendar', title: 'Plantão Psicológico', desc: 'Atendimentos pontuais para situações de crise ou urgência emocional.' },
  ],
  team: { enabled: false, title: 'Nossa Equipe', subtitle: 'Profissionais especializados e comprometidos com seu bem-estar.', members: [] },
  cta: {
    title: 'Comece sua jornada de cuidado hoje mesmo.',
    subtitle: 'Agende uma consulta online ou presencial em poucos cliques. Nossa equipe está pronta para te acolher.',
    ctaLabel: 'Agendar Agora',
    whatsappNumber: '5511999999999',
    whatsappLabel: 'Conversar pelo WhatsApp',
    bgColor: '#4f46e5',
  },
  footer: {
    about: 'Promovendo a saúde emocional e o bem-estar através de atendimentos humanizados e especializados.',
    address: 'Rua das Terapias, 1000',
    city: 'São Paulo, SP - Brasil',
    phone: '(11) 99999-9999',
    email: 'contato@tzion.com.br',
    instagram: '#',
    facebook: '#',
    copyright: '© 2026 Sistema Tzion Terapias. Todos os direitos reservados.',
  },
};

export default function InstitutionalSite() {
  const [site, setSite] = useState<any>(DEFAULT);

  useEffect(() => {
    async function loadSite() {
      try {
        const { data } = await supabase.from('settings').select('value').eq('key', 'site_content').maybeSingle();
        if (data?.value) {
          // Deep merge with defaults so missing keys fall back gracefully
          setSite((prev: any) => ({
            ...DEFAULT,
            ...data.value,
            nav: { ...DEFAULT.nav, ...data.value.nav },
            hero: { ...DEFAULT.hero, ...data.value.hero },
            team: { ...DEFAULT.team, ...data.value.team },
            cta: { ...DEFAULT.cta, ...data.value.cta },
            footer: { ...DEFAULT.footer, ...data.value.footer },
            services: data.value.services?.length ? data.value.services : DEFAULT.services,
          }));
        }
      } catch (_) {}
    }
    loadSite();
  }, []);

  const { nav, hero, services, team, cta, footer } = site;

  useEffect(() => {
    if (!site) return;
    // Dynamic SEO optimizations
    const clinic = nav?.clinicName || 'Tzion';
    const badge = hero?.badge || '';
    const title = hero?.title || '';
    const highlight = hero?.titleHighlight || '';
    const subtitle = hero?.subtitle || '';

    // 1. Dynamic Title Tag
    document.title = `${clinic} Terapias | Cuidado Integral e Saúde Mental`;

    // 2. Dynamic Meta Description Tag
    let metaDescription = document.querySelector('meta[name="description"]');
    if (!metaDescription) {
      metaDescription = document.createElement('meta');
      metaDescription.setAttribute('name', 'description');
      document.head.appendChild(metaDescription);
    }
    metaDescription.setAttribute('content', `${badge ? badge + ' - ' : ''}${title} ${highlight}. ${subtitle}`);

    // 3. Dynamic OpenGraph / Twitter Title & Description
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', `${clinic} Terapias — Cuidado Integral`);
    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute('content', subtitle);
    
    const twTitle = document.querySelector('meta[name="twitter:title"]');
    if (twTitle) twTitle.setAttribute('content', `${clinic} Terapias — Cuidado Integral`);
    const twDesc = document.querySelector('meta[name="twitter:description"]');
    if (twDesc) twDesc.setAttribute('content', subtitle);
  }, [site]);

  return (
    <div className="bg-white font-sans text-slate-900 overflow-x-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-slate-100 h-20 flex items-center px-6 lg:px-20 justify-between">
        <div className="flex items-center gap-2 font-bold text-2xl text-indigo-600">
          {nav.logoUrl
            ? <img src={nav.logoUrl} className="h-10 object-contain" alt={`Logotipo oficial da clínica ${nav.clinicName}`} />
            : <Heart className="w-8 h-8 fill-indigo-600" />
          }
          <span>{nav.clinicName}</span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
          <a href="#inicio" className="hover:text-indigo-600 transition-colors">Início</a>
          <a href="#servicos" className="hover:text-indigo-600 transition-colors">Serviços</a>
          {team.enabled && <a href="#equipe" className="hover:text-indigo-600 transition-colors">Equipe</a>}
          <a href="#contato" className="hover:text-indigo-600 transition-colors">Contato</a>
          <div className="h-6 w-px bg-slate-200" />
          <Link to="/login" className="hover:text-indigo-600 font-bold">Entrar</Link>
          <Link
            to="/agenda"
            className="px-5 py-2 text-white rounded-full hover:opacity-90 transition-all shadow-lg"
            style={{ backgroundColor: nav.ctaColor }}
          >
            {nav.ctaLabel}
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section id="inicio" className="pt-40 pb-20 px-6 lg:px-20 bg-slate-50 relative overflow-hidden">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-16 relative z-10">
          <div className="lg:w-1/2 space-y-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white rounded-full border border-slate-200 text-xs font-bold text-indigo-600 uppercase tracking-widest">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
              {hero.badge}
            </div>
            <h1 className="text-5xl lg:text-7xl font-bold tracking-tight leading-[1.1]">
              {hero.title} <span className="text-indigo-600">{hero.titleHighlight}</span>
            </h1>
            <p className="text-xl text-slate-600 leading-relaxed max-w-lg">{hero.subtitle}</p>
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Link to="/agenda" className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg hover:bg-indigo-700 transition-all text-center shadow-xl shadow-indigo-200">
                {hero.ctaPrimary}
              </Link>
              <a
                href="#servicos"
                onClick={e => { e.preventDefault(); document.getElementById('servicos')?.scrollIntoView({ behavior: 'smooth' }); }}
                className="px-8 py-4 bg-white text-slate-900 border border-slate-200 rounded-2xl font-bold text-lg hover:bg-slate-50 transition-all text-center cursor-pointer"
              >
                {hero.ctaSecondary}
              </a>
            </div>
          </div>
          <div className="lg:w-1/2 grid grid-cols-2 gap-4">
            <div className="space-y-4 pt-12">
              {hero.imageUrl && (
                <img
                  src={hero.imageUrl}
                  className="rounded-3xl shadow-2xl h-64 w-full object-contain bg-white p-2"
                  alt={`Ilustração de consulta ou terapia na clínica ${nav.clinicName}`}
                />
              )}
              <div className="bg-indigo-600 p-8 rounded-3xl text-white shadow-xl">
                <h3 className="text-4xl font-bold tracking-tighter">{hero.stat}</h3>
                <p className="text-sm opacity-90 font-medium">{hero.statLabel}</p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-xl">
                <Calendar className="w-10 h-10 text-indigo-600 mb-4" />
                <h4 className="font-bold text-xl">Online e Presencial</h4>
                <p className="text-sm text-slate-500 mt-2">Escolha a modalidade que melhor se adapta à sua rotina.</p>
              </div>
              <img
                src="https://images.unsplash.com/photo-1544027993-37dbfe43562a?auto=format&fit=crop&q=80&w=600"
                className="rounded-3xl shadow-2xl h-80 w-full object-cover"
                alt={`Espaço zen e ambiente terapêutico acolhedor na clínica ${nav.clinicName}`}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Services */}
      <section id="servicos" className="py-24 px-6 lg:px-20 bg-white">
        <div className="max-w-7xl mx-auto space-y-16">
          <div className="text-center space-y-4 max-w-2xl mx-auto">
            <h2 className="text-4xl font-bold tracking-tight">Nossas Especialidades</h2>
            <p className="text-slate-600 text-lg">Oferecemos diversas modalidades de terapia para atender às suas necessidades específicas.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {services.map((s: any, i: number) => (
              <div key={s.id || i} className="group p-10 rounded-[2.5rem] bg-slate-50 border border-transparent hover:border-indigo-100 hover:bg-white hover:shadow-2xl transition-all duration-500">
                <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center text-indigo-600 shadow-sm mb-8 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500">
                  <ServiceIcon name={s.icon} className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-bold mb-4">{s.title}</h3>
                <p className="text-slate-500 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team Section */}
      {team.enabled && team.members.length > 0 && (
        <section id="equipe" className="py-24 px-6 lg:px-20 bg-slate-50">
          <div className="max-w-7xl mx-auto space-y-16">
            <div className="text-center space-y-4 max-w-2xl mx-auto">
              <h2 className="text-4xl font-bold tracking-tight">{team.title}</h2>
              <p className="text-slate-600 text-lg">{team.subtitle}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {team.members.map((m: any, i: number) => (
                <div key={m.id || i} className="group p-10 rounded-[2.5rem] bg-white border border-slate-100 shadow-sm hover:shadow-2xl hover:border-indigo-100 transition-all duration-500 text-center space-y-6">
                  {m.photoUrl
                    ? <img src={m.photoUrl} className="w-28 h-28 rounded-3xl object-cover mx-auto shadow-xl" alt={`Foto do profissional de saúde mental ${m.name} - ${m.role} na clínica ${nav.clinicName}`} />
                    : <div className="w-28 h-28 rounded-3xl bg-indigo-100 flex items-center justify-center mx-auto"><Users className="w-12 h-12 text-indigo-400" /></div>
                  }
                  <div>
                    <h3 className="text-2xl font-bold">{m.name}</h3>
                    <p className="text-indigo-600 font-bold text-sm mt-1">{m.role}</p>
                  </div>
                  <p className="text-slate-500 leading-relaxed">{m.bio}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA Section */}
      <section className="py-24 px-6 lg:px-20">
        <div
          className="max-w-7xl mx-auto rounded-[3rem] p-12 lg:p-20 text-white relative overflow-hidden shadow-2xl"
          style={{ backgroundColor: cta.bgColor, boxShadow: `0 40px 100px -20px ${cta.bgColor}66` }}
        >
          <div className="relative z-10 max-w-3xl space-y-8">
            <h2 className="text-5xl lg:text-6xl font-bold leading-tight">{cta.title}</h2>
            <p className="text-xl opacity-90 font-medium leading-relaxed">{cta.subtitle}</p>
            <div className="flex flex-wrap gap-4 pt-4">
              <Link to="/agenda" className="px-10 py-5 bg-white text-slate-900 rounded-2xl font-bold text-lg hover:bg-slate-50 transition-all flex items-center gap-2">
                {cta.ctaLabel} <Clock className="w-5 h-5" />
              </Link>
              <a
                href={`https://wa.me/${cta.whatsappNumber}`}
                target="_blank"
                rel="noreferrer"
                className="px-10 py-5 bg-white/20 text-white border border-white/30 rounded-2xl font-bold text-lg hover:bg-white/30 transition-all flex items-center gap-2"
              >
                {cta.whatsappLabel} <MessageCircle className="w-5 h-5" />
              </a>
            </div>
          </div>
          <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-[500px] h-[500px] rounded-full bg-white/10 blur-[100px]" />
          <div className="absolute bottom-0 right-0 translate-y-1/2 translate-x-1/4 w-[300px] h-[300px] rounded-full bg-white/10 blur-[60px]" />
        </div>
      </section>

      {/* Footer */}
      <footer id="contato" className="py-20 px-6 lg:px-20 bg-slate-900 text-slate-400">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-16">
          <div className="col-span-2 space-y-8">
            <div className="flex items-center gap-2 font-bold text-2xl text-white">
              <Heart className="w-8 h-8 fill-indigo-500 text-indigo-500" />
              <span>{nav.clinicName.toUpperCase()} TERAPIAS</span>
            </div>
            <p className="text-lg max-w-md">{footer.about}</p>
            <div className="flex gap-4">
              <a href={footer.instagram} className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center hover:bg-indigo-600 transition-colors text-white">
                <Instagram className="w-6 h-6" />
              </a>
              <a href={footer.facebook} className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center hover:bg-indigo-600 transition-colors text-white">
                <Facebook className="w-6 h-6" />
              </a>
            </div>
          </div>

          <div className="space-y-8">
            <h4 className="text-white font-bold text-lg">Links Rápidos</h4>
            <ul className="space-y-4 font-medium">
              <li><a href="#inicio" className="hover:text-white transition-colors">Início</a></li>
              <li><a href="#servicos" className="hover:text-white transition-colors">Serviços</a></li>
              {team.enabled && <li><a href="#equipe" className="hover:text-white transition-colors">Corpo Clínico</a></li>}
              <li><Link to="/agenda" className="hover:text-white transition-colors">Agendamento</Link></li>
              <li><Link to="/portal" className="hover:text-white transition-colors">Portal do Paciente</Link></li>
            </ul>
          </div>

          <div className="space-y-8">
            <h4 className="text-white font-bold text-lg">Onde Estamos</h4>
            <ul className="space-y-4 font-medium">
              <li className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-indigo-500 mt-1" />
                <span>{footer.address}<br />{footer.city}</span>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-indigo-500" />
                <span>{footer.phone}</span>
              </li>
              <li className="flex items-center gap-3">
                <MessageCircle className="w-5 h-5 text-indigo-500" />
                <span>{footer.email}</span>
              </li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto pt-20 mt-20 border-t border-slate-800 text-sm flex flex-col md:flex-row items-center justify-between gap-4">
          <p>{footer.copyright}</p>
          <div className="flex gap-8">
            <a href="#" className="hover:text-white">Política de Privacidade</a>
            <a href="#" className="hover:text-white">Termos de Uso (LGPD)</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
