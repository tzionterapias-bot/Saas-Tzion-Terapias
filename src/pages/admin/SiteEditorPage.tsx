import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/src/lib/supabase';
import {
  Globe, Save, Eye, ChevronRight, Plus, Trash2, Upload, X,
  Layout, Layers, Users, MessageSquare, MapPin, Sparkles,
  CheckCircle2, Loader2, Image, Type, Link, Phone, Mail,
  Instagram, Facebook, Heart, Calendar, Clock, Shield, MessageCircle
} from 'lucide-react';
import { cn } from '@/src/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SiteService {
  id: string;
  icon: string;
  title: string;
  desc: string;
}

interface TeamMember {
  id: string;
  name: string;
  role: string;
  bio: string;
  photoUrl: string;
}

interface SiteContent {
  nav: {
    clinicName: string;
    logoUrl: string;
    ctaLabel: string;
    ctaColor: string;
  };
  hero: {
    badge: string;
    title: string;
    titleHighlight: string;
    subtitle: string;
    ctaPrimary: string;
    ctaSecondary: string;
    stat: string;
    statLabel: string;
    imageUrl: string;
  };
  services: SiteService[];
  team: {
    enabled: boolean;
    title: string;
    subtitle: string;
    members: TeamMember[];
  };
  cta: {
    title: string;
    subtitle: string;
    ctaLabel: string;
    whatsappNumber: string;
    whatsappLabel: string;
    bgColor: string;
  };
  footer: {
    about: string;
    address: string;
    city: string;
    phone: string;
    email: string;
    instagram: string;
    facebook: string;
    copyright: string;
  };
}

const SERVICE_ICONS = ['Heart', 'Users', 'Shield', 'MessageCircle', 'Clock', 'Calendar', 'Star', 'Brain', 'Smile', 'Globe'];

