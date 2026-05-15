import React, { useState } from 'react';
import { Calculator, FileText, UserCheck, TrendingUp, Settings2, Save } from 'lucide-react';

export default function PayrollManager() {
  const [activeTab, setActiveTab] = useState<'clt' | 'mei' | 'tabelas'>('clt');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 border-b border-slate-200 pb-1">
        {[
          { id: 'clt', label: 'Folha CLT', icon: UserCheck },
          { id: 'mei', label: 'Contratos MEI', icon: FileText },
          { id: 'tabelas', label: 'Tabelas Tributárias', icon: Settings2 },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-6 py-4 text-sm font-bold border-b-2 transition-all ${
              activeTab === tab.id 
                ? "border-indigo-600 text-indigo-600" 
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'clt' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
              <h3 className="text-xl font-bold">Cálculo de Holerite</h3>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Funcionário</label>
                  <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none">
                    <option>Selecione um funcionário...</option>
                    <option>Dra. Juliana Mendes (Terapeuta)</option>
                    <option>Marcos Silva (Recepção)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Salário Base (R$)</label>
                  <input type="number" placeholder="0,00" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
              </div>
              <button className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2">
                <Calculator className="w-5 h-5" /> Calcular Encargos (INSS/IRRF)
              </button>
            </div>

            <div className="bg-slate-50 p-8 rounded-3xl border border-dashed border-slate-200 text-center space-y-2">
              <TrendingUp className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-slate-500 font-medium">Os resultados do cálculo aparecerão aqui após processar os dados.</p>
            </div>
          </div>

          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6 h-fit">
            <h4 className="font-bold flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" /> Holerites Recentes
            </h4>
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                  <div>
                    <p className="text-sm font-bold text-slate-800">Competência 04/2026</p>
                    <p className="text-xs text-slate-500">Juliana Mendes</p>
                  </div>
                  <button className="text-xs font-bold text-indigo-600 hover:underline">PDF</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'tabelas' && (
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm max-w-2xl mx-auto space-y-8">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold">Gestão Legislativa (ADM)</h3>
            <span className="px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-[10px] font-bold uppercase">Uso restrito</span>
          </div>
          <p className="text-slate-500 text-sm">Atualize aqui as alíquotas de INSS e IRRF conforme as atualizações do Governo Federal.</p>
          
          <div className="space-y-6">
            <div className="space-y-4">
              <h4 className="font-bold text-slate-700 border-l-4 border-indigo-500 pl-3">Tabela INSS 2026</h4>
              <div className="grid grid-cols-2 gap-4">
                <input placeholder="Faixa 1 (7.5%)" className="p-3 bg-slate-50 border border-slate-200 rounded-xl" defaultValue="1412.00" />
                <input placeholder="Faixa 2 (9%)" className="p-3 bg-slate-50 border border-slate-200 rounded-xl" defaultValue="2666.68" />
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-bold text-slate-700 border-l-4 border-emerald-500 pl-3">Tabela IRRF 2026</h4>
              <div className="grid grid-cols-2 gap-4">
                <input placeholder="Isento até" className="p-3 bg-slate-50 border border-slate-200 rounded-xl" defaultValue="2259.20" />
                <input placeholder="Alíquota 7.5% até" className="p-3 bg-slate-50 border border-slate-200 rounded-xl" defaultValue="2826.65" />
              </div>
            </div>

            <button className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-all">
              <Save className="w-5 h-5" /> Aplicar Atualizações Tributárias
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
