import React from 'react';
import { Trophy, Gift, Star, Target, Zap, ChevronRight } from 'lucide-react';

export default function GamificationView() {
  return (
    <div className="space-y-8">
      <div className="bg-gradient-to-r from-amber-400 to-orange-500 p-10 rounded-[3rem] text-white shadow-xl shadow-orange-100 flex flex-col md:row items-center justify-between gap-8">
        <div className="space-y-4">
          <h2 className="text-3xl font-bold flex items-center gap-3">
            <Trophy className="w-10 h-10 text-white fill-white/20" /> Centra de Fidelidade
          </h2>
          <p className="text-orange-50 text-lg font-medium">Gerencie pontos de check-in e recompensas para seus pacientes.</p>
        </div>
        <button className="bg-white text-orange-600 px-8 py-4 rounded-2xl font-bold text-lg hover:shadow-2xl transition-all shadow-xl">
          Configurar Regras
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Check-in Stats */}
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          <h4 className="font-bold text-lg flex items-center gap-2 tracking-tight">
            <Zap className="w-5 h-5 text-amber-500 fill-amber-500" /> Atividade WiFi (Captive Portal)
          </h4>
          <div className="space-y-4">
            {[
              { patient: 'João Oliveira', points: 450, totalCheckins: 12, last: 'Hoje' },
              { patient: 'Maria Santos', points: 300, totalCheckins: 8, last: 'Ontem' },
              { patient: 'Ana Costa', points: 850, totalCheckins: 22, last: '2 dias' },
            ].map((p, i) => (
              <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl group hover:bg-white hover:shadow-md transition-all border border-transparent hover:border-slate-100">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center font-bold text-slate-400">
                    {p.patient.charAt(0)}
                  </div>
                  <div>
                    <p className="font-bold text-sm text-slate-800">{p.patient}</p>
                    <p className="text-[10px] text-slate-500">{p.totalCheckins} check-ins realizados</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 text-amber-600">
                    <Star className="w-3 h-3 fill-amber-600" />
                    <span className="font-bold text-sm">{p.points}</span>
                  </div>
                  <p className="text-[10px] text-slate-400">Último: {p.last}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Rewards Catalog */}
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          <h4 className="font-bold text-lg flex items-center gap-2 tracking-tight">
            <Gift className="w-5 h-5 text-indigo-600" /> Recompensas Ativas
          </h4>
          <div className="space-y-4">
            {[
              { title: '10% de Desconto na Próxima', cost: '500 pts', stock: 'Ilimitado' },
              { title: 'Brinde: Caderno de Reflexão', cost: '1200 pts', stock: '12 un' },
              { title: 'Isenção de Sessão Especial', cost: '5000 pts', stock: '1 un' },
            ].map((r, i) => (
              <div key={i} className="flex items-center justify-between p-6 rounded-2xl border border-indigo-50 bg-indigo-50/20">
                <div>
                  <p className="font-bold text-indigo-900">{r.title}</p>
                  <p className="text-xs text-indigo-400 font-medium">{r.stock} em estoque</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-xs font-bold">{r.cost}</span>
                  <ChevronRight className="w-4 h-4 text-indigo-300" />
                </div>
              </div>
            ))}
          </div>
          <button className="w-full py-4 text-indigo-600 font-bold text-sm border-2 border-dashed border-indigo-100 rounded-2xl hover:bg-indigo-50 transition-all">
            + Adicionar Nova Recompensa
          </button>
        </div>
      </div>
    </div>
  );
}