const DEFAULT_CONTENT: SiteContent = {
  nav: {
    clinicName: 'TZION',
    logoUrl: '',
    ctaLabel: 'Agendar Agora',
    ctaColor: '#4f46e5',
  },
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
  team: {
    enabled: true,
    title: 'Nossa Equipe',
    subtitle: 'Profissionais especializados e comprometidos com seu bem-estar.',
    members: [],
  },
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

// ─── Icon Renderer ────────────────────────────────────────────────────────────
const IconMap: Record<string, React.ComponentType<any>> = {
  Heart, Users, Shield, MessageCircle, Clock, Calendar, Globe,
};
function ServiceIcon({ name, ...props }: { name: string; [k: string]: any }) {
  const Icon = IconMap[name] || Heart;
  return <Icon {...props} />;
}

// ─── Section Labels ───────────────────────────────────────────────────────────
const SECTIONS = [
  { id: 'nav', label: 'Cabeçalho', icon: Layout },
  { id: 'hero', label: 'Banner Principal', icon: Sparkles },
  { id: 'services', label: 'Serviços', icon: Layers },
  { id: 'team', label: 'Equipe', icon: Users },
  { id: 'cta', label: 'Chamada p/ Ação', icon: MessageSquare },
  { id: 'footer', label: 'Rodapé', icon: MapPin },
];

// ─── Main Editor ──────────────────────────────────────────────────────────────
export default function SiteEditorPage() {
  const [content, setContent] = useState<SiteContent>(DEFAULT_CONTENT);
  const [activeSection, setActiveSection] = useState('hero');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [previewVisible, setPreviewVisible] = useState(true);
  const heroImgRef = useRef<HTMLInputElement>(null);

  // Load saved content
  useEffect(() => {
    async function loadContent() {
      setLoading(true);
      const { data } = await supabase.from('settings').select('value').eq('key', 'site_content').maybeSingle();
      if (data?.value) {
        setContent({ ...DEFAULT_CONTENT, ...data.value });
      }
      setLoading(false);
    }
    loadContent();
  }, []);

  const save = async () => {
    setSaving(true);
    await supabase.from('settings').upsert([{ key: 'site_content', value: content }]);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const update = (path: string, value: any) => {
    const keys = path.split('.');
    setContent(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      let obj: any = next;
      for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]];
      obj[keys[keys.length - 1]] = value;
      return next;
    });
  };

  const handleImageUpload = (path: string, ref: React.RefObject<HTMLInputElement>) => {
    ref.current?.click();
    if (ref.current) {
      ref.current.onchange = (e: any) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 3 * 1024 * 1024) { alert('Imagem deve ter no máximo 3MB.'); return; }
        const reader = new FileReader();
        reader.onloadend = () => update(path, reader.result as string);
        reader.readAsDataURL(file);
      };
    }
  };

  const addService = () => {
    const id = `s${Date.now()}`;
    setContent(prev => ({
      ...prev,
      services: [...prev.services, { id, icon: 'Heart', title: 'Novo Serviço', desc: 'Descrição do serviço.' }]
    }));
  };

  const removeService = (id: string) => {
    setContent(prev => ({ ...prev, services: prev.services.filter(s => s.id !== id) }));
  };

  const updateService = (id: string, field: string, value: string) => {
    setContent(prev => ({
      ...prev,
      services: prev.services.map(s => s.id === id ? { ...s, [field]: value } : s)
    }));
  };

  const addTeamMember = () => {
    const id = `tm${Date.now()}`;
    setContent(prev => ({
      ...prev,
      team: { ...prev.team, members: [...prev.team.members, { id, name: 'Nome do Terapeuta', role: 'Especialidade', bio: 'Breve descrição profissional.', photoUrl: '' }] }
    }));
  };

  const removeTeamMember = (id: string) => {
    setContent(prev => ({ ...prev, team: { ...prev.team, members: prev.team.members.filter(m => m.id !== id) } }));
  };

  const updateTeamMember = (id: string, field: string, value: string) => {
    setContent(prev => ({
      ...prev,
      team: { ...prev.team, members: prev.team.members.map(m => m.id === id ? { ...m, [field]: value } : m) }
    }));
  };

  const memberImgRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const handleMemberPhoto = (memberId: string) => {
    const input = memberImgRefs.current[memberId];
    if (!input) return;
    input.click();
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) { alert('Foto deve ter no máximo 2MB.'); return; }
      const reader = new FileReader();
      reader.onloadend = () => updateTeamMember(memberId, 'photoUrl', reader.result as string);
      reader.readAsDataURL(file);
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mx-auto" />
          <p className="text-slate-500 font-medium">Carregando conteúdo do site...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-50 animate-in fade-in duration-300">
      {/* Top Bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100">
            <Globe className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-black text-slate-900 text-lg leading-none">Editor do Site</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Tzion Terapias — Edição Visual</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setPreviewVisible(v => !v)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-slate-500 bg-slate-50 border border-slate-200 rounded-xl hover:border-indigo-300 hover:text-indigo-600 transition-all"
          >
            <Eye className="w-4 h-4" />
            {previewVisible ? 'Ocultar Preview' : 'Mostrar Preview'}
          </button>
          <a href="/" target="_blank" rel="noreferrer" className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-slate-500 bg-slate-50 border border-slate-200 rounded-xl hover:border-indigo-300 hover:text-indigo-600 transition-all">
            <Globe className="w-4 h-4" />
            Ver Site
          </a>
          <button
            onClick={save}
            disabled={saving}
            className={cn(
              "flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white rounded-xl transition-all shadow-lg",
              saved ? "bg-emerald-500 shadow-emerald-100" : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100"
            )}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saving ? 'Salvando...' : saved ? 'Publicado!' : 'Salvar e Publicar'}
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left — Section Menu */}
        <div className="w-56 bg-white border-r border-slate-200 flex flex-col py-4 shrink-0">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4 mb-3">Seções</p>
          {SECTIONS.map(s => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={cn(
                "flex items-center gap-3 px-4 py-3 text-sm font-bold transition-all text-left",
                activeSection === s.id
                  ? "text-indigo-600 bg-indigo-50 border-r-2 border-indigo-600"
                  : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
              )}
            >
              <s.icon className="w-4 h-4 shrink-0" />
              {s.label}
            </button>
          ))}
        </div>

        {/* Center — Editor Form */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6" style={{ minWidth: 0 }}>

          {/* NAV */}
          {activeSection === 'nav' && (
            <EditorSection title="Cabeçalho (Navegação)" desc="O topo do site com o nome/logo da clínica e botão de agendamento.">
              <Field label="Nome da Clínica">
                <input value={content.nav.clinicName} onChange={e => update('nav.clinicName', e.target.value)} className={inputCls} />
              </Field>
              <Field label="Texto do Botão de Agendamento">
                <input value={content.nav.ctaLabel} onChange={e => update('nav.ctaLabel', e.target.value)} className={inputCls} />
              </Field>
              <Field label="Cor do Botão">
                <ColorPicker value={content.nav.ctaColor} onChange={v => update('nav.ctaColor', v)} />
              </Field>
            </EditorSection>
          )}

          {/* HERO */}
          {activeSection === 'hero' && (
            <EditorSection title="Banner Principal (Hero)" desc="A primeira seção visível do site — impacto máximo.">
              <Field label="Badge (faixa de destaque)">
                <input value={content.hero.badge} onChange={e => update('hero.badge', e.target.value)} className={inputCls} />
              </Field>
              <Field label="Título Principal">
                <input value={content.hero.title} onChange={e => update('hero.title', e.target.value)} className={inputCls} />
              </Field>
              <Field label="Parte Destacada do Título (em azul)">
                <input value={content.hero.titleHighlight} onChange={e => update('hero.titleHighlight', e.target.value)} className={inputCls} />
              </Field>
              <Field label="Subtítulo / Descrição">
                <textarea value={content.hero.subtitle} onChange={e => update('hero.subtitle', e.target.value)} rows={3} className={inputCls} />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Botão Principal">
                  <input value={content.hero.ctaPrimary} onChange={e => update('hero.ctaPrimary', e.target.value)} className={inputCls} />
                </Field>
                <Field label="Botão Secundário">
                  <input value={content.hero.ctaSecondary} onChange={e => update('hero.ctaSecondary', e.target.value)} className={inputCls} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Número em Destaque (ex: +500)">
                  <input value={content.hero.stat} onChange={e => update('hero.stat', e.target.value)} className={inputCls} />
                </Field>
                <Field label="Legenda do Número">
                  <input value={content.hero.statLabel} onChange={e => update('hero.statLabel', e.target.value)} className={inputCls} />
                </Field>
              </div>
              <Field label="Foto de Capa">
                <div className="flex items-center gap-3">
                  {content.hero.imageUrl && (
                    <img src={content.hero.imageUrl} className="w-16 h-16 object-cover rounded-xl border border-slate-200" alt="preview" />
                  )}
                  <input value={content.hero.imageUrl} onChange={e => update('hero.imageUrl', e.target.value)} className={cn(inputCls, 'flex-1')} placeholder="URL ou faça upload" />
                  <input type="file" accept="image/*" className="hidden" ref={heroImgRef} />
                  <button onClick={() => handleImageUpload('hero.imageUrl', heroImgRef)} className="px-4 py-3 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors border border-indigo-100 flex items-center gap-2 text-sm font-bold shrink-0">
                    <Upload className="w-4 h-4" /> Upload
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Recomendado: imagem de alta qualidade, máx 3MB</p>
              </Field>
            </EditorSection>
          )}

          {/* SERVICES */}
          {activeSection === 'services' && (
            <EditorSection title="Serviços & Especialidades" desc="Os cards de serviço que sua clínica oferece.">
              <div className="space-y-4">
                {content.services.map((s, idx) => (
                  <div key={s.id} className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Serviço {idx + 1}</span>
                      <button onClick={() => removeService(s.id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Ícone">
                        <select value={s.icon} onChange={e => updateService(s.id, 'icon', e.target.value)} className={inputCls}>
                          {SERVICE_ICONS.map(i => <option key={i} value={i}>{i}</option>)}
                        </select>
                      </Field>
                      <Field label="Título">
                        <input value={s.title} onChange={e => updateService(s.id, 'title', e.target.value)} className={inputCls} />
                      </Field>
                    </div>
                    <Field label="Descrição">
                      <textarea value={s.desc} onChange={e => updateService(s.id, 'desc', e.target.value)} rows={2} className={inputCls} />
                    </Field>
                  </div>
                ))}
                <button onClick={addService} className="w-full py-4 border-2 border-dashed border-indigo-200 text-indigo-600 rounded-2xl font-bold hover:bg-indigo-50 transition-all flex items-center justify-center gap-2">
                  <Plus className="w-5 h-5" /> Adicionar Serviço
                </button>
              </div>
            </EditorSection>
          )}

          {/* TEAM */}
          {activeSection === 'team' && (
            <EditorSection title="Equipe" desc="Mostre os profissionais da sua clínica com foto e bio.">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <div>
                  <p className="font-bold text-slate-900">Mostrar seção de equipe no site</p>
                  <p className="text-xs text-slate-500 mt-0.5">Habilitar/desabilitar a seção "Nossa Equipe"</p>
                </div>
                <button
                  onClick={() => update('team.enabled', !content.team.enabled)}
                  className={cn("w-12 h-6 rounded-full transition-all", content.team.enabled ? "bg-indigo-600" : "bg-slate-200")}
                >
                  <div className={cn("w-5 h-5 bg-white rounded-full shadow transition-transform", content.team.enabled ? "translate-x-6" : "translate-x-0.5")} />
                </button>
              </div>
              {content.team.enabled && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Título da Seção">
                      <input value={content.team.title} onChange={e => update('team.title', e.target.value)} className={inputCls} />
                    </Field>
                    <Field label="Subtítulo">
                      <input value={content.team.subtitle} onChange={e => update('team.subtitle', e.target.value)} className={inputCls} />
                    </Field>
                  </div>
                  <div className="space-y-4">
                    {content.team.members.map((m, idx) => (
                      <div key={m.id} className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Membro {idx + 1}</span>
                          <button onClick={() => removeTeamMember(m.id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="flex items-center gap-4">
                          {m.photoUrl
                            ? <img src={m.photoUrl} className="w-16 h-16 rounded-2xl object-cover border border-slate-200 shrink-0" alt="foto" />
                            : <div className="w-16 h-16 rounded-2xl bg-slate-200 flex items-center justify-center shrink-0"><Users className="w-7 h-7 text-slate-400" /></div>
                          }
                          <input type="file" accept="image/*" className="hidden" ref={el => { memberImgRefs.current[m.id] = el; }} />
                          <button onClick={() => handleMemberPhoto(m.id)} className="text-xs font-bold text-indigo-600 flex items-center gap-1 hover:underline">
                            <Upload className="w-3.5 h-3.5" /> {m.photoUrl ? 'Trocar foto' : 'Adicionar foto'}
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <Field label="Nome">
                            <input value={m.name} onChange={e => updateTeamMember(m.id, 'name', e.target.value)} className={inputCls} />
                          </Field>
                          <Field label="Especialidade / Cargo">
                            <input value={m.role} onChange={e => updateTeamMember(m.id, 'role', e.target.value)} className={inputCls} />
                          </Field>
                        </div>
                        <Field label="Bio / Apresentação">
                          <textarea value={m.bio} onChange={e => updateTeamMember(m.id, 'bio', e.target.value)} rows={2} className={inputCls} />
                        </Field>
                      </div>
                    ))}
                    <button onClick={addTeamMember} className="w-full py-4 border-2 border-dashed border-indigo-200 text-indigo-600 rounded-2xl font-bold hover:bg-indigo-50 transition-all flex items-center justify-center gap-2">
                      <Plus className="w-5 h-5" /> Adicionar Membro
                    </button>
                  </div>
                </>
              )}
            </EditorSection>
          )}

          {/* CTA */}
          {activeSection === 'cta' && (
            <EditorSection title="Chamada para Ação (CTA)" desc="O bloco de conversão que motiva o visitante a agendar.">
              <Field label="Título">
                <textarea value={content.cta.title} onChange={e => update('cta.title', e.target.value)} rows={2} className={inputCls} />
              </Field>
              <Field label="Subtítulo">
                <textarea value={content.cta.subtitle} onChange={e => update('cta.subtitle', e.target.value)} rows={2} className={inputCls} />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Texto do Botão Principal">
                  <input value={content.cta.ctaLabel} onChange={e => update('cta.ctaLabel', e.target.value)} className={inputCls} />
                </Field>
                <Field label="Texto do Botão WhatsApp">
                  <input value={content.cta.whatsappLabel} onChange={e => update('cta.whatsappLabel', e.target.value)} className={inputCls} />
                </Field>
              </div>
              <Field label="Número WhatsApp (com DDI, sem +)">
                <input value={content.cta.whatsappNumber} onChange={e => update('cta.whatsappNumber', e.target.value)} className={inputCls} placeholder="5511999999999" />
              </Field>
              <Field label="Cor de Fundo do Bloco CTA">
                <ColorPicker value={content.cta.bgColor} onChange={v => update('cta.bgColor', v)} />
              </Field>
            </EditorSection>
          )}

          {/* FOOTER */}
          {activeSection === 'footer' && (
            <EditorSection title="Rodapé (Footer)" desc="Informações de contato, redes sociais e endereço.">
              <Field label="Texto Institucional">
                <textarea value={content.footer.about} onChange={e => update('footer.about', e.target.value)} rows={3} className={inputCls} />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Endereço">
                  <input value={content.footer.address} onChange={e => update('footer.address', e.target.value)} className={inputCls} />
                </Field>
                <Field label="Cidade / Estado">
                  <input value={content.footer.city} onChange={e => update('footer.city', e.target.value)} className={inputCls} />
                </Field>
                <Field label="Telefone">
                  <input value={content.footer.phone} onChange={e => update('footer.phone', e.target.value)} className={inputCls} />
                </Field>
                <Field label="E-mail">
                  <input value={content.footer.email} onChange={e => update('footer.email', e.target.value)} className={inputCls} />
                </Field>
                <Field label="Link do Instagram">
                  <input value={content.footer.instagram} onChange={e => update('footer.instagram', e.target.value)} className={inputCls} placeholder="https://instagram.com/..." />
                </Field>
                <Field label="Link do Facebook">
                  <input value={content.footer.facebook} onChange={e => update('footer.facebook', e.target.value)} className={inputCls} placeholder="https://facebook.com/..." />
                </Field>
              </div>
              <Field label="Texto de Copyright">
                <input value={content.footer.copyright} onChange={e => update('footer.copyright', e.target.value)} className={inputCls} />
              </Field>
            </EditorSection>
          )}
        </div>

        {/* Right — Live Preview */}
        {previewVisible && (
          <div className="w-[500px] shrink-0 bg-slate-100 border-l border-slate-200 overflow-y-auto flex flex-col min-h-0">
            <div className="sticky top-0 bg-slate-100 border-b border-slate-200 px-4 py-3 flex items-center justify-between z-10 shrink-0">
              <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Preview ao Vivo</p>
              <span className="text-[10px] text-slate-400 font-bold bg-white px-2 py-0.5 rounded-full border border-slate-200">Modo Leitura</span>
            </div>
            <ScaledPreview content={content} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Shared Styles ─────────────────────────────────────────────────────────────
const inputCls = "w-full p-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest block">{label}</label>
      {children}
    </div>
  );
}

function EditorSection({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="space-y-5">
      <div className="border-b border-slate-200 pb-4">
        <h3 className="text-lg font-black text-slate-900">{title}</h3>
        <p className="text-sm text-slate-500 mt-1">{desc}</p>
      </div>
      {children}
    </div>
  );
}

function ColorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-3">
      <input type="color" value={value} onChange={e => onChange(e.target.value)} className="w-12 h-12 rounded-xl cursor-pointer border-none p-0 overflow-hidden" />
      <input value={value} onChange={e => onChange(e.target.value)} className={cn(inputCls, 'font-mono')} placeholder="#4f46e5" />
    </div>
  );
}

// ─── Scaled Preview Wrapper ────────────────────────────────────────────────────
// Renders the SitePreview at 960px wide then scales it to fit the ~500px panel.
// Uses ResizeObserver to track the inner content height and sets the wrapper height
// so the outer scroll container works correctly.
const PREVIEW_INNER_WIDTH = 960;
const PREVIEW_SCALE = 500 / PREVIEW_INNER_WIDTH; // ≈ 0.52

function ScaledPreview({ content }: { content: SiteContent }) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [innerHeight, setInnerHeight] = useState(0);

  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        setInnerHeight(entry.contentRect.height);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const outerHeight = innerHeight > 0 ? innerHeight * PREVIEW_SCALE : 'auto';

  return (
    // Outer wrapper: exact scaled height, clips the oversized inner content
    <div style={{ width: '100%', height: outerHeight, position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
      {/* Inner: full 960px wide, scaled from top-left corner */}
      <div
        ref={innerRef}
        style={{
          width: PREVIEW_INNER_WIDTH,
          transformOrigin: 'top left',
          transform: `scale(${PREVIEW_SCALE})`,
          position: 'absolute',
          top: 0,
          left: 0,
        }}
      >
        <SitePreview content={content} />
      </div>
    </div>
  );
}

// ─── Live Preview Component ────────────────────────────────────────────────────
function SitePreview({ content }: { content: SiteContent }) {
  const c = content;
  return (
    <div className="bg-white font-sans text-slate-900 overflow-hidden min-w-[960px]">
      {/* Nav */}
      <nav className="w-full z-50 bg-white/90 border-b border-slate-100 h-20 flex items-center px-12 justify-between">
        <div className="flex items-center gap-2 font-bold text-2xl text-indigo-600">
          {c.nav.logoUrl
            ? <img src={c.nav.logoUrl} className="h-8 object-contain" alt="logo" />
            : <Heart className="w-8 h-8 fill-indigo-600" />
          }
          <span>{c.nav.clinicName}</span>
        </div>
        <div className="flex items-center gap-6 text-sm font-medium text-slate-600">
          <a className="hover:text-indigo-600">Início</a>
          <a className="hover:text-indigo-600">Serviços</a>
          <a className="hover:text-indigo-600">Equipe</a>
          <a className="hover:text-indigo-600">Contato</a>
          <span className="px-5 py-2 rounded-full text-white text-sm font-bold" style={{ backgroundColor: c.nav.ctaColor }}>
            {c.nav.ctaLabel}
          </span>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-20 pb-20 px-12 bg-slate-50 relative overflow-hidden">
        <div className="max-w-6xl mx-auto flex items-center gap-16">
          <div className="flex-1 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white rounded-full border border-slate-200 text-xs font-bold text-indigo-600 uppercase tracking-widest">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
              {c.hero.badge}
            </div>
            <h1 className="text-5xl font-bold tracking-tight leading-[1.1]">
              {c.hero.title} <span className="text-indigo-600">{c.hero.titleHighlight}</span>
            </h1>
            <p className="text-lg text-slate-600 leading-relaxed max-w-lg">{c.hero.subtitle}</p>
            <div className="flex gap-4 pt-2">
              <span className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold shadow-xl shadow-indigo-200">{c.hero.ctaPrimary}</span>
              <span className="px-6 py-3 bg-white text-slate-900 border border-slate-200 rounded-2xl font-bold">{c.hero.ctaSecondary}</span>
            </div>
          </div>
          <div className="flex-1 grid grid-cols-2 gap-4">
            <div className="space-y-4 pt-12">
              {c.hero.imageUrl && (
                <img src={c.hero.imageUrl} className="rounded-3xl shadow-xl h-48 w-full object-cover" alt="hero" />
              )}
              <div className="bg-indigo-600 p-6 rounded-3xl text-white shadow-xl">
                <h3 className="text-3xl font-bold">{c.hero.stat}</h3>
                <p className="text-sm opacity-90 mt-1">{c.hero.statLabel}</p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xl">
                <Calendar className="w-8 h-8 text-indigo-600 mb-3" />
                <h4 className="font-bold text-lg">Online e Presencial</h4>
                <p className="text-xs text-slate-500 mt-1">Escolha a modalidade que melhor se adapta à sua rotina.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="py-20 px-12 bg-white">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <h2 className="text-4xl font-bold">Nossas Especialidades</h2>
            <p className="text-slate-600 text-lg">Oferecemos diversas modalidades de terapia.</p>
          </div>
          <div className="grid grid-cols-3 gap-6">
            {c.services.slice(0, 6).map((s, i) => (
              <div key={i} className="p-8 rounded-3xl bg-slate-50 border border-transparent hover:shadow-xl transition-all">
                <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center text-indigo-600 shadow-sm mb-6">
                  <ServiceIcon name={s.icon} className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-bold mb-3">{s.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      {c.team.enabled && c.team.members.length > 0 && (
        <section className="py-20 px-12 bg-slate-50">
          <div className="max-w-6xl mx-auto space-y-12">
            <div className="text-center space-y-3">
              <h2 className="text-4xl font-bold">{c.team.title}</h2>
              <p className="text-slate-600 text-lg">{c.team.subtitle}</p>
            </div>
            <div className="grid grid-cols-3 gap-6">
              {c.team.members.map((m, i) => (
                <div key={i} className="p-8 rounded-3xl bg-white border border-slate-100 shadow-sm text-center space-y-4">
                  {m.photoUrl
                    ? <img src={m.photoUrl} className="w-24 h-24 rounded-2xl object-cover mx-auto" alt={m.name} />
                    : <div className="w-24 h-24 rounded-2xl bg-indigo-100 flex items-center justify-center mx-auto"><Users className="w-10 h-10 text-indigo-400" /></div>
                  }
                  <div>
                    <h3 className="text-xl font-bold">{m.name}</h3>
                    <p className="text-indigo-600 text-sm font-bold">{m.role}</p>
                  </div>
                  <p className="text-slate-500 text-sm leading-relaxed">{m.bio}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="py-20 px-12">
        <div className="max-w-6xl mx-auto rounded-[3rem] p-16 text-white relative overflow-hidden shadow-2xl" style={{ backgroundColor: c.cta.bgColor }}>
          <div className="relative z-10 max-w-2xl space-y-6">
            <h2 className="text-5xl font-bold leading-tight">{c.cta.title}</h2>
            <p className="text-xl opacity-90 leading-relaxed">{c.cta.subtitle}</p>
            <div className="flex gap-4 pt-2">
              <span className="px-8 py-4 bg-white text-slate-900 rounded-2xl font-bold">{c.cta.ctaLabel}</span>
              <span className="px-8 py-4 bg-white/20 text-white border border-white/30 rounded-2xl font-bold">{c.cta.whatsappLabel}</span>
            </div>
          </div>
          <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-96 h-96 rounded-full bg-white/10 blur-[80px]" />
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 px-12 bg-slate-900 text-slate-400">
        <div className="max-w-6xl mx-auto grid grid-cols-4 gap-12">
          <div className="col-span-2 space-y-6">
            <div className="flex items-center gap-2 font-bold text-2xl text-white">
              <Heart className="w-7 h-7 fill-indigo-500 text-indigo-500" />
              <span>{c.nav.clinicName}</span>
            </div>
            <p>{c.footer.about}</p>
            <div className="flex gap-3">
              <a href={c.footer.instagram} className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-white hover:bg-indigo-600 transition-colors">
                <Instagram className="w-5 h-5" />
              </a>
              <a href={c.footer.facebook} className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-white hover:bg-indigo-600 transition-colors">
                <Facebook className="w-5 h-5" />
              </a>
            </div>
          </div>
          <div className="space-y-4">
            <h4 className="text-white font-bold">Links Rápidos</h4>
            <ul className="space-y-3 text-sm font-medium">
              <li>Início</li><li>Serviços</li><li>Equipe</li><li>Agendamento</li>
            </ul>
          </div>
          <div className="space-y-4 text-sm">
            <h4 className="text-white font-bold">Contato</h4>
            <p className="flex items-start gap-2"><MapPin className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />{c.footer.address}<br />{c.footer.city}</p>
            <p className="flex items-center gap-2"><Phone className="w-4 h-4 text-indigo-500 shrink-0" />{c.footer.phone}</p>
            <p className="flex items-center gap-2"><Mail className="w-4 h-4 text-indigo-500 shrink-0" />{c.footer.email}</p>
          </div>
        </div>
        <div className="max-w-6xl mx-auto pt-12 mt-12 border-t border-slate-800 text-sm text-center">
          <p>{c.footer.copyright}</p>
        </div>
      </footer>
    </div>
  );
}
