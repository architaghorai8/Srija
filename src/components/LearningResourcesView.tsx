import { useEffect, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { apiRequest } from '../lib/api';
import type { LearningModuleItem } from '../types';

export function LearningResourcesView() {
  const [modules, setModules] = useState<LearningModuleItem[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest<{ modules: LearningModuleItem[] }>('/api/learning')
      .then((res) => {
        setModules(res.modules);
        if (res.modules.length > 0) setActiveId(res.modules[0].id);
      })
      .finally(() => setLoading(false));
  }, []);

  const activeModule = modules.find((m) => m.id === activeId) || modules[0] || null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-[#141E1A]">Learning Resources</h1>
        <p className="text-sm text-slate-600 mt-1">
          Field protocols, DNA metabarcoding principles, taxonomic hierarchy, and biodiversity mathematics.
        </p>
      </div>

      {/* Visual Field & Lab Overview Strip */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white border border-[#D8E6DF] rounded-2xl overflow-hidden flex flex-col">
          <div className="h-52 bg-[#F0F7F4] overflow-hidden">
            <img
              src="/src/assets/images/lab_water_sampling_1795608908424.jpg"
              alt="Field biologist filtering river water for environmental DNA"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="p-5 space-y-1">
            <p className="text-xs font-mono text-emerald-700">FIELD COLLECTION PROTOCOL</p>
            <h2 className="text-lg font-semibold text-[#141E1A]">Sterile Membrane Filtration &amp; Blank Controls</h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Water, soil, and sediment samples capture extracellular and cellular DNA shed by resident organisms without physical capture.
            </p>
          </div>
        </div>

        <div className="bg-white border border-[#D8E6DF] rounded-2xl overflow-hidden flex flex-col">
          <div className="h-52 bg-white overflow-hidden">
            <img
              src="/src/assets/images/learning_sequencing_1795608908201.jpg"
              alt="Environmental DNA extraction, PCR amplification, and phylogenetic analysis diagram"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="p-5 space-y-1">
            <p className="text-xs font-mono text-emerald-700">METABARCODING PIPELINE</p>
            <h2 className="text-lg font-semibold text-[#141E1A]">PCR Amplification, Sequencing &amp; Taxonomic Assignment</h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Amplicon sequences are quality-filtered, denoised into ASVs, and aligned against curated reference databases before diversity modeling.
            </p>
          </div>
        </div>
      </div>

      {/* Interactive Curriculum */}
      {loading ? (
        <div className="bg-white border border-[#D8E6DF] rounded-2xl p-10 text-center text-sm text-slate-500">
          Loading curriculum modules...
        </div>
      ) : (
        <div className="grid lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 bg-white border border-[#D8E6DF] rounded-2xl p-4 space-y-1.5">
            {modules.map((mod, idx) => {
              const isSel = activeModule?.id === mod.id;
              return (
                <button
                  key={mod.id}
                  type="button"
                  onClick={() => setActiveId(mod.id)}
                  className={`w-full text-left p-3 rounded-xl transition-colors cursor-pointer ${
                    isSel ? 'bg-[#064E3B] text-white' : 'hover:bg-[#F6FAF8] text-slate-800'
                  }`}
                >
                  <p className={`text-[11px] font-mono ${isSel ? 'text-emerald-200' : 'text-emerald-700'}`}>
                    0{idx + 1}. {mod.category}
                  </p>
                  <p className="text-sm font-semibold mt-0.5">{mod.title}</p>
                </button>
              );
            })}
          </div>

          <div className="lg:col-span-8 bg-white border border-[#D8E6DF] rounded-2xl p-6 sm:p-8 space-y-5">
            {activeModule ? (
              <>
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
                  <div>
                    <p className="text-xs font-mono text-emerald-700">{activeModule.category}</p>
                    <h2 className="text-2xl font-semibold text-[#141E1A] mt-1">{activeModule.title}</h2>
                    <p className="text-sm text-slate-600 mt-1">{activeModule.summary}</p>
                  </div>
                  <BookOpen className="w-6 h-6 text-[#064E3B] shrink-0" />
                </div>

                <p className="text-sm sm:text-base text-slate-700 leading-relaxed">{activeModule.content}</p>

                {activeModule.key_formula && (
                  <div className="p-4 rounded-xl bg-[#F0F7F4] border border-[#C6DFD3]">
                    <p className="text-xs font-semibold text-[#064E3B] mb-1">Key Relationship / Formula</p>
                    <p className="font-mono text-sm text-[#141E1A]">{activeModule.key_formula}</p>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-slate-500">Select a learning module to read.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
