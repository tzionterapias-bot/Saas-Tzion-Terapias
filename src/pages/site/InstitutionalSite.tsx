import React from 'react';
import { Calendar, Heart, Shield, Clock, MessageCircle, MapPin, Phone, Instagram, Facebook, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function InstitutionalSite() {
  return (
    <div className="bg-white font-sans text-slate-900 overflow-x-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-slate-100 h-20 flex items-center px-6 lg:px-20 justify-between">
        <div className="flex items-center gap-2 font-bold text-2xl text-indigo-600">
          <Heart className="w-8 h-8 fill-indigo-600" />
          <span>TZION</span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
          <a href="#inicio" className="hover:text-indigo-600 transition-colors">Início</a>
          <a href="#servicos" className="hover:text-indigo-600 transition-colors">Serviços</a>
          <a href="#equipe" className="hover:text-indigo-600 transition-colors">Equipe</a>
          <a href="#contato" className="hover:text-indigo-600 transition-colors">Contato</a>
          <div className="h-6 w-px bg-slate-200" />
          <Link to="/login" className="hover:text-indigo-600 font-bold">Entrar</Link>
          <Link to="/agenda" className="px-5 py-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200">
            Agendar Agora
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section id="inicio" className="pt-40 pb-20 px-6 lg:px-20 bg-slate-50 relative overflow-hidden">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-16 relative z-10">
          <div className="lg:w-1/2 space-y-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white rounded-full border border-slate-200 text-xs font-bold text-indigo-600 uppercase tracking-widest">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
              Sua saúde mental em primeiro lugar
            </div>
            <h1 className="text-5xl lg:text-7xl font-bold tracking-tight leading-[1.1]">
              Cuidado integral para uma <span className="text-indigo-600">vida equilibrada.</span>
            </h1>
            <p className="text-xl text-slate-600 leading-relaxed max-w-lg">
              Tzion Terapias oferece um ambiente acolhedor e profissional para sua jornada de autoconhecimento e cura emocional.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Link to="/agenda" className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg hover:bg-indigo-700 transition-all text-center shadow-xl shadow-indigo-200">
                Agendar Consulta
              </Link>
              <button className="px-8 py-4 bg-white text-slate-900 border border-slate-200 rounded-2xl font-bold text-lg hover:bg-slate-50 transition-all text-center">
                Ver Especialidades
              </button>
            </div>
          </div>
          <div className="lg:w-1/2 grid grid-cols-2 gap-4">
            <div className="space-y-4 pt-12">
              <img src="https://images.unsplash.com/photo-1527137342181-19aab11a8ee1?auto=format&fit=crop&q=80&w=600" className="rounded-3xl shadow-2xl h-64 w-full object-cover" alt="Therapy session" />
              <div className="bg-indigo-600 p-8 rounded-3xl text-white shadow-xl">
                <h3 className="text-4xl font-bold tracking-tighter">+500</h3>
                <p className="text-sm opacity-90 font-medium">Vidas transformadas</p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-xl">
                <Calendar className="w-10 h-10 text-indigo-600 mb-4" />
                <h4 className="font-bold text-xl">Online e Presencial</h4>
                <p className="text-sm text-slate-500 mt-2">Escolha a modalidade que melhor se adapta à sua rotina.</p>
              </div>
              <img src="https://images.unsplash.com/photo-1544027993-37dbfe43562a?auto=format&fit=crop&q=80&w=600" className="rounded-3xl shadow-2xl h-80 w-full object-cover" alt="Zen workspace" />
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
            {[
              { icon: Heart, title: 'Terapia Individual', desc: 'Foco no autoconhecimento e resolução de conflitos internos.' },
              { icon: Users, title: 'Terapia de Casal', desc: 'Mediação e fortalecimento do vínculo afetivo entre os parceiros.' },
              { icon: Shield, title: 'Terapia Infantil', desc: 'Atividades lúdicas para o desenvolvimento emocional das crianças.' },
              { icon: MessageCircle, title: 'Terapia Familiar', desc: 'Aperfeiçoamento da comunicação e dinâmicas do ambiente familiar.' },
              { icon: Clock, title: 'Ansiedade e Stress', desc: 'Estratégias práticas para lidar com a pressão e o ritmo do dia a dia.' },
              { icon: Calendar, title: 'Plantão Psicológico', desc: 'Atendimentos pontuais para situações de crise ou urgência emocional.' },
            ].map((service, i) => (
              <div key={i} className="group p-10 rounded-[2.5rem] bg-slate-50 border border-transparent hover:border-indigo-100 hover:bg-white hover:shadow-2xl transition-all duration-500">
                <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center text-indigo-600 shadow-sm mb-8 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500">
                  <service.icon className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-bold mb-4">{service.title}</h3>
                <p className="text-slate-500 leading-relaxed">{service.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6 lg:px-20">
        <div className="max-w-7xl mx-auto bg-indigo-600 rounded-[3rem] p-12 lg:p-20 text-white relative overflow-hidden shadow-[0_40px_100px_-20px_rgba(79,70,229,0.4)]">
          <div className="relative z-10 max-w-3xl space-y-8">
            <h2 className="text-5xl lg:text-6xl font-bold leading-tight">Comece sua jornada de cuidado hoje mesmo.</h2>
            <p className="text-xl text-indigo-100 font-medium leading-relaxed">
              Agende uma consulta online ou presencial em poucos cliques. Nossa equipe está pronta para te acolher.
            </p>
            <div className="flex flex-wrap gap-4 pt-4">
              <Link to="/agenda" className="px-10 py-5 bg-white text-indigo-600 rounded-2xl font-bold text-lg hover:bg-slate-50 transition-all flex items-center gap-2">
                Agendar Agora <Clock className="w-5 h-5" />
              </Link>
              <a href="https://wa.me/5511999999999" target="_blank" rel="noreferrer" className="px-10 py-5 bg-indigo-500 text-white border border-indigo-400 rounded-2xl font-bold text-lg hover:bg-indigo-400 transition-all flex items-center gap-2">
                Conversar pelo WhatsApp <MessageCircle className="w-5 h-5" />
              </a>
            </div>
          </div>
          {/* Abstract circles */}
          <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-[500px] h-[500px] rounded-full bg-white/10 blur-[100px]" />
          <div className="absolute bottom-0 right-0 translate-y-1/2 translate-x-1/4 w-[300px] h-[300px] rounded-full bg-indigo-400/20 blur-[60px]" />
        </div>
      </section>

      {/* Footer */}
      <footer id="contato" className="py-20 px-6 lg:px-20 bg-slate-900 text-slate-400">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-16">
          <div className="col-span-2 space-y-8">
            <div className="flex items-center gap-2 font-bold text-2xl text-white">
              <Heart className="w-8 h-8 fill-indigo-500 text-indigo-500" />
              <span>TZION TERAPIAS</span>
            </div>
            <p className="text-lg max-w-md">
              Promovendo a saúde emocional e o bem-estar através de atendimentos humanizados e especializados.
            </p>
            <div className="flex gap-4">
              <a href="#" className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center hover:bg-indigo-600 transition-colors text-white">
                <Instagram className="w-6 h-6" />
              </a>
              <a href="#" className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center hover:bg-indigo-600 transition-colors text-white">
                <Facebook className="w-6 h-6" />
              </a>
            </div>
          </div>
          
          <div className="space-y-8">
            <h4 className="text-white font-bold text-lg">Links Rápidos</h4>
            <ul className="space-y-4 font-medium">
              <li><a href="#inicio" className="hover:text-white transition-colors">Início</a></li>
              <li><a href="#servicos" className="hover:text-white transition-colors">Serviços</a></li>
              <li><a href="#equipe" className="hover:text-white transition-colors">Corpo Clínico</a></li>
              <li><Link to="/agenda" className="hover:text-white transition-colors">Agendamento</Link></li>
              <li><Link to="/portal" className="hover:text-white transition-colors">Portal do Paciente</Link></li>
            </ul>
          </div>

          <div className="space-y-8">
            <h4 className="text-white font-bold text-lg">Onde Estamos</h4>
            <ul className="space-y-4 font-medium">
              <li className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-indigo-500 mt-1" />
                <span>Rua das Terapias, 1000<br />São Paulo, SP - Brasil</span>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-indigo-500" />
                <span>(11) 99999-9999</span>
              </li>
              <li className="flex items-center gap-3">
                <MessageCircle className="w-5 h-5 text-indigo-500" />
                <span>contato@tzion.com.br</span>
              </li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto pt-20 mt-20 border-t border-slate-800 text-sm flex flex-col md:row items-center justify-between gap-4">
          <p>© 2026 Sistema Tzion Terapias. Todos os direitos reservados.</p>
          <div className="flex gap-8">
            <a href="#" className="hover:text-white">Política de Privacidade</a>
            <a href="#" className="hover:text-white">Termos de Uso (LGPD)</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
